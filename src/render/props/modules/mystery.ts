import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import type { ItemKind } from '../../../sim/items';
import { type ModuleOf, mysterySpent, mysteryState, type PropStyle } from '../../../sim/props';
import { drawItemIcon } from '../../items';
import { circle, glowDot, light, type MetalPalette, metalFill, type RC, rivet, rrect } from '../../kit';
import { defineArt, type DrawCtx } from '../common';

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
export function poolHue(pool: readonly ItemKind[]): HSL {
  if (pool.every((k) => SHOTS.has(k))) return { h: 8, s: 95, l: 60 };
  if (pool.every((k) => GADGETS.has(k))) return { h: 186, s: 95, l: 60 };
  return { h: 46, s: 100, l: 60 };
}

function box(rc: RC, m: Mystery, x: number, y: number, st: PropStyle, pal: MetalPalette) {
  const s = rc.s;
  const T = TILE;
  s.fillStyle = 'rgba(0,0,0,0.28)';
  rrect(s, x + 1.5, y + 2.5, T, T, 2.5);
  s.fill();
  if (m.look === 'gift') {
    const c: HSL = { h: st.hue, s: 70, l: 48 };
    const gr = s.createLinearGradient(x, y, x, y + T);
    gr.addColorStop(0, css(c, 12));
    gr.addColorStop(1, css(c, -12));
    s.fillStyle = gr;
    rrect(s, x, y, T, T, 2.5);
    s.fill();
    s.strokeStyle = css(c, -28);
    s.lineWidth = 1.2;
    s.stroke();
    // Ribbon cross with a bow on top.
    const rb: HSL = { h: (st.hue + 180) % 360, s: 80, l: 70 };
    s.fillStyle = css(rb);
    s.fillRect(x + T / 2 - 1.5, y, 3, T);
    s.fillRect(x, y + 3, T, 2.5);
    s.beginPath();
    s.ellipse(x + T / 2 - 3, y - 0.5, 3, 1.8, -0.4, 0, Math.PI * 2);
    s.ellipse(x + T / 2 + 3, y - 0.5, 3, 1.8, 0.4, 0, Math.PI * 2);
    s.fill();
    return;
  }
  const wood: HSL = { h: st.woodHue, s: 45, l: m.look === 'chest' ? 32 : 40 };
  const gr = s.createLinearGradient(x, y, x, y + T);
  gr.addColorStop(0, css(wood, 10));
  gr.addColorStop(1, css(wood, -10));
  s.fillStyle = gr;
  rrect(s, x, y, T, T, m.look === 'chest' ? [5, 5, 1.5, 1.5] : 1.5);
  s.fill();
  s.strokeStyle = css(wood, -24);
  s.lineWidth = 1.2;
  s.stroke();
  // Planks.
  s.strokeStyle = css(wood, -18, 0.8);
  s.lineWidth = 0.7;
  for (const py of m.look === 'chest' ? [5.5] : [5.3, 10.7]) {
    s.beginPath();
    s.moveTo(x + 1, y + py);
    s.lineTo(x + T - 1, y + py);
    s.stroke();
  }
  // Metal bands or corner brackets.
  s.fillStyle = metalFill(s, pal, x, y, T, T);
  if (m.look === 'chest') {
    s.fillRect(x, y + 5, T, 1.8);
    s.fillRect(x + 2, y + 1, 1.8, T - 1);
    s.fillRect(x + T - 3.8, y + 1, 1.8, T - 1);
    return;
  }
  for (const [cx, cy] of [
    [x, y],
    [x + T - 4, y],
    [x, y + T - 4],
    [x + T - 4, y + T - 4],
  ])
    s.fillRect(cx, cy, 4, 4);
  rivet(s, x + 2, y + 2, pal, 0.7);
  rivet(s, x + T - 2, y + 2, pal, 0.7);
  rivet(s, x + 2, y + T - 2, pal, 0.7);
  rivet(s, x + T - 2, y + T - 2, pal, 0.7);
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
    // Porthole.
    s.fillStyle = '#14111c';
    circle(s, px, py, 4.6);
    s.strokeStyle = css(d.pal.light, -10);
    s.lineWidth = 0.9;
    s.beginPath();
    s.arc(px, py, 4.8, 0, Math.PI * 2);
    s.stroke();
    if (spent) {
      s.strokeStyle = 'rgba(120,110,130,0.55)';
      s.lineWidth = 0.6;
      s.beginPath();
      s.moveTo(px - 3, py - 2);
      s.lineTo(px, py);
      s.lineTo(px + 2.5, py - 0.5);
      s.moveTo(px, py);
      s.lineTo(px - 0.5, py + 3);
      s.stroke();
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
