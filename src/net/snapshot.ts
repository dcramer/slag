import { generateLevel } from '../gen/level';
import type { CrateItem, Match, Phase, Player } from '../game/match';
import type { MatchRules } from '../game/rules';
import type { RoundResult } from '../game/scoring';
import type { Level } from '../sim/level';
import type { PlacedProp } from '../sim/props';
import { RunWorld } from '../sim/run';
import type { ThemeId } from '../themes';

/**
 * Full, JSON-safe snapshots of a Match, used to bring late joiners and
 * reconnecting peers up to date, to resync after a desync, to hand state to a
 * newly elected host, and to resume a room after everyone left.
 *
 * The level is not shipped: it is regenerated from (seed, theme) and the
 * mutable bits (bomb craters, destroyed set pieces) are patched on top.
 * Values go through `toWire` so -0, NaN, ±Infinity, Maps and typed arrays
 * survive JSON exactly (the sim must be bit-identical after a restore).
 */

/** Snapshot format version; bump on incompatible changes (old saves are dropped). */
export const SNAP_VERSION = 1;

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
}

export interface MatchSnap {
  v: number;
  seed: number;
  themeOverride: ThemeId | null;
  phase: Phase;
  phaseFrame: number;
  frame: number;
  round: number;
  players: unknown;
  placed: unknown;
  crate: unknown;
  rules: MatchRules;
  result: unknown;
  prevScores: [number, number][];
  winners: number[];
  nextUid: number;
  charRolls: number;
  pendingAdvance: number | null;
  level: { tiles: string; setPieces: number[]; version: number };
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
export function fromWire<T = unknown>(v: unknown): T {
  if (v === null || typeof v !== 'object') return v as T;
  if (Array.isArray(v)) return v.map((x) => fromWire(x)) as T;
  const o = v as Record<string, unknown>;
  if ('$n' in o) return ({ nan: NaN, inf: Infinity, '-inf': -Infinity, '-0': -0 } as Record<string, number>)[o.$n as string] as T;
  if ('$m' in o) return new Map((o.$m as [unknown, unknown][]).map(([k, x]) => [fromWire(k), fromWire(x)])) as T;
  if ('$u8' in o) return b64ToBytes(o.$u8 as string) as T;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(o)) out[k] = fromWire(x);
  return out as T;
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
/** The freshly generated level for (seed, theme), cached (generation takes ~50–100 ms). Never mutate the result. */
function pristineLevel(seed: number, theme: ThemeId | undefined): Level {
  const key = `${seed}:${theme ?? ''}`;
  let l = pristine.get(key);
  if (!l) {
    l = generateLevel(seed, theme);
    l = { ...l, tiles: l.tiles.slice(), setPieces: [...l.setPieces] };
    pristine.set(key, l);
    if (pristine.size > 6) pristine.delete(pristine.keys().next().value!);
  }
  return l;
}

/** Remember a level as pristine (call right after generating it) so restores can skip regeneration. */
export function rememberPristine(seed: number, theme: ThemeId | undefined, level: Level) {
  const key = `${seed}:${theme ?? ''}`;
  if (!pristine.has(key)) pristine.set(key, { ...level, tiles: level.tiles.slice(), setPieces: [...level.setPieces] });
}

// ---------------------------------------------------------------- snapshot / restore

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
    players: toWire(m.players),
    placed: toWire(m.placed),
    crate: toWire(m.crate),
    rules: { ...m.rules },
    result: toWire(m.result),
    prevScores: [...m.prevScores.entries()],
    winners: [...m.winners],
    nextUid: mp.nextUid,
    charRolls: mp.charRolls,
    pendingAdvance: mp.pendingAdvance ?? null,
    level: { tiles: bytesToB64(m.level.tiles), setPieces: m.level.setPieces.map((p) => p.uid), version: m.level.version },
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
        }
      : null,
  };
}

/**
 * Overwrite `m` in place with snapshot `s` (references held by the renderer,
 * audio and debug tools stay valid). Pending events are dropped.
 */
export function restoreMatch(m: Match, s: MatchSnap): void {
  if (s.v !== SNAP_VERSION) throw new Error(`snapshot v${s.v} != v${SNAP_VERSION}`);
  const mp = m as unknown as MatchPrivate;
  const theme = s.themeOverride ?? undefined;
  const prev = { run: m.run, round: m.round, phase: m.phase, level: m.level, placed: m.placed.map((p) => p.uid).join() };
  const base = pristineLevel(s.seed, theme);
  const tiles = b64ToBytes(s.level.tiles);
  const keep = new Set(s.level.setPieces);
  const cur = m.level;
  const same = cur.seed === s.seed && cur.theme.id === base.theme.id && cur.tiles.length === tiles.length && cur.tiles.every((t, i) => t === tiles[i]);
  if (!same || cur.setPieces.length !== keep.size || cur.setPieces.some((p) => !keep.has(p.uid))) {
    // Renderers cache terrain by (seed, version): bump past whatever is on screen when tiles change.
    const version = same ? s.level.version : Math.max(s.level.version, cur.version + 1);
    m.level = { ...base, tiles, setPieces: base.setPieces.filter((p) => keep.has(p.uid)), version };
  } else {
    m.level.version = s.level.version;
  }
  m.seed = s.seed;
  m.themeOverride = theme;
  m.phase = s.phase;
  m.phaseFrame = s.phaseFrame;
  m.frame = s.frame;
  m.round = s.round;
  m.players = fromWire<Player[]>(s.players);
  m.placed = fromWire<PlacedProp[]>(s.placed);
  m.crate = fromWire<CrateItem[]>(s.crate);
  m.rules = { ...s.rules };
  m.result = fromWire<RoundResult | null>(s.result);
  m.prevScores = new Map(s.prevScores);
  m.winners = [...s.winners];
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
  m.run = s.run ? restoreRun(sameRace ? prev.run! : new RunWorld(m.level, m.placed, s.run.slots, s.run.timeLimit), s.run) : null;
}

function restoreRun(run: RunWorld, s: RunSnap): RunWorld {
  run.frame = s.frame;
  run.runners = fromWire(s.runners);
  run.projectiles = fromWire(s.projectiles);
  run.finishOrder = [...s.finishOrder];
  run.kills = s.kills.map((k) => ({ ...k }));
  run.endFrame = s.endFrame;
  run.propState = fromWire(s.propState);
  (run as unknown as RunPrivate).events = [];
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
