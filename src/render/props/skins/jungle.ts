import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_SOLID, tileAt } from '../../../sim/level';
import { flameCycle, geyserCycle, type Module, type ModuleOf, SNAP_ARM, SNAP_COOL, SNAP_SPIKE, SNAP_UP, snapperPhase } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, glowDot, light, type RC } from '../../kit';
import { BACKDROP, beamOf, type DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import type { Deco, DecoSkin, PieceSkin, ThemeSkins } from './common';

/**
 * Jungle skins (docs/SETPIECES.md, Jungle): the backdrop shells of its stage concepts, drawn as the deco
 * `facade` behind each landmark's terrain and chosen by the level's concept and the shell's shape, and the
 * jungle's own set pieces drawn their own way on the shapes the sim moves and hurts with.
 *
 * - The Step Temple: the carved corridor through its plinth, and a shrine on its summit.
 * - The Waterfall Cliff: the grotto behind the falls, and the river running to the lip.
 * - The Canopy Village: trunks running on up into great crowns, huts on the decks, rope rails, the hollows
 *   in the trunks.
 * - The Thorn Gorge: the gorge's far wall falling away into mist with a snapped rope bridge hanging from
 *   both lips, and the bramble-choked tunnel through the bluff.
 * - The Sun Gate: the dark of the gate, the sun disc carved over it, its two lenses in their bezels and the
 *   beams they focus.
 * - Snapjaws (a trap on a root stump), carved pressure plates, the pulley lift's ropes, the falls' spill and
 *   the timber frame a log trap hangs from where no branch holds it.
 *
 * Shells are flat tones sunk toward the sky's haze with a thin pen of their own dark: scenery, never a slab
 * to stand on (docs/ART.md, Fair play). Baked once; only what moves, warns or burns is live.
 */

const HAZE = 0.3;
function hz(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE), l: c.l + (fog.l - c.l) * HAZE } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(4, hsl(b).l * 0.3) }) };
}
type Hz = ReturnType<typeof hz>;

const STONE: HSL = { h: 40, s: 16, l: 46 };
const DARK: HSL = { h: 150, s: 18, l: 9 };
const BARK: HSL = { h: 26, s: 30, l: 26 };
const LEAF: HSL = { h: 112, s: 42, l: 26 };
const THATCH: HSL = { h: 42, s: 46, l: 46 };
const ROPE: HSL = { h: 38, s: 36, l: 52 };
const WATER: HSL = { h: 190, s: 58, l: 52 };
const SUN: HSL = { h: 46, s: 100, l: 70 };
const GLASS: HSL = { h: 186, s: 50, l: 74 };

/** A thick stroke inked: an ink ribbon, the colour over it, a lit stripe along its top. */
function beam(s: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, col: string, ink: string, seed: number) {
  s.fillStyle = ink;
  line(s, ax, ay, bx, by, { w: w + 1.2, seed, taper: [0.02, 0.02], press: 0.05 });
  s.fillStyle = col;
  line(s, ax, ay, bx, by, { w, seed: seed + 1, taper: [0.02, 0.02], press: 0.05 });
}

/** Rows and columns of the shell's box, in tiles. */
const boxOf = (m: Deco) => ({ x: Math.round(m.at[0] / TILE), y: Math.round(m.at[1] / TILE), w: Math.round(m.w / TILE), h: Math.round(m.h / TILE) });

/** A dark interior (a passage, a hollow, a grotto): flat shadow, a wall of `wall` toned blocks, a lit sill at the floor. */
function interior(g: CanvasRenderingContext2D, w: number, h: number, wall: HSL, t: Hz, seed: number, blocks = true) {
  g.fillStyle = t.c(DARK, 0);
  g.fillRect(0, 0, w, h);
  if (blocks)
    for (let y = 0; y < h - 2; y += 8)
      for (let x = (y / 8) % 2 ? -6 : 0; x < w; x += 12) {
        const pts = boxPts(x + 0.8, y + 0.8, 10.4, 6.4, 1.2, x * 7 + y + seed, 0.2);
        g.fillStyle = t.c(wall, -30 + hash2(x, y, seed) * 6);
        path(g, pts);
        g.fill();
      }
  g.fillStyle = t.c(wall, -18);
  g.fillRect(0, h - 2, w, 2);
}

// ------------------------------------------------------------------------------------------- step temple

/** The corridor through the plinth: carved blocks in shadow, glyph bands, and squat pillars every few tiles. */
function templePassage(m: Deco, t: Hz) {
  return sprite(`jungle|passage|${m.w}|${m.h}|${m.seed}|${t.k}`, 0, 0, m.w, m.h, (g) => {
    interior(g, m.w, m.h, STONE, t, m.seed);
    for (let x = 24 + (m.seed % 17); x < m.w - 10; x += 40 + ((hash2(x, 1, m.seed) * 16) | 0)) {
      const pts = boxPts(x, 0, 7, m.h, 1.5, x, 0.3);
      tone(g, pts, t.hsl({ ...STONE, l: STONE.l - 18 }), { depth: 0.7 });
      pen(g, pts, x, 0.3, 0.8, 3, t.ink(STONE));
      // A glyph cut into the pillar: a ring and a bar.
      g.fillStyle = t.ink(STONE);
      blob(g, x + 3.5, m.h * 0.45, 1.5, x, 1, 0.1);
      g.fill();
      g.fillRect(x + 1.5, m.h * 0.45 + 3, 4, 0.8);
    }
  });
}

/** The summit's shrine: two pillars and a lintel under a stepped roof, a dark doorway between, hazed back. */
function shrine(m: Deco, t: Hz) {
  return sprite(`jungle|shrine|${m.w}|${m.h}|${m.seed}|${t.k}`, -4, -TILE * 3, m.w + 8, m.h + TILE * 3, (g) => {
    const w = Math.min(m.w - 4, Math.max(TILE * 3, m.w * 0.6));
    const x0 = (m.w - w) / 2;
    const top = m.h * 0.15;
    const body = poly(x0, m.h, x0, top, x0 + w, top, x0 + w, m.h);
    tone(g, body, t.hsl({ ...STONE, l: STONE.l - 6 }), { depth: 0.8 });
    pen(g, body, m.seed, 0.3, 0.8, 3, t.ink(STONE));
    // The doorway's dark.
    const dw = Math.max(8, w * 0.32);
    g.fillStyle = t.c(DARK);
    path(g, poly(m.w / 2 - dw / 2, m.h, m.w / 2 - dw / 2, top + 9, m.w / 2, top + 5, m.w / 2 + dw / 2, top + 9, m.w / 2 + dw / 2, m.h));
    g.fill();
    // The stepped roof: three courses, each narrower, and a crest stone.
    for (let i = 0; i < 3; i++) {
      const cw = w + 6 - i * (w / 4);
      const cy = top - (i + 1) * 6;
      const pts = boxPts(m.w / 2 - cw / 2, cy, cw, 6, 1, i + m.seed, 0.2);
      tone(g, pts, t.hsl({ ...STONE, l: STONE.l + 2 - i * 3 }), { depth: 0.6 });
      pen(g, pts, i + 9, 0.3, 0.7, 3, t.ink(STONE));
    }
    const crest = ovalPts(m.w / 2, top - 22, 4, 3.2, m.seed, 0.1);
    tone(g, crest, t.hsl({ h: 160, s: 30, l: 40 }), { depth: 0.6 });
    pen(g, crest, 5, 0.3, 0.7, 3, t.ink(STONE));
    // Moss hanging off the courses.
    g.fillStyle = t.c(LEAF, 6);
    for (let i = 0; i < 5; i++) {
      const x = m.w / 2 - w / 2 + hash2(i, 2, m.seed) * w;
      blob(g, x, top - 6 + hash2(i, 3, m.seed) * 4, 2 + hash2(i, 4, m.seed) * 2, i, 1, 0.3);
      g.fill();
    }
  });
}

// ------------------------------------------------------------------------------------------- waterfall cliff

/**
 * The cliff's back: the grotto behind the falls along its foot (wet dark rock, drips catching the light),
 * and the river running out from behind the clifftop to the lip, where the falls take it.
 */
function cliffBack(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  // The clifftop: the columns from the lip whose ground is the box's third row (the notch a row under it).
  const b = boxOf(m);
  let run = 0;
  while (run < b.w && (tileAt(lv, b.x + run, b.y + 2) === T_SOLID || (run === 0 && tileAt(lv, b.x, b.y + 3) === T_SOLID))) run++;
  const rw = Math.max(TILE * 2, run * TILE);
  const sp = sprite(`jungle|cliff|${m.w}|${m.h}|${run}|${m.seed}|${t.k}`, -TILE * 2, -2, m.w + TILE * 2, m.h + 2, (g) => {
    // The grotto: the last three rows.
    const gy = m.h - 3 * TILE;
    g.save();
    g.translate(0, gy);
    interior(g, m.w, 3 * TILE, { h: 170, s: 14, l: 40 }, t, m.seed, false);
    for (let i = 0; i < m.w / 9; i++) {
      const sx = 4 + i * 9 + hash2(i, 1, m.seed) * 4;
      const sl = 3 + hash2(i, 2, m.seed) * 7;
      g.fillStyle = t.c({ h: 170, s: 12, l: 30 });
      path(g, poly(sx - 2, 0, sx, sl, sx + 2, 0));
      g.fill();
    }
    g.restore();
    // The river: a band of water two rows deep running behind the clifftop, out to the lip and over it.
    const top = 2 * TILE;
    g.fillStyle = t.c(WATER, -10);
    path(g, poly(-TILE * 2, top - 6, rw - 6, top - 8, rw + 4, top + 2, -TILE * 2, top + 2));
    g.fill();
    g.fillStyle = t.c(WATER, 8);
    for (let i = 0; i < rw / 14; i++) {
      const rx = i * 14 + hash2(i, 5, m.seed) * 8;
      g.fillRect(rx, top - 6 + hash2(i, 6, m.seed) * 4, 5, 0.9);
    }
  });
  stamp(rc.s, sp, x, y);
}

// ------------------------------------------------------------------------------------------- canopy village

/** Each trunk in the village's box, read from the level: its left column and the row of its deck. */
function trunksOf(lv: Level, m: Deco): { x: number; top: number }[] {
  const b = boxOf(m);
  const G = b.y + b.h;
  const out: { x: number; top: number }[] = [];
  for (let x = b.x; x < b.x + b.w - 1; x++) {
    if (tileAt(lv, x, G - 4) !== T_SOLID || tileAt(lv, x + 1, G - 4) !== T_SOLID || tileAt(lv, x, G - 1) !== 0) continue;
    let top = G - 4;
    while (tileAt(lv, x, top - 1) === T_SOLID) top--;
    out.push({ x, top });
    x++;
  }
  return out;
}

/**
 * The village: each trunk goes on up behind its deck into a crown, a thatched hut sits on the deck, rope
 * rails run a tile over every plank, and the hollows at the trunks' feet are dark inside.
 */
function village(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const t = hz(d);
  const b = boxOf(m);
  const trunks = trunksOf(lv, m);
  const sp = sprite(`jungle|village|${b.x},${b.y},${b.w},${b.h}|${m.seed}|${t.k}|${lv.version}`, -TILE * 4, -TILE * 2, m.w + TILE * 8, m.h + TILE * 2, (g) => {
    const X = (tx: number) => (tx - b.x) * TILE;
    const Y = (ty: number) => (ty - b.y) * TILE;
    for (const [i, tr] of trunks.entries()) {
      const cx = X(tr.x) + TILE;
      const deck = Y(tr.top);
      // The trunk on up behind, flaring at the crown.
      // From the ground (behind the hollow) on up past the deck to the crown, flaring at its foot.
      const foot = Y(b.y + b.h);
      const up = poly(
        cx - 17,
        foot,
        cx - 12,
        foot - TILE,
        cx - 10,
        deck - TILE * 2.5,
        cx - 6,
        Y(b.y) + TILE * 2,
        cx + 6,
        Y(b.y) + TILE * 2,
        cx + 10,
        deck - TILE * 2.5,
        cx + 12,
        foot - TILE,
        cx + 17,
        foot,
      );
      tone(g, up, t.hsl(BARK), { depth: 1 });
      pen(g, up, i, 0.4, 1, 3, t.ink(BARK));
      g.fillStyle = t.c(BARK, -10);
      for (let k = 0; k < 4; k++) g.fillRect(cx - 7 + k * 4, deck - TILE * 3 + hash2(k, i, m.seed) * TILE, 0.9, TILE * 1.5);
      // The crown: big leaf masses round the top of the box.
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const rr = TILE * (1.6 + hash2(k, i, m.seed) * 0.9);
        const bx = cx + Math.cos(a) * TILE * 2.6;
        const by = Y(b.y) + TILE * 1.6 + Math.sin(a) * TILE * 1.2;
        g.fillStyle = t.ink(LEAF);
        blob(g, bx, by, rr + 1, k + i * 9, 0.85, 0.3);
        g.fill();
        g.fillStyle = t.c(LEAF, (k % 3) * 4 - 2);
        blob(g, bx, by, rr, k + i * 9, 0.85, 0.3);
        g.fill();
      }
      // A thatched hut on the deck: board walls, a dark doorway, a cone of thatch.
      const hw = TILE * 2.4;
      const hx = cx - hw / 2;
      const walls = boxPts(hx, deck - TILE * 1.6, hw, TILE * 1.6, 1, i + 3, 0.3);
      tone(g, walls, t.hsl({ ...BARK, l: BARK.l + 10 }), { depth: 0.6 });
      pen(g, walls, i + 3, 0.3, 0.8, 3, t.ink(BARK));
      g.fillStyle = t.c(DARK);
      g.fillRect(cx - 3, deck - TILE * 1.1, 6, TILE * 1.1);
      const roof = poly(hx - 5, deck - TILE * 1.5, cx, deck - TILE * 3, hx + hw + 5, deck - TILE * 1.5);
      tone(g, roof, t.hsl(THATCH), { depth: 0.8 });
      pen(g, roof, i + 5, 0.3, 0.8, 3, t.ink(THATCH));
      g.fillStyle = t.c(THATCH, -14);
      for (let k = 1; k < 5; k++) g.fillRect(hx - 3 + (k * (hw + 6)) / 5, deck - TILE * 1.55 - k * 0.3, 0.8, 4);
      // The hollow at its foot.
      g.fillStyle = t.c(DARK);
      path(
        g,
        poly(
          X(tr.x) + 1,
          Y(b.y + b.h),
          X(tr.x) + 1,
          Y(b.y + b.h - 2.6),
          X(tr.x) + TILE,
          Y(b.y + b.h - 3),
          X(tr.x + 2) - 1,
          Y(b.y + b.h - 2.6),
          X(tr.x + 2) - 1,
          Y(b.y + b.h),
        ),
      );
      g.fill();
    }
    // Rope rails a tile over every one-way plank in the box, with a post at each run's ends.
    for (let ty = b.y; ty < b.y + b.h; ty++) {
      let run = -1;
      for (let tx = b.x; tx <= b.x + b.w; tx++) {
        const plank = tx < b.x + b.w && tileAt(lv, tx, ty) === 2 && tileAt(lv, tx, ty + 1) === 0;
        if (plank && run < 0) run = tx;
        if (!plank && run >= 0) {
          if (tx - run >= 3) {
            const y0 = Y(ty) - TILE * 0.85;
            g.fillStyle = t.c(ROPE, -6);
            const pts: P[] = [];
            for (let k = 0; k <= 12; k++) pts.push({ x: X(run) + (k / 12) * X(tx - run + b.x), y: y0 + Math.sin((k / 12) * Math.PI) * 3 });
            stroke(g, pts, { w: 0.9, seed: ty, taper: [0, 0], press: 0 });
            for (const px of [X(run) + 1, X(tx) - 1]) beam(g, px, Y(ty), px, y0 - 1, 1.6, t.c(BARK, 6), t.ink(BARK), px);
          }
          run = -1;
        }
      }
    }
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

// ------------------------------------------------------------------------------------------- thorn gorge

/**
 * The gorge: its far wall in bands of rock falling away into the mist, and a rope bridge snapped in the
 * middle, its halves hanging down the walls from the posts on both lips.
 */
function gorge(rc: RC, m: Deco, d: DrawCtx) {
  const t = hz(d);
  const sp = sprite(`jungle|gorge|${m.w}|${m.h}|${m.seed}|${t.k}`, -TILE, -TILE * 2, m.w + TILE * 2, m.h + TILE * 2, (g) => {
    const lip = TILE * 2;
    const l = TILE;
    const r = m.w - TILE;
    // In shadow down here: the haze only touches its top, and the dark takes it going down.
    const rock: HSL = { h: 100, s: 18, l: 22 };
    // The far wall: ledges of rock in bands, each a little darker going down, with cracks, falling away
    // into the dark.
    for (let y = lip, i = 0; y < m.h; y += 10 + (i % 3) * 3, i++) {
      const u = Math.min(1, (y - lip) / (TILE * 9));
      const band: P[] = [{ x: l, y }];
      for (let x = l; x <= r; x += 6) band.push({ x, y: y + Math.sin(x * 0.09 + i * 1.7 + m.seed) * 2 });
      band.push({ x: r, y: y + 16 }, { x: l, y: y + 16 });
      tone(g, band, u < 0.25 ? t.hsl(rock) : { ...rock, l: rock.l - u * 14 }, { depth: 1.4, shade: -8 });
      g.fillStyle = t.ink(rock);
      for (let x = l + 6 + hash2(i, 2, m.seed) * 10; x < r - 4; x += 14 + hash2(i, x | 0, m.seed) * 12) {
        stroke(g, poly(x, y + 3, x + 1.5, y + 7, x - 0.5, y + 11), { w: 0.6, seed: i + (x | 0), taper: [0.2, 0.5], press: 0.1 });
      }
    }
    // Roots and creepers trailing down the far wall.
    for (let i = 0; i < (r - l) / 18; i++) {
      const x = l + 6 + i * 18 + hash2(i, 9, m.seed) * 8;
      const len = TILE * (1.5 + hash2(i, 10, m.seed) * 3);
      g.fillStyle = t.c(LEAF, -4);
      stroke(g, poly(x, lip, x + 2, lip + len * 0.5, x - 1, lip + len), { w: 1, seed: i, taper: [0.05, 0.6], press: 0.1 });
    }
    // Mist low in the gorge, thickening into the dark.
    for (let k = 0; k < 4; k++) {
      g.fillStyle = t.c({ h: 150, s: 12, l: 70 }, 0, 0.08 + k * 0.05);
      const my = lip + TILE * (3.5 + k * 1.3);
      const pts: P[] = [{ x: l, y: m.h }];
      for (let x = l; x <= r; x += 8) pts.push({ x, y: my + Math.sin(x * 0.05 + k * 2 + m.seed) * 3 });
      pts.push({ x: r, y: m.h });
      path(g, pts);
      g.fill();
    }
    // The posts on both lips, and the bridge's halves hanging from them down into the gorge: two ropes and
    // the planks between, some of them gone.
    for (const side of [0, 1]) {
      const dir = side ? -1 : 1;
      const edge = side ? r : l;
      const px = edge - dir * TILE * 0.45;
      beam(g, px, lip + 2, px, lip - TILE * 1.3, 2.4, t.c(BARK, 8), t.ink(BARK), side + 1);
      const fall = TILE * (3 + hash2(side, 1, m.seed) * 3);
      const pts: P[] = [];
      for (let k = 0; k <= 12; k++) {
        const u = k / 12;
        pts.push({ x: edge + dir * (TILE * 0.2 + Math.sin(u * Math.PI) * TILE * 0.5), y: lip - TILE * 1.1 + u * (fall + TILE * 1.1) });
      }
      pts[0] = { x: px, y: lip - TILE * 1.1 };
      for (const k of [-1, 1]) {
        g.fillStyle = t.c(ROPE, -6);
        stroke(
          g,
          pts.map((p) => ({ x: p.x + k * 3, y: p.y })),
          { w: 0.9, seed: side * 3 + k, taper: [0, 0.3], press: 0 },
        );
      }
      for (let k = 3; k < pts.length - 2; k++) {
        if (hash2(k, side, m.seed) < 0.25) continue;
        const p = pts[k];
        const pl = boxPts(p.x - 3.5, p.y - 1, 7, 2, 0.4, k + side * 11, 0.1);
        tone(g, pl, t.hsl({ ...BARK, l: BARK.l + 10 }), { depth: 0.3 });
        pen(g, pl, k, 0.2, 0.5, 2, t.ink(BARK));
      }
    }
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

/** The bramble tunnel's inside: dark, tangled with thorny stems. */
function brambles(m: Deco, t: Hz) {
  return sprite(`jungle|bramble|${m.w}|${m.h}|${m.seed}|${t.k}`, 0, 0, m.w, m.h, (g) => {
    interior(g, m.w, m.h, { h: 110, s: 20, l: 30 }, t, m.seed, false);
    for (let i = 0; i < m.w / 6; i++) {
      const x0 = hash2(i, 1, m.seed) * m.w;
      const pts: P[] = [];
      for (let k = 0; k <= 6; k++) pts.push({ x: x0 + Math.sin(k + i) * 6 + k * 3, y: (k / 6) * m.h });
      g.fillStyle = t.c({ h: 100, s: 26, l: 22 });
      stroke(g, pts, { w: 1.1, seed: i, taper: [0.1, 0.1], press: 0.2 });
      for (let k = 1; k < 6; k += 2) {
        const p = pts[k];
        g.fillStyle = t.c({ h: 40, s: 30, l: 50 }, -10);
        path(g, poly(p.x, p.y, p.x + 2.2, p.y - 0.6, p.x, p.y + 0.8));
        g.fill();
      }
    }
  });
}

// ------------------------------------------------------------------------------------------- sun gate

/** The gate's dark, a patch of sun on its floor where the day comes in. */
function gateInside(m: Deco, t: Hz) {
  return sprite(`jungle|gate|${m.w}|${m.h}|${m.seed}|${t.k}`, 0, 0, m.w, m.h, (g) => {
    interior(g, m.w, m.h, STONE, t, m.seed);
    g.fillStyle = t.c(SUN, -10, 0.35);
    path(g, poly(0, m.h, 0, m.h * 0.4, TILE * 1.6, m.h));
    g.fill();
  });
}

// ------------------------------------------------------------------------------------------- registry: shells

const facade: DecoSkin = (rc, m, d) => {
  const concept = d.o.level?.landmark?.concept;
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const door = m.h <= 3 * TILE + 0.5;
  if (concept === 'step-temple') return stamp(rc.s, door ? templePassage(m, t) : shrine(m, t), x, y);
  if (concept === 'waterfall-cliff') return cliffBack(rc, m, d);
  if (concept === 'canopy-village') return village(rc, m, d);
  if (concept === 'thorn-gorge') return door ? stamp(rc.s, brambles(m, t), x, y) : gorge(rc, m, d);
  if (concept === 'sun-gate') return stamp(rc.s, gateInside(m, t), x, y);
  SHELLS.facade?.(rc, m, d);
};

// ------------------------------------------------------------------------------------------- pieces

type Snapper = ModuleOf<'snapper'>;
type Body = ModuleOf<'body'>;

/** The body a snapper is mounted on, in the same piece (a snapjaw's stump, a plate's block). */
function hostOf(m: Snapper, d: DrawCtx): Body | undefined {
  const [cx, cy] = m.cells[0];
  return d.r.mods.find((b): b is Body => b.type === 'body' && b.cells.some(([x, y]) => x === cx && y === cy));
}

/** A snapjaw's root stump: a gnarled bulb of root filling its cell, rootlets gripping the ground either side. */
function stump(seed: number) {
  return sprite(`jungle|stump|${seed % 4}`, -3, -1, TILE + 6, TILE + 2, (g) => {
    for (const k of [-1, 1]) {
      g.fillStyle = INK;
      stroke(g, poly(TILE / 2 + k * 5, TILE - 3, TILE / 2 + k * 9, TILE - 0.5, TILE / 2 + k * 10.5, TILE + 0.5), {
        w: 1.8,
        seed: k + seed,
        taper: [0, 0.6],
        press: 0.1,
      });
    }
    const pts = poly(1, TILE, 0.4, TILE * 0.55, 2.5, 1.5, TILE / 2, 0.6, TILE - 2.5, 1.5, TILE - 0.4, TILE * 0.55, TILE - 1, TILE);
    part(g, pts, { h: 30 + (seed % 4) * 4, s: 30, l: 28 }, seed, { depth: 1, thin: 0.5, thick: 1.3 });
    g.fillStyle = css({ h: 30, s: 30, l: 18 });
    for (let i = 0; i < 3; i++) tick(g, 4 + i * 4, 4 + (i % 2) * 2, 3 + i * 4, TILE - 3, 0.5, i + seed, css({ h: 30, s: 30, l: 18 }));
  });
}

/**
 * The trap on top of the stump: two leaf lobes with bristles on their rims. Open, they lie flat; arming,
 * they twitch; snapped, they stand up shut to exactly the sim's lethal strip (SNAP_SPIKE px); then they ease
 * open again. A plant, not a creature: no eyes, no tongue.
 */
function snapjawTrap(rc: RC, m: Snapper, d: DrawCtx) {
  const s = rc.s;
  const ph = snapperPhase(m, d.o.state, d.mi, rc.frame);
  // 0 open flat, 1 shut and standing.
  const shut =
    ph.seg === SNAP_UP
      ? Math.min(1, ph.u * 8)
      : ph.seg === SNAP_COOL
        ? 1 - Math.min(1, ph.u * 2)
        : ph.seg === SNAP_ARM
          ? 0.12 + (Math.floor(rc.frame / 3) % 2) * 0.1
          : 0;
  const lobe: HSL = { h: 100 + (d.style.glowHue % 30), s: 54, l: 38 };
  const inner: HSL = { h: 352, s: 62, l: 46 };
  for (const [cx, cy] of m.cells) {
    const x = (cx + 0.5) * TILE + d.off[0];
    const y = cy * TILE + d.off[1];
    const H = SNAP_SPIKE;
    for (const k of [-1, 1]) {
      // Each lobe hinges at the middle; open it lies out sideways, shut it stands with its rim at the strip's top.
      const a = (1 - shut) * 1.35;
      const tipX = x + k * Math.sin(a) * H;
      const tipY = y - Math.cos(a) * H;
      const w = 6.5;
      const pts = poly(x, y, x + k * w * Math.cos(a) * 0.9 + k * 0.5, y - w * Math.sin(a) * 0.4 - 1, tipX + k * 1.5 * Math.cos(a), tipY, x + k * 0.6, y - 1.2);
      part(s, pts, k < 0 ? inner : lobe, cx * 3 + k, { depth: 0.4, thin: 0.35, thick: 0.9 });
      // Bristles along the rim.
      s.fillStyle = INK;
      for (let i = 0; i < 4; i++) {
        const u = 0.35 + i * 0.2;
        const bx = x + (tipX - x) * u + k * 0.8;
        const by = y + (tipY - y) * u;
        line(s, bx, by, bx + k * (1.6 + shut * 0.5) * Math.cos(a) - k * shut * 0.4, by - 1.6 * Math.sin(a + 0.4) - shut * 1.2, {
          w: 0.45,
          seed: i,
          taper: [0, 0.8],
          press: 0,
        });
      }
    }
    if (ph.seg === SNAP_ARM) bulb(rc.g, x, y - 2, 1.4, { h: 352, s: 80, l: 60 }, 0.4 + ph.u * 0.5);
  }
}

/** A temple plate: a carved slab whose stone spikes spring out of its slots, exactly the sim's strip. */
function stonePlate(rc: RC, m: Snapper, d: DrawCtx) {
  const s = rc.s;
  const ph = snapperPhase(m, d.o.state, d.mi, rc.frame);
  let ext = 0;
  if (ph.seg === SNAP_ARM) ext = 1.4 + (Math.floor(rc.frame / 2) % 2) * 1.1;
  else if (ph.seg === SNAP_UP) ext = SNAP_SPIKE * Math.min(1, ph.u * 6);
  else if (ph.seg === SNAP_COOL) ext = SNAP_SPIKE * (1 - Math.min(1, ph.u * 2.5)) * 0.8;
  for (const [cx, cy] of m.cells) {
    const x = cx * TILE + d.off[0];
    const y = cy * TILE + d.off[1];
    for (let i = 0; i < 4; i++) {
      if (ext <= 0) break;
      const bx = x + 2.5 + i * 3.7;
      part(s, poly(bx - 1.5, y, bx, y - ext, bx + 1.5, y), STONE, i + cx, { depth: 0.3, thin: 0.3, thick: 0.6 });
    }
    const slab = boxPts(x + 0.6, y - 0.4, TILE - 1.2, 3.2, 0.6, cx + cy, 0.1);
    part(s, slab, { ...STONE, l: STONE.l - 8 }, cx, { depth: 0.4, thin: 0.4, thick: 0.9 });
    g4(s, x, y);
    if (ph.seg === SNAP_ARM) bulb(rc.g, x + TILE / 2, y + 1, 1.3, { h: 46, s: 90, l: 60 }, 0.4 + ph.u * 0.5);
  }
}

/** A pressure plate's block: a carved temple stone filling its cell, a glyph cut in its face. */
function block(seed: number) {
  return sprite(`jungle|block|${seed % 3}`, -1, -1, TILE + 2, TILE + 2, (g) => {
    const pts = boxPts(0, 0, TILE, TILE, 1.4, seed, 0.2);
    part(g, pts, { ...STONE, l: STONE.l + 4 - (seed % 3) * 3 }, seed, { depth: 1, thin: 0.5, thick: 1.2 });
    g.fillStyle = css(STONE, -24);
    blob(g, TILE / 2, TILE * 0.55, 2.6, seed, 1, 0.1);
    g.fill();
    g.fillStyle = css(STONE, 2);
    blob(g, TILE / 2 - 0.4, TILE * 0.55 - 0.4, 1.3, seed + 1, 1, 0.1);
    g.fill();
  });
}

/** Four slots in a plate. */
function g4(s: CanvasRenderingContext2D, x: number, y: number) {
  s.fillStyle = INK;
  for (let i = 0; i < 4; i++) s.fillRect(x + 1.8 + i * 3.7, y + 0.6, 1.4, 1);
}

/** The pulley lift's basket: a woven platform with a rim. */
function basket(rc: RC, m: Body, d: DrawCtx) {
  const xs = m.cells.map(([x]) => x);
  const x0 = Math.min(...xs) * TILE + d.off[0];
  const w = (Math.max(...xs) + 1) * TILE - Math.min(...xs) * TILE;
  const y = m.cells[0][1] * TILE + d.off[1];
  const pts = boxPts(x0, y, w, TILE, 1.6, 7, 0.2);
  part(rc.s, pts, { h: 36, s: 40, l: 42 }, 7, { depth: 1, thin: 0.5, thick: 1.2 });
  rc.s.fillStyle = css({ h: 36, s: 40, l: 30 });
  for (let k = 0; k < 3; k++) rc.s.fillRect(x0 + 2, y + 3.5 + k * 4, w - 4, 0.8);
  for (let k = 1; k < w / 5; k++) rc.s.fillRect(x0 + k * 5, y + 2, 0.7, TILE - 3);
}

/** The lift's ropes up to a pulley on a beam over its top stop, drawn behind. */
function pulley(rc: RC, m: Body, d: DrawCtx) {
  if (d.r.motion.type !== 'rail') return;
  const xs = m.cells.map(([x]) => x);
  const x0 = Math.min(...xs) * TILE;
  const x1 = (Math.max(...xs) + 1) * TILE;
  const y = m.cells[0][1] * TILE + d.off[1];
  const top = m.cells[0][1] * TILE - d.r.motion.range - TILE * 2.4;
  const cx = (x0 + x1) / 2;
  beam(rc.s, x0 - 4, top, x1 + 4, top, 2.4, css(BARK, 8), INK, 3);
  for (const px of [x0 + 2, x1 - 2]) {
    rc.s.fillStyle = css(ROPE);
    line(rc.s, px, y, cx + (px < cx ? -2 : 2), top + 3, { w: 0.8, seed: px, taper: [0, 0], press: 0 });
  }
  ball(rc.s, cx, top + 3, 3, { h: 30, s: 30, l: 34 }, 5);
}

/** Where no ceiling holds a log trap, a timber gallows does: two raked legs to the ground under it and a cross beam. */
function logFrame(rc: RC, m: ModuleOf<'swinger'>, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const tx = Math.floor(hx / TILE);
  const ty = Math.floor(hy / TILE);
  if (tileAt(lv, tx, ty - 1) === T_SOLID) return;
  const t = hz(d);
  const reach = m.arm * Math.sin(m.swing) + m.radius * 2;
  for (const k of [-1, 1]) {
    const fx = hx + k * reach;
    let gy = ty;
    while (gy < lv.h && tileAt(lv, Math.floor(fx / TILE), gy) === 0) gy++;
    beam(rc.s, fx, gy * TILE, hx + k * 6, hy - 3, 2.6, t.c(BARK, 10), t.ink(BARK), k + 2);
  }
  beam(rc.s, hx - 12, hy - 3, hx + 12, hy - 3, 3, t.c(BARK, 14), t.ink(BARK), 9);
}

/** The falls' spill over the lip: a smooth tongue of water curling off the clifftop where the column starts. */
function spill(rc: RC, m: ModuleOf<'geyser'>, d: DrawCtx) {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const w = m.width;
  const c = geyserCycle(m, rc.frame, d.r.phase);
  const k = c.seg === 2 ? 1 : c.seg === 1 ? 0.35 : 0.15;
  const pts = poly(x + w * 0.5, y - 2.5, x + w * 0.62 + 4, y - 2.5, x + w * 0.5 + 2, y + 3, x - w * 0.5, y + 6, x - w * 0.5 - 1, y + 1);
  rc.s.fillStyle = css(WATER, -4, 0.55 + 0.45 * k);
  path(rc.s, pts);
  rc.s.fill();
  rc.s.fillStyle = css(WATER, 26, 0.8 * k);
  line(rc.s, x - w * 0.3, y, x + w * 0.5, y - 1.5, { w: 0.9, seed: 2, taper: [0.2, 0.2], press: 0 });
}

/**
 * The Sun Gate's optics. The disc carved over the gate (drawn with the outer lens, on the face), each lens
 * a glass in a bronze bezel set in the lintel, and the beam: gathering in the glass while it warns, then a
 * hard white-gold shaft exactly as long as the sim's (`beamOf`).
 */
function sunDisc(rc: RC, m: ModuleOf<'flame'>, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv?.landmark) return;
  const r = lv.landmark.rect;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  // Over the gate, centred on the monolith's face.
  let tx = Math.floor(x / TILE);
  while (tx < r.x + r.w && tileAt(lv, tx + 1, Math.floor(y / TILE) - 1) === T_SOLID) tx++;
  const cx = ((Math.floor(x / TILE) + tx + 1) / 2) * TILE;
  const cy = y - TILE * 3.2;
  const R = Math.min(TILE * 2.2, ((tx - Math.floor(x / TILE) + 1) * TILE) / 2 - 3);
  const sp = sprite(`jungle|disc|${R | 0}`, -R - 4, -R - 4, R * 2 + 8, R * 2 + 8, (g) => {
    // Rays cut round a disc, the disc sunk in rings, a boss at its heart: a sun, carved.
    const r = R * 0.68;
    for (let i = 0; i < 12; i++) {
      // Rays as grooves cut into the face, long and short in turn: carving, nothing that juts.
      const a = (i / 12) * Math.PI * 2;
      const L = i % 2 ? R * 0.86 : R;
      tick(g, Math.cos(a) * (r + 1.5), Math.sin(a) * (r + 1.5), Math.cos(a) * L, Math.sin(a) * L, 1.1, i, css(STONE, -24));
    }
    g.fillStyle = css(STONE, -22);
    path(g, ovalPts(0, 0, r, r, 3, 0.03, 24));
    g.fill();
    g.fillStyle = css(STONE, -4);
    path(g, ovalPts(-0.6, -0.6, r - 2, r - 2, 4, 0.03, 22));
    g.fill();
    g.fillStyle = css(STONE, -20);
    const ring = ovalPts(0, 0, r * 0.62, r * 0.62, 6, 0.03, 18);
    stroke(g, [...ring, ring[0]], { w: 0.8, seed: 6, taper: [0, 0], press: 0.1 });
    g.fillStyle = css(STONE, -30);
    path(g, ovalPts(0, 0, r * 0.28, r * 0.28, 5, 0.04, 14));
    g.fill();
  });

  stamp(rc.s, sp, cx, cy);
}

function lens(rc: RC, m: ModuleOf<'flame'>, d: DrawCtx) {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const c = flameCycle(m, rc.frame, d.r.phase);
  ball(rc.s, x, y, 4.4, { h: 34, s: 54, l: 40 }, 3);
  rc.s.fillStyle = css(GLASS, c.seg === 0 ? -6 : 10);
  path(rc.s, ovalPts(x, y, 2.9, 2.9, 4, 0.02, 14));
  rc.s.fill();
  dot(rc.s, x - 1, y - 1, 0.6, 5, '#ffffff');
  const heat = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0;
  if (heat > 0) bulb(rc.g, x, y, 2.4, SUN, 0.35 + heat * 0.65);
}

function sunbeam(rc: RC, m: ModuleOf<'flame'>, d: DrawCtx) {
  const c = flameCycle(m, rc.frame, d.r.phase);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const dx = Math.cos(m.angle);
  const dy = Math.sin(m.angle);
  const len = beamOf(d.o, d.r, d.mi)?.len ?? m.length;
  const from = TILE / 2;
  if (c.seg === 1) {
    // The tell: a thin thread of light finding its mark, brighter as it gathers.
    const u = c.t / c.len;
    rc.s.fillStyle = css(SUN, 10, 0.3 + u * 0.5);
    line(rc.s, x + dx * from, y + dy * from, x + dx * len, y + dy * len, { w: 0.6 + u * 0.8, seed: 3, taper: [0.1, 0.1], press: 0 });
    return;
  }
  if (c.seg !== 2) return;
  const ax = x + dx * from;
  const ay = y + dy * from;
  const bx = x + dx * len;
  const by = y + dy * len;
  rc.s.fillStyle = css(SUN, -8);
  line(rc.s, ax, ay, bx, by, { w: 9, seed: 4, taper: [0.05, 0.05], press: 0 });
  rc.s.fillStyle = '#fffbe6';
  line(rc.s, ax, ay, bx, by, { w: 4, seed: 5, taper: [0.05, 0.05], press: 0 });
  glowDot(rc.g, bx, by, 10, SUN, 0.8);
  for (let i = 0; i <= 4; i++) glowDot(rc.g, ax + (bx - ax) * (i / 4), ay + (by - ay) * (i / 4), 7, SUN, 0.35);
  light(rc, bx, by, 60, SUN, 0.8);
}

/** The jungle's own set pieces, module by module. */
const piece: PieceSkin = (rc, layer, m: Module, d) => {
  switch (m.type) {
    case 'snapper': {
      if (layer !== 2) return false;
      const host = hostOf(m, d);
      if (host?.material === 'wood') snapjawTrap(rc, m, d);
      else if (host?.material === 'stone') stonePlate(rc, m, d);
      else return false;
      return true;
    }
    case 'body':
      if (d.r.motion.type === 'rail' && m.material === 'wood') {
        if (layer === BACKDROP) pulley(rc, m, d);
        if (layer === 1) basket(rc, m, d);
        return layer === BACKDROP || layer === 1;
      }
      if (layer === 1 && m.material === 'wood' && d.r.mods.some((x) => x.type === 'snapper')) {
        for (const [cx, cy] of m.cells) stamp(rc.s, stump(cx * 7 + cy), cx * TILE + d.off[0], cy * TILE + d.off[1]);
        return true;
      }
      if (layer === 1 && m.material === 'stone' && d.r.mods.some((x) => x.type === 'snapper')) {
        for (const [cx, cy] of m.cells) stamp(rc.s, block(cx * 5 + cy), cx * TILE + d.off[0], cy * TILE + d.off[1]);
        return true;
      }
      return false;
    case 'swinger':
      if (m.head === 'log' && layer === BACKDROP) {
        logFrame(rc, m, d);
        return true;
      }
      return false;
    case 'geyser':
      if (m.look === 'water' && layer === 1) {
        spill(rc, m, d);
        return true;
      }
      return false;
    case 'flame':
      if (d.o.level?.landmark?.concept !== 'sun-gate') return false;
      if (layer === 0 && d.r.mods.findIndex((x) => x.type === 'flame') === d.mi) sunDisc(rc, m, d);
      if (layer === 1) lens(rc, m, d);
      if (layer === 3) sunbeam(rc, m, d);
      return layer <= 3 && layer >= 0;
    default:
      return false;
  }
};

export const JUNGLE: ThemeSkins = { deco: { facade }, piece };
