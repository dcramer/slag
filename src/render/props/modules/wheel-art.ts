import { css, type HSL } from '../../../core/color';
import type { Rect } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import type { ModuleOf, PropStyle, RotorArm } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { inkLoop } from '../../ink-parts';
import { ball, boxPts, dot, glint, INK, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import type { MetalPalette, RC } from '../../kit';
import { arcPts } from '../ink-motion';

type Rotor = ModuleOf<'rotor'>;

/**
 * The fairground wheel (wheel archetype: Ferris Wheel, Cog Lift, Hamster Wheel, Lazy Susan): a fat cast
 * gear with spoke windows turning on a bolted boss, I-beam struts out to painted carnival gondola decks
 * with marquee bulbs on their skirts. The gear turns but its light doesn't: its outline is cut live and
 * toned with the light fixed up-left. The decks hold level, so each is baked once and stamped.
 */

const DARK = (pal: MetalPalette) => css({ h: pal.dark.h, s: pal.dark.s, l: 8 });

/** Outline of the gear, turned to `base`. */
function gearPts(hx: number, hy: number, R: number, base: number, seed: number, out: P[]): P[] {
  out.length = 0;
  const teeth = Math.max(10, Math.round(R * 0.62));
  const da = (Math.PI * 2) / teeth;
  const tip = Math.max(3, R * 0.2);
  for (let i = 0; i < teeth; i++) {
    const a0 = base + i * da;
    const wob = 1 + (hash2(i, 1, seed) - 0.5) * 0.08;
    // A tooth: a short flank up, a flat crown, a short flank down; a little round gullet between.
    const steps: [number, number][] = [
      [0.02, R],
      [0.14, R + tip * wob],
      [0.46, R + tip * wob],
      [0.58, R],
      [0.79, R - 0.6],
    ];
    for (const [u, r] of steps) out.push({ x: hx + Math.cos(a0 + da * u) * r, y: hy + Math.sin(a0 + da * u) * r });
  }
  return out;
}

const gearScratch: P[] = [];

/** A spoke window: a rounded sector between two radii, `span` radians wide, centered on angle `a`. */
function windowPts(hx: number, hy: number, r0: number, r1: number, a: number, span: number): P[] {
  const pts: P[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = a - span / 2 + (span * i) / n;
    pts.push({ x: hx + Math.cos(t) * r1, y: hy + Math.sin(t) * r1 });
  }
  const inner = span * (r1 / r0) * 0.55;
  for (let i = 0; i <= n; i++) {
    const t = a + inner / 2 - (inner * i) / n;
    pts.push({ x: hx + Math.cos(t) * r0, y: hy + Math.sin(t) * r0 });
  }
  return pts;
}

/** An I-beam strut from the hub out to a deck's pin: dark web, lit flange, rivets every so often. */
function strut(s: CanvasRenderingContext2D, hx: number, hy: number, x: number, y: number, pal: MetalPalette, seed: number) {
  const dx = x - hx;
  const dy = y - hy;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  // The flange that faces the light gets the lit edge.
  const up = ny < 0 || (ny === 0 && nx < 0) ? 1 : -1;
  s.fillStyle = DARK(pal);
  line(s, hx, hy, x, y, { w: 5, seed, taper: [0, 0.04], press: 0.15 });
  s.fillStyle = css(pal.base, -10);
  line(s, hx, hy, x, y, { w: 2.8, seed: seed + 1, taper: [0, 0], press: 0 });
  s.fillStyle = css(pal.light, -4);
  line(s, hx + nx * up * 0.85, hy + ny * up * 0.85, x + nx * up * 0.85, y + ny * up * 0.85, { w: 0.8, seed: seed + 2, taper: [0.1, 0.2], press: 0.2 });
  for (let t = 0.42; t < 0.95; t += 0.26) {
    s.fillStyle = DARK(pal);
    blob(s, hx + dx * t, hy + dy * t, 0.75, seed + t * 10, 1, 0.1);
    s.fill();
  }
}

/** The wheel: struts to every deck, then the gear over them. */
export function cogWheel(rc: RC, m: Rotor, pal: MetalPalette, arms: readonly RotorArm[], hx: number, hy: number, base: number) {
  const s = rc.s;
  const R = Math.min(m.arm * 0.5, 30);
  for (let i = 0; i < arms.length; i++) strut(s, hx, hy, arms[i].x, arms[i].y, pal, 11 + i);
  // A drop shadow on the wall behind: the gear's silhouette, hard, down and to the right.
  const pts = gearPts(hx, hy, R, base, m.seed & 0xffff, gearScratch);
  rc.bg.fillStyle = 'rgba(8,4,12,0.28)';
  rc.bg.save();
  rc.bg.translate(R * 0.14 + 1.5, R * 0.18 + 2);
  path(rc.bg, pts);
  rc.bg.fill();
  rc.bg.restore();
  tone(s, pts, pal.base, { depth: Math.max(1.2, R * 0.1), shade: -20 });
  // The rim stands proud of the web: a shadow ring just inside it, lit along the top.
  s.fillStyle = css(pal.dark, 6, 0.85);
  stroke(s, arcPts(hx, hy, R * 0.74, Math.PI * 0.05, Math.PI * 1.1, 14), { w: Math.max(1, R * 0.08), seed: 3, taper: [0.3, 0.3], press: 0.2 });
  s.fillStyle = css(pal.light, -2);
  stroke(s, arcPts(hx, hy, R * 0.9, Math.PI * 1.08, Math.PI * 1.62, 12), { w: Math.max(0.8, R * 0.07), seed: 4, taper: [0.3, 0.4], press: 0.2 });
  // Spoke windows: deep inside, their lower-right wall catching the light.
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = base + (i + 0.5) * ((Math.PI * 2) / n);
    const w = windowPts(hx, hy, R * 0.36, R * 0.66, a, ((Math.PI * 2) / n) * 0.62);
    s.fillStyle = css(pal.base, -8);
    path(s, w);
    s.fill();
    s.save();
    s.clip();
    s.fillStyle = css(pal.dark, -12);
    path(
      s,
      w.map((q) => ({ x: q.x - 1.1, y: q.y - 1.2 })),
    );
    s.fill();
    s.restore();
    pen(s, w, 30 + i, 0.4, 0.9, 2, DARK(pal));
  }
  s.fillStyle = DARK(pal);
  inkLoop(s, pts, hx, hy, (m.seed & 0xff) + 5, 0.6, 1.8, 4);
}

/** The boss the wheel turns on: a domed cap, a ring of bolts that turn with it, and an axle nut. */
export function cogHub(s: CanvasRenderingContext2D, m: Rotor, pal: MetalPalette, hx: number, hy: number, base: number) {
  const R = Math.min(m.arm * 0.5, 30);
  const r = Math.max(4.5, R * 0.34);
  ball(s, hx, hy, r, pal.base, 131);
  for (let i = 0; i < 6; i++) {
    const a = base + (i / 6) * Math.PI * 2;
    dot(s, hx + Math.cos(a) * r * 0.62, hy + Math.sin(a) * r * 0.62, Math.max(0.55, r * 0.11), 140 + i, css(pal.spec, -6));
  }
  ball(s, hx, hy, Math.max(1.6, r * 0.32), { h: 44, s: 70, l: 52 }, 132);
}

/** Hamster Wheel: a drip bottle clipped under the hub, its spout toward whoever rides. */
export function waterBottle(s: CanvasRenderingContext2D, hx: number, hy: number, R: number) {
  const sp = sprite('wheel|bottle', -4, -2, 8, 17, (g) => {
    const glass: HSL = { h: 195, s: 45, l: 78 };
    const body = boxPts(-2.6, 0, 5.2, 10, 1.6, 7, 0.15);
    tone(g, body, glass, { depth: 0.6, shade: -16 });
    // Water to two-thirds, and a cap.
    g.fillStyle = css({ h: 200, s: 70, l: 58 }, 0, 0.85);
    path(g, boxPts(-2.2, 3.6, 4.4, 6, 1.2, 8, 0.1));
    g.fill();
    part(g, boxPts(-1.6, 10, 3.2, 1.8, 0.4, 9), { h: 0, s: 0, l: 30 }, 9, { depth: 0.3, thin: 0.3, thick: 0.6 });
    tick(g, 0, 11.8, 0.3, 15.5, 0.7, 10, INK);
    g.fillStyle = 'rgba(160,215,255,0.95)';
    blob(g, 0.4, 16, 0.6, 3, 1.2, 0.1);
    g.fill();
    pen(g, body, 7, 0.35, 0.8);
    glint(g, poly(-1.6, 1.6, -1.7, 4, -1.5, 6.5), 'rgba(255,255,255,0.9)', 0.6);
  });
  stamp(s, sp, hx + R * 0.2, hy + R * 0.38);
}

/**
 * A gondola car exactly on the platform rect: a wooden seat plank across the top, a painted tub under it
 * with a scalloped valance and marquee bulbs, and the pin the strut ends on bolted to its face.
 */
function deck(w: number, h: number, st: PropStyle, pal: MetalPalette) {
  const key = `wheel|deck|${w.toFixed(1)}x${h.toFixed(1)}|${st.hue | 0}|${st.woodHue | 0}|${pal.base.h},${pal.base.l}`;
  return sprite(key, -2, -2, w + 4, h + 4, (g) => {
    const paint: HSL = { h: st.hue, s: 74, l: 50 };
    const wood: HSL = { h: st.woodHue, s: 48, l: 56 };
    const top = Math.max(2.4, h * 0.36);
    const seed = (w * 7) | 0;
    // The tub, a hair inside the rect at the sides, its bottom corners well rounded.
    const tub = boxPts(0.7, top - 1, w - 1.4, h - top + 1, Math.min(3, (h - top) * 0.7), seed, 0.2);
    tone(g, tub, paint, { depth: Math.min(1.5, h * 0.18), shade: -24 });
    g.save();
    path(g, tub);
    g.clip();
    // The valance: light scallops hanging off the seat.
    const sc = Math.max(3.2, (w - 2) / Math.max(3, Math.round((w - 2) / 4.2)));
    g.fillStyle = css(paint, 30, 1, -18);
    for (let x = 1; x < w - 1; x += sc) {
      g.beginPath();
      g.arc(x + sc / 2, top, sc / 2, 0, Math.PI);
      g.fill();
    }
    g.fillStyle = INK;
    for (let x = 1; x < w - 1; x += sc)
      stroke(g, arcPts(x + sc / 2, top, sc / 2, 0.15, Math.PI - 0.15, 6), { w: 0.45, seed: x, taper: [0.3, 0.3], press: 0.2 });
    g.restore();
    pen(g, tub, seed + 1, 0.5, 1.7, 4);
    // Marquee bulbs along the skirt, clear of the pin.
    const nb = Math.max(2, Math.round(w / 8));
    const by = top + (h - top) * 0.62;
    for (let i = 0; i < nb; i++) {
      const bx = 3 + ((w - 6) * (i + 0.5)) / nb;
      if (Math.abs(bx - w / 2) < 3) continue;
      g.fillStyle = INK;
      blob(g, bx, by, 1.35, i + 50, 1, 0.08);
      g.fill();
      g.fillStyle = '#ffe9a0';
      blob(g, bx, by, 0.9, i + 60, 1, 0.08);
      g.fill();
      g.fillStyle = '#fffdf2';
      g.fillRect(bx - 0.55, by - 0.6, 0.5, 0.5);
    }
    // The seat plank: the whole width, grain and a nail at each end.
    const plank = boxPts(0, 0, w, top, Math.min(1.2, top * 0.4), seed + 2, 0.1);
    tone(g, plank, wood, { depth: 0.7, shade: -20 });
    for (let x = 3 + hash2(w, 1, 2) * 3; x < w - 4; x += 5 + hash2(x, 2, 3) * 4) tick(g, x, top * 0.42, x + 2.6, top * 0.48, 0.35, x, css(wood, -24));
    for (const nx of [1.8, w - 1.8]) dot(g, nx, top * 0.5, 0.45, nx, css(pal.spec));
    pen(g, plank, seed + 3, 0.45, 1.2, 3);
    // The pin the strut ends on, in a little steel plate on the face.
    const cx = w / 2;
    const cy = top + (h - top) * 0.5;
    part(g, boxPts(cx - 2, cy - 1.7, 4, 3.4, 0.8, 12), pal.base, 12, { depth: 0.4, thin: 0.3, thick: 0.7 });
    dot(g, cx, cy, 0.8, 13, css(pal.spec));
  });
}

export function cogDeck(s: CanvasRenderingContext2D, p: Rect, st: PropStyle, pal: MetalPalette) {
  stamp(s, deck(p.w, p.h, st, pal), p.x, p.y);
}
