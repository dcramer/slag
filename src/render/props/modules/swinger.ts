import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { tileAt } from '../../../sim/level';
import { type ModuleOf, type PropStyle, type Resolved, swingHeads } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { inkSaw } from '../../ink-parts';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, poly, sprite, stamp } from '../../ink-props';
import { light, type MetalPalette, type RC } from '../../kit';
import { defineArt, type PropDrawOpts } from '../common';

type Swinger = ModuleOf<'swinger'>;

/**
 * Saws, maces and axes on a hub (docs/PARODY.md, saw and flail). The arm is a rod drawn with the pen or
 * a chain of baked links; the hub is a bolted boss, or for the Chain Chump a stake with a dog collar.
 * The Pizza Cutter keeps its handle and the Hypnotist has a spiral painted on its blade.
 */

const IRON = (pal: MetalPalette): HSL => (pal.dark.l < 15 ? pal.base : { ...pal.dark, l: pal.dark.l + 10 });
const palKey = (pal: MetalPalette) => `${pal.base.h},${pal.base.l},${pal.dark.l}`;

/** One chain link, along +x: a ring seen face on, or a bar seen edge on. */
function link(pal: MetalPalette, edge: boolean) {
  return sprite(`sw|link|${edge}|${palKey(pal)}`, -3.6, -2.6, 7.2, 5.2, (g) => {
    if (edge) {
      part(g, boxPts(-3, -0.9, 6, 1.8, 0.9, 3), pal.base, 3, { depth: 0.3, thin: 0.35, thick: 0.7 });
      return;
    }
    const outer = ovalPts(0, 0, 3, 2, 5, 0.03, 16);
    const inner = ovalPts(0, 0, 1.6, 0.75, 6, 0.03, 12);
    g.fillStyle = INK;
    path(g, ovalPts(0.15, 0.2, 3.5, 2.5, 5, 0.03, 16));
    g.fill();
    g.fillStyle = css(pal.base, -8);
    path(g, outer);
    g.fill();
    g.fillStyle = css(pal.light, -6);
    g.beginPath();
    g.arc(-0.2, -0.2, 2.4, Math.PI * 1.05, Math.PI * 1.7);
    g.lineTo(-0.2, -0.2);
    g.fill();
    // Punch the hole.
    g.globalCompositeOperation = 'destination-out';
    path(g, inner);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = INK;
    stroke(g, [...inner, inner[0]], { w: 0.5, seed: 7, taper: [0, 0], press: 0.2 });
  });
}

/** The hub boss: a bolted ball. */
function hub(pal: MetalPalette) {
  return sprite(`sw|hub|${palKey(pal)}`, -6, -6, 12, 12, (g) => {
    ball(g, 0, 0, 4.3, pal.base, 11);
    dot(g, 0, 0, 1.3, 12, css(pal.light));
  });
}

/** Chain Chump's hub: a stake driven in, a red collar round it with studs and a tag. */
function stake(pal: MetalPalette) {
  return sprite(`sw|stake|${palKey(pal)}`, -7, -7, 14, 15, (g) => {
    const wood: HSL = { h: 30, s: 42, l: 44 };
    part(g, ovalPts(0, 0, 3.6, 3.4, 21, 0.08), wood, 21, { depth: 0.8, thin: 0.45, thick: 1.1 });
    g.fillStyle = css(wood, -18);
    for (const r of [1.2, 2.3]) {
      const ring = ovalPts(0.2, 0.1, r, r * 0.92, 22 + r, 0.1, 10);
      stroke(g, [...ring, ring[0]], { w: 0.35, seed: 23, taper: [0.2, 0.2], press: 0.2 });
    }
    // The collar: a red band round the stake.
    const col: HSL = { h: 356, s: 72, l: 46 };
    const outer = ovalPts(0, 0.4, 5.3, 4.9, 24, 0.02, 20);
    g.fillStyle = INK;
    path(g, ovalPts(0.2, 0.6, 5.9, 5.5, 24, 0.02, 20));
    g.fill();
    g.fillStyle = css(col);
    path(g, outer);
    g.fill();
    g.fillStyle = css(wood, -4);
    path(g, ovalPts(0, 0.4, 3.9, 3.6, 25, 0.03, 16));
    g.fill();
    part(g, ovalPts(0, 0, 3.6, 3.4, 21, 0.08), wood, 21, { depth: 0.8, thin: 0.45, thick: 1.1 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      g.fillStyle = '#e8ecf2';
      g.beginPath();
      g.arc(Math.cos(a) * 4.6, 0.4 + Math.sin(a) * 4.25, 0.5, 0, Math.PI * 2);
      g.fill();
    }
    // A name tag hanging off the bottom.
    part(g, ovalPts(0, 6.4, 1.4, 1.4, 26, 0.04, 10), { h: 46, s: 80, l: 58 }, 26, { depth: 0.3, thin: 0.3, thick: 0.6 });
    void pal;
  });
}

/** Spikes round a mace head, turning with it; the ball sits still over them so its light stays put. */
function maceSpikes(R: number) {
  return sprite(`sw|spikes|${R.toFixed(2)}`, -R * 1.45, -R * 1.45, R * 2.9, R * 2.9, (g) => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const tip = { x: Math.cos(a) * R * 1.32, y: Math.sin(a) * R * 1.32 };
      const l = { x: Math.cos(a - 0.24) * R * 0.72, y: Math.sin(a - 0.24) * R * 0.72 };
      const r = { x: Math.cos(a + 0.24) * R * 0.72, y: Math.sin(a + 0.24) * R * 0.72 };
      const m = { x: Math.cos(a) * R * 0.72, y: Math.sin(a) * R * 0.72 };
      g.fillStyle = INK;
      path(g, [
        { x: l.x * 1.06, y: l.y * 1.06 },
        { x: tip.x * 1.07, y: tip.y * 1.07 },
        { x: r.x * 1.06, y: r.y * 1.06 },
      ]);
      g.fill();
      g.fillStyle = '#e6e9ef';
      path(g, [l, tip, m]);
      g.fill();
      g.fillStyle = '#8f96a3';
      path(g, [m, tip, r]);
      g.fill();
    }
  });
}

function maceBall(R: number, pal: MetalPalette) {
  return sprite(`sw|mace|${R.toFixed(2)}|${palKey(pal)}`, -R - 2, -R - 2, R * 2 + 4, R * 2 + 4, (g) => ball(g, 0, 0, R * 0.86, IRON(pal), 31));
}

/** An axe head along +x from the end of its arm: a crescent blade, an edge that catches the light. */
function axe(R: number, pal: MetalPalette, spiral: boolean) {
  return sprite(`sw|axe|${R.toFixed(2)}|${spiral}|${palKey(pal)}`, -R * 0.6, -R * 1.45, R * 2.1, R * 2.9, (g) => {
    const blade: P[] = [];
    const q = (ax: number, ay: number, cx: number, cy: number, bx: number, by: number) => {
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        blade.push({ x: u * u * ax + 2 * u * t * cx + t * t * bx, y: u * u * ay + 2 * u * t * cy + t * t * by });
      }
    };
    blade.push({ x: -R * 0.2, y: -R * 0.35 });
    q(-R * 0.2, -R * 0.35, R * 0.4, -R * 1.3, R * 0.95, -R * 1.05);
    q(R * 0.95, -R * 1.05, R * 1.38, 0, R * 0.95, R * 1.05);
    q(R * 0.95, R * 1.05, R * 0.4, R * 1.3, -R * 0.2, R * 0.35);
    part(g, blade, { h: 214, s: 8, l: 68 }, 41, { depth: R * 0.12, thin: 0.5, thick: 1.3 });
    // The edge: a bright bevel along the curve.
    const edge: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = -1 + (i / 10) * 2;
      edge.push({ x: R * (0.95 + 0.3 * Math.cos(a * 1.2)) - R * 0.08, y: a * R * 0.98 });
    }
    g.fillStyle = '#f4f6fa';
    stroke(g, edge, { w: R * 0.16, seed: 42, taper: [0.2, 0.2], press: 0.1 });
    if (spiral) {
      // You are getting very sleepy.
      const sp: P[] = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 5;
        const r = (i / 40) * R * 0.62;
        sp.push({ x: R * 0.42 + Math.cos(a) * r, y: Math.sin(a) * r });
      }
      g.fillStyle = '#7a2bb0';
      stroke(g, sp, { w: R * 0.12, seed: 43, taper: [0.05, 0.1], press: 0.1 });
    }
    part(g, boxPts(-R * 0.4, -R * 0.42, R * 0.55, R * 0.84, 1, 44), IRON(pal), 44, { depth: 0.4, thin: 0.4, thick: 0.9 });
  });
}

/** Pizza Cutter: the handle it came with, still on the hub. */
function handle() {
  return sprite('sw|handle', -2, -2, 18, 6, (g) => {
    part(g, boxPts(4, -1.6, 10, 3.2, 1.4, 51), { h: 6, s: 62, l: 46 }, 51, { depth: 0.5, thin: 0.4, thick: 0.9 });
    part(g, boxPts(0, -1.1, 4.6, 2.2, 0.5, 52), { h: 212, s: 8, l: 74 }, 52, { depth: 0.3, thin: 0.35, thick: 0.7 });
    glint(g, poly(6, -0.9, 9, -1, 12, -0.8), 'rgba(255,220,210,0.85)', 0.5);
  });
}

/**
 * A crate card's still pose: a pendulum caught mid-swing, a lone head out to the lower right, a pair
 * near level. An orbit seen at a random frame is a head somewhere in a box mostly empty.
 */
export function cardAngles(m: Swinger): number[] {
  if (m.swing > 0) return [m.angle0 + m.swing * 0.6];
  if (m.count === 1) return [Math.PI * 0.22];
  return Array.from({ length: m.count }, (_, i) => -0.3 + (i * Math.PI * 2) / m.count);
}

/** Motion lines trailing a posed head round its arc: the swing a still card can't show. */
function swoosh(s: CanvasRenderingContext2D, hx: number, hy: number, arm: number, R: number, a: number, back: number) {
  s.fillStyle = 'rgba(255,255,255,0.72)';
  for (const [k, from, to, w] of [
    [1 + (R * 0.75) / arm, 0.3, 1.25, 1.1],
    [1, 0.42, 1.05, 0.9],
    [1 - (R * 0.75) / arm, 0.55, 0.95, 0.7],
  ] as const) {
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = a - back * (from + ((to - from) * i) / 8);
      pts.push({ x: hx + Math.cos(t) * arm * k, y: hy + Math.sin(t) * arm * k });
    }
    stroke(s, pts, { w, seed: k * 7, taper: [0.8, 0.1], press: 0 });
  }
}

function drawSwinger(rc: RC, m: Swinger, r: Resolved, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const f = rc.frame;
  const hx = m.hub[0] + off[0];
  const hy = m.hub[1] + off[1];
  const heads = o.card ? cardAngles(m).map((a) => ({ x: hx + Math.cos(a) * m.arm, y: hy + Math.sin(a) * m.arm, a })) : swingHeads(m, f, r.phase, off);
  const name = r.pp.def.name;
  if (o.card && m.arm > 0) {
    // Lines trail each head back the way it came: a pendulum's toward the bottom of its swing.
    const back = m.swing > 0 ? 1 : m.dir;
    for (const h of heads) swoosh(s, hx, hy, m.arm, m.radius, h.a, back);
  }
  for (const h of heads) {
    if (m.arm <= 0) continue;
    if (m.link === 'chain') {
      const n = Math.max(3, Math.floor(m.arm / 4));
      for (let i = 0; i < n; i++) {
        const t0 = (i + 0.5) / n;
        s.save();
        s.translate(hx + (h.x - hx) * t0, hy + (h.y - hy) * t0);
        s.rotate(h.a);
        stamp(s, link(pal, i % 2 === 1));
        s.restore();
      }
    } else {
      s.fillStyle = INK;
      line(s, hx, hy, h.x, h.y, { w: 4.4, seed: 3, taper: [0, 0], press: 0.1 });
      s.fillStyle = css(pal.base);
      line(s, hx, hy, h.x, h.y, { w: 2.3, seed: 4, taper: [0, 0], press: 0.1 });
      s.fillStyle = css(pal.spec, 0, 0.75);
      line(s, hx, hy - 0.6, h.x, h.y - 0.6, { w: 0.6, seed: 5, taper: [0.1, 0.1], press: 0.1 });
    }
  }
  if (m.head === 'mace' && name.includes('Chump')) stamp(s, stake(pal), hx, hy);
  else if (m.arm > 0 || m.head !== 'saw') stamp(s, hub(pal), hx, hy);

  for (const h of heads) {
    if (m.head === 'saw') {
      drawSaw(rc, h.x, h.y, m.radius, f * 0.45 * m.dir + r.pp.uid, pal, st, o);
      if (m.arm <= 0 && name.includes('Pizza')) {
        s.save();
        s.translate(h.x, h.y);
        s.rotate(2.35);
        stamp(s, handle());
        s.restore();
      }
    } else if (m.head === 'mace') {
      s.save();
      s.translate(h.x, h.y);
      s.rotate(f * 0.03 * m.dir);
      stamp(s, maceSpikes(m.radius));
      s.restore();
      stamp(s, maceBall(m.radius, pal), h.x, h.y);
    } else {
      s.save();
      s.translate(h.x, h.y);
      s.rotate(h.a);
      // Keep the blade's lit side up whichever way it swings.
      if (Math.cos(h.a) < 0) s.scale(1, -1);
      stamp(s, axe(m.radius, pal, name.includes('Hypno')));
      s.restore();
    }
  }
}

function drawSaw(rc: RC, x: number, y: number, R: number, rot: number, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  inkSaw(rc, x, y, R, rot, pal, Math.round(R * 7), st.trim === 'stripes');
  // Sparks when the blade grinds terrain.
  if (o.emit && o.level) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = x + Math.cos(a) * (R + 1);
      const py = y + Math.sin(a) * (R + 1);
      if (tileAt(o.level, Math.floor(px / TILE), Math.floor(py / TILE)) && Math.random() < 0.5) {
        const ta = a + Math.PI / 2;
        o.emit('spark', px, py, Math.cos(ta) * 160 + (Math.random() - 0.5) * 60, Math.sin(ta) * 160 - 40, { h: 40, s: 100, l: 65 });
        light(rc, px, py, 30, { h: 35, s: 100, l: 60 }, 0.6);
      }
    }
  }
}

defineArt<'swinger'>({ type: 'swinger', layer: 2, draw: (rc, m, d) => drawSwinger(rc, m, d.r, d.off, d.pal, d.style, d.o) });
