import type { Cell } from '../../../core/geom';
import { PLAYER_H, TILE } from '../../constants';
import { defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Flood = ModuleOf<'flood'>;

/** Segments of a flood's cycle. */
export const FLOOD_OFF = 0;
export const FLOOD_WARN = 1;
export const FLOOD_RISE = 2;
export const FLOOD_HOLD = 3;
export const FLOOD_FALL = 4;

export interface FloodState {
  /** FLOOD_OFF … FLOOD_FALL. */
  seg: number;
  /** Frames into the segment, and its length. */
  t: number;
  len: number;
  /** Surface height above the basin floor, in the module's units (px once resolved). The crest: what's under it kills. */
  height: number;
}

/** Eased so the surface leaves and arrives slowly, the way a tide does, and still passes every height once. */
const ease = (u: number) => u * u * (3 - 2 * u);

/**
 * Where the surface stands on frame `f`. A pure function of the frame, so a
 * snapshot carries nothing for it. The surface waits at `low` through off and
 * warn (the warning is drawn, never felt), rises to `high`, holds, and falls.
 */
export function floodState(m: Flood, f: number, phase: number): FloodState {
  const lens = [m.off, m.warn, m.rise, m.hold, m.fall];
  if (lens.every((n) => n <= 0)) return { seg: FLOOD_OFF, t: 0, len: 0, height: m.low };
  const c = cycle(f, phase, lens);
  const span = m.high - m.low;
  const height =
    c.seg === FLOOD_RISE ? m.low + span * ease(c.t / c.len) : c.seg === FLOOD_HOLD ? m.high : c.seg === FLOOD_FALL ? m.high - span * ease(c.t / c.len) : m.low;
  return { seg: c.seg, t: c.t, len: c.len, height };
}

/** Fraction of the cycle the surface stands above `depth` (same units as the module). */
function heldShare(m: Flood, depth: number): number {
  const total = m.off + m.warn + m.rise + m.hold + m.fall;
  if (total <= 0) return m.low > depth ? 1 : 0;
  const step = Math.max(1, Math.floor(total / 360));
  let held = 0;
  let n = 0;
  for (let f = 0; f < total; f += step, n++) if (floodState(m, f, 0).height > depth) held++;
  return held / n;
}

/**
 * Rising liquid (stage concepts, docs/SETPIECES.md): a surface over `w`
 * columns that rises from `low` to `high` and back on its cycle (off, warn,
 * rise, hold, fall).
 *
 * - Lava and toxic kill anything that touches the liquid: the hazard's top is
 *   the crest.
 * - Water is a pit, as the bottom of the level is: you can wade it, and it
 *   takes you once you're all the way under (a `sink` hazard, a fall).
 *
 * The crest goes out as the module's `Beam` (`len` = height above the basin
 * floor, px), so the art draws its line from the very number the sim kills
 * with. The plan keeps clear of the rows it holds for most of its cycle
 * (`holds`); worldgen keeps `high` below the proven route (gen/stage/flood.ts).
 */
export const flood = defineModule<'flood'>({
  type: 'flood',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), w: m.w * x.T, low: m.low * x.T, high: m.high * x.T }),
  anchors: (m) => {
    const out: Cell[] = [];
    for (let y = Math.floor(m.at[1] - m.high); y < Math.ceil(m.at[1]); y++)
      for (let x = Math.floor(m.at[0]); x < Math.ceil(m.at[0] + m.w); x++) out.push([x, y]);
    return out;
  },
  build(m, ctx, out) {
    const { height } = floodState(m, ctx.frame, ctx.r.phase);
    out.beams?.push({ uid: ctx.r.pp.uid, mi: ctx.mi, len: height, hit: false });
    if (height <= 0) return;
    const x = m.at[0] + ctx.off[0];
    const floor = m.at[1] + ctx.off[1];
    const crest = floor - height;
    const owner = ctx.r.pp.owner;
    if (m.look !== 'water') {
      out.hazards.push({ owner, kind: 'rect', r: { x, y: crest, w: m.w, h: height } });
      return;
    }
    // A runner's hitbox is inset 1.5 px (RunWorld): this top reaches it once the body is wholly under the crest.
    const top = crest + PLAYER_H - 1.5;
    if (top < floor) out.hazards.push({ owner, kind: 'rect', r: { x, y: top, w: m.w, h: floor - top }, sink: true });
  },
  holds(m) {
    const out: Cell[] = [];
    const floor = m.at[1];
    const x0 = Math.floor(m.at[0] / TILE + 1e-6);
    const x1 = Math.ceil((m.at[0] + m.w) / TILE - 1e-6);
    for (let y = Math.floor((floor - m.high) / TILE + 1e-6); y * TILE < floor; y++) {
      // The row is wet once the surface passes its bottom edge.
      if (heldShare(m, floor - (y + 1) * TILE) <= 0.5) continue;
      for (let x = x0; x < x1; x++) out.push([x, y]);
    }
    return out;
  },
});
