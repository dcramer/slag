import type { Clip, Settings } from '../settings';
import type { Part, Traced } from './trace';

/**
 * The round dot-eater (docs/CHARACTERS.md → Roster, `chomper`), generated rather than modelled: it has no
 * limbs to rig. The nod is the circle with a wedge cut out of its front, pure yellow, and the chomp, so
 * the mouth opens and snaps shut through every clip. Ours: the eater got eaten, a scalloped bite out of
 * the back of the circle with its bitten edge showing, and a checked napkin tucked into the lower lip.
 *
 * Every frame is built in the ball's own space (centre at the origin, x toward the mouth, y down), then
 * spun, squashed about the floor and stood on it. Each outline has a fixed number of points in a fixed
 * order, so the pen's boil (keyed to a point's index) moves a line the same way from frame to frame.
 */

/** How the ball holds itself in one frame. */
interface Pose {
  /** The mouth's half-opening, radians. */
  a: number;
  /** Which way the mouth points (0 forward, -π/2 up): the death turns it up before it folds. */
  mu?: number;
  /** A forward roll, radians (clockwise facing right). */
  rot?: number;
  /** Squash and stretch about the floor. */
  sx?: number;
  sy?: number;
  /** World px off the floor, and forward. */
  lift?: number;
  dx?: number;
  /** The napkin's swing back from hanging straight down, radians. */
  swing?: number;
  marks?: 'speed' | 'spin';
  /** Crumbs falling from a wall it's biting, 0 to 1 through their fall. */
  crumbs?: number;
  /** Only the napkin is left, on the floor. */
  gone?: boolean;
}

const TAU = Math.PI * 2;
/** The bottom of a standing frame sits this far above the floor, where the pen's ink round it lands on it. */
const FLOOR = 0.6;
/** The mouth wide open and shut (shut leaves a slit, so the lips still read as a line). */
const OPEN = 0.72;
const SHUT = 0.06;
/** The bite: centred this far round from the mouth (clockwise on screen, so up the back), three teeth wide. */
const BITE = 3.98;
const TOOTH = 0.36;
const ARC = 64;

const wrap = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const dir = (a: number, r = 1): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A hop's height through its loop: 0 on the floor at the ends, 1 at the top. */
const hop = (u: number) => Math.sin(Math.PI * u);

/** The motion of each clip, by name: `u` 0 to 1 through it, `i` the frame. */
const MOTIONS: Record<string, (u: number, i: number, c: Clip) => Pose> = {
  // At rest: the mouth breathes, then a chomp at nothing.
  idle: (u) => {
    const chomp = Math.max(0, 1 - Math.abs(u - 0.62) / 0.1);
    const a = lerp(0.34 + 0.1 * Math.sin(u * TAU), SHUT, chomp);
    return { a, sy: 1 - chomp * 0.05, sx: 1 + chomp * 0.04 };
  },
  // A hop per stride and a chomp per hop: shut and squashed on the floor, wide open at the top.
  walk: (u) => step(u, 1.8, 0),
  run: (u) => ({ ...step(u, 2.8, 0.14), marks: 'speed' }),
  // One forward spin on the way up, then open-mouthed on the way down.
  air: (u) => {
    const spin = Math.min(1, u / 0.62);
    const ease = spin * spin * (3 - 2 * spin);
    const top = Math.max(0, 1 - Math.abs(u - 0.62) / 0.3);
    return {
      a: spin < 1 ? lerp(0.2, OPEN, Math.sin(Math.PI * spin)) : lerp(0.55, OPEN, top),
      rot: ease * TAU,
      sy: 1 + 0.06 * (1 - u),
      sx: 1 - 0.04 * (1 - u),
      swing: spin < 1 ? 0.9 * Math.sin(Math.PI * spin) : 0.5,
      marks: spin > 0.05 && spin < 0.95 ? 'spin' : undefined,
    };
  },
  // Pressed to the wall and biting chunks out of it on the way down.
  wall: (u) => {
    const bite = 0.5 - 0.5 * Math.cos(u * TAU);
    return { a: lerp(SHUT + 0.04, 0.62, bite), sx: 0.9, sy: 1.04, dx: -1.3, lift: 0.6, swing: 0.35, crumbs: u };
  },
  // Hopping on the spot, laughing.
  cheer: (u) => {
    const h = Math.abs(Math.sin(u * TAU));
    return {
      a: lerp(0.5, 0.78, Math.abs(Math.sin(u * TAU * 2))),
      lift: 3 * h,
      sy: 0.94 + 0.12 * h,
      sx: 1.05 - 0.08 * h,
      rot: 0.14 * Math.sin(u * TAU),
      swing: 0.3 * h,
    };
  },
  // The dot-eater's own end: the mouth turns up and opens until the ball folds away, leaving the napkin.
  death: (_u, i, c) => {
    const n = c.frames;
    if (i === n - 1) return { a: Math.PI, gone: true };
    if (i === 0) return { a: SHUT, sx: 1.12, sy: 0.88 };
    const turn = Math.min(1, i / 3);
    const fold = Math.max(0, (i - 3) / (n - 5));
    return { a: lerp(lerp(0.12, 0.4, turn), Math.PI - 0.08, fold * fold), mu: (-Math.PI / 2) * turn, swing: 0.2 * fold };
  },
};

/** A hop along the floor: `h` px high, leaning `lean` forward. */
function step(u: number, h: number, lean: number): Pose {
  const up = hop(u);
  // Squashed for the first and last few frames, where it lands and pushes off.
  const land = Math.max(0, 1 - up * 3);
  return {
    a: lerp(SHUT, OPEN, Math.min(1, up * 1.4)),
    lift: h * up,
    sx: 1 + 0.08 * land - 0.03 * up,
    sy: 1 - 0.1 * land + 0.05 * up,
    rot: lean,
    swing: 0.08 + 0.3 * up,
  };
}

/** How far out the ball reaches at angle `t` (local): the circle, less the three tooth marks of the bite. */
function reach(R: number, t: number): number {
  const b = R * 0.25;
  const d = R * 1.03;
  let r = R;
  for (const j of [-1, 0, 1]) {
    const phi = wrap(t - (BITE + j * TOOTH));
    const s = d * Math.sin(phi);
    if (Math.abs(s) >= b || Math.cos(phi) <= 0) continue;
    r = Math.min(r, d * Math.cos(phi) - Math.sqrt(b * b - s * s));
  }
  return r;
}

/** Signed area of a ring, y down: positive is clockwise on screen. */
function area(r: number[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length;
    a += r[i] * r[j + 1] - r[j] * r[i + 1];
  }
  return a;
}

/** A blob of `n` points round (x, y). */
function blob(x: number, y: number, rx: number, ry: number, n = 7, turn = 0): [number, number][] {
  return Array.from({ length: n }, (_, k) => {
    const t = (k / n) * TAU;
    const px = Math.cos(t) * rx;
    const py = Math.sin(t) * ry;
    return [x + px * Math.cos(turn) - py * Math.sin(turn), y + px * Math.sin(turn) + py * Math.cos(turn)];
  });
}

/** A thin stick from `p` along angle `t`, `len` long and `w` wide. */
function stick(p: [number, number], t: number, len: number, w: number): [number, number][] {
  const [ux, uy] = dir(t);
  const [nx, ny] = [-uy * w * 0.5, ux * w * 0.5];
  const q: [number, number] = [p[0] + ux * len, p[1] + uy * len];
  return [
    [p[0] + nx, p[1] + ny],
    [q[0] + nx, q[1] + ny],
    [q[0] - nx, q[1] - ny],
    [p[0] - nx, p[1] - ny],
  ];
}

export function chomperFrame(s: Settings, clip: string, c: Clip, u: number, i: number, facing: 'r' | 'l', role: (name: string) => number): Traced {
  const motion = MOTIONS[clip];
  if (!motion) throw new Error(`chomper: no motion for clip "${clip}" (add it to MOTIONS in tools/art3d/page/chomper.ts)`);
  const p = motion(u, i, c);
  const R = s.shape!.r;
  const { a, mu = 0, rot = 0, sx = 1, sy = 1, lift = 0, dx = 0, swing = 0 } = p;
  const f = facing === 'r' ? 1 : -1;
  const cy = -FLOOR - lift - R * sy;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  /** Ball space to the frame: spun, squashed about the floor, stood on it, mirrored for the facing. */
  const at = ([x, y]: [number, number]): [number, number] => [f * (sx * (x * cr - y * sr) + dx), sy * (x * sr + y * cr) + cy];
  const q = (v: number) => Math.round(v * 16) / 16;
  /** A ring in the frame's space, clockwise on screen whichever way it faces. */
  const ring = (pts: [number, number][], floor = false): number[] => {
    const out: number[] = [];
    for (const pt of pts) {
      const [x, y] = at(pt);
      out.push(q(x), q(floor ? Math.min(y, -FLOOR) : y));
    }
    if (area(out) < 0) {
      const back: number[] = [];
      for (let k = out.length - 2; k >= 0; k -= 2) back.push(out[k], out[k + 1]);
      return back;
    }
    return out;
  };
  const parts: Part[] = [];
  const part = (name: string, pts: [number, number][], option?: [number, number], floor = false) =>
    parts.push({ role: role(name), ring: ring(pts, floor), depth: 0, ...(option ? { option } : {}) });
  /** Whether angle `t` (ball space) is on the ball, not in the open mouth. */
  const solid = (t: number, pad = 0) => Math.abs(wrap(t - mu)) > a + pad;

  if (p.gone) {
    // All that's left: the napkin, flat on the floor where the ball sat, one corner turned up.
    const nap: [number, number][] = [
      [-3.4, 0],
      [-1, -0.9],
      [2.6, -1.3],
      [3.6, -0.2],
      [0.4, 0.2],
    ];
    const lay = (pts: [number, number][]) => pts.flatMap(([x, y]) => [q(f * x), q(y - FLOOR)]);
    const fix = (r: number[]) => (area(r) < 0 ? r.reduceRight<number[]>((acc, _, k) => (k % 2 ? acc : (acc.push(r[k], r[k + 1]), acc)), []) : r);
    const sil = fix(lay(nap));
    const napkin: Part = { role: role('napkin'), ring: sil, depth: 0 };
    const checks: Part[] = [
      [
        [-2.2, -0.15],
        [-1.2, -0.55],
        [-0.8, -0.05],
        [-1.8, 0.25],
      ],
      [
        [0.4, -0.75],
        [1.5, -0.95],
        [1.7, -0.45],
        [0.6, -0.25],
      ],
    ].map((pts) => ({ role: role('check'), ring: fix(lay(pts as [number, number][])), depth: 0 }));
    return { sil: [sil], parts: [napkin, ...checks], eyes: [] };
  }

  // The body: from the mouth's corner round the long way, lower lip to upper.
  const body: [number, number][] = [[0, 0]];
  for (let k = 0; k < ARC; k++) {
    const t = mu + a + ((TAU - 2 * a) * k) / (ARC - 1);
    body.push(dir(t, reach(R, t)));
  }
  part('body', body);

  // The bite's edge, bitten into a deeper yellow, and only while the mouth hasn't swallowed it.
  const span = TOOTH + Math.asin(0.25 / 1.03) + 0.02;
  if (solid(BITE - span) && solid(BITE + span) && solid(BITE)) {
    const deep = R - (R * 1.03 - R * 0.25);
    const outer: [number, number][] = [];
    const inner: [number, number][] = [];
    for (let k = 0; k <= 20; k++) {
      const t = BITE - span + (2 * span * k) / 20;
      const r = reach(R, t);
      const w = 0.95 * Math.min(1, (R - r) / deep) ** 0.35;
      outer.push(dir(t, r));
      inner.push(dir(t, r - w));
    }
    part('bitten', [...outer, ...inner.map((_, k) => inner[inner.length - 1 - k])]);
  }

  // A fork-tine scratch on the back (a swap).
  if (solid(2.7, 0.3)) for (const o of [-0.9, 0, 0.9]) part('scratch', stick([R * -0.5 + o * 0.7, R * 0.22 + o * 0.45], -0.95, 2.4, 0.34), [2, 1]);

  // The napkin, tucked into the lower lip and hanging (in screen space) below it.
  const lip = mu + a;
  if (lip < Math.PI * 0.85) {
    const A = dir(lip, R * 0.4);
    const B = dir(lip, R * 0.96);
    const L = R * 0.72;
    const down = Math.PI / 2 - rot + swing;
    const h = dir(down);
    const fwd = dir(down - Math.PI / 2);
    const mid: [number, number] = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const T: [number, number] = [mid[0] + h[0] * L, mid[1] + h[1] * L];
    const E: [number, number] = [B[0] + h[0] * L * 0.42 + fwd[0] * 0.5, B[1] + h[1] * L * 0.42 + fwd[1] * 0.5];
    const F: [number, number] = [A[0] + h[0] * L * 0.42 - fwd[0] * 0.3, A[1] + h[1] * L * 0.42 - fwd[1] * 0.3];
    part('napkin', [A, B, E, T, F], undefined, true);
    // The check: alternate cells of a 3 × 3 grid across it, narrowing to its point.
    const P = (cu: number, cv: number): [number, number] => {
      const top: [number, number] = [lerp(A[0], B[0], cu), lerp(A[1], B[1], cu)];
      return [lerp(top[0], T[0], cv), lerp(top[1], T[1], cv)];
    };
    for (const [gu, gv] of [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 2],
      [2, 2],
    ]) {
      const [u0, u1, v0, v1] = [gu / 3 + 0.03, (gu + 1) / 3 - 0.03, (gv / 3) * 0.8 + 0.03, ((gv + 1) / 3) * 0.8 - 0.03];
      part('check', [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], undefined, true);
    }
  }

  // A crumb on the upper lip, and a toothpick in the corner of the mouth (swaps).
  const upper = mu - a;
  const cp = dir(upper + 0.05, R * 0.72);
  part('crumb', blob(cp[0], cp[1], 0.8, 0.65, 6, upper), [0, 1]);
  part('pick', stick(dir(mu + a * 0.5, R * 0.18), mu + a * 0.4 + 0.06, R * 0.86, 0.36), [1, 1]);

  // Crumbs bitten off a wall, falling past the lower lip.
  if (p.crumbs !== undefined)
    for (let k = 0; k < 3; k++) {
      const fall = (p.crumbs + k / 3) % 1;
      const m = dir(mu + a, R * 0.95);
      part('crumbs', blob(m[0] + 0.6 - fall * 0.8 + k * 0.3, m[1] + 0.6 + fall * R * 0.9, 0.55 - k * 0.08, 0.45, 5, k), undefined, true);
    }

  // One eye above the mouth, while the mouth hasn't opened over it.
  const eyes: number[] = [];
  const look = mu - 1.02;
  if (solid(look, 0.1)) {
    const [ex, ey] = at(dir(look, R * 0.6));
    eyes.push(q(ex), q(ey), 0.6);
  }

  const marks: number[][] = [];
  if (p.marks === 'speed')
    for (const [y, len, off] of [
      [-0.35, 3.2, 0],
      [0.1, 4, 0.6],
      [0.5, 2.6, 0.3],
    ]) {
      const x0 = -R * 1.08 - off - (i % 2) * 0.4;
      const yy = cy + y * R;
      marks.push([q(f * x0), q(yy), q(f * (x0 - len * 0.5)), q(yy + 0.05), q(f * (x0 - len)), q(yy)]);
    }
  if (p.marks === 'spin')
    for (let m = 0; m < 3; m++) {
      const r = R * (1.16 + m * 0.16);
      const span2 = 1.1 - m * 0.3;
      const mid = Math.PI * 0.85 + rot * 0.15 + (m - 1) * 0.35;
      const arc: number[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = mid - span2 / 2 + (span2 * k) / 6;
        arc.push(q(f * Math.cos(t) * r * sx + f * dx), q(cy + Math.sin(t) * r * sy));
      }
      marks.push(arc);
    }

  return { sil: [parts[0].ring], parts, eyes, ...(marks.length ? { marks } : {}) };
}
