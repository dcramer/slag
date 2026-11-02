import { cellsBounds, type Vec } from '../../core/geom';
import { TILE } from '../../sim/constants';
import { cardExtent, dirOf, type Module, motionOffset, type PartSize, type PlacedProp, type PropDef, type Resolved, resolveProp } from '../../sim/props';
import { circle, METALS, type RC } from '../kit';
import { BACKDROP, moduleArt, type PropDrawOpts } from './common';
import './modules';

export type { Emit, PropDrawOpts } from './common';
export { drawProjectile } from './projectiles';
export { drawBlastPreview } from './modules/bomb';
export { drawStuffed } from './modules/keg';
export { drawRunnerStatus, propEventFx } from './status';

type M<T extends Module['type']> = Extract<Module, { type: T }>;

function drawLayers(rc: RC, r: Resolved, o: PropDrawOpts, first: number, last: number) {
  const off: Vec = motionOffset(r, rc.frame);
  const style = r.pp.def.style;
  const pal = METALS[style.metal];
  for (let layer = first; layer <= last; layer++) {
    r.mods.forEach((m, mi) => {
      for (const art of moduleArt(m.type)) if (art.layer === layer) art.draw(rc, m, { r, off, mi, style, pal, o });
    });
  }
}

/** The scenery half of a prop. The renderer paints this before the terrain, which then occludes it (emissives included). */
export function drawBackdrop(rc: RC, r: Resolved, o: PropDrawOpts): void {
  drawLayers(rc, r, o, BACKDROP, BACKDROP);
}

/** Everything in front of the terrain, in layer order (0 back … 3 effects). */
export function drawForeground(rc: RC, r: Resolved, o: PropDrawOpts): void {
  if (o.showPath) drawPath(rc, r);
  drawLayers(rc, r, o, 0, 3);
}

/** A whole prop at rc.frame, for callers with no terrain to slot between its layers (ghosts, cards, the codex). */
export function drawResolved(rc: RC, r: Resolved, o: PropDrawOpts): void {
  drawBackdrop(rc, r, o);
  drawForeground(rc, r, o);
}

export function drawPlaced(rc: RC, pp: PlacedProp, o: PropDrawOpts) {
  drawResolved(rc, resolveProp(pp), o);
}

const BLAST_SCALE: Record<PartSize, number> = { small: 0.7, medium: 0.85, large: 1 };

/** Card preview: draw a def centered at (cx, cy) scaled to fit `size`. */
export function drawPreview(rc: RC, full: PropDef, cx: number, cy: number, size: number) {
  // A long rope would shrink to a thread on a card, so show only its top links: fewer of them, but
  // still more for a longer rope, or the medium and large cards are the same picture.
  const def: PropDef =
    full.mount === 'hang'
      ? {
          ...full,
          footprint: full.footprint.slice(0, 4),
          modules: full.modules.map((m) => (m.type === 'rope' ? { ...m, length: Math.min(4, 1 + m.length * 0.43) } : m)),
        }
      : full;
  const { w, h } = cellsBounds(def.footprint);
  // A jet shows its flame on the card, so the whole of it is centered and not just the nozzle.
  let [sx, sy] = [0, 0];
  for (const m of def.modules) {
    if (m.type !== 'flame') continue;
    const [dx, dy] = dirOf(m.angle);
    sx -= (dx * m.length * TILE) / 2;
    sy -= (dy * m.length * TILE) / 2;
  }
  // Sizes of a part share one scale, so a big one never looks smaller than a small one. A charge's art stays one tile whatever its blast, so it scales here.
  const blast = def.modules[0]?.type === 'bomb' ? BLAST_SCALE[def.size ?? 'large'] : 1;
  // The span leaves room for a flame either way from the nozzle; centered on the card, it needs half that.
  const span = full.span ?? cardExtent(def);
  const k = Math.min(2.4, size / ((sx || sy ? 1 + (span - 1) / 1.4 : span) * TILE)) * blast;
  const s = rc.s;
  const g = rc.g;
  for (const ctx of [s, g]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate((-w * TILE) / 2 + sx, (-h * TILE) / 2 + sy);
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
