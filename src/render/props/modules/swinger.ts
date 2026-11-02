import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { tileAt } from '../../../sim/level';
import { LOG_LEN, LOG_THICK, type ModuleOf, type PropStyle, type Resolved, swingHeads } from '../../../sim/props';
import { inkFor, line, type P, stroke } from '../../ink';
import { ball, barLine, boxPts, dot, glint, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { light, type MetalPalette, type RC } from '../../kit';
import { defineArt, type PropDrawOpts } from '../common';
import { whoosh } from '../ink-motion';
import { sawBlade } from './saw-art';

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
    g.fillStyle = inkFor(pal.base);
    path(g, ovalPts(0.1, 0.15, 3.35, 2.35, 5, 0.03, 16));
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
    g.fillStyle = inkFor(pal.base);
    stroke(g, [...inner, inner[0]], { w: 0.35, seed: 7, taper: [0, 0], press: 0.2 });
  });
}

/** The hub: a square bearing plate bolted at its corners, and the boss the arm turns on. */
function hub(pal: MetalPalette) {
  return sprite(`sw|hub|${palKey(pal)}`, -7, -7, 14, 14, (g) => {
    part(g, boxPts(-5.4, -5.4, 10.8, 10.8, 1.8, 10, 0.3), { ...pal.base, l: pal.base.l - 6 }, 10, { depth: 1, shade: -20, thin: 0.45, thick: 1.2 });
    for (const [x, y] of [
      [-3.6, -3.6],
      [3.6, -3.6],
      [-3.6, 3.6],
      [3.6, 3.6],
    ])
      dot(g, x, y, 0.75, x * 3 + y, css(pal.spec, -6), inkFor(pal.base));
    ball(g, 0, 0, 3.1, pal.base, 11);
    dot(g, 0, 0, 1, 12, css(pal.light), inkFor(pal.base));
  });
}

/**
 * A spike that points out of the ball at you: a four-faceted pyramid on a forged collar, seen nose-on. The
 * light on its facets stays put while it rides round the ball, so it reads as a spike turning, not a seam.
 */
function maceStud(R: number, pal: MetalPalette) {
  const r = Math.max(1.3, R * 0.24);
  return sprite(`sw|stud|${R.toFixed(2)}|${palKey(pal)}`, -r - 1.5, -r - 1.5, r * 2 + 3, r * 2 + 3, (g) => {
    g.fillStyle = inkFor(IRON(pal));
    path(g, ovalPts(0.2, 0.25, r * 1.05, r * 1.05, 61, 0.05, 12));
    g.fill();
    g.fillStyle = css(IRON(pal), -10);
    path(g, ovalPts(0, 0, r * 0.95, r * 0.95, 62, 0.05, 12));
    g.fill();
    const k = r * 0.78;
    const tip = { x: -r * 0.12, y: -r * 0.14 };
    const n = { x: 0, y: -k };
    const e = { x: k, y: 0 };
    const so = { x: 0, y: k };
    const w = { x: -k, y: 0 };
    for (const [a, b, col] of [
      [w, n, '#eef1f6'],
      [n, e, '#b9bfca'],
      [e, so, '#6c7380'],
      [so, w, '#9aa1ad'],
    ] as const) {
      g.fillStyle = col;
      path(g, [a, b, tip]);
      g.fill();
    }
    g.fillStyle = inkFor(IRON(pal));
    stroke(g, [n, e, so], { w: 0.45, seed: 63, taper: [0.2, 0.2], press: 0.2 });
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
    g.fillStyle = inkFor(col);
    path(g, ovalPts(0.15, 0.5, 5.7, 5.3, 24, 0.02, 20));
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

const SPIKE: HSL = { h: 214, s: 10, l: 62 };

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
      g.fillStyle = inkFor(SPIKE);
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

/**
 * A battering log, level, centred on its head: a bark-dark trunk with its end grain showing and a crown
 * of sharpened stakes lashed round each end, all inside `logBox` (the sim's hurt box).
 */
function logHead(R: number, woodHue: number) {
  const L = R * LOG_LEN;
  const T = R * LOG_THICK;
  return sprite(`sw|log|${R.toFixed(2)}|${woodHue | 0}`, -L / 2 - 1, -T / 2 - 1, L + 2, T + 2, (g) => {
    const bark: HSL = { h: woodHue, s: 34, l: 30 };
    const stake = L * 0.1;
    const body = boxPts(-L / 2 + stake, -T / 2, L - 2 * stake, T, T * 0.45, 61, 0.3);
    part(g, body, bark, 61, { depth: T * 0.12, thin: 0.5, thick: 1.2 });
    // Bark: long splits along the trunk, darker than the wood.
    for (let i = 0; i < 4; i++) {
      const y = -T * 0.3 + (i * T * 0.6) / 3;
      const x0 = -L / 2 + stake + 2 + ((i * 7) % 5);
      tick(g, x0, y, x0 + L * (0.3 + 0.1 * (i % 2)), y + 0.3, 0.45, 62 + i, css(bark, -14));
    }
    // A lashing of vine near each end, and the stakes jutting out past it.
    for (const s of [-1, 1]) {
      const ex = s * (L / 2 - stake);
      g.fillStyle = css({ h: 100, s: 40, l: 30 });
      for (const k of [0, 1]) line(g, ex - s * (2.2 + k * 1.6), -T / 2, ex - s * (1.4 + k * 1.6), T / 2, { w: 0.9, seed: 63 + k, taper: [0.1, 0.1], press: 0 });
      for (let i = 0; i < 3; i++) {
        const y = -T * 0.32 + i * T * 0.32;
        const pts = poly(ex - s * 0.6, y - T * 0.12, s * (L / 2) - s * 0.2, y, ex - s * 0.6, y + T * 0.12);
        part(g, pts, { h: woodHue + 8, s: 30, l: 62 }, 64 + i, { depth: 0.2, thin: 0.3, thick: 0.6 });
      }
    }
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
  // Motion lines trailing a head round its arc, longer the faster it goes.
  if (!o.card && m.arm > 0 && m.head !== 'saw') {
    const w = m.swing > 0 ? m.swing * ((Math.PI * 2) / m.period) * Math.cos(Math.PI * 2 * (f / m.period + r.phase)) : (m.dir * Math.PI * 2) / m.period;
    const sweep = Math.max(-0.9, Math.min(0.9, w * 9));
    if (Math.abs(w * m.arm) > 0.6) {
      for (const h of heads) {
        whoosh(s, hx, hy, m.arm + m.radius * 0.7, h.a, sweep, 1.2, 'rgba(250,250,255,0.85)', 3);
        whoosh(s, hx, hy, m.arm - m.radius * 0.7, h.a - sweep * 0.15, sweep * 0.7, 0.9, 'rgba(250,250,255,0.7)', 4);
        whoosh(s, hx, hy, m.arm + m.radius * 1.05, h.a - sweep * 0.2, sweep * 0.55, 0.9, inkFor(pal.base), 5);
      }
    }
  }
  if (m.head === 'log') {
    drawLog(s, m, heads, hx, hy, st.woodHue);
    return;
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
      barLine(s, hx, hy, h.x, h.y, 2.3, pal.base, 3, { taper: [0, 0], press: 0.1, rim: 0.4 });
      s.fillStyle = css(pal.spec, 0, 0.75);
      line(s, hx, hy - 0.6, h.x, h.y - 0.6, { w: 0.6, seed: 5, taper: [0.1, 0.1], press: 0.1 });
    }
  }
  if (m.head === 'mace' && name.includes('Chump')) stamp(s, stake(pal), hx, hy);
  else if (m.arm > 0 || m.head !== 'saw') stamp(s, hub(pal), hx, hy);

  for (const h of heads) {
    if (m.head === 'saw') {
      drawSaw(rc, h.x, h.y, m.radius, f * 0.45 * m.dir + r.pp.uid, pal, st, o, m.dir);
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
      // Spikes on its face, riding round with the ones on its rim.
      const stud = maceStud(m.radius, pal);
      const spin = f * 0.03 * m.dir;
      for (let i = 0; i < 4; i++) {
        const a = spin + Math.PI / 4 + (i * Math.PI) / 2;
        stamp(s, stud, h.x + Math.cos(a) * m.radius * 0.46, h.y + Math.sin(a) * m.radius * 0.46);
      }
      stamp(s, stud, h.x, h.y);
    } else if (m.head === 'weight') {
      // A blunt iron weight: a ball on its chain, nothing on it to cut or stab.
      stamp(s, maceBall(m.radius * 1.1, pal), h.x, h.y);
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

/**
 * A log slung on two ropes from a crossbar at the hub: the ropes stay parallel, so the log swings level
 * (the sim's `logBox`). The crossbar is lashed under whatever holds the hub.
 */
function drawLog(s: CanvasRenderingContext2D, m: Swinger, heads: readonly { x: number; y: number; a: number }[], hx: number, hy: number, woodHue: number) {
  const L = m.radius * LOG_LEN;
  const rope: HSL = { h: 38, s: 36, l: 52 };
  const spread = L * 0.3;
  for (const h of heads) {
    for (const k of [-1, 1]) {
      barLine(s, hx + k * spread, hy, h.x + k * spread, h.y, 0.9, rope, 70 + k, { taper: [0, 0], press: 0.1 });
    }
  }
  part(s, boxPts(hx - spread - 2.5, hy - 1.6, spread * 2 + 5, 3.2, 1.2, 74), { h: woodHue, s: 30, l: 28 }, 74, { depth: 0.4, thin: 0.4, thick: 0.9 });
  const sp = logHead(m.radius, woodHue);
  for (const h of heads) stamp(s, sp, h.x, h.y);
}

function drawSaw(rc: RC, x: number, y: number, R: number, rot: number, pal: MetalPalette, st: PropStyle, o: PropDrawOpts, spin: number) {
  sawBlade(rc, x, y, R, rot, pal, Math.round(R * 7), st.trim === 'stripes', spin);
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
