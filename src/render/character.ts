import { css, type HSL } from '../core/color';
import { clamp } from '../core/geom';
import type { CharacterDef } from '../gen/character';
import { line, type P, sn } from './ink';
import { inkLoop } from './ink-parts';
import { circle, ellipse, glowDot, type RC, rrect } from './kit';

export interface CharPose {
  facing: number;
  vx: number;
  vy: number;
  grounded: boolean;
  /** Seconds, for idle/walk animation. */
  t: number;
  scale?: number;
  celebrate?: boolean;
  /** ART SPIKE: draw the body in ink, not gradients. */
  ink?: boolean;
}

interface Pt {
  x: number;
  y: number;
  px: number;
  py: number;
}

/**
 * Cosmetic per-character state that lives in the renderer: a verlet ribbon
 * for scarves/tails/capes, an afterimage trail, and landing detection.
 */
export class Rig {
  rope: Pt[] = [];
  trail: { x: number; y: number; a: number }[] = [];
  wasGrounded = true;
  lastVy = 0;

  step(c: CharacterDef, ax: number, ay: number, dt: number, wind = 0) {
    const n = c.accessoryLength;
    if (this.rope.length !== n) this.rope = Array.from({ length: n }, (_, i) => ({ x: ax, y: ay + i, px: ax, py: ay + i }));
    const seg = c.accessory === 'cape' ? 1.7 : c.accessory === 'tail' ? 1.5 : 1.9;
    const grav = c.accessory === 'tail' ? 60 : 220;
    const p0 = this.rope[0];
    p0.x = p0.px = ax;
    p0.y = p0.py = ay;
    for (let i = 1; i < n; i++) {
      const p = this.rope[i];
      const vx = (p.x - p.px) * 0.94;
      const vy = (p.y - p.py) * 0.94;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + wind * dt * dt * 40;
      p.y += vy + grav * dt * dt;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < n; i++) {
        const a = this.rope[i - 1];
        const b = this.rope[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-4;
        const diff = (d - seg) / d;
        if (i === 1) {
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
          b.x -= dx * diff * 0.5;
          b.y -= dy * diff * 0.5;
        }
      }
    }
  }
}

function bodyPath(ctx: CanvasRenderingContext2D, c: CharacterDef, W: number, H: number, by: number) {
  const top = by - H;
  ctx.beginPath();
  switch (c.shape) {
    case 'round':
      ctx.ellipse(0, by - H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
      break;
    case 'box':
      ctx.roundRect(-W / 2, top, W, H, 3.5);
      break;
    case 'capsule':
      ctx.roundRect(-W / 2, top, W, H, W / 2);
      break;
    case 'wide':
      ctx.roundRect(-W / 2, top, W, H, H / 2.2);
      break;
    case 'drop':
      ctx.moveTo(0, top - 2);
      ctx.bezierCurveTo(W * 0.25, top + H * 0.2, W * 0.55, by - H * 0.45, W * 0.5, by - H * 0.25);
      ctx.bezierCurveTo(W * 0.45, by + 0.5, -W * 0.45, by + 0.5, -W * 0.5, by - H * 0.25);
      ctx.bezierCurveTo(-W * 0.55, by - H * 0.45, -W * 0.25, top + H * 0.2, 0, top - 2);
      ctx.closePath();
      break;
    case 'pear':
      ctx.moveTo(0, top);
      ctx.bezierCurveTo(W * 0.4, top, W * 0.3, by - H * 0.55, W * 0.55, by - H * 0.25);
      ctx.bezierCurveTo(W * 0.7, by + 0.5, -W * 0.7, by + 0.5, -W * 0.55, by - H * 0.25);
      ctx.bezierCurveTo(-W * 0.3, by - H * 0.55, -W * 0.4, top, 0, top);
      ctx.closePath();
      break;
  }
}

const bodyCache = new WeakMap<CharacterDef, P[]>();

/** The same silhouettes as `bodyPath`, as points, so a pen can follow them. */
function bodyPoints(c: CharacterDef, W: number, H: number, by: number): P[] {
  const cached = bodyCache.get(c);
  if (cached) return cached;
  const top = by - H;
  const pts: P[] = [];
  const bez = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const u = 1 - t;
      pts.push({
        x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      });
    }
  };
  const rounded = (r0: number) => {
    const r = Math.min(r0, W / 2, H / 2);
    const centers: [number, number, number][] = [
      [W / 2 - r, top + r, -Math.PI / 2],
      [W / 2 - r, by - r, 0],
      [-W / 2 + r, by - r, Math.PI / 2],
      [-W / 2 + r, top + r, Math.PI],
    ];
    for (const [cx, cy, a0] of centers) {
      for (let i = 0; i <= 6; i++) {
        const a = a0 + (i / 6) * (Math.PI / 2);
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
    }
  };
  switch (c.shape) {
    case 'round':
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: (Math.cos(a) * W) / 2, y: by - H / 2 + (Math.sin(a) * H) / 2 });
      }
      break;
    case 'box':
      rounded(3.5);
      break;
    case 'capsule':
      rounded(W / 2);
      break;
    case 'wide':
      rounded(H / 2.2);
      break;
    case 'drop':
      bez(0, top - 2, W * 0.25, top + H * 0.2, W * 0.55, by - H * 0.45, W * 0.5, by - H * 0.25);
      bez(W * 0.5, by - H * 0.25, W * 0.45, by + 0.5, -W * 0.45, by + 0.5, -W * 0.5, by - H * 0.25);
      bez(-W * 0.5, by - H * 0.25, -W * 0.55, by - H * 0.45, -W * 0.25, top + H * 0.2, 0, top - 2);
      break;
    case 'pear':
      bez(0, top, W * 0.4, top, W * 0.3, by - H * 0.55, W * 0.55, by - H * 0.25);
      bez(W * 0.55, by - H * 0.25, W * 0.7, by + 0.5, -W * 0.7, by + 0.5, -W * 0.55, by - H * 0.25);
      bez(-W * 0.55, by - H * 0.25, -W * 0.3, by - H * 0.55, -W * 0.4, top, 0, top);
      break;
  }
  bodyCache.set(c, pts);
  return pts;
}

/** Body in the home screen's manner: flat color, a hard shadow shape, a heavy line in a dark of its own hue. */
function inkBody(ctx: CanvasRenderingContext2D, c: CharacterDef, W: number, H: number, by: number, t: number) {
  // A slow boil on threes: the drawing is alive even when the character stands still.
  const boil = Math.floor(t * 8) % 3;
  const pts = bodyPoints(c, W, H, by).map((p, i) => ({
    x: p.x + sn(i * 0.45, boil * 3.1, c.seed & 0xffff) * 0.28,
    y: p.y + sn(i * 0.45 + 9, boil * 3.1, c.seed & 0xffff) * 0.28,
  }));
  const cy = by - H / 2;
  const shape = (dx: number, dy: number) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy)));
    ctx.closePath();
  };
  ctx.fillStyle = css(c.body, -24, 1, 10);
  shape(0, 0);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = css(c.body);
  shape(-W * 0.13, -H * 0.1);
  ctx.fill();
  drawPattern(ctx, c, W, H, by);
  ctx.fillStyle = css(c.body, -30, 1, 10);
  const sd = c.seed & 0xffff;
  for (let i = 0; i < 4; i++) {
    const hx = W * (0.14 + i * 0.1);
    const hy = by - H * (0.08 + (i % 2) * 0.05);
    line(ctx, hx, hy, hx + W * 0.11, hy - H * 0.2, { w: 0.65, seed: sd + i + boil, taper: [0.05, 0.8] });
  }
  ctx.fillStyle = css(c.body, 30, 1, -6);
  line(ctx, -W * 0.34, by - H * 0.74, -W * 0.14, by - H * 0.87, { w: 1.5, seed: sd, taper: [0.25, 0.55], press: 0.15 });
  ctx.restore();
  ctx.fillStyle = css(c.body, -c.body.l * 0.74, 1, 10);
  inkLoop(ctx, pts, 0, cy, sd + boil, 1.25, 2.7, 3);
}

/** Draw the trailing accessory (world space, behind the body). */
export function drawAccessory(rc: RC, c: CharacterDef, rig: Rig) {
  if (c.accessory === 'none' || rig.rope.length < 2) return;
  const s = rc.s;
  const pts = rig.rope;
  const col = c.accessory === 'tail' ? c.body : c.accessoryColor;
  const w0 = c.accessory === 'cape' ? 4.5 : c.accessory === 'tail' ? 2.2 : 1.8;
  const w1 = c.accessory === 'cape' ? 6.5 : c.accessory === 'tail' ? 0.6 : 1.4;
  // Ribbon as a filled polygon of varying width.
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const w = w0 + (w1 - w0) * (i / (pts.length - 1));
    left.push([pts[i].x - (dy / d) * w * 0.5, pts[i].y + (dx / d) * w * 0.5]);
    right.push([pts[i].x + (dy / d) * w * 0.5, pts[i].y - (dx / d) * w * 0.5]);
  }
  s.beginPath();
  left.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) s.lineTo(right[i][0], right[i][1]);
  s.closePath();
  s.fillStyle = css(col, c.accessory === 'tail' ? 0 : -4);
  s.fill();
  s.strokeStyle = css(col, -28);
  s.lineWidth = 0.8;
  s.stroke();
  if (c.accessory === 'scarf') {
    s.strokeStyle = css(col, 18, 0.8);
    s.lineWidth = 0.6;
    for (let i = 2; i < pts.length; i += 2) {
      s.beginPath();
      s.moveTo(left[i][0], left[i][1]);
      s.lineTo(right[i][0], right[i][1]);
      s.stroke();
    }
  }
  if (c.accessory === 'tail') {
    const tip = pts[pts.length - 1];
    s.fillStyle = css(c.accent);
    circle(s, tip.x, tip.y, 1.8);
  }
}

/** Draw a character with feet centered at (x, y). */
export function drawCharacter(
  rc: RC | { s: CanvasRenderingContext2D; g: CanvasRenderingContext2D | null },
  c: CharacterDef,
  x: number,
  y: number,
  pose: CharPose,
): void {
  const ctx = rc.s;
  const g = rc.g;
  const sc = pose.scale ?? 1;
  const W = 14 * c.sw;
  const H = 15 * c.sh;
  let sx = 1;
  let sy = 1;
  if (!pose.grounded) {
    const k = clamp(-pose.vy / 900, -0.2, 0.25);
    sy = 1 + k;
    sx = 1 - k * 0.6;
  } else {
    const b = Math.sin(pose.t * 4 + c.seed) * 0.03;
    sy = 1 + b;
    sx = 1 - b;
  }
  const hop = pose.celebrate ? Math.abs(Math.sin(pose.t * 9)) * 5 : 0;
  const lean = pose.grounded ? clamp(pose.vx / 140, -1, 1) * 0.08 : clamp(pose.vx / 200, -1, 1) * 0.12;

  ctx.save();
  ctx.translate(x, y - hop * sc);
  ctx.scale(sc * sx, sc * sy);
  ctx.rotate(lean);
  const walking = pose.grounded && Math.abs(pose.vx) > 10;
  const step = walking ? Math.sin(pose.t * 22) * 2 : 0;
  const body = c.body;
  const dark = { ...body, l: body.l * 0.45 };

  if (c.feet) {
    ctx.fillStyle = css(dark, 5);
    ellipse(ctx, -W * 0.25 + step * 0.5, -1.2 - (walking ? Math.max(0, step) * 0.5 : 0), 2.8, 1.7);
    ellipse(ctx, W * 0.25 - step * 0.5, -1.2 - (walking ? Math.max(0, -step) * 0.5 : 0), 2.8, 1.7);
  }
  const by = c.feet ? -2 : 0;
  drawTopper(ctx, g, c, W, H, by, pose, x, y, sc);

  // Body with soft spherical shading and a rim light.
  if (pose.ink) inkBody(ctx, c, W, H, by, pose.t);
  else {
    bodyPath(ctx, c, W, H, by);
    const gr = ctx.createRadialGradient(-W * 0.2, by - H * 0.75, H * 0.08, 0, by - H * 0.45, H * 0.85);
    gr.addColorStop(0, css(body, 20, 1, -5));
    gr.addColorStop(0.5, css(body));
    gr.addColorStop(1, css(body, -18, 1, 5));
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawPattern(ctx, c, W, H, by);
    // Rim light (sky) on the top edge.
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(-0.6, by - H * 0.52, W * 0.42, H * 0.44, 0, Math.PI * 1.1, Math.PI * 1.65);
    ctx.stroke();
    ctx.restore();
    bodyPath(ctx, c, W, H, by);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = css(dark, -6);
    ctx.stroke();
  }

  // Face.
  const look = pose.facing * 1.6;
  const ey = by - H * c.eyes.y;
  const n = c.eyes.count;
  const spread = W * c.eyes.spread;
  const xs = n === 1 ? [0] : n === 2 ? [-spread, spread] : [-spread * 1.2, 0, spread * 1.2];
  const blink = Math.sin(pose.t * 1.3 + c.seed * 7) > 0.985;
  if (c.eyes.style === 'visor') {
    const vg = ctx.createLinearGradient(0, ey - 2.5, 0, ey + 2.5);
    vg.addColorStop(0, '#2a2a38');
    vg.addColorStop(1, '#0c0c12');
    ctx.fillStyle = vg;
    rrect(ctx, -spread - 3 + look, ey - 2.6, spread * 2 + 6, 5.2, 2.6);
    ctx.fill();
    const scanX = -spread + look + Math.sin(pose.t * 3) * spread;
    ctx.fillStyle = css(c.accent, 15);
    ctx.fillRect(scanX, ey - 0.9, 2.6, 1.8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-spread - 1.5 + look, ey - 2, spread * 2, 0.8);
  } else {
    xs.forEach((ex, i) => {
      const r = c.eyes.size * (n === 3 && i === 1 ? 1.2 : 1);
      const cx = ex + look;
      if (blink) {
        ctx.strokeStyle = '#15151c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - r, ey);
        ctx.lineTo(cx + r, ey);
        ctx.stroke();
        return;
      }
      const wg = ctx.createRadialGradient(cx - r * 0.3, ey - r * 0.3, 0, cx, ey, r);
      wg.addColorStop(0, '#ffffff');
      wg.addColorStop(1, '#d9dde8');
      ctx.fillStyle = wg;
      circle(ctx, cx, ey, r);
      if (c.eyes.style === 'ring') {
        ctx.fillStyle = css(c.eyes.iris);
        circle(ctx, cx + pose.facing * r * 0.25, ey, r * 0.68);
      }
      ctx.fillStyle = '#121218';
      circle(ctx, cx + pose.facing * r * 0.35, ey + 0.2, r * 0.42);
      ctx.fillStyle = '#fff';
      circle(ctx, cx + pose.facing * r * 0.35 - r * 0.2, ey - r * 0.2, r * 0.16);
      if (c.eyes.style === 'sleepy') {
        ctx.fillStyle = css(body, -4);
        ctx.fillRect(cx - r - 0.5, ey - r - 0.5, r * 2 + 1, r + 0.3);
      }
      if (c.eyes.style === 'angry') {
        ctx.strokeStyle = css(dark, -10);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const inner = ex < 0 || (n === 1 && pose.facing > 0) ? 1 : -1;
        ctx.moveTo(cx - r * 1.1, ey - r * (inner > 0 ? 1.0 : 1.5));
        ctx.lineTo(cx + r * 1.1, ey - r * (inner > 0 ? 1.5 : 1.0));
        ctx.stroke();
      }
      if (c.eyes.glow && g) {
        // Eyes glow in the dark (emissive layer, world space).
        const wx = x + cx * sx * sc;
        const wy = y - hop * sc + ey * sy * sc;
        glowDot(g, wx, wy, r * 3 * sc, c.eyes.iris, 0.5);
      }
    });
  }

  const my = ey + c.eyes.size + 3;
  const mx = look * 0.8;
  ctx.strokeStyle = '#15151c';
  ctx.fillStyle = '#15151c';
  ctx.lineWidth = 1;
  const mouth = pose.celebrate ? 'grin' : c.mouth;
  switch (mouth) {
    case 'smile':
      ctx.beginPath();
      ctx.arc(mx, my - 1.5, 2.2, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;
    case 'grin':
      ctx.beginPath();
      ctx.arc(mx, my - 1.2, 2.8, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8566b';
      ellipse(ctx, mx, my + 0.9, 1.4, 0.7);
      break;
    case 'fang':
      ctx.beginPath();
      ctx.moveTo(mx - 2.5, my);
      ctx.lineTo(mx + 2.5, my);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(mx + 0.5, my);
      ctx.lineTo(mx + 1.5, my + 2);
      ctx.lineTo(mx + 2.3, my);
      ctx.fill();
      break;
    case 'o':
      ellipse(ctx, mx, my, 1.4, 1.8);
      break;
    case 'flat':
      ctx.beginPath();
      ctx.moveTo(mx - 2, my);
      ctx.lineTo(mx + 2, my);
      ctx.stroke();
      break;
    case 'teeth':
      rrect(ctx, mx - 3, my - 1.2, 6, 2.8, 1);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(mx - 2.4, my - 1.2, 1.4, 1.2);
      ctx.fillRect(mx + 1, my - 1.2, 1.4, 1.2);
      break;
    case 'none':
      break;
  }
  // Blush.
  ctx.fillStyle = 'rgba(255,90,120,0.25)';
  ellipse(ctx, mx - W * 0.3, my - 1, 1.6, 0.9);
  ellipse(ctx, mx + W * 0.3, my - 1, 1.6, 0.9);
  ctx.restore();
}

/**
 * One speed-trail sample: the body's silhouette in its own flat color. No face, so it can't read
 * as another runner, and nothing on the emissive layer, so overlapping samples can't stack into a glow.
 */
export function drawAfterimage(ctx: CanvasRenderingContext2D, c: CharacterDef, x: number, y: number, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  bodyPath(ctx, c, 14 * c.sw, 15 * c.sh, c.feet ? -2 : 0);
  ctx.fillStyle = css(c.body);
  ctx.fill();
  ctx.restore();
}

function drawPattern(ctx: CanvasRenderingContext2D, c: CharacterDef, W: number, H: number, by: number) {
  switch (c.pattern) {
    case 'belly': {
      const g = ctx.createRadialGradient(0, by - H * 0.25, 0, 0, by - H * 0.22, W * 0.4);
      g.addColorStop(0, css(c.belly, 5));
      g.addColorStop(1, css(c.belly, -5));
      ctx.fillStyle = g;
      ellipse(ctx, 0, by - H * 0.22, W * 0.32, H * 0.28);
      break;
    }
    case 'stripes':
      ctx.fillStyle = css(c.body, -22, 0.55);
      for (let i = 0; i < 3; i++) ctx.fillRect(-W, by - H * (0.15 + i * 0.22), W * 2, 1.8);
      break;
    case 'spots':
      ctx.fillStyle = css(c.belly, 0, 0.65);
      for (let i = 0; i < 4; i++) {
        const a = c.seed * 0.001 + i * 2.1;
        circle(ctx, Math.cos(a) * W * 0.32, by - H * (0.3 + 0.12 * Math.sin(a * 1.7)), 1.3 + (i % 2));
      }
      break;
    case 'gradient': {
      const g = ctx.createLinearGradient(0, by - H, 0, by);
      g.addColorStop(0, css(c.accent, 0, 0));
      g.addColorStop(1, css(c.accent, 0, 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(-W, by - H, W * 2, H);
      break;
    }
    case 'none':
      break;
  }
}

function drawTopper(
  ctx: CanvasRenderingContext2D,
  g: CanvasRenderingContext2D | null,
  c: CharacterDef,
  W: number,
  H: number,
  by: number,
  pose: CharPose,
  wx: number,
  wy: number,
  sc: number,
) {
  const top = by - H;
  const wob = Math.sin(pose.t * 6) * 1.2 - pose.vx / 120;
  const dark: HSL = { ...c.body, l: c.body.l * 0.45 };
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = css(dark);
  switch (c.topper) {
    case 'antenna':
      ctx.beginPath();
      ctx.moveTo(0, top + 1);
      ctx.quadraticCurveTo(wob, top - 3, wob * 1.5, top - 6);
      ctx.stroke();
      ctx.fillStyle = css(c.accent);
      circle(ctx, wob * 1.5, top - 6.5, 1.9);
      if (g) glowDot(g, wx + wob * 1.5 * sc, wy + (top - 6.5) * sc, 6 * sc, c.accent, 0.6);
      break;
    case 'horns':
      for (const sgn of [-1, 1]) {
        const hg = ctx.createLinearGradient(0, top + 3, 0, top - 4);
        hg.addColorStop(0, css(c.belly, -10));
        hg.addColorStop(1, '#fff');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(sgn * W * 0.16, top + 2.5);
        ctx.quadraticCurveTo(sgn * W * 0.45, top, sgn * W * 0.42, top - 4.5);
        ctx.lineTo(sgn * W * 0.36, top + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'ears':
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = css(c.body);
        ctx.beginPath();
        ctx.ellipse(sgn * W * 0.3, top + 1, 2.3, 4.4, sgn * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = css(c.belly, 0, 0.8);
        ctx.beginPath();
        ctx.ellipse(sgn * W * 0.3, top + 1.5, 1.1, 2.6, sgn * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'tuft':
      ctx.strokeStyle = css(c.accent);
      for (const a of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(0, top + 1);
        ctx.quadraticCurveTo(a * 6 + wob, top - 3, a * 8 + wob, top - 4.5);
        ctx.stroke();
      }
      break;
    case 'mohawk':
      ctx.fillStyle = css(c.accent);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 1.8 - 1, top + 2);
        ctx.lineTo(i * 1.8 + wob * 0.4, top - 4 + Math.abs(i) * 0.8);
        ctx.lineTo(i * 1.8 + 1, top + 2);
        ctx.fill();
      }
      break;
    case 'cap': {
      const cg = ctx.createLinearGradient(0, top - 2, 0, top + 3);
      cg.addColorStop(0, css(c.accent, 12));
      cg.addColorStop(1, css(c.accent, -12));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, top + 3, W * 0.38, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = css(c.accent, -18);
      ctx.fillRect(pose.facing > 0 ? 0 : -W * 0.65, top + 2, W * 0.65, 1.7);
      ctx.fillStyle = '#fff';
      circle(ctx, 0, top - 2, 0.9);
      break;
    }
    case 'crown': {
      const cg = ctx.createLinearGradient(0, top - 4, 0, top + 2);
      cg.addColorStop(0, '#fff3b0');
      cg.addColorStop(1, '#d99a1e');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(-W * 0.3, top + 2);
      ctx.lineTo(-W * 0.3, top - 3);
      ctx.lineTo(-W * 0.15, top);
      ctx.lineTo(0, top - 4);
      ctx.lineTo(W * 0.15, top);
      ctx.lineTo(W * 0.3, top - 3);
      ctx.lineTo(W * 0.3, top + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8304a';
      circle(ctx, 0, top - 0.5, 0.9);
      break;
    }
    case 'leaf':
      ctx.fillStyle = 'hsl(120 60% 45%)';
      ctx.beginPath();
      ctx.ellipse(wob + 2, top - 2, 3.5, 1.6, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, top + 1);
      ctx.lineTo(wob + 1, top - 1);
      ctx.stroke();
      break;
    case 'halo':
      ctx.strokeStyle = '#ffe680';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(wob * 0.3, top - 4, W * 0.32, 1.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (g) glowDot(g, wx + wob * 0.3 * sc, wy + (top - 4) * sc, 9 * sc, { h: 50, s: 100, l: 70 }, 0.5);
      break;
    case 'none':
      break;
  }
}
