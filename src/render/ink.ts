import { hash2 } from '../core/rng';

/**
 * The game's line: a stroke is a filled ribbon whose width follows a pressure curve, so it swells, tapers
 * and lifts off the page. Rules for using it are in docs/ART.md.
 *
 * Everything is keyed on world position, never on walk order or arc length from a start point. That is
 * what keeps the page still: a bomb re-traces the terrain, and every mark it didn't touch lands exactly
 * where it was.
 */

export interface P {
  x: number;
  y: number;
}

/** Smooth value noise in 0..1. */
export function vn(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Signed value noise in -1..1. */
export const sn = (x: number, y: number, seed: number) => vn(x, y, seed) * 2 - 1;

export interface StrokeOpts {
  /** Widest width in world px. */
  w: number;
  seed: number;
  /** Sideways hand tremor in world px. */
  wobble?: number;
  /** Fractions of the length spent swelling in and tapering out. */
  taper?: [number, number];
  /** How much pressure wanders along the stroke, 0..1. */
  press?: number;
}

const lx: number[] = [];
const ly: number[] = [];
const rx: number[] = [];
const ry: number[] = [];

/** One pen stroke along `pts` as a filled ribbon, into the current fillStyle. */
export function stroke(g: CanvasRenderingContext2D, pts: readonly P[], o: StrokeOpts) {
  const n = pts.length;
  if (n < 2) return;
  let len = 0;
  for (let i = 1; i < n; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (len < 0.05) return;
  const [ta, tb] = o.taper ?? [0.22, 0.34];
  const press = o.press ?? 0.45;
  const wob = o.wobble ?? 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    if (i) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const t = s / len;
    const ends = Math.min(1, ta > 0 ? t / ta : 1) * Math.min(1, tb > 0 ? (1 - t) / tb : 1);
    const hw = (o.w / 2) * Math.pow(ends, 0.75) * (1 - press + press * 1.6 * vn(s * 0.11, 3.7, o.seed));
    const c = wob ? sn(s * 0.07, 9.1, o.seed) * wob : 0;
    const x = pts[i].x - dy * c;
    const y = pts[i].y + dx * c;
    lx[i] = x - dy * hw;
    ly[i] = y + dx * hw;
    rx[i] = x + dy * hw;
    ry[i] = y - dx * hw;
  }
  g.beginPath();
  g.moveTo(lx[0], ly[0]);
  for (let i = 1; i < n; i++) g.lineTo(lx[i], ly[i]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(rx[i], ry[i]);
  g.closePath();
  g.fill();
}

/** A straight stroke from a to b, sampled so tremor and pressure have something to work on. */
export function line(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, o: StrokeOpts) {
  const n = Math.max(3, Math.ceil(Math.hypot(bx - ax, by - ay) / 2.5));
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) pts.push({ x: ax + ((bx - ax) * i) / n, y: ay + ((by - ay) * i) / n });
  stroke(g, pts, o);
}

/** A wobbly closed blob, for pebbles and dabs: never a perfect circle. */
export function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, squash = 1, lump = 0.3) {
  const n = Math.max(7, Math.round(r * 2.4));
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = r * (1 + lump * sn(Math.cos(a) * 1.3 + seed * 0.37, Math.sin(a) * 1.3, seed));
    const px = x + Math.cos(a) * k;
    const py = y + Math.sin(a) * k * squash;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.closePath();
}

/** A point on a traced contour. `n` faces out of the solid. */
export interface EdgeP extends P {
  nx: number;
  ny: number;
  /** Outside the world, where it fills but never gets ink. */
  hidden: boolean;
}

/**
 * Closed contours around the solid tiles, as loops of tile corners with solid on the right. The grid is
 * extended one ring past the world so regions touching the edge still close.
 */
export function traceCorners(solid: (x: number, y: number) => boolean, w: number, h: number): P[][] {
  const key = (x: number, y: number) => (y + 3) * (w + 8) + x + 3;
  const out = new Map<number, P[]>();
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const k = key(ax, ay);
    const list = out.get(k);
    if (list) list.push({ x: bx, y: by });
    else out.set(k, [{ x: bx, y: by }]);
  };
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (!solid(x, y)) continue;
      const open = (ax: number, ay: number) => ax < -1 || ay < -1 || ax > w || ay > h || !solid(ax, ay);
      if (open(x, y - 1)) add(x, y, x + 1, y);
      if (open(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (open(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (open(x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const loops: P[][] = [];
  // Map order is insertion order here and that is scan order, so tracing is deterministic.
  for (const [start, list] of out) {
    while (list.length) {
      const first = list.pop()!;
      const sx = start % (w + 8);
      const ax = sx - 3;
      const ay = (start - sx) / (w + 8) - 3;
      const loop: P[] = [{ x: ax, y: ay }];
      let px = ax;
      let py = ay;
      let cur = first;
      while (true) {
        loop.push(cur);
        const next = out.get(key(cur.x, cur.y));
        if (!next?.length) break;
        const dx = cur.x - px;
        const dy = cur.y - py;
        // Turn right first: two tiles touching at a corner stay separate shapes.
        let best = 0;
        let rank = -9;
        next.forEach((e, i) => {
          const cross = dx * (e.y - cur.y) - dy * (e.x - cur.x);
          if (cross > rank) {
            rank = cross;
            best = i;
          }
        });
        px = cur.x;
        py = cur.y;
        cur = next.splice(best, 1)[0];
      }
      if (loop[0].x === loop[loop.length - 1].x && loop[0].y === loop[loop.length - 1].y) loop.pop();
      loops.push(simplify(loop));
    }
  }
  return loops;
}

function simplify(loop: P[]): P[] {
  const n = loop.length;
  return loop.filter((p, i) => {
    const a = loop[(i + n - 1) % n];
    const b = loop[(i + 1) % n];
    return (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) !== 0;
  });
}

/**
 * How far the drawn shape may leave the collision shape, in world px. The art must not lie about the
 * hitbox: nothing should block a player where the picture shows air, or hold one up where it shows
 * none. Floors are held tightest because feet are where a pixel shows. Only thin marks (grass, ink
 * lines, a brace) may hang past these, and thin is what lets the eye read them as decoration.
 */
export const FLOOR_DRIFT = 0.5;
export const EDGE_DRIFT = 1.25;
/** Corner radii: a cut corner hides 0.354 r of solid, a filled one shows that much solid that isn't there. */
const OUTER_CORNER = 3;
const INNER_CORNER = 2.5;

export interface LooseOpts {
  tile: number;
  w: number;
  h: number;
  seed: number;
  /** Tile window being traced, when it isn't the whole level: lines along its rim aren't real edges. */
  edge?: { x: number; y: number; w: number; h: number };
}

/**
 * Turn a corner loop into a hand-cut outline: corners get a different radius each, and the edge strays
 * from the grid. Floors stay nearly true, because that's where feet land; walls and ceilings may wander.
 */
export function looseLoop(corners: readonly P[], o: LooseOpts): EdgeP[] {
  const T = o.tile;
  const n = corners.length;
  const raw: { x: number; y: number; tx: number; ty: number; drift: number }[] = [];
  const dir = (from: P, to: P) => ({ x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) });
  const len = (from: P, to: P) => (Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) * T;
  // Radii first: a side is shared, and each end has to know how much the other took.
  const radii = corners.map((p, i) => {
    const a = corners[(i + n - 1) % n];
    const b = corners[(i + 1) % n];
    const inn = dir(a, p);
    const out = dir(p, b);
    const convex = inn.x * out.y - inn.y * out.x > 0;
    const h = hash2(p.x, p.y, o.seed);
    const want = (convex ? OUTER_CORNER : INNER_CORNER) * (0.65 + 0.35 * h);
    return Math.min(len(a, p) / 2, len(p, b) / 2, want);
  });
  for (let i = 0; i < n; i++) {
    const a = corners[(i + n - 1) % n];
    const p = corners[i];
    const b = corners[(i + 1) % n];
    const inn = dir(a, p);
    const out = dir(p, b);
    const r = radii[i];
    const wx = p.x * T;
    const wy = p.y * T;
    for (let k = 0; k <= 5; k++) {
      const u = k / 5;
      const iu = 1 - u;
      raw.push({
        x: iu * iu * (wx - inn.x * r) + 2 * iu * u * wx + u * u * (wx + out.x * r),
        y: iu * iu * (wy - inn.y * r) + 2 * iu * u * wy + u * u * (wy + out.y * r),
        tx: iu * inn.x + u * out.x,
        ty: iu * inn.y + u * out.y,
        // A corner is already off the grid by its radius: drift fades out so the two can't add up.
        drift: Math.abs(u * 2 - 1),
      });
    }
    // Along the side, samples sit on a world grid and not spaced from the corner: a crater that
    // shortens this side must not slide every point along it.
    const horizontal = out.x !== 0;
    const sign = horizontal ? out.x : out.y;
    const c0 = (horizontal ? wx : wy) + sign * r;
    const c1 = (horizontal ? wx : wy) + sign * (len(p, b) - radii[(i + 1) % n]);
    for (let k = sign > 0 ? Math.ceil((c0 + 0.75) / 3) : Math.floor((c0 - 0.75) / 3); sign > 0 ? k * 3 < c1 - 0.75 : k * 3 > c1 + 0.75; k += sign) {
      raw.push(horizontal ? { x: k * 3, y: wy, tx: out.x, ty: 0, drift: 1 } : { x: wx, y: k * 3, tx: 0, ty: out.y, drift: 1 });
    }
  }
  return raw.map((q) => {
    const d = Math.hypot(q.tx, q.ty) || 1;
    const nx = q.ty / d;
    const ny = -q.tx / d;
    // Floors barely move; walls and ceilings wander up to their limit. `wander` peaks at 1.35.
    const limit = ny < -0.5 ? FLOOR_DRIFT : EDGE_DRIFT - 0.25;
    const amp = (limit / 1.35) * q.drift;
    const wander = sn(q.x * 0.05, q.y * 0.05, o.seed) + 0.35 * sn(q.x * 0.17, q.y * 0.17, o.seed + 1);
    return {
      x: q.x + nx * wander * amp,
      y: q.y + ny * wander * amp,
      nx,
      ny,
      hidden:
        q.x <= (o.edge?.x ?? 0) * T + 0.5 ||
        q.y <= (o.edge?.y ?? 0) * T + 0.5 ||
        q.x >= ((o.edge?.x ?? 0) + (o.edge?.w ?? o.w)) * T - 0.5 ||
        q.y >= ((o.edge?.y ?? 0) + (o.edge?.h ?? o.h)) * T - 0.5,
    };
  });
}

/** How much of a surface faces away from the light (upper left): 0 lit, 1 full shadow. */
export const shadeOf = (nx: number, ny: number) => Math.max(0, Math.min(1, 0.5 + 0.62 * (nx * 0.55 + ny * 0.83)));
