import { FONT, PAL } from './style';

/**
 * Input glyphs: keycaps, gamepad buttons, mouse buttons and touch taps,
 * drawn the way console games show button prompts. Two renderers share one
 * model and one look: `drawGlyph` (Canvas2D, for the HUD) and `glyphSVG`
 * (an inline SVG string, for DOM menus and the server-rendered pages).
 *
 * Dependency-free on purpose, so app/ routes may import it.
 */

export type PadButton = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'LS' | 'DUP' | 'DDOWN' | 'DPAD' | 'MENU';
export type MouseButton = 'left' | 'right' | 'wheel' | 'move';

export type Glyph =
  /** A keyboard key. `label` is the cap text (see capLabel in prompts.ts). */
  { kind: 'key'; label: string } | { kind: 'pad'; button: PadButton } | { kind: 'mouse'; button: MouseButton } | { kind: 'touch' };

/** Xbox-layout face colors (the most common pad on PC). Y gets dark ink for contrast. */
const FACE: Record<'A' | 'B' | 'X' | 'Y', { fill: string; ink: string }> = {
  A: { fill: '#4caf3c', ink: '#fff' },
  B: { fill: '#e0443a', ink: '#fff' },
  X: { fill: '#3b78d8', ink: '#fff' },
  Y: { fill: '#f0b81e', ink: PAL.ink },
};
const CAP_TOP = '#f3e6d0';
const CAP_SIDE = '#9c8a75';
const PAD_BODY = '#3b3431';

/** Rough cap text width as a fraction of the font size (for SVG, where we can't measure). */
const approxTextW = (s: string, size: number) => [...s].reduce((w, ch) => w + (/[A-Z0-9]/.test(ch) ? 0.6 : /[a-z]/.test(ch) ? 0.52 : 0.62), 0) * size;

function keyWidth(label: string, h: number, measure: (s: string, size: number) => number) {
  return Math.max(h, measure(label, h * 0.56) + h * 0.62);
}

function padWidth(b: PadButton, h: number) {
  if (b === 'LB' || b === 'RB' || b === 'LT' || b === 'RT') return h * 1.7;
  if (b === 'MENU') return h * 1.25;
  return h;
}

/** Width a glyph will take when drawn at height `h`. */
export function glyphWidth(c: CanvasRenderingContext2D, g: Glyph, h: number): number {
  switch (g.kind) {
    case 'key':
      return keyWidth(g.label, h, (s, size) => {
        c.font = `700 ${size}px ${FONT.ui}`;
        return c.measureText(s).width;
      });
    case 'pad':
      return padWidth(g.button, h);
    case 'mouse':
      return h * 0.72;
    case 'touch':
      return h;
  }
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Draw a glyph with its left edge at `x`, vertically centered on `cy`. Returns its width. */
export function drawGlyph(c: CanvasRenderingContext2D, g: Glyph, x: number, cy: number, h: number): number {
  const w = glyphWidth(c, g, h);
  const y = cy - h / 2;
  c.save();
  c.lineJoin = 'round';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  switch (g.kind) {
    case 'key': {
      const r = h * 0.22;
      c.fillStyle = PAL.ink;
      rr(c, x - 0.6, y - 0.6, w + 1.2, h + 1.8, r + 0.6);
      c.fill();
      c.fillStyle = CAP_SIDE;
      rr(c, x, y, w, h + 0.6, r);
      c.fill();
      c.fillStyle = CAP_TOP;
      rr(c, x, y, w, h - h * 0.14, r);
      c.fill();
      c.fillStyle = PAL.ink;
      c.font = `700 ${h * 0.56}px ${FONT.ui}`;
      c.fillText(g.label, x + w / 2, cy - h * 0.06);
      break;
    }
    case 'pad':
      drawPad(c, g.button, x, cy, w, h);
      break;
    case 'mouse': {
      const r = w / 2;
      c.fillStyle = PAL.ink;
      rr(c, x - 0.7, y - 0.7, w + 1.4, h + 1.4, r + 0.7);
      c.fill();
      c.fillStyle = CAP_TOP;
      rr(c, x, y, w, h, r);
      c.fill();
      const split = y + h * 0.45;
      c.fillStyle = PAL.molten;
      if (g.button === 'left') {
        rr(c, x, y, w / 2, split - y, [r, 0, 0, 0]);
        c.fill();
      } else if (g.button === 'right') {
        rr(c, x + w / 2, y, w / 2, split - y, [0, r, 0, 0]);
        c.fill();
      }
      c.strokeStyle = PAL.ink;
      c.lineWidth = Math.max(0.6, h * 0.06);
      c.beginPath();
      c.moveTo(x, split);
      c.lineTo(x + w, split);
      c.moveTo(x + w / 2, y);
      c.lineTo(x + w / 2, split);
      c.stroke();
      if (g.button === 'wheel') {
        c.fillStyle = PAL.molten;
        rr(c, x + w / 2 - h * 0.08, y + h * 0.12, h * 0.16, h * 0.24, h * 0.08);
        c.fill();
      }
      break;
    }
    case 'touch': {
      const cx = x + w / 2;
      c.strokeStyle = CAP_TOP;
      c.globalAlpha = 0.55;
      c.lineWidth = h * 0.09;
      c.beginPath();
      c.arc(cx, cy, h * 0.42, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = PAL.ink;
      c.beginPath();
      c.arc(cx, cy, h * 0.27, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = CAP_TOP;
      c.beginPath();
      c.arc(cx, cy, h * 0.21, 0, Math.PI * 2);
      c.fill();
      break;
    }
  }
  c.restore();
  return w;
}

function drawPad(c: CanvasRenderingContext2D, b: PadButton, x: number, cy: number, w: number, h: number) {
  const y = cy - h / 2;
  if (b === 'A' || b === 'B' || b === 'X' || b === 'Y') {
    const f = FACE[b];
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.arc(x + w / 2, cy, h / 2 + 0.7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = f.fill;
    c.beginPath();
    c.arc(x + w / 2, cy, h / 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath();
    c.arc(x + w / 2, cy - h * 0.08, h * 0.36, Math.PI * 1.05, Math.PI * 1.95);
    c.fill();
    c.fillStyle = f.ink;
    c.font = `800 ${h * 0.62}px ${FONT.ui}`;
    c.fillText(b, x + w / 2, cy + h * 0.02);
    return;
  }
  if (b === 'LB' || b === 'RB' || b === 'LT' || b === 'RT') {
    const left = b[0] === 'L';
    const trig = b[1] === 'T';
    const big = h * (trig ? 0.55 : 0.42);
    const radii = left ? [big, h * 0.2, h * 0.2, h * 0.2] : [h * 0.2, big, h * 0.2, h * 0.2];
    c.fillStyle = PAL.ink;
    rr(
      c,
      x - 0.7,
      y - 0.7,
      w + 1.4,
      h + 1.4,
      radii.map((r) => r + 0.7),
    );
    c.fill();
    c.fillStyle = PAD_BODY;
    rr(c, x, y, w, h, radii);
    c.fill();
    c.fillStyle = PAL.bone;
    c.font = `800 ${h * 0.52}px ${FONT.ui}`;
    c.fillText(b, x + w / 2, cy + h * 0.04);
    return;
  }
  if (b === 'MENU') {
    c.fillStyle = PAL.ink;
    rr(c, x - 0.7, y - 0.7, w + 1.4, h + 1.4, h / 2);
    c.fill();
    c.fillStyle = PAD_BODY;
    rr(c, x, y, w, h, h / 2);
    c.fill();
    c.fillStyle = PAL.bone;
    for (let i = -1; i <= 1; i++) c.fillRect(x + w * 0.3, cy + i * h * 0.2 - h * 0.05, w * 0.4, h * 0.1);
    return;
  }
  if (b === 'LS') {
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.arc(x + w / 2, cy, h / 2 + 0.7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PAD_BODY;
    c.beginPath();
    c.arc(x + w / 2, cy, h / 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5a514c';
    c.beginPath();
    c.arc(x + w / 2, cy, h * 0.32, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PAL.bone;
    c.font = `800 ${h * 0.42}px ${FONT.ui}`;
    c.fillText('L', x + w / 2, cy + h * 0.03);
    return;
  }
  // D-pad: a cross, with the active arm lit.
  const a = h * 0.36;
  const cx = x + w / 2;
  const arm = (dx: number, dy: number) => c.fillRect(cx - a / 2 + dx * (h / 2 - a / 2), cy - a / 2 + dy * (h / 2 - a / 2), a, a);
  c.fillStyle = PAL.ink;
  c.fillRect(cx - a / 2 - 0.7, y - 0.7, a + 1.4, h + 1.4);
  c.fillRect(x - 0.7, cy - a / 2 - 0.7, w + 1.4, a + 1.4);
  c.fillStyle = PAD_BODY;
  c.fillRect(cx - a / 2, y, a, h);
  c.fillRect(x, cy - a / 2, w, a);
  c.fillStyle = PAL.bone;
  if (b === 'DUP') arm(0, -1);
  else if (b === 'DDOWN') arm(0, 1);
  else {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ])
      arm(dx, dy);
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The same glyph as an inline SVG string, `h` CSS px tall. Used by DOM
 * overlays and server-rendered pages (text widths are estimated).
 */
export function glyphSVG(g: Glyph, h = 20): string {
  const svg = (w: number, body: string) =>
    `<svg class="slag-glyph" xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${h + 2}" viewBox="-1 -1 ${(w + 2).toFixed(1)} ${h + 3}" aria-hidden="true">${body}</svg>`;
  const text = (s: string, x: number, y: number, size: number, fill: string, weight = 700) =>
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family='${FONT.ui.replace(/"/g, '')}' font-weight="${weight}" font-size="${size.toFixed(1)}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${esc(s)}</text>`;
  switch (g.kind) {
    case 'key': {
      const w = keyWidth(g.label, h, approxTextW);
      const r = h * 0.22;
      return svg(
        w,
        `<rect x="-0.6" y="-0.6" width="${w + 1.2}" height="${h + 1.8}" rx="${r + 0.6}" fill="${PAL.ink}"/>` +
          `<rect width="${w}" height="${h + 0.6}" rx="${r}" fill="${CAP_SIDE}"/>` +
          `<rect width="${w}" height="${h * 0.86}" rx="${r}" fill="${CAP_TOP}"/>` +
          text(g.label, w / 2, h * 0.44, h * 0.56, PAL.ink),
      );
    }
    case 'pad': {
      const b = g.button;
      const w = padWidth(b, h);
      if (b === 'A' || b === 'B' || b === 'X' || b === 'Y') {
        const f = FACE[b];
        return svg(
          w,
          `<circle cx="${w / 2}" cy="${h / 2}" r="${h / 2 + 0.7}" fill="${PAL.ink}"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 2}" fill="${f.fill}"/>` +
            text(b, w / 2, h * 0.52, h * 0.62, f.ink, 800),
        );
      }
      if (b === 'LB' || b === 'RB' || b === 'LT' || b === 'RT') {
        return svg(
          w,
          `<rect width="${w}" height="${h}" rx="${h * 0.3}" fill="${PAD_BODY}" stroke="${PAL.ink}" stroke-width="1.2"/>` +
            text(b, w / 2, h * 0.54, h * 0.52, PAL.bone, 800),
        );
      }
      if (b === 'MENU') {
        const bars = [-1, 0, 1]
          .map((i) => `<rect x="${w * 0.3}" y="${h / 2 + i * h * 0.2 - h * 0.05}" width="${w * 0.4}" height="${h * 0.1}" fill="${PAL.bone}"/>`)
          .join('');
        return svg(w, `<rect width="${w}" height="${h}" rx="${h / 2}" fill="${PAD_BODY}" stroke="${PAL.ink}" stroke-width="1.2"/>${bars}`);
      }
      if (b === 'LS')
        return svg(
          w,
          `<circle cx="${w / 2}" cy="${h / 2}" r="${h / 2}" fill="${PAD_BODY}" stroke="${PAL.ink}" stroke-width="1.2"/><circle cx="${w / 2}" cy="${h / 2}" r="${h * 0.32}" fill="#5a514c"/>` +
            text('L', w / 2, h * 0.53, h * 0.42, PAL.bone, 800),
        );
      const a = h * 0.36;
      const lit = b === 'DUP' ? [[0, -1]] : b === 'DDOWN' ? [[0, 1]] : [];
      const arms = lit
        .map(
          ([dx, dy]) =>
            `<rect x="${w / 2 - a / 2 + dx * (h / 2 - a / 2)}" y="${h / 2 - a / 2 + dy * (h / 2 - a / 2)}" width="${a}" height="${a}" fill="${PAL.bone}"/>`,
        )
        .join('');
      return svg(
        w,
        `<path d="M${w / 2 - a / 2} 0h${a}v${h / 2 - a / 2}h${h / 2 - a / 2}v${a}h-${h / 2 - a / 2}v${h / 2 - a / 2}h-${a}v-${h / 2 - a / 2}h-${h / 2 - a / 2}v-${a}h${h / 2 - a / 2}z" fill="${PAD_BODY}" stroke="${PAL.ink}" stroke-width="1.2"/>${arms}`,
      );
    }
    case 'mouse': {
      const w = h * 0.72;
      const r = w / 2;
      const split = h * 0.45;
      const lit =
        g.button === 'left'
          ? `<path d="M0 ${split}V${r}A${r} ${r} 0 0 1 ${r} 0V${split}z" fill="${PAL.molten}"/>`
          : g.button === 'right'
            ? `<path d="M${r} 0A${r} ${r} 0 0 1 ${w} ${r}V${split}H${r}z" fill="${PAL.molten}"/>`
            : g.button === 'wheel'
              ? `<rect x="${w / 2 - h * 0.08}" y="${h * 0.12}" width="${h * 0.16}" height="${h * 0.24}" rx="${h * 0.08}" fill="${PAL.molten}"/>`
              : '';
      return svg(
        w,
        `<rect width="${w}" height="${h}" rx="${r}" fill="${CAP_TOP}" stroke="${PAL.ink}" stroke-width="1.2"/>${lit}<path d="M0 ${split}H${w}M${w / 2} 0V${split}" stroke="${PAL.ink}" stroke-width="${Math.max(0.8, h * 0.06)}"/>`,
      );
    }
    case 'touch':
      return svg(
        h,
        `<circle cx="${h / 2}" cy="${h / 2}" r="${h * 0.42}" fill="none" stroke="${CAP_TOP}" stroke-opacity=".55" stroke-width="${h * 0.09}"/><circle cx="${h / 2}" cy="${h / 2}" r="${h * 0.24}" fill="${CAP_TOP}" stroke="${PAL.ink}" stroke-width="1.2"/>`,
      );
  }
}
