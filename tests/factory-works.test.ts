import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo, withBridges } from '../src/gen/level';
import { waysOf } from '../src/gen/stage/kit';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import {
  ARM_BACK,
  ARM_REST,
  ARM_STRIKE,
  ARM_WARN,
  ARM_WELD,
  armCycle,
  armJoints,
  buildSolids,
  type Contrib,
  LADLE_POUR,
  LADLE_SET,
  ladleCycle,
  type ModuleOf,
  motionOffset,
  newPropState,
  type PlacedProp,
  resolveProp,
  SPILL_H,
  traceRays,
} from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';

/**
 * The factory's Foundry, Boiler House and Robot Line (src/gen/stage/factory-works.ts) and its own two
 * hazards, the slag ladle and the robot arm, as factory behaviour: each way past a landmark is a real
 * alternative, and the hazards hurt where and when they say. What every landmark and set piece owes is
 * held by tests/conformance.
 */

const IDS = ['foundry', 'boiler-house', 'robot-line'];

function landmark(id: string, seed: number): Level {
  const l = generateLevel(seed, 'factory', { concept: id, size: 'classic' });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return l;
}

const own = (l: Level) => l.setPieces.filter((pp) => pp.def.key.endsWith(`:${l.landmark!.concept}`));
const ofType = <T extends ModuleOf<'ladle'>['type'] | ModuleOf<'arm'>['type'] | 'flame' | 'body'>(l: Level, t: T) =>
  own(l).flatMap((pp) => resolveProp(pp).mods.filter((m): m is ModuleOf<T> => m.type === t));

/** What a piece hurts with on frame f, in the level (its rays traced against the terrain). */
function hazards(level: Level, pp: PlacedProp, f: number): Contrib['hazards'] {
  const r = resolveProp(pp);
  const state = newPropState();
  const out: Contrib = { solids: [], hazards: [], springs: [], winds: [], beams: [] };
  const ctx = (rp: typeof r, mi: number) => ({ level, frame: f, r: rp, off: motionOffset(rp, f), prev: motionOffset(rp, f - 1), state, mi, live: true });
  buildSolids([r], ctx, out);
  traceRays([r], ctx, out);
  return out.hazards;
}

describe('factory landmarks: the Foundry, the Boiler House, the Robot Line', () => {
  it('every way past one is a real alternative: shut either and the flag is still reached', () => {
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

  it("the Foundry's ladles hang from its runway and spill on its casting floor", () => {
    const l = landmark('foundry', 3);
    const ladles = ofType(l, 'ladle');
    expect(ladles.length).toBeGreaterThanOrEqual(2);
    for (const m of ladles) {
      const x = Math.floor(m.at[0] / TILE);
      // The runway right over its chain, the floor right under its stream.
      expect(tileAt(l, x, Math.round((m.at[1] - m.hang) / TILE) - 1)).toBe(T_SOLID);
      expect(tileAt(l, x, Math.round((m.at[1] + m.drop) / TILE))).toBe(T_SOLID);
      for (let y = Math.ceil(m.at[1] / TILE); y < Math.round((m.at[1] + m.drop) / TILE); y++) expect(tileAt(l, x, y)).toBe(T_EMPTY);
    }
  });

  it("the Boiler House's fireboxes blow flame back along the floor at the door you came in by", () => {
    const l = landmark('boiler-house', 2);
    const flames = ofType(l, 'flame');
    expect(flames.length).toBeGreaterThanOrEqual(1);
    for (const f of flames) {
      expect(f.angle).toBeCloseTo(Math.PI);
      // Out of a boiler's face: solid just behind the nozzle, open air in front.
      expect(tileAt(l, Math.floor(f.at[0] / TILE) + 1, Math.floor(f.at[1] / TILE))).toBe(T_SOLID);
      expect(tileAt(l, Math.floor(f.at[0] / TILE), Math.floor(f.at[1] / TILE))).toBe(T_EMPTY);
    }
  });

  it("the Robot Line's arms stand on its deck, a car body between them where they weld", () => {
    const l = landmark('robot-line', 1);
    const arms = ofType(l, 'arm');
    expect(arms.length).toBeGreaterThanOrEqual(2);
    const deck = Math.round(arms[0].at[1] / TILE) + 2;
    for (const a of arms) expect(tileAt(l, Math.floor(a.at[0] / TILE), deck)).toBe(T_SOLID);
    const car = ofType(l, 'body').find((b) => b.cells.length === 5);
    expect(car).toBeDefined();
    const xs = arms.map((a) => a.at[0] / TILE).sort((a, b) => a - b);
    for (const [x] of car!.cells) {
      expect(x).toBeGreaterThan(xs[0]);
      expect(x).toBeLessThan(xs[xs.length - 1]);
    }
  });
});

describe('the slag ladle', () => {
  const l = landmark('foundry', 1);
  const pp = own(l).find((p) => p.def.modules.some((m) => m.type === 'ladle'))!;
  const m = resolveProp(pp).mods.find((x): x is ModuleOf<'ladle'> => x.type === 'ladle')!;
  const phase = resolveProp(pp).phase;
  const period = m.off + m.warn + m.pour + m.set;

  it('hurts only while it pours and its spill is molten; the spill runs out along the floor it lands on', () => {
    let widest = 0;
    let stream = 0;
    for (let f = 0; f < period; f++) {
      const seg = ladleCycle(m, f, phase).seg;
      const hz = hazards(l, pp, f);
      if (seg !== LADLE_POUR && seg !== LADLE_SET) {
        expect(hz, `frame ${f}`).toEqual([]);
        continue;
      }
      for (const h of hz) {
        if (h.kind !== 'rect') throw new Error('the ladle hurts with rects');
        if (h.r.h <= SPILL_H) {
          // The spill: lying on the floor under the lip.
          expect(h.r.y + h.r.h).toBeCloseTo(m.at[1] + m.drop);
          widest = Math.max(widest, h.r.w);
        } else if (seg === LADLE_POUR) stream++;
      }
      if (seg === LADLE_SET) expect(hz.every((h) => h.kind === 'rect' && h.r.h <= SPILL_H)).toBe(true);
    }
    expect(stream).toBe(m.pour);
    expect(widest).toBeGreaterThan((m.spill[0] + m.spill[1]) * 0.9);
  });

  it('a block held up under its lip catches the stream: no spill on the floor below it', () => {
    const x = Math.floor(m.at[0] / TILE);
    const y = Math.floor(m.at[1] / TILE) + 2;
    const tiles = new Uint8Array(l.tiles);
    tiles[y * l.w + x] = T_SOLID;
    const blocked = { ...l, tiles };
    for (let f = 0; f < period; f++) {
      if (ladleCycle(m, f, phase).seg !== LADLE_POUR) continue;
      for (const h of hazards(blocked, pp, f)) if (h.kind === 'rect') expect(h.r.y + h.r.h).toBeLessThanOrEqual(y * TILE + 0.01);
    }
  });
});

describe('the robot arm', () => {
  const l = landmark('robot-line', 2);
  const pp = own(l).find((p) => p.def.modules.some((m) => m.type === 'arm'))!;
  const r = resolveProp(pp);
  const m = r.mods.find((x): x is ModuleOf<'arm'> => x.type === 'arm')!;
  const period = m.rest + m.warn + m.strike + m.weld + m.back;

  it('is cold while it rests, warns and folds back; its head hurts only while it strikes and welds', () => {
    const seen = new Set<number>();
    for (let f = 0; f < period; f++) {
      const seg = armCycle(m, f, r.phase).seg;
      seen.add(seg);
      const hz = hazards(l, pp, f);
      if (seg === ARM_REST || seg === ARM_WARN || seg === ARM_BACK) expect(hz, `frame ${f}`).toEqual([]);
      else expect(hz.length, `frame ${f}`).toBe(1);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([ARM_REST, ARM_WARN, ARM_STRIKE, ARM_WELD, ARM_BACK]);
  });

  it('sweeps its head out along the deck in front of its pedestal, never into the deck', () => {
    const floor = m.at[1] + 2 * TILE;
    let lowFar = 0;
    for (let f = 0; f < period; f++) {
      const j = armJoints(m, f, r.phase);
      expect(j.hy, `frame ${f}`).toBeLessThan(floor);
      expect(j.ey).toBeLessThan(floor);
      if (j.hy > floor - 1.5 * TILE) lowFar = Math.max(lowFar, (j.hx - m.at[0]) * m.dir);
    }
    // Low enough to catch a runner, and well out in front of the pedestal.
    expect(lowFar).toBeGreaterThan(3.5 * TILE);
  });
});
