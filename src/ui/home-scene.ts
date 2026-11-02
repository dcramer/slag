import { hash2 } from '../core/rng';
import { blob, line, type P, sn, stroke } from '../render/ink';
import { PAL } from './style';

/**
 * The main menu's foundry, inked like the world (docs/ART.md → World art): a slag heap of cinder
 * and clinker with runs of cooled slag, a crucible hung on its bail from a crane jib, the pour, and the
 * pool it lands in. Flat tones cut with hard edges, hard shadow shapes, and the pen.
 *
 * `buildScene` lays it out for a canvas size; what holds still is painted once into layers
 * (`paintCrane`, `paintHeap`), and only what moves is drawn each frame (`drawStream`, `drawSplash`).
 * The runners stand on `foot`, the heap's drawn top. Sizes are in world px times `s`, the runners' scale.
 */

const ROCK = { gap: '#140d0a', shade: '#241913', base: '#382a21', light: '#544033', warm: '#7a3818', ink: '#0e0806' };
const STEEL = { shade: '#262019', base: '#433932', light: '#5e5048', ink: '#0e0a08' };
const CRUST = { base: '#2c211b', light: '#43332a' };
const MELT = { deep: '#c2340f', mid: PAL.molten, hot: PAL.amber, white: PAL.whiteHot };

interface Rock {
  pts: P[];
  /** 0 far from the pour, 1 beside it. */
  heat: number;
  /** Its center's height, for drawing order. */
  y: number;
}

export interface Scene {
  W: number;
  H: number;
  s: number;
  /** The heap's drawn top at x: where a runner's feet go. */
  foot: (x: number) => number;
  /** That top, sampled left to right; and the crest's x, where the lit side turns to the shadow side. */
  surface: P[];
  crest: number;
  /** Where the runners stand, left to right. */
  runX: number[];
  /** Clinker chunks bedded in the heap, back to front. */
  chunks: Rock[];
  /** Fine cinder marks near the top. */
  cinder: { x: number; y: number; r: number; light: boolean }[];
  /** Tongues of solidified slag down the slope: the outline, ropy ridges across them, and the spine. */
  runs: { outline: P[]; ropes: P[][]; spine: P[] }[];
  /** Glowing seams in the cooling slag, and how hot each is. */
  cracks: { pts: P[]; heat: number }[];
  /** The crane: jib height and bottom, the trolley, the crucible's pivot and tilt, and its scale. */
  jibY: number;
  jibH: number;
  pin: P;
  tilt: number;
  g: number;
  /** The pour leaves the lip and lands in the pool. */
  lip: P;
  pool: { x: number; y: number; rx: number; ry: number };
  impact: P;
}

/** The crucible in its own units (pivot at 0,0, y down, untilted), times the scene's `g`. */
/** A bulging bucket: from the rim's underside round the belly and the rounded bottom, clockwise. */
const bucket = (): P[] => {
  const right: P[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const y = -12.5 + t * 25;
    right.push({ x: 13.2 + 1.2 * Math.sin(t * Math.PI * 0.9) - 4.2 * t * t, y: y + 2 * Math.max(0, t - 0.75) * 4 });
  }
  const bottom: P[] = [];
  for (let i = 1; i < 6; i++) bottom.push({ x: 9 - (18 * i) / 6, y: 14.6 + 1.3 * Math.sin((Math.PI * i) / 6) });
  const left = right.map((_, i) => ({ x: -right[right.length - 1 - i].x, y: right[right.length - 1 - i].y }));
  return [...right, ...bottom, ...left];
};

const CRUCIBLE = {
  body: bucket(),
  rim: [
    { x: -15.5, y: -18 },
    { x: 15.5, y: -18 },
    { x: 15, y: -12 },
    { x: -15, y: -12 },
  ],
  lip: [
    { x: -23.5, y: -21 },
    { x: -14, y: -18 },
    { x: -14, y: -12.5 },
    { x: -23.8, y: -18.6 },
  ],
  lipTip: { x: -23.8, y: -19.6 },
  bands: [-1.5, 8],
};
const TILT = -0.42;

const rot = (p: P, a: number, o: P, k: number): P => ({
  x: o.x + (p.x * Math.cos(a) - p.y * Math.sin(a)) * k,
  y: o.y + (p.x * Math.sin(a) + p.y * Math.cos(a)) * k,
});

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Lay the foundry out for a W×H canvas, from a per-visit seed so a resize keeps the same heap. */
export function buildScene(W: number, H: number, seed: number): Scene {
  const s = Math.max(2.2, Math.min(4, H / 95));
  const g = Math.min(s, 2.9);
  const r = (i: number, j: number) => hash2(i, j, seed);

  // The crucible hangs at the right, clear of the edge, and pours left into a pool on the heap's shoulder.
  const pin = { x: W - 16 * g, y: 0 };
  const jibY = Math.max(3 * g, H * 0.035);
  const jibH = 4.5 * g;
  pin.y = Math.max(jibY + jibH + 3.5 * g + 4 * g + 29.4 * g, H * 0.3);
  const lip = rot(CRUCIBLE.lipTip, TILT, pin, g);
  const rx = 10 * g;
  const ry = 2.8 * g;
  const impactX = lip.x - 4 * g;
  const poolX = impactX + rx * 0.2;

  // The mound: low and wide, a long gentle toe on the left and a shorter fall on the right, its crest
  // softened by a few broad lumps. A terrace on the right shoulder holds the pool.
  const crest = 0.44 + (r(1, 1) - 0.5) * 0.06;
  const peak = 0.34 + r(1, 2) * 0.04;
  const lumps = Array.from({ length: 5 }, (_, i) => ({ c: 0.12 + i * 0.19 + (r(i, 3) - 0.5) * 0.08, w: 0.05 + r(i, 4) * 0.06, a: (r(i, 5) - 0.4) * 0.09 }));
  const height = (x: number) => {
    const u = Math.min(1, Math.max(0, x / W));
    let h = u < crest ? Math.pow(Math.sin((Math.PI / 2) * (u / crest)), 1.25) : Math.pow(Math.cos((Math.PI / 2) * ((u - crest) / (1 - crest + 0.18))), 1.15);
    for (const l of lumps) h += l.a * Math.exp(-(((u - l.c) / l.w) ** 2)) * Math.min(1, h * 3);
    return Math.max(0, h);
  };
  const mound = (x: number) => H - height(x) * peak * H;
  const terrace = mound(poolX) + ry;
  const profile = (x: number) => {
    const k = 1 - smooth(rx * 1.15, rx * 1.9, Math.abs(x - poolX));
    // Cinder grit: the line is never quite smooth.
    return mound(x) * (1 - k) + terrace * k + (sn(x / (2.2 * s), 1.7, seed) * 0.35 + sn(x / (7 * s), 4.1, seed) * 0.6) * s;
  };
  const pool = { x: poolX, y: terrace - ry * 0.4, rx, ry };

  // The surface line, sampled: the pen draws it and the runners stand on it.
  const surface: P[] = [];
  for (let x = 0; x <= W + 3; x += 3) surface.push({ x, y: profile(x) });
  const foot = (fx: number) => {
    const j = Math.max(0, Math.min(surface.length - 2, fx / 3));
    const i = Math.floor(j);
    return surface[i].y + (surface[i + 1].y - surface[i].y) * (j - i);
  };

  // Runners: evenly along the crest, from where the toe has risen to clear of the pool.
  let x0 = 0;
  while (x0 < W * 0.3 && height(x0) < 0.36) x0 += 2;
  x0 = Math.max(x0, 8 * s);
  const runMax = Math.max(x0 + W * 0.3, poolX - rx - 3 * g - 7 * s);
  const runX = Array.from({ length: 6 }, (_, i) => x0 + ((runMax - x0) * i) / 5);

  // Chunks, big to small: clinker boulders bedded at the base and the toe, a few medium ones in the body.
  const chunks: Rock[] = [];
  const rock = (cx: number, cy: number, rad: number, k: number) => {
    const n = 6 + Math.floor(r(k, 1) * 3);
    const turn = r(k, 2) * Math.PI * 2;
    const squash = 0.55 + r(k, 3) * 0.2;
    const pts: P[] = [];
    for (let i = 0; i < n; i++) {
      const a = turn + ((i + (r(k, 10 + i) - 0.5) * 0.7) / n) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * rad * (0.82 + r(k, 20 + i) * 0.26), y: cy + Math.sin(a) * rad * squash * (0.82 + r(k, 30 + i) * 0.26) });
    }
    chunks.push({ pts, heat: Math.max(0, 1 - Math.hypot(cx - poolX, cy - pool.y) / (W * 0.3)), y: cy });
  };
  [0.03, 0.17, 0.4, 0.66, 0.95].forEach((u, i) => {
    const x = (u + (r(i, 40) - 0.5) * 0.05) * W;
    const rad = (9 + r(i, 41) * 5) * s;
    // The toe's boulder breaks the line; the rest are bedded deep, shown only where the base fades.
    const cy = u < 0.1 ? profile(x) + rad * 0.25 : Math.max(profile(x) + rad * 1.3, H - rad * 0.2);
    rock(x, cy, rad, 50 + i);
  });
  for (let i = 0; i < 9; i++) {
    const x = (0.08 + 0.84 * ((i + r(i, 42) * 0.8) / 9)) * W;
    const depth = (11 + r(i, 43) * 16) * s;
    const y = profile(x) + depth;
    if (y > H * 0.97 || Math.abs(x - poolX) < rx * 1.2) continue;
    rock(x, y, (3.2 + r(i, 44) * 3) * s, 80 + i);
  }
  chunks.sort((a, b) => a.y - b.y);

  // Fine cinder near the top, thinning with depth: sparse marks on a continuous body.
  const cinder: Scene['cinder'] = [];
  for (let i = 0; i < Math.round(W / (1.7 * s)); i++) {
    const x = r(i, 50) * W;
    const d = Math.pow(r(i, 51), 1.8) * 22 * s + 1.6 * s;
    if (profile(x) + d > H || Math.abs(x - poolX) < rx * 1.25) continue;
    cinder.push({ x, y: profile(x) + d, r: (0.35 + r(i, 52) * 0.75 * (1 - d / (26 * s))) * s, light: r(i, 53) < 0.4 });
  }

  // Slag runs: sheets of cooled slag poured over the pool's lip, lying on the slope and running down it,
  // thickening as they go, with drips hanging off their lower edge and ropy wrinkles across them.
  const runs: Scene['runs'] = [];
  const sheet = (from: number, to: number, th0: number, k: number) => {
    const N = 28;
    const dir = Math.sign(to - from);
    const xs = Array.from({ length: N + 1 }, (_, i) => from + ((to - from) * i) / N);
    const drips = [0.35, 0.62, 0.86].map((t, j) => ({ t: t + (r(k, 80 + j) - 0.5) * 0.08, d: (4 + r(k, 84 + j) * 5) * s, w: (1.8 + r(k, 88 + j)) * s }));
    const thick = (i: number) => {
      const t = i / N;
      const end = Math.sqrt(Math.max(0, 1 - Math.pow(t, 6)));
      let d = (th0 + 7 * t) * s * (1 + 0.25 * sn(i * 0.5, k + 9, seed)) * end;
      for (const dr of drips) d += dr.d * Math.exp(-(((xs[i] - (from + (to - from) * dr.t)) / dr.w) ** 2)) * end;
      return d;
    };
    const top = xs.map((x) => ({ x, y: profile(x) - 0.3 * s }));
    const bottom = xs.map((x, i) => ({ x, y: profile(x) + thick(i) }));
    const outline = clockwise([...top, ...bottom.map((_, i) => bottom[N - i])]);
    // Wrinkles: short arcs across the sheet, bowed downslope.
    const ropes: P[][] = [];
    for (let i = 3; i < N - 3; i += 3 + Math.floor(r(k * 40 + i, 70) * 3)) {
      const th = thick(i);
      const x = xs[i];
      const y = profile(x);
      const bow = (0.5 + r(k * 40 + i, 71) * 0.6) * th;
      ropes.push([
        { x: x - dir * 0.1 * th, y: y + th * 0.22 },
        { x: x + dir * bow, y: y + th * 0.5 },
        { x: x - dir * 0.1 * th, y: y + th * 0.8 },
      ]);
    }
    const spine = xs.map((x, i) => ({ x, y: profile(x) + thick(i) * 0.45 }));
    runs.push({ outline, ropes, spine });
  };
  sheet(poolX - rx * 0.9, Math.max(poolX - rx - W * 0.14, 0), 3.5, 3);
  sheet(poolX + rx * 0.9, W - 2 * s, 3, 7);

  // Still-glowing seams near the pour: down the hot top of each run, and a few in the crust by the pool.
  const cracks: Scene['cracks'] = [];
  runs.forEach((run, k) => {
    const pts = run.spine.slice(1, 9).map((p, i) => ({ x: p.x + sn(i * 0.9, k + 20, seed) * 1.2 * s, y: p.y }));
    cracks.push({ pts, heat: 1 - k * 0.3 });
  });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.15 + (i / 3) * 0.7) + (r(i, 60) - 0.5) * 0.3;
    const x = poolX + Math.cos(a) * (rx + 2.6 * g);
    const y = pool.y + Math.sin(a) * (ry + 1.6 * g);
    cracks.push({
      pts: [
        { x, y },
        { x: x + (r(i, 61) - 0.5) * 4 * s, y: y + (1.5 + r(i, 62) * 2) * s },
        { x: x + (r(i, 63) - 0.5) * 6 * s, y: y + (3 + r(i, 64) * 3) * s },
      ],
      heat: 0.6,
    });
  }

  return {
    W,
    H,
    s,
    foot,
    surface,
    crest: crest * W,
    runX,
    chunks,
    cinder,
    runs,
    cracks,
    jibY,
    jibH,
    pin,
    tilt: TILT,
    g,
    lip,
    pool,
    impact: { x: impactX, y: pool.y },
  };
}

/** A loop's points in clockwise order on screen (y down), as the pen and the cel shading expect. */
function clockwise(pts: P[]): P[] {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area >= 0 ? pts : pts.map((_, i) => pts[pts.length - 1 - i]);
}

const facing = (a: P, b: P) => {
  // Outward normal of a clockwise edge (y down) is (dy, -dx); how it faces the light, -1 toward to 1 away.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  return (dy / d) * 0.55 + (-dx / d) * 0.83;
};

const poly = (c: CanvasRenderingContext2D, pts: readonly P[], dx = 0, dy = 0) => {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x + dx, p.y + dy) : c.moveTo(p.x + dx, p.y + dy)));
  c.closePath();
};

/**
 * A shape in cel tones: base, a lit crescent along the edges facing the light, a shadow crescent along
 * the ones turned away (each the shape minus itself, shifted), then pen strokes edge by edge, thin
 * toward the light and heavy away, some lifting at the corners.
 */
function celShape(
  c: CanvasRenderingContext2D,
  pts: readonly P[],
  T: { base: string; light: string; shade: string; ink: string },
  k: number,
  seed: number,
  warm?: { col: string; dx: number; dy: number },
) {
  poly(c, pts);
  c.fillStyle = T.base;
  c.fill();
  c.save();
  poly(c, pts);
  c.clip();
  // Shadow: everything the shape covers once shifted toward the light is lit; the rest isn't.
  c.beginPath();
  c.rect(-1e4, -1e4, 2e4, 2e4);
  pts.forEach((p, i) => (i ? c.lineTo(p.x - 2 * k, p.y - 2.6 * k) : c.moveTo(p.x - 2 * k, p.y - 2.6 * k)));
  c.closePath();
  c.fillStyle = T.shade;
  c.fill('evenodd');
  c.beginPath();
  c.rect(-1e4, -1e4, 2e4, 2e4);
  pts.forEach((p, i) => (i ? c.lineTo(p.x + 1.7 * k, p.y + 2.3 * k) : c.moveTo(p.x + 1.7 * k, p.y + 2.3 * k)));
  c.closePath();
  c.fillStyle = T.light;
  c.fill('evenodd');
  if (warm) {
    c.beginPath();
    c.rect(-1e4, -1e4, 2e4, 2e4);
    pts.forEach((p, i) => (i ? c.lineTo(p.x - warm.dx, p.y - warm.dy) : c.moveTo(p.x - warm.dx, p.y - warm.dy)));
    c.closePath();
    c.fillStyle = warm.col;
    c.fill('evenodd');
  }
  c.restore();
  c.fillStyle = T.ink;
  // Pen strokes edge by edge; short edges (a curve) join into one stroke. Each overshoots a little or stops
  // short, so the corners stay drawn, not stamped.
  const n = pts.length;
  let run: P[] = [pts[0]];
  let away = 0;
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    away += Math.max(0, Math.min(1, 0.5 + 0.62 * facing(a, b))) * d;
    len += d;
    run.push(b);
    const turn = i + 2 <= n ? Math.abs(facing(a, b) - facing(b, pts[(i + 2) % n])) : 1;
    if (i === n - 1 || d > 6 * k || len > 16 * k || turn > 0.5) {
      const o = (hash2(seed, i, 5) - 0.4) * 0.12;
      const p0 = run[0];
      const p1 = run[1];
      const q0 = run[run.length - 1];
      const q1 = run[run.length - 2];
      run[0] = { x: p0.x + (p0.x - p1.x) * o, y: p0.y + (p0.y - p1.y) * o };
      run[run.length - 1] = { x: q0.x + (q0.x - q1.x) * o, y: q0.y + (q0.y - q1.y) * o };
      const pen = run.length > 2 ? run : sample(run[0], run[1]);
      stroke(c, pen, { w: k * (0.45 + (1.25 * away) / (len || 1)), seed: seed * 13 + i, taper: [0.12, 0.2], press: 0.35, wobble: 0.12 * k });
      run = [b];
      away = 0;
      len = 0;
    }
  }
}

/** A straight edge as enough points for the pen's tremor and pressure to work on. */
function sample(a: P, b: P): P[] {
  const n = Math.max(3, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2.5));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
}

/** Fade a layer out toward the bottom, so the canvas has no visible edge. */
function fadeBottom(c: CanvasRenderingContext2D, W: number, H: number, from: number) {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  const fade = c.createLinearGradient(0, from, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = fade;
  c.fillRect(0, from, W, H - from);
  c.restore();
}

/**
 * The heap: one continuous body in flat tones (a lit band under the crest, a shadow shape down the far
 * side), hatching off that side, clinker chunks bedded in it, fine cinder near the top, slag runs from
 * the pool with ropy ridges, the pen along its top, glowing seams near the pour, and the pool. Static.
 */
export function paintHeap(c: CanvasRenderingContext2D, S: Scene) {
  const { W, H, s, pool, surface } = S;
  const n = surface.length;
  const body = () => {
    c.beginPath();
    c.moveTo(-2, H + 2);
    for (const p of surface) c.lineTo(p.x, p.y);
    c.lineTo(W + 2, H + 2);
    c.closePath();
  };
  // How each stretch of the top faces the light: -1 toward it, 1 away.
  const face = (i: number) => facing(surface[Math.max(0, i - 2)], surface[Math.min(n - 1, i + 2)]);

  body();
  c.fillStyle = ROCK.base;
  c.fill();
  c.save();
  body();
  c.clip();
  // The lit band: thick where the top faces the light, gone where it turns away, its lower edge cut by hand.
  c.fillStyle = ROCK.light;
  c.beginPath();
  surface.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  for (let i = n - 1; i >= 0; i--) {
    const k = Math.max(0, Math.min(1, -face(i) * 1.4 - 0.2)) * (3.2 + 1.6 * sn(i * 0.12, 2.3, 11)) * s;
    c.lineTo(surface[i].x, surface[i].y + k);
  }
  c.closePath();
  c.fill();
  // The shadow shape: everything past a hand-drawn line from just over the crest down to the base.
  const cx = S.crest + 5 * s;
  const cy = S.foot(cx);
  c.fillStyle = ROCK.shade;
  c.beginPath();
  c.moveTo(cx, cy - 4 * s);
  for (let i = 1; i <= 14; i++) {
    const t = i / 14;
    c.lineTo(cx + W * 0.1 * t * t + sn(t * 4, 5, 3) * 2.5 * s, cy + (H - cy) * t);
  }
  c.lineTo(W + 2, H + 2);
  c.lineTo(W + 2, cy - 4 * s);
  c.closePath();
  c.fill();
  // Hatching off the far side's top, fading into the fill.
  c.fillStyle = ROCK.gap;
  for (let i = 3; i < n - 3; i += 3) {
    const p = surface[i];
    if (p.x < cx || hash2(i, 3, 17) < 0.3) continue;
    const len = (4 + 7 * hash2(i, 4, 17)) * s;
    line(c, p.x, p.y + 0.8 * s, p.x - 0.45 * len, p.y + 0.8 * s + 0.9 * len, { w: 0.55 * s, seed: i, taper: [0.02, 0.85], wobble: 0.3 });
  }
  // Fine cinder: a mark and a glint, sparse.
  for (const [i, k] of S.cinder.entries()) {
    c.fillStyle = ROCK.gap;
    blob(c, k.x + 0.2 * s, k.y + 0.25 * s, k.r * 1.1, i, 0.75, 0.35);
    c.fill();
    if (k.light) {
      c.fillStyle = ROCK.light;
      blob(c, k.x - 0.15 * k.r, k.y - 0.2 * k.r, k.r * 0.6, i + 7, 0.75, 0.3);
      c.fill();
    }
  }
  // Slag runs: glassy dark sheets, lit along their top, with ropy ridges catching the light.
  const RUN = { base: '#2a1610', light: '#6a4128', shade: '#170c08', ink: ROCK.ink };
  for (const [i, run] of S.runs.entries()) {
    celShape(c, run.outline, RUN, s * 0.9, 700 + i);
    c.fillStyle = RUN.light;
    for (const [j, rope] of run.ropes.entries()) {
      const [a, m, b] = rope;
      const pts: P[] = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        pts.push({ x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * m.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * m.y + t * t * b.y });
      }
      stroke(c, pts, { w: 0.45 * s, seed: 800 + j, taper: [0.3, 0.3], press: 0.4 });
    }
  }
  c.restore();

  // Clinker chunks, bedded; the toe's breaks the line.
  for (const [i, rk] of S.chunks.entries()) {
    const warm = rk.heat > 0.5 ? { col: ROCK.warm, dx: Math.sign(pool.x - rk.pts[0].x) * 1.6 * s, dy: 0.6 * s } : undefined;
    celShape(c, rk.pts, ROCK, s, 300 + i, warm);
  }

  // The pen along the top: overlapping strokes with an occasional lift, thin toward the light, heavy away.
  c.fillStyle = ROCK.ink;
  for (let a = 0, k = 0; a < n - 1; k++) {
    const b = Math.min(n - 1, a + 10 + Math.floor(hash2(k, 1, 23) * 12));
    let away = 0;
    for (let i = a; i <= b; i++) away += Math.max(0, Math.min(1, 0.5 + 0.62 * face(i)));
    away /= b - a + 1;
    stroke(c, surface.slice(a, b + 1), { w: s * (0.7 + 1.6 * away), seed: 31 + k, taper: [0.12, 0.18], press: 0.35, wobble: 0.2 * s });
    if (b >= n - 1) break;
    a = b - (hash2(k, 2, 23) < 0.3 ? -1 : 1);
  }

  // Cooling cracks glow: they're hot.
  c.save();
  c.shadowColor = PAL.molten;
  c.shadowBlur = 2.2 * s;
  for (const [i, k] of S.cracks.entries()) {
    c.fillStyle = `rgba(255,${110 + Math.round(70 * k.heat)},40,${(0.5 + 0.35 * k.heat).toFixed(2)})`;
    stroke(c, k.pts, { w: (0.5 + 0.5 * k.heat) * s, seed: 500 + i, taper: [0.25, 0.4], wobble: 0.2 * s });
  }
  c.restore();

  // The pool: a jagged crust of cooled slag round it, then the melt in flat bands, hottest where the pour lands.
  const ring = (k: number, seed: number, jag: number) => {
    const pts: P[] = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const j = 1 + (hash2(i, seed, 9) - 0.5) * jag;
      pts.push({ x: pool.x + Math.cos(a) * (pool.rx + k) * j, y: pool.y + Math.sin(a) * (pool.ry + k * 0.55) * j });
    }
    return pts;
  };
  celShape(c, ring(3.2 * S.g, 1, 0.16), { ...CRUST, shade: ROCK.shade, ink: ROCK.ink }, S.g, 900);
  const melt = ring(0, 2, 0.08);
  poly(c, melt);
  c.fillStyle = MELT.deep;
  c.fill();
  c.save();
  poly(c, melt);
  c.clip();
  const ix = S.impact.x;
  c.fillStyle = MELT.mid;
  c.beginPath();
  c.ellipse(ix + pool.rx * 0.08, pool.y + pool.ry * 0.25, pool.rx * 0.82, pool.ry * 0.85, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = MELT.hot;
  blob(c, ix, pool.y + pool.ry * 0.1, pool.rx * 0.42, 3, 0.32, 0.18);
  c.fill();
  c.restore();
  c.fillStyle = ROCK.ink;
  stroke(c, melt.slice(14).concat(melt[0]), { w: 1.1 * S.g, seed: 77, taper: [0.15, 0.15], press: 0.4 });
  fadeBottom(c, W, H, H * 0.9);
}

/** The crane: a jib in from the right edge, a trolley, chain, hook and bail, and the crucible on its pivot. Static. */
export function paintCrane(c: CanvasRenderingContext2D, S: Scene) {
  const { W, g, pin, jibY, jibH } = S;
  // The jib: an I-beam, flanges lit on top, rivets, fading into the dark past the canvas edge.
  const x0 = pin.x - 9 * g;
  celShape(
    c,
    [
      { x: x0, y: jibY },
      { x: W + 4, y: jibY },
      { x: W + 4, y: jibY + jibH },
      { x: x0, y: jibY + jibH },
    ],
    STEEL,
    g,
    11,
  );
  c.fillStyle = STEEL.shade;
  c.fillRect(x0 + 0.8 * g, jibY + 1.3 * g, W - x0, jibH - 2.6 * g);
  c.fillStyle = STEEL.ink;
  line(c, x0 + g, jibY + 1.3 * g, W, jibY + 1.3 * g, { w: 0.5 * g, seed: 12, taper: [0.05, 0] });
  c.fillStyle = STEEL.light;
  for (let x = x0 + 3 * g; x < W; x += 5 * g) {
    blob(c, x, jibY + jibH * 0.5, 0.55 * g, x, 1, 0.2);
    c.fill();
  }
  c.save();
  c.globalCompositeOperation = 'destination-out';
  const fade = c.createLinearGradient(W - 7 * g, 0, W, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  c.fillStyle = fade;
  c.fillRect(W - 7 * g, jibY - g, 7 * g, jibH + 2 * g);
  c.restore();

  // Trolley: a carriage under the beam on two wheels.
  const ty = jibY + jibH;
  celShape(
    c,
    [
      { x: pin.x - 4 * g, y: ty },
      { x: pin.x + 4 * g, y: ty },
      { x: pin.x + 3.2 * g, y: ty + 3.5 * g },
      { x: pin.x - 3.2 * g, y: ty + 3.5 * g },
    ],
    STEEL,
    g,
    13,
  );
  for (const wx of [-2.4, 2.4]) {
    c.fillStyle = STEEL.ink;
    blob(c, pin.x + wx * g, ty - 0.2 * g, 1.5 * g, wx * 10, 1, 0.1);
    c.fill();
    c.fillStyle = STEEL.light;
    blob(c, pin.x + wx * g - 0.2 * g, ty - 0.4 * g, 0.7 * g, wx * 10 + 1, 1, 0.1);
    c.fill();
  }

  // The crucible: bucket, belly bands with rivets, the pour lip, and the rim, with the melt showing over it.
  const at = (pts: readonly P[]) => pts.map((p) => rot(p, TILT, pin, g));
  celShape(c, at(CRUCIBLE.body), STEEL, g, 41);
  for (const [i, by] of CRUCIBLE.bands.entries()) {
    const hw = 13.6 - Math.max(0, by) * 0.25;
    const band = at([
      { x: -hw, y: by - 1.6 },
      { x: hw, y: by - 1.6 },
      { x: hw - 0.3, y: by + 1.6 },
      { x: -hw + 0.3, y: by + 1.6 },
    ]);
    celShape(c, band, STEEL, g * 0.8, 42 + i);
    c.fillStyle = STEEL.light;
    for (const bx of [-0.6, 0, 0.6]) {
      const p = rot({ x: bx * hw, y: by }, TILT, pin, g);
      blob(c, p.x, p.y, 0.55 * g, bx * 10 + i, 1, 0.2);
      c.fill();
    }
  }
  celShape(c, at(CRUCIBLE.lip), STEEL, g, 46);
  celShape(c, at(CRUCIBLE.rim), STEEL, g, 47);
  // The melt sits level in the tipped crucible: a sliver over the low side of the rim, running out along the lip.
  poly(
    c,
    at([
      { x: -14.5, y: -18 },
      { x: 4, y: -18 },
      { x: -14.5, y: -19.6 },
    ]),
  );
  c.fillStyle = MELT.mid;
  c.fill();
  poly(
    c,
    at([
      { x: -23.6, y: -20.8 },
      { x: -14, y: -18 },
      { x: -14.5, y: -19.4 },
      { x: -23.2, y: -21.6 },
    ]),
  );
  c.fillStyle = MELT.hot;
  c.fill();

  // Hanging gear: chain links from the trolley, a hook, and the bail: a boss (its crossbar, end on) with a bar down to the pivot.
  const boss = { x: pin.x, y: pin.y - 25 * g };
  const hookTop = boss.y - 4.4 * g;
  const c0 = ty + 3.5 * g;
  const links = Math.max(1, Math.round((hookTop - c0) / (3.4 * g)));
  const step = (hookTop - c0) / links;
  const bar = (ax: number, ay: number, bx: number, by: number, w: number, col: string, seed: number) => {
    c.fillStyle = STEEL.ink;
    line(c, ax, ay, bx, by, { w: w + 0.9 * g, seed, taper: [0, 0], press: 0.15 });
    c.fillStyle = col;
    line(c, ax - 0.15 * g, ay, bx - 0.15 * g, by, { w, seed: seed + 1, taper: [0.08, 0.08], press: 0.1 });
  };
  for (let i = 0; i < links; i++) {
    const y = c0 + step * (i + 0.5);
    if (i % 2) bar(pin.x, y - step * 0.62, pin.x, y + step * 0.62, 0.8 * g, STEEL.shade, 20 + i);
    else {
      c.fillStyle = STEEL.ink;
      c.beginPath();
      c.ellipse(pin.x, y, 1.9 * g, step * 0.66, 0, 0, Math.PI * 2);
      c.ellipse(pin.x, y, 0.7 * g, step * 0.3, 0, 0, Math.PI * 2, true);
      c.fill();
      c.fillStyle = STEEL.base;
      c.beginPath();
      c.ellipse(pin.x - 0.1 * g, y - 0.1 * g, 1.35 * g, step * 0.56, 0, 0, Math.PI * 2);
      c.ellipse(pin.x, y, 0.95 * g, step * 0.38, 0, 0, Math.PI * 2, true);
      c.fill();
      c.fillStyle = STEEL.light;
      c.fillRect(pin.x - 1.25 * g, y - step * 0.3, 0.45 * g, step * 0.45);
    }
  }
  bar(pin.x, boss.y, pin.x, pin.y, 1.6 * g, STEEL.base, 51);
  c.fillStyle = STEEL.ink;
  blob(c, boss.x, boss.y, 2.1 * g, 52, 1, 0.08);
  c.fill();
  c.fillStyle = STEEL.base;
  blob(c, boss.x - 0.15 * g, boss.y - 0.15 * g, 1.4 * g, 53, 1, 0.08);
  c.fill();
  // The hook: down the boss's right, round under it, tip up on the left.
  const hook: P[] = [{ x: boss.x + 2.9 * g, y: hookTop }];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 1.15;
    hook.push({ x: boss.x + Math.cos(a) * 2.9 * g, y: boss.y + 0.3 * g + Math.sin(a) * 2.9 * g });
  }
  c.fillStyle = STEEL.ink;
  stroke(c, hook, { w: 2.6 * g, seed: 31, taper: [0, 0.3], press: 0.15 });
  c.fillStyle = STEEL.light;
  stroke(c, hook, { w: 1.3 * g, seed: 32, taper: [0, 0.4], press: 0.15 });
  bar(pin.x, hookTop - 0.6 * g, pin.x + 2.9 * g, hookTop, 1.2 * g, STEEL.base, 33);

  // The pivot: the tilting wheel, its spokes and the boss on the pin.
  for (let i = 0; i < 4; i++) {
    const a = TILT + (i * Math.PI) / 2;
    c.fillStyle = STEEL.ink;
    line(c, pin.x, pin.y, pin.x + Math.cos(a) * 5.3 * g, pin.y + Math.sin(a) * 5.3 * g, { w: 1 * g, seed: 60 + i, taper: [0, 0.1] });
  }
  c.fillStyle = STEEL.ink;
  c.beginPath();
  c.ellipse(pin.x, pin.y, 6.2 * g, 6.2 * g, 0, 0, Math.PI * 2);
  c.ellipse(pin.x, pin.y, 4.6 * g, 4.6 * g, 0, 0, Math.PI * 2, true);
  c.fill('evenodd');
  c.fillStyle = STEEL.light;
  c.beginPath();
  c.ellipse(pin.x - 0.15 * g, pin.y - 0.15 * g, 5.7 * g, 5.7 * g, 0, Math.PI * 0.95, Math.PI * 1.7);
  c.ellipse(pin.x - 0.15 * g, pin.y - 0.15 * g, 5.1 * g, 5.1 * g, 0, Math.PI * 1.7, Math.PI * 0.95, true);
  c.fill();
  c.fillStyle = STEEL.ink;
  blob(c, pin.x, pin.y, 2.6 * g, 64, 1, 0.08);
  c.fill();
  c.fillStyle = STEEL.base;
  blob(c, pin.x - 0.2 * g, pin.y - 0.2 * g, 1.9 * g, 65, 1, 0.08);
  c.fill();
  c.fillStyle = STEEL.light;
  blob(c, pin.x - 0.7 * g, pin.y - 0.7 * g, 0.7 * g, 66, 1, 0.1);
  c.fill();
}

/** The pour: a thick stream off the lip that necks and wobbles, in hot bands. Drawn every frame, under the crane so the lip covers its top. */
export function drawStream(c: CanvasRenderingContext2D, S: Scene, t: number, still: boolean) {
  const { g, lip, impact } = S;
  const top = lip.y - 1.2 * g;
  const len = impact.y - top;
  if (len <= 0) return;
  const tt = still ? 0 : t;
  const N = 28;
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const y = top + len * u;
    const drift = -4 * g * (1 - Math.exp(-u * 5));
    const sway = Math.sin(u * 9 - tt * 5) * 0.5 * g * u;
    // Wide off the lip, necking as it falls, with glugs travelling down it.
    const w = g * (4.6 + 3 * Math.exp(-u * 7) + 0.6 * Math.sin(u * 16 - tt * 11) * Math.min(1, u * 4) + 1.6 * smooth(0.9, 1, u));
    const x = lip.x + 0.6 * g + drift + sway;
    left.push({ x: x - w / 2, y });
    right.push({ x: x + w / 2, y });
  }
  const band = (k0: number, k1: number, col: string) => {
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const x = left[i].x + (right[i].x - left[i].x) * k0;
      if (i) c.lineTo(x, left[i].y);
      else c.moveTo(x, left[i].y);
    }
    for (let i = N; i >= 0; i--) c.lineTo(left[i].x + (right[i].x - left[i].x) * k1, left[i].y);
    c.closePath();
    c.fillStyle = col;
    c.fill();
  };
  c.save();
  c.shadowColor = 'rgba(255,120,30,0.85)';
  c.shadowBlur = 6 * g;
  band(0, 1, MELT.deep);
  c.restore();
  band(0, 0.78, MELT.mid);
  band(0.08, 0.5, MELT.hot);
  band(0.16, 0.3, MELT.white);
}

/** Where the pour lands: a glow over the pool, the splash, and bubbles that swell and pop in the melt. Drawn every frame. */
export function drawSplash(c: CanvasRenderingContext2D, S: Scene, t: number, still: boolean) {
  const { g, impact, pool } = S;
  const tt = still ? 0 : t;
  c.save();
  c.globalCompositeOperation = 'lighter';
  const glow = c.createRadialGradient(impact.x, pool.y, 0, impact.x, pool.y, pool.rx * 1.3);
  glow.addColorStop(0, 'rgba(255,150,50,0.35)');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  c.fillStyle = glow;
  c.fillRect(impact.x - pool.rx * 1.4, pool.y - pool.rx * 1.4, pool.rx * 2.8, pool.rx * 2.8);
  c.restore();
  for (let i = 0; i < 5; i++) {
    const ph = (tt * 2.2 + i * 0.37) % 1;
    const dir = i % 2 ? 1 : -1;
    const x = impact.x + dir * (1.5 + i) * g * ph;
    const y = impact.y - Math.sin(ph * Math.PI) * (2.5 + (i % 3)) * g;
    c.fillStyle = i % 2 ? MELT.hot : MELT.mid;
    blob(c, x, y, (1 - ph * 0.6) * 0.9 * g, i, 1, 0.2);
    c.fill();
  }
  c.fillStyle = MELT.white;
  blob(c, impact.x, impact.y + 0.2 * g, 2.4 * g, 9, 0.45, 0.25);
  c.fill();

  // Bubbles.
  for (let i = 0; i < 5; i++) {
    const period = 1.6 + hash2(i, 1, 3) * 1.4;
    const ph = still ? 0.5 : ((tt + hash2(i, 2, 3) * 5) / period) % 1;
    const bx = pool.x + (hash2(i, 3, 3) - 0.5) * pool.rx * 1.5;
    const by = pool.y + (hash2(i, 4, 3) - 0.5) * pool.ry * 0.9;
    if (Math.abs(bx - impact.x) < 2.5 * g) continue;
    const r = ph < 0.85 ? ph * 1.3 * g : 1.3 * g;
    c.fillStyle = MELT.deep;
    if (ph < 0.85) {
      blob(c, bx, by, r * 1.25, i + 20, 0.7, 0.15);
      c.fill();
      c.fillStyle = MELT.hot;
      blob(c, bx - r * 0.2, by - r * 0.15, r * 0.8, i + 21, 0.7, 0.15);
      c.fill();
    } else {
      line(c, bx - r * 1.6, by, bx + r * 1.6, by, { w: 0.5 * g, seed: i, taper: [0.4, 0.4] });
    }
  }
}
