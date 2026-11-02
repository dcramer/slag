import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import type { ItemKind } from '../../../sim/items';
import { type ModuleOf, mysterySpent, mysteryState, type PropStyle } from '../../../sim/props';
import { drawItemIcon } from '../../items';
import { hash2 } from '../../../core/rng';
import { blob, line, type P, stroke } from '../../ink';
import { stampTile } from '../../ink-blocks';
import { circle, glowDot, light, type MetalPalette, type RC } from '../../kit';
import { defineArt, type DrawCtx } from '../common';

type Mystery = ModuleOf<'mystery'>;

const INK = '#1a0f0a';

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

/** Flat metal fittings with an ink edge and a rivet: bands, brackets, hinges. */
function fitting(g: CanvasRenderingContext2D, pts: readonly P[], pal: MetalPalette, seed: number) {
  g.fillStyle = css(pal.base, -4);
  g.beginPath();
  pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
  g.closePath();
  g.fill();
  g.fillStyle = css(pal.light, -4);
  line(g, pts[0].x + 0.4, pts[0].y + 0.5, pts[1].x - 0.4, pts[1].y + 0.5, { w: 0.7, seed, taper: [0.1, 0.1], press: 0 });
  g.fillStyle = INK;
  stroke(g, [...pts, pts[0]], { w: 0.75, seed: seed + 1, taper: [0.02, 0.02], press: 0.3 });
}

function rivetDot(g: CanvasRenderingContext2D, x: number, y: number, pal: MetalPalette, seed: number) {
  g.fillStyle = INK;
  blob(g, x, y, 0.95, seed, 1, 0.1);
  g.fill();
  g.fillStyle = css(pal.spec, -10);
  g.fillRect(x - 0.55, y - 0.65, 0.6, 0.55);
}

/**
 * The box, inked and stamped: a crate with corner brackets, a chest with a domed lid and bands, or a
 * gift with a ribbon and a bow. Whatever it is, it's a parcel nobody ordered.
 */
function box(rc: RC, m: Mystery, x: number, y: number, st: PropStyle, pal: MetalPalette) {
  const T = TILE;
  const key = `mystery|${m.look}|${st.hue | 0}|${st.woodHue | 0}|${pal.base.h},${pal.base.l}`;
  if (m.look === 'gift') {
    const c: HSL = { h: st.hue, s: 68, l: 50 };
    const rb: HSL = { h: (st.hue + 180) % 360, s: 78, l: 68 };
    stampTile(
      rc.s,
      x,
      y,
      key,
      c,
      (g, seed) => {
        // Paper with a print on it: a few flat dots in a lighter tone.
        g.fillStyle = css(c, 12, 1, -6);
        for (let i = 0; i < 6; i++) {
          blob(g, 2.5 + hash2(i, 1, seed) * 11, 2.5 + hash2(i, 2, seed) * 11, 0.9, seed + i, 1, 0.2);
          g.fill();
        }
        g.fillStyle = css(rb);
        g.fillRect(T / 2 - 1.7, -1, 3.4, T + 2);
        g.fillRect(-1, 3.2, T + 2, 3);
        g.fillStyle = INK;
        line(g, T / 2 - 1.8, 0, T / 2 - 1.8, T, { w: 0.7, seed, taper: [0, 0], press: 0.2 });
        line(g, T / 2 + 1.8, 0, T / 2 + 1.8, T, { w: 0.7, seed: seed + 1, taper: [0, 0], press: 0.2 });
        line(g, 0, 6.3, T, 6.3, { w: 0.7, seed: seed + 2, taper: [0, 0], press: 0.2 });
      },
      (g, seed, ink) => {
        // The bow: two loops and two tails, sat on top. Thin, so it may stand proud of the box.
        for (const sg of [-1, 1]) {
          const loop: P[] = [];
          for (let i = 0; i <= 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            loop.push({ x: T / 2 + sg * (2.6 + Math.cos(a) * 2.4), y: 0.4 + Math.sin(a) * 1.6 - sg * 0.2 });
          }
          g.fillStyle = css(rb);
          g.beginPath();
          loop.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
          g.fill();
          g.fillStyle = ink;
          stroke(g, loop, { w: 0.8, seed: seed + sg, taper: [0.05, 0.05], press: 0.3 });
        }
        g.fillStyle = ink;
        blob(g, T / 2, 0.6, 1.3, seed, 1, 0.1);
        g.fill();
      },
    );
    return;
  }
  const chest = m.look === 'chest';
  const wood: HSL = { h: st.woodHue, s: 46, l: chest ? 34 : 42 };
  stampTile(rc.s, x, y, key, wood, (g, seed) => {
    g.fillStyle = INK;
    for (const py of chest ? [5.6] : [5.3, 10.7])
      line(g, -1, py, T + 1, py + (hash2(py, 1, seed) - 0.5) * 0.8, { w: chest ? 1.1 : 0.8, seed: seed + py, taper: [0.05, 0.1] });
    g.fillStyle = css(wood, -14, 1, 6);
    for (let k = 0; k < 4; k++) {
      const gx = 2 + hash2(k, 3, seed) * 10;
      const gy = 2 + hash2(k, 4, seed) * 12;
      line(g, gx, gy, gx + 3, gy + (hash2(k, 5, seed) - 0.5), { w: 0.55, seed: seed + k, taper: [0.3, 0.6] });
    }
    if (chest) {
      // A domed lid, two bands over it, and a lock plate.
      g.fillStyle = css(wood, 10, 1, -4);
      g.fillRect(-1, 0, T + 2, 2.2);
      fitting(
        g,
        [
          { x: 2, y: -1 },
          { x: 4, y: -1 },
          { x: 4, y: T + 1 },
          { x: 2, y: T + 1 },
        ],
        pal,
        seed + 10,
      );
      fitting(
        g,
        [
          { x: T - 4, y: -1 },
          { x: T - 2, y: -1 },
          { x: T - 2, y: T + 1 },
          { x: T - 4, y: T + 1 },
        ],
        pal,
        seed + 12,
      );
      return;
    }
    // A crate: an iron bracket on every corner, each with its rivet.
    for (const [cx, cy, sx, sy] of [
      [0, 0, 1, 1],
      [T, 0, -1, 1],
      [0, T, 1, -1],
      [T, T, -1, -1],
    ]) {
      fitting(
        g,
        [
          { x: cx - sx, y: cy - sy },
          { x: cx + sx * 4.6, y: cy - sy },
          { x: cx + sx * 4.6, y: cy + sy * 1.9 },
          { x: cx + sx * 1.9, y: cy + sy * 1.9 },
          { x: cx + sx * 1.9, y: cy + sy * 4.6 },
          { x: cx - sx, y: cy + sy * 4.6 },
        ],
        pal,
        seed + cx + cy,
      );
      rivetDot(g, cx + sx * 1.6, cy + sy * 1.6, pal, seed + cx * 3 + cy);
    }
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
    box(rc, m, x, y, d.style, d.pal);
    const px = x + TILE / 2;
    const py = y + TILE / 2 + (m.look === 'chest' ? 1.5 : 0.5);
    if (since >= 0 && since < 14) glowDot(g, px, y, 22, hue, (1 - since / 14) * 0.8);
    // Porthole: a dark window in a riveted brass ring.
    s.fillStyle = INK;
    circle(s, px, py, 5.6);
    s.fillStyle = css(d.pal.base, 4);
    circle(s, px, py, 4.9);
    s.fillStyle = '#14111c';
    circle(s, px + 0.3, py + 0.3, 3.7);
    s.fillStyle = css(d.pal.spec, -8);
    s.fillRect(px - 3.6, py - 1.2, 0.8, 1.6);
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
      g.strokeStyle = css(hue, 0, 0.75);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(px, py, 3.2, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2);
      g.stroke();
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
      s.beginPath();
      s.arc(px, py, 4.4, 0, Math.PI * 2);
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
