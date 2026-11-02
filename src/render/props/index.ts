import { cellsBounds, type Vec } from '../../core/geom';
import { TILE } from '../../sim/constants';
import { dirOf, type Module, motionOffset, type PartSize, type PropDef, type Resolved, resolveProp } from '../../sim/props';
import { circle, METALS, type RC } from '../kit';
import { BACKDROP, moduleArt, type PropDrawOpts } from './common';
import './modules';
import { PISTON_CARD_HEAD } from './modules/piston';
import { cardAngles } from './modules/swinger';
import { drawTrack } from './track';

export type { Emit, PropDrawOpts } from './common';
export { drawProjectile } from './projectiles';
export { drawBlastPreview } from './modules/bomb';
export { drawHeld } from './common';
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
  drawTrack(rc, r);
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

const BLAST_SCALE: Record<PartSize, number> = { small: 0.7, medium: 0.85, large: 1 };

/** How much a card shows of each size: big enough to read alone, and still smaller for a smaller part. */
const CARD_SIZE: Record<PartSize, number> = { small: 0.6, medium: 0.8, large: 0.96 };

/** The picture a card draws of a part: what would leave its body a speck is trimmed to fit. */
function cardDef(full: PropDef): PropDef {
  // A long rope would shrink to a thread on a card, so show only its top links: fewer of them, but
  // still more for a longer rope, or the medium and large cards are the same picture.
  if (full.mount === 'hang')
    return {
      ...full,
      footprint: full.footprint.slice(0, 4),
      modules: full.modules.map((m) => (m.type === 'rope' ? { ...m, length: Math.min(4, 1 + m.length * 0.43) } : m)),
    };
  // A spin bar's orbit, a magnet's field, a crusher's stroke or a jet's flame would leave the part itself
  // a speck in the middle of its card: the card draws them shorter, and the size still shows in the scale.
  const trim = (m: Module): Module => {
    switch (m.type) {
      case 'swinger':
        return { ...m, arm: Math.min(m.arm, m.head === 'mace' ? 1.6 : 1.3) };
      case 'magnet':
        return { ...m, radius: Math.min(m.radius, 1.7) };
      case 'piston':
        return { ...m, reach: Math.min(m.reach, 1) };
      case 'flame':
        return { ...m, length: Math.min(m.length, 2.2) };
      case 'rotor':
        return { ...m, arm: Math.min(m.arm * 0.75, 1.2), width: Math.min(m.width, 1.6) };
      default:
        return m;
    }
  };
  const modules = full.modules.map(trim);
  // A wheel's footprint is the disk it sweeps: the card fits what it draws.
  const hub = modules.find((m) => m.type === 'rotor');
  if (!hub || hub.type !== 'rotor') return { ...full, modules };
  return { ...full, modules, footprint: [[Math.floor(hub.hub[0]), Math.floor(hub.hub[1])]] };
}

/** What a part's card picture covers, in tiles of its own frame: its cells and whatever reaches out of them. */
function cardBounds(def: PropDef): { x0: number; y0: number; x1: number; y1: number } {
  const { w, h } = cellsBounds(def.footprint);
  // A trimmed footprint (a wheel's hub) needn't start at the origin.
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [x, y] of def.footprint) {
    b.x0 = Math.min(b.x0, x);
    b.y0 = Math.min(b.y0, y);
    b.x1 = Math.max(b.x1, x + 1);
    b.y1 = Math.max(b.y1, y + 1);
  }
  const grow = (x: number, y: number, rx: number, ry = rx) => {
    b.x0 = Math.min(b.x0, x - rx);
    b.y0 = Math.min(b.y0, y - ry);
    b.x1 = Math.max(b.x1, x + rx);
    b.y1 = Math.max(b.y1, y + ry);
  };
  for (const m of def.modules) {
    if (m.type === 'swinger') {
      grow(m.hub[0], m.hub[1], 0.45);
      // Spikes and blades stand a little proud of the head's radius.
      for (const a of cardAngles(m)) grow(m.hub[0] + Math.cos(a) * m.arm, m.hub[1] + Math.sin(a) * m.arm, m.radius * 1.4);
    }
    if (m.type === 'piston' || m.type === 'flame') {
      // A crusher reaches one way, its head drawn bolder on a card; a jet's flame does too.
      const [dx, dy] = dirOf(m.angle);
      const d = m.type === 'piston' ? 0.5 + m.reach + PISTON_CARD_HEAD / TILE : 0.5 + m.length;
      const across = m.type === 'piston' ? m.width / 2 : 0.4;
      grow(m.at[0] + dx * d, m.at[1] + dy * d, Math.abs(dy) * across, Math.abs(dx) * across);
    }
    if (m.type === 'magnet') grow(m.at[0], m.at[1], m.radius);
    if (m.type === 'rotor') grow(m.hub[0], m.hub[1], m.arm + m.width / 2 + 0.2);
    if (m.type === 'keg') grow(w / 2, h / 2, w / 2 + 0.8, h / 2 + 0.8);
  }
  // An attachment shows its host blocks, with what it adds standing off them.
  if (def.mount === 'face') {
    b.y0 -= 0.3;
    b.y1 += 0.3;
  }
  return b;
}

/**
 * Card preview: draw a def centered at (cx, cy), filling a `bw` x `bh` box. The crate is the first thing
 * players look at each round, so a part fills its card: a one-tile block is a block, not a speck. Its
 * size still shows, a step smaller for each size down.
 */
export function drawPreview(rc: RC, full: PropDef, cx: number, cy: number, bw: number, bh = bw) {
  const def = cardDef(full);
  const b = cardBounds(def);
  // A charge's art stays one tile whatever its blast, so its size shows in the scale.
  const blast = def.modules[0]?.type === 'bomb' ? BLAST_SCALE[def.size ?? 'large'] : 1;
  const fit = Math.min(bw / ((b.x1 - b.x0) * TILE), bh / ((b.y1 - b.y0) * TILE));
  // A one-tile charge steps by its blast alone, and stays clear of the tags above it.
  const k = def.modules[0]?.type === 'bomb' ? Math.min(2.1, fit * 0.86) * blast : Math.min(2.6, fit * 0.86) * (def.size ? CARD_SIZE[def.size] : 0.9);
  const s = rc.s;
  const g = rc.g;
  for (const ctx of [s, g]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.translate((-(b.x0 + b.x1) / 2) * TILE, (-(b.y0 + b.y1) / 2) * TILE);
  }
  const preview: PropDef = { ...def, motion: { type: 'none' } };
  if (def.mount === 'face') drawHostCells(rc, def.footprint);
  drawResolved(rc, resolveProp({ uid: 7, def: preview, owner: -1, tx: 0, ty: 0, rot: 0 }), { level: null, card: true });
  s.restore();
  g.restore();
}

function drawPath(rc: RC, r: Resolved) {
  const m = r.motion;
  // A track or a lift draws its own guide, always (track.ts).
  if (m.type === 'none' || m.type === 'track' || (m.type === 'rail' && m.dwell)) return;
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
