import { css, type HSL } from '../../../core/color';
import type { Cell } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import type { Level } from '../../../sim/level';
import { blastHits, blastSpec, type BombLook, footprintCells, type ModuleOf, type PlacedProp } from '../../../sim/props';
import { blob, line, stroke } from '../../ink';
import { ball, boxPts, dot, glint, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { circle, glowDot, light, METALS, type RC } from '../../kit';
import { defineArt } from '../common';

type Bomb = ModuleOf<'bomb'>;

const INK = '#120b08';

/** A ball in two flat tones, its lit side cut toward the light, a pen round it and one hard glint. */
function inkBall(s: CanvasRenderingContext2D, x: number, y: number, r: number, base: HSL) {
  s.fillStyle = INK;
  circle(s, x + 0.35, y + 0.4, r + 1.15);
  s.fillStyle = css(base, -6, 1, 4);
  circle(s, x, y, r);
  s.save();
  s.beginPath();
  s.arc(x, y, r, 0, Math.PI * 2);
  s.clip();
  s.fillStyle = css(base, 6);
  circle(s, x - r * 0.24, y - r * 0.26, r * 0.9);
  s.restore();
  s.fillStyle = 'rgba(255,255,255,0.9)';
  stroke(
    s,
    [
      { x: x - r * 0.62, y: y - r * 0.1 },
      { x: x - r * 0.5, y: y - r * 0.48 },
      { x: x - r * 0.18, y: y - r * 0.64 },
    ],
    { w: 1.3, seed: 2, taper: [0.25, 0.35], press: 0.1 },
  );
}

/** A fuse: a twist of cord with an ink edge, and a spark at the end that's actually hot. */
function fuse(rc: RC, x: number, y: number) {
  const s = rc.s;
  const pts = [
    { x: x + 3.2, y: y - 6 },
    { x: x + 4.6, y: y - 9.4 },
    { x: x + 6.8, y: y - 10.4 },
    { x: x + 8.5, y: y - 8.5 },
  ];
  s.fillStyle = INK;
  stroke(s, pts, { w: 2.4, seed: 4, taper: [0, 0.2], press: 0 });
  s.fillStyle = '#c9925a';
  stroke(s, pts, { w: 1.1, seed: 4, taper: [0, 0.3], press: 0 });
  const fl = 0.7 + Math.sin(rc.t * 30) * 0.3;
  s.fillStyle = 'rgb(255 214 90)';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rc.t * 9;
    line(s, x + 8.5, y - 8.5, x + 8.5 + Math.cos(a) * 2.6 * fl, y - 8.5 + Math.sin(a) * 2.6 * fl, { w: 0.9, seed: i, taper: [0.1, 0.8], press: 0 });
  }
  glowDot(rc.g, x + 8.5, y - 8.5, 5 * fl, { h: 40, s: 100, l: 60 }, 1);
}

function drawBall(rc: RC, x: number, y: number, base: HSL = { h: 230, s: 18, l: 22 }) {
  const s = rc.s;
  inkBall(s, x, y + 1, 6.5, base);
  // The cap the fuse goes into.
  s.fillStyle = INK;
  s.fillRect(x + 0.9, y - 7.1, 4.6, 4);
  s.fillStyle = '#5b6170';
  s.fillRect(x + 1.6, y - 6.5, 3.2, 2.8);
  fuse(rc, x, y);
}

/** Balance Patch: a disk device with an antenna and a version sticker. */
function patchDisk() {
  return sprite('bomb|emp', -9, -12.5, 18, 18, (g) => {
    tick(g, 0, -4, 0, -10.6, 0.8, 1);
    ball(g, 0, -11, 1.4, { h: 200, s: 80, l: 60 }, 2);
    const shell = poly(-8, 2.4, -6.6, -1.4, -2.6, -3.6, 2.6, -3.6, 6.6, -1.4, 8, 2.4, 5, 4.4, -5, 4.4);
    part(g, shell, METALS.steel.base, 3, { depth: 0.9, thin: 0.5, thick: 1.2 });
    g.fillStyle = INK;
    line(g, -7.6, 2, 7.6, 2, { w: 0.6, seed: 4, taper: [0.1, 0.1], press: 0.2 });
    for (const lx of [-5, -2.5, 2.5, 5]) dot(g, lx, 3.2, 0.45, lx * 3, '#7fd6ff');
    part(g, boxPts(-3.6, -2.8, 7.2, 3, 0.4, 5), { h: 50, s: 70, l: 88 }, 5, { depth: 0.2, thin: 0.3, thick: 0.55 });
    g.fillStyle = '#1d2a50';
    g.font = 'bold 2.2px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('v1.0.1', 0, -1.25);
  });
}

/** The Mole: a drill with blinkers on, so it only ever sees straight ahead. */
function mole() {
  return sprite('bomb|drill', -8.5, -7.5, 18, 15, (g) => {
    part(g, boxPts(-7.4, -4.2, 8.4, 8.4, 1.6, 6), METALS.brass.base, 6, { depth: 0.8, thin: 0.45, thick: 1.1 });
    part(g, poly(0.6, -4, 8.6, 0, 0.6, 4), METALS.steel.light, 7, { depth: 0.6, thin: 0.45, thick: 1 });
    // Blinkers: a leather flap either side, a strap over the top.
    for (const sg of [-1, 1])
      part(g, poly(-3.2, sg * 3.6, 0.8, sg * 4.2, 1.6, sg * 6.4, -2.6, sg * 6), { h: 22, s: 45, l: 26 }, 8 + sg, { depth: 0.3, thin: 0.35, thick: 0.8 });
    tick(g, -2.4, -4.4, -2.4, 4.4, 0.9, 10, '#5a3418');
    dot(g, -5, 0, 0.8, 11, css(METALS.brass.light));
  });
}

/** The Moat Maker: a glazed donut with sprinkles. */
function donut() {
  return sprite('bomb|donut', -9, -7, 18, 14, (g) => {
    const dough: HSL = { h: 32, s: 60, l: 58 };
    const glaze: HSL = { h: 330, s: 70, l: 74 };
    part(g, ovalPts(0, 1.6, 7.6, 4.6, 12, 0.03, 24), dough, 12, { depth: 0.9, thin: 0.5, thick: 1.2 });
    g.fillStyle = css(glaze);
    path(g, ovalPts(-0.2, 0.9, 6.9, 3.8, 13, 0.1, 24));
    g.fill();
    g.fillStyle = INK;
    path(g, ovalPts(0, 1.4, 2.4, 1.2, 14, 0.05, 12));
    g.fill();
    const cols = ['#ffffff', '#ffd93a', '#5ad1ff', '#7be36a', '#ff6a3a'];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + hash2(i, 1, 15);
      const r = 3.4 + hash2(i, 2, 15) * 2.4;
      const sx = Math.cos(a) * r;
      const sy = 0.9 + Math.sin(a) * r * 0.5;
      const t = hash2(i, 3, 15) * Math.PI;
      g.fillStyle = cols[i % cols.length];
      line(g, sx - Math.cos(t) * 0.7, sy - Math.sin(t) * 0.5, sx + Math.cos(t) * 0.7, sy + Math.sin(t) * 0.5, { w: 0.5, seed: i, taper: [0, 0], press: 0 });
    }
    glint(g, poly(-5.6, -0.6, -3.8, -1.9, -1.4, -2.4), 'rgba(255,255,255,0.85)', 0.55);
  });
}

/** The alarm clock's face, with bells; the time is drawn live. */
function alarm() {
  return sprite('bomb|alarm', -6, -7, 12, 12, (g) => {
    for (const sg of [-1, 1]) ball(g, sg * 2.8, -3.8, 1.3, METALS.brass.base, 20 + sg);
    g.fillStyle = INK;
    blob(g, 0, 0, 4.4, 22, 1, 0.03);
    g.fill();
    g.fillStyle = '#f1ead8';
    blob(g, 0, 0, 3.6, 23, 1, 0.03);
    g.fill();
  });
}

/** Each demolition look says what it hits: fire = everything, blue = props only, drill = terrain in a line. */
const LOOKS: Record<BombLook, (rc: RC, m: Bomb, x: number, y: number, rot: number) => void> = {
  bomb(rc, _m, x, y) {
    // Two little feet under it, and its eyes screwed shut: it knows.
    const s = rc.s;
    for (const sg of [-1, 1]) {
      s.fillStyle = INK;
      s.beginPath();
      s.ellipse(x + sg * 3.2, y + 7.6, 2.4, 1.4, 0, 0, Math.PI * 2);
      s.fill();
      s.fillStyle = '#e8b04a';
      s.beginPath();
      s.ellipse(x + sg * 3.2 - 0.2, y + 7.3, 1.7, 0.85, 0, 0, Math.PI * 2);
      s.fill();
    }
    drawBall(rc, x, y);
    s.fillStyle = '#f2ede4';
    for (const sg of [-1, 1]) {
      line(s, x + sg * 3.6, y - 0.4, x + sg * 1.6, y + 0.6, { w: 0.75, seed: 3 + sg, taper: [0.1, 0.1], press: 0 });
      line(s, x + sg * 1.6, y + 0.6, x + sg * 3.6, y + 1.6, { w: 0.75, seed: 5 + sg, taper: [0.1, 0.1], press: 0 });
    }
  },
  emp(rc, _m, x, y) {
    const g = rc.g;
    const blue: HSL = { h: 200, s: 100, l: 60 };
    const pulse = 0.5 + 0.5 * Math.sin(rc.t * 8);
    glowDot(g, x, y - 11, 3 + pulse * 3, blue, 0.8);
    stamp(rc.s, patchDisk(), x, y);
    g.strokeStyle = css(blue, 10, 0.35 * pulse);
    g.lineWidth = 0.8;
    g.beginPath();
    g.ellipse(x, y + 1, 9 + pulse * 3, 4 + pulse * 1.5, 0, 0, Math.PI * 2);
    g.stroke();
    light(rc, x, y, 40, blue, 0.5);
  },
  drill(rc, _m, x, y, rot) {
    const s = rc.s;
    s.save();
    s.translate(x, y);
    s.rotate((rot & 3) * (Math.PI / 2));
    stamp(s, mole());
    // Flutes running down the bit as it turns.
    s.fillStyle = INK;
    const sp = (rc.t * 20) % 2;
    for (let k = 0; k < 4; k++) {
      const u = (k + sp / 2) / 4;
      line(s, 1 + u * 7, -3.4 * (1 - u), 1.8 + u * 7, 3.4 * (1 - u), { w: 0.5, seed: k, taper: [0.1, 0.1], press: 0 });
    }
    s.restore();
  },
  charge(rc, m, x, y) {
    if (m.shape === 'ring') {
      stamp(rc.s, donut(), x, y);
      return;
    }
    // The arena bomber's bomb: round, navy-black, a fuse and a shine.
    drawBall(rc, x, y, { h: 228, s: 34, l: 26 });
  },
  clock(rc, _m, x, y) {
    const s = rc.s;
    drawBall(rc, x, y);
    // An alarm clock strapped on, out of time: 0:00, flashing red.
    stamp(s, alarm(), x - 1, y + 1.5);
    const on = Math.floor(rc.t * 2.5) % 2 === 0;
    s.fillStyle = on ? '#e3201b' : '#7a2a24';
    s.font = 'bold 3px sans-serif';
    s.textAlign = 'center';
    s.textBaseline = 'middle';
    s.fillText('0:00', x - 1, y + 1.7);
    if (on) glowDot(rc.g, x - 1, y + 1.5, 5, { h: 0, s: 100, l: 55 }, 0.7);
  },
};

function drawBomb(rc: RC, m: Bomb, x: number, y: number, rot: number) {
  LOOKS[m.look ?? 'bomb'](rc, m, x, y, rot);
}

defineArt<'bomb'>({ type: 'bomb', layer: 2, draw: (rc, m, d) => drawBomb(rc, m, d.r.pp.tx * TILE + TILE / 2, d.r.pp.ty * TILE + TILE / 2, d.r.pp.rot) });

/** A square flame filling one blast cell: how the arena bomber's plus-shaped blast is drawn. */
function squareFlame(g: CanvasRenderingContext2D, x: number, y: number, t: number, k: number) {
  const j = Math.sin(t * 14 + x * 0.3 + y * 0.7) * 0.6;
  g.fillStyle = `rgba(255,120,30,${0.32 * k})`;
  g.fillRect(x + 1.5, y + 1.5 + j, TILE - 3, TILE - 3);
  g.fillStyle = `rgba(255,214,90,${0.38 * k})`;
  g.fillRect(x + 4, y + 4 + j, TILE - 8, TILE - 8);
  g.fillStyle = `rgba(255,250,220,${0.45 * k})`;
  g.fillRect(x + 6.5, y + 6.5 + j, TILE - 13, TILE - 13);
}

/**
 * Place-phase preview for any demolition prop: every cell the blast covers (from the same blastHits the
 * detonation uses), terrain that will break in orange, and every prop or set piece it will remove. A
 * plus-shaped charge shows its blast as a grid of square flames; a patch strikes out what it nerfs.
 */
export function drawBlastPreview(rc: RC, level: Level, placed: readonly PlacedProp[], m: Bomb, tx: number, ty: number, rot: number) {
  const g = rc.g;
  const spec = blastSpec(m);
  const hits = blastHits(level, placed, spec, tx, ty, rot);
  const pulse = 0.75 + Math.sin(rc.t * 10) * 0.25;
  const zone: HSL = spec.target === 'props' ? { h: 200, s: 100, l: 60 } : { h: 25, s: 100, l: 60 };
  if (m.shape === 'cross') for (const [x, y] of hits.cells) squareFlame(g, x * TILE, y * TILE, rc.t, pulse);
  else {
    g.fillStyle = css(zone, 0, 0.1 * pulse);
    for (const [x, y] of hits.cells) g.fillRect(x * TILE, y * TILE, TILE, TILE);
  }
  g.fillStyle = css({ h: 25, s: 100, l: 55 }, 0, 0.32 * pulse);
  for (const [x, y] of hits.tiles) g.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
  // Outline the blast area's edge.
  const set = new Set(hits.cells.map(([x, y]) => `${x},${y}`));
  g.strokeStyle = css(zone, 10, 0.7 * pulse);
  g.lineWidth = 1;
  g.beginPath();
  for (const [x, y] of hits.cells) {
    const X = x * TILE;
    const Y = y * TILE;
    const edge = (x1: number, y1: number, x2: number, y2: number) => {
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
    };
    if (!set.has(`${x},${y - 1}`)) edge(X, Y, X + TILE, Y);
    if (!set.has(`${x},${y + 1}`)) edge(X, Y + TILE, X + TILE, Y + TILE);
    if (!set.has(`${x - 1},${y}`)) edge(X, Y, X, Y + TILE);
    if (!set.has(`${x + 1},${y}`)) edge(X + TILE, Y, X + TILE, Y + TILE);
  }
  g.stroke();
  const red = css({ h: 0, s: 100, l: 60 }, 0, 0.85 * pulse);
  for (const p of [...hits.props, ...hits.setPieces]) {
    const cells = footprintCells(p) as Cell[];
    if (spec.target === 'props') {
      // Patch notes: struck through.
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [x, y] of cells) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x + 1);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y + 1);
      }
      g.fillStyle = red;
      const my = ((y0 + y1) / 2) * TILE;
      line(g, x0 * TILE - 2, my - 1, x1 * TILE + 2, my + 1, { w: 1.8, seed: x0 + y0, taper: [0.05, 0.05], press: 0.2 });
      if (y1 - y0 > 1) line(g, x0 * TILE - 2, my + 5, x1 * TILE + 2, my + 7, { w: 1.4, seed: x0 + y0 + 1, taper: [0.05, 0.05], press: 0.2 });
    } else {
      g.strokeStyle = red;
      g.lineWidth = 1.5;
      for (const [x, y] of cells) g.strokeRect(x * TILE + 1.5, y * TILE + 1.5, TILE - 3, TILE - 3);
    }
  }
}
