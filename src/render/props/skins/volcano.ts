import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { blob, line, type P, stroke } from '../../ink';
import { boxPts, path, pen, poly, sprite, stamp, tone } from '../../ink-props';
import { glowDot, light } from '../../kit';
import type { DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import type { Deco, DecoSkin, ThemeSkins } from './common';

/**
 * Volcano skins: the backdrop shells of its stage concepts (docs/SETPIECES.md, Volcano), drawn as the deco
 * `facade` behind the landmark's terrain on BACKDROP, chosen by the level's concept.
 *
 * - The Caldera's ash column: billows climbing out of the crater into the sky, their undersides lit by
 *   the lava under them.
 * - The Lavafall Organ's back rank: taller pipes standing behind the terraces, hazed into the smoke, so
 *   the cliff reads as an organ from across the level.
 * - The Lava Tube's far wall: cooled flowstone in bands, lit from the floor, and seams of lava still
 *   glowing through it.
 *
 * All flat tones sunk toward the sky's haze with a thin pen of their own dark: scenery, never a slab to
 * stand on (docs/ART.md, Fair play). Baked once; only what glows is live, and only lava glows.
 */

const HAZE = 0.3;
function hz(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE), l: c.l + (fog.l - c.l) * HAZE } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(4, hsl(b).l * 0.3) }) };
}
type Hz = ReturnType<typeof hz>;

const ASH: HSL = { h: 14, s: 8, l: 22 };
const ROCK: HSL = { h: 12, s: 12, l: 16 };
const LAVA: HSL = { h: 20, s: 100, l: 52 };
const lavaOf = (d: DrawCtx): HSL => d.o.level?.theme.liquid.color ?? LAVA;

// ------------------------------------------------------------------------------------------- caldera

/** The ash column: puffs widening as they climb from the crater's mouth (the box's bottom) to the sky. */
function ashColumn(m: Deco, t: Hz) {
  return sprite(`volcano|ash|${m.w}|${m.h}|${m.seed}|${t.k}`, -m.w, -TILE * 4, m.w * 3, m.h + TILE * 4, (g) => {
    const cx = m.w / 2;
    const n = Math.max(6, Math.round(m.h / 9));
    for (let i = n - 1; i >= 0; i--) {
      const u = i / (n - 1);
      const y = m.h - u * (m.h + TILE * 2);
      const r = m.w * (0.22 + 0.5 * u) + 4;
      const x = cx + Math.sin(u * 5 + m.seed) * m.w * 0.25 * u;
      for (let k = 0; k < 3; k++) {
        const bx = x + (hash2(i, k, m.seed) - 0.5) * r * 1.2;
        const by = y + (hash2(k, i, m.seed) - 0.5) * r * 0.5;
        const br = r * (0.5 + hash2(i + k, 3, m.seed) * 0.4);
        g.fillStyle = t.ink(ASH);
        blob(g, bx, by, br + 1, i * 5 + k, 0.8, 0.25);
        g.fill();
        g.fillStyle = t.c(ASH, 4 - u * 6 + k * 2);
        blob(g, bx, by, br, i * 5 + k, 0.8, 0.25);
        g.fill();
      }
    }
  });
}

const caldera: DecoSkin = (rc, m, d) => {
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  // The box runs down to the crater's floor; the ash leaves from the rim, the first ground in its edge column.
  const lv = d.o.level;
  const tx = Math.round(m.at[0] / TILE);
  let rim = Math.round(m.h / TILE);
  if (lv)
    for (let ty = Math.round(m.at[1] / TILE); ty < lv.h; ty++)
      if (lv.tiles[ty * lv.w + tx] === 1) {
        rim = ty - Math.round(m.at[1] / TILE);
        break;
      }
  m = { ...m, h: rim * TILE };
  stamp(rc.s, ashColumn(m, t), x, y);
  // The crater's glow on the ash's underside, breathing with the lava.
  const lava = lavaOf(d);
  const pulse = 0.75 + 0.25 * Math.sin(rc.t * 1.3 + m.seed);
  glowDot(rc.g, x + m.w / 2, y + m.h, m.w * 0.9, lava, 0.5 * pulse);
  light(rc, x + m.w / 2, y + m.h - TILE, m.w * 1.4, lava, 0.7 * pulse);
};

// ------------------------------------------------------------------------------------------- organ

/** The back rank of pipes: tall, hazed basalt columns standing behind the terraces and above them. */
function backRank(m: Deco, t: Hz) {
  const rise = TILE * 6;
  return sprite(`volcano|organ|${m.w}|${m.h}|${m.seed}|${t.k}`, -4, -rise - 4, m.w + 8, m.h + rise + 8, (g) => {
    const n = Math.max(3, Math.round(m.w / 11));
    const pw = m.w / n;
    for (let i = 0; i < n; i++) {
      // Tallest at the face, stepping down toward the back, each pipe its own height.
      const u = i / Math.max(1, n - 1);
      const h = m.h + rise * (1 - u * 0.8) * (0.7 + 0.3 * hash2(i, 1, m.seed));
      const x = i * pw + pw * 0.12;
      const w = pw * 0.76;
      const top = m.h - h;
      const pts = poly(x, m.h, x, top + w * 0.3, x + w * 0.5, top, x + w, top + w * 0.3, x + w, m.h);
      tone(g, pts, t.hsl(ROCK), { depth: 0.6 });
      pen(g, pts, i + 3, 0.3, 0.8, 3, t.ink(ROCK));
      // Facets down the column: the hexagonal joints of cooled basalt.
      g.fillStyle = t.c(ROCK, 6);
      g.fillRect(x + w * 0.18, top + w * 0.5, w * 0.16, h - w * 0.5);
      g.fillStyle = t.ink(ROCK);
      for (let y = top + w + hash2(i, 2, m.seed) * 12; y < m.h - 6; y += 13 + hash2(i, y | 0, m.seed) * 10) g.fillRect(x + 1, y, w - 2, 0.8);
    }
  });
}

const organ: DecoSkin = (rc, m, d) => {
  const t = hz(d);
  stamp(rc.s, backRank(m, t), m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

// ------------------------------------------------------------------------------------------- lava tube

/** The tube's far wall: flowstone in bands with ribs where the flow cooled, and seams for the lava to show through. */
function tubeWall(m: Deco, t: Hz) {
  return sprite(`volcano|tube|${m.w}|${m.h}|${m.seed}|${t.k}`, 0, 0, m.w, m.h, (g) => {
    g.fillStyle = t.c(ROCK, -4);
    g.fillRect(0, 0, m.w, m.h);
    for (let y = 3; y < m.h; y += 7) {
      g.fillStyle = t.c(ROCK, (y / 7) % 2 ? 2 : -1);
      const pts: P[] = [{ x: 0, y }];
      for (let x = 0; x <= m.w; x += 8) pts.push({ x, y: y + Math.sin(x * 0.05 + y + m.seed) * 1.6 });
      pts.push({ x: m.w, y: y + 4 }, { x: 0, y: y + 4 });
      path(g, pts);
      g.fill();
    }
    // Ribs of cooled flow arching over the tube.
    for (let x = 10 + (m.seed % 13); x < m.w - 6; x += (30 + hash2(x, 1, m.seed) * 18) | 0) {
      const pts = boxPts(x, -2, 5, m.h + 2, 2, x, 0.3);
      tone(g, pts, t.hsl(ROCK), { depth: 0.8 });
      pen(g, pts, x, 0.25, 0.7, 3, t.ink(ROCK));
    }
  });
}

/** The glowing seams in the tube's wall: fixed by the seed, breathing with time. */
function seams(m: Deco): P[][] {
  const out: P[][] = [];
  for (let x = 18 + (m.seed % 17); x < m.w - 10; x += 34 + ((hash2(x, 3, m.seed) * 20) | 0)) {
    const pts: P[] = [];
    let px = x;
    for (let y = m.h * 0.15; y < m.h * 0.8; y += 5) {
      px += (hash2(px | 0, y | 0, m.seed) - 0.5) * 5;
      pts.push({ x: px, y });
    }
    out.push(pts);
  }
  return out;
}

const tube: DecoSkin = (rc, m, d) => {
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  stamp(rc.s, tubeWall(m, t), x, y);
  const lava = lavaOf(d);
  const pulse = 0.6 + 0.4 * Math.sin(rc.t * 1.1 + m.seed);
  for (const s of seams(m)) {
    rc.g.fillStyle = css(lava, 10, 0.55 + 0.35 * pulse);
    for (let i = 1; i < s.length; i++) line(rc.g, x + s[i - 1].x, y + s[i - 1].y, x + s[i].x, y + s[i].y, { w: 1.2, seed: i, taper: [0.1, 0.1], press: 0 });
  }
  // The floor's lava light along the bottom of the wall.
  for (let k = 0; k < m.w; k += 48) light(rc, x + k + 24, y + m.h, 70, lava, 0.35 * pulse);
  glowDot(rc.g, x + m.w / 2, y + m.h, Math.min(120, m.w * 0.4), lava, 0.18 * pulse);
};

// ------------------------------------------------------------------------------------------- dragon ribs

const BONE: HSL = { h: 40, s: 24, l: 72 };

/** A bone along `pts`: an ink ribbon, the bone over it, a lit stripe along it. */
function boneStroke(g: CanvasRenderingContext2D, pts: readonly P[], wd: number, t: Hz, seed: number) {
  g.fillStyle = t.ink(BONE);
  stroke(g, pts, { w: wd + 1.6, seed, taper: [0.02, 0.35], press: 0 });
  g.fillStyle = t.c(BONE, -4);
  stroke(g, pts, { w: wd, seed: seed + 1, taper: [0.02, 0.4], press: 0 });
  g.fillStyle = t.c(BONE, 10);
  stroke(
    g,
    pts.map((p) => ({ x: p.x - wd * 0.2, y: p.y - wd * 0.15 })),
    { w: wd * 0.3, seed: seed + 2, taper: [0.1, 0.5], press: 0 },
  );
}

/**
 * The whole ribcage behind the bones you can touch: each rib you can stand on (the one-way bone under the
 * spine) is drawn whole behind its perches, curving down to the ground, with its twin on the far side
 * curving the other way. Read from the level's own tiles, so it fits any layout.
 */
function ribcage(m: Deco, d: DrawCtx, t: Hz) {
  const lv = d.o.level!;
  const x0 = Math.round(m.at[0] / TILE);
  const y0 = Math.round(m.at[1] / TILE);
  const w = Math.round(m.w / TILE);
  const h = Math.round(m.h / TILE);
  return sprite(`volcano|ribs|${x0},${y0},${w},${h}|${t.k}|${lv.version}`, -TILE * 3, -TILE, m.w + TILE * 6, m.h + TILE * 2, (g) => {
    const tile = (x: number, y: number) => lv.tiles[y * lv.w + x];
    for (let x = x0; x < x0 + w; x++) {
      let top = -1;
      for (let y = y0; y < y0 + h - 1; y++) if (tile(x, y) === 1 && tile(x, y + 1) === 2) top = y + 1;
      if (top < 0) continue;
      // The perches it stands on, in order down the rib.
      const perch: P[] = [{ x: (x - x0 + 0.5) * TILE, y: (top - y0) * TILE }];
      let cx = x;
      for (let y = top; y < y0 + h; y++) {
        const nx = [cx, cx + 1, cx - 1].find((c) => tile(c, y) === 2);
        if (nx === undefined) break;
        cx = nx;
        perch.push({ x: (cx - x0 + 0.5) * TILE, y: (y - y0 + 0.5) * TILE });
      }
      perch.push({ x: perch[perch.length - 1].x, y: h * TILE });
      const lean = Math.sign(perch[perch.length - 1].x - perch[0].x) || 1;
      // Its twin, bowing out the other way.
      const twin = perch.map((p, i) => ({ x: 2 * perch[0].x - p.x - lean * Math.sin((i / (perch.length - 1)) * Math.PI) * 10, y: p.y }));
      boneStroke(g, twin, 4.2, { ...t, c: (b: HSL, dl?: number) => t.c(b, (dl ?? 0) - 10) }, x * 3 + 1);
      boneStroke(g, perch, 5, t, x * 3);
    }
  });
}

/** Horns swept back off the skull, behind it. The shell's seed says which way it faces (1: toward the left). */
function horns(m: Deco, t: Hz) {
  return sprite(`volcano|horns|${m.w}|${m.h}|${m.seed}|${t.k}`, -TILE * 4, -TILE * 4, m.w + TILE * 8, m.h + TILE * 4, (g) => {
    const back = m.seed === 1 ? 1 : -1;
    const bx = m.seed === 1 ? m.w * 0.7 : m.w * 0.3;
    for (const [k, len, wd] of [
      [0, 34, 5.2],
      [1, 26, 4.2],
    ] as const) {
      const pts: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        pts.push({ x: bx + back * (u * len - k * 8), y: TILE * 0.4 + k * 3 - u * 34 + u * u * 12 });
      }
      boneStroke(g, pts, wd, t, 50 + k);
    }
  });
}

const ribs: DecoSkin = (rc, m, d) => {
  if (!d.o.level) return;
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  // The skull's shell is its own, narrow box; the cage's spans the whole skeleton.
  stamp(rc.s, m.w <= 6 * TILE ? horns(m, t) : ribcage(m, d, t), x, y);
};

// ------------------------------------------------------------------------------------------- registry

const facade: DecoSkin = (rc, m, d) => {
  const concept = d.o.level?.landmark?.concept;
  // The caldera's tubes and the magma tide's basin have the lava tube's far wall.
  if (concept === 'caldera') return m.h > 4 * TILE ? caldera(rc, m, d) : tube(rc, m, d);
  if (concept === 'magma-tide') return tube(rc, m, d);
  if (concept === 'dragon-ribs') return ribs(rc, m, d);
  if (concept === 'lavafall-organ') return organ(rc, m, d);
  if (concept === 'lava-tube') return tube(rc, m, d);
  SHELLS.facade?.(rc, m, d);
};

export const VOLCANO: ThemeSkins = { deco: { facade } };
