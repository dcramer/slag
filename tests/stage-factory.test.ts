import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo, planHolds, withBridges } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { noFreeRide } from '../src/gen/level/winnable';
import { rollConcept } from '../src/gen/stage';
import { wheelFeet } from '../src/gen/stage/factory';
import { NO_INPUT } from '../src/sim/types';
import { TILE } from '../src/sim/constants';
import { type Level, T_SOLID, tileAt } from '../src/sim/level';
import { type ModuleOf, resolveProp, rotorArms, rotorPlatform } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';
import { RunWorld } from '../src/sim/run';

/**
 * The factory's stage concepts (src/gen/stage/factory.ts): the Great Wheel and the Stamping Line. Each
 * stands up on its own share of factory levels, on grounded supports, with a static proof that never
 * rides its movers, and no free ride over the crossing it owns.
 */

const SEEDS = [3, 6];

function landmarkLevels(id: string): Level[] {
  return SEEDS.map((seed) => {
    const l = generateLevel(seed, 'factory', { concept: id });
    expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
    expect(lastGenInfo.fallback).toBe(false);
    return l;
  });
}

const wheels = landmarkLevels('great-wheel');
const lines = landmarkLevels('stamping-line');

function landmarkPiece(l: Level) {
  const pp = l.setPieces.find((p) => p.def.key === `setpiece:factory:${l.landmark!.concept}`);
  expect(pp).toBeDefined();
  return pp!;
}

/** Static: the proof stands without any set piece, and nothing finishes bare. */
function expectStaticProof(l: Level) {
  expect(l.rides).toBeUndefined();
  expect(analyzeReach(l).goalReached).toBe(false);
  expect(analyzeReach(withBridges({ ...l, setPieces: [] }, l.solution!)).goalReached).toBe(true);
  expect(planHolds(l, [], l.solution!)).toBe(true);
  const pp = landmarkPiece(l);
  expect(
    noFreeRide(
      l,
      pp,
      l.setPieces.filter((p) => p !== pp),
    ),
  ).toBe(true);
}

describe('factory stage concepts', () => {
  it('each gets its share of factory levels', () => {
    const seen = new Map<string, number>();
    for (let s = 0; s < 120; s++) {
      const id = rollConcept(s, 'factory', rollProfile(s, 'factory'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    expect(seen.get('great-wheel')).toBeGreaterThan(8);
    expect(seen.get('stamping-line')).toBeGreaterThan(5);
    expect(seen.get('plain')).toBeGreaterThan(60);
  });

  it('the Great Wheel is a flywheel at least 17 tiles across, cars on its rim and saws on its spokes', () => {
    for (const l of wheels) {
      const pp = landmarkPiece(l);
      const rotor = pp.def.modules.find((m) => m.type === 'rotor') as ModuleOf<'rotor'>;
      const saws = pp.def.modules.find((m) => m.type === 'swinger') as ModuleOf<'swinger'>;
      expect(2 * (rotor.arm + rotor.width / 2)).toBeGreaterThanOrEqual(17);
      expect(rotor.count).toBeGreaterThanOrEqual(6);
      expect(saws.head).toBe('saw');
      expect(saws.count).toBeGreaterThanOrEqual(2);
      // One axle, one beat: the saws keep to the gaps between the cars.
      expect(saws.hub).toEqual(rotor.hub);
      expect([saws.period, saws.dir]).toEqual([rotor.period, rotor.dir]);
      expect(rotor.count % saws.count).toBe(0);
      expect(l.theme.name).toMatch(/Wheel|Flywheel/);
    }
  });

  it("the wheel's A-frame and the line's gantry stand on solid ground", () => {
    /** The first solid row at or under (x, y): a leg drawn from y lands there. */
    const solidUnder = (l: Level, x: number, y: number) => {
      while (y < l.h && tileAt(l, x, y) !== T_SOLID) y++;
      return y;
    };
    for (const l of wheels) {
      const rotor = landmarkPiece(l).def.modules.find((m) => m.type === 'rotor') as ModuleOf<'rotor'>;
      const pp = landmarkPiece(l);
      const [hx, hy] = [rotor.hub[0] + pp.tx, rotor.hub[1] + pp.ty];
      for (const fx of wheelFeet(hx, rotor.arm)) expect(solidUnder(l, Math.floor(fx), Math.ceil(hy)), `foot at ${fx}`).toBeLessThan(l.h);
    }
    for (const l of lines) {
      const pp = landmarkPiece(l);
      const deco = pp.def.modules.find((m) => m.type === 'deco') as ModuleOf<'deco'>;
      for (const x of [deco.at[0], deco.at[0] + deco.w - 1]) expect(solidUnder(l, x + pp.tx, deco.at[1] + pp.ty), `post at ${x}`).toBeLessThan(l.h);
    }
  });

  it('the proof never rides a mover, and no mover gives a free ride', () => {
    for (const l of [...wheels, ...lines]) expectStaticProof(l);
  });

  it('a runner standing on a car rides the rim up, between the saws', () => {
    const l = wheels[0];
    const run = new RunWorld(l, [], [0]);
    for (let f = 0; f < 70; f++) run.step([NO_INPUT]);
    const r = resolveProp(landmarkPiece(l));
    const mi = r.mods.findIndex((m) => m.type === 'rotor');
    const rotor = r.mods[mi] as ModuleOf<'rotor'>;
    // The car nearest the bottom, on its way up.
    const arms = rotorArms(rotor, run.frame, r.phase);
    const low = arms.reduce((a, b) => (b.y > a.y ? b : a));
    const car = rotorPlatform(rotor, low);
    const b = run.runners[0].body;
    b.x = car.x + car.w / 2 - b.w / 2;
    b.y = car.y - b.h;
    b.vx = b.vy = 0;
    const y0 = b.y;
    for (let f = 0; f < rotor.period / 4; f++) run.step([NO_INPUT]);
    expect(run.runners[0].alive).toBe(true);
    expect(y0 - b.y).toBeGreaterThan((rotor.arm / TILE) * 0.6 * TILE);
  });

  it('the Stamping Line slams its presses in sequence over a conveyor, under a girder you can walk', () => {
    for (const l of lines) {
      const pp = landmarkPiece(l);
      const presses = pp.def.modules.filter((m) => m.type === 'piston') as ModuleOf<'piston'>[];
      expect(presses.length).toBeGreaterThanOrEqual(3);
      expect(new Set(presses.map((p) => p.lag)).size).toBe(presses.length);
      expect(new Set(presses.map((p) => p.period)).size).toBe(1);
      expect(pp.def.modules.some((m) => m.type === 'body' && m.material === 'conveyor')).toBe(true);
      expect(l.theme.name).toMatch(/Line|Press|Works/);
    }
  });
});
