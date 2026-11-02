import { css, type HSL } from '../../core/color';
import { hash2 } from '../../core/rng';
import { TILE } from '../../sim/constants';
import type { Cell, Vec } from '../../core/geom';
import type { SpikeLook } from '../../sim/props';
import { blob, line, type P, shadeOf, stroke } from '../ink';
import { spikeSprite } from '../ink-build';
import { path, pen, type Sprite, sprite, stamp } from '../ink-props';

/**
 * What a spike strip is made of, for the stage concepts (docs/SETPIECES.md, Spike looks): a broken
 * window's glass, bramble thorns, a geode's crystals, icicles, a barn's pitchfork tines. Each is one
 * cell's worth of art, baked per look, light side and variant and stamped per cell, in the same frame as
 * the plain rail: the host face is x = 8 and the points run to +x. Everything that looks sharp stays in
 * the sim's hazard strip (x 8..15, y -6..6) to within EDGE_DRIFT; only the mount along the face (sill,
 * stem, crust, haft) runs the cell's full width, as the plain rail's bar does.
 */

/** The strip's frame, for a test that holds every look to the hazard. */
export const SPIKE_FRAME = { face: 8, reach: 7, half: 6 } as const;

const fill = (g: CanvasRenderingContext2D, pts: readonly P[], col: string) => {
  g.fillStyle = col;
  path(g, pts);
  g.fill();
};

/**
 * A tapering horn along a quadratic spine p0 → p1 → p2: the whole outline, and its two halves cut down
 * the spine (`neg` on the spine's left, which is -y for a spine running +x).
 */
export function horn(p0: P, p1: P, p2: P, hw: number, ease = 1, n = 8): { all: P[]; neg: P[]; pos: P[] } {
  const L: P[] = [];
  const R: P[] = [];
  const S: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
    const y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
    const dx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dy = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    const d = Math.hypot(dx, dy) || 1;
    const w = hw * Math.pow(1 - t, ease);
    L.push({ x: x + (dy / d) * w, y: y - (dx / d) * w });
    R.push({ x: x - (dy / d) * w, y: y + (dx / d) * w });
    S.push({ x, y });
  }
  const rev = (a: P[]) => {
    const r: P[] = [];
    for (let i = a.length - 1; i >= 0; i--) r.push(a[i]);
    return r;
  };
  return { all: [...L, ...rev(R).slice(1)], neg: [...L, ...rev(S).slice(1)], pos: [...S, ...rev(R).slice(1)] };
}

/** The two flanks of a horn in a lit and a shaded tone, by which side faces the light. */
function flanks(g: CanvasRenderingContext2D, h: ReturnType<typeof horn>, upLit: boolean, lit: string, dark: string) {
  fill(g, h.neg, upLit ? lit : dark);
  fill(g, h.pos, upLit ? dark : lit);
}

const at = (x: number, y: number): P => ({ x, y });
/** A hash in [-1, 1). */
const jit = (i: number, k: number, seed: number) => hash2(i, k, seed) * 2 - 1;

// ------------------------------------------------------------------------------------------------- glass

const GLASS = { lit: 'hsl(176 52% 88%)', mid: 'hsl(186 44% 70%)', band: 'hsl(196 38% 52%)', dark: 'hsl(204 36% 42%)', ink: '#13303a' };

/** Broken window shards in a putty sill: flat cel planes, a hard white sliver on the lit edge, one glint. */
function glass(g: CanvasRenderingContext2D, upLit: boolean, seed: number) {
  // The sill they're stuck in.
  g.fillStyle = GLASS.ink;
  line(g, 8.5, -7.9, 8.5, 7.9, { w: 2.6, seed, taper: [0.04, 0.04], press: 0.15 });
  g.fillStyle = 'hsl(30 18% 34%)';
  line(g, 8.3, -7.4, 8.3, 7.4, { w: 1.3, seed: seed + 1, taper: [0.05, 0.05], press: 0.2 });
  const ys = [-4.2, 0.2, 4.4];
  // Tall, short and middling, in an order the variant picks, so no two cells stand alike.
  const lens = [6.1, 3.4, 4.8];
  const rot = seed % 3;
  let glintAt = at(0, 0);
  for (let i = 0; i < 3; i++) {
    const yc = ys[i] + jit(i, 1, seed) * 0.5;
    const len = lens[(i + rot) % 3] + hash2(i, 2, seed) * 0.4;
    const hw = 1.6 + hash2(i, 3, seed) * 0.7;
    const y0 = Math.max(-6.6, yc - hw);
    const y1 = Math.min(6.6, yc + hw);
    const tipY = Math.max(-5.6, Math.min(5.6, yc + jit(i, 4, seed) * 2.2));
    const tip = at(9.2 + len, tipY);
    const litB = at(9, upLit ? y0 : y1);
    const darkB = at(9, upLit ? y1 : y0);
    const litE = (t: number) => at(litB.x + (tip.x - litB.x) * t, litB.y + (tip.y - litB.y) * t);
    const darkE = (t: number) => at(darkB.x + (tip.x - darkB.x) * t, darkB.y + (tip.y - darkB.y) * t);
    const midE = (t: number) => at((litE(t).x + darkE(t).x) / 2, (litE(t).y + darkE(t).y) / 2);
    // One flank snapped in a notch: that jag is what makes it a shard and not a cone.
    const k = 0.42 + hash2(i, 6, seed) * 0.22;
    const onLit = hash2(i, 5, seed) < 0.5;
    const e = onLit ? litE(k) : darkE(k);
    const notch = at(e.x + 0.5, e.y + (midE(k).y - e.y) * 0.55);
    const pts = onLit ? [litB, notch, tip, darkB] : [litB, tip, notch, darkB];
    fill(g, pts, GLASS.mid);
    // Flat cuts, no gradient: the lit plane, a dark band of what's seen through it, the shaded corner.
    fill(g, [litB, litE(0.97), midE(0.6), midE(0.08)], GLASS.lit);
    fill(g, [litE(0.4), litE(0.56), darkE(0.42), darkE(0.24)], GLASS.band);
    fill(g, [darkB, darkE(0.45), midE(0.12)], GLASS.dark);
    // The hard highlight along the lit edge.
    g.fillStyle = 'rgba(255,255,255,0.95)';
    const inset = upLit ? 0.45 : -0.45;
    stroke(g, [at(litE(0.18).x + 0.2, litE(0.18).y + inset), at(litE(0.7).x, litE(0.7).y + inset * 0.6)], {
      w: 0.55,
      seed: seed + i,
      taper: [0.3, 0.4],
      press: 0,
    });
    pen(g, pts, seed + i * 3, 0.35, 0.8, 3, GLASS.ink);
    if ((i + rot) % 3 === 0) glintAt = midE(0.66);
  }
  // A glint on the tallest: a hard four-point star near its point.
  const gx = glintAt.x;
  const gy = glintAt.y;
  g.fillStyle = '#ffffff';
  line(g, gx - 1.3, gy, gx + 1.3, gy, { w: 0.5, seed: 1, taper: [0.45, 0.45], press: 0 });
  line(g, gx, gy - 1.3, gx, gy + 1.3, { w: 0.5, seed: 2, taper: [0.45, 0.45], press: 0 });
}

// ------------------------------------------------------------------------------------------------- thorn

const BARK: HSL = { h: 24, s: 34, l: 27 };
const THORN = { lit: 'hsl(34 42% 52%)', dark: 'hsl(22 40% 30%)', tip: 'hsl(42 45% 84%)', ink: '#1e1007' };

/** A bramble stem along the face, hooked woody thorns off it, and a leaf now and then. */
function thorn(g: CanvasRenderingContext2D, upLit: boolean, seed: number) {
  const stem: P[] = [];
  for (let y = -8; y <= 8; y += 2) stem.push(at(9.2 + Math.sin(y * 0.55 + seed) * 0.5, y));
  g.fillStyle = THORN.ink;
  stroke(g, stem, { w: 3.3, seed, taper: [0.02, 0.02], press: 0.25 });
  g.fillStyle = css(BARK);
  stroke(g, stem, { w: 2, seed: seed + 1, taper: [0.03, 0.03], press: 0.3 });
  g.fillStyle = css(BARK, 16);
  stroke(
    g,
    stem.map((p) => at(p.x - 0.45, p.y)),
    { w: 0.5, seed: seed + 2, taper: [0.2, 0.2], press: 0.4 },
  );
  if (hash2(seed, 9, 3) < 0.5) {
    // A leaf off the stem, short of the strip's points.
    const ly = hash2(seed, 10, 3) < 0.5 ? -6.2 : 6.2;
    const leaf = horn(at(9.6, ly), at(11.4, ly + Math.sign(ly) * -0.6), at(12.4, ly - Math.sign(ly) * 0.2), 1.2, 0.6, 6);
    fill(g, leaf.all, 'hsl(96 38% 36%)');
    fill(g, upLit ? leaf.neg : leaf.pos, 'hsl(92 40% 48%)');
    pen(g, leaf.all, seed + 5, 0.25, 0.5, 2, '#13230a');
  }
  for (let i = 0; i < 3; i++) {
    const yc = -4.3 + i * 4.3 + jit(i, 1, seed) * 0.4;
    // Each hooks one way or the other, like a rose's.
    const bend = hash2(i, 2, seed) < 0.5 ? -1 : 1;
    const len = 5.6 + hash2(i, 3, seed) * 0.8;
    const tipY = Math.max(-5.8, Math.min(5.8, yc + bend * 1.9));
    const h = horn(at(9.4, yc - bend * 0.4), at(9.4 + len * 0.62, yc - bend * 0.7), at(9.4 + len, tipY), 2.3, 1.25, 9);
    flanks(g, h, upLit, THORN.lit, THORN.dark);
    // The pale, hard point.
    const n = h.all.length;
    const mid = n >> 1;
    fill(g, h.all.slice(mid - 2, mid + 3), THORN.tip);
    pen(g, h.all, seed + i * 5, 0.4, 0.9, 2, THORN.ink);
  }
}

// ----------------------------------------------------------------------------------------------- crystal

const GEM = { lit: 'hsl(292 62% 82%)', mid: 'hsl(284 52% 60%)', dark: 'hsl(272 48% 38%)', ink: '#24103a' };
const ROCK: HSL = { h: 268, s: 10, l: 30 };

/** Faceted gem points out of a lump of geode rock: three flat tones a facet, a hard white sliver on the lit one. */
function crystal(g: CanvasRenderingContext2D, upLit: boolean, seed: number) {
  // The rock they grow out of.
  const rock: P[] = [];
  for (let y = -8; y <= 8; y += 2) rock.push(at(10 + hash2(y, 1, seed) * 0.9, y));
  const lump = [at(7.4, -8), ...rock, at(7.4, 8)];
  fill(g, lump, css(ROCK));
  fill(
    g,
    lump.map((p) => at(Math.min(p.x, 7.4 + (p.x - 7.4) * 0.55), p.y)),
    css(ROCK, -10),
  );
  pen(g, lump, seed, 0.4, 0.9, 3, GEM.ink);
  const order = [1, 0, 2];
  for (const i of order) {
    // The middle one tallest and straight, the outer ones shorter and leaning out.
    const lean = (i - 1) * (0.26 + hash2(i, 1, seed) * 0.08);
    const len = i === 1 ? 5.8 + hash2(i, 2, seed) * 0.4 : 4.6 + hash2(i, 2, seed) * 0.9;
    const hw = i === 1 ? 2.2 : 1.7;
    const yc = (i - 1) * 3.9 + jit(i, 3, seed) * 0.3;
    const ux = Math.cos(lean);
    const uy = Math.sin(lean);
    const P0 = (a: number, b: number) => at(9.2 + ux * a - uy * b, yc + uy * a + ux * b);
    const sh = len - hw * 1.3;
    const r = hw * 0.32;
    const bl = P0(0, -hw);
    const sl = P0(sh, -hw);
    const tip = P0(len, 0);
    const sr = P0(sh, hw);
    const br = P0(0, hw);
    const rl = [P0(0, -r), P0(sh + 0.3, -r)];
    const rr = [P0(0, r), P0(sh + 0.3, r)];
    const neg = [bl, sl, tip, rl[1], rl[0]];
    const ctr = [rl[0], rl[1], tip, rr[1], rr[0]];
    const pos = [rr[0], rr[1], tip, sr, br];
    fill(g, neg, upLit ? GEM.lit : GEM.dark);
    fill(g, ctr, GEM.mid);
    fill(g, pos, upLit ? GEM.dark : GEM.lit);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    const e = upLit ? [P0(sh * 0.2, -hw + 0.55), P0(sh * 0.85, -hw + 0.55)] : [P0(sh * 0.2, hw - 0.55), P0(sh * 0.85, hw - 0.55)];
    stroke(g, e, { w: 0.5, seed: seed + i, taper: [0.3, 0.4], press: 0 });
    g.fillStyle = GEM.ink;
    stroke(g, [rl[0], rl[1], tip], { w: 0.3, seed: seed + i + 2, taper: [0.2, 0.2], press: 0.1 });
    stroke(g, [rr[0], rr[1], tip], { w: 0.3, seed: seed + i + 3, taper: [0.2, 0.2], press: 0.1 });
    pen(g, [bl, sl, tip, sr, br], seed + i * 7, 0.4, 0.95, 3, GEM.ink);
  }
}

// ------------------------------------------------------------------------------------------------ icicle

const ICE = { lit: 'hsl(194 72% 88%)', dark: 'hsl(204 52% 66%)', crust: 'hsl(196 60% 92%)', ink: '#1d4a63' };

/** A crust of ice along the face with tapered icicles off it, long and short, each with a white highlight. */
function icicle(g: CanvasRenderingContext2D, upLit: boolean, seed: number) {
  const ys = [-4.7, -1.5, 1.7, 4.8];
  for (let i = 0; i < 4; i++) {
    const yc = ys[i] + jit(i, 1, seed) * 0.35;
    const len = (i % 2 === (seed & 1) ? 5.8 : 4.4) + hash2(i, 2, seed) * 0.9;
    const sway = jit(i, 3, seed) * 0.5;
    const h = horn(at(9, yc), at(9 + len * 0.5, yc + sway), at(9.2 + len, yc + sway * 0.4), 1.75, 1.15, 8);
    flanks(g, h, upLit, ICE.lit, ICE.dark);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    const side = upLit ? -1 : 1;
    stroke(g, [at(10, yc + side * 0.75), at(9 + len * 0.62, yc + sway * 0.6 + side * 0.25)], { w: 0.5, seed: seed + i, taper: [0.2, 0.5], press: 0 });
    pen(g, h.all, seed + i * 3, 0.3, 0.7, 2, ICE.ink);
  }
  // The crust they hang from, over their roots.
  const crust: P[] = [at(7.4, -8)];
  for (let y = -8; y <= 8; y += 1.6) crust.push(at(9.4 + Math.max(0, Math.sin(y * 1.3 + seed)) * 0.8, y));
  crust.push(at(7.4, 8));
  fill(g, crust, ICE.crust);
  pen(g, crust, seed + 9, 0.3, 0.7, 3, ICE.ink);
}

// --------------------------------------------------------------------------------------------- pitchfork

const WOOD: HSL = { h: 30, s: 46, l: 44 };
const STEEL = { lit: 'hsl(205 16% 90%)', dark: 'hsl(212 12% 52%)', yoke: 'hsl(214 10% 40%)', ink: '#14161b' };

/** A fork head per cell: slender tines up out of a forged bow, socketed on a wooden haft that runs along the face. */
function pitchfork(g: CanvasRenderingContext2D, upLit: boolean, seed: number) {
  // The haft.
  g.fillStyle = '#1d1209';
  line(g, 8.6, -8.4, 8.6, 8.4, { w: 2.9, seed, taper: [0.01, 0.01], press: 0.15 });
  g.fillStyle = css(WOOD);
  line(g, 8.5, -8.2, 8.5, 8.2, { w: 1.7, seed: seed + 1, taper: [0.01, 0.01], press: 0.2 });
  g.fillStyle = css(WOOD, 18);
  line(g, upLit ? 8 : 9, -7, upLit ? 8 : 9, -1.5, { w: 0.45, seed: seed + 2, taper: [0.3, 0.3], press: 0.4 });
  g.fillStyle = css(WOOD, -16);
  line(g, 8.6, 1, 8.6, 5.5, { w: 0.4, seed: seed + 3, taper: [0.3, 0.3], press: 0.4 });
  // The bow: low in the middle where it's socketed on, its shoulders swept out to the outer tines.
  const n = 3 + (seed & 1);
  const span = 5.2;
  const bowX = (y: number) => 10 + (y / span) ** 2 * 1.3;
  const bow: P[] = [];
  for (let k = 0; k <= 10; k++) bow.push(at(bowX(-span + (k / 10) * span * 2), -span + (k / 10) * span * 2));
  g.fillStyle = STEEL.ink;
  stroke(g, bow, { w: 2.5, seed: seed + 4, taper: [0.08, 0.08], press: 0.1 });
  g.fillStyle = STEEL.yoke;
  stroke(g, bow, { w: 1.3, seed: seed + 5, taper: [0.1, 0.1], press: 0.1 });
  // The socket on the haft.
  const sock = [at(9.2, -1.3), at(10.6, -1), at(10.6, 1), at(9.2, 1.3)];
  fill(g, sock, STEEL.yoke);
  pen(g, sock, seed + 6, 0.3, 0.6, 2, STEEL.ink);
  for (let i = 0; i < n; i++) {
    const y = -span + (i * span * 2) / (n - 1);
    // Slender, and the outer ones toe in a touch, the way a fork's do.
    const h = horn(at(bowX(y) - 0.2, y), at(13, y * 0.97), at(15.6 - hash2(i, 1, seed) * 0.4, y * 0.88), 0.8, 0.45, 8);
    flanks(g, h, upLit, STEEL.lit, STEEL.dark);
    pen(g, h.all, seed + i * 3, 0.3, 0.65, 2, STEEL.ink);
  }
  // A fleck of rust on the bow.
  g.fillStyle = 'hsl(18 62% 40%)';
  blob(g, bowX(2.6) - 0.1, 2.6 - (seed & 3) * 1.6, 0.45, seed, 1, 0.2);
  g.fill();
}

const DRAW: Record<SpikeLook, (g: CanvasRenderingContext2D, upLit: boolean, seed: number) => void> = { glass, thorn, crystal, icicle, pitchfork };

/** One cell of a look, baked per light side and variant. Stamp it in the face's frame, like `spikeSprite`. */
export function spikeLookSprite(look: SpikeLook, angle: number, seed: number): Sprite {
  const upLit = shadeOf(Math.sin(angle), -Math.cos(angle)) < 0.5;
  const v = seed & 3;
  return sprite(`spk|${look}|${upLit}|${v}`, 4.5, -9.5, 13.5, 19, (g) => DRAW[look](g, upLit, v * 7 + 3));
}

/** Draw every look straight into `g` (no bake), for the hazard-fit test. */
export function drawSpikeLook(g: CanvasRenderingContext2D, look: SpikeLook, upLit: boolean, v: number) {
  DRAW[look](g, upLit, v * 7 + 3);
}

/** A spike strip on these cells' faces: the look's art, or the plain rail in `rail`'s metal. */
export function drawSpikeCells(s: CanvasRenderingContext2D, cells: readonly Cell[], angle: number, look: SpikeLook | undefined, rail: HSL, off: Vec = [0, 0]) {
  for (const [x, y] of cells) {
    s.save();
    s.translate((x + 0.5) * TILE + off[0], (y + 0.5) * TILE + off[1]);
    s.rotate(angle);
    const seed = x * 31 + y * 17;
    stamp(s, look ? spikeLookSprite(look, angle, seed) : spikeSprite(angle, seed, rail));
    s.restore();
  }
}
