import { FONT, PAL } from '../ui/style';
import { rrect } from './kit';

/**
 * HUD building blocks in the foundry style (docs/ART.md): riveted iron
 * plates with hard ink outlines and hard drop shadows, stamped buttons that
 * press down, hazard tape, and a small icon set. Canvas2D, view coords.
 */

type Ctx = CanvasRenderingContext2D;

let grain: CanvasPattern | null | undefined;
/** Cached speckle pattern that gives plates a cast-iron texture. */
function grainPattern(c: Ctx): CanvasPattern | null {
  if (grain !== undefined) return grain;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  for (let i = 0; i < 380; i++) {
    const light = Math.random() < 0.45;
    g.fillStyle = light ? `rgba(255,220,180,${0.05 + Math.random() * 0.06})` : `rgba(0,0,0,${0.12 + Math.random() * 0.12})`;
    const s = Math.random() < 0.85 ? 1 : 2;
    g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 64), s, s);
  }
  grain = c.createPattern(cv, 'repeat');
  return grain;
}

export interface PlateOpts {
  /** Main fill (default iron). */
  fill?: string;
  /** Accent strip across the top (player / role color). */
  edge?: string;
  /** Outline color (default ink). */
  stroke?: string;
  /** Hard drop shadow depth (default 3). */
  drop?: number;
  radius?: number;
  rivets?: boolean;
  /** Overall alpha. */
  alpha?: number;
}

/** A riveted iron plate. */
export function plate(c: Ctx, x: number, y: number, w: number, h: number, o: PlateOpts = {}) {
  const r = o.radius ?? 4;
  const drop = o.drop ?? 3;
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  if (drop) {
    c.fillStyle = 'rgba(8,4,2,0.55)';
    rrect(c, x + 1, y + drop, w, h, r);
    c.fill();
  }
  c.fillStyle = PAL.ink;
  rrect(c, x - 1, y - 1, w + 2, h + 2, r + 1);
  c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h);
  const base = o.fill ?? PAL.iron;
  g.addColorStop(0, base);
  g.addColorStop(1, shade(base, -0.28));
  c.fillStyle = g;
  rrect(c, x, y, w, h, r);
  c.fill();
  const pat = grainPattern(c);
  if (pat) {
    c.fillStyle = pat;
    c.fill();
  }
  // Bevel.
  c.fillStyle = 'rgba(255,225,190,0.09)';
  c.fillRect(x + r, y + 1, w - 2 * r, 1);
  if (o.edge) {
    c.save();
    rrect(c, x, y, w, h, r);
    c.clip();
    c.fillStyle = o.edge;
    c.fillRect(x, y, w, 4);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x, y + 4, w, 1);
    c.restore();
  }
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = 1.5;
    rrect(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.max(0, r - 0.75));
    c.stroke();
  }
  if (o.rivets !== false && w > 30 && h > 24) {
    const top = o.edge ? 8 : 4.5;
    for (const [rx, ry] of [
      [x + 4.5, y + top],
      [x + w - 4.5, y + top],
      [x + 4.5, y + h - 4.5],
      [x + w - 4.5, y + h - 4.5],
    ]) {
      c.fillStyle = PAL.ink;
      c.beginPath();
      c.arc(rx + 0.3, ry + 0.4, 1.4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = PAL.steel;
      c.beginPath();
      c.arc(rx, ry, 1.1, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

/** Recessed, empty bay (open lobby slot). */
export function bay(c: Ctx, x: number, y: number, w: number, h: number, hot: boolean, t: number) {
  c.save();
  c.fillStyle = PAL.ink;
  rrect(c, x - 1, y - 1, w + 2, h + 2, 5);
  c.fill();
  c.fillStyle = hot ? 'rgba(46,30,22,0.92)' : 'rgba(22,14,11,0.82)';
  rrect(c, x, y, w, h, 4);
  c.fill();
  // Inner shadow along the top edge.
  c.save();
  rrect(c, x, y, w, h, 4);
  c.clip();
  const sh = c.createLinearGradient(0, y, 0, y + 14);
  sh.addColorStop(0, 'rgba(0,0,0,0.55)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh;
  c.fillRect(x, y, w, 14);
  // Slow hazard tape along the bottom.
  hazardTape(c, x, y + h - 7, w, 7, hot ? 0.9 : 0.35, t * (hot ? 14 : 5));
  c.restore();
  c.setLineDash([5, 4]);
  c.lineDashOffset = -t * (hot ? 12 : 0);
  c.strokeStyle = hot ? PAL.molten : 'rgba(155,138,120,0.45)';
  c.lineWidth = 1.2;
  rrect(c, x + 4, y + 4, w - 8, h - 15, 3);
  c.stroke();
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

export type ButtonStyle = 'primary' | 'secondary' | 'ready' | 'ghost';

const BTN: Record<ButtonStyle, { top: string; side: string; text: string }> = {
  primary: { top: '#ff8a2a', side: '#a8320c', text: PAL.ink },
  secondary: { top: '#4a3a31', side: '#1e1511', text: PAL.bone },
  ready: { top: '#a6e22e', side: '#4b7410', text: PAL.ink },
  ghost: { top: 'rgba(43,32,27,0.85)', side: 'rgba(14,9,7,0.85)', text: PAL.bone },
};

/**
 * A stamped toy button: a top face over a darker side, which sinks when
 * hovered. Returns the vertical offset applied (for drawing content on it).
 */
export function stampButton(c: Ctx, x: number, y: number, w: number, h: number, style: ButtonStyle, hover: boolean): number {
  const s = BTN[style];
  const depth = 3;
  const sink = hover ? 1.5 : 0;
  const r = Math.min(5, h / 3);
  c.fillStyle = PAL.ink;
  rrect(c, x - 1, y - 1, w + 2, h + depth + 2, r + 1);
  c.fill();
  c.fillStyle = s.side;
  rrect(c, x, y, w, h + depth, r);
  c.fill();
  c.fillStyle = hover && style !== 'primary' && style !== 'ready' ? '#5d4a3e' : hover ? shade(s.top, 0.12) : s.top;
  rrect(c, x, y + sink, w, h, r);
  c.fill();
  c.fillStyle = 'rgba(255,240,220,0.22)';
  c.fillRect(x + r, y + sink + 1, w - 2 * r, 1);
  if (hover) {
    c.strokeStyle = PAL.amber;
    c.lineWidth = 1;
    rrect(c, x - 2.5, y - 2.5, w + 5, h + depth + 5, r + 2);
    c.stroke();
  }
  return sink;
}

export function buttonText(style: ButtonStyle): string {
  return BTN[style].text;
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
  const w = c.measureText(label).width + size * 1.1;
  const h = size + 4;
  const x0 = align === 'left' ? x : align === 'center' ? x - w / 2 : x - w;
  c.fillStyle = PAL.ink;
  rrect(c, x0 - 1, cy - h / 2 - 1, w + 2, h + 2, 3);
  c.fill();
  c.fillStyle = fill;
  rrect(c, x0, cy - h / 2, w, h, 2);
  c.fill();
  c.fillStyle = ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, x0 + w / 2, cy + 0.5);
  return w;
}

export type IconName = 'gear' | 'dice' | 'flag' | 'refresh' | 'copy' | 'pencil' | 'crown' | 'keyboard' | 'gamepad' | 'check';

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
