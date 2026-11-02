import { clamp, overlaps, type Rect } from '../core/geom';
import { DT, PHYS } from './constants';
import { type Body, type CollisionWorld, DEFAULT_SURFACE, firstOverlap, moveX, moveY, TILE_ONEWAY_ID } from './physics';
import type { Runner } from './run';

/**
 * Runners are solid to each other.
 *
 * Every runner first takes its own step against the world, knowing nothing of
 * the others, so that step is exactly the lone controller and nobody's motion
 * depends on who stepped first. This pass then settles the contacts from where
 * each body started and where its step took it, in two axes:
 *
 *  - **Vertical, lowest body first.** A head is a one-way platform: land on it
 *    from above, stand, jump, drop through with down + jump. Riders get their
 *    base's motion, so a stack of any height settles in one sweep, and the upper
 *    body always yields: a rising runner lifts whoever it meets. Only a ceiling
 *    can stop that, and then the riser bonks instead.
 *  - **Sideways, as a short time-of-impact simulation of the frame.** Bodies
 *    closing on each other meet at the moment they would touch and move on as a
 *    group, at a speed set by everyone's effort (`groupSpeed`). A lone walker
 *    shoves a bystander slowly, equal efforts stall, and being rear-ended never
 *    slows you down. Terrain limits a group; it's never pushed into.
 *
 * Nobody can be held up for good. Press against bodies for `slipFrames` and you
 * slip through them, which also unjams head-on runners in a corridor. A pair that
 * already overlaps at the start of a frame passes through each other until they
 * have come apart, which covers a slip, the spawn pile, a pipe exit and a pair
 * squeezed together by a crusher, with nothing to remember but the positions.
 * That rule is why a pair that can't be separated stays harmless: nobody is ever
 * pushed into terrain, and only the world can crush a runner.
 *
 * Decisions come from geometry, so they depend on neither array order nor slot
 * numbers. The one exception is deliberate: a rider exactly centered over two
 * identical heads takes the lower slot's (`better`).
 */
export const COLLIDE = {
  /** Fraction of a group's unmatched effort that moves it. About a quarter of walking speed against a bystander. */
  shove: 0.25,
  /** Frames of being held up by bodies before you slip through them. */
  slipFrames: 45,
  /** Held up: moving at under this fraction of what you're trying to do. */
  heldBelow: 0.6,
  /** Feet this far below a head still climb onto it, like a ledge lip. */
  lip: PHYS.ledgeLip,
  /** Fastest sideways carry (px per frame), a little over a run: a base kicked out from under you leaves you behind. */
  carryMax: 1.25 * PHYS.runSpeed * DT,
  /** Vertical overlap (px) that makes two bodies side contacts rather than a stack. */
  minSide: 0.01,
  /** How far (px) past its own step a group looks for room. */
  probe: 16,
} as const;

/** The float slack of `overlaps`: bodies closer than this are touching, not overlapping. */
const EPS = 1e-4;
/** Feet this far above a head still count as on it. */
const TOUCH = 0.01;

/** Where a runner was before this frame's step. */
export interface RunnerStart {
  x: number;
  y: number;
  /** Slot of the runner it stood on, or -1. */
  rode: number;
}

/** Call before anyone steps. */
export function contactStart(runners: readonly Runner[]): RunnerStart[] {
  return runners.map(({ body: b, ride }) => ({ x: b.x, y: b.y, rode: b.onGround && b.groundRef === TILE_ONEWAY_ID ? ride : -1 }));
}

interface Mover {
  r: Runner;
  b: Body;
  /** The body at the start of the frame. */
  start: Rect;
  /** Spawn zone: no contact with anyone. */
  safe: boolean;
  /** Who it stood on at the start of the frame, and at the end of it. */
  rode: Mover | null;
  base: Mover | null;
  /** Sideways motion of its own step, and with its base's carry on top. */
  own: number;
  dx: number;
  /** Direction it's slipping through bodies this frame (±1), or 0. */
  slip: number;
  slipped: boolean;
  /** Time-of-impact state: position, what it's trying to do, what it's doing, and its group. */
  x: number;
  want: number;
  v: number;
  group: number;
  grouped: boolean;
  /** Where terrain stops it, once it's looked. */
  lo: number;
  hi: number;
  looked: boolean;
}

/**
 * Settle one frame of runner contact. Runners that are dead, finished or held by
 * a prop aren't touched and touch nobody. `safe` is the spawn zone.
 */
export function collideRunners(runners: readonly Runner[], start: readonly RunnerStart[], world: CollisionWorld, safe: (r: Runner) => boolean): void {
  const ms: Mover[] = [];
  runners.forEach((r, i) => {
    if (r.alive && !r.finished && !r.attach.grip) ms.push(mover(r, start[i], safe(r)));
    else {
      r.ride = -1;
      r.press = 0;
    }
  });
  for (let i = 0; i < ms.length; i++) {
    const rode = start[runners.indexOf(ms[i].r)].rode;
    if (rode >= 0) ms[i].rode = ms.find((m) => m.r.slot === rode && solid(m, ms[i])) ?? null;
  }
  // Lowest first, so a base has settled before anyone on it. Riders are always above their base at the start of a frame.
  const order = ms.slice().sort((a, b) => b.start.y - a.start.y || a.start.x - b.start.x || a.r.slot - b.r.slot);
  settleVertical(order, world);
  settleSides(order, world);
  for (const m of order) finish(m);
}

function mover(r: Runner, s: RunnerStart, safe: boolean): Mover {
  const b = r.body;
  const own = b.x - s.x;
  return {
    r,
    b,
    start: { x: s.x, y: s.y, w: b.w, h: b.h },
    safe,
    rode: null,
    base: null,
    own,
    dx: own,
    slip: r.press >= COLLIDE.slipFrames ? Math.sign(own) : 0,
    slipped: false,
    x: s.x,
    want: own,
    v: own,
    group: -1,
    grouped: false,
    lo: 0,
    hi: 0,
    looked: false,
  };
}

/** Can these two touch at all this frame? */
function solid(a: Mover, b: Mover): boolean {
  return !a.safe && !b.safe && !overlaps(a.start, b.start);
}

const carryOf = (v: number) => clamp(v, -COLLIDE.carryMax, COLLIDE.carryMax);

// ---------------------------------------------------------------- vertical

function settleVertical(order: readonly Mover[], world: CollisionWorld): void {
  for (let i = 0; i < order.length; i++) {
    const m = order[i];
    const p = m.rode;
    if (p && m.b.onGround) m.rode = null; // Its own step put it on the world.
    else if (p) {
      m.dx += carryOf(p.dx);
      moveY(m.b, p.b.y - p.start.y, world);
    }
    let best: Mover | null = null;
    for (let j = 0; j < i; j++) if (solid(m, order[j]) && landsOn(m, order[j]) && better(m, order[j], best)) best = order[j];
    if (best) rest(m, best, world);
  }
}

/** Did `m` come down on `p`'s head this frame, or `p` come up under its feet? */
function landsOn(m: Mover, p: Mover): boolean {
  if (m.b.dropFrames > 0) return false;
  const g0 = m.start.y + m.b.h - p.start.y; // Feet below the head at the start of the frame; negative is above it.
  const g1 = m.b.y + m.b.h - p.b.y;
  if (g0 > (m.b.vy < 0 ? TOUCH : COLLIDE.lip) || g1 < -TOUCH) return false;
  const rx = m.start.x - p.start.x;
  const rd = m.dx - p.dx;
  const reach = m.b.w - EPS;
  const atHead = g1 > g0 ? clamp(-g0 / (g1 - g0), 0, 1) : 0;
  if (Math.abs(rx + rd * atHead) < reach) return true;
  // Already beside it when the feet got down there: it's a side contact, unless that's only a lip.
  const closing = rx > 0 ? -rd : rd;
  if (closing <= 0) return false;
  const t = (Math.abs(rx) - reach) / closing;
  return t <= 1 && g0 + (g1 - g0) * t <= COLLIDE.lip;
}

const sideOverlap = (m: Mover, p: Mover) => m.b.w - Math.abs(m.start.x + m.dx - p.start.x - p.dx);

/** Of two heads under `m`, the higher, then the one more under it, then the lower slot. */
function better(m: Mover, p: Mover, best: Mover | null): boolean {
  if (!best) return true;
  return (p.b.y - best.b.y || sideOverlap(m, best) - sideOverlap(m, p) || p.r.slot - best.r.slot) < 0;
}

/** Put `m` on `p`'s head. */
function rest(m: Mover, p: Mover, world: CollisionWorld): void {
  const b = m.b;
  const top = p.b.y - b.h;
  moveY(b, top - b.y, world);
  if (Math.abs(b.y - top) > TOUCH) return pinned(m, p, world);
  b.y = top;
  // Sent upward this very frame (a spring, a bumper): flush with the head, but on its way.
  if (b.vy < 0 && b.vy * DT < p.b.y - p.start.y) return;
  m.base = p;
}

/**
 * A ceiling stops `m` from going where `p` needs it to go. Someone rising into
 * it bonks and takes its riders down with it; anyone else stays overlapped, and
 * the pair passes through each other from the next frame on.
 */
function pinned(m: Mover, p: Mover, world: CollisionWorld): void {
  if (p.b.y >= p.start.y) return;
  m.base = p;
  let feet = m.b.y + m.b.h;
  for (let q: Mover | null = p; q; q = q.base) {
    moveY(q.b, feet - q.b.y, world);
    if (q.b.vy < 0) q.b.vy = 0;
    q.b.jumping = false;
    feet = q.b.y + q.b.h;
  }
}

// ---------------------------------------------------------------- sideways

function settleSides(order: readonly Mover[], world: CollisionWorld): void {
  const pairs = sidePairs(order);
  if (pairs.length === 0 && !order.some((m) => m.rode)) return;
  order.forEach((m, i) => (m.group = i));
  let t = 0;
  for (let n = 0; n < order.length; n++) {
    velocities(order, t, world);
    let hit: [Mover, Mover] | null = null;
    let at = 1;
    for (const pair of pairs) {
      const [l, r] = pair;
      if (l.group === r.group) continue;
      const closing = l.v - r.v;
      if (closing <= 1e-9) continue;
      const when = t + Math.max(0, r.x - l.x - l.b.w) / closing;
      if (when < at) {
        at = when;
        hit = pair;
      }
    }
    if (!hit) break;
    for (const m of order) m.x += m.v * (at - t);
    t = at;
    const [keep, gone] = [hit[0].group, hit[1].group];
    for (const m of order) {
      if (m.group === keep || m.group === gone) {
        m.group = keep;
        m.grouped = true;
      }
    }
  }
  velocities(order, t, world);
  for (const m of order) {
    m.x += m.v * (1 - t);
    moveX(m.b, m.x - m.b.x, world);
  }
}

/** Bodies that can meet sideways this frame, left one first. A body that started above or below the other isn't one. */
function sidePairs(order: readonly Mover[]): [Mover, Mover][] {
  const pairs: [Mover, Mover][] = [];
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const a = order[i];
      const b = order[j];
      if (!solid(a, b)) continue;
      if (Math.min(a.b.y + a.b.h, b.b.y + b.b.h) - Math.max(a.b.y, b.b.y) <= COLLIDE.minSide) continue;
      const [l, r] = a.start.x <= b.start.x ? [a, b] : [b, a];
      if (r.start.x - l.start.x - l.b.w < -EPS) continue;
      // Slipping: this one presses on through.
      if (l.slip > 0 || r.slip < 0) {
        if (l.slip > 0) l.slipped = true;
        if (r.slip < 0) r.slipped = true;
        continue;
      }
      pairs.push([l, r]);
    }
  }
  return pairs;
}

/** What everyone does from time t on. Twice, so riders of a group, and groups of riders, see each other's motion. */
function velocities(order: readonly Mover[], t: number, world: CollisionWorld): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const m of order) {
      m.want = m.own + (m.rode ? carryOf(m.rode.v) : 0);
      if (!m.grouped) m.v = m.want;
    }
    for (const m of order) {
      if (!m.grouped) continue;
      const members = order.filter((o) => o.group === m.group);
      if (members[0] !== m) continue;
      const u = groupSpeed(members, t, world);
      for (const o of members) o.v = u;
    }
  }
}

/**
 * The speed of bodies in contact. Whatever motion they all share they keep, and
 * a fraction of the rest moves the group: one walker against a bystander moves
 * both at `shove` of a walk, equal efforts cancel, a stronger push wins by the
 * difference, and nobody goes faster than the fastest of them is trying to.
 */
function groupSpeed(members: readonly Mover[], t: number, world: CollisionWorld): number {
  let sum = 0;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const m of members) {
    sum += m.want;
    lo = Math.min(lo, m.want);
    hi = Math.max(hi, m.want);
  }
  const shared = lo > 0 ? lo : hi < 0 ? hi : 0;
  const u = clamp(shared + COLLIDE.shove * (sum - members.length * shared), lo, hi);
  // No member may end up in terrain over what's left of the frame.
  const left = Math.max(1 - t, 1e-6);
  let min = Number.NEGATIVE_INFINITY;
  let max = Number.POSITIVE_INFINITY;
  for (const m of members) {
    look(m, world);
    min = Math.max(min, (m.lo - m.x) / left);
    max = Math.min(max, (m.hi - m.x) / left);
  }
  return clamp(u, min, max);
}

/** Find how far terrain lets this body go either side of where its own step left it. */
function look(m: Mover, world: CollisionWorld): void {
  if (m.looked) return;
  m.looked = true;
  const dist = Math.abs(m.b.x - m.start.x) + COLLIDE.probe;
  m.lo = m.b.x - free(m.b, -1, dist, world);
  m.hi = m.b.x + free(m.b, 1, dist, world);
}

const probe: Rect = { x: 0, y: 0, w: 0, h: 0 };

/** Px this body can move in `dir`, up to `dist`, before it's flush with something solid. */
function free(b: Body, dir: -1 | 1, dist: number, world: CollisionWorld): number {
  probe.y = b.y;
  probe.w = b.w;
  probe.h = b.h;
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i <= steps; i++) {
    probe.x = b.x + (dir * dist * i) / steps;
    const s = firstOverlap(probe, world);
    if (s) return Math.max(0, dir > 0 ? s.x - b.w - b.x : b.x - s.x - s.w);
  }
  return dist;
}

// ---------------------------------------------------------------- results

/** Write what the frame came to on the runner. */
function finish(m: Mover): void {
  const { r, b, base } = m;
  if (base && Math.abs(b.x - base.b.x) < b.w - EPS) {
    r.ride = base.r.slot;
    b.onGround = true;
    b.groundRef = TILE_ONEWAY_ID; // A head is a one-way platform, so down + jump drops through it.
    b.surface = DEFAULT_SURFACE;
    b.vy = 0;
    b.jumping = false;
    b.wallDir = 0;
    b.wallCoyote = 0;
    b.wallJumpCd = 0;
  } else r.ride = -1;
  const moved = (m.x - m.start.x) * Math.sign(m.want);
  const held = m.grouped && m.want !== 0 && moved < Math.abs(m.want) * COLLIDE.heldBelow;
  if (m.slipped) r.press = 0;
  else if (held) r.press = Math.min(r.press + 1, COLLIDE.slipFrames);
  else if (r.press > 0) r.press--;
}

/**
 * The bottom of the stack this runner stands in: the `groundRef` of whoever's
 * on the world, or -1 if the stack is in the air. A plank carries the whole stack.
 */
export function footing(runners: readonly Runner[], r: Runner): number {
  let at: Runner | undefined = r;
  for (let n = 0; at && n < runners.length; n++) {
    if (!at.body.onGround) return -1;
    if (at.ride < 0) return at.body.groundRef;
    const under: number = at.ride;
    at = runners.find((o) => o.slot === under);
  }
  return -1;
}
