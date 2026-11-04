import { describe, expect, it } from 'vitest';
import type { Rect } from '../src/core/geom';
import { fieldOf, generateLevel, lastGenInfo, planHolds, withBridges } from '../src/gen/level';
import { noFreeRide } from '../src/gen/level/winnable';
import { cycleFrames } from '../src/gen/setpieces/place';
import { manorPlan, throneDais, throneHallPlan } from '../src/gen/stage/castle';
import { EDGE_DRIFT } from '../src/render/ink';
import { drawShardGlass } from '../src/render/props/modules/shards';
import { TILE } from '../src/sim/constants';
import { type Level, T_SOLID, tileAt } from '../src/sim/level';
import { type Contrib, footprintCells, type Module, moduleSim, motionOffset, type PlacedProp, type PropCtx, resolveProp } from '../src/sim/props';
import { SHARD_FIT, shardSet } from '../src/sim/props/modules/shards';
import { analyzeReach } from '../src/sim/reach';

/**
 * The castle's stage concepts (src/gen/stage/castle.ts, docs/SETPIECES.md): the Haunted Wing's stairs reach
 * every floor its cab serves with every set piece standing as the proof sees it, the cab never opens a bare
 * way at any stop, everything the landmarks hang or mount stands on real tiles, and the giant glass kills
 * exactly where it's drawn.
 */

const MANOR_SEEDS = [1, 2];
const HALL_SEEDS = [1, 2];

function manor(seed: number, size?: 'classic' | 'wide'): Level {
  const l = generateLevel(seed, 'castle', { concept: 'haunted-wing', ...(size ? { size } : {}) });
  expect(lastGenInfo.concept, `seed ${seed}`).toBe('haunted-wing');
  expect(lastGenInfo.fallback).toBe(false);
  return l;
}

const isCab = (p: PlacedProp) => p.def.motion.type === 'rail' && !!p.def.motion.stops;
const solid = (l: Level, x: number, y: number) => tileAt(l, x, y) === T_SOLID;

/** The px offsets a lift parks at over a cycle, in the order it reaches them. */
function parks(pp: PlacedProp): number[] {
  const r = resolveProp(pp);
  const P = cycleFrames(r.mods, r.motion);
  const out: number[] = [];
  let run = 0;
  for (let f = 1; f < 2 * P; f++) {
    const y = motionOffset(r, f)[1];
    run = y === motionOffset(r, f - 1)[1] ? run + 1 : 0;
    if (run === 30 && !out.includes(y + 0)) out.push(y + 0);
  }
  return out;
}

describe('the Haunted Wing', () => {
  it('climbs by static stairs to every floor its cab stops at, with every set piece standing', () => {
    for (const [i, seed] of MANOR_SEEDS.entries()) {
      const l = manor(seed, i ? 'wide' : 'classic');
      const p = manorPlan(l.landmark!.rect);
      // The proof's view: every set piece a barrier, the cab, the glass and the webs included.
      const field = withBridges(fieldOf(l, []), l.solution!);
      const reach = analyzeReach(field, false).reachable;
      const at = (x: number, y: number) => reach.has(y * l.w + x);
      expect(at(p.sw + 3, p.G - 1), 'hall').toBe(true);
      expect(at(p.sw + 3, p.F1 - 1), 'first floor').toBe(true);
      expect(at(p.sw + 4, p.F2 - 1), 'top floor').toBe(true);
      expect(at(p.R0, p.F2 - 1), 'the door off the top floor').toBe(true);
      expect(analyzeReach(field).goalReached).toBe(true);
      expect(planHolds(l, [], l.solution!)).toBe(true);
    }
  });

  it('parks its cab flush with each floor, and no stop opens a bare way to the flag', () => {
    for (const seed of MANOR_SEEDS) {
      const l = manor(seed);
      const p = manorPlan(l.landmark!.rect);
      const cab = l.setPieces.find(isCab)!;
      expect(cab).toBeDefined();
      const stops = parks(cab).sort((a, b) => b - a);
      expect(stops).toEqual([0, -(p.G - p.F1) * TILE, -(p.G - p.F2) * TILE]);
      expect(
        noFreeRide(
          l,
          cab,
          l.setPieces.filter((q) => q !== cab),
        ),
      ).toBe(true);
      // Each stop on its own, the cab written in as ground: still no bare way to the flag.
      const cells = footprintCells({ ...cab, def: { ...cab.def, footprint: cab.def.modules[0].type === 'body' ? cab.def.modules[0].cells : [] } });
      for (const dy of stops) {
        const tiles = l.tiles.slice();
        for (const [x, y] of cells) tiles[(y + dy / TILE) * l.w + x] = T_SOLID;
        expect(analyzeReach({ ...l, tiles }).goalReached, `cab parked ${dy}`).toBe(false);
      }
    }
  });

  it('stands on its ground, hangs from its ceilings and mounts its glass on its walls', () => {
    for (const seed of MANOR_SEEDS) {
      const l = manor(seed);
      const p = manorPlan(l.landmark!.rect);
      for (const x of [p.L0, p.L1, p.R1, p.R0]) expect(solid(l, x, p.G), `wall ${x} footing`).toBe(true);
      for (let x = p.L0; x <= p.R0; x++) if (x < p.sx || x >= p.sx + p.S) expect(solid(l, x, p.G), `hall floor ${x}`).toBe(true);
      // The cab's cable runs up to the ceiling over the shaft.
      for (let x = p.sx; x < p.sx + p.S; x++) expect(solid(l, x, p.RB), 'sheave beam').toBe(true);
      for (const pp of l.setPieces) {
        const r = resolveProp(pp);
        for (const m of r.mods) {
          if (m.type === 'dropper') for (const [x, y] of m.cells) expect(solid(l, x, y - 1), `${pp.def.name} hangs`).toBe(true);
          if (m.type === 'shards') {
            const x0 = Math.round(m.at[0] / TILE);
            const y0 = Math.round(m.at[1] / TILE);
            const back = m.dir > 0 ? x0 - 1 : x0 + m.w;
            for (let y = y0; y < y0 + m.h; y++) expect(solid(l, back, y), `${pp.def.name} mounted`).toBe(true);
            const recess = m.dir > 0 ? x0 : x0 + m.w - 1;
            if (m.inset) expect(solid(l, recess, y0 - 1) && solid(l, recess, y0 + m.h), 'lintel and sill').toBe(true);
          }
        }
      }
    }
  });
});

describe('the Throne Hall', () => {
  it('stands, swings its chandeliers as one from its ceiling, and drops one over the dais', () => {
    for (const seed of HALL_SEEDS) {
      const l = generateLevel(seed, 'castle', { concept: 'throne-hall' });
      expect(lastGenInfo.concept).toBe('throne-hall');
      expect(planHolds(l, [], l.solution!)).toBe(true);
      const p = throneHallPlan(l.landmark!.rect);
      for (let x = p.x0; x <= p.x1; x++) expect(solid(l, x, p.G), `footing ${x}`).toBe(true);
      const lights = l.setPieces.find((pp) => pp.def.modules.some((m) => m.type === 'rotor'))!;
      const rotors = resolveProp(lights).mods.filter((m) => m.type === 'rotor');
      expect(rotors.length).toBeGreaterThan(0);
      for (const m of rotors) expect(solid(l, Math.floor(m.hub[0] / TILE), Math.floor(m.hub[1] / TILE) - 1), 'hung from the ceiling').toBe(true);
      const drop = resolveProp(l.setPieces.find((pp) => pp.def.modules.some((m) => m.type === 'dropper'))!).mods.find((m) => m.type === 'dropper')!;
      if (drop.type !== 'dropper') throw new Error('no drop chandelier');
      const dais = throneDais((x, y) => solid(l, x, y), p);
      expect(dais.steps).toBeGreaterThan(0);
      for (const [x, y] of drop.cells) {
        expect(solid(l, x, y - 1)).toBe(true);
        expect(x >= dais.ts && x <= p.x1).toBe(true);
        // It lands on the throne's top step.
        expect(solid(l, x, p.G - dais.steps)).toBe(true);
      }
    }
  });
});

describe('castle filler', () => {
  it('hangs every chandelier, axe and falling chandelier from a real ceiling, and mounts its glass on a wall', () => {
    let hung = 0;
    for (const seed of [2, 5, 10]) {
      const l = generateLevel(seed, 'castle', { concept: 'plain' });
      for (const pp of l.setPieces) {
        for (const m of resolveProp(pp).mods) {
          const hub = m.type === 'swinger' || (m.type === 'rotor' && m.support === 'ceiling') ? m.hub : null;
          if (hub) {
            hung++;
            const x = Math.floor(hub[0] / TILE);
            const y = Math.floor(hub[1] / TILE);
            expect(
              [1, 2, 3].some((k) => solid(l, x, y - k)),
              `${pp.def.name} at ${x},${y}`,
            ).toBe(true);
          }
          if (m.type === 'dropper') for (const [x, y] of m.cells) expect(solid(l, x, y - 1), pp.def.name).toBe(true);
          if (m.type === 'shards') {
            const x0 = Math.round(m.at[0] / TILE);
            const y0 = Math.round(m.at[1] / TILE);
            for (let y = y0 - 1; y <= y0 + m.h; y++) expect(solid(l, m.dir > 0 ? x0 - 1 : x0 + m.w, y), `${pp.def.name} on its wall`).toBe(true);
          }
        }
      }
    }
    expect(hung).toBeGreaterThan(1);
  });
});

describe('giant glass', () => {
  const GLASSES = [
    { w: 3, h: 4, dir: -1 as const, inset: 1 },
    { w: 3, h: 3, dir: 1 as const, inset: 1 },
    { w: 2, h: 4, dir: 1 as const, inset: 0 },
    { w: 2, h: 3, dir: -1 as const, inset: 0 },
  ];
  const dist = (x: number, y: number, r: Rect) => Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.y - y, 0, y - r.y - r.h));
  const inTri = (x: number, y: number, t: readonly (readonly [number, number])[]) => {
    const s = (a: readonly [number, number], b: readonly [number, number]) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const d = [s(t[0], t[1]), s(t[1], t[2]), s(t[2], t[0])];
    return d.every((v) => v >= -1e-9) || d.every((v) => v <= 1e-9);
  };
  /** Distance from a point to a triangle (0 inside). */
  const toTri = (x: number, y: number, t: readonly (readonly [number, number])[]) => {
    if (inTri(x, y, t)) return 0;
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const [ax, ay] = t[i];
      const [bx, by] = t[(i + 1) % 3];
      const k = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
      best = Math.min(best, Math.hypot(x - ax - k * (bx - ax), y - ay - k * (by - ay)));
    }
    return best;
  };

  it('hurts with rects that cover every shard and stand past one by no more than SHARD_FIT', () => {
    for (const g of GLASSES)
      for (let seed = 0; seed < 6; seed++) {
        const set = shardSet({ ...g, seed });
        expect(set.polys.length).toBeGreaterThan(2);
        // Covered: every point of every shard is inside a rect.
        for (const t of set.polys) {
          const xs = t.map((p) => p[0]);
          const ys = t.map((p) => p[1]);
          for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.5)
            for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) {
              if (!inTri(x, y, t)) continue;
              expect(
                set.rects.some((r) => dist(x, y, r) < 1e-6),
                `seed ${seed} ${x},${y}`,
              ).toBe(true);
            }
        }
        // Tight: no corner of any rect stands further than SHARD_FIT from a shard.
        for (const r of set.rects)
          for (const [x, y] of [
            [r.x, r.y],
            [r.x + r.w, r.y],
            [r.x, r.y + r.h],
            [r.x + r.w, r.y + r.h],
          ])
            expect(Math.min(...set.polys.map((t) => toTri(x, y, t))), `seed ${seed} rect corner ${x},${y}`).toBeLessThanOrEqual(SHARD_FIT + 1e-6);
        // Inside its box, and pointing out of the wall.
        const W = g.w * TILE;
        for (const r of set.rects) expect(r.x >= -1e-6 && r.x + r.w <= W + 1e-6 && r.y >= -1e-6 && r.y + r.h <= g.h * TILE + 1e-6).toBe(true);
        const far = Math.max(...set.polys.map((t) => (g.dir > 0 ? t[1][0] : W - t[1][0])));
        expect(far).toBeGreaterThan(W - 3);
      }
  });

  it('kills where the sim says: the module builds exactly those rects where it stands', () => {
    const m: Module = { type: 'shards', at: [5, 3], w: 3, h: 4, dir: -1, inset: 1, seed: 9 };
    const pp: PlacedProp = {
      uid: 1,
      owner: -1,
      tx: 0,
      ty: 0,
      rot: 0,
      def: {
        key: 'k',
        name: 'Glass',
        maker: 't',
        archetype: 'spikestrip',
        role: 'hazard',
        style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
        motion: { type: 'none' },
        modules: [m],
        footprint: [[5, 3]],
      },
    };
    const r = resolveProp(pp);
    const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
    moduleSim('shards').build!(r.mods[0], { r, off: [0, 0], prev: [0, 0], frame: 0, mi: 0, live: true } as unknown as PropCtx, out);
    const want = shardSet({ w: 3, h: 4, dir: -1, inset: 1, seed: 9 }).rects.map((q) => ({ x: q.x + 5 * TILE, y: q.y + 3 * TILE, w: q.w, h: q.h }));
    expect(out.hazards.map((h) => (h.kind === 'rect' ? h.r : null))).toEqual(want);
  });

  it('draws only the shards the sim hurts with: every mark of its glass lies on the hazard, within the pen', () => {
    for (const g of GLASSES)
      for (let seed = 0; seed < 3; seed++) {
        const set = shardSet({ ...g, seed });
        const pts: [number, number][] = [];
        const ctx: unknown = new Proxy(
          {},
          {
            get: (_, key) => {
              if (key === 'moveTo' || key === 'lineTo') return (x: number, y: number) => pts.push([x, y]);
              if (key === 'quadraticCurveTo') return (_cx: number, _cy: number, x: number, y: number) => pts.push([x, y]);
              if (key === 'bezierCurveTo') return (_a: number, _b: number, _c: number, _d: number, x: number, y: number) => pts.push([x, y]);
              if (['arc', 'ellipse', 'rect', 'fillRect', 'translate', 'rotate', 'scale', 'transform', 'setTransform'].includes(String(key)))
                return () => {
                  throw new Error(`the glass draws with plain paths in its box's frame (got ${String(key)})`);
                };
              return () => {};
            },
            set: () => true,
          },
        );
        drawShardGlass(ctx as CanvasRenderingContext2D, { ...g, seed });
        expect(pts.length).toBeGreaterThan(30);
        for (const [x, y] of pts)
          expect(Math.min(...set.rects.map((r) => dist(x, y, r))), `${JSON.stringify(g)} seed ${seed} at ${x},${y}`).toBeLessThanOrEqual(EDGE_DRIFT);
      }
  });
});

describe('a lift with stops', () => {
  it('parks for its dwell at each end and at every stop on the way, exactly on the stop, both ways', () => {
    const pp: PlacedProp = {
      uid: 3,
      owner: -1,
      tx: 0,
      ty: 10,
      rot: 0,
      def: {
        key: 'lift',
        name: 'Lift',
        maker: 't',
        archetype: 'platform',
        role: 'build',
        style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
        motion: { type: 'rail', angle: -Math.PI / 2, range: 10, period: 300, dwell: 60, stops: [6] },
        modules: [{ type: 'body', cells: [[0, 0]], material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 }],
        footprint: [[0, 0]],
      },
    };
    const r = resolveProp(pp);
    const P = cycleFrames(r.mods, r.motion);
    expect(P).toBe(300 + 60 * 4);
    const runs: [number, number][] = [];
    for (let f = 0; f < P; f++) {
      const y = motionOffset(r, f)[1] + 0;
      const last = runs[runs.length - 1];
      if (last && last[0] === y) last[1]++;
      else runs.push([y, 1]);
    }
    // Merge the run that wraps round the cycle's end into its start.
    if (runs.length > 1 && runs[0][0] === runs[runs.length - 1][0]) runs[0][1] += runs.pop()![1];
    const parked = runs.filter(([, n]) => n >= 60);
    expect(parked.map(([y]) => y).sort((a, b) => a - b)).toEqual([-160, -96, -96, 0]);
    for (const [, n] of parked) expect(n === 60 || n === 61).toBe(true);
  });
});
