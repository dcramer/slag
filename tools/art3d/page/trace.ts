import { BOX, type Settings } from '../settings';

/**
 * The render, cut into paper-puppet parts and traced: the step that makes a 3D figure look inked by
 * the game's own hand. The page renders role, light and depth per pixel; this splits the figure into
 * parts (one material, no depth step inside), folds away any part too small to read at race size,
 * traces each part's outline and the silhouette, and simplifies them into a few clean curves. The game
 * fills and inks those shapes at runtime with the cast's own pen (`toned` and `contour` in
 * src/render/ink-figure.ts), so a rendered kind is drawn by the same hand at any zoom.
 */

export interface Part {
  role: number;
  /** Outline, world px about the feet (y down), as x, y pairs. */
  ring: number[];
  /** Mean depth, for painting back to front. */
  depth: number;
  /** An accessory's part: its slot and option. */
  option?: [number, number];
}

export interface Traced {
  /** The silhouette's outer outlines. */
  sil: number[][];
  /** Parts, back to front. */
  parts: Part[];
  /** The eyes the face is drawn on: x, y, radius (world px) per eye, the near one first. */
  eyes: number[];
  /** The head the eyes ride: its middle, radius (world px) and tilt (radians, clockwise on screen). */
  head?: number[];
  /** Open pen strokes (motion marks), x, y pairs. */
  marks?: number[][];
}

/** The outer boundary of the 8-connected pixel set holding `start`, as pixel centres, clockwise (Moore tracing). */
function boundary(inside: (x: number, y: number) => boolean, sx: number, sy: number): [number, number][] {
  // Neighbours clockwise from west.
  const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
  const DY = [0, -1, -1, -1, 0, 1, 1, 1];
  const out: [number, number][] = [[sx, sy]];
  let x = sx;
  let y = sy;
  // We entered `start` from the west (it's the leftmost pixel of the topmost row).
  let back = 0;
  for (let guard = 0; guard < 200000; guard++) {
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (inside(nx, ny)) {
        // Next search starts from the neighbour just before this one, seen from the new pixel.
        back = (d + 4) % 8;
        x = nx;
        y = ny;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (x === sx && y === sy) break;
    out.push([x, y]);
  }
  return out;
}

/** Douglas–Peucker on a closed ring. */
function simplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 8) return pts;
  // Split the ring at its two farthest points so both halves are open polylines.
  let far = 0;
  let fd = -1;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > fd) {
      fd = d;
      far = i;
    }
  }
  const dp = (a: [number, number][]): [number, number][] => {
    if (a.length < 3) return a;
    const [x0, y0] = a[0];
    const [x1, y1] = a[a.length - 1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    let best = 0;
    let bi = 0;
    for (let i = 1; i < a.length - 1; i++) {
      const d = Math.abs((x1 - x0) * (y0 - a[i][1]) - (x0 - a[i][0]) * (y1 - y0)) / len;
      if (d > best) {
        best = d;
        bi = i;
      }
    }
    if (best <= eps) return [a[0], a[a.length - 1]];
    const l = dp(a.slice(0, bi + 1));
    return [...l.slice(0, -1), ...dp(a.slice(bi))];
  };
  const a = dp(pts.slice(0, far + 1));
  const b = dp([...pts.slice(far), pts[0]]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/** Chaikin corner cutting on a closed ring: hard pixel steps become one confident curve. */
function chaikin(pts: [number, number][], n: number): [number, number][] {
  let p = pts;
  for (let it = 0; it < n; it++) {
    const q: [number, number][] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

/**
 * A closed ring resampled at an even spacing, clockwise, starting from the point furthest up and toward
 * the light. The same shape always gives the same points, wherever the tracer happened to start, so a
 * part that holds still between frames draws the same line, and the pen's boil (keyed to a point's
 * index) moves it the same way.
 */
function resample(pts: [number, number][], step: number): [number, number][] {
  if (pts.length < 3) return pts;
  // Clockwise on screen (y down) means a positive signed area.
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  const ring = a < 0 ? pts.map((_, i) => pts[pts.length - 1 - i]) : pts;
  let cx = 0;
  let cy = 0;
  for (const [x, y] of ring) {
    cx += x;
    cy += y;
  }
  cx /= ring.length;
  cy /= ring.length;
  let start = 0;
  let best = -Infinity;
  ring.forEach(([x, y], i) => {
    const v = -(x - cx) * 0.55 - (y - cy) * 0.83;
    if (v > best) {
      best = v;
      start = i;
    }
  });
  const loop = [...ring.slice(start), ...ring.slice(0, start)];
  let len = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i];
    const q = loop[(i + 1) % loop.length];
    len += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  const n = Math.max(6, Math.round(len / step));
  const out: [number, number][] = [];
  let seg = 0;
  let segStart = 0;
  let segLen = Math.hypot(loop[1 % loop.length][0] - loop[0][0], loop[1 % loop.length][1] - loop[0][1]);
  for (let k = 0; k < n; k++) {
    const d = (k / n) * len;
    while (segStart + segLen < d && seg < loop.length - 1) {
      segStart += segLen;
      seg++;
      const p = loop[seg];
      const q = loop[(seg + 1) % loop.length];
      segLen = Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    const p = loop[seg];
    const q = loop[(seg + 1) % loop.length];
    const u = segLen > 0 ? (d - segStart) / segLen : 0;
    out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
  }
  return out;
}

/** Mean distance from each point of `a` to the nearest point of `b` (flat x, y arrays), after moving `b` by (dx, dy). */
function drift(a: number[], b: number[], dx: number, dy: number): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 2) {
    let best = Infinity;
    for (let j = 0; j < b.length; j += 2) best = Math.min(best, (a[i] - b[j] - dx) ** 2 + (a[i + 1] - b[j + 1] - dy) ** 2);
    sum += Math.sqrt(best);
  }
  return sum / (a.length / 2);
}

/** A ring's mean point. */
export const centreOf = (r: number[]) => {
  let x = 0;
  let y = 0;
  for (let i = 0; i < r.length; i += 2) {
    x += r[i];
    y += r[i + 1];
  }
  return [x / (r.length / 2), y / (r.length / 2)];
};

/**
 * Holds shapes steady across a clip: a part (or a silhouette outline) that is the previous frame's
 * moved bodily, within `tol` world px, is drawn as that one, moved. Only real changes of shape redraw a
 * line; what's left of the wobble is the pen's own boil.
 */
export function steady(prev: Traced, cur: Traced, tol: number): void {
  const keep = (ring: number[], from: number[][]): number[] => {
    const [cx, cy] = centreOf(ring);
    let best: number[] | null = null;
    let bd = Infinity;
    for (const p of from) {
      const [px, py] = centreOf(p);
      const d = Math.hypot(px - cx, py - cy);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (!best || bd > 2) return ring;
    const [px, py] = centreOf(best);
    const dx = cx - px;
    const dy = cy - py;
    if (drift(ring, best, dx, dy) > tol || drift(best, ring, -dx, -dy) > tol) return ring;
    return best.map((v, i) => Math.round((v + (i % 2 ? dy : dx)) * 16) / 16);
  };
  cur.sil = cur.sil.map((r) => keep(r, prev.sil));
  // Eyes that barely moved stay put, so the face doesn't swim.
  if (prev.eyes.length === cur.eyes.length)
    for (let i = 0; i < cur.eyes.length; i += 3)
      if (Math.hypot(cur.eyes[i] - prev.eyes[i], cur.eyes[i + 1] - prev.eyes[i + 1]) < tol * 1.5) {
        cur.eyes[i] = prev.eyes[i];
        cur.eyes[i + 1] = prev.eyes[i + 1];
        cur.eyes[i + 2] = prev.eyes[i + 2];
      }
  for (const p of cur.parts)
    p.ring = keep(
      p.ring,
      prev.parts.filter((q) => q.role === p.role).map((q) => q.ring),
    );
}

const ringArea = (r: [number, number][]) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};

/**
 * Traces one frame. `role` is the role per pixel (-1 empty), `depth` world px from the camera, at `R`
 * pixels per world px over the frame box.
 */
export function trace(role: Int16Array, depth: Float32Array, W: number, H: number, R: number, s: Settings, names: string[]): Traced {
  const n = W * H;
  const t = s.trace!;
  // 1. Clean the roles: a 3×3 majority twice, so a material's border is a line and not a fringe.
  let r = role;
  for (let pass = 0; pass < 2; pass++) {
    const o = new Int16Array(r);
    const count = new Map<number, number>();
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (r[i] < 0) continue;
        count.clear();
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const v = r[i + dy * W + dx];
            if (v >= 0) count.set(v, (count.get(v) ?? 0) + 1);
          }
        let best = r[i];
        let bc = 0;
        for (const [v, c] of count)
          if (c > bc) {
            bc = c;
            best = v;
          }
        o[i] = best;
      }
    r = o;
  }
  // Roles folded into another for drawing (a button into its overalls).
  const fold = names.map((nm, i) => {
    const into = s.roles[nm].into;
    return into ? names.indexOf(into) : i;
  });
  for (let i = 0; i < n; i++) if (r[i] >= 0) r[i] = fold[r[i]];

  // 2. Parts: 4-connected runs of one role with no depth step.
  const part = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < n; i++) {
    if (r[i] < 0 || part[i] >= 0) continue;
    const id = sizes.length;
    part[i] = id;
    stack.push(i);
    let c = 0;
    while (stack.length) {
      const p = stack.pop()!;
      c++;
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q < 0 || q >= n || part[q] >= 0 || r[q] !== r[p] || Math.abs(depth[q] - depth[p]) > s.step) continue;
        part[q] = id;
        stack.push(q);
      }
    }
    sizes.push(c);
  }
  // 3. A part too small to read at race size goes to the neighbour it shares the most border with.
  const minPx = (nm: number) => (s.roles[names[nm]].min ?? t.min) * R * R;
  const roleOfPart = new Int32Array(sizes.length);
  for (let i = 0; i < n; i++) if (part[i] >= 0) roleOfPart[part[i]] = r[i];
  for (let round = 0; round < 3; round++) {
    const border = new Map<number, Map<number, number>>();
    for (let i = 0; i < n; i++) {
      const a = part[i];
      if (a < 0 || sizes[a] >= minPx(roleOfPart[a])) continue;
      const x = i % W;
      for (const q of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (q < 0 || q >= n) continue;
        const b = part[q];
        if (b < 0 || b === a) continue;
        let m = border.get(a);
        if (!m) border.set(a, (m = new Map()));
        m.set(b, (m.get(b) ?? 0) + 1);
      }
    }
    if (!border.size) break;
    const to = new Map<number, number>();
    for (const [a, m] of border) {
      let best = -1;
      let bc = 0;
      for (const [b, c] of m)
        if (c > bc) {
          bc = c;
          best = b;
        }
      if (best >= 0) to.set(a, best);
    }
    for (let i = 0; i < n; i++) {
      const b = to.get(part[i]);
      if (b === undefined) continue;
      const a = part[i];
      part[i] = b;
      sizes[b] += 1;
      sizes[a] -= 1;
    }
  }

  // 4. Trace. A part's outline is traced from its pixels grown by one into the figure, so neighbouring
  // shapes overlap a little instead of leaving a crack once their curves are smoothed.
  const toWorld = (pts: [number, number][]) => pts.map(([x, y]): [number, number] => [(x + 0.5) / R + BOX.x0, (y + 0.5) / R - BOX.y1]);
  // Simplify to the few points that carry the shape, round them into curves, then drop the points the
  // curves made that a line would do as well (a quarter of a sprite pixel).
  const shape = (pts: [number, number][]) => resample(chaikin(simplify(pts, t.eps * R), t.smooth), 0.6 * R);
  const flat = (pts: [number, number][]) => toWorld(pts).flatMap(([x, y]) => [Math.round(x * 16) / 16, Math.round(y * 16) / 16]);
  const parts: Part[] = [];
  const ids = new Map<number, number[]>();
  for (let i = 0; i < n; i++) if (part[i] >= 0) (ids.get(part[i]) ?? ids.set(part[i], []).get(part[i])!).push(i);
  for (const [id, px] of ids) {
    if (px.length < 2) continue;
    const mine = new Uint8Array(n);
    let dz = 0;
    for (const i of px) {
      mine[i] = 1;
      dz += depth[i];
    }
    const grown = new Uint8Array(mine);
    for (const i of px) {
      const x = i % W;
      for (const q of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (q >= 0 && q < n && r[q] >= 0) grown[q] = 1;
    }
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && grown[y * W + x] === 1;
    // Every piece of the part (a part can be pinched in two by smoothing), each traced on its own.
    const seen = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (!grown[i] || seen[i]) continue;
      // Flood this piece to mark it, then trace from its top-left pixel (the first met in raster order).
      const st = [i];
      seen[i] = 1;
      let count = 0;
      while (st.length) {
        const p = st.pop()!;
        count++;
        const x = p % W;
        for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W, p - W - 1, p - W + 1, p + W - 1, p + W + 1])
          if (q >= 0 && q < n && grown[q] && !seen[q]) {
            seen[q] = 1;
            st.push(q);
          }
      }
      if (count < Math.max(4, minPx(roleOfPart[id]) * 0.5)) continue;
      const ring = shape(boundary(inside, i % W, (i / W) | 0));
      if (ring.length < 3 || ringArea(ring) < 2) continue;
      parts.push({ role: roleOfPart[id], ring: flat(ring), depth: dz / px.length });
    }
  }
  parts.sort((a, b) => b.depth - a.depth);

  // 5. The silhouette: every outer outline of the figure.
  const free = names.map((n) => !!s.roles[n].free);
  const fg = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && r[y * W + x] >= 0 && !free[r[y * W + x]];
  const sil: number[][] = [];
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (r[i] < 0 || free[r[i]] || seen[i]) continue;
    const st = [i];
    seen[i] = 1;
    let count = 0;
    while (st.length) {
      const p = st.pop()!;
      count++;
      const x = p % W;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W, p - W - 1, p - W + 1, p + W - 1, p + W + 1])
        if (q >= 0 && q < n && r[q] >= 0 && !free[r[q]] && !seen[q]) {
          seen[q] = 1;
          st.push(q);
        }
    }
    if (count < t.min * R * R) continue;
    sil.push(flat(shape(boundary(fg, i % W, (i / W) | 0))));
  }
  // 6. The eyes, for the face kit: the eye role's two biggest parts in the top two fifths of the figure
  // (an eye, never a boot sole or a glove), the nearer (bigger) first.
  let top = Infinity;
  let bottom = -Infinity;
  for (const ring of sil)
    for (let i = 1; i < ring.length; i += 2) {
      top = Math.min(top, ring[i]);
      bottom = Math.max(bottom, ring[i]);
    }
  const found: { x: number; y: number; r: number; a: number }[] = [];
  for (const p of parts) {
    if (!s.roles[names[p.role]].glint) continue;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i + 1 < p.ring.length; i += 2) {
      x0 = Math.min(x0, p.ring[i]);
      x1 = Math.max(x1, p.ring[i]);
      y0 = Math.min(y0, p.ring[i + 1]);
      y1 = Math.max(y1, p.ring[i + 1]);
    }
    const [b0, b1] = s.roles[names[p.role]].band ?? [0, 0.4];
    const at = ((y0 + y1) / 2 - top) / (bottom - top);
    if (at < b0 || at > b1) continue;
    found.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: Math.max(0.3, Math.min(x1 - x0, y1 - y0) / 2), a: (x1 - x0) * (y1 - y0) });
  }
  const eyes = found
    .sort((a, b) => b.a - a.a)
    .slice(0, 2)
    .flatMap((e) => [e.x, e.y, e.r]);
  return { sil, parts, eyes };
}
