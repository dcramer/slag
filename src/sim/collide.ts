import { clamp, overlaps, type Rect } from '../core/geom';
import { DT, PHYS } from './constants';
import { type Body, type CollisionWorld, firstOverlap, moveX, moveY, type Surface, TILE_ONEWAY_ID } from './physics';
import type { Runner } from './run';

/**
 * Runners are solid to each other.
 *
 * Every runner first takes its own step against the world, knowing nothing of
 * the others, so that step is exactly the lone controller and nobody's motion
 * depends on who stepped first. This pass then settles the contacts from where
 * each body started and where its step took it, in two axes:
 *
 *  - **Vertical, lowest body first.** A head is a perch you land on from above,
 *    jump off, or drop through with down + jump. A rider follows its base up and
 *    down, so a stack of any height settles in one sweep, and the upper body
 *    always yields: a rising runner never stops on someone's feet. Only a
 *    ceiling can stop that, and then the riser bonks instead.
 *  - **A bump from below** (`BUMP`). Come up at jump speed into the feet of anyone not riding you, standing
 *    on the level (a board you jump up through, say) or in the air, and they're bonked and knocked off sideways,
 *    and you carry on up through them. Only a rider on your head is bucked instead, and a head rising slower
 *    than a jump (a lip, a lift) is still a step up. A brawl bumps only someone standing (`ShoveRules.footed`).
 *  - **A perch is not ground** (`PERCH`). Nobody carries a rider sideways: it
 *    keeps its own momentum on a slick, rounded top, slides off the side it's on,
 *    and is thrown off when its base jumps, moves out from under it, or simply
 *    holds it too long.
 *  - **Sideways, as a short time-of-impact simulation of the frame.** Bodies
 *    closing on each other meet at the moment they would touch and move on as a
 *    group, at a speed set by everyone's effort (`groupSpeed`). A lone walker
 *    shoves a bystander slowly, equal efforts stall, and being rear-ended never
 *    slows you down. Terrain limits a group; it's never pushed into.
 *
 * Nobody can be held up for good. Press against bodies for `slipFrames` and you
 * slip through them, which also unjams head-on runners in a corridor; a brawl's
 * clock runs only while someone pushes back (`ShoveRules.stall`), so a shove
 * that's working never ghosts. A body a knock threw is no perch-taker or hitter
 * of its own in a brawl (`ShoveRules.thrown`). A pair that
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
  /** Fraction of a group's unmatched effort that moves it in a race. About a quarter of walking speed against a bystander. */
  shove: 0.25,
  /** Frames of being held up by bodies before you slip through them. */
  slipFrames: 45,
  /** Held up: moving at under this fraction of what you're trying to do. */
  heldBelow: 0.6,
  /** Feet this far below a head still climb onto it, like a ledge lip. */
  lip: PHYS.ledgeLip,
  /** Vertical overlap (px) that makes two bodies side contacts rather than a stack. */
  minSide: 0.01,
  /** How far (px) past its own step a group looks for room. */
  probe: 16,
} as const;

/**
 * A head is its own physics: an unstable perch, not ground (docs/DESIGN.md → Players).
 * It still counts as ground for coyote time, the jump buffer and dropping through.
 */
export const PERCH = {
  /**
   * Underfoot on a head: slick, so a rider keeps its own momentum and steers weakly. The skid is low
   * enough that the dome beats it a pixel off centre, and a rider can only fight the dome close to the middle.
   */
  surface: { friction: 0.35, conveyor: 0, speedMult: 1, jumpMult: 1, bounce: 0, skid: 40 } as Surface,
  /** The rounded top: px/s² outward per px off centre, like a ball on a dome. From 2 px off you're gone in under half a second, from 5 px in a quarter. */
  dome: 50,
  /** Frames a head holds anyone, even dead centre over a base standing still: then they tip off. */
  hold: 60,
  /** Rider and head parting faster than this (px/s), a frame after landing: a hard stop, turn or start knocks the rider off that way. Under a walk, so a base walking off tips you. */
  knock: 90,
  /** A base rising faster than this (px/s) bucks its rider: a jump, a spring, a bumper. A lip or a lift doesn't. */
  buck: 200,
  /** How much faster than its base (px/s) a bucked rider leaves: a pop, so the base's jump never catches up with its feet. */
  pop: 60,
  /** Sideways shove (px/s) and hop (px/s up) that throw a rider off: even from dead centre, the hop lands it clear of a head that stays put. */
  kick: 100,
  hop: 150,
} as const;

/** A bump from below: the sideways knock (px/s) and the hop (px/s up) it gives whoever stood there, who then sees stars. */
export const BUMP = {
  kick: 220,
  hop: 180,
} as const;

/**
 * How hard bodies shove, as the race's rules set it (`RunRules.shove`, sim/run.ts): one physics for everyone in a race,
 * stronger where a mode is about throwing people off things (a brawl). Plain data, so the run knows nothing of modes.
 */
export interface ShoveRules {
  /** Fraction of a group's unmatched effort that moves it (`groupSpeed`): a lone walker shoves a bystander at this share of a walk. */
  share: number;
  /** A shoved body keeps the speed it's shoved at, so shoved off a ledge it goes out over the drop instead of straight down. */
  carry: boolean;
  /**
   * A body check: meeting someone who isn't pushing back (`braced`) at this closing speed (px/s) or faster knocks them
   * like a bump from below, stars and credit (`CHECK`). Infinity: never.
   */
  check: number;
  /**
   * Frames of a mutual stall before its bodies slip through each other, a stall counting only with someone in the
   * group going the other way: two head-on still get past each other in the end, but a shove toward an edge never
   * ends in a ghost, and a pushing match lasts long enough to jump over. Unset, every hold winds the clock to
   * `COLLIDE.slipFrames`, as a race's tunnels need: a bystander there must cost you about a second, not the race.
   */
  stall?: number;
  /**
   * A bump from below hits only someone standing on something and not already seeing stars; a pair meeting in the air
   * is a head and a rider, as anywhere else (bucked, or a side contact). Unset, a bump hits whoever it meets.
   */
  footed?: boolean;
  /**
   * A body seeing stars is a thrown one: heads are air to it (it never perches), and a check or a bump it gives is its
   * hitter's (`bonkedBy`), or nobody's, never its own. Unset, a dazed body is a body like any other.
   */
  thrown?: boolean;
}

/** The race's shove: a quarter of a walk, nothing carried, no body checks. */
export const RACE_SHOVE: ShoveRules = { share: COLLIDE.shove, carry: false, check: Infinity };

/**
 * A body check (`ShoveRules.check`): the victim leaves at `carry` times the closing speed, at least `kick` (px/s), with
 * a hop (px/s up), and sees stars like any bonk, so it can't steer straight back.
 */
export const CHECK = {
  carry: 1.2,
  kick: 220,
  hop: 150,
} as const;

/**
 * Someone bumped from below this frame, or body-checked from the side, and by whom, by slot; `side` is the way they're
 * knocked, `stood` whether they were standing, `closing` how fast a check met them (px/s), absent for a bump.
 */
export interface Bump {
  victim: number;
  by: number;
  side: -1 | 1;
  stood: boolean;
  closing?: number;
}

/** The float slack of `overlaps`: bodies closer than this are touching, not overlapping. */
const EPS = 1e-4;
/** A pair further apart than this (px) when the frame began meets afresh; flush from last frame's shove, it doesn't. */
const FRESH = 0.01;
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
  /** Who bumped it from below this frame, if anyone. */
  bumpedBy: Mover | null;
  /** Who body-checked it from the side this frame (`ShoveRules.check`), how fast they closed (px/s), and whose hit it is (`hitter`). */
  checkedBy: Mover | null;
  closing: number;
  credit: number;
  /** Sideways motion of its own step. Nobody carries anyone, so that's all it moves before side contact. */
  own: number;
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
 * a prop aren't touched and touch nobody. `safe` is the spawn zone, `shove` how hard bodies shove in this race.
 */
export function collideRunners(
  runners: readonly Runner[],
  start: readonly RunnerStart[],
  world: CollisionWorld,
  safe: (r: Runner) => boolean,
  shove: ShoveRules = RACE_SHOVE,
): Bump[] {
  const ms: Mover[] = [];
  const slipAt = shove.stall ?? COLLIDE.slipFrames;
  runners.forEach((r, i) => {
    if (r.alive && !r.finished && !r.attach.grip) ms.push(mover(r, start[i], safe(r), slipAt));
    else {
      r.ride = -1;
      r.perch = 0;
      r.press = 0;
    }
  });
  for (let i = 0; i < ms.length; i++) {
    const rode = start[runners.indexOf(ms[i].r)].rode;
    if (rode >= 0) ms[i].rode = ms.find((m) => m.r.slot === rode && solid(m, ms[i])) ?? null;
  }
  // Lowest first, so a base has settled before anyone on it. Riders are always above their base at the start of a frame.
  const order = ms.slice().sort((a, b) => b.start.y - a.start.y || a.start.x - b.start.x || a.r.slot - b.r.slot);
  settleVertical(order, world, shove);
  settleSides(order, world, shove);
  if (shove.carry) for (const m of order) carry(m);
  catchMissed(order, world, shove);
  for (const m of order) finish(m, order, shove);
  return order.flatMap((m): Bump[] => {
    if (m.bumpedBy) return [{ victim: m.r.slot, by: hitter(m.bumpedBy, shove), side: bumpSide(m, m.bumpedBy), stood: m.b.onGround }];
    if (m.checkedBy) return [{ victim: m.r.slot, by: m.credit, side: m.start.x > m.checkedBy.start.x ? 1 : -1, stood: m.b.onGround, closing: m.closing }];
    return [];
  });
}

/** Seeing stars, under rules where that makes a body a thrown one (`ShoveRules.thrown`). */
const flung = (m: Mover, shove: ShoveRules) => !!shove.thrown && m.r.items.daze > 0;

/** Whose hit a bump or a check by `m` is: its own, or, thrown, whoever knocked it (-1: nobody's, so no hit). */
function hitter(m: Mover, shove: ShoveRules): number {
  if (!flung(m, shove)) return m.r.slot;
  const by = m.r.items.bonkedBy;
  return by === m.r.slot ? -1 : by;
}

/** Which way a bump knocks `m`: away from the one under it, else the way it faces. */
const bumpSide = (m: Mover, p: Mover): -1 | 1 => (m.b.x > p.b.x ? 1 : m.b.x < p.b.x ? -1 : m.b.facing);

function mover(r: Runner, s: RunnerStart, safe: boolean, slipAt: number): Mover {
  const b = r.body;
  const own = b.x - s.x;
  return {
    r,
    b,
    start: { x: s.x, y: s.y, w: b.w, h: b.h },
    safe,
    rode: null,
    base: null,
    bumpedBy: null,
    checkedBy: null,
    closing: 0,
    credit: -1,
    own,
    slip: r.press >= slipAt ? Math.sign(own) : 0,
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

// ---------------------------------------------------------------- vertical

function settleVertical(order: readonly Mover[], world: CollisionWorld, shove: ShoveRules): void {
  for (let i = 0; i < order.length; i++) {
    const m = order[i];
    const p = m.rode;
    if (p && (m.b.onGround || flung(m, shove))) m.rode = null; // Its own step put it on the world, or a knock threw it.
    else if (p) moveY(m.b, p.b.y - p.start.y, world); // Up and down with the head, never sideways.
    let best: Mover | null = null;
    for (let j = 0; j < i; j++) if (solid(m, order[j]) && landsOn(m, order[j], shove) && better(m, order[j], best)) best = order[j];
    if (best && bumps(m, best, shove)) m.bumpedBy = best;
    else if (best) rest(m, best, world);
  }
}

/** Did `m` come down on `p`'s head this frame, or `p` come up under its feet? Never a thrown body: heads are air to it. */
function landsOn(m: Mover, p: Mover, shove: ShoveRules): boolean {
  if (m.b.dropFrames > 0 || flung(m, shove)) return false;
  const g0 = m.start.y + m.b.h - p.start.y; // Feet below the head at the start of the frame; negative is above it.
  const g1 = m.b.y + m.b.h - p.b.y;
  if (g0 > (m.b.vy < 0 ? TOUCH : COLLIDE.lip) || g1 < -TOUCH) return false;
  const rx = m.start.x - p.start.x;
  const rd = m.own - p.own;
  const reach = m.b.w - EPS;
  const atHead = g1 > g0 ? clamp(-g0 / (g1 - g0), 0, 1) : 0;
  if (Math.abs(rx + rd * atHead) < reach) return true;
  // Already beside it when the feet got down there: it's a side contact, unless that's only a lip.
  const closing = rx > 0 ? -rd : rd;
  if (closing <= 0) return false;
  const t = (Math.abs(rx) - reach) / closing;
  return t <= 1 && g0 + (g1 - g0) * t <= COLLIDE.lip;
}

/**
 * `p` came up at jump speed from below into the feet of `m`, who wasn't riding anyone: a bump, not a lift. The pair
 * overlaps from here, so they pass through each other until they've come apart. Under `ShoveRules.footed` only someone
 * standing on something, and not seeing stars, is bumped; and it's a hit only if it's someone's (`hitter`).
 */
function bumps(m: Mover, p: Mover, shove: ShoveRules): boolean {
  if (m.rode || !(p.b.vy < -PERCH.buck && p.b.y < p.start.y - EPS && m.start.y + m.b.h - p.start.y < -TOUCH)) return false;
  if (shove.footed && (!m.b.onGround || m.r.items.daze > 0)) return false;
  const by = hitter(p, shove);
  return by >= 0 && by !== m.r.slot;
}

const sideOverlap = (m: Mover, p: Mover) => m.b.w - Math.abs(m.start.x + m.own - p.start.x - p.own);

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

function settleSides(order: readonly Mover[], world: CollisionWorld, shove: ShoveRules): void {
  const pairs = sidePairs(order);
  if (pairs.length === 0) return;
  order.forEach((m, i) => (m.group = i));
  let t = 0;
  for (let n = 0; n < order.length; n++) {
    velocities(order, t, world, shove);
    let at = 1;
    for (const [l, r] of pairs) if (l.group !== r.group) at = Math.min(at, meets(l, r, t));
    if (at >= 1) break;
    // Every pair meeting at that instant joins at once: taking them one by one would let array order pick the group.
    const hits = pairs.filter(([l, r]) => l.group !== r.group && meets(l, r, t) === at);
    for (const [l, r] of hits) check(l, r, shove);
    for (const m of order) m.x += m.v * (at - t);
    t = at;
    for (const [l, r] of hits) {
      const [keep, gone] = [l.group, r.group];
      for (const m of order) {
        if (m.group === keep || m.group === gone) {
          m.group = keep;
          m.grouped = true;
        }
      }
    }
  }
  velocities(order, t, world, shove);
  for (const m of order) {
    m.x += m.v * (1 - t);
    moveX(m.b, m.x - m.b.x, world);
  }
}

/** When (0..1 of the frame) this pair touches, moving as they are from time t; 1 if never this frame. Read before anyone moves to it. */
function meets(l: Mover, r: Mover, t: number): number {
  const closing = l.v - r.v;
  if (closing <= 1e-9) return 1;
  return Math.min(1, t + Math.max(0, r.x - l.x - l.b.w) / closing);
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

/**
 * A pair meeting this instant: if the one coming on closes at `ShoveRules.check` or faster on someone who isn't pushing
 * back toward it (standing, or going its way slower), that's a body check. Only a fresh meeting, apart when the frame
 * began, and never on someone still seeing stars: leaning on a body, or running on into the one you just knocked, is a
 * shove, so nobody is stun-locked. Read from the pair's motion as they meet, never their order; a body checked twice in
 * a frame keeps the harder one, an exact tie the lower slot's.
 */
function check(l: Mover, r: Mover, shove: ShoveRules): void {
  const closing = (l.v - r.v) / DT;
  if (closing < shove.check || r.start.x - l.start.x - l.b.w <= FRESH) return;
  // Each one's motion toward the other: the one coming on harder checks the other.
  const [by, victim, braced] = l.v >= -r.v ? [l, r, -r.v] : [r, l, l.v];
  if (braced > 1e-9 || victim.bumpedBy || victim.r.items.daze > 0) return;
  // A thrown body's check is its hitter's, and one nobody threw (or that would credit the victim) is only a shove.
  const credit = hitter(by, shove);
  if (credit < 0 || credit === victim.r.slot) return;
  if (victim.checkedBy && (closing < victim.closing || (closing === victim.closing && by.r.slot > victim.checkedBy.r.slot))) return;
  victim.checkedBy = by;
  victim.closing = closing;
  victim.credit = credit;
}

/**
 * A body shoved along in the air (`ShoveRules.carry`) leaves at the speed it was shoved, not its own: shoved off a
 * ledge it goes out over the drop. Only a body moved faster than it was going, the way it was going or standing; one
 * pushing back keeps its own. On the ground its own footing stops it, so nothing is carried there: written every frame
 * of a shove, the carried speed would outlast the victim's own braking and they could never push back.
 */
function carry(m: Mover): void {
  if (m.b.onGround || !m.grouped || m.v * m.want < 0 || Math.abs(m.v) <= Math.abs(m.want) + 1e-9) return;
  m.b.vx = m.v / DT;
}

/** What everyone does from time t on: its own motion, or its group's. */
function velocities(order: readonly Mover[], t: number, world: CollisionWorld, shove: ShoveRules): void {
  for (const m of order) if (!m.grouped) m.v = m.want;
  for (const m of order) {
    if (!m.grouped) continue;
    const members = order.filter((o) => o.group === m.group);
    if (members[0] !== m) continue;
    const u = groupSpeed(members, t, world, shove.share);
    for (const o of members) o.v = u;
  }
}

/**
 * The speed of bodies in contact. Whatever motion they all share they keep, and
 * a fraction of the rest (`share`) moves the group: one walker against a bystander moves
 * both at `share` of a walk, equal efforts cancel, a stronger push wins by the
 * difference, and nobody goes faster than the fastest of them is trying to.
 */
function groupSpeed(members: readonly Mover[], t: number, world: CollisionWorld, share: number): number {
  // Summed smallest first, so bodies at exactly the same spot add up the same in either order.
  const wants = members.map((m) => m.want).sort((a, b) => a - b);
  let sum = 0;
  for (const w of wants) sum += w;
  const lo = wants[0];
  const hi = wants[wants.length - 1];
  const shared = lo > 0 ? lo : hi < 0 ? hi : 0;
  const u = clamp(shared + share * (sum - members.length * shared), lo, hi);
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

/**
 * Feet that just missed a head can end the frame in it anyway, when side contact
 * holds that head back under them (a third body blocks it). They land on it after all.
 */
function catchMissed(order: readonly Mover[], world: CollisionWorld, shove: ShoveRules): void {
  for (let i = 0; i < order.length; i++) {
    const m = order[i];
    if (m.base || m.bumpedBy || m.b.dropFrames > 0 || flung(m, shove)) continue;
    for (let j = 0; j < i; j++) {
      const p = order[j];
      if (solid(m, p) && overlaps(m.b, p.b) && m.start.y + m.b.h - p.start.y <= COLLIDE.lip) {
        rest(m, p, world);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------- results

/**
 * Write what the frame came to on the runner. Lowest first, so a base's throw has landed before its rider looks. Held up
 * by bodies winds its slip clock (`press`); under `ShoveRules.stall` only against someone in its group going the other way.
 */
function finish(m: Mover, order: readonly Mover[], shove: ShoveRules): void {
  const { r, b, base } = m;
  if (base && Math.abs(b.x - base.b.x) < b.w - EPS) perch(m, base);
  else {
    r.ride = -1;
    r.perch = 0;
  }
  const moved = (m.x - m.start.x) * Math.sign(m.want);
  const held =
    m.grouped &&
    m.want !== 0 &&
    moved < Math.abs(m.want) * COLLIDE.heldBelow &&
    (shove.stall === undefined || order.some((o) => o.grouped && o.group === m.group && o.want * m.want < 0));
  if (m.slipped) r.press = 0;
  else if (held) r.press = Math.min(r.press + 1, shove.stall ?? COLLIDE.slipFrames);
  else if (r.press > 0) r.press--;
}

/**
 * `m` ends the frame on `p`'s head: stand there one more frame, or be thrown off.
 * Everything here is geometry and the two bodies' motion, never slots.
 */
function perch(m: Mover, p: Mover): void {
  const { r, b } = m;
  const off = b.x - p.b.x;
  // How fast the head is moving out from under the rider, from where both really went this frame.
  const rel = (b.x - m.start.x - (p.b.x - p.start.x)) / DT;
  // Off the side it's on; dead centre, the way it's moving against the head (a stack bucked at once spills both ways), else off the back.
  const side = Math.sign(off) || Math.sign(rel) || Math.sign(b.vx - p.b.vx) || -p.b.facing;
  if (p.b.vy < -PERCH.buck) return thrown(m, side, Math.min(b.vy, p.b.vy - PERCH.pop));
  if (m.rode && Math.abs(rel) > PERCH.knock) return thrown(m, Math.sign(rel), -PERCH.hop);
  if (r.perch >= PERCH.hold) return thrown(m, side, -PERCH.hop);
  r.ride = p.r.slot;
  r.perch++;
  b.onGround = true;
  b.groundRef = TILE_ONEWAY_ID; // Down + jump drops through a head, as through a one-way.
  b.surface = PERCH.surface;
  b.vy = 0;
  b.vx += PERCH.dome * off * DT;
  b.jumping = false;
  b.wallDir = 0;
  b.wallCoyote = 0;
  b.wallJumpCd = 0;
}

/**
 * Off the head, shoved `dir` and leaving at `vy`. It's still a head you just stood
 * on, so coyote time and a buffered jump work as off a ledge. Never hurts.
 */
function thrown(m: Mover, dir: number, vy: number): void {
  const { r, b } = m;
  b.vx += dir * PERCH.kick;
  b.vy = vy;
  b.onGround = false;
  b.groundRef = -1;
  b.jumping = false;
  b.coyote = Math.max(b.coyote, PHYS.coyoteFrames);
  r.ride = -1;
  r.perch = 0;
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
