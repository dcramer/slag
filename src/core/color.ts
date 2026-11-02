export interface HSL {
  h: number;
  s: number;
  l: number;
}

export const hsl3 = (h: number, s: number, l: number): HSL => ({ h, s, l });

/** CSS color from an HSL with optional lightness/saturation/hue shifts and alpha. */
export function css(c: HSL, dl = 0, a = 1, ds = 0, dh = 0): string {
  const h = (((c.h + dh) % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, c.s + ds));
  const l = Math.max(0, Math.min(100, c.l + dl));
  return a >= 1
    ? `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${Math.max(0, a).toFixed(3)})`;
}

export function shift(c: HSL, dl = 0, ds = 0, dh = 0): HSL {
  return { h: c.h + dh, s: Math.max(0, Math.min(100, c.s + ds)), l: Math.max(0, Math.min(100, c.l + dl)) };
}

export function mixHsl(a: HSL, b: HSL, t: number): HSL {
  const dh = ((b.h - a.h + 540) % 360) - 180;
  return { h: a.h + dh * t, s: a.s + (b.s - a.s) * t, l: a.l + (b.l - a.l) * t };
}

/** HSL → linear-ish RGB triple in 0..1 (sRGB, no gamma handling). */
export function toRgb(c: HSL): [number, number, number] {
  const h = ((((c.h % 360) + 360) % 360) / 360) * 6;
  const s = c.s / 100;
  const l = c.l / 100;
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const X = C * (1 - Math.abs((h % 2) - 1));
  const m = l - C / 2;
  const [r, g, b] = h < 1 ? [C, X, 0] : h < 2 ? [X, C, 0] : h < 3 ? [0, C, X] : h < 4 ? [0, X, C] : h < 5 ? [X, 0, C] : [C, 0, X];
  return [r + m, g + m, b + m];
}
