import { BotSeats } from '../../src/brain/bots';
import { deriveSeed, Rng } from '../../src/core/rng';
import { giveItem } from '../../src/sim/items';
import { type Personality, steady as steadyHands } from '../../src/brain/personality';
import { type BotLevel, Match, type Phase } from '../../src/game/match';
import type { ProfileOverride } from '../../src/gen/level';
import { isBridgePart } from '../../src/gen/props';
import type { Difficulty } from '../../src/sim/level';
import type { PlacedProp } from '../../src/sim/props';
import { RUN_COUNTDOWN, TILE } from '../../src/sim/constants';
import { feetUp, type RunWorld as Run } from '../../src/sim/run';
import { leaderOf } from '../../src/sim/standing';
import type { ModeId } from '../../src/game/modes';
import { MODES } from '../../src/game/modes';
import { DEFAULT_RULES, withMode } from '../../src/game/rules';
import type { ThemeId } from '../../src/themes';
import { deadlyCells } from './arena-safety';

export interface BotRace {
  finished: boolean;
  /** Race frames it took (or ran for). */
  frames: number;
  cause: string | null;
  /** The longest stretch (frames) it stood still on the ground pressing nothing. */
  pause: number;
  /** Rows above the spawn's floor its feet got to: how far it climbed (Rising Slag's measure). */
  climbed: number;
  /** Race frame it first stood `SPLIT_ROWS`, twice that, … rows up: its pace up a tower. */
  splits: number[];
  /** Rising Slag: the slag caught it (rather than a hazard, a fall or the clock). */
  slagged: boolean;
}

/** Rows between a climb's splits (`BotRace.splits`). */
export const SPLIT_ROWS = 20;

export interface BotRaceOptions {
  theme?: ThemeId;
  /** Force the level's size class (a theme that never rolls it keeps its own). */
  size?: ProfileOverride['size'];
  limit?: number;
  /** Build the plan's bridges before the race (the default); ignored with `parts`. */
  build?: boolean;
  level?: BotLevel;
  /** This many bots of the same level pick and place a round's parts first, and the racer runs over whatever they left. */
  parts?: number;
  /** Force the level's difficulty (gen/level/difficulty.ts). */
  difficulty?: Difficulty;
  /** Bots with no lapses (no fumbles, pauses or wrong turns): measures the motor, not a player. */
  steady?: boolean;
  /** Adjusts every bot's rolled personality (after `steady`). */
  hands?: (p: Personality) => Personality;
  /** The match's mode (game/modes.ts): `slag` races a Rising Slag tower, the slag on. */
  mode?: ModeId;
}

function botMatch(
  seed: number,
  theme: ThemeId | undefined,
  size: ProfileOverride['size'] | undefined,
  players: number,
  level: BotLevel | undefined,
  difficulty?: Difficulty,
  hands: (p: Personality) => Personality = (p) => p,
  mode: ModeId = 'race',
) {
  const m = new Match(seed, theme, { ...DEFAULT_RULES, mode });
  if (size || difficulty) {
    m.forceProfile = { ...(size ? { size } : {}), ...(difficulty ? { difficulty } : {}) };
    m.newLevel(seed, theme);
  }
  const bots = new BotSeats(hands);
  for (let i = 0; i < players; i++) {
    const p = m.join(bots.add(m))!;
    if (level && level !== 'normal') p.bot = level;
  }
  return { m, bots };
}

/** Was the slag at `r`'s feet when it died? (A lone bot's race ends with it, so the slag is still there.) */
function slagAt(slag: number | null, level: Match['level'], r: Parameters<typeof feetUp>[1]): boolean {
  return slag !== null && slag < feetUp(level, r) + 2;
}

/**
 * One bot alone on `seed`'s level with the plan's bridges already built
 * (unless `build` is false), or over the parts `parts` bots placed in a
 * round of their own, raced to the end: does it find its way to the flag?
 * Shared by tests/brain.test.ts and the finish-rate suites in tests/stats/.
 */
export function botRace(
  seed: number,
  { theme, size, limit = 60 * 60, build = true, level, parts = 0, difficulty, steady = false, hands = (p) => p, mode = 'race' }: BotRaceOptions = {},
): BotRace {
  const tune = steady ? (p: Personality) => hands(steadyHands(p)) : hands;
  let placed: PlacedProp[] | null = null;
  if (parts > 0) {
    const { m, bots } = botMatch(seed, theme, size, parts, level, difficulty, tune, mode);
    m.rules = { ...m.rules, pickSeconds: 0, placeSeconds: 0 };
    m.startMatch();
    for (let f = 0; f < 60 * 60 && m.phase !== 'run'; f++) m.step(bots.frames(m));
    placed = m.placed;
  }
  const { m, bots } = botMatch(seed, theme, size, 1, level, difficulty, tune, mode);
  m.startMatch();
  if (placed) m.placed = placed.map((pp) => ({ ...pp }));
  else if (build) {
    const bridge = m.crate.find((c) => isBridgePart(c.def))?.def;
    if (m.plan.length && !bridge) throw new Error(`seed ${seed}: the crate has no bridge for its plan`);
    for (const b of m.plan) m.placed.push({ uid: 1000 + m.placed.length, def: bridge!, owner: 0, tx: b.x, ty: b.y, rot: 0 });
  }
  m.startRun();
  const run = m.run!;
  const r = run.runners[0];
  let pause = 0;
  let still = 0;
  const floor = (m.level.spawn.ty + 1) * TILE;
  let top = floor;
  const splits: number[] = [];
  while (m.phase === 'run' && r.alive && !r.finished && run.frame < limit) {
    if (r.body.onGround) {
      top = Math.min(top, feetUp(m.level, r));
      while ((floor - top) / TILE >= (splits.length + 1) * SPLIT_ROWS) splits.push(run.frame);
    }
    const frames = bots.frames(m);
    const idle = Object.values(frames).every((f) => !f.left && !f.right && !f.jump && !f.down && !f.up);
    still = idle && r.body.onGround && Math.abs(r.body.vx) < 0.5 && run.frame > RUN_COUNTDOWN ? still + 1 : 0;
    pause = Math.max(pause, still);
    m.step(frames);
  }
  return {
    finished: r.finished,
    frames: run.frame,
    cause: r.cause,
    pause,
    climbed: Math.round((floor - top) / TILE),
    splits,
    slagged: !r.alive && slagAt(run.slag, m.level, r),
  };
}

export interface BotRound {
  /** Slot highest up `at` frames after GO (laps and all), or -1 if the round was over by then. */
  leader: number;
  /** Slot that outlasted everyone, or -1 when the last ones went on the same frame (or the clock ran out first). */
  winner: number;
  /** Items used by kind, as the race tells it (`item` events). */
  uses: Record<string, number>;
  /** Items picked up. */
  pickups: number;
  /** Items boxes popped. */
  pops: number;
  /** Race frames from GO to the end. */
  frames: number;
  /** Times the lead changed hands after GO: someone else on top for a second straight. */
  leads: number;
  /** Runners bumped from below (sim/collide.ts `BUMP`). */
  bumps: number;
  /**
   * How the runners who went out went out (`DeathCause`, or `slag` where the slag took them), with `+` where a rival's
   * knock put them there (the bonk's credit still running: sim/items/common.ts `BONK_CREDIT`).
   */
  causes: Record<string, number>;
  /** Runners out within `at` frames of GO. */
  early: number;
  /** How the round looked as a fight (`Fight`). */
  fight: Fight;
}

/**
 * How hard a round was fought, from the bodies alone (Brawl's aggression measure, tests/stats/brawl.test.ts): when
 * two runners first touched or one bonked another, how many bonks landed, and over every frame someone was in it
 * after GO with a rival left (dazed frames aside), the share they stood still, the share they moved away from their
 * nearest rival, and how far off that rival was.
 */
export interface Fight {
  /** Frames from GO to the first touch or bonk, or -1 with none. */
  contact: number;
  /** Frames from GO to the first bonk a rival landed, or -1 with none. */
  hit: number;
  /** Bonks a rival landed. */
  bonks: number;
  /** Runner-frames counted, and of them standing still on the ground (not up against a rival), and moving away from the nearest rival. */
  frames: number;
  still: number;
  retreat: number;
  /** Sum over those frames of the tiles to the nearest rival. */
  gap: number;
  /** Deaths with no knock credited that came within `SHOVED` frames of touching a rival: shoved in, or tangled with one. */
  shoved: number;
  /** Of the counted frames, those standing on the ground, and of them those with no way to die near (`arenaSafety`): Brawl only. */
  grounded: number;
  safe: number;
  /** Race frame each slot last touched a rival. */
  touched: number[];
  /**
   * Still frames in a row: each slot's current run of them, the longest any slot stood, and how many runs reached
   * `PAUSE` frames. A person sees a pause as a stretch of standing, not as a share.
   */
  streak: number[];
  longest: number;
  pauses: number;
}

/** Still frames in a row that read as a pause (`Fight.pauses`): half a second. */
export const PAUSE = 30;

/** Frames after touching a rival a death counts as `Fight.shoved`. */
const SHOVED = 30;

/** Px/s across that counts as moving away. */
const RETREAT_VX = 30;

function watchFight(run: Run, f: Fight, credit: number[], apart: Set<number>, deadly: Set<number> | null): void {
  const live = run.runners.filter((r) => r.alive && !r.finished);
  const t = run.frame - RUN_COUNTDOWN;
  for (const r of live) {
    const b = r.body;
    if (r.items.bonkCredit > (credit[r.slot] ?? 0) && r.items.bonkedBy !== r.slot && r.items.bonkedBy >= 0) {
      f.bonks++;
      if (f.contact < 0) f.contact = t;
      if (f.hit < 0) f.hit = t;
    }
    if (r.items.daze > 0 || live.length < 2) {
      f.streak[r.slot] = 0;
      continue;
    }
    let near: (typeof live)[number] | null = null;
    let d = Infinity;
    let touching = false;
    for (const q of live) {
      if (q === r) continue;
      const dx = q.body.x - b.x;
      const dy = q.body.y - b.y;
      const pair = Math.min(r.slot, q.slot) * 64 + Math.max(r.slot, q.slot);
      if (Math.abs(dx) <= b.w + 1 && Math.abs(dy) < b.h) {
        touching = true;
        f.touched[r.slot] = run.frame;
        // Two who start side by side touch at GO: only a touch after they've been apart is contact.
        if (f.contact < 0 && apart.has(pair)) f.contact = t;
      } else if (Math.hypot(dx, dy) > 2 * TILE) apart.add(pair);
      const e = Math.hypot(dx, dy) / TILE;
      if (e < d) {
        d = e;
        near = q;
      }
    }
    f.frames++;
    f.gap += d;
    if (b.onGround && Math.abs(b.vx) < 1 && !touching) {
      f.still++;
      const n = (f.streak[r.slot] = (f.streak[r.slot] ?? 0) + 1);
      f.longest = Math.max(f.longest, n);
      if (n === PAUSE) f.pauses++;
    } else f.streak[r.slot] = 0;
    if (deadly && b.onGround) {
      f.grounded++;
      if (!deadly.has(Math.floor((b.y + b.h - 1) / TILE) * run.level.w + Math.floor((b.x + b.w / 2) / TILE))) f.safe++;
    }
    if (near && Math.abs(b.vx) > RETREAT_VX && Math.sign(b.vx) !== Math.sign(near.body.x - b.x) && Math.abs(near.body.x - b.x) > TILE) f.retreat++;
  }
  for (const r of run.runners) credit[r.slot] = r.items.bonkCredit;
}

/** How `botRound` and `botRounds` play and measure a round. */
export interface BotRoundOptions {
  players?: number;
  level?: BotLevel;
  at?: number;
  limit?: number;
  hands?: (p: Personality) => Personality;
  /** Every `deal` frames from GO, every empty hand gets what a loop's box deals its rank (the mode's `boxes`): items reaching everyone, as boxes on the way would. */
  deal?: number;
  mode?: ModeId;
}

/**
 * `players` bots of `level` playing one round of `mode` (Rising Slag by default) on `seed`'s bare level (no parts
 * placed), to its end: who led `at` frames after GO (highest up, laps and all), and who outlasted everyone. Catch-up's
 * measure (tests/stats/slag-catch-up.test.ts).
 */
export function botRound(seed: number, opts: BotRoundOptions = {}): BotRound {
  const { players = 4, level = 'normal', hands = (p) => p, mode = 'slag' } = opts;
  const { m, bots } = botMatch(seed, undefined, undefined, players, level, undefined, hands, mode);
  m.startMatch();
  m.startRun();
  return playRound(seed, m, bots, opts);
}

/**
 * `players` bots of `level` playing the first `rounds` rounds of a `mode` match (Brawl by default) on `seed`'s level,
 * picking and placing their parts as a match does (bots take a few seconds; the timers catch one that finds no spot), each round measured as
 * `botRound` measures one: how a level gets nastier as its parts pile up.
 */
export function botRounds(seed: number, rounds: number, opts: BotRoundOptions = {}): BotRound[] {
  const { players = 4, level = 'normal', hands = (p) => p, mode = 'brawl' } = opts;
  const { m, bots } = botMatch(seed, undefined, undefined, players, level, undefined, hands, mode);
  m.rules = { ...m.rules, targetScore: 1e6, maxRounds: rounds };
  m.startMatch();
  const out: BotRound[] = [];
  while (out.length < rounds) {
    for (let f = 0; f < 120 * 60 && m.phase !== 'run'; f++) m.step(bots.frames(m));
    if (m.phase !== 'run') break;
    out.push(playRound(seed, m, bots, opts));
    // The race's tail and the scoreboard, into the next round's pick.
    for (let f = 0; f < 60 * 60 && m.phase === 'run'; f++) m.step(bots.frames(m));
  }
  return out;
}

/** `m`'s race played from where it stands to its end (or `limit`), measured. */
function playRound(seed: number, m: Match, bots: BotSeats, { at = 15 * 60, limit = 4 * 60 * 60, deal = 0 }: BotRoundOptions): BotRound {
  const run = m.run!;
  let leader = -1;
  const uses: Record<string, number> = {};
  let pickups = 0;
  let pops = 0;
  let bumps = 0;
  /** Whoever leads (sim/standing.ts), by slot; -1 if nobody's racing. */
  const top = () => {
    const i = leaderOf(run);
    return i < 0 ? -1 : run.runners[i].slot;
  };
  const dealer = new Rng(deriveSeed(seed, 'deal'));
  const CATCH_UP = MODES.slag.profile.boxes!;
  // Who leads, changing hands only when someone has been on top for a second straight, so climbers hopping past each
  // other on one flight don't count as overtakes.
  let ahead = -1;
  let leads = 0;
  let next = -1;
  let since = 0;
  const causes: Record<string, number> = {};
  const fight: Fight = { contact: -1, hit: -1, bonks: 0, frames: 0, still: 0, retreat: 0, gap: 0, shoved: 0, grounded: 0, safe: 0, touched: [], streak: [], longest: 0, pauses: 0 };
  // Where a brawl's field stands safe, with the parts placed so far: what hurts and the drops into the pit.
  const deadly = m.rules.mode === 'brawl' ? deadlyCells({ ...m.level, setPieces: [...m.level.setPieces, ...m.placed] }).deadly : null;
  const credit: number[] = [];
  const apart = new Set<number>();
  while (run.endFrame < 0 && run.frame < limit) {
    if (run.frame === RUN_COUNTDOWN + at) leader = top();
    if (run.frame > RUN_COUNTDOWN) {
      const now = top();
      if (now !== next) {
        next = now;
        since = run.frame;
      }
      if (now >= 0 && now !== ahead && run.frame - since >= 60) {
        if (ahead >= 0) leads++;
        ahead = now;
      }
    }
    if (deal > 0 && run.frame > RUN_COUNTDOWN && (run.frame - RUN_COUNTDOWN) % deal === 0) {
      const lead = top();
      for (const r of run.runners) if (r.alive && !r.finished && !r.items.held) giveItem(r, dealer.pick(r.slot === lead ? CATCH_UP.lead : CATCH_UP.chase));
    }
    const was = run.runners.map((r) => r.alive);
    m.step(bots.frames(m));
    for (const e of m.drainEvents())
      if (e.type === 'item' && e.what === 'use') uses[e.kind] = (uses[e.kind] ?? 0) + 1;
      else if (e.type === 'item' && e.what === 'pickup') pickups++;
      else if (e.type === 'item' && e.what === 'pop') pops++;
      else if (e.type === 'item' && e.what === 'hit' && e.kind === 'bump') bumps++;
    run.runners.forEach((r, i) => {
      if (!was[i] || r.alive) return;
      const k = `${slagAt(run.slag, m.level, r) ? 'slag' : r.cause}${r.items.bonkCredit > 0 && r.items.bonkedBy !== r.slot ? '+' : ''}`;
      causes[k] = (causes[k] ?? 0) + 1;
      if (!k.endsWith('+') && run.frame - (fight.touched[r.slot] ?? -Infinity) <= SHOVED) fight.shoved++;
    });
    if (run.frame > RUN_COUNTDOWN) watchFight(run, fight, credit, apart, deadly);
  }
  const alive = run.runners.filter((r) => r.alive && !r.finished);
  let winner = alive.length === 1 ? alive[0].slot : -1;
  if (!alive.length) {
    const last = Math.max(...run.runners.map((r) => r.deathFrame));
    const at = run.runners.filter((r) => r.deathFrame === last);
    if (at.length === 1) winner = at[0].slot;
  }
  return {
    leader,
    winner,
    uses,
    pickups,
    pops,
    frames: run.frame - RUN_COUNTDOWN,
    leads,
    bumps,
    causes,
    early: run.runners.filter((r) => !r.alive && r.deathFrame < RUN_COUNTDOWN + at).length,
    fight,
  };
}

/** Where a whole bot match's time went (`botMatchTime`). */
export interface BotMatchTime {
  /** Frames spent in each phase, lobby aside. */
  frames: Partial<Record<Phase, number>>;
  /** Rounds played (every bout is one) and placements (pick and place) made. */
  rounds: number;
  placements: number;
  /** It reached victory within the cap. */
  ended: boolean;
}

/**
 * `players` bots of `level` playing one whole `mode` match on `seed`'s level with the lobby's rules for it (`withMode`,
 * then `bouts` if given), from the first pick to victory: the frames each phase took. What bouts per placement buy.
 */
export function botMatchTime(
  seed: number,
  { players = 4, level = 'normal', mode = 'brawl', bouts }: { players?: number; level?: BotLevel; mode?: ModeId; bouts?: number } = {},
): BotMatchTime {
  const { m, bots } = botMatch(seed, undefined, undefined, players, level, undefined, undefined, mode);
  m.rules = { ...withMode(m.rules, mode), ...(bouts ? { bouts } : {}) };
  m.startMatch();
  const frames: Partial<Record<Phase, number>> = {};
  let placements = 0;
  for (let f = 0; f < 4 * 60 * 60 * 60 && m.phase !== 'victory'; f++) {
    if (m.phase === 'pick' && m.phaseFrame === 1) placements++; // a frame in: startMatch's pick starts on frame 0, the rest a step before we look
    frames[m.phase] = (frames[m.phase] ?? 0) + 1;
    m.step(bots.frames(m));
    m.drainEvents();
  }
  return { frames, rounds: m.round, placements, ended: m.phase === 'victory' };
}
