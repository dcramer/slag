import { hash2 } from '../core/rng';
import { blob, line, type P, stroke } from '../render/ink';
import { PAL } from './style';

/**
 * The main menu's foundry, inked like the world (docs/ART.md → World art): a slag heap built from
 * chunky broken rocks and cinder, a crucible hung on its bail from a crane jib, the pour, and the
 * pool it lands in. Flat tones cut with hard edges, one shadow shape per rock, and the pen.
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
  /** Where the runners stand, left to right. */
  runX: number[];
  rocks: Rock[];
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

/** Lay the foundry out for a W×H canvas, from a per-visit seed so a resize keeps the same rocks. */
export function buildScene(W: number, H: number, seed: number): Scene {
  const s = Math.max(2.2, Math.min(4.6, H / 95));
  const g = Math.min(s, 3.4);
  const r = (i: number, j: number) => hash2(i, j, seed);

  // The crucible hangs at the right, clear of the edge, and pours left into a pool on the heap's shoulder.
  const pin = { x: W - 18 * g, y: 0 };
  const jibY = Math.max(3 * g, H * 0.035);
  const jibH = 4.5 * g;
  pin.y = Math.max(jibY + jibH + 3.5 * g + 4 * g + 29.4 * g, H * 0.3);
  const lip = rot(CRUCIBLE.lipTip, TILT, pin, g);
  const rx = 10 * g;
  const ry = 2.8 * g;
  const impactX = lip.x - 4 * g;
  const poolX = impactX + rx * 0.2;

  // The heap: a mound with a few lumps, and a terrace on its right shoulder where the pool sits.
  const bumps = Array.from({ length: 6 }, (_, i) => ({ c: i / 5 + (r(i, 1) - 0.5) * 0.1, w: 0.08 + r(i, 2) * 0.08, h: 0.2 + r(i, 3) * 0.35 }));
  const mound = (x: number) => {
    const u = Math.min(1, Math.max(0, x / W));
    const m = Math.sin(Math.PI * Math.pow(u, 0.9));
    let y = 0.5 * Math.pow(m, 0.42);
    for (const b of bumps) y += b.h * 0.16 * Math.exp(-(((u - b.c) / b.w) ** 2)) * m;
    return H - Math.min(0.62, y) * H * 0.62;
  };
  const terrace = mound(poolX) + ry;
  const profile = (x: number) => {
    const k = 1 - smooth(rx * 1.15, rx * 1.9, Math.abs(x - poolX));
    return mound(x) * (1 - k) + terrace * k;
  };
  const pool = { x: poolX, y: terrace - ry * 0.4, rx, ry };

  // Runners stand left of the pool, spread evenly.
  const poolLeft = poolX - rx - 3 * g;
  const runMax = Math.max(W * 0.45, poolLeft - 5 * s);
  const runX = Array.from({ length: 6 }, (_, i) => W * 0.1 + ((runMax - W * 0.1) * i) / 5);

  // Rocks: a skin of boulders whose upper halves make the silhouette (one under each runner's feet),
  // then a jittered pack of smaller ones filling the body. Top first, so lower rocks sit in front.
  const rocks: Rock[] = [];
  const rock = (cx: number, cy: number, rad: number, k: number) => {
    const n = 5 + Math.floor(r(k, 1) * 3);
    const turn = r(k, 2) * Math.PI * 2;
    const squash = 0.6 + r(k, 3) * 0.22;
    const pts: P[] = [];
    for (let i = 0; i < n; i++) {
      const a = turn + ((i + (r(k, 10 + i) - 0.5) * 0.8) / n) * Math.PI * 2;
      const rr = rad * (0.8 + r(k, 20 + i) * 0.3);
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * squash });
    }
    const heat = Math.max(0, 1 - Math.hypot(cx - poolX, cy - pool.y) / (W * 0.3));
    rocks.push({ pts, heat, y: cy });
  };
  const skin: { x: number; rad: number }[] = runX.map((x, i) => ({ x, rad: (8 + r(i, 30) * 2) * s }));
  for (let x = -3 * s, k = 0; x < W + 6 * s; k++) {
    const rad = (6 + r(k, 31) * 5) * s;
    if (skin.every((o) => Math.abs(o.x - x) > (o.rad + rad) * 0.72)) skin.push({ x, rad });
    x += rad * (0.9 + r(k, 32) * 0.5);
  }
  skin.forEach((o, i) => rock(o.x, profile(o.x) + o.rad * 0.22, o.rad, 100 + i));
  for (let row = 0, k = 0; row < 12; row++) {
    for (let x = -4 * s + (row % 2) * 6 * s; x < W + 6 * s; x += 12 * s, k++) {
      const cx = x + (r(k, 40) - 0.5) * 6 * s;
      const cy = profile(cx) + (10 + row * 9) * s + (r(k, 41) - 0.5) * 4 * s;
      const rad = (5 + r(k, 42) * 4.5) * s;
      if (cy - rad * 0.5 < H) rock(cx, cy, rad, 500 + k);
    }
  }
  rocks.sort((a, b) => a.y - b.y);

  // The heap's drawn top, sampled every 2px: what a runner stands on.
  const env = new Float32Array(Math.ceil(W / 2) + 2).fill(Infinity);
  for (const rk of rocks) {
    const n = rk.pts.length;
    for (let i = 0; i < n; i++) {
      const a = rk.pts[i];
      const b = rk.pts[(i + 1) % n];
      const lo = Math.max(0, Math.ceil(Math.min(a.x, b.x) / 2));
      const hi = Math.min(env.length - 1, Math.floor(Math.max(a.x, b.x) / 2));
      for (let j = lo; j <= hi; j++) {
        const u = (j * 2 - a.x) / (b.x - a.x || 1);
        env[j] = Math.min(env[j], a.y + (b.y - a.y) * u);
      }
    }
  }
  const foot = (fx: number) => {
    const j = Math.max(0, Math.min(env.length - 2, fx / 2));
    const i = Math.floor(j);
    const y0 = env[i];
    const y1 = env[i + 1];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) return profile(fx);
    return y0 + (y1 - y0) * (j - i);
  };

  // Cooling cracks: more of them, and hotter, toward the pour.
  const cracks: Scene['cracks'] = [];
  rocks.forEach((rk, i) => {
    if (r(i, 20) > 0.12 + rk.heat * 0.7) return;
    const n = rk.pts.length;
    const e = Math.floor(r(i, 21) * n);
    const a = rk.pts[e];
    const b = rk.pts[(e + 1) % n];
    const t0 = 0.3 + r(i, 22) * 0.4;
    let p = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
    const c = rk.pts.reduce((m, q) => ({ x: m.x + q.x / n, y: m.y + q.y / n }), { x: 0, y: 0 });
    const pts = [p];
    for (let k = 1; k <= 3; k++) {
      const f = k / 3.6;
      p = { x: p.x + (c.x - p.x) * f + (r(i, 23 + k) - 0.5) * 5 * s, y: p.y + (c.y - p.y) * f + (r(i, 27 + k) - 0.5) * 3 * s };
      pts.push(p);
    }
    cracks.push({ pts, heat: 0.4 + rk.heat * 0.6 });
  });

  return { W, H, s, foot, runX, rocks, cracks, jibY, jibH, pin, tilt: TILT, g, lip, pool, impact: { x: impactX, y: pool.y } };
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

/** The heap: the dark between the rocks, the rocks, cinder in the seams, and the pool's crust and melt. Static. */
export function paintHeap(c: CanvasRenderingContext2D, S: Scene) {
  const { W, H, s, pool } = S;
  // The dark the rocks sit in, just under their tops, so seams read as notches in the silhouette.
  c.fillStyle = ROCK.gap;
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) c.lineTo(x, S.foot(x) + 1.4 * s);
  c.lineTo(W, H);
  c.closePath();
  c.fill();
  S.rocks.forEach((rk, i) => {
    const warm = rk.heat > 0.45 ? { col: ROCK.warm, dx: Math.sign(pool.x - rk.pts[0].x) * 1.6 * s, dy: 0.6 * s } : undefined;
    celShape(c, rk.pts, ROCK, s, 300 + i, warm);
  });
  // Cinder: a few loose clinkers on the rocks and in the seams.
  for (let i = 0; i < S.rocks.length * 2; i++) {
    const rk = S.rocks[i % S.rocks.length];
    const a = rk.pts[1 + (i % 3)];
    const x = a.x + (hash2(i, 41, 7) - 0.5) * 6 * s;
    const y = S.foot(x) + (hash2(i, 42, 7) * 1.4 - 0.2) * s;
    if (i % 2 && y > H * 0.94) continue;
    const rr = (0.5 + hash2(i, 43, 7) * 0.8) * s;
    c.fillStyle = ROCK.ink;
    blob(c, x + 0.25 * s, y + 0.3 * s, rr * 1.15, i, 0.8, 0.35);
    c.fill();
    c.fillStyle = hash2(i, 44, 7) < 0.5 ? ROCK.light : ROCK.shade;
    blob(c, x, y, rr, i + 5, 0.8, 0.35);
    c.fill();
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
  fadeBottom(c, W, H, H * 0.84);
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
