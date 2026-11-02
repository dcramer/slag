import { css, type HSL } from '../../../core/color';
import type { Cell } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import type { Level } from '../../../sim/level';
import { blastHits, blastSpec, footprintCells, type ModuleOf, type PlacedProp } from '../../../sim/props';
import { circle, ellipse, glowDot, light, METALS, metalFill, type RC, rrect, sphereFill } from '../../kit';
import { defineArt } from '../common';

type Bomb = ModuleOf<'bomb'>;

function fuse(rc: RC, x: number, y: number) {
  const s = rc.s;
  s.strokeStyle = '#a07040';
  s.lineWidth = 1.2;
  s.beginPath();
  s.moveTo(x + 3.2, y - 6);
  s.quadraticCurveTo(x + 6, y - 11, x + 8.5, y - 8.5);
  s.stroke();
  const fl = 0.7 + Math.sin(rc.t * 30) * 0.3;
  glowDot(rc.g, x + 8.5, y - 8.5, 5 * fl, { h: 40, s: 100, l: 60 }, 1);
}

function drawBall(rc: RC, x: number, y: number) {
  const s = rc.s;
  s.fillStyle = sphereFill(s, x, y + 1, 6.5, { h: 230, s: 15, l: 18 }, 35, 10);
  circle(s, x, y + 1, 6.5);
  s.fillStyle = '#444a55';
  s.fillRect(x + 1.5, y - 6.5, 3.5, 3);
  fuse(rc, x, y);
}

/** Each demolition look says what it hits: fire = everything, blue = props only, drill = terrain in a line. */
function drawBomb(rc: RC, m: Bomb, x: number, y: number, rot: number) {
  const s = rc.s;
  const g = rc.g;
  switch (m.look ?? 'bomb') {
    case 'bomb':
      drawBall(rc, x, y);
      break;
    case 'emp': {
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
      break;
    }
    case 'drill': {
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
      break;
    }
    case 'charge': {
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
        for (const dx of [-4, 0, 4]) {
          s.fillStyle = sphereFill(s, x + dx, y, 3, { h: 2, s: 75, l: 44 }, 20, 15);
          rrect(s, x + dx - 2, y - 6, 4, 12, 1.5);
          s.fill();
        }
        s.fillStyle = '#2a2a2a';
        s.fillRect(x - 6, y - 1, 12, 2);
        fuse(rc, x - 2, y);
      }
      break;
    }
    case 'clock': {
      drawBall(rc, x, y);
      s.fillStyle = '#f1ead8';
      circle(s, x - 1, y + 1.5, 3.6);
      s.strokeStyle = '#222';
      s.lineWidth = 0.7;
      s.beginPath();
      s.moveTo(x - 1, y + 1.5);
      s.lineTo(x - 1 + Math.cos(rc.t * 3) * 2.8, y + 1.5 + Math.sin(rc.t * 3) * 2.8);
      s.moveTo(x - 1, y + 1.5);
      s.lineTo(x - 1, y - 0.6);
      s.stroke();
      if (Math.floor(rc.t * 2) % 2 === 0) glowDot(g, x - 6, y - 4, 4, { h: 0, s: 100, l: 55 }, 0.9);
      break;
    }
  }
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
