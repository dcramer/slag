import type { ProfileOverride } from '../gen/level';
import { buildLevel } from '../gen/level/pregen';
import type { CrateItem, Match, Phase, Player } from '../game/match';
import type { MatchRules } from '../game/rules';
import type { RoundResult } from '../game/scoring';
import type { BloodCell } from '../sim/blood';
import { isProtected, type Level, T_EMPTY } from '../sim/level';
import type { PlacedProp } from '../sim/props';
import { RunWorld } from '../sim/run';
import type { Weather } from '../sim/weather';
import type { ThemeId } from '../themes';
import { cleanCharacter } from './actions';

/**
 * Full, JSON-safe snapshots of a Match, used to bring late joiners and
 * reconnecting peers up to date, to resync after a desync, to hand state to a
 * newly elected host, and to resume a room after everyone left.
 *
 * The level is not shipped: it is regenerated from (seed, theme) and the
 * mutable bits (bomb craters, destroyed set pieces) are patched on top.
 * Its weather is in the snapshot too, even though the same seed rolls the
 * same weather, so a peer that somehow disagrees shows up in the hash.
 * Values go through `toWire` so -0, NaN, ±Infinity, Maps and typed arrays
 * survive JSON exactly (the sim must be bit-identical after a restore).
 */

/**
 * Snapshot format version; bump on incompatible changes (old saves are dropped).
 * A new field on Match or RunWorld must be added here or listed as derived:
 * tests/snapshot.test.ts fails until it is.
 * Worktree branches never bump it, since two bumps always conflict: `pnpm land` bumps it once
 * for a batch that changed this file's code or that test's field lists (`--snap` for a change in what a field means).
 */
export const SNAP_VERSION = 45;

export interface RunSnap {
  slots: number[];
  timeLimit: number;
  frame: number;
  runners: unknown;
  projectiles: unknown;
  finishOrder: number[];
  kills: { victim: number; killer: number }[];
  endFrame: number;
  propState: unknown;
  seq: number;
  items: unknown;
  itemSeed: number;
}

export interface MatchSnap {
  v: number;
  seed: number;
  themeOverride: ThemeId | null;
  phase: Phase;
  phaseFrame: number;
  frame: number;
  round: number;
  /** Rounds in a row nobody finished (it weights the next crate). */
  dryRounds: number;
  /**
   * What the level on screen was generated with beyond (seed, theme). Read from the level, not
   * from the rules: rules can change after a level is built, and the recipe must still rebuild it.
   */
  profile: ProfileOverride;
  force: ProfileOverride;
  players: unknown;
  placed: unknown;
  /** The bridges that keep the match winnable (Match.plan): the next proof starts from them. */
  plan: { x: number; y: number }[];
  /** Blood on the level (sim/blood.ts): small integers only, and it moves footing. */
  blood: BloodCell[];
  crate: unknown;
  rules: MatchRules;
  result: unknown;
  prevScores: [number, number][];
  winners: number[];
  nextUid: number;
  charRolls: number;
  salt: number;
  nextSalt: number;
  pendingAdvance: number | null;
  level: { tiles: string; setPieces: number[]; version: number; weather: Weather | null };
  run: RunSnap | null;
}

/** Match's private bookkeeping, reached for by the snapshot code only. */
interface MatchPrivate {
  events: unknown[];
  nextUid: number;
  charRolls: number;
  pendingAdvance: number | undefined;
}

/** RunWorld internals that are rebuilt on restore. */
interface RunPrivate {
  events: unknown[];
  seq: number;
}

// ---------------------------------------------------------------- wire codec

/** Recursively convert to JSON-safe data, tagging values JSON would lose. */
export function toWire(v: unknown): unknown {
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return { $n: 'nan' };
    if (v === Infinity) return { $n: 'inf' };
    if (v === -Infinity) return { $n: '-inf' };
    if (Object.is(v, -0)) return { $n: '-0' };
    return v;
  }
  if (v === null || typeof v !== 'object') return v === undefined ? null : v;
  if (Array.isArray(v)) return v.map(toWire);
  if (v instanceof Map) return { $m: [...v.entries()].map(([k, x]) => [toWire(k), toWire(x)]) };
  if (v instanceof Uint8Array) return { $u8: bytesToB64(v) };
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) if (x !== undefined && typeof x !== 'function') o[k] = toWire(x);
  return o;
}

/** Inverse of toWire. */
export function fromWire(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => fromWire(x));
  const o = v as Record<string, unknown>;
  if ('$n' in o) return ({ nan: NaN, inf: Infinity, '-inf': -Infinity, '-0': -0 } as Record<string, number>)[o.$n as string];
  if ('$m' in o) return new Map((o.$m as [unknown, unknown][]).map(([k, x]) => [fromWire(k), fromWire(x)]));
  if ('$u8' in o) return b64ToBytes(o.$u8 as string);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(o)) out[k] = fromWire(x);
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return s;
}
function b64ToBytes(s: string): Uint8Array {
  const len = (s.length / 4) * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((B64.indexOf(s[i + 2]) & 63) << 6) | (B64.indexOf(s[i + 3]) & 63);
    if (o < len) out[o++] = (n >> 16) & 255;
    if (o < len) out[o++] = (n >> 8) & 255;
    if (o < len) out[o++] = n & 255;
  }
  return out;
}

// ---------------------------------------------------------------- levels

const pristine = new Map<string, Level>();
const pristineKey = (seed: number, theme: ThemeId | undefined, profile: ProfileOverride) => `${seed}:${theme ?? ''}:${JSON.stringify(profile)}`;

/** The freshly generated level for (seed, theme, profile), cached (generation is slow). Never mutate the result. */
function pristineLevel(seed: number, theme: ThemeId | undefined, profile: ProfileOverride): Level {
  const key = pristineKey(seed, theme, profile);
  let l = pristine.get(key);
  if (!l) {
    l = buildLevel(seed, theme, profile);
    l = { ...l, tiles: l.tiles.slice(), setPieces: [...l.setPieces] };
    pristine.set(key, l);
    if (pristine.size > 6) pristine.delete(pristine.keys().next().value!);
  }
  return l;
}

/**
 * Can `tiles` be `base` as play left it? Bombs are the only thing that changes tiles once a level
 * exists, and they only clear unprotected cells, so anything else is a different level: a save or a
 * peer from a build whose generator gave this seed other terrain. SNAP_VERSION can't catch that,
 * since a generator change leaves the snapshot format alone.
 */
function isPlayedCopy(base: Level, tiles: Uint8Array): boolean {
  if (tiles.length !== base.tiles.length) return false;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === base.tiles[i]) continue;
    if (tiles[i] !== T_EMPTY || isProtected(base, i % base.w, Math.floor(i / base.w))) return false;
  }
  return true;
}

/** Remember a level as pristine (call right after generating it) so restores can skip regeneration. */
export function rememberPristine(seed: number, theme: ThemeId | undefined, level: Level, profile: ProfileOverride = {}) {
  const key = pristineKey(seed, theme, profile);
  if (!pristine.has(key)) pristine.set(key, { ...level, tiles: level.tiles.slice(), setPieces: [...level.setPieces] });
}

// ---------------------------------------------------------------- snapshot / restore

/**
 * The stage concept the level was built with, when the profile alone wouldn't rebuild it: its
 * landmark's, or a forced one (a forced concept that fell back, or a forced plain level).
 */
function levelConcept(m: Match): ProfileOverride {
  const concept = m.level.landmark?.concept ?? m.forceProfile.concept;
  return concept ? { concept } : {};
}

export function snapshotMatch(m: Match): MatchSnap {
  const mp = m as unknown as MatchPrivate;
  const run = m.run;
  return {
    v: SNAP_VERSION,
    seed: m.seed,
    themeOverride: m.themeOverride ?? null,
    phase: m.phase,
    phaseFrame: m.phaseFrame,
    frame: m.frame,
    round: m.round,
    dryRounds: m.dryRounds,
    profile: m.level.profile ? { ...m.level.profile, ...levelConcept(m) } : m.profileOverride(),
    force: { ...m.forceProfile },
    players: toWire(m.players),
    placed: toWire(m.placed),
    plan: m.plan.map((b) => ({ x: b.x, y: b.y })),
    blood: m.blood.map((c) => ({ ...c })),
    crate: toWire(m.crate),
    rules: { ...m.rules },
    result: toWire(m.result),
    prevScores: [...m.prevScores.entries()],
    winners: [...m.winners],
    nextUid: mp.nextUid,
    charRolls: mp.charRolls,
    salt: m.salt,
    nextSalt: m.nextSalt,
    pendingAdvance: mp.pendingAdvance ?? null,
    level: { tiles: bytesToB64(m.level.tiles), setPieces: m.level.setPieces.map((p) => p.uid), version: m.level.version, weather: m.level.weather ?? null },
    run: run
      ? {
          slots: run.runners.map((r) => r.slot),
          timeLimit: run.timeLimit,
          frame: run.frame,
          runners: toWire(run.runners),
          projectiles: toWire(run.projectiles),
          finishOrder: [...run.finishOrder],
          kills: run.kills.map((k) => ({ ...k })),
          endFrame: run.endFrame,
          propState: toWire(run.propState),
          seq: (run as unknown as RunPrivate).seq,
          items: toWire(run.items),
          itemSeed: run.itemSeed,
        }
      : null,
  };
}

/**
 * Overwrite `m` in place with snapshot `s` (references held by the renderer,
 * audio and debug tools stay valid). Pending events are dropped. Throws, leaving `m` untouched, on
 * a snapshot this build can't load: its spawn, goal and set pieces come from regenerating the level,
 * so tiles from any other level would put the ring and flag on terrain the runners aren't on.
 */
export function restoreMatch(m: Match, s: MatchSnap): void {
  if (s.v !== SNAP_VERSION) throw new Error(`snapshot v${s.v} != v${SNAP_VERSION}`);
  const mp = m as unknown as MatchPrivate;
  const theme = s.themeOverride ?? undefined;
  const prev = { run: m.run, round: m.round, phase: m.phase, level: m.level, placed: m.placed.map((p) => p.uid).join() };
  const base = pristineLevel(s.seed, theme, s.profile);
  const tiles = b64ToBytes(s.level.tiles);
  if (!isPlayedCopy(base, tiles)) throw new Error(`snapshot of level ${s.seed} has terrain this build doesn't generate`);
  const keep = new Set(s.level.setPieces);
  const cur = m.level;
  const same =
    cur.seed === s.seed &&
    cur.theme.id === base.theme.id &&
    JSON.stringify(cur.profile) === JSON.stringify(base.profile) &&
    cur.tiles.length === tiles.length &&
    cur.tiles.every((t, i) => t === tiles[i]);
  if (!same || cur.setPieces.length !== keep.size || cur.setPieces.some((p) => !keep.has(p.uid))) {
    // Renderers cache terrain by (seed, version): bump past whatever is on screen when tiles change.
    const version = same ? s.level.version : Math.max(s.level.version, cur.version + 1);
    m.level = { ...base, tiles, setPieces: base.setPieces.filter((p) => keep.has(p.uid)), version };
  } else {
    m.level.version = s.level.version;
  }
  m.level.weather = s.level.weather ?? undefined;
  m.seed = s.seed;
  m.themeOverride = theme;
  m.phase = s.phase;
  m.phaseFrame = s.phaseFrame;
  m.frame = s.frame;
  m.round = s.round;
  m.dryRounds = s.dryRounds;
  m.forceProfile = { ...s.force };
  m.players = fromWire(s.players) as Player[];
  // A name the filter refuses never reaches the screen, whoever sent the snapshot or wrote the save.
  for (const p of m.players) p.character = cleanCharacter(p.character);
  m.placed = fromWire(s.placed) as PlacedProp[];
  m.plan = s.plan.map((b) => ({ x: b.x, y: b.y }));
  m.blood = s.blood.map((c) => ({ ...c }));
  m.crate = fromWire(s.crate) as CrateItem[];
  m.rules = { ...s.rules };
  m.result = fromWire(s.result) as RoundResult | null;
  m.prevScores = new Map(s.prevScores);
  m.winners = [...s.winners];
  m.salt = s.salt;
  m.nextSalt = s.nextSalt;
  mp.nextUid = s.nextUid;
  mp.charRolls = s.charRolls;
  mp.pendingAdvance = s.pendingAdvance ?? undefined;
  mp.events = [];
  // Reuse the current RunWorld object when it is the same race: audio/render trackers key on its identity.
  const sameRace =
    !!prev.run &&
    !!s.run &&
    prev.phase === 'run' &&
    s.phase === 'run' &&
    prev.round === s.round &&
    prev.level === m.level &&
    prev.placed === m.placed.map((p) => p.uid).join() &&
    sameSlots(prev.run, s.run.slots);
  m.run = s.run ? restoreRun(sameRace ? prev.run! : new RunWorld(m.level, m.placed, s.run.slots, s.run.timeLimit, s.run.itemSeed), s.run) : null;
  if (m.run) {
    m.run.blood = m.blood;
    m.run.bleeds = m.rules.bloodRounds > 0;
  }
}

function restoreRun(run: RunWorld, s: RunSnap): RunWorld {
  run.frame = s.frame;
  run.runners = fromWire(s.runners) as RunWorld['runners'];
  run.projectiles = fromWire(s.projectiles) as RunWorld['projectiles'];
  run.finishOrder = [...s.finishOrder];
  run.kills = s.kills.map((k) => ({ ...k }));
  run.endFrame = s.endFrame;
  run.propState = fromWire(s.propState) as RunWorld['propState'];
  run.items = fromWire(s.items) as RunWorld['items'];
  (run as unknown as RunPrivate).events = [];
  (run as unknown as RunPrivate).seq = s.seq;
  return run;
}

function sameSlots(run: RunWorld, slots: number[]): boolean {
  return run.runners.length === slots.length && run.runners.every((r, i) => r.slot === slots[i]);
}

/** Deep copy (cheap enough for one snapshot per second; used for the resume save and tests). */
export function cloneSnap(s: MatchSnap): MatchSnap {
  return JSON.parse(JSON.stringify(s)) as MatchSnap;
}

// ---------------------------------------------------------------- hashing

/**
 * FNV-1a over a snapshot's canonical form (sorted keys, exact float bits).
 * Peers compare these every HASH_EVERY frames to detect desyncs. The level
 * version counter is excluded (it is a render cache key; the tiles are hashed).
 */
export function hashSnap(s: MatchSnap): number {
  const h = new Hasher();
  const { level, ...rest } = s;
  h.value(rest);
  h.value(level.tiles);
  h.value(level.setPieces);
  h.value(level.weather);
  return h.h >>> 0;
}

export function hashMatch(m: Match): number {
  return hashSnap(snapshotMatch(m));
}

const HF = new Float64Array(1);
const HU = new Uint32Array(HF.buffer);
class Hasher {
  h = 0x811c9dc5;
  private int(n: number) {
    for (let i = 0; i < 4; i++) {
      this.h ^= (n >>> (i * 8)) & 255;
      this.h = Math.imul(this.h, 0x01000193);
    }
  }
  private str(s: string) {
    for (let i = 0; i < s.length; i++) {
      this.h ^= s.charCodeAt(i);
      this.h = Math.imul(this.h, 0x01000193);
    }
    this.int(s.length);
  }
  value(v: unknown) {
    if (v === null || v === undefined) return this.int(0x6e756c6c);
    switch (typeof v) {
      case 'number':
        HF[0] = v;
        this.int(HU[0]);
        this.int(HU[1]);
        return;
      case 'string':
        return this.str(v);
      case 'boolean':
        return this.int(v ? 0x74727565 : 0x66616c73);
      case 'object': {
        if (Array.isArray(v)) {
          this.int(v.length);
          for (const x of v) this.value(x);
          return;
        }
        const keys = Object.keys(v).sort();
        this.int(keys.length);
        for (const k of keys) {
          this.str(k);
          this.value((v as Record<string, unknown>)[k]);
        }
        return;
      }
      default:
        return this.int(0);
    }
  }
}
