import { css, type HSL } from '../../../core/color';
import type { Cell } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import type { Level } from '../../../sim/level';
import { blastHits, blastSpec, type BombLook, footprintCells, type ModuleOf, type PlacedProp } from '../../../sim/props';
import { line, stroke } from '../../ink';
import { circle, ellipse, glowDot, light, METALS, metalFill, type RC, rrect } from '../../kit';
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

function drawBall(rc: RC, x: number, y: number) {
  const s = rc.s;
  inkBall(s, x, y + 1, 6.5, { h: 230, s: 18, l: 22 });
  // The cap the fuse goes into.
  s.fillStyle = INK;
  s.fillRect(x + 0.9, y - 7.1, 4.6, 4);
  s.fillStyle = '#5b6170';
  s.fillRect(x + 1.6, y - 6.5, 3.2, 2.8);
  fuse(rc, x, y);
}

/** One stick of dynamite: red paper, a darker side, pen lines, and a paper band. */
function stick(s: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  s.fillStyle = INK;
  s.beginPath();
  s.roundRect(x - 2.6, y - 6.6, 5.2, 13.2, 1.8);
  s.fill();
  s.fillStyle = 'rgb(166 34 30)';
  s.beginPath();
  s.roundRect(x - 2, y - 6, 4, 12, 1.4);
  s.fill();
  s.fillStyle = 'rgb(222 64 48)';
  s.fillRect(x - 2, y - 5.4, 2.2, 10.8);
  s.fillStyle = 'rgba(255,230,210,0.85)';
  line(s, x - 1.2, y - 4.4, x - 1.2, y + 3.6, { w: 0.6, seed, taper: [0.2, 0.3], press: 0 });
}
/** Each demolition look says what it hits: fire = everything, blue = props only, drill = terrain in a line. */
const LOOKS: Record<BombLook, (rc: RC, m: Bomb, x: number, y: number, rot: number) => void> = {
  bomb(rc, _m, x, y) {
    drawBall(rc, x, y);
  },
  emp(rc, _m, x, y) {
    const s = rc.s;
    const g = rc.g;
    const blue: HSL = { h: 200, s: 100, l: 60 };
    s.fillStyle = metalFill(s, METALS.steel, x - 7, y - 2, 14, 7);
    rrect(s, x - 7, y - 2, 14, 7, 2);
    s.fill();
    for (let i = 0; i < 3; i++) {
      s.fillStyle = css(METALS.copper.base, i * 6);
      ellipse(s, x, y - 2 - i * 2.2, 4.5 - i, 1.4);
    }
    s.strokeStyle = '#2b2f38';
    s.lineWidth = 0.8;
    s.beginPath();
    s.moveTo(x, y - 8);
    s.lineTo(x, y - 12);
    s.stroke();
    const pulse = 0.5 + 0.5 * Math.sin(rc.t * 8);
    glowDot(g, x, y - 12, 4 + pulse * 3, blue, 0.9);
    g.strokeStyle = css(blue, 10, 0.4 * pulse);
    g.beginPath();
    g.arc(x, y - 2, 8 + pulse * 3, 0, Math.PI * 2);
    g.stroke();
    light(rc, x, y, 40, blue, 0.5);
  },
  drill(rc, _m, x, y, rot) {
    const s = rc.s;
    s.save();
    s.translate(x, y);
    s.rotate((rot & 3) * (Math.PI / 2));
    s.fillStyle = metalFill(s, METALS.brass, -7, -4, 7, 8);
    rrect(s, -7, -4, 7, 8, 1.5);
    s.fill();
    s.fillStyle = metalFill(s, METALS.steel, 0, -4, 8, 8);
    s.beginPath();
    s.moveTo(0, -4);
    s.lineTo(8, 0);
    s.lineTo(0, 4);
    s.closePath();
    s.fill();
    s.strokeStyle = '#2b2f38';
    s.lineWidth = 0.7;
    const sp = (rc.t * 20) % 2;
    for (let k = 0; k < 4; k++) {
      const u = (k + sp / 2) / 4;
      s.beginPath();
      s.moveTo(u * 8, -4 * (1 - u));
      s.lineTo(u * 8 + 1.2, 4 * (1 - u));
      s.stroke();
    }
    s.restore();
  },
  charge(rc, m, x, y) {
    const s = rc.s;
    const g = rc.g;
    if (m.shape === 'ring') {
      s.strokeStyle = '#3a3f35';
      s.lineWidth = 3.5;
      s.beginPath();
      s.ellipse(x, y + 2, 6.5, 3.5, 0, 0, Math.PI * 2);
      s.stroke();
      s.strokeStyle = '#6f7a5a';
      s.lineWidth = 1.5;
      s.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        g.fillStyle = 'rgba(255,80,60,0.9)';
        circle(g, x + Math.cos(a) * 6.5, y + 2 + Math.sin(a) * 3.5, 0.9);
      }
    } else {
      for (const dx of [-4, 0, 4]) stick(s, x + dx, y, dx + 7);
      // Taped together, badly.
      s.fillStyle = INK;
      s.fillRect(x - 6.8, y - 1.6, 13.6, 3.2);
      s.fillStyle = 'rgb(214 200 170)';
      s.fillRect(x - 6.2, y - 1, 12.4, 2);
      fuse(rc, x - 2, y);
    }
  },
  clock(rc, _m, x, y) {
    const s = rc.s;
    const g = rc.g;
    drawBall(rc, x, y);
    // An alarm clock strapped on: a cream face, a pen ring, and hands that mean it.
    s.fillStyle = INK;
    circle(s, x - 1, y + 1.5, 4.3);
    s.fillStyle = '#f1ead8';
    circle(s, x - 1, y + 1.5, 3.5);
    s.fillStyle = INK;
    line(s, x - 1, y + 1.5, x - 1 + Math.cos(rc.t * 3) * 2.8, y + 1.5 + Math.sin(rc.t * 3) * 2.8, { w: 0.8, seed: 1, taper: [0, 0.5], press: 0 });
    line(s, x - 1, y + 1.5, x - 1, y - 0.6, { w: 1, seed: 2, taper: [0, 0.3], press: 0 });
    if (Math.floor(rc.t * 2) % 2 === 0) glowDot(g, x - 6, y - 4, 4, { h: 0, s: 100, l: 55 }, 0.9);
  },
};

function drawBomb(rc: RC, m: Bomb, x: number, y: number, rot: number) {
  LOOKS[m.look ?? 'bomb'](rc, m, x, y, rot);
}

defineArt<'bomb'>({ type: 'bomb', layer: 2, draw: (rc, m, d) => drawBomb(rc, m, d.r.pp.tx * TILE + TILE / 2, d.r.pp.ty * TILE + TILE / 2, d.r.pp.rot) });

/**
 * Place-phase preview for any demolition prop: every cell the blast covers
 * (from the same blastHits the detonation uses), terrain that will break in
 * orange, and red outlines on each prop/set piece it will remove.
 */
export function drawBlastPreview(rc: RC, level: Level, placed: readonly PlacedProp[], m: Bomb, tx: number, ty: number, rot: number) {
  const g = rc.g;
  const spec = blastSpec(m);
  const hits = blastHits(level, placed, spec, tx, ty, rot);
  const pulse = 0.75 + Math.sin(rc.t * 10) * 0.25;
  const zone: HSL = spec.target === 'props' ? { h: 200, s: 100, l: 60 } : { h: 25, s: 100, l: 60 };
  g.fillStyle = css(zone, 0, 0.1 * pulse);
  for (const [x, y] of hits.cells) g.fillRect(x * TILE, y * TILE, TILE, TILE);
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
  g.strokeStyle = css({ h: 0, s: 100, l: 60 }, 0, 0.85 * pulse);
  g.lineWidth = 1.5;
  for (const p of [...hits.props, ...hits.setPieces])
    for (const [x, y] of footprintCells(p) as Cell[]) g.strokeRect(x * TILE + 1.5, y * TILE + 1.5, TILE - 3, TILE - 3);
}
