import { hash2 } from '../core/rng';
import { FONT, PAL } from '../ui/style';
import { blob, line, type P, shadeOf, sn, stroke } from './ink';

/**
 * HUD building blocks in the foundry style (docs/ART.md), inked the way the world is: plates cut by
 * hand instead of traced with an even line, flat tones, a hard ink shadow straight down, and a tapered
 * pen round the shapes that matter (plates, buttons, tags, the timer dial). Canvas2D, view coords.
 *
 * The HUD redraws every frame, so anything still is baked once per size and screen resolution
 * (`baked`) and stamped on whole device px; only what moves (a timer's arc, scrolling tape, text) is
 * drawn live. Text is never baked: fonts arrive late, and a bake made before them would keep the
 * fallback face forever.
 */

type Ctx = CanvasRenderingContext2D;

/**
 * Display order for anything that lists scores: most points first, ties by
 * slot so rows never swap on an equal score. Always a sorted copy, because
 * player order is sim state and has to stay in slot order for determinism.
 */
export function standings<T extends { slot: number }>(players: readonly T[], points: (p: T) => number): T[] {
  return [...players].sort((a, b) => points(b) - points(a) || a.slot - b.slot);
}

// ---------------------------------------------------------------------------------------------------
// The cut and the pen

/** A seed from a shape's size, so the same plate is cut the same way every frame and every session. */
const sizeSeed = (w: number, h: number) => Math.floor(hash2(Math.round(w * 4), Math.round(h * 4), 913) * 9973);

/**
 * A plate's outline cut by hand: every corner its own radius, every side bowed a touch and wandering a
 * fraction of a px, sampled every few px so the pen has something to swell and taper along. Clockwise
 * from the top-left corner. The wander stays under a px, so a row of plates still reads as a row.
 */
export function cutPts(x: number, y: number, w: number, h: number, r: number, seed: number): P[] {
  const pts: P[] = [];
  const rad = [0, 1, 2, 3].map((k) => Math.max(0.6, Math.min(w / 2, h / 2, r * (0.5 + 0.7 * hash2(k, 7, seed)))));
  const cs = [
    { cx: x, cy: y, a: Math.PI, dx: 1, dy: 0, len: w },
    { cx: x + w, cy: y, a: -Math.PI / 2, dx: 0, dy: 1, len: h },
    { cx: x + w, cy: y + h, a: 0, dx: -1, dy: 0, len: w },
    { cx: x, cy: y + h, a: Math.PI / 2, dx: 0, dy: -1, len: h },
  ];
  for (let k = 0; k < 4; k++) {
    const c = cs[k];
    const rr = rad[k];
    const ox = c.cx + (k === 0 || k === 3 ? rr : -rr);
    const oy = c.cy + (k < 2 ? rr : -rr);
    for (let i = 0; i <= 3; i++) {
      const a = c.a + (i / 3) * (Math.PI / 2);
      pts.push({ x: ox + Math.cos(a) * rr, y: oy + Math.sin(a) * rr });
    }
    // The side to the next corner, bowed out (or in) and wandering, along its outward normal.
    const a0 = rr;
    const run = c.len - rad[(k + 1) % 4] - a0;
    const n = Math.max(1, Math.round(run / 6));
    const bow = Math.min(0.8, run * 0.01) * sn(k * 1.9, 0.7, seed);
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const along = a0 + run * u;
      const off = bow * Math.sin(u * Math.PI) + 0.3 * sn(along * 0.12, k * 3.1, seed);
      pts.push({ x: c.cx + c.dx * along + c.dy * off, y: c.cy + c.dy * along - c.dx * off });
    }
  }
  return pts;
}

/** A disc cut by hand: never a compass circle. */
export function discPts(cx: number, cy: number, r: number, seed: number): P[] {
  const n = Math.max(16, Math.round(r * 2));
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = r * (1 + 0.035 * sn(Math.cos(a) * 1.5 + seed * 0.3, Math.sin(a) * 1.5, seed));
    pts.push({ x: cx + Math.cos(a) * k, y: cy + Math.sin(a) * k });
  }
  return pts;
}

function path(g: Ctx, pts: readonly P[]) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i) g.lineTo(pts[i].x, pts[i].y);
    else g.moveTo(pts[i].x, pts[i].y);
  }
  g.closePath();
}

/**
 * The pen round a closed clockwise shape, in the current fillStyle: a few tapered strokes that overlap
 * at their thin ends, thin where the edge faces the light (upper left) and heaviest away from it.
 */
function penLoop(g: Ctx, pts: readonly P[], seed: number, thin: number, thick: number) {
  const n = pts.length;
  let per = 0;
  for (let i = 0; i < n; i++) per += Math.hypot(pts[(i + 1) % n].x - pts[i].x, pts[(i + 1) % n].y - pts[i].y);
  const pieces = Math.max(4, Math.min(10, Math.round(per / 80)));
  const span = Math.ceil(n / pieces);
  const lead = Math.floor(n * 0.08);
  for (let k = 0; k < pieces; k++) {
    const part: P[] = [];
    for (let i = 0; i <= span + 1; i++) part.push(pts[(lead + k * span + i) % n]);
    const a = part[0];
    const b = part[part.length - 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Outward normal of a clockwise loop (screen space): the tangent turned left.
    const sh = shadeOf((b.y - a.y) / d, -(b.x - a.x) / d);
    stroke(g, part, { w: thin + (thick - thin) * sh, seed: seed + k * 13, taper: [0.1, 0.14], press: 0.35 });
  }
}
// ---------------------------------------------------------------------------------------------------
// Bakes

interface Bake {
  c: HTMLCanvasElement;
  /** Device px from the bitmap's corner to the shape's origin. */
  ox: number;
  oy: number;
  px: number;
}

const bakes = new Map<string, Bake>();
/** Pixel budget for every bake together: a resize or a phone's scale groups add new sizes, and the oldest go. */
const BAKE_PX = 12_000_000;
let bakePx = 0;

/**
 * Stamp still art drawn once by `art` in shape-local px (the shape's origin at 0, 0, reaching `pad`
 * past its w × h box), baked at the current transform's resolution and placed on whole device px so it
 * stays as crisp as if drawn live. `key` must name everything `art` reads.
 */
function baked(c: Ctx, key: string, x: number, y: number, w: number, h: number, pad: number, art: (g: Ctx) => void) {
  // Tests draw through a mock context with no DOM to bake in: draw it live.
  if (typeof document === 'undefined') {
    c.save();
    c.translate(x, y);
    art(c);
    c.restore();
    return;
  }
  const m = c.getTransform();
  const res = Math.round(Math.hypot(m.a, m.b) * 100) / 100;
  const k = `${key}@${res}`;
  let b = bakes.get(k);
  if (b) {
    // Most recently used goes to the back of the line.
    bakes.delete(k);
    bakes.set(k, b);
  } else {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil((w + pad * 2) * res));
    cv.height = Math.max(1, Math.ceil((h + pad * 2) * res));
    const g = cv.getContext('2d')!;
    g.setTransform(res, 0, 0, res, pad * res, pad * res);
    g.lineJoin = 'round';
    art(g);
    b = { c: cv, ox: pad * res, oy: pad * res, px: cv.width * cv.height };
    bakePx += b.px;
    while (bakePx > BAKE_PX && bakes.size) {
      const [old, ob] = bakes.entries().next().value!;
      bakes.delete(old);
      bakePx -= ob.px;
    }
    bakes.set(k, b);
  }
  const dx = Math.round(m.a * x + m.c * y + m.e - b.ox);
  const dy = Math.round(m.b * x + m.d * y + m.f - b.oy);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(b.c, dx, dy);
  c.restore();
}

const paths = new Map<string, Path2D>();
/** A cut outline as a reusable Path2D (shape-local), for live clips and fills that follow a baked edge. */
function cutPath(w: number, h: number, r: number, seed: number): Path2D {
  const k = `${w}|${h}|${r}|${seed}`;
  let p = paths.get(k);
  if (!p) {
    if (paths.size > 400) paths.clear();
    p = new Path2D();
    const pts = cutPts(0, 0, w, h, r, seed);
    pts.forEach((q, i) => (i ? p!.lineTo(q.x, q.y) : p!.moveTo(q.x, q.y)));
    p.closePath();
    paths.set(k, p);
  }
  return p;
}
// ---------------------------------------------------------------------------------------------------
// Plates

export interface PlateOpts {
  /** Main fill (default iron). */
  fill?: string;
  /** Accent strip across the top (player / role color). */
  edge?: string;
  /** Accent strip down the left side (a race chip's player color). */
  side?: string;
  /** State ring inside the edge (ready, picked, hovered). */
  stroke?: string;
  /** Hard drop shadow depth (default 2). */
  drop?: number;
  radius?: number;
  rivets?: boolean;
  /** Overall alpha. */
  alpha?: number;
  /** Which hand cut it: plates of one size side by side look cut one by one. */
  seed?: number;
}

/** Thin and thick ends of the pen round a plate, in logical px (before the pen's weight, `PEN` in ink.ts). */
const PEN_THIN = 0.6;
const PEN_THICK = 1.45;
/** The rim's ink and the hard shadow's: the UI's ink, let off a little so a plate's edge is drawn and not cut out. */
const RIM = 'rgba(18,11,8,0.82)';
const DROP = 'rgba(18,11,8,0.62)';

/** A riveted iron plate: cut by hand, two flat tones, a hard ink shadow straight down and a pen round it. */
export function plate(c: Ctx, x: number, y: number, w: number, h: number, o: PlateOpts = {}) {
  const r = o.radius ?? 4;
  const drop = o.drop ?? 2;
  const fill = o.fill ?? PAL.iron;
  const seed = o.seed ?? sizeSeed(w, h);
  const rivets = o.rivets !== false && w > 30 && h > 24;
  const key = `p|${w}|${h}|${r}|${drop}|${fill}|${o.edge ?? ''}|${o.side ?? ''}|${o.stroke ?? ''}|${rivets ? 1 : 0}|${seed}`;
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  baked(c, key, x, y, w, h, drop + 3, (g) => {
    const pts = cutPts(0, 0, w, h, r, seed);
    if (drop) {
      g.fillStyle = DROP;
      g.save();
      g.translate(0.5, drop);
      path(g, pts);
      g.fill();
      g.restore();
    }
    // Two flat tones: a lit rim where the plate faces the light (upper left), the face pushed down-right
    // over it. Iron is too dark for a shadow tone to show, so the light is the one that's cut.
    g.fillStyle = shade(fill, 0.14);
    path(g, pts);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = fill;
    g.translate(1.6, 1.9);
    path(g, pts);
    g.fill();
    g.translate(-1.6, -1.9);
    if (o.edge) {
      g.fillStyle = o.edge;
      g.fillRect(0, 0, w, 4.5);
      g.fillStyle = 'rgba(18,11,8,0.6)';
      line(g, 0, 4.9, w, 4.9, { w: 1.3, seed: seed + 5, taper: [0.04, 0.08], press: 0.3 });
    }
    if (o.side) {
      g.fillStyle = o.side;
      g.fillRect(0, 0, 3.5, h);
    }
    g.restore();
    g.fillStyle = RIM;
    penLoop(g, pts, seed, PEN_THIN, PEN_THICK);
    if (o.stroke) {
      g.fillStyle = o.stroke;
      penLoop(g, cutPts(2, 2, w - 4, h - 4, Math.max(1, r - 1), seed), seed + 31, 1.1, 1.6);
    }
    if (rivets) {
      const top = o.edge ? 8.5 : 4.8;
      const at = [
        [4.8, top],
        [w - 4.8, top],
        [4.8, h - 4.8],
        [w - 4.8, h - 4.8],
      ];
      at.forEach(([rx, ry], i) => {
        g.fillStyle = PAL.ink;
        blob(g, rx + 0.3, ry + 0.4, 1.5, seed + i, 1, 0.12);
        g.fill();
        g.fillStyle = PAL.steel;
        blob(g, rx - 0.15, ry - 0.15, 0.95, seed + i + 4, 1, 0.1);
        g.fill();
      });
    }
  });
  c.restore();
}

/** Recessed, empty bay (open lobby slot). */
export function bay(c: Ctx, x: number, y: number, w: number, h: number, hot: boolean, t: number) {
  const seed = sizeSeed(w, h) + 3;
  baked(c, `bay|${w}|${h}|${hot ? 1 : 0}`, x, y, w, h, 3, (g) => {
    const pts = cutPts(0, 0, w, h, 4, seed);
    g.fillStyle = hot ? 'rgba(46,30,22,0.92)' : 'rgba(22,14,11,0.82)';
    path(g, pts);
    g.fill();
    // The lip's hard shadow across the top of the recess: one flat shape, its lower edge cut by hand.
    g.save();
    g.clip();
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath();
    g.moveTo(-1, -1);
    g.lineTo(w + 1, -1);
    for (let i = 0; i <= 12; i++) {
      const u = 1 - i / 12;
      g.lineTo(u * w, 7 + 1.2 * sn(u * 6, 1.3, seed) - 2 * u);
    }
    g.lineTo(-1, 9);
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = RIM;
    penLoop(g, pts, seed, PEN_THIN + 0.3, PEN_THICK);
  });
  // Live: the slow hazard tape and the dashed cut line, clipped to the same edge.
  c.save();
  c.translate(x, y);
  const edge = cutPath(w, h, 4, seed);
  c.save();
  c.clip(edge);
  hazardTape(c, 0, h - 7, w, 7, hot ? 0.9 : 0.35, t * (hot ? 14 : 5));
  c.restore();
  c.setLineDash([5, 4]);
  c.lineDashOffset = -t * (hot ? 12 : 0);
  c.strokeStyle = hot ? PAL.molten : 'rgba(155,138,120,0.45)';
  c.lineWidth = 1.2;
  c.translate(4, 4);
  c.stroke(cutPath(w - 8, h - 15, 3, seed + 1));
  c.setLineDash([]);
  c.restore();
}

/** Black/yellow hazard tape, optionally scrolling. */
export function hazardTape(c: Ctx, x: number, y: number, w: number, h: number, a = 1, scroll = 0) {
  c.save();
  c.globalAlpha *= a;
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = '#17110c';
  c.fillRect(x, y, w, h);
  c.fillStyle = PAL.hazard;
  const step = h * 1.6;
  const off = ((scroll % step) + step) % step;
  for (let i = -h - step; i < w + h; i += step) {
    const sx = x + i + off;
    c.beginPath();
    c.moveTo(sx, y + h);
    c.lineTo(sx + step / 2, y + h);
    c.lineTo(sx + step / 2 + h, y);
    c.lineTo(sx + h, y);
    c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------------------------------------------
// Buttons and tags

export type ButtonStyle = 'primary' | 'secondary' | 'ready' | 'ghost' | 'danger';

const BTN: Record<ButtonStyle, { top: string; hot: string; side: string; text: string }> = {
  primary: { top: '#ff8a2a', hot: '#ffa04f', side: '#a8320c', text: PAL.ink },
  secondary: { top: '#4a3a31', hot: '#5d4a3e', side: '#1e1511', text: PAL.bone },
  ready: { top: '#a6e22e', hot: '#b5e852', side: '#4b7410', text: PAL.ink },
  ghost: { top: 'rgba(43,32,27,0.85)', hot: '#5d4a3e', side: 'rgba(14,9,7,0.85)', text: PAL.bone },
  danger: { top: '#6a2216', hot: '#84301f', side: '#2c0c06', text: PAL.bone },
};

/**
 * A stamped toy button: a top face over a darker side, which sinks when hovered, cut by hand and
 * inked. Hover adds an amber pen ring. Returns the vertical offset applied (for drawing content on it).
 */
export function stampButton(c: Ctx, x: number, y: number, w: number, h: number, style: ButtonStyle, hover: boolean): number {
  const depth = 3;
  const sink = hover ? 1.5 : 0;
  baked(c, `b|${w}|${h}|${style}|${hover ? 1 : 0}`, x, y, w, h + depth, 6, (g) => {
    const s = BTN[style];
    const r = Math.min(5, h / 3);
    const seed = sizeSeed(w, h) + 11;
    const body = cutPts(0, 0, w, h + depth, r, seed);
    g.fillStyle = s.side;
    path(g, body);
    g.fill();
    g.fillStyle = hover ? s.hot : s.top;
    path(g, cutPts(0, sink, w, h, r, seed));
    g.fill();
    g.fillStyle = 'rgba(255,240,220,0.3)';
    line(g, r + 0.5, sink + 1.6, Math.max(r + 2, w * 0.55), sink + 1.6, { w: 1.1, seed: seed + 2, taper: [0.1, 0.7], press: 0.2 });
    g.fillStyle = RIM;
    penLoop(g, body, seed, 0.6, 1.35);
    if (hover) {
      g.fillStyle = PAL.amber;
      penLoop(g, cutPts(-2.6, -2.6, w + 5.2, h + depth + 5.2, r + 2, seed + 1), seed + 40, 0.9, 1.5);
    }
  });
  return sink;
}

/** The pen ring a hovered button wears, round any box: what the menus put round the control that's selected. */
export function ring(c: Ctx, x: number, y: number, w: number, h: number, color: string = PAL.amber) {
  baked(c, `rg|${w}|${h}|${color}`, x, y, w, h, 6, (g) => {
    const seed = sizeSeed(w, h) + 43;
    g.fillStyle = color;
    penLoop(g, cutPts(-2.6, -2.6, w + 5.2, h + 5.2, Math.min(7, h / 3) + 2, seed), seed, 0.9, 1.5);
  });
}

export function buttonText(style: ButtonStyle): string {
  return BTN[style].text;
}

/** A small stamped label shape (tags, cursor names): cut by hand, inked, a hard shadow under it. */
export function pill(c: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  baked(c, `t|${w}|${h}|${fill}`, x, y, w, h, 3, (g) => {
    const seed = sizeSeed(w, h) + 17;
    const pts = cutPts(0, 0, w, h, 2.2, seed);
    g.fillStyle = DROP;
    g.save();
    g.translate(0.4, 1.3);
    path(g, pts);
    g.fill();
    g.restore();
    g.fillStyle = fill;
    path(g, pts);
    g.fill();
    g.fillStyle = RIM;
    penLoop(g, pts, seed, 0.55, 1.0);
  });
}

/**
 * A brick of points (score lanes): a hand-cut block in two flat tones, `lit` across its top where it
 * faces the light, a hard shadow under it and the pen round it.
 */
export function brick(c: Ctx, x: number, y: number, w: number, h: number, fill: string, lit: string) {
  baked(c, `bk|${w}|${h}|${fill}|${lit}`, x, y, w, h, 3, (g) => {
    const seed = sizeSeed(w, h) + 19;
    const pts = cutPts(0, 0, w, h, Math.min(2.4, h / 3), seed);
    g.fillStyle = DROP;
    g.save();
    g.translate(0.4, 1.4);
    path(g, pts);
    g.fill();
    g.restore();
    g.fillStyle = fill;
    path(g, pts);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = lit;
    g.beginPath();
    g.moveTo(-1, -1);
    g.lineTo(w + 1, -1);
    for (let i = 0; i <= 6; i++) {
      const u = 1 - i / 6;
      g.lineTo(u * w, h * 0.38 + 0.4 * sn(u * 5, 2.1, seed));
    }
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = RIM;
    penLoop(g, pts, seed, 0.55, 1.0);
  });
}

/** Small stamped uppercase tag (roles, status). Returns its width. */
export function tag(
  c: Ctx,
  label: string,
  x: number,
  cy: number,
  fill: string,
  ink: string = PAL.ink,
  size = 8,
  align: 'left' | 'center' | 'right' = 'left',
): number {
  c.font = `800 ${size}px ${FONT.ui}`;
  // Whole half px, so a width that wobbles with font loading doesn't bake a new tag every frame.
  const w = Math.ceil((c.measureText(label).width + size * 1.1) * 2) / 2;
  const h = size + 4;
  const x0 = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
  pill(c, x0, cy - h / 2, w, h, fill);
  c.fillStyle = ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, x0 + w / 2, cy + 0.5);
  return w;
}

// ---------------------------------------------------------------------------------------------------
// Dials and bars

/** A round iron dial (the phase timer's face): a cut disc, a hard ink shadow and a pen round it. */
export function dial(c: Ctx, cx: number, cy: number, r: number) {
  baked(c, `d|${r}`, cx - r, cy - r, r * 2, r * 2, 4, (g) => {
    const pts = discPts(r, r, r, 23);
    g.fillStyle = DROP;
    g.save();
    g.translate(0.3, 2);
    path(g, pts);
    g.fill();
    g.restore();
    g.fillStyle = shade(PAL.iron, -0.3);
    path(g, pts);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = PAL.iron;
    g.translate(-0.9, -1.1);
    path(g, pts);
    g.fill();
    g.restore();
    g.fillStyle = RIM;
    penLoop(g, pts, 23, 0.65, 1.5);
  });
}

/** A pen stroke along an arc from angle a0 to a1 (radians, clockwise): a timer's progress. */
export function arcStroke(c: Ctx, cx: number, cy: number, r: number, a0: number, a1: number, w: number, seed = 5) {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r * 0.5));
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  stroke(c, pts, { w, seed, taper: [0.04, 0.12], press: 0.25 });
}

/**
 * A recessed bar track (score bars): soot in a hand-cut ink rim. `fill` paints what's in it, clipped
 * to the track, in track-local px.
 */
export function track(c: Ctx, x: number, y: number, w: number, h: number, fill?: (c: Ctx) => void) {
  const seed = sizeSeed(w, h) + 29;
  const r = Math.min(3, h / 3);
  baked(c, `tr|${w}|${h}`, x, y, w, h, 3, (g) => {
    const pts = cutPts(0, 0, w, h, r, seed);
    g.fillStyle = PAL.soot;
    path(g, pts);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(0, 0, w, Math.min(3, h / 3));
  });
  if (fill) {
    c.save();
    c.translate(x, y);
    c.clip(cutPath(w, h, r, seed));
    fill(c);
    c.restore();
  }
  // The rim goes over the fill, so a bar never draws past its track's edge.
  baked(c, `trp|${w}|${h}`, x, y, w, h, 3, (g) => {
    g.fillStyle = RIM;
    penLoop(g, cutPts(0, 0, w, h, r, seed), seed, 0.6, 1.1);
  });
}

/**
 * A live shape in the plate style, for HUD art that moves (a flag in the wind): a hard ink shadow
 * `drop` px down, one flat fill and the pen round it. `pts` run clockwise. Drawn every frame, so keep
 * it to a few small shapes; anything still belongs in a bake.
 */
export function inkShape(c: Ctx, pts: readonly P[], fill: string, seed: number, drop = 1.5) {
  if (drop) {
    c.save();
    c.translate(0.4, drop);
    c.fillStyle = DROP;
    path(c, pts);
    c.fill();
    c.restore();
  }
  c.fillStyle = fill;
  path(c, pts);
  c.fill();
  c.fillStyle = RIM;
  penLoop(c, pts, seed, PEN_THIN * 0.8, PEN_THICK * 0.7);
}

/**
 * A chequered finish line, `w` wide and `h` tall: two rows of flat ink and bone checks between a
 * pen down each side, a hard shadow to the right. Baked: it holds still while rows race up to it.
 */
export function finishLine(c: Ctx, x: number, y: number, w: number, h: number) {
  baked(c, `fl|${w}|${h}`, x, y, w, h, 4, (g) => {
    const cell = w / 2;
    g.fillStyle = PAL.ink;
    g.fillRect(1.5, 1.5, w, h);
    for (let i = 0; i * cell < h; i++) {
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? PAL.ink : PAL.bone;
        g.fillRect(j * cell, i * cell, cell, Math.min(cell, h - i * cell));
      }
    }
    g.fillStyle = PAL.ink;
    line(g, 0, -0.5, 0, h + 0.5, { w: 1, seed: 61, taper: [0.06, 0.1], press: 0.3 });
    line(g, w, -0.5, w, h + 0.5, { w: 1.8, seed: 67, taper: [0.06, 0.1], press: 0.3 });
  });
}

/** A player's color as a swatch you can pick up: a disc in an ink rim, lit along its top. Beside a name, it says the color is yours to change. */
export function swatchDot(c: Ctx, cx: number, cy: number, r: number, fill: string, hover: boolean) {
  c.fillStyle = PAL.ink;
  c.beginPath();
  c.arc(cx, cy + 0.8, r + 1.4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = fill;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = hover ? PAL.amber : 'rgba(255,245,225,0.45)';
  c.lineWidth = hover ? 1.4 : 0.9;
  c.beginPath();
  c.arc(cx, cy, r - (hover ? 0 : 1.2), Math.PI * 1.1, Math.PI * 1.9);
  c.stroke();
}

// ---------------------------------------------------------------------------------------------------
// Icons

export type IconName = 'gear' | 'dice' | 'flag' | 'refresh' | 'copy' | 'pencil' | 'crown' | 'keyboard' | 'gamepad' | 'check' | 'alert' | 'eye' | 'unplugged';

/** Simple line/solid icons, `s` px tall, centered at (cx, cy). */
export function icon(c: Ctx, name: IconName, cx: number, cy: number, s: number, color: string) {
  c.save();
  c.translate(cx, cy);
  c.scale(s / 10, s / 10);
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineWidth = 1.6;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  switch (name) {
    case 'gear': {
      c.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 ? 3.6 : 5;
        c.lineTo(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r);
        c.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r);
      }
      c.closePath();
      c.moveTo(1.7, 0);
      c.arc(0, 0, 1.7, 0, Math.PI * 2, true);
      c.fill('evenodd');
      break;
    }
    case 'dice': {
      c.beginPath();
      c.roundRect(-4.5, -4.5, 9, 9, 2);
      c.fill();
      c.fillStyle = PAL.ink;
      for (const [dx, dy] of [
        [-2, -2],
        [2, 2],
        [0, 0],
        [2, -2],
        [-2, 2],
      ]) {
        c.beginPath();
        c.arc(dx, dy, 0.95, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'flag':
      c.beginPath();
      c.moveTo(-3.5, 5);
      c.lineTo(-3.5, -4.5);
      c.stroke();
      c.beginPath();
      c.moveTo(-3.5, -4.5);
      c.lineTo(4.5, -2.5);
      c.lineTo(-3.5, 0.8);
      c.fill();
      break;
    case 'refresh':
      c.beginPath();
      c.arc(0, 0, 3.6, -Math.PI * 0.2, Math.PI * 1.45);
      c.stroke();
      c.beginPath();
      c.moveTo(4.6, -3.6);
      c.lineTo(4.4, 0.4);
      c.lineTo(0.8, -1.4);
      c.fill();
      break;
    case 'copy':
      c.beginPath();
      c.roundRect(-4, -2, 6.5, 7, 1.2);
      c.stroke();
      c.beginPath();
      c.moveTo(-1.5, -2.5);
      c.lineTo(-1.5, -4.5);
      c.lineTo(4.5, -4.5);
      c.lineTo(4.5, 2.5);
      c.lineTo(3, 2.5);
      c.stroke();
      break;
    case 'pencil':
      c.rotate(Math.PI / 4);
      c.fillRect(-1.6, -5, 3.2, 7.5);
      c.beginPath();
      c.moveTo(-1.6, 3.2);
      c.lineTo(1.6, 3.2);
      c.lineTo(0, 5.6);
      c.fill();
      break;
    case 'crown':
      c.beginPath();
      c.moveTo(-5, 3.5);
      c.lineTo(-5, -3);
      c.lineTo(-2.4, -0.2);
      c.lineTo(0, -4.5);
      c.lineTo(2.4, -0.2);
      c.lineTo(5, -3);
      c.lineTo(5, 3.5);
      c.closePath();
      c.fill();
      break;
    case 'keyboard':
      c.beginPath();
      c.roundRect(-5.5, -3.5, 11, 7, 1.5);
      c.fill();
      c.fillStyle = PAL.ink;
      for (let i = 0; i < 4; i++) c.fillRect(-4 + i * 2.3, -2, 1.3, 1.3);
      for (let i = 0; i < 4; i++) c.fillRect(-3 + i * 2.3, 0, 1.3, 1.3);
      c.fillRect(-2.5, 2, 5, 0.9);
      break;
    case 'gamepad':
      c.beginPath();
      c.moveTo(-3, -3.2);
      c.lineTo(3, -3.2);
      c.quadraticCurveTo(6, -3.2, 6, 1.5);
      c.quadraticCurveTo(6, 4.2, 3.6, 3.4);
      c.lineTo(2, 1.8);
      c.lineTo(-2, 1.8);
      c.lineTo(-3.6, 3.4);
      c.quadraticCurveTo(-6, 4.2, -6, 1.5);
      c.quadraticCurveTo(-6, -3.2, -3, -3.2);
      c.fill();
      c.fillStyle = PAL.ink;
      c.fillRect(-4, -1, 3, 1);
      c.fillRect(-3, -2, 1, 3);
      c.beginPath();
      c.arc(3, -1.6, 0.7, 0, Math.PI * 2);
      c.arc(3, 0.6, 0.7, 0, Math.PI * 2);
      c.fill();
      break;
    case 'check':
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(-4, 0);
      c.lineTo(-1, 3);
      c.lineTo(4.5, -3.5);
      c.stroke();
      break;
    case 'alert':
      // A warning triangle with the mark knocked out of it.
      c.beginPath();
      c.moveTo(0, -5);
      c.lineTo(5.2, 4.5);
      c.lineTo(-5.2, 4.5);
      c.closePath();
      c.fill();
      c.fillStyle = PAL.ink;
      c.fillRect(-0.75, -1.8, 1.5, 3.6);
      c.fillRect(-0.75, 2.6, 1.5, 1.2);
      break;
    case 'unplugged':
      // Disconnected: a plug and its socket pulled apart, a spark of a gap between.
      c.beginPath();
      c.roundRect(-5.5, -2.6, 3.6, 5.2, 0.8);
      c.fill();
      c.fillRect(-1.9, -1.8, 1.4, 1);
      c.fillRect(-1.9, 0.8, 1.4, 1);
      c.beginPath();
      c.roundRect(1.9, -2.6, 3.6, 5.2, 0.8);
      c.fill();
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(-5.5, 0);
      c.lineTo(-6.6, 0);
      c.moveTo(5.5, 0);
      c.lineTo(6.6, 0);
      c.moveTo(-0.4, -4.4);
      c.lineTo(0.9, -2.8);
      c.moveTo(0.9, 2.8);
      c.lineTo(-0.4, 4.4);
      c.stroke();
      break;
    case 'eye':
      // Watching: an almond with a solid pupil.
      c.beginPath();
      c.moveTo(-5.5, 0);
      c.quadraticCurveTo(0, -6.2, 5.5, 0);
      c.quadraticCurveTo(0, 6.2, -5.5, 0);
      c.closePath();
      c.fill();
      c.fillStyle = PAL.ink;
      c.beginPath();
      c.arc(0, 0, 2.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = color;
      c.beginPath();
      c.arc(-0.7, -0.7, 0.7, 0, Math.PI * 2);
      c.fill();
      break;
  }
  c.restore();
}

/** Lighten (+) or darken (−) a #rrggbb color by a fraction. Other formats pass through. */
export function shade(hex: string, k: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
