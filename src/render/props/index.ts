import type { Vec } from '../../core/geom';
import { TILE } from '../../sim/constants';
import { dirOf, type Module, motionOffset, type PlacedProp, type PropDef, type Resolved, resolveProp } from '../../sim/props';
import { circle, METALS, type RC } from '../kit';
import { moduleArt, type PropDrawOpts } from './common';
import './modules';

export type { Emit, PropDrawOpts } from './common';
export { drawProjectile } from './projectiles';

type M<T extends Module['type']> = Extract<Module, { type: T }>;

/** Draw a resolved prop at rc.frame. Module arts draw in layer order (0 back … 3 effects). */
export function drawResolved(rc: RC, r: Resolved, o: PropDrawOpts): void {
  const off: Vec = motionOffset(r, rc.frame);
  const style = r.pp.def.style;
  const pal = METALS[style.metal];
  if (o.showPath) drawPath(rc, r);
  for (let layer = 0; layer <= 3; layer++) {
    r.mods.forEach((m, mi) => {
      for (const art of moduleArt(m.type)) if (art.layer === layer) art.draw(rc, m, { r, off, mi, style, pal, o });
    });
  }
}

export function drawPlaced(rc: RC, pp: PlacedProp, o: PropDrawOpts) {
  drawResolved(rc, resolveProp(pp), o);
}

/** Card preview: draw a def centered at (cx, cy) scaled to fit `size`. */

export function drawPreview(rc: RC, def: PropDef, cx: number, cy: number, size: number) {
  let w = 1;
  let h = 1;
  for (const [x, y] of def.footprint) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  let reachX = 0;
  let reachY = 0;
  for (const m of def.modules) {
    if (m.type === 'swinger') {
      reachX = Math.max(reachX, m.arm + m.radius);
      reachY = Math.max(reachY, m.arm + m.radius);
    }
    if (m.type === 'piston') reachY = Math.max(reachY, m.reach * 0.6 + 1);
    if (m.type === 'flame') reachY = Math.max(reachY, m.length * 0.7);
  }
  const ext = Math.max(w + reachX * 2, h + reachY * 2, 2);
  const k = Math.min(2.4, size / (ext * TILE));
  const s = rc.s;
  const g = rc.g;
  for (const ctx of [s, g]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate((-w * TILE) / 2, (-h * TILE) / 2);
  }
  const preview: PropDef = { ...def, motion: { type: 'none' } };
  if (def.mount === 'face') drawHostCells(rc, def.footprint);
  drawResolved(rc, resolveProp({ uid: 7, def: preview, owner: -1, tx: 0, ty: 0, rot: 0 }), { level: null });
  s.restore();
  g.restore();
}

function drawPath(rc: RC, r: Resolved) {
  const m = r.motion;
  if (m.type === 'none') return;
  const s = rc.s;
  const cells = r.mods.flatMap((x) => (x.type === 'body' ? x.cells : []));
  let cx: number;
  let cy: number;
  if (cells.length) {
    cx = (cells.reduce((a, c) => a + c[0], 0) / cells.length + 0.5) * TILE;
    cy = (cells.reduce((a, c) => a + c[1], 0) / cells.length + 0.5) * TILE;
  } else {
    const sw = r.mods.find((x) => x.type === 'swinger') as M<'swinger'> | undefined;
    cx = sw ? sw.hub[0] : (r.pp.tx + 0.5) * TILE;
    cy = sw ? sw.hub[1] : (r.pp.ty + 0.5) * TILE;
  }
  s.save();
  s.strokeStyle = 'rgba(20,20,28,0.55)';
  s.lineWidth = 3;
  s.lineCap = 'round';
  if (m.type === 'rail') {
    const [dx, dy] = dirOf(m.angle);
    s.beginPath();
    s.moveTo(cx, cy);
    s.lineTo(cx + dx * m.range, cy + dy * m.range);
    s.stroke();
    s.strokeStyle = 'rgba(200,200,215,0.45)';
    s.lineWidth = 1;
    s.setLineDash([2, 3]);
    s.stroke();
    s.setLineDash([]);
    s.fillStyle = 'rgba(40,40,50,0.9)';
    circle(s, cx, cy, 2.5);
    circle(s, cx + dx * m.range, cy + dy * m.range, 2.5);
  } else {
    s.beginPath();
    s.arc(cx - m.radius, cy, m.radius, 0, Math.PI * 2);
    s.stroke();
    s.strokeStyle = 'rgba(200,200,215,0.4)';
    s.lineWidth = 1;
    s.setLineDash([2, 3]);
    s.stroke();
    s.setLineDash([]);
  }
  s.restore();
}

/** Ghostly host blocks under an attachment preview (it mounts on existing blocks). */
export function drawHostCells(rc: RC, cells: readonly (readonly [number, number])[]) {
  const s = rc.s;
  for (const [x, y] of cells) {
    s.fillStyle = 'rgba(120,118,135,0.55)';
    s.fillRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    s.strokeStyle = 'rgba(200,200,215,0.35)';
    s.setLineDash([2, 2]);
    s.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
    s.setLineDash([]);
  }
}
