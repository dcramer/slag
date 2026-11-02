import type { Level } from '../../sim/level';
import { moduleSim, type ModuleOf, type PlacedProp } from '../../sim/props';
import type { ReachCache } from '../../sim/reach';
import { planHolds } from '../level/winnable';

type Flood = ModuleOf<'flood'>;

/** A flood standing alone as a set piece, for asking the proof about it. Module in absolute world tiles. */
function floodProp(m: Flood, uid: number): PlacedProp {
  return {
    uid,
    owner: -1,
    tx: 0,
    ty: 0,
    rot: 0,
    def: {
      key: 'flood',
      name: 'flood',
      maker: 'the level',
      archetype: 'flamer',
      role: 'hazard',
      style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
      motion: { type: 'none' },
      modules: [m],
      footprint: moduleSim('flood').anchors(m),
    },
  };
}

/**
 * `m` with `high` lowered, a tile at a time, until the level's recorded
 * solution still holds with the flood in (`planHolds`). The plan keeps clear
 * of the rows a flood holds for most of its cycle (`holds` in
 * sim/props/modules/flood.ts), so this keeps high water below the proven
 * route: the flood drowns the low way and never the proof. A concept runs its
 * flood through this before yielding it, rather than having the attempt
 * rejected for it. Null when even `low` cuts the route.
 *
 * `m` is in absolute world tiles, as a `Piece`'s modules are; `standing` is
 * what's already placed (the landmark's earlier pieces).
 */
export function capFlood(level: Level, m: Flood, standing: readonly PlacedProp[] = [], cache?: ReachCache): Flood | null {
  const plan = level.solution ?? [];
  const uid = Math.max(0, ...standing.map((p) => p.uid)) + 1;
  for (let high = m.high; ; high = Math.max(m.low, high - 1)) {
    const capped = { ...m, high };
    if (planHolds(level, [...standing, floodProp(capped, uid)], plan, cache)) return capped;
    if (high <= m.low) return null;
  }
}
