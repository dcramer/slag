import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import type { ModuleOf } from '../../../sim/props';
import { shardSet } from '../../../sim/props/modules/shards';
import { line, type P, stroke } from '../../ink';
import { boxPts, path, pen, sprite, stamp, tone } from '../../ink-props';
import { glowDot, light, type RC } from '../../kit';
import { BACKDROP, type DrawCtx, defineArt } from '../common';

/**
 * A broken window's glass (sim/props/modules/shards.ts): the shards are the very triangles the sim cuts its
 * hazard from, each in flat cel planes (a lit face, a shaded face, a dark band of what's seen through it)
 * with a hard white sliver on its lit edge, baked once. Behind the frame, on BACKDROP, the night through the
 * broken pane: leading with a few panes of stained glass left in its corners. In front, the frame on the
 * wall around it, gilt that catches the moon, a glint that runs along the longest shard, and the moonlight
 * the window lets in.
 */

type Shards = ModuleOf<'shards'>;
type Glass = Pick<Shards, 'w' | 'h' | 'dir' | 'inset' | 'seed'>;

/** Glass is mostly what's behind it: the night, a sheen on the face that catches the moon, a white edge. */
const GLASS = {
  night: 'hsla(200 40% 34% / 0.45)',
  sheen: 'hsla(170 40% 88% / 0.9)',
  mid: 'hsla(186 40% 62% / 0.6)',
  dark: 'hsla(214 40% 12% / 0.7)',
  ink: '#0b1922',
};
const FRAME: HSL = { h: 22, s: 34, l: 22 };
const GILT: HSL = { h: 44, s: 70, l: 58 };
const NIGHT: HSL = { h: 228, s: 38, l: 13 };
const MOON: HSL = { h: 212, s: 60, l: 78 };
const PANES: HSL[] = [
  { h: 352, s: 62, l: 34 },
  { h: 42, s: 70, l: 42 },
  { h: 172, s: 46, l: 30 },
  { h: 268, s: 40, l: 34 },
];

const pt = (v: readonly [number, number]): P => ({ x: v[0], y: v[1] });
const mix = (a: P, b: P, t: number): P => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const fill = (g: CanvasRenderingContext2D, pts: readonly P[], col: string) => {
  g.fillStyle = col;
  path(g, pts);
  g.fill();
};

/** Which half of a shard faces the light (up and to the left): the one whose middle sits above (or left of) the spine. */
function litSide(a: P, tip: P, b: P): boolean {
  const m = mix(a, b, 0.5);
  const ca = mix(mix(a, tip, 0.5), m, 0.5);
  const cb = mix(mix(b, tip, 0.5), m, 0.5);
  return Math.abs(ca.y - cb.y) > 0.5 ? ca.y < cb.y : ca.x < cb.x;
}

/** Every shard, drawn into `g` in the box's px. Exported for the test that holds it to the hazard. */
export function drawShardGlass(g: CanvasRenderingContext2D, m: Glass): void {
  const set = shardSet(m);
  set.polys.forEach((t, i) => {
    const a = pt(t[0]);
    const tip = pt(t[1]);
    const b = pt(t[2]);
    const seed = m.seed + i * 13;
    const aLit = litSide(a, tip, b);
    const base = mix(a, b, 0.5);
    const lit = aLit ? a : b;
    const shade = aLit ? b : a;
    // Flat cuts, no gradient: the night seen through it, a sheen hugging the lit edge, a lighter middle
    // plane, and the shaded edge going dark.
    fill(g, [a, tip, b], GLASS.night);
    fill(g, [lit, tip, mix(lit, shade, 0.4)], GLASS.sheen);
    fill(g, [mix(lit, shade, 0.4), tip, mix(lit, shade, 0.62)], GLASS.mid);
    fill(g, [shade, mix(shade, tip, 0.6), mix(shade, lit, 0.22)], GLASS.dark);
    const k = 0.5 + hash2(i, 1, m.seed) * 0.12;
    fill(g, [mix(lit, tip, k), mix(lit, tip, k + 0.1), mix(mix(lit, shade, 0.4), tip, k + 0.06), mix(mix(lit, shade, 0.4), tip, k - 0.04)], GLASS.mid);
    // A crack across the bigger ones.
    const area = Math.abs((tip.x - a.x) * (b.y - a.y) - (tip.y - a.y) * (b.x - a.x)) / 2;
    if (area > 70) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      line(g, mix(base, a, 0.4).x, mix(base, a, 0.4).y, mix(mix(b, tip, 0.35), base, 0.25).x, mix(mix(b, tip, 0.35), base, 0.25).y, {
        w: 0.4,
        seed,
        taper: [0.3, 0.3],
        press: 0,
      });
    }
    // The hard highlight along the lit edge.
    const e0 = aLit ? a : b;
    const c = mix(mix(a, b, 0.5), tip, 0.35);
    const inset = (p: P) => mix(p, c, 0.12);
    g.fillStyle = 'rgba(255,255,255,0.97)';
    stroke(g, [inset(mix(e0, tip, 0.08)), inset(mix(e0, tip, 0.78))], { w: 0.95, seed: seed + 1, taper: [0.25, 0.45], press: 0 });
    // And a short one on the shaded edge, near the point, where it turns to the light.
    const e1 = aLit ? b : a;
    stroke(g, [inset(mix(e1, tip, 0.62)), inset(mix(e1, tip, 0.86))], { w: 0.5, seed: seed + 3, taper: [0.3, 0.3], press: 0 });
    pen(g, [a, tip, b], seed + 2, 0.35, 0.8, 3, GLASS.ink);
  });
}

/** The frame the glass stands in: posts and boards on the wall's faces around it, gilt along the edge. */
function frame(g: CanvasRenderingContext2D, m: Glass, W: number, H: number) {
  const R = m.inset * 16;
  const u2x = (u: number) => (m.dir > 0 ? u : W - u);
  const box = (u0: number, u1: number, v0: number, v1: number, seed: number) => {
    const x0 = Math.min(u2x(u0), u2x(u1));
    const pts = boxPts(x0, v0, Math.abs(u2x(u1) - u2x(u0)), v1 - v0, 0.5, seed, 0.1);
    tone(g, pts, FRAME, { depth: 0.6 });
    pen(g, pts, seed, 0.3, 0.8, 3);
    return x0;
  };
  // The back of the frame, and with a recess the lintel and sill boards round it; without one, short caps on the face.
  box(-3.5, 0, -1, H + 1, m.seed);
  if (R > 0) {
    box(-3.5, R + 1, -3.5, 0, m.seed + 1);
    box(-3.5, R + 1, H, H + 3.5, m.seed + 2);
  } else {
    box(-3.5, 1, -3, 0, m.seed + 1);
    box(-3.5, 1, H, H + 3, m.seed + 2);
  }
  // Gilt on the inner edge of the frame.
  g.fillStyle = css(GILT);
  const gx = u2x(-0.6);
  line(g, gx, 1, gx, H - 1, { w: 0.8, seed: m.seed + 3, taper: [0.1, 0.1], press: 0 });
  if (R > 0) {
    line(g, u2x(0), -0.8, u2x(R), -0.8, { w: 0.7, seed: m.seed + 4, taper: [0.1, 0.1], press: 0 });
    line(g, u2x(0), H + 0.8, u2x(R), H + 0.8, { w: 0.7, seed: m.seed + 5, taper: [0.1, 0.1], press: 0 });
  }
}

const key = (m: Glass) => `${m.w}|${m.h}|${m.dir}|${m.inset}|${m.seed}`;

function glassSprite(m: Glass) {
  const W = m.w * 16;
  const H = m.h * 16;
  return sprite(`shards|${key(m)}`, -6, -6, W + 12, H + 12, (g) => {
    frame(g, m, W, H);
    drawShardGlass(g, m);
  });
}

/** The night through the frame's recess: leading, a few panes of stained glass left in its corners. */
function nightSprite(m: Glass) {
  const W = m.w * 16;
  const H = m.h * 16;
  const R = m.inset * 16;
  return sprite(`shards-night|${key(m)}`, 0, 0, W, H, (g) => {
    const x0 = m.dir > 0 ? 0 : W - R;
    g.fillStyle = css(NIGHT);
    g.fillRect(x0, 0, R, H);
    g.fillStyle = css(NIGHT, 8);
    g.fillRect(x0, H * 0.55, R, H * 0.45);
    // The moon's light pooling low in the frame.
    g.fillStyle = css(MOON, -40, 0.35);
    g.fillRect(x0, H * 0.7, R, H * 0.3);
    // Leading: diamonds, a few still glazed in the corners where the glass held.
    const step = 6;
    for (let r = 0; r * step < H + step; r++)
      for (let c = 0; c * step < R + step; c++) {
        const cx = x0 + c * step + (r & 1 ? step / 2 : 0);
        const cy = r * step;
        const corner = cy < 7 || cy > H - 7;
        if (corner && hash2(r, c, m.seed) < 0.55) {
          g.fillStyle = css(PANES[(r + c + m.seed) % PANES.length]);
          path(g, [
            { x: cx, y: cy - step / 2 },
            { x: cx + step / 2, y: cy },
            { x: cx, y: cy + step / 2 },
            { x: cx - step / 2, y: cy },
          ]);
          g.fill();
        }
      }
    g.fillStyle = 'rgba(10,8,14,0.85)';
    for (let k = -H; k < R + H; k += step) {
      line(g, x0 + k, 0, x0 + k + H, H, { w: 0.6, seed: k, taper: [0, 0], press: 0 });
      line(g, x0 + k + H, 0, x0 + k, H, { w: 0.6, seed: k + 1, taper: [0, 0], press: 0 });
    }
    // Keep the leading inside the frame.
    g.clearRect(m.dir > 0 ? R : 0, 0, W - R, H);
  });
}

/** A glint that runs along the longest shard's lit edge every few seconds, and the moon's light. */
function glint(rc: RC, m: Shards, d: DrawCtx) {
  const set = shardSet(m);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const W = m.w * 16;
  const H = m.h * 16;
  light(rc, x + W / 2, y + H / 2, 34 + 10 * m.h, MOON, 0.55);
  let best = 0;
  let far = -1;
  set.polys.forEach((t, i) => {
    const reach = Math.abs(t[1][0] - (m.dir > 0 ? 0 : W));
    if (reach > far) {
      far = reach;
      best = i;
    }
  });
  const t = set.polys[best];
  if (!t) return;
  const period = 2.6 + hash2(m.seed, 1, 7) * 1.4;
  const u = (rc.t + hash2(m.seed, 2, 7) * period) % period;
  if (u > 0.55) return;
  const a = pt(t[0]);
  const b = pt(t[2]);
  const e = litSide(a, pt(t[1]), b) ? a : b;
  const p = mix(mix(e, pt(t[1]), 0.15 + (u / 0.55) * 0.7), mix(a, b, 0.5), 0.15);
  const gx = x + p.x;
  const gy = y + p.y;
  const k = Math.sin((u / 0.55) * Math.PI);
  rc.s.fillStyle = '#ffffff';
  line(rc.s, gx - 2.2 * k, gy, gx + 2.2 * k, gy, { w: 0.6, seed: 1, taper: [0.45, 0.45], press: 0 });
  line(rc.s, gx, gy - 2.2 * k, gx, gy + 2.2 * k, { w: 0.6, seed: 2, taper: [0.45, 0.45], press: 0 });
  glowDot(rc.g, gx, gy, 7 * k, MOON, 0.8);
}

defineArt<'shards'>({
  type: 'shards',
  layer: BACKDROP,
  draw: (rc, m, d) => {
    if (m.inset > 0) stamp(rc.s, nightSprite(m), m.at[0] + d.off[0], m.at[1] + d.off[1]);
  },
});
defineArt<'shards'>({ type: 'shards', layer: 2, draw: (rc, m, d) => stamp(rc.s, glassSprite(m), m.at[0] + d.off[0], m.at[1] + d.off[1]) });
defineArt<'shards'>({ type: 'shards', layer: 3, draw: glint });
