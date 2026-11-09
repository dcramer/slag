import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo, withBridges } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { MODES } from '../src/game/modes';
import { rollConcept } from '../src/gen/stage';
import { rectsOf } from '../src/gen/stage/kit';
import { TILE } from '../src/sim/constants';
import { GROUND_ICE, groundAt } from '../src/sim/ground';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import {
  AMMO,
  type Contrib,
  type Module,
  type ModuleOf,
  moduleSim,
  newPropState,
  type PlacedProp,
  type PropCtx,
  resolveProp,
  THAW_OPEN,
  thawCycle,
  traceShot,
} from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';

/**
 * The glacier's stage concepts (src/gen/stage/glacier.ts) and its own hazards, as glacier behaviour: each
 * way past a landmark is a real alternative, its ice is where it says, and its pieces do what they're for
 * where they stand. What every landmark owes (scale, footing, ways through, a layout that varies, the static
 * proof, no free ride, tells) is held by tests/conformance.
 */

const IDS = ['ice-palace', 'summit', 'frozen-wreck', 'frozen-falls', 'ski-jump'];

function landmark(id: string, seed: number): Level {
  const l = generateLevel(seed, 'glacier', { concept: id, size: 'classic' });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return l;
}

const own = (l: Level) => l.setPieces.filter((pp) => pp.def.key.endsWith(`:${l.landmark!.concept}`));
const mods = (l: Level) => own(l).flatMap((pp) => resolveProp(pp).mods);
const ofType = <T extends Module['type']>(l: Level, t: T) => mods(l).filter((m): m is ModuleOf<T> => m.type === t);

describe('glacier stage concepts', () => {
  it('each gets its share of glacier levels', () => {
    const seen = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      const id = rollConcept(s, 'glacier', rollProfile(s, 'glacier'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of IDS) expect(seen.get(id) ?? 0, id).toBeGreaterThan(15);
    expect(seen.get('plain') ?? 0).toBeGreaterThan(30);
  });

  it('every way past a landmark is a real alternative: shut either and the flag is still reached', () => {
    for (const id of IDS)
      for (const seed of [1, 2]) {
        const l = landmark(id, seed);
        const shut = rectsOf(lastGenInfo.landmark!, 'way');
        expect(shut.length, id).toBe(2);
        for (const r of shut) {
          const tiles = new Uint8Array(l.tiles);
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (tiles[y * l.w + x] === T_EMPTY) tiles[y * l.w + x] = T_SOLID;
          const reach = analyzeReach(withBridges({ ...l, tiles, setPieces: [] }, l.solution ?? []));
          expect(reach.goalReached, `${id} seed ${seed} with ${JSON.stringify(r)} shut`).toBe(true);
        }
      }
  });

  it('lays its ice where it says: the palace hall is a rink, the falls a face nobody wall-jumps', () => {
    for (const id of ['ice-palace', 'frozen-falls', 'ski-jump']) {
      const l = landmark(id, 3);
      let iced = 0;
      let solid = 0;
      for (const r of rectsOf(lastGenInfo.landmark!, 'ice'))
        for (let y = r.y; y < r.y + r.h; y++)
          for (let x = r.x; x < r.x + r.w; x++)
            if (tileAt(l, x, y) === T_SOLID) {
              solid++;
              if (groundAt(l, x, y) === GROUND_ICE) iced++;
            }
      expect(solid, id).toBeGreaterThan(4);
      expect(iced, id).toBe(solid);
    }
  });

  it("the Summit's cornice rolls its snowballs down the near side, at the climbers", () => {
    for (const seed of [1, 2]) {
      const l = landmark('summit', seed);
      const [gun] = ofType(l, 'cannon');
      expect(gun.ammo).toBe('snowball');
      const path = traceShot(l, { x: gun.at[0] - 12, y: gun.at[1], vx: -gun.speed, vy: 0, owner: -1, ammo: 'snowball' });
      const last = path[path.length - 1];
      // Down and away toward the spawn, well below where it left the peak.
      expect(last.x).toBeLessThan(gun.at[0] - 4 * TILE);
      expect(last.y).toBeGreaterThan(gun.at[1] + 3 * TILE);
    }
  });

  it("the Frozen Falls' pool is thin ice flush with the cave floor, over water", () => {
    const l = landmark('frozen-falls', 2);
    const [pool] = ofType(l, 'thaw');
    for (const [x, y] of pool.cells) {
      expect(tileAt(l, x, y)).toBe(T_EMPTY);
      expect(tileAt(l, x, y + pool.depth)).toBe(T_SOLID);
      expect(tileAt(l, pool.cells[0][0] - 1, y), 'a bank either side').toBe(T_SOLID);
    }
  });
});

/** One module alone in a prop at the origin, built frame by frame. */
function alone(m: Module) {
  const pp: PlacedProp = {
    uid: 7,
    owner: -1,
    tx: 0,
    ty: 0,
    rot: 0,
    def: {
      key: 'k',
      name: 'k',
      maker: 't',
      archetype: 'crumble',
      role: 'hazard',
      style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
      motion: { type: 'none' },
      modules: [m],
      footprint: [[0, 0]],
    },
  };
  const r = resolveProp(pp);
  const state = newPropState();
  const ctx = (f: number, runners: { x: number; y: number; w: number; h: number; active: boolean }[] = []) =>
    ({ r, off: [0, 0], prev: [0, 0], frame: f, mi: 0, live: true, state, runners }) as unknown as PropCtx;
  return {
    r,
    build: (f: number) => {
      const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
      moduleSim(r.mods[0].type).build!(r.mods[0], ctx(f), out);
      return out;
    },
    tick: (f: number, runners: { x: number; y: number; w: number; h: number; active: boolean }[]) =>
      moduleSim('thaw').tick!(r.mods[0], ctx(f, runners) as never),
  };
}

describe('thin ice (thaw)', () => {
  const ice: Module = {
    type: 'thaw',
    cells: [
      [4, 10],
      [5, 10],
      [6, 10],
    ],
    depth: 3,
    frozen: 100,
    warn: 30,
    open: 60,
    seed: 1,
  };

  it('is slick ice flush with the floor while frozen and cracking, then open water that drowns', () => {
    const { r, build } = alone(ice);
    const m = r.mods[0] as ModuleOf<'thaw'>;
    let open = 0;
    for (let f = 0; f < 190; f++) {
      const out = build(f);
      if (thawCycle(m, f, r.phase).seg === THAW_OPEN) {
        open++;
        expect(out.solids).toEqual([]);
        expect(out.hazards).toHaveLength(1);
        const h = out.hazards[0];
        if (h.kind !== 'rect') throw new Error('the water is a box');
        expect(h.sink).toBe(true);
        expect(h.r.x).toBe(4 * TILE);
        expect(h.r.w).toBe(3 * TILE);
        expect(h.r.y).toBeGreaterThan(10 * TILE);
        expect(h.r.y + h.r.h).toBe(13 * TILE);
      } else {
        expect(out.hazards).toEqual([]);
        expect(out.solids).toHaveLength(3);
        for (const s of out.solids) {
          expect(s.y).toBe(10 * TILE);
          expect(s.surface.friction).toBeLessThan(0.5);
        }
      }
    }
    expect(open).toBe(60);
  });

  it("holds water only where rock walls it in: over a brawl stage's seam it's a hole, with nothing below its lips that drowns", () => {
    let seams = 0;
    for (const seed of [9]) {
      const l = generateLevel(seed, 'glacier', MODES.brawl.profile);
      for (const pp of l.setPieces) {
        const r = resolveProp(pp);
        r.mods.forEach((m, mi) => {
          if (m.type !== 'thaw') return;
          const x0 = Math.min(...m.cells.map(([x]) => x));
          const x1 = Math.max(...m.cells.map(([x]) => x));
          const y = m.cells[0][1];
          const walled = (row: number) => tileAt(l, x0 - 1, row) === T_SOLID && tileAt(l, x1 + 1, row) === T_SOLID;
          let f = 0;
          while (thawCycle(m, f, r.phase).seg !== THAW_OPEN) f++;
          const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
          moduleSim('thaw').build!(m as never, { r, off: [0, 0], prev: [0, 0], frame: f, mi, state: newPropState(), live: true } as unknown as PropCtx, out);
          for (const h of out.hazards) {
            if (h.kind !== 'rect') continue;
            for (let row = y + 1; row * TILE < h.r.y + h.r.h; row++) expect(walled(row), `seed ${seed}: water at row ${row} beside air`).toBe(true);
          }
          if (Array.from({ length: l.h - y - 1 }, (_, k) => y + 1 + k).some((row) => !walled(row)) && m.depth === 0) {
            seams++;
            expect(out.hazards).toEqual([]);
          }
        });
      }
    }
    expect(seams).toBeGreaterThan(0);
  });

  it('never skins over a runner: ice due back waits until they are clear of it', () => {
    const { r, build, tick } = alone(ice);
    const m = r.mods[0] as ModuleOf<'thaw'>;
    let f = 0;
    while (thawCycle(m, f, r.phase).seg !== THAW_OPEN) f++;
    while (thawCycle(m, f + 1, r.phase).seg === THAW_OPEN) f++;
    // A runner in the middle cell as the ice comes back.
    const runner = { x: 5 * TILE + 2, y: 10 * TILE - 4, w: 12, h: 20, active: true };
    tick(f, [runner]);
    expect(build(f + 1).solids.map((s) => s.x / TILE)).toEqual([4, 6]);
    tick(f + 1, []);
    expect(build(f + 2).solids).toHaveLength(3);
  });
});

describe('the avalanche (snowball)', () => {
  /** A floor at row 12 from column 0 to 20, a step down to row 15 beyond it, and a wall at column 34. */
  function slope(): Level {
    const base = generateLevel(1, 'glacier', { concept: 'plain', size: 'classic' });
    const tiles = new Uint8Array(base.w * base.h);
    const set = (x: number, y: number) => (tiles[y * base.w + x] = T_SOLID);
    for (let x = 0; x <= 20; x++) for (let y = 12; y < base.h; y++) set(x, y);
    for (let x = 21; x < base.w; x++) for (let y = 15; y < base.h; y++) set(x, y);
    for (let y = 0; y < 15; y++) set(34, y);
    return { ...base, tiles, ground: undefined, setPieces: [] };
  }

  it('rolls along the floor, drops off the step, rolls on gathering speed, and bursts on the wall', () => {
    const l = slope();
    const r = AMMO.snowball.radius;
    const path = traceShot(l, { x: 4 * TILE, y: 11.5 * TILE, vx: 80, vy: 0, owner: -1, ammo: 'snowball' });
    const on = (y: number, row: number) => Math.abs(y + r - row * TILE) < 0.01;
    // Rolling on the upper floor, then on the lower one.
    expect(path.some((q) => q.x < 20 * TILE && on(q.y, 12))).toBe(true);
    expect(path.some((q) => q.x > 23 * TILE && on(q.y, 15))).toBe(true);
    // It ends at the wall, not before.
    const end = path[path.length - 1];
    expect(end.x).toBeGreaterThan(32 * TILE);
    expect(end.x).toBeLessThan(34 * TILE + r);
    // Faster at the bottom than at the top.
    const i = path.findIndex((q) => q.x > 6 * TILE);
    const j = path.findIndex((q) => q.x > 28 * TILE);
    expect(path[j].x - path[j - 1].x).toBeGreaterThan(path[i].x - path[i - 1].x);
  });

  it('rolls the same every time', () => {
    const l = slope();
    const shot = { x: 4 * TILE, y: 11.5 * TILE, vx: 95, vy: 0, owner: -1, ammo: 'snowball' as const };
    expect(traceShot(l, shot)).toEqual(traceShot(l, shot));
  });
});
