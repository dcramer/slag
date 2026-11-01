import { clamp } from '../core/geom';
import type { CharacterDef } from '../gen/character';

export interface CharPose {
  facing: number;
  vx: number;
  vy: number;
  grounded: boolean;
  /** Seconds, for idle/walk animation. */
  t: number;
  scale?: number;
  celebrate?: boolean;
}

/** Draw a procedural character with its feet centered at (x, y). */
export function drawCharacter(ctx: CanvasRenderingContext2D, c: CharacterDef, x: number, y: number, pose: CharPose): void {
  const s = pose.scale ?? 1;
  const W = 14 * c.sw;
  const H = 15 * c.sh;
  // Squash & stretch from vertical speed; a little idle breathing.
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

  ctx.save();
  ctx.translate(x, y - hop * s);
  ctx.scale(s * sx, s * sy);
  const walking = pose.grounded && Math.abs(pose.vx) > 10;
  const step = walking ? Math.sin(pose.t * 22) * 2 : 0;

  // Feet.
  if (c.feet) {
    ctx.fillStyle = c.bodyDark;
    ellipse(ctx, -W * 0.25 + step * 0.5, -1.2 + (walking ? Math.max(0, step) * -0.5 : 0), 2.6, 1.6);
    ellipse(ctx, W * 0.25 - step * 0.5, -1.2 + (walking ? Math.max(0, -step) * -0.5 : 0), 2.6, 1.6);
  }

  const by = c.feet ? -2 : 0;
  // Topper behind/around the head.
  drawTopper(ctx, c, W, H, by, pose);

  // Body.
  ctx.beginPath();
  bodyPath(ctx, c, W, H, by);
  ctx.fillStyle = c.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  drawPattern(ctx, c, W, H, by);
  ctx.restore();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = c.bodyDark;
  ctx.stroke();

  // Face.
  const look = pose.facing * 1.6;
  const ey = by - H * c.eyes.y;
  const n = c.eyes.count;
  const spread = W * c.eyes.spread;
  const xs = n === 1 ? [0] : n === 2 ? [-spread, spread] : [-spread * 1.2, 0, spread * 1.2];
  const blink = Math.sin(pose.t * 1.3 + c.seed * 7) > 0.985;
  if (c.eyes.style === 'visor') {
    ctx.fillStyle = '#16161e';
    roundRect(ctx, -spread - 3 + look, ey - 2.4, spread * 2 + 6, 4.8, 2.4);
    ctx.fill();
    ctx.fillStyle = c.accent;
    ctx.fillRect(-spread + look + (Math.sin(pose.t * 3) * spread), ey - 0.8, 2.5, 1.6);
  } else {
    xs.forEach((ex, i) => {
      const r = c.eyes.size * (n === 3 && i === 1 ? 1.2 : 1);
      const cx = ex + look;
      if (blink) {
        ctx.strokeStyle = '#16161e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - r, ey);
        ctx.lineTo(cx + r, ey);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = '#fff';
      circle(ctx, cx, ey, r);
      if (c.eyes.style === 'ring') {
        ctx.fillStyle = c.eyes.iris;
        circle(ctx, cx + pose.facing * r * 0.25, ey, r * 0.65);
      }
      ctx.fillStyle = '#16161e';
      circle(ctx, cx + pose.facing * r * 0.35, ey, r * 0.4);
      if (c.eyes.style === 'sleepy') {
        ctx.fillStyle = c.body;
        ctx.fillRect(cx - r - 0.5, ey - r - 0.5, r * 2 + 1, r + 0.3);
      }
    });
  }

  const my = ey + c.eyes.size + 3;
  const mx = look * 0.8;
  ctx.strokeStyle = '#16161e';
  ctx.fillStyle = '#16161e';
  ctx.lineWidth = 1;
  const mouth = pose.celebrate ? 'o' : c.mouth;
  switch (mouth) {
    case 'smile':
      ctx.beginPath();
      ctx.arc(mx, my - 1.5, 2.2, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
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
      ctx.fillStyle = '#16161e';
      roundRect(ctx, mx - 3, my - 1.2, 6, 2.8, 1);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(mx - 2.4, my - 1.2, 1.4, 1.2);
      ctx.fillRect(mx + 1, my - 1.2, 1.4, 1.2);
      break;
    case 'none':
      break;
  }
  ctx.restore();
}

function bodyPath(ctx: CanvasRenderingContext2D, c: CharacterDef, W: number, H: number, by: number) {
  const top = by - H;
  switch (c.shape) {
    case 'round':
      ctx.ellipse(0, by - H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
      break;
    case 'box':
      roundRect(ctx, -W / 2, top, W, H, 3);
      break;
    case 'capsule':
      roundRect(ctx, -W / 2, top, W, H, W / 2);
      break;
    case 'wide':
      roundRect(ctx, -W / 2, top, W, H, H / 2.2);
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

function drawPattern(ctx: CanvasRenderingContext2D, c: CharacterDef, W: number, H: number, by: number) {
  switch (c.pattern) {
    case 'belly':
      ctx.fillStyle = c.belly;
      ellipse(ctx, 0, by - H * 0.22, W * 0.32, H * 0.28);
      break;
    case 'stripes':
      ctx.fillStyle = c.bodyDark;
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 3; i++) ctx.fillRect(-W, by - H * (0.15 + i * 0.22), W * 2, 1.6);
      ctx.globalAlpha = 1;
      break;
    case 'spots':
      ctx.fillStyle = c.belly;
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 4; i++) {
        const a = c.seed * 0.001 + i * 2.1;
        circle(ctx, Math.cos(a) * W * 0.32, by - H * (0.3 + 0.12 * Math.sin(a * 1.7)), 1.3 + (i % 2));
      }
      ctx.globalAlpha = 1;
      break;
    case 'none':
      break;
  }
}

function drawTopper(ctx: CanvasRenderingContext2D, c: CharacterDef, W: number, H: number, by: number, pose: CharPose) {
  const top = by - H;
  const wob = Math.sin(pose.t * 6) * 1.2 - pose.vx / 120;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = c.bodyDark;
  switch (c.topper) {
    case 'antenna':
      ctx.beginPath();
      ctx.moveTo(0, top + 1);
      ctx.quadraticCurveTo(wob, top - 3, wob * 1.5, top - 6);
      ctx.stroke();
      ctx.fillStyle = c.accent;
      circle(ctx, wob * 1.5, top - 6.5, 1.8);
      break;
    case 'horns':
      ctx.fillStyle = c.belly;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sgn * W * 0.18, top + 2);
        ctx.lineTo(sgn * W * 0.42, top - 4);
        ctx.lineTo(sgn * W * 0.38, top + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'ears':
      ctx.fillStyle = c.body;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sgn * W * 0.3, top + 1, 2.2, 4.2, sgn * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'tuft':
      ctx.strokeStyle = c.accent;
      for (const a of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(0, top + 1);
        ctx.quadraticCurveTo(a * 6 + wob, top - 3, a * 8 + wob, top - 4);
        ctx.stroke();
      }
      break;
    case 'cap':
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.arc(0, top + 3, W * 0.38, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(pose.facing > 0 ? 0 : -W * 0.65, top + 2, W * 0.65, 1.6);
      break;
    case 'crown':
      ctx.fillStyle = '#f5c542';
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
      break;
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
    case 'none':
      break;
  }
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fill();
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}
