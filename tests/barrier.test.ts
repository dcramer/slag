import { describe, expect, it } from 'vitest';
import { raceMap } from '../src/brain/route';
import type { Rect } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { generateProp } from '../src/gen/props';
import { RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { type Archetype, BARRIER_SPAN, barrierOf, type Hazard, MIN_OPENING, type PlacedProp, touchesHazard } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function boxOf(h: Hazard): Rect {
  if (h.kind === 'rect') return h.r;
  if (h.kind === 'circle') return { x: h.x - h.r, y: h.y - h.r, w: h.r * 2, h: h.r * 2 };
  const x = Math.min(h.x1, h.x2) - h.r;
  const y = Math.min(h.y1, h.y2) - h.r;
  return { x, y, w: Math.abs(h.x2 - h.x1) + h.r * 2, h: Math.abs(h.y2 - h.y1) + h.r * 2 };
}

/**
 * Cells a hazard or solid touches on some frame of the race's own world, frame by frame, that never stay clear for
 * MIN_OPENING frames. Cell-exact, where the barrier marks boxes, so the barrier (or its ground) holds all of these.
 */
function heldCells(level: Level, pp: PlacedProp): number[] {
  const map = raceMap(new RunWorld(level, [pp], []));
  const hits = new Map<number, number[]>();
  const each = (i: number, box: Rect, touches: (cell: Rect) => boolean) => {
    for (let y = Math.max(0, Math.floor(box.y / TILE)); y <= Math.min(level.h - 1, Math.floor((box.y + box.h) / TILE)); y++)
      for (let x = Math.max(0, Math.floor(box.x / TILE)); x <= Math.min(level.w - 1, Math.floor((box.x + box.w) / TILE)); x++) {
        if (!touches({ x: x * TILE, y: y * TILE, w: TILE, h: TILE })) continue;
        const at = hits.get(y * level.w + x) ?? [];
        if (at.at(-1) !== i) at.push(i);
        hits.set(y * level.w + x, at);
      }
  };
  for (let i = 0; i < BARRIER_SPAN; i++) {
    const f = RUN_COUNTDOWN + i;
    for (const h of map.hazards(f)) each(i, boxOf(h), (c) => touchesHazard(c, h));
    for (const s of map.solids(f)) if (!s.oneWay && !s.film) each(i, s, (c) => overlaps(c, s));
  }
  const out: number[] = [];
  for (const [k, at] of hits) {
    let open = at[0];
    for (let j = 1; j < at.length; j++) open = Math.max(open, at[j] - at[j - 1] - 1);
    if (Math.max(open, BARRIER_SPAN - at.at(-1)! - 1) < MIN_OPENING) out.push(k);
  }
  return out;
}

describe('a part’s barrier', () => {
  it('holds every cell its movers and hazards sweep through, however fast they move', () => {
    // A fast rail saw on this level crosses a cell between two samples a few frames apart.
    const level: Level = { ...generateLevel(2, 'farm'), setPieces: [] };
    const missed: string[] = [];
    let uid = 1;
    for (const a of ['saw', 'wheel', 'crusher', 'flail'] satisfies Archetype[])
      for (const seed of [1, 2, 3]) {
        const def = generateProp(new Rng(seed * 7919 + 2), a, `${a}-${seed}`);
        const pp: PlacedProp = { uid: uid++, def, owner: 0, tx: Math.floor(level.w / 2), ty: Math.floor(level.h / 2), rot: 0 };
        const b = barrierOf(level, pp);
        const held = new Set([...b.noGo, ...b.ground]);
        const out = heldCells(level, pp).filter((k) => !held.has(k));
        if (out.length) missed.push(`${def.name} (${a} seed ${seed}): ${out.map((k) => `${k % level.w},${Math.floor(k / level.w)}`).join(' ')}`);
      }
    expect(missed).toEqual([]);
  });
});
