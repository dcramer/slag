import { dhypot, dsin } from '../../core/dmath';
import { overlaps, pointInRect, rectCircle } from '../../core/geom';
import { DT, TILE } from '../constants';
import { isProtected, type Level, T_EMPTY, T_ONEWAY, T_SOLID, tileAt } from '../level';
import { type Body, DEFAULT_SURFACE, type Solid, type Surface } from '../physics';
import type { GameEvent } from '../types';
import type { ItemKind, ItemSpawn } from '../items/types';
import { COAT_PX, COAT_SURFACES } from './modules/coat';
import type { Contrib, ProjectileSpawn } from './registry';
import { FREEZE_FRAMES, type RunnerStatus, SLOW_FRAMES } from './status';
import { AMMO, type Ammo, type HitEffect } from './types';

/**
 * Projectile behaviors. Every projectile is plain data (snapshot friendly);
 * per-ammo behavior plugs in through AMMO_SIM, keyed by ammo, the same way
 * prop modules plug into the module registry. Classic ammo (bolts, arrows,
 * cannonballs, fireballs, plasma, shuriken) uses the default mover, which is
 * the original RunWorld code unchanged.
 *
 * Determinism: the new behaviors use only + − × ÷ and Math.sqrt (correctly
 * rounded everywhere). Homing turns by a fixed angle with precomputed
 * cos/sin constants instead of calling trig. The default mover's wobble
 * uses core/dmath.ts.
 */

export interface Projectile extends ProjectileSpawn {
  born: number;
  /** Spawn sequence number in this race (stable id for patch solids). */
  id: number;
  /** Bounces left (rubber, ricochet), or riders on board (glider). */
  n: number;
  /** Constant acceleration (px/s², boomerang return pull). */
  ax: number;
  ay: number;
  /** Cruise speed (px/s, seeker). */
  sp: number;
  /** Surface patch: face (0 right, 1 down, 2 left, 3 up) of host cell (hx, hy) it stuck to, or -1 while flying. */
  stuck: number;
  hx: number;
  hy: number;
  /** Frame a stuck patch melts away. */
  until: number;
  /** Displacement (px) of the last move: platform projectiles (gliders) report it as their solid's dx/dy. */
  mx: number;
  my: number;
  /** Runner index that threw it, or -1 for prop shots. */
  thrower: number;
  /** Prop that fired it, or -1. */
  source: number;
}

/** What a projectile sees of a runner. `safe`: in the spawn zone, so shots pop harmlessly. */
export interface ProjRunner {
  body: Body;
  status: RunnerStatus;
  active: boolean;
  safe: boolean;
  /** `groundRef` under the stack it stands in (sim/collide.ts), when that isn't just its own. */
  ground?: number;
}

export interface ProjWorld {
  level: Level;
  frame: number;
  solids: readonly Solid[];
  /** Multiplier on every ammo's gravity (the level's gravity setting). */
  gravity: number;
  /** Side wind of this frame's gust (px/s, + right): whatever's flying moves with the air. */
  gust?: number;
  /** Index matches RunWorld.runners. */
  runners: readonly ProjRunner[];
  spawn(p: ProjectileSpawn): void;
  emit(e: GameEvent): void;
  /** A lethal projectile hit runner `i`. */
  kill(i: number, owner: number): void;
  /** Held-item side of a shot (src/sim/items). Optional so headless callers can omit it. */
  items?: ProjItems;
  /** A shot struck terrain or a solid at (x, y), for parts a hit sets off (Fuse Crates). Optional so headless callers can omit it. */
  hit?(x: number, y: number): void;
}

export interface ProjItems {
  /** Runner `i` caught a shot back: it returns to their hand. */
  caught(i: number, kind: ItemKind): void;
  /** Add a loose item. */
  loose(s: ItemSpawn): void;
  /** Stars and kill credit for bonking runner `i`. */
  bonk(i: number, owner: number): void;
  /** A smoke bomb burst here. */
  burst(x: number, y: number): void;
}

export type EndReason = 'wall' | 'runner' | 'life' | 'fuse';

export interface AmmoSim {
  /** Initialize behavior state at spawn. */
  init?(p: Projectile): void;
  /** Move one frame (replaces the default mover). Return false to end the shot here (fuse). */
  move?(p: Projectile, w: ProjWorld): boolean;
  /** Hit terrain or a solid (already moved to x, y; px/py is where it came from). Return true to keep it (bounce, stick). */
  wall?(p: Projectile, w: ProjWorld, px: number, py: number): boolean;
  /**
   * A rideable platform rather than a bullet: built as a moving solid each
   * frame (see buildProjectile), never hits runners, and handles terrain itself in `move`.
   */
  platform?: boolean;
  /** Return true to end the shot this frame (cluster shells splitting). */
  fuse?(p: Projectile, f: number): boolean;
  /** The shot ended (not when it simply leaves the world). */
  end?(p: Projectile, w: ProjWorld, why: EndReason): void;
  /** Its thrower touched it after THROW_GRACE. Return true if they caught it, which ends it quietly. */
  caught?(p: Projectile, w: ProjWorld, i: number): boolean;
}

/** Frames a thrown shot ignores its thrower, so it can leave their hand. */
export const THROW_GRACE = 12;

const DEFAULT_LIFE = 60 * 8;

/** Face directions (0 right, 1 down, 2 left, 3 up). */
export const FACE: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Is (x, y) inside terrain or a solid? For a shot's first frames it passes the prop that fired it, or, from a hand (`source` -1), every solid. */
export function solidAt(w: ProjWorld, x: number, y: number, age: number, source = -1): boolean {
  if (tileAt(w.level, Math.floor(x / TILE), Math.floor(y / TILE)) === T_SOLID) return true;
  return w.solids.some((s) => !s.film && pointInRect(x, y, s) && (age > 2 || (source >= 0 && s.propUid !== source)));
}

/** Which axis of the last move ran into something: 'x' (a wall), 'y' (floor/ceiling) or both (a corner). */
function hitAxis(w: ProjWorld, p: Projectile, px: number, py: number, age: number): 'x' | 'y' | 'xy' {
  const viaX = solidAt(w, p.x, py, age, p.source);
  const viaY = solidAt(w, px, p.y, age, p.source);
  if (viaY && !viaX) return 'y';
  if (viaX && !viaY) return 'x';
  return 'xy';
}

/** Reflect off whatever was hit; returns false once out of bounces. */
function bounce(p: Projectile, w: ProjWorld, px: number, py: number, e: number): boolean {
  if (p.n <= 0) return false;
  p.n--;
  const ax = hitAxis(w, p, px, py, w.frame - p.born);
  if (ax !== 'x') p.vy = -p.vy * e;
  if (ax !== 'y') p.vx = -p.vx * e;
  p.x = px;
  p.y = py;
  w.emit({ type: 'prop', kind: 'bounce', x: p.x, y: p.y });
  return true;
}

/** Turn (vx, vy) toward (tx, ty) by at most the angle whose cos/sin are (C, S); keeps speed `sp`. */
export function steer(p: { vx: number; vy: number }, tx: number, ty: number, C: number, S: number, sp: number): void {
  const tl = Math.sqrt(tx * tx + ty * ty);
  const vl = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  if (tl < 1e-6 || vl < 1e-6) return;
  const dot = (p.vx * tx + p.vy * ty) / (vl * tl);
  if (dot >= C) {
    p.vx = (tx / tl) * sp;
    p.vy = (ty / tl) * sp;
    return;
  }
  const cross = p.vx * ty - p.vy * tx;
  const s = cross >= 0 ? S : -S;
  const nx = p.vx * C - p.vy * s;
  const ny = p.vx * s + p.vy * C;
  const nl = Math.sqrt(nx * nx + ny * ny);
  p.vx = (nx / nl) * sp;
  p.vy = (ny / nl) * sp;
}

/** Homing turn rate: 0.045 rad/frame (cos, sin precomputed). */
export const SEEK_C = 0.9989875928;
export const SEEK_S = 0.0449848149;
/** Seekers only lock on within this range (px). */
const SEEK_RANGE = 15 * TILE;
/** Frames a seeker flies straight before it starts steering (clears its pod). */
const SEEK_ARM = 12;
/** Cluster shells split after this many frames, or at the top of their arc. */
export const CLUSTER_FUSE = 50;
/** Shrapnel fan (px/s offsets added to a share of the shell's velocity). */
export const CLUSTER_FAN: readonly (readonly [number, number])[] = [
  [-150, -60],
  [-80, -130],
  [0, -160],
  [80, -130],
  [150, -60],
];
/** Frames a goo/frost patch stays on a wall or floor. */
export const PATCH_FRAMES = 330;
export const PATCH_PX = COAT_PX;
/** Patches are short-lived coats: same surfaces as the placed slime and ice. */
const PATCH_SURFACES: Partial<Record<Ammo, Surface>> = { goo: COAT_SURFACES.slime, frost: COAT_SURFACES.ice };
/** How strongly a boomerang is pulled back, relative to its launch speed (1/s). */
const BOOMERANG_PULL = 1.8;
/** Thrown boomerangs curve back at the thrower: turn rate 0.2 rad/frame (cos, sin precomputed), and speed gained per frame on the way (px/s). */
const RETURN_C = 0.9800665778;
const RETURN_S = 0.1986693308;
const RETURN_GAIN = 12;

/** Gliders: a flying plank you can ride. Size (px), level-flight time (frames), sink speeds (px/s): idle, under one rider, per extra rider. */
export const GLIDER_W = 30;
export const GLIDER_H = 5;
export const GLIDER_CRUISE = 130;
const GLIDER_SINK = 40;
const GLIDER_LOADED_SINK = 70;
const GLIDER_EXTRA_SINK = 30;
/** Glider solid ids live far above prop solid ids (positive so riders are carried). */
const GLIDER_ID_BASE = 1 << 30;
export const gliderSolidId = (p: Projectile) => GLIDER_ID_BASE + p.id;
const gliderRect = (p: Projectile) => ({ x: p.x - GLIDER_W / 2, y: p.y - GLIDER_H / 2, w: GLIDER_W, h: GLIDER_H });
/** Rubber balls shove instead of kill: this share of the ball's velocity, plus a hop (px/s). */
const KNOCK_SHARE = 0.9;
const KNOCK_LIFT = 220;

/**
 * Glue a goo/frost shot onto the exposed terrain face it hit. False if there's
 * no clean face (it just pops): never inside a protected zone, and never in a
 * one-tile gap, where the coat's thickness would pinch a runner.
 */
function stick(p: Projectile, w: ProjWorld, px: number, py: number): boolean {
  const ax = hitAxis(w, p, px, py, w.frame - p.born);
  let face: number;
  if (ax === 'y') face = p.vy > 0 ? 3 : 1;
  else if (ax === 'x') face = p.vx > 0 ? 2 : 0;
  else return false;
  // Host is the terrain cell we entered; the patch sits on its face toward where we came from.
  const hx = Math.floor((ax === 'x' ? p.x : px) / TILE);
  const hy = Math.floor((ax === 'y' ? p.y : py) / TILE);
  const [dx, dy] = FACE[face];
  if (hx < 0 || hx >= w.level.w || hy < 0 || hy >= w.level.h) return false;
  if (tileAt(w.level, hx, hy) !== T_SOLID || tileAt(w.level, hx + dx, hy + dy) !== T_EMPTY || tileAt(w.level, hx + 2 * dx, hy + 2 * dy) !== T_EMPTY)
    return false;
  if (isProtected(w.level, hx, hy) || isProtected(w.level, hx + dx, hy + dy)) return false;
  p.stuck = face;
  p.hx = hx;
  p.hy = hy;
  p.until = w.frame + PATCH_FRAMES;
  p.vx = 0;
  p.vy = 0;
  p.x = (hx + 0.5 + dx * 0.5) * TILE;
  p.y = (hy + 0.5 + dy * 0.5) * TILE;
  w.emit({ type: 'prop', kind: `splat-${p.ammo}`, x: p.x, y: p.y });
  return true;
}

/** Rect (px) of a patch on face `face` of cell (cx, cy), `depth` px thick. */
export function patchRect(cx: number, cy: number, face: number, depth: number) {
  const x = cx * TILE;
  const y = cy * TILE;
  if (face === 0) return { x: x + TILE, y, w: depth, h: TILE };
  if (face === 2) return { x: x - depth, y, w: depth, h: TILE };
  if (face === 1) return { x, y: y + TILE, w: TILE, h: depth };
  return { x, y: y - depth, w: TILE, h: depth };
}

export const AMMO_SIM: Partial<Record<Ammo, AmmoSim>> = {
  seeker: {
    init(p) {
      p.sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    },
    move(p, w) {
      if (w.frame - p.born >= SEEK_ARM) {
        let best = -1;
        let bestD = SEEK_RANGE * SEEK_RANGE;
        w.runners.forEach((r, i) => {
          if (!r.active || r.safe) return;
          const dx = r.body.x + r.body.w / 2 - p.x;
          const dy = r.body.y + r.body.h / 2 - p.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best >= 0) {
          const b = w.runners[best].body;
          steer(p, b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y, SEEK_C, SEEK_S, p.sp);
        }
      }
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      return true;
    },
  },
  boomerang: {
    init(p) {
      // Pull straight back along the throw: out, stop, and return through the thrower.
      p.ax = -p.vx * BOOMERANG_PULL;
      p.ay = -p.vy * BOOMERANG_PULL;
      p.sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      p.n = 0;
    },
    move(p, w) {
      const home = p.thrower >= 0 ? w.runners[p.thrower] : undefined;
      // `n` marks a thrown one that has turned around. A launcher's stays on its line.
      if (home?.active && (p.n > 0 || p.vx * p.ax + p.vy * p.ay > 0)) {
        p.n = 1;
        const b = home.body;
        const sp = Math.min(p.sp, Math.sqrt(p.vx * p.vx + p.vy * p.vy) + RETURN_GAIN);
        steer(p, b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y, RETURN_C, RETURN_S, sp);
      } else {
        p.vx += p.ax * DT;
        p.vy += p.ay * DT;
      }
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      return true;
    },
    caught(_p, w, i) {
      if (!w.items) return false;
      w.items.caught(i, 'boomerang');
      return true;
    },
    end(p, w) {
      // A thrown one clatters down for anyone to grab; a launcher's just breaks.
      if (p.thrower >= 0) w.items?.loose({ kind: 'boomerang', uses: 1, x: p.x - p.vx * DT, y: p.y - p.vy * DT, vx: -p.vx * 0.15, vy: -90, grace: 8 });
    },
  },
  rubber: {
    init(p) {
      p.n = 5;
    },
    wall: (p, w, px, py) => bounce(p, w, px, py, 0.82),
  },
  ricochet: {
    init(p) {
      p.n = 3;
    },
    wall: (p, w, px, py) => bounce(p, w, px, py, 1),
  },
  cluster: {
    fuse(p, f) {
      const age = f - p.born;
      return age >= CLUSTER_FUSE || (age > 12 && p.vy > 40);
    },
    end(p, w, why) {
      if (why !== 'fuse') return;
      for (const [fx, fy] of CLUSTER_FAN) w.spawn({ x: p.x, y: p.y, vx: p.vx * 0.35 + fx, vy: Math.min(0, p.vy) * 0.3 + fy, owner: p.owner, ammo: 'shrapnel' });
    },
  },
  glider: {
    platform: true,
    move(p, w) {
      const id = gliderSolidId(p);
      let riders = 0;
      for (const r of w.runners) if (r.active && (r.ground ?? (r.body.onGround ? r.body.groundRef : -1)) === id) riders++;
      const ridden = riders > 0;
      // `n` is the current load (the art bends the plank by it).
      p.n = riders;
      const target = ridden ? GLIDER_LOADED_SINK + (riders - 1) * GLIDER_EXTRA_SINK : w.frame - p.born > GLIDER_CRUISE ? GLIDER_SINK : 0;
      const step = ridden ? 4 : 1.5;
      p.vy = p.vy < target ? Math.min(target, p.vy + step) : Math.max(target, p.vy - step);
      p.mx = (p.vx + (w.gust ?? 0)) * DT;
      p.my = p.vy * DT;
      p.x += p.mx;
      p.y += p.my;
      // Splinters on terrain (test the plank's corners) and on blocks, though not the launcher it just left.
      const r = gliderRect(p);
      for (const [x, y] of [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x, r.y + r.h],
        [r.x + r.w, r.y + r.h],
      ])
        if (tileAt(w.level, Math.floor(x / TILE), Math.floor(y / TILE)) === T_SOLID) return false;
      return !w.solids.some((s) => !s.oneWay && !s.film && s.propUid !== p.source && overlaps(r, s));
    },
  },
  goo: { wall: stick },
  frost: { wall: stick },
  snowball: { move: roll },
};

/** Shots whose own mover worldgen traces exactly (`traceShot`): a roll follows the ground, so no ballistic guess says where it goes. */
export const TRACED_AMMO: ReadonlySet<Ammo> = new Set<Ammo>(['snowball']);

/** Where one shot goes, frame by frame, through the level's terrain alone, until it ends or `frames` pass. */
export function traceShot(level: Level, s: ProjectileSpawn, frames = DEFAULT_LIFE): { x: number; y: number }[] {
  const noop = () => {};
  const w: ProjWorld = { level, frame: 0, solids: [], gravity: level.gravity ?? 1, runners: [], spawn: noop, emit: noop, kill: noop };
  const p = makeProjectile(s, 0, 0);
  const out: { x: number; y: number }[] = [];
  for (let f = 1; f <= frames; f++) {
    w.frame = f;
    if (!stepProjectile(p, w)) break;
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** A rolling snowball's top speed along the ground (px/s), and what it gains a second while rolling. */
export const SNOW_ROLL_MAX = 230;
const SNOW_ROLL_GAIN = 70;

/**
 * Top (px) of the first floor a falling ball's foot crosses going from `y0` to `y1` at x: terrain, a
 * one-way top it came down onto, or a solid. Null when it falls clear.
 */
function floorUnder(w: ProjWorld, x: number, y0: number, y1: number, age: number, source: number): number | null {
  const tx = Math.floor(x / TILE);
  for (let ty = Math.floor(y0 / TILE); ty <= Math.floor(y1 / TILE); ty++) {
    const t = tileAt(w.level, tx, ty);
    const top = ty * TILE;
    if ((t === T_SOLID && top >= y0 - TILE) || (t === T_ONEWAY && top >= y0 && top <= y1)) return Math.max(top, y0);
  }
  for (const s of w.solids) {
    if (s.film || x < s.x || x > s.x + s.w || (age <= 2 && source >= 0 && s.propUid === source)) continue;
    if (s.y >= y0 && s.y <= y1) return s.y;
  }
  return null;
}

/**
 * An avalanche's snowball (glacier): it falls, lands, and rolls along whatever floor it's on, gathering speed
 * to SNOW_ROLL_MAX, off ledges and down steps, until it runs into a wall (it bursts: `solidAt` takes its
 * middle) or the pit. Only + − × ÷, so it rolls the same everywhere.
 */
function roll(p: Projectile, w: ProjWorld): boolean {
  const spec = AMMO.snowball;
  const age = w.frame - p.born;
  p.vy = Math.min(p.vy + spec.gravity * w.gravity * DT, 700);
  p.x += p.vx * DT;
  const foot = p.y + spec.radius;
  const next = foot + p.vy * DT;
  const floor = p.vy >= 0 ? floorUnder(w, p.x, foot, next, age, p.source) : null;
  if (floor === null) {
    p.y += p.vy * DT;
    return true;
  }
  p.y = floor - spec.radius;
  p.vy = 0;
  const dir = p.vx < 0 ? -1 : 1;
  p.vx = dir * Math.min(SNOW_ROLL_MAX, Math.abs(p.vx) + SNOW_ROLL_GAIN * DT);
  return true;
}

/** Register behavior for an ammo kind (the held-item shots do this from src/sim/items). */
export function defineAmmo(ammo: Ammo, sim: AmmoSim): void {
  AMMO_SIM[ammo] = sim;
}

export function makeProjectile(s: ProjectileSpawn, born: number, id: number): Projectile {
  const p: Projectile = {
    ...s,
    born,
    id,
    n: 0,
    ax: 0,
    ay: 0,
    sp: 0,
    stuck: -1,
    hx: 0,
    hy: 0,
    until: 0,
    mx: 0,
    my: 0,
    thrower: s.thrower ?? -1,
    source: s.source ?? -1,
  };
  AMMO_SIM[s.ammo]?.init?.(p);
  return p;
}

/** The original projectile integrator: gravity, straight flight, lateral wobble. */
function defaultMove(p: Projectile, f: number, gravity: number): void {
  const spec = AMMO[p.ammo];
  p.vy += spec.gravity * gravity * DT;
  p.x += p.vx * DT;
  p.y += p.vy * DT;
  if (spec.wobble) {
    const sp = dhypot(p.vx, p.vy) || 1;
    const wob = dsin((f - p.born) * 0.25) * spec.wobble;
    p.x += (-p.vy / sp) * wob;
    p.y += (p.vx / sp) * wob;
  }
}

/** Is a stuck patch still there? (Its host terrain can't change mid-race, so only time matters.) */
const patchAlive = (p: Projectile, f: number) => f < p.until;

/** What each ammo effect does to the runner `i` it hit. */
const HIT: Record<HitEffect, (p: Projectile, w: ProjWorld, i: number) => void> = {
  kill: (p, w, i) => w.kill(i, p.owner),
  freeze: (_p, w, i) => {
    w.runners[i].status.frozen = FREEZE_FRAMES;
  },
  slow: (_p, w, i) => {
    w.runners[i].status.slowed = SLOW_FRAMES;
  },
  knock: (p, w, i) => knock(w.runners[i].body, p),
  bonk: (p, w, i) => {
    knock(w.runners[i].body, p);
    w.items?.bonk(i, p.owner);
  },
  none: () => {},
};

/**
 * Advance one projectile one frame. Returns true to keep it. Emits a 'pop'
 * when it ends, and applies its ammo's effect (`HIT`) to a runner it reaches.
 * Shots that reach a runner in the spawn zone pop harmlessly.
 */
export function stepProjectile(p: Projectile, w: ProjWorld): boolean {
  const f = w.frame;
  if (p.stuck >= 0) return patchAlive(p, f);
  const spec = AMMO[p.ammo];
  const sim = AMMO_SIM[p.ammo];
  const px = p.x;
  const py = p.y;
  let alive = true;
  let why: EndReason | null = null;
  if (sim?.move) alive = sim.move(p, w);
  else defaultMove(p, f, w.gravity);
  if (w.gust && !sim?.platform) p.x += w.gust * DT; // Gliders count the gust in their own move, which riders get as the plank's dx.
  if (alive && sim?.fuse?.(p, f)) alive = false;
  if (!alive) why = 'fuse';
  const age = f - p.born;
  const lost = p.x < -16 || p.x > w.level.w * TILE + 16 || p.y > w.level.h * TILE + 16 || p.y < -200;
  if (alive && (lost || age > (spec.life ?? DEFAULT_LIFE))) {
    alive = false;
    why = lost ? null : 'life';
  }
  if (alive && !sim?.platform && solidAt(w, p.x, p.y, age, p.source)) {
    w.hit?.(p.x, p.y);
    if (!sim?.wall?.(p, w, px, py)) {
      alive = false;
      why = 'wall';
    } else if (p.stuck >= 0) return true;
  }
  if (alive && !sim?.platform) {
    for (let i = 0; i < w.runners.length; i++) {
      const r = w.runners[i];
      if (!r.active || !rectCircle(r.body, p.x, p.y, spec.radius)) continue;
      if (i === p.thrower) {
        if (age < THROW_GRACE) continue;
        if (sim?.caught?.(p, w, i)) return false;
      }
      if (!r.safe) HIT[p.effect ?? spec.effect ?? 'kill'](p, w, i);
      alive = false;
      why = 'runner';
      break;
    }
  }
  if (alive) return true;
  w.emit({ type: 'pop', x: p.x, y: p.y, ammo: p.ammo });
  if (why) sim?.end?.(p, w, why);
  return false;
}

/** Shove a runner along the shot's flight. */
function knock(b: Body, p: Projectile): void {
  b.vx = p.vx * KNOCK_SHARE;
  b.vy = Math.min(p.vy * KNOCK_SHARE, -KNOCK_LIFT);
  b.onGround = false;
  b.groundRef = -1;
  b.jumping = false;
  b.coyote = 0;
}

/**
 * Projectile solids: rideable gliders (moving one-way planks: they carry
 * riders via dx/dy but can never pin or crush anyone) and stuck goo/frost
 * patches (thin surface coats on their terrain face).
 */
export function buildProjectile(p: Projectile, f: number, out: Contrib): void {
  if (AMMO_SIM[p.ammo]?.platform) {
    out.solids.push({ ...gliderRect(p), id: gliderSolidId(p), dx: p.mx, dy: p.my, surface: DEFAULT_SURFACE, propUid: -1, mi: -1, oneWay: true });
    return;
  }
  if (p.stuck < 0 || !patchAlive(p, f)) return;
  const surface = PATCH_SURFACES[p.ammo];
  if (!surface) return;
  out.solids.push({ ...patchRect(p.hx, p.hy, p.stuck, PATCH_PX), id: -1000 - p.id, dx: 0, dy: 0, surface, propUid: -1, mi: -1 });
}
