import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import type { ItemKind } from '../../../sim/items';
import { type ModuleOf, mysterySpent, mysteryState, type PropStyle } from '../../../sim/props';
import { drawItemIcon } from '../../items';
import { hash2 } from '../../../core/rng';
import { blob, line, type P, stroke } from '../../ink';
import { boxPts, dot, INK, ovalPts, part, path, pen, poly, sprite, stamp, tone } from '../../ink-props';
import { glowDot, light, type MetalPalette, type RC } from '../../kit';
import { defineArt, type DrawCtx } from '../common';
import { arcPts } from '../ink-motion';

type Mystery = ModuleOf<'mystery'>;

/**
 * Mystery crate: a banded box (crate, chest or gift look) with a porthole on
 * its face. Ready: a glowing spark that now and then flips to a silhouette
 * from its pool, so you can read what's inside. Refilling: a ring fills up.
 * Spent: dark and cracked. Popping: the box jolts and flashes.
 */

const SHOTS = new Set<ItemKind>(['sword', 'puck', 'boomerang']);
const GADGETS = new Set<ItemKind>(['shield', 'rocket', 'smoke']);

/** Spark color telegraphs the pool: warm red for shots, cyan for gadgets, gold for a mixed bag. */
function poolHue(pool: readonly ItemKind[]): HSL {
  if (pool.every((k) => SHOTS.has(k))) return { h: 8, s: 95, l: 60 };
  if (pool.every((k) => GADGETS.has(k))) return { h: 186, s: 95, l: 60 };
  return { h: 46, s: 100, l: 60 };
}

/**
 * The box, baked: a floating loot block with a bevelled frame, corner rivets and a coin slot on top
 * (crate), a banded chest with a domed lid and a lock plate (chest), or a wrapped gift with a ribbon and a
 * bow (gift). Each carries a brass porthole on its face; what's behind the glass is drawn live.
 */
function boxSprite(look: Mystery['look'], st: PropStyle, pal: MetalPalette, spent: boolean) {
  const T = TILE;
  const key = `mystery|${look}|${spent}|${st.hue | 0}|${st.woodHue | 0}|${pal.base.h},${pal.base.l}`;
  return sprite(key, -3, -4, T + 6, T + 7, (g) => {
    const seed = (st.hue * 3 + st.woodHue) | 0;
    const dim = spent ? -14 : 0;
    const body = boxPts(0, 0, T, T, 2.2, seed, 0.2);
    if (look === 'gift') {
      const c: HSL = { h: st.hue, s: spent ? 25 : 70, l: 50 + dim };
      const rb: HSL = { h: (st.hue + 180) % 360, s: spent ? 20 : 80, l: 66 + dim };
      tone(g, body, c, { depth: 1.8, shade: -20 });
      g.save();
      path(g, body);
      g.clip();
      // Wrapping paper with a print: a few flat dots, then the ribbon, lit along its top-left edge.
      g.fillStyle = css(c, 14, 1, -8);
      for (let i = 0; i < 7; i++) {
        blob(g, 1.8 + hash2(i, 1, seed) * 12.4, 1.8 + hash2(i, 2, seed) * 12.4, 0.75, seed + i, 1, 0.25);
        g.fill();
      }
      tone(g, boxPts(T / 2 - 1.8, -1, 3.6, T + 2, 0.2, seed + 1, 0), rb, { depth: 0.6, shade: -22 });
      tone(g, boxPts(-1, 3, T + 2, 3.2, 0.2, seed + 2, 0), rb, { depth: 0.6, shade: -22 });
      g.fillStyle = INK;
      for (const x of [T / 2 - 1.9, T / 2 + 1.9]) line(g, x, 6.4, x, T, { w: 0.6, seed: seed + x, taper: [0.1, 0.2], press: 0.3 });
      line(g, 0, 6.4, T, 6.4, { w: 0.6, seed: seed + 3, taper: [0.1, 0.1], press: 0.3 });
      g.restore();
      pen(g, body, seed, 0.6, 1.7, 4);
      // The bow: two loops and two tails sat on top. Thin, so it may stand proud of the box.
      for (const sg of [-1, 1]) {
        const loop: P[] = [];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          loop.push({ x: T / 2 + sg * (2.7 + Math.cos(a) * 2.5), y: -0.6 + Math.sin(a) * 1.7 - sg * 0.3 });
        }
        part(g, loop, rb, seed + sg, { depth: 0.5, shade: -24, thin: 0.35, thick: 0.8 });
      }
      part(g, ovalPts(T / 2, -0.2, 1.4, 1.2, seed, 0.1, 10), rb, seed + 9, { depth: 0.3, thin: 0.3, thick: 0.7 });
    } else if (look === 'chest') {
      const wood: HSL = { h: st.woodHue, s: 46, l: 36 + dim };
      tone(g, body, wood, { depth: 1.8, shade: -18 });
      g.save();
      path(g, body);
      g.clip();
      // The domed lid, a shade lighter, and the seam under it.
      tone(g, boxPts(-1, -1, T + 2, 6.6, 1, seed + 3, 0.3), { ...wood, l: wood.l + 8 }, { depth: 0.8, shade: -14 });
      g.fillStyle = INK;
      line(g, -1, 5.7, T + 1, 5.9, { w: 1, seed, taper: [0.05, 0.1], press: 0.3 });
      // Planks and grain.
      g.fillStyle = css(wood, -16, 1, 6);
      for (const y of [9.6, 13]) line(g, 1, y, T - 1, y + 0.2, { w: 0.45, seed: seed + y, taper: [0.3, 0.3], press: 0.4 });
      for (const x of [2.8, T - 4.6]) {
        tone(g, boxPts(x, -1, 1.8, T + 2, 0.2, seed + x, 0), pal.base, { depth: 0.5, shade: -24 });
        dot(g, x + 0.9, 3, 0.45, x, css(pal.spec));
        dot(g, x + 0.9, T - 2.6, 0.45, x + 1, css(pal.spec));
      }
      g.restore();
      pen(g, body, seed, 0.6, 1.7, 4);
    } else {
      // The loot block: a bevelled frame round a sunk face, light on the top and left, dark below and right.
      const c: HSL = { h: st.hue, s: spent ? 18 : 78, l: 52 + dim };
      tone(g, body, c, { depth: 1.6, shade: -26 });
      g.save();
      path(g, body);
      g.clip();
      g.fillStyle = css(c, 18, 1, -6);
      path(g, poly(-1, -1, T + 1, -1, T - 2.6, 2.6, 2.6, 2.6, 2.6, T - 2.6, -1, T + 1));
      g.fill();
      g.fillStyle = css(c, -18, 1, 4);
      path(g, poly(T + 1, -1, T + 1, T + 1, -1, T + 1, 2.6, T - 2.6, T - 2.6, T - 2.6, T - 2.6, 2.6));
      g.fill();
      g.fillStyle = css(c, -36, 0.8);
      line(g, 2.6, 2.6, T - 2.6, 2.6, { w: 0.5, seed: 1, taper: [0.1, 0.2], press: 0.3 });
      line(g, 2.6, 2.6, 2.6, T - 2.6, { w: 0.5, seed: 2, taper: [0.1, 0.2], press: 0.3 });
      g.restore();
      for (const [x, y] of [
        [1.4, 1.4],
        [T - 1.4, 1.4],
        [1.4, T - 1.4],
        [T - 1.4, T - 1.4],
      ])
        dot(g, x, y, 0.6, x * 3 + y, css(c, 40));
      pen(g, body, seed, 0.6, 1.8, 4);
      // The coin slot on top.
      part(g, boxPts(T / 2 - 3, -0.6, 6, 1.6, 0.4, seed + 7, 0), pal.base, seed + 7, { depth: 0.3, thin: 0.3, thick: 0.6 });
      g.fillStyle = INK;
      line(g, T / 2 - 2, 0.2, T / 2 + 2, 0.2, { w: 0.7, seed: 4, taper: [0, 0], press: 0 });
    }
    // The porthole: a brass ring, bolted, round dark glass.
    const px = T / 2;
    const py = T / 2 + (look === 'chest' ? 1.6 : 0.6);
    part(g, ovalPts(px, py, 5.2, 5.2, seed + 20, 0.02, 18), { h: 44, s: 62, l: spent ? 36 : 50 }, seed + 20, {
      depth: 0.9,
      shade: -22,
      thin: 0.45,
      thick: 1.2,
    });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      dot(g, px + Math.cos(a) * 4.3, py + Math.sin(a) * 4.3, 0.42, i, '#fff4c8');
    }
    g.fillStyle = '#100d18';
    path(g, ovalPts(px + 0.2, py + 0.2, 3.5, 3.5, seed + 21, 0.02, 14));
    g.fill();
  });
}

/** A four-point spark, centered at (x, y). */
function spark(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.3 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

function drawMystery(rc: RC, m: Mystery, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const f = rc.frame;
  const st = mysteryState(d.o.state, d.mi);
  const spent = mysterySpent(m, st.pops);
  const since = f - st.popAt;
  const ready = !spent && f >= st.ready;
  const hue = poolHue(m.pool);
  for (const [cx, cy] of m.cells) {
    const jolt = since >= 0 && since < 10 ? Math.sin((since / 10) * Math.PI) * 3 : 0;
    const x = cx * TILE + d.off[0];
    const y = cy * TILE + d.off[1] - jolt;
    stamp(s, boxSprite(m.look, d.style, d.pal, spent), x, y);
    const px = x + TILE / 2;
    const py = y + TILE / 2 + (m.look === 'chest' ? 1.6 : 0.6);
    if (since >= 0 && since < 14) glowDot(g, px, y, 22, hue, (1 - since / 14) * 0.8);
    if (spent) {
      // Empty: the glass is cracked.
      s.fillStyle = 'rgba(150,140,160,0.7)';
      stroke(
        s,
        [
          { x: px - 3, y: py - 2 },
          { x: px, y: py },
          { x: px + 2.5, y: py - 0.5 },
        ],
        { w: 0.6, seed: cx, taper: [0.2, 0.4], press: 0 },
      );
      stroke(
        s,
        [
          { x: px, y: py },
          { x: px - 0.5, y: py + 3 },
        ],
        { w: 0.6, seed: cy, taper: [0.1, 0.6], press: 0 },
      );
      continue;
    }
    if (!ready) {
      const u = 1 - Math.max(0, st.ready - f) / Math.max(1, m.refill);
      g.fillStyle = css(hue, 0, 0.8);
      stroke(g, arcPts(px, py, 2.5, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2, 14), { w: 1.2, seed: 2, taper: [0, 0.1], press: 0 });
      continue;
    }
    // Ready: pulse, and every ~2.5 s flip to show one item from the pool.
    const cyc = (f + m.seed) % 150;
    const pulse = 0.75 + Math.sin(rc.t * 5) * 0.25;
    glowDot(g, px, py, 11, hue, 0.55 * pulse);
    light(rc, px, py, 40, hue, 0.6 * pulse);
    if (cyc >= 120) {
      const k = m.pool[Math.floor((f + m.seed) / 150) % m.pool.length];
      const flip = Math.abs(Math.cos(((cyc - 120) / 30) * Math.PI));
      s.save();
      blob(s, px + 0.2, py + 0.2, 3.5, 3, 1, 0.02);
      s.clip();
      s.fillStyle = css(hue, -30);
      s.fillRect(px - 5, py - 5, 10, 10);
      s.translate(px, py);
      s.scale(Math.max(0.1, 1 - flip), 1);
      drawItemIcon(s, k, 0, 0, 0.55, rc.t);
      s.restore();
    } else {
      const r = 3.4 + Math.sin(rc.t * 3 + m.seed) * 0.5;
      g.fillStyle = css(hue, 25, 0.95);
      spark(g, px, py, r);
      s.fillStyle = css(hue, 30);
      spark(s, px, py, r);
    }
  }
}

defineArt<'mystery'>({ type: 'mystery', layer: 1, draw: drawMystery });
