import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_SOLID, tileAt } from '../../../sim/level';
import { FLOOD_WARN, type FloodLook, floodState, type ModuleOf } from '../../../sim/props';
import { blob, inkFor, line, type P, sn } from '../../ink';
import { sprite, stamp } from '../../ink-props';
import { light, type RC } from '../../kit';
import { BACKDROP, beamOf, type DrawCtx, defineArt } from '../common';

/**
 * Flood art: a liquid that rises and falls in a basin (sim/props/modules/flood.ts).
 *
 * - The body is flat bands, a light band under a hand-cut surface line over
 *   the body and its deep, on BACKDROP: the basin's own walls stand in front
 *   of it, so it fills whatever shape the basin has. The bands are baked once
 *   and stamped at the crest.
 * - In front: the pen crest, broken at fixed cells and drawn only over open
 *   columns, then glints, bubbles, and for lava its glow. The crest's y is the
 *   module's beam, the very number the sim kills with.
 * - Warn is a froth lip that rises on the crest and a boil of bubbles: the
 *   lip never kills, and the crest doesn't move until it's over.
 */

type Flood = ModuleOf<'flood'>;

export interface Liquid {
  /** Light band under the surface, body, deep. */
  top: HSL;
  body: HSL;
  deep: HSL;
  /** Glints and froth. */
  glint: HSL;
  hot: boolean;
}

const LAVA: Liquid = {
  top: { h: 36, s: 100, l: 60 },
  body: { h: 20, s: 100, l: 49 },
  deep: { h: 8, s: 92, l: 36 },
  glint: { h: 50, s: 100, l: 82 },
  hot: true,
};
const TOXIC: Liquid = {
  top: { h: 82, s: 85, l: 58 },
  body: { h: 96, s: 70, l: 41 },
  deep: { h: 112, s: 55, l: 26 },
  glint: { h: 70, s: 100, l: 82 },
  hot: false,
};
const WATER: Liquid = {
  top: { h: 192, s: 62, l: 56 },
  body: { h: 202, s: 62, l: 42 },
  deep: { h: 214, s: 58, l: 28 },
  glint: { h: 190, s: 80, l: 90 },
  hot: false,
};
const LOOKS: Record<FloodLook, Liquid> = { lava: LAVA, toxic: TOXIC, water: WATER };

/** Water takes the theme's hue where the theme's liquid is water, so a harbor floods with its sea. */
function liquidOf(m: Flood, d: DrawCtx): Liquid {
  const L = LOOKS[m.look];
  const th = d.o.level?.theme.liquid;
  if (m.look !== 'water' || !th || (th.kind !== 'water' && th.kind !== 'sea')) return L;
  // The sea's hue and the flood's own lightness: a night sea is nearly the sky's color, and a flood must read against it.
  const tint = (t: HSL): HSL => ({ h: th.color.h, s: Math.max(40, th.color.s), l: t.l });
  return { ...L, top: tint(L.top), body: tint(L.body), deep: tint(L.deep) };
}

/** The crest's height above the basin floor: the sim's beam in a race or a preview, the cycle itself on a card. */
function heightOf(m: Flood, d: DrawCtx, frame: number): number {
  return beamOf(d.o, d.r, d.mi)?.len ?? floodState(m, frame, d.r.phase).height;
}

/** Light band and the surface line under it, px below the crest. */
const BAND = 3.5;
const BODY = 11;

/** The surface's bands, baked across the flood's width: a light band, the body, and the cut into the deep, keyed to world x. */
function bands(x0: number, w: number, L: Liquid) {
  return sprite(`flood|${x0}|${w}|${L.top.h},${L.top.l}|${L.body.h},${L.body.l}`, 0, 0, w, BODY + 3, (g) => {
    const cut = (y: number, amp: number, seed: number): P[] => {
      const pts: P[] = [];
      for (let x = 0; x <= w; x += 4) pts.push({ x, y: y + sn((x0 + x) * 0.09, seed, 7) * amp });
      return pts;
    };
    const fill = (top: P[], c: string) => {
      g.fillStyle = c;
      g.beginPath();
      top.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.lineTo(w, BODY + 3);
      g.lineTo(0, BODY + 3);
      g.closePath();
      g.fill();
    };
    fill(cut(0, 0, 1), css(L.top));
    fill(cut(BAND, 0.8, 2), css(L.body));
    fill(cut(BODY, 1.6, 3), css(L.deep));
    // Slicks on the body: short flat streaks in the light tone, sparse.
    g.fillStyle = css(L.top, 0, 0.7);
    for (let x = 6; x < w - 10; x += 22) {
      const k = hash2(Math.floor((x0 + x) / 22), 5, 11);
      if (k < 0.45) continue;
      g.fillRect(x + k * 8, BAND + 2.2 + k * 3, 4 + k * 6, 0.8);
    }
  });
}

function drawBody(rc: RC, m: Flood, d: DrawCtx) {
  paintBody(rc, liquidOf(m, d), m.at[0] + d.off[0], m.w, m.at[1] + d.off[1], heightOf(m, d, rc.frame));
}

/** A liquid's body `h` px deep over `w` px from `x0`, its floor at `floor`: the bands under the crest and the deep below. Behind the terrain. */
export function paintBody(rc: RC, L: Liquid, x0: number, w: number, floor: number, h: number) {
  if (h <= 0) return;
  const m = { w };
  const crest = floor - h;
  const s = rc.s;
  const deep = crest + BODY + 2;
  if (deep < floor) {
    s.fillStyle = css(L.deep);
    s.fillRect(x0, deep, m.w, floor - deep);
  }
  s.save();
  s.beginPath();
  s.rect(x0, crest, m.w, h);
  s.clip();
  stamp(s, bands(x0, m.w, L), x0, crest);
  s.restore();
}

/** Runs of tile columns whose cell at `y` (just under the crest) is open: liquid, not a wall the crest would run across. */
function openRuns(lv: Level | undefined, x0: number, w: number, y: number): [number, number][] {
  if (!lv) return [[x0, x0 + w]];
  const ty = Math.floor(y / TILE);
  const runs: [number, number][] = [];
  let start = -1;
  const c0 = Math.floor(x0 / TILE + 1e-6);
  const c1 = Math.ceil((x0 + w) / TILE - 1e-6);
  for (let cx = c0; cx <= c1; cx++) {
    const open = cx < c1 && tileAt(lv, cx, ty) !== T_SOLID;
    if (open && start < 0) start = cx;
    if (!open && start >= 0) {
      runs.push([Math.max(x0, start * TILE), Math.min(x0 + w, cx * TILE)]);
      start = -1;
    }
  }
  return runs;
}

/**
 * Open liquid under the crest at world x, px, down to the first solid tile or `cap`. Over a ledge a
 * flood can be a pixel deep: nothing drawn in front of the terrain may reach further than this.
 */
function wet(lv: Level | undefined, x: number, crest: number, cap: number): number {
  if (!lv) return cap;
  const tx = Math.floor(x / TILE);
  for (let ty = Math.floor(crest / TILE); ty * TILE < crest + cap; ty++)
    if (tileAt(lv, tx, ty) === T_SOLID) return Math.max(0, Math.min(cap, ty * TILE - crest));
  return cap;
}

/** Bubbles that rise through `depth` px under the crest and pop at it, on the sim's clock. */
function bubbles(rc: RC, lv: Level | undefined, L: Liquid, a: number, b: number, crest: number, cap: number, rate: number) {
  const s = rc.s;
  for (let cx = Math.floor(a / 9); cx * 9 < b; cx++) {
    const k = hash2(cx, 3, 21);
    if (k > rate) continue;
    const x = cx * 9 + 2 + k * 5;
    if (x < a + 1.5 || x > b - 1.5) continue;
    const depth = wet(lv, x, crest, cap);
    if (depth < 4) continue;
    const period = 70 + Math.floor(k * 90);
    const u = ((rc.frame + Math.floor(k * 997)) % period) / period;
    const y = crest + 1.5 + (1 - u) * Math.max(0, depth - 3);
    const r = 0.7 + u * 1.1;
    if (y > crest + depth) continue;
    s.fillStyle = inkFor(L.deep);
    blob(s, x, y, r + 0.45, cx, 1, 0.15);
    s.fill();
    s.fillStyle = css(L.glint);
    blob(s, x, y, r, cx + 1, 1, 0.15);
    s.fill();
  }
}

/** The warning: froth heaped on the crest, rising with `p`, its blobs bobbing on the sim's clock. Never past the lip. */
function froth(rc: RC, L: Liquid, a: number, b: number, crest: number, p: number) {
  const s = rc.s;
  const lip = 3 * p;
  for (let x = Math.ceil(a / 4) * 4; x < b; x += 4) {
    const k = hash2(Math.floor(x / 4), 9, 31);
    if (k > 0.35 + p * 0.65) continue;
    const r = (0.9 + k * 1.2) * (0.5 + p * 0.5);
    const bob = Math.sin(rc.frame * (0.2 + k * 0.2) + k * 9) * 0.6 * p;
    const y = crest - Math.min(lip, r) + bob;
    s.fillStyle = inkFor(L.deep);
    blob(s, x + k * 2, y, r + 0.45, x, 1, 0.15);
    s.fill();
    s.fillStyle = css(L.top, 6);
    blob(s, x + k * 2, y, r, x + 1, 1, 0.15);
    s.fill();
  }
}

function drawSurface(rc: RC, m: Flood, d: DrawCtx) {
  const st = floodState(m, rc.frame, d.r.phase);
  const warn = st.seg === FLOOD_WARN ? st.t / st.len : 0;
  paintSurface(rc, d.o.level ?? undefined, liquidOf(m, d), m.at[0] + d.off[0], m.w, m.at[1] + d.off[1], heightOf(m, d, rc.frame), warn);
}

/**
 * A liquid's surface over the open columns of `lv`: the pen crest on the kill line, glints, bubbles, the warning
 * froth (`warn` 0…1) and, when it's hot, its glow. In front of the terrain.
 */
export function paintSurface(rc: RC, lv: Level | undefined, L: Liquid, x0: number, w: number, floor: number, h: number, warn: number) {
  if (h <= 0 && !warn) return;
  const m = { w };
  const crest = floor - h;
  const s = rc.s;
  for (const [a, b] of openRuns(lv, x0, m.w, crest + 0.5)) {
    if (h > 0) {
      // The pen crest: one stroke per tile column, lifted at some joints, centred on the kill line.
      s.fillStyle = inkFor(L.deep);
      for (let cx = Math.floor(a / TILE); cx * TILE < b; cx++) {
        const lift = hash2(cx, 1, 41);
        const xa = Math.max(a, cx * TILE + (lift < 0.3 ? 1.5 : -0.6));
        const xb = Math.min(b, (cx + 1) * TILE + (hash2(cx + 1, 1, 41) < 0.3 ? -1.5 : 0.6));
        if (xb - xa > 1) line(s, xa, crest, xb, crest, { w: 1 + lift * 0.4, seed: cx, taper: [0.08, 0.08], press: 0.25 });
      }
      // Glints just under it.
      s.fillStyle = css(L.glint);
      for (let cx = Math.floor(a / 13); cx * 13 < b; cx++) {
        const k = hash2(cx, 2, 51);
        if (k < 0.55) continue;
        const gx = cx * 13 + k * 6;
        if (gx < a + 1 || gx + 4 > b - 1 || wet(lv, gx, crest, 3) < 2.5 || wet(lv, gx + 5.5, crest, 3) < 2.5) continue;
        line(s, gx, crest + 1.4, gx + 2.5 + k * 3, crest + 1.4, { w: 0.6, seed: cx + 7, taper: [0.3, 0.3], press: 0.1 });
      }
      bubbles(rc, lv, L, a, b, crest, Math.min(h, BODY + 6), 0.3 + warn * 0.7);
    }
    if (warn) froth(rc, L, a, b, crest, warn);
    if (L.hot) {
      // Heat: the light band glows, and the surface lights what stands over it.
      rc.g.fillStyle = css(L.top, 0, 0.45 + warn * 0.25);
      for (let cx = Math.floor(a / TILE); cx * TILE < b; cx++) {
        const xa = Math.max(a, cx * TILE);
        const xb = Math.min(b, (cx + 1) * TILE);
        const deep = wet(lv, xa, crest, Math.min(h, BAND + 1));
        if (deep > 0) rc.g.fillRect(xa, crest, xb - xa, deep);
      }
      for (let x = a + 24; x < b; x += 48) light(rc, x, crest + 2, 70, L.body, 0.7 + warn * 0.4);
    }
  }
}

defineArt<'flood'>({ type: 'flood', layer: BACKDROP, draw: drawBody });
defineArt<'flood'>({ type: 'flood', layer: 3, draw: drawSurface });
