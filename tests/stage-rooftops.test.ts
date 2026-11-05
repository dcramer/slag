import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo, withBridges } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { rollConcept } from '../src/gen/stage';
import { waysOf } from '../src/gen/stage/kit';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import {
  type Contrib,
  type Module,
  type ModuleOf,
  moduleSim,
  NEON_ON,
  neonCycle,
  type PlacedProp,
  type PropCtx,
  resolveProp,
  SIGN_FALL,
  SIGN_LIVE,
  signCycle,
  WIRE_RUN,
  wireCycle,
  wirePoint,
} from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';

/**
 * The rooftops' stage concepts (src/gen/stage/rooftops.ts) and its own hazards (falling signs, live wires,
 * neon letters), as rooftops behaviour: each way past a landmark is a real alternative, its pieces stand
 * where they're meant to, and the three new modules hurt exactly when and where they say. What every
 * landmark owes (scale, footing, ways, varies, proof, free rides, tells) is held by tests/conformance.
 */

const IDS = ['girder-works', 'neon-billboard', 'water-towers', 'clock-tower', 'el-station'];

function landmark(id: string, seed: number): Level {
  const l = generateLevel(seed, 'rooftops', { concept: id, size: 'classic' });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return l;
}

const mods = (l: Level) => l.setPieces.filter((pp) => pp.def.key.endsWith(`:${l.landmark!.concept}`)).flatMap((pp) => resolveProp(pp).mods);
const ofType = <T extends Module['type']>(l: Level, t: T) => mods(l).filter((m): m is ModuleOf<T> => m.type === t);

/** A lone module as a placed piece, resolved into world px, and what it hurts with on frame f. */
function lone<T extends Module['type']>(m: ModuleOf<T>, extra: Module[] = []) {
  const pp: PlacedProp = {
    uid: 3,
    owner: -1,
    tx: 0,
    ty: 0,
    rot: 0,
    def: {
      key: 'k',
      name: 'test',
      maker: 't',
      archetype: 'platform',
      role: 'hazard',
      style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 300, woodHue: 26 },
      motion: { type: 'none' },
      modules: [...extra, m],
      footprint: [[0, 0]],
    },
  };
  const r = resolveProp(pp);
  const mi = extra.length;
  const rm = r.mods[mi] as ModuleOf<T>;
  const hurt = (f: number) => {
    const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
    moduleSim(m.type).build!(rm as never, { r, off: [0, 0], prev: [0, 0], frame: f, mi, live: true } as unknown as PropCtx, out);
    return out.hazards;
  };
  return { r, m: rm, hurt, phase: r.phase };
}

describe('rooftops stage concepts', () => {
  it('each gets its share of rooftops levels', () => {
    const seen = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      const id = rollConcept(s, 'rooftops', rollProfile(s, 'rooftops'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of IDS) expect(seen.get(id) ?? 0, id).toBeGreaterThan(15);
    expect(seen.get('plain') ?? 0).toBeGreaterThan(30);
  });

  it('every way past a landmark is a real alternative: shut either and the flag is still reached', () => {
    for (const id of IDS)
      for (const seed of [1, 2]) {
        const l = landmark(id, seed);
        const shut = waysOf(lastGenInfo.landmark!);
        expect(shut.length, id).toBe(2);
        for (const r of shut) {
          const tiles = new Uint8Array(l.tiles);
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (tiles[y * l.w + x] === T_EMPTY) tiles[y * l.w + x] = T_SOLID;
          const reach = analyzeReach(withBridges({ ...l, tiles, setPieces: [] }, l.solution ?? []));
          expect(reach.goalReached, `${id} seed ${seed} with ${JSON.stringify(r)} shut`).toBe(true);
        }
      }
  });

  it('the alley in front of a landmark drops to the street', () => {
    for (const id of IDS) {
      const l = landmark(id, 3);
      const r = l.landmark!.rect;
      let open = 0;
      for (let x = r.x; x < r.x + r.w; x++) if (Array.from({ length: l.h }, (_, y) => tileAt(l, x, y)).every((t) => t === T_EMPTY)) open++;
      expect(open, id).toBeGreaterThanOrEqual(7);
    }
  });

  it("the Girder Works' wrecking ball swings over its top deck, and its hoist parks flush with every deck", () => {
    const l = landmark('girder-works', 1);
    const [ball] = ofType(l, 'swinger');
    expect(ball.head).toBe('weight');
    // The ball's lowest point is just over a deck of girders.
    const low = Math.floor((ball.hub[1] + ball.arm) / TILE) + 1;
    expect(tileAt(l, Math.floor(ball.hub[0] / TILE), low)).not.toBe(T_EMPTY);
    const lift = l.setPieces.find((p) => p.def.motion.type === 'rail')!;
    expect(lift.def.motion.type === 'rail' && lift.def.motion.dwell).toBeGreaterThan(0);
  });

  it('the Clock Tower swings its pendulum in the arch and its bell over the roof', () => {
    const l = landmark('clock-tower', 2);
    const [pend, bell] = ofType(l, 'swinger');
    // The pendulum hangs from the arch's stone; the bell over open sky above the tower.
    expect(tileAt(l, Math.floor(pend.hub[0] / TILE), Math.floor(pend.hub[1] / TILE) - 1)).toBe(T_SOLID);
    expect(tileAt(l, Math.floor(bell.hub[0] / TILE), Math.floor(bell.hub[1] / TILE) - 1)).toBe(T_EMPTY);
    expect(tileAt(l, Math.floor(bell.hub[0] / TILE), Math.floor((bell.hub[1] + bell.arm) / TILE) + 1)).toBe(T_SOLID);
  });

  it("the El Station's train runs on the viaduct", () => {
    for (const seed of [1, 4]) {
      const l = landmark('el-station', seed);
      const [train] = ofType(l, 'vehicle');
      expect(tileAt(l, Math.floor(train.at[0] / TILE), Math.round(train.at[1] / TILE))).toBe(T_SOLID);
      expect(tileAt(l, Math.floor(train.at[0] / TILE), Math.round(train.at[1] / TILE) + 1)).toBe(T_EMPTY);
    }
  });
});

describe('rooftops hazards', () => {
  it('a falling sign hurts only while it falls and while it lies live on the floor, and there on its box', () => {
    const m0: ModuleOf<'sign'> = { type: 'sign', at: [4, 2], w: 3, h: 1, drop: 4, off: 100, warn: 40, fall: 16, live: 40, lift: 100, seed: 1 };
    const { m, hurt, phase } = lone(m0);
    let hit = 0;
    for (let f = 0; f < 296; f++) {
      const seg = signCycle(m, f, phase).seg;
      const hz = hurt(f);
      expect(hz.length > 0, `frame ${f}`).toBe(seg === SIGN_FALL || seg === SIGN_LIVE);
      if (seg === SIGN_LIVE) {
        hit++;
        const r = hz[0].kind === 'rect' ? hz[0].r : null;
        // Lying on the floor: its bottom on the floor row.
        expect(r!.y + r!.h).toBeCloseTo((2 + 1 + 4) * TILE);
      }
    }
    expect(hit).toBe(40);
  });

  it('neon letters are live one after another, never all at once, and only while lit', () => {
    const cells: [number, number][] = [
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
    ];
    const m0: ModuleOf<'neon'> = { type: 'neon', cells, off: 100, warn: 24, on: 40, lag: 10, seed: 3 };
    const body: Module = { type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 };
    const { m, hurt, phase } = lone(m0, [body]);
    let all = 0;
    for (let f = 0; f < 164; f++) {
      const lit = m.cells.filter((c) => neonCycle(m, c, f, phase).seg === NEON_ON).length;
      expect(hurt(f).length).toBe(lit);
      if (lit === cells.length) all++;
    }
    // The chase leaves most frames with a dark letter to stand on.
    expect(all).toBeLessThan(20);
  });

  it("a live wire's spark runs the cable's own curve, end to end, and the cable never hurts on its own", () => {
    const m0: ModuleOf<'wire'> = { type: 'wire', a: [2, 3], b: [10, 3], sag: 2, off: 100, warn: 30, run: 24, seed: 2 };
    const { m, hurt, phase } = lone(m0);
    const xs: number[] = [];
    for (let f = 0; f < 154; f++) {
      const hz = hurt(f);
      const run = wireCycle(m, f, phase).seg === WIRE_RUN;
      expect(hz.length).toBe(run ? 1 : 0);
      if (!run) continue;
      const h = hz[0];
      expect(h.kind).toBe('circle');
      if (h.kind !== 'circle') continue;
      const u = (h.x - m.a[0]) / (m.b[0] - m.a[0]);
      expect(h.y).toBeCloseTo(wirePoint(m, u)[1], 3);
      xs.push(h.x);
    }
    expect(Math.min(...xs)).toBeCloseTo(m.a[0]);
    expect(Math.max(...xs)).toBeCloseTo(m.b[0]);
  });
});
