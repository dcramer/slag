import { DT, PHYS, TILE } from '../constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID, tileAt } from '../level';
import { DEFAULT_SURFACE, firstOverlap, type Solid, type Surface } from '../physics';
import type { Runner, RunWorld } from '../run';
import { footing, underfoot } from '../weather';
import { bonk, cx, isActive, itemEvent, launch } from './common';
import type { ClimbLine, JoltWave, SlickPatch } from './types';

/**
 * Three items made for a shaft (docs/MODES.md → Rising Slag): on a climb the rivals that matter are above you or
 * below you, where a swing or a throw doesn't go.
 *
 * Slippery Slope: an oil can tipped over the edge. Every ledge (and wall) in a band of rows under the user's floor
 * goes slick for a few seconds: long skids off narrow ledges and no wall jumps up the chimney. The leader's way to
 * make the climb behind them harder; the user's own floor is spared, and a slip back down meets it too.
 *
 * Trickle-Down: a stamp that sends a shudder pouring down the shaft. Everyone it reaches standing on something (or
 * clinging to a wall) is shaken off it: through a board, or hopped off the nearer lip of a ledge, seeing stars, a few
 * rows down. Anyone in the air as it passes is untouched: you see it coming and jump.
 *
 * Social Climber: a gold grapple on a string of pearls, hooked on a ledge a few rows overhead and reeled up to it.
 * Nothing blocks it but rock between; a knock snaps it. The catch-up that only moves you.
 *
 * None of them kills: they trip and knock, and the slag does the rest.
 */
export const SLICK = {
  /** Rows of ledges under the user's floor that go slick, and for how long. */
  depth: 12,
  life: 5 * 60,
  cooldown: 20,
} as const;

/** What a slicked ledge feels like: slicker than ice, and a wall nobody can jump off. */
export const SLICK_SURFACE: Surface = { ...DEFAULT_SURFACE, friction: 0.07, speedMult: 1.1, wall: 'slick', skid: 80 };

export const JOLT = {
  /** Frames the stamp takes to come down (the tell), then how fast the shudder pours down (px/s) and how far (px). */
  delay: 10,
  speed: 540,
  depth: 14 * TILE,
  /** How thick the front is (px): someone whose feet it passes in the air is missed. */
  band: 1.5 * TILE,
  /** Off a ledge: the hop (px/s up), and the push across (px/s) to the nearer lip, about `air` s away. */
  hop: 200,
  air: 0.2,
  push: [140, 340],
  /** Off a wall: thrown out from it (px/s) and down. */
  wallVx: 130,
  wallVy: 80,
  cooldown: 30,
} as const;

export const GRAPPLE = {
  /** Rows up to the ledge it hooks (its floor's row over the climber's), and tiles across either way at most. */
  rows: [2, 12],
  across: 3,
  /** Reel speed (px/s), never quicker than `min` frames, and the hop over the lip at the top (px/s up). */
  speed: 560,
  min: 8,
  hop: 150,
  cooldown: 20,
} as const;

/** A loop's height (px), or 0. */
const loopPx = (level: Level) => (level.loop ?? 0) * TILE;

/** `d` round a loop to its nearest copy: two points a lap apart are the same place. */
function wrapped(level: Level, d: number): number {
  const p = loopPx(level);
  if (!p) return d;
  const m = ((d % p) + p) % p;
  return m > p / 2 ? m - p : m;
}

/** Someone an item can reach: racing, out of the spawn zone, not shut inside a part. */
const reachable = (w: RunWorld, r: Runner) => isActive(r) && !w.isSafe(r) && !r.attach.grip?.sealed;

/** The row a body's feet are in (the floor under a standing one is the row below). */
const feetRow = (r: Runner) => Math.floor((r.body.y + r.body.h - 0.01) / TILE);

// ---------------------------------------------------------------- Slippery Slope

/** Tip the can: every ledge in the SLICK.depth rows under the user's floor goes slick, wall to wall. */
export function spillSlick(w: RunWorld, r: Runner): void {
  const y0 = feetRow(r) + 2;
  w.items.slicks.push({
    id: w.items.nextId++,
    owner: r.slot,
    x0: 0,
    x1: w.level.w - 1,
    y0,
    y1: y0 + SLICK.depth - 1,
    born: w.frame,
    until: w.frame + SLICK.life,
  });
  r.items.cooldown = SLICK.cooldown;
  itemEvent(w, 'use', 'slick', r.slot, cx(r), r.body.y + r.body.h);
}

/** Is tile row `ty` (any lap's copy of it) inside patch `s`? */
function inRows(level: Level, s: SlickPatch, ty: number): boolean {
  const L = level.loop ?? 0;
  if (ty >= s.y0 && ty <= s.y1) return true;
  return L > 0 && ((ty + L >= s.y0 && ty + L <= s.y1) || (ty - L >= s.y0 && ty - L <= s.y1));
}

/** Is tile (tx, ty) slicked right now? */
export function slickAt(level: Level, slicks: readonly SlickPatch[], tx: number, ty: number): boolean {
  for (const s of slicks) if (tx >= s.x0 && tx <= s.x1 && inRows(level, s, ty)) return true;
  return false;
}

/** Each footing a world's slick wrapper stands in for: the level's own per-tile footing, or none. */
const BASES = new WeakMap<(tx: number, ty: number) => Surface, ((tx: number, ty: number) => Surface) | undefined>();

/**
 * Put this frame's spills on the footing (RunWorld's build, before anyone moves): terrain answers through the world's
 * `surfaceAt`, wrapped while a spill is down and given back after, and every solid whose top is in a spill takes it
 * too. Built from the run's own item state every frame, so a snapshot or a predicted copy carries nothing extra.
 */
export function applySlicks(w: RunWorld, solids: Solid[]): void {
  const world = w.world;
  const cur = world.surfaceAt;
  const base = cur && BASES.has(cur) ? BASES.get(cur) : cur;
  const slicks = w.items.slicks;
  if (!slicks.length) {
    if (cur !== base) world.surfaceAt = base;
    return;
  }
  const level = w.level;
  const f = footing(level);
  const slick = f ? underfoot(SLICK_SURFACE, f) : SLICK_SURFACE;
  const plain = world.tileSurface ?? DEFAULT_SURFACE;
  const wrap = (tx: number, ty: number) => (slickAt(level, slicks, tx, ty) ? slick : base ? base(tx, ty) : plain);
  BASES.set(wrap, base);
  world.surfaceAt = wrap;
  for (const s of solids) if (!s.film && slickAt(level, slicks, Math.floor((s.x + s.w / 2) / TILE), Math.floor(s.y / TILE))) s.surface = slick;
}

/** Spills dry up. */
function stepSlicks(w: RunWorld): void {
  const s = w.items.slicks;
  if (s.some((p) => w.frame >= p.until)) w.items.slicks = s.filter((p) => w.frame < p.until);
}

// ---------------------------------------------------------------- Trickle-Down

/** Stamp: the shudder starts down from the user's feet once the stamp lands. */
export function stampJolt(w: RunWorld, r: Runner): void {
  w.items.jolts.push({ id: w.items.nextId++, owner: r.slot, x: cx(r), from: r.body.y + r.body.h, down: 0, t: 0, hit: 0 });
  r.items.cooldown = JOLT.cooldown;
  itemEvent(w, 'use', 'jolt', r.slot, cx(r), r.body.y + r.body.h);
}

/** Px from the body's side `dir` to the end of the floor it stands on, along the row under its feet. */
function toLip(level: Level, r: Runner, dir: -1 | 1): number {
  const b = r.body;
  const row = feetRow(r) + 1;
  const floor = (x: number) => tileAt(level, x, row) !== T_EMPTY && tileAt(level, x, row - 1) !== T_SOLID;
  let x = Math.floor((dir > 0 ? b.x + b.w - 0.01 : b.x) / TILE);
  for (let n = 0; n < level.w && floor(x + dir); n++) x += dir;
  return dir > 0 ? (x + 1) * TILE - (b.x + b.w) : b.x - x * TILE;
}

/** Only boards under its feet: down through them is the way off. */
function onBoards(level: Level, r: Runner): boolean {
  const b = r.body;
  const row = feetRow(r) + 1;
  let board = false;
  for (let x = Math.floor(b.x / TILE); x <= Math.floor((b.x + b.w - 0.01) / TILE); x++) {
    const t = tileAt(level, x, row);
    if (t === T_SOLID) return false;
    if (t === T_ONEWAY) board = true;
  }
  return board;
}

/** Shake `r` off what it stands or clings on, a few rows down, seeing stars. */
function shakeOff(w: RunWorld, r: Runner, by: number): void {
  const b = r.body;
  if (!b.onGround) launch(b, -b.wallDir * JOLT.wallVx, JOLT.wallVy);
  else if (onBoards(w.level, r)) {
    launch(b, 0, 60);
    b.dropFrames = PHYS.dropFrames;
  } else {
    const l = toLip(w.level, r, -1);
    const rt = toLip(w.level, r, 1);
    const side = l < rt ? -1 : rt < l ? 1 : b.facing;
    const d = Math.min(l, rt) + b.w + 2;
    launch(b, side * Math.max(JOLT.push[0], Math.min(JOLT.push[1], d / JOLT.air)), -JOLT.hop);
  }
  bonk(w, r, by);
  itemEvent(w, 'hit', 'jolt', by, cx(r), b.y + b.h);
}

/** One shudder, one frame. False once it has poured its depth. Everyone it meets this frame is judged before any moves. */
function stepJolt(w: RunWorld, j: JoltWave): boolean {
  if (++j.t <= JOLT.delay) return true;
  if (j.t === JOLT.delay + 1) itemEvent(w, 'warn', 'jolt', j.owner, j.x, j.from);
  j.down = Math.min(JOLT.depth, j.down + JOLT.speed * DT);
  const met: number[] = [];
  w.runners.forEach((r, i) => {
    if (r.slot === j.owner || j.hit & (1 << i) || !reachable(w, r)) return;
    const d = wrapped(w.level, r.body.y + r.body.h - j.from);
    if (d <= TILE / 2 || d > j.down || d < j.down - JOLT.band) return;
    // In the air as it passes: missed.
    if (!r.body.onGround && r.body.wallDir === 0) return;
    if (r.attach.grip) return;
    met.push(i);
  });
  for (const i of met) {
    j.hit |= 1 << i;
    shakeOff(w, w.runners[i], j.owner);
  }
  return j.down < JOLT.depth;
}

function stepJolts(w: RunWorld): void {
  if (w.items.jolts.length) w.items.jolts = w.items.jolts.filter((j) => stepJolt(w, j));
}

// ---------------------------------------------------------------- Social Climber

/** A tile lookup: `tileAt`'s, or a brain's from its view. */
export type TileLookup = (tx: number, ty: number) => number;
/** Whether a box (px) is in something solid that isn't terrain (a shut gate, a box, a part): the sim's, which a brain can't see. */
export type Blocked = (x: number, y: number, w: number, h: number) => boolean;

/** Where a body of `bw`×`bh` with its feet's middle at (fx, fy) px stands on cell (tx, ty): its top-left. */
const standAt = (tx: number, ty: number, bw: number, bh: number) => ({ x: tx * TILE + (TILE - bw) / 2, y: (ty + 1) * TILE - bh });

/** No rock in any cell the box (x, y, bw, bh) overlaps (boards don't count), and nothing `blocked` says is in the way. */
function clearBox(at: TileLookup, x: number, y: number, bw: number, bh: number, blocked?: Blocked): boolean {
  for (let ty = Math.floor(y / TILE); ty <= Math.floor((y + bh - 0.01) / TILE); ty++)
    for (let tx = Math.floor(x / TILE); tx <= Math.floor((x + bw - 0.01) / TILE); tx++) if (at(tx, ty) === T_SOLID) return false;
  return !blocked?.(x, y, bw, bh);
}

/** No rock along the straight sweep of the box from (ax, ay) to (bx, by), sampled every few px. */
function clearSweep(at: TileLookup, ax: number, ay: number, bx: number, by: number, bw: number, bh: number, blocked?: Blocked): boolean {
  const n = Math.max(1, Math.ceil((Math.abs(bx - ax) + Math.abs(by - ay)) / 4));
  for (let i = 1; i <= n; i++) if (!clearBox(at, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, bw, bh, blocked)) return false;
  return true;
}

/** Where a climb goes: the stand cell, and whether the line goes straight up first and then over the lip (or over, then up). */
export interface ClimbTarget {
  tx: number;
  ty: number;
  up: boolean;
}

/**
 * The ledge a Social Climber hooks for a body of `bw`×`bh` whose feet's middle is at (fx, fy) px facing `facing`: the
 * highest stand cell GRAPPLE.rows up and GRAPPLE.across either way, its own column first then the way it faces, that
 * the body can be reeled to with no rock in the way (boards it passes through): straight up beside the ledge and then
 * over onto it, or across and then straight up through it, nor anything `blocked` says is solid. Null if there's none. Shared by the sim and the bots'
 * tactic, which reads its view's tiles through the same lookup.
 */
export function climbTarget(at: TileLookup, fx: number, fy: number, bw: number, bh: number, facing: number, blocked?: Blocked): ClimbTarget | null {
  const col = Math.floor(fx / TILE);
  const row = Math.floor((fy - 0.01) / TILE);
  const sx = fx - bw / 2;
  const sy = fy - bh;
  const f = facing < 0 ? -1 : 1;
  const dxs = [0];
  for (let d = 1; d <= GRAPPLE.across; d++) dxs.push(d * f, -d * f);
  for (let k = GRAPPLE.rows[1]; k >= GRAPPLE.rows[0]; k--)
    for (const dx of dxs) {
      const tx = col + dx;
      const ty = row - k;
      const floor = at(tx, ty + 1);
      if (at(tx, ty) !== T_EMPTY || (floor !== T_SOLID && floor !== T_ONEWAY)) continue;
      const e = standAt(tx, ty, bw, bh);
      if (clearSweep(at, sx, sy, sx, e.y, bw, bh, blocked) && clearSweep(at, sx, e.y, e.x, e.y, bw, bh, blocked)) return { tx, ty, up: true };
      if (clearSweep(at, sx, sy, e.x, sy, bw, bh, blocked) && clearSweep(at, e.x, sy, e.x, e.y, bw, bh, blocked)) return { tx, ty, up: false };
    }
  return null;
}

/** The level's tiles, round a loop the next lap's over the top. */
const lookup =
  (level: Level): TileLookup =>
  (tx, ty) =>
    tileAt(level, tx, level.loop && ty < 0 ? ty + level.loop : ty);

/** Hook a ledge overhead and start reeling up to it. False (nothing spent) if there's none in reach. */
export function throwGrapple(w: RunWorld, r: Runner): boolean {
  const b = r.body;
  const solid: Blocked = (x, y, bw, bh) => firstOverlap({ x, y, w: bw, h: bh }, w.world, true) !== null;
  const t = climbTarget(lookup(w.level), cx(r), b.y + b.h, b.w, b.h, b.facing, solid);
  if (!t) return false;
  const e = standAt(t.tx, t.ty, b.w, b.h);
  const frames = Math.max(GRAPPLE.min, Math.ceil(((Math.abs(e.x - b.x) + Math.abs(e.y - b.y)) / GRAPPLE.speed) * 60));
  w.items.climbs.push({ id: w.items.nextId++, owner: w.runners.indexOf(r), sx: b.x, sy: b.y, ex: e.x, ey: e.y, up: t.up, lap: r.lap, t: 0, frames });
  r.items.reel = frames;
  r.items.cooldown = GRAPPLE.cooldown;
  itemEvent(w, 'use', 'grapple', r.slot, cx(r), b.y);
  return true;
}

/** Where a line has its climber `t` frames in: eased in and out along its two legs, up then over or over then up. */
function along(c: ClimbLine, t: number): { x: number; y: number } {
  const u = Math.min(1, t / c.frames);
  const ax = Math.abs(c.ex - c.sx);
  const ay = Math.abs(c.ey - c.sy);
  const d = u * u * (3 - 2 * u) * (ax + ay);
  const first = c.up ? ay : ax;
  if (d <= first) {
    const k = first ? d / first : 1;
    return c.up ? { x: c.sx, y: c.sy + (c.ey - c.sy) * k } : { x: c.sx + (c.ex - c.sx) * k, y: c.sy };
  }
  const second = c.up ? ax : ay;
  const k = second ? (d - first) / second : 1;
  return c.up ? { x: c.sx + (c.ex - c.sx) * k, y: c.ey } : { x: c.ex, y: c.sy + (c.ey - c.sy) * k };
}

/** One line, one frame. False once its climber is up, or it snapped (a knock, a part in the way, a hold, a swap). */
function stepClimb(w: RunWorld, c: ClimbLine): boolean {
  const r = w.runners[c.owner];
  const b = r.body;
  const snap = () => {
    r.items.reel = 0;
    itemEvent(w, 'fizzle', 'grapple', -1, cx(r), b.y);
    return false;
  };
  if (!isActive(r) || r.items.daze > 0 || r.attach.grip || r.items.reel <= 0) return snap();
  // Round a loop the climber may have gone a lap since it caught: so has the line.
  if (r.lap !== c.lap) {
    const shift = (r.lap - c.lap) * loopPx(w.level);
    c.sy += shift;
    c.ey += shift;
    c.lap = r.lap;
  }
  const was = along(c, c.t);
  // Moved off its line by something else (a swap, a shove): it let go.
  if (Math.abs(b.x - was.x) > TILE || Math.abs(b.y - was.y) > TILE) return snap();
  c.t++;
  const p = along(c, c.t);
  if (firstOverlap({ x: p.x, y: p.y, w: b.w, h: b.h }, w.world, true)) {
    b.x = was.x;
    b.y = was.y;
    return snap();
  }
  b.x = p.x;
  b.y = p.y;
  launch(b, 0, 0);
  r.items.reel = Math.max(0, c.frames - c.t);
  if (c.t < c.frames) return true;
  // Up: a hop over the lip, and it lands on the ledge.
  launch(b, 0, -GRAPPLE.hop);
  itemEvent(w, 'hit', 'grapple', r.slot, cx(r), b.y + b.h);
  return false;
}

function stepClimbs(w: RunWorld): void {
  if (w.items.climbs.length) w.items.climbs = w.items.climbs.filter((c) => stepClimb(w, c));
}

/** The three, one frame each. */
export function stepClimbItems(w: RunWorld): void {
  stepSlicks(w);
  stepJolts(w);
  stepClimbs(w);
}
