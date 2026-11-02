import { pointInRect, rectCircle } from '../../core/geom';
import { DT, TILE } from '../constants';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../level';
import { type Body, DEFAULT_SURFACE, type Solid, type Surface } from '../physics';
import type { GameEvent } from '../types';
import type { Contrib, ProjectileSpawn, RunnerMut } from './registry';
import { FREEZE_FRAMES, SLOW_FRAMES } from './status';
import { AMMO, type Ammo } from './types';

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
 * still uses Math.hypot/Math.sin (pre-existing; see core/dmath.ts plans).
 */

export interface Projectile extends ProjectileSpawn {
  born: number;
  /** Spawn sequence number in this race (stable id for patch solids). */
  id: number;
  /** Bounces left (rubber, ricochet). */
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
}

export interface ProjWorld {
  level: Level;
  frame: number;
  solids: readonly Solid[];
  /** Runners with their alive/finished state; index matches RunWorld.runners. */
  runners: readonly (RunnerMut & { active: boolean })[];
  spawn(p: ProjectileSpawn): void;
  emit(e: GameEvent): void;
  /** A lethal projectile hit runner `i`. */
  kill(i: number, owner: number): void;
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
}

const DEFAULT_LIFE = 60 * 8;

/** Face directions (0 right, 1 down, 2 left, 3 up). */
export const FACE: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function solidAt(w: ProjWorld, x: number, y: number, age: number): boolean {
  if (tileAt(w.level, Math.floor(x / TILE), Math.floor(y / TILE)) === T_SOLID) return true;
  return age > 2 && w.solids.some((s) => pointInRect(x, y, s));
}

/** Which axis of the last move ran into something: 'x' (a wall), 'y' (floor/ceiling) or both (a corner). */
function hitAxis(w: ProjWorld, p: Projectile, px: number, py: number, age: number): 'x' | 'y' | 'xy' {
  const viaX = solidAt(w, p.x, py, age);
  const viaY = solidAt(w, px, p.y, age);
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
export const SEEK_RANGE = 15 * TILE;
/** Frames a seeker flies straight before it starts steering (clears its pod). */
export const SEEK_ARM = 12;
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
export const PATCH_PX = 3;
export const PATCH_SURFACES: Partial<Record<Ammo, Surface>> = {
  goo: { ...DEFAULT_SURFACE, friction: 1.5, speedMult: 0.45, jumpMult: 0.7, wall: 'sticky' },
  frost: { ...DEFAULT_SURFACE, friction: 0.1, speedMult: 1.15, wall: 'slick' },
};
/** How strongly a boomerang is pulled back, relative to its launch speed (1/s). */
export const BOOMERANG_PULL = 1.8;

/** Gliders: a flying plank you can ride. Size (px), level-flight time (frames), sink speeds (px/s) idle and under a rider. */
export const GLIDER_W = 30;
export const GLIDER_H = 5;
export const GLIDER_CRUISE = 130;
export const GLIDER_SINK = 40;
export const GLIDER_LOADED_SINK = 70;
/** Glider solid ids live far above prop solid ids (positive so riders are carried). */
export const GLIDER_ID_BASE = 1 << 30;
export const gliderSolidId = (p: Projectile) => GLIDER_ID_BASE + p.id;
export const gliderRect = (p: Projectile) => ({ x: p.x - GLIDER_W / 2, y: p.y - GLIDER_H / 2, w: GLIDER_W, h: GLIDER_H });
/** Rubber balls shove instead of kill: this share of the ball's velocity, plus a hop (px/s). */
export const KNOCK_SHARE = 0.9;
export const KNOCK_LIFT = 220;

/** Glue a goo/frost shot onto the exposed terrain face it hit. False if there's no clean face (it just pops). */
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
  if (tileAt(w.level, hx, hy) !== T_SOLID || tileAt(w.level, hx + dx, hy + dy) !== T_EMPTY) return false;
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
          if (!r.active) return;
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
    },
    move(p) {
      p.vx += p.ax * DT;
      p.vy += p.ay * DT;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      return true;
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
      const ridden = w.runners.some((r) => r.active && r.body.onGround && r.body.groundRef === id);
      if (ridden) p.n++;
      const target = ridden ? GLIDER_LOADED_SINK : w.frame - p.born > GLIDER_CRUISE ? GLIDER_SINK : 0;
      const step = ridden ? 4 : 1.5;
      p.vy = p.vy < target ? Math.min(target, p.vy + step) : Math.max(target, p.vy - step);
      p.mx = p.vx * DT;
      p.my = p.vy * DT;
      p.x += p.mx;
      p.y += p.my;
      // Splinters on terrain: test the plank's corners.
      const r = gliderRect(p);
      for (const [x, y] of [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x, r.y + r.h],
        [r.x + r.w, r.y + r.h],
      ])
        if (tileAt(w.level, Math.floor(x / TILE), Math.floor(y / TILE)) === T_SOLID) return false;
      return true;
    },
  },
  goo: { wall: stick },
  frost: { wall: stick },
};

export function makeProjectile(s: ProjectileSpawn, born: number, id: number): Projectile {
  const p: Projectile = { ...s, born, id, n: 0, ax: 0, ay: 0, sp: 0, stuck: -1, hx: 0, hy: 0, until: 0, mx: 0, my: 0 };
  AMMO_SIM[s.ammo]?.init?.(p);
  return p;
}

/** The original projectile integrator: gravity, straight flight, lateral wobble. */
function defaultMove(p: Projectile, f: number): void {
  const spec = AMMO[p.ammo];
  p.vy += spec.gravity * DT;
  p.x += p.vx * DT;
  p.y += p.vy * DT;
  if (spec.wobble) {
    const sp = Math.hypot(p.vx, p.vy) || 1;
    const wob = Math.sin((f - p.born) * 0.25) * spec.wobble;
    p.x += (-p.vy / sp) * wob;
    p.y += (p.vx / sp) * wob;
  }
}

/** Is a stuck patch still there? (Its host terrain can't change mid-race, so only time matters.) */
export const patchAlive = (p: Projectile, f: number) => f < p.until;

/**
 * Advance one projectile one frame. Returns true to keep it. Emits a 'pop'
 * when it ends, and handles runner hits by its ammo's effect: lethal
 * shots call `w.kill`, frost freezes, goo slows.
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
  else defaultMove(p, f);
  if (alive && sim?.fuse?.(p, f)) alive = false;
  if (!alive) why = 'fuse';
  const age = f - p.born;
  const lost = p.x < -16 || p.x > w.level.w * TILE + 16 || p.y > w.level.h * TILE + 16 || p.y < -200;
  if (alive && (lost || age > (spec.life ?? DEFAULT_LIFE))) {
    alive = false;
    why = lost ? null : 'life';
  }
  if (alive && !sim?.platform && solidAt(w, p.x, p.y, age)) {
    if (!sim?.wall?.(p, w, px, py)) {
      alive = false;
      why = 'wall';
    } else if (p.stuck >= 0) return true;
  }
  if (alive && !sim?.platform) {
    for (let i = 0; i < w.runners.length; i++) {
      const r = w.runners[i];
      if (!r.active || !rectCircle(r.body, p.x, p.y, spec.radius)) continue;
      const eff = spec.effect ?? 'kill';
      if (eff === 'kill') w.kill(i, p.owner);
      else if (eff === 'freeze') r.status.frozen = FREEZE_FRAMES;
      else if (eff === 'slow') r.status.slowed = SLOW_FRAMES;
      else if (eff === 'knock') knock(r.body, p);
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
 * Projectile solids: rideable gliders (moving, carry riders via dx/dy) and
 * stuck goo/frost patches (thin surface coats on their terrain face).
 */
export function buildProjectile(p: Projectile, f: number, out: Contrib): void {
  if (AMMO_SIM[p.ammo]?.platform) {
    out.solids.push({ ...gliderRect(p), id: gliderSolidId(p), dx: p.mx, dy: p.my, surface: DEFAULT_SURFACE, propUid: -1, mi: -1 });
    return;
  }
  if (p.stuck < 0 || !patchAlive(p, f)) return;
  const surface = PATCH_SURFACES[p.ammo];
  if (!surface) return;
  out.solids.push({ ...patchRect(p.hx, p.hy, p.stuck, PATCH_PX), id: -1000 - p.id, dx: 0, dy: 0, surface, propUid: -1, mi: -1 });
}
