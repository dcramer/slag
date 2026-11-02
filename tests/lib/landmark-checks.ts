import { expect } from 'vitest';
import { planHolds, withBridges } from '../../src/gen/level';
import { noFreeRide } from '../../src/gen/level/winnable';
import { TILE } from '../../src/sim/constants';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../../src/sim/level';
import { type Module, type PlacedProp, resolveProp } from '../../src/sim/props';
import { analyzeReach } from '../../src/sim/reach';

/**
 * What every stage concept's landmark must satisfy, one level at a time, written against the level and
 * its landmark alone so any concept's suite (or a conformance suite over every registered concept) can
 * call them: it stands on the ground, it keeps at least two static ways past itself, its layout varies
 * with the seed, and the proof never rides its movers.
 */

const solid = (l: Level, x: number, y: number) => tileAt(l, x, y) === T_SOLID;
const standable = (l: Level, x: number, y: number) => tileAt(l, x, y) !== T_EMPTY;

/** The landmark's own pieces: its key is the concept's. */
export const landmarkPieces = (l: Level): PlacedProp[] => l.setPieces.filter((p) => l.landmark && p.def.key.endsWith(`:${l.landmark.concept}`));

/**
 * Nothing floats. Every column of the landmark's box with structure (solid tiles) in it has ground under
 * it on the landmark's ground row (the box's bottom edge): walls, legs and piers run down to the ground,
 * as doorways do. Boards (one-way) are hung on what's beside them and aren't structure. Everything the
 * landmark's pieces hang (droppers, chains, ropes, a pendulum's hub) hangs from a solid tile within a few
 * rows above, a live fence's posts stand on something, and a backdrop shell stands on the ground.
 */
export function expectGrounded(l: Level): void {
  const r = l.landmark!.rect;
  const G = r.y + r.h;
  for (let x = r.x; x < r.x + r.w; x++) {
    let structure = false;
    for (let y = r.y; y < G; y++) if (solid(l, x, y)) structure = true;
    if (structure) expect(solid(l, x, G), `${l.landmark!.concept} column ${x} stands on row ${G}`).toBe(true);
  }
  for (const pp of landmarkPieces(l)) expectHung(l, pp);
}

/** Everything a piece hangs from or stands on is real: see expectGrounded. */
export function expectHung(l: Level, pp: PlacedProp): void {
  const r = resolveProp(pp);
  const name = pp.def.name;
  const above = (x: number, y: number, rows: number) => Array.from({ length: rows }, (_, k) => solid(l, x, y - 1 - k)).some(Boolean);
  for (const m of r.mods) {
    const cell = (v: readonly [number, number]) => [Math.floor(v[0] / TILE), Math.floor(v[1] / TILE)] as const;
    if (m.type === 'dropper') for (const [x, y] of m.cells) expect(solid(l, x, y - 1), `${name} hangs at ${x},${y}`).toBe(true);
    if (m.type === 'swinger' || (m.type === 'rotor' && m.support === 'ceiling')) {
      const [x, y] = cell(m.hub);
      if (!jibbed(m, r.mods)) expect(above(x, y, 3), `${name} hangs from a ceiling at ${x},${y}`).toBe(true);
    }
    if (m.type === 'tesla')
      for (const p of [m.a, m.b]) {
        const [x, y] = cell(p);
        expect(standable(l, x, y + 1), `${name}'s post at ${x} stands`).toBe(true);
      }
    if (m.type === 'deco') {
      const x0 = Math.floor(m.at[0] / TILE);
      const x1 = Math.ceil((m.at[0] + m.w) / TILE) - 1;
      const by = Math.round((m.at[1] + m.h) / TILE);
      if (m.kind === 'cab') continue;
      const feet = [x0, x1].filter((x) => standable(l, x, by));
      expect(feet.length, `${name}'s ${m.kind} shell stands on row ${by}`).toBeGreaterThan(0);
    }
  }
}

/** A swinger the level hangs from a jib on a post rather than from a ceiling (set pieces with no ceiling over them). */
function jibbed(m: Module, mods: readonly Module[]): boolean {
  return m.type === 'swinger' && !mods.some((o) => o.type === 'deco');
}

/**
 * The ways past a landmark, from its anchors: `way<i>` is the top of a column of `way<i>h` cells that shuts
 * way i (a doorway, a stair head, a stretch of track).
 */
export function waysOf(anchors: Record<string, readonly [number, number]>): [number, number][][] {
  const out: [number, number][][] = [];
  for (let i = 0; anchors[`way${i}`]; i++) {
    const [x, y] = anchors[`way${i}`];
    const [h] = anchors[`way${i}h`];
    out.push(Array.from({ length: h }, (_, k) => [x, y + k] as [number, number]));
  }
  return out;
}

/**
 * At least two genuinely different ways past the landmark: shut every other way with solid tiles, and each
 * one alone still takes a runner with the level's parts in place from the spawn to the flag. `ways` are the
 * columns of cells that shut each way.
 */
export function expectWaysThrough(l: Level, ways: readonly (readonly [number, number])[][]): void {
  expect(ways.length, `${l.landmark?.concept}: ways past`).toBeGreaterThanOrEqual(2);
  const base = withBridges({ ...l, setPieces: [] }, l.solution ?? []);
  expect(analyzeReach(base).goalReached, 'the proof stands').toBe(true);
  ways.forEach((_, keep) => {
    const tiles = base.tiles.slice();
    ways.forEach((cells, i) => {
      if (i === keep) return;
      for (const [x, y] of cells) if (tiles[y * l.w + x] === T_EMPTY) tiles[y * l.w + x] = T_SOLID;
    });
    expect(analyzeReach({ ...base, tiles }).goalReached, `${l.landmark?.concept}: way ${keep} alone reaches the flag`).toBe(true);
  });
}

/**
 * The proof is static: the level is no carrier's, nothing finishes bare, the recorded solution reaches the
 * flag on tiles alone and still holds with every set piece standing, and no set piece, parked anywhere in
 * its cycle, lets a bare run past.
 */
export function expectStaticProof(l: Level): void {
  expect(l.rides).toBeUndefined();
  expect(analyzeReach(l).goalReached, 'bare').toBe(false);
  expect(analyzeReach(withBridges({ ...l, setPieces: [] }, l.solution!)).goalReached, 'with its parts').toBe(true);
  expect(planHolds(l, [], l.solution!), 'plan holds').toBe(true);
  for (const pp of l.setPieces)
    expect(
      noFreeRide(
        l,
        pp,
        l.setPieces.filter((p) => p !== pp),
      ),
      `${pp.def.name} gives no free ride`,
    ).toBe(true);
}

/**
 * The layout varies with the seed: of the structural numbers `sig` reads off each level's landmark, at
 * least `n` take more than one value across the levels.
 */
export function expectVaries(levels: readonly Level[], sig: (l: Level) => Record<string, number>, n = 2): void {
  const seen = new Map<string, Set<number>>();
  for (const l of levels) for (const [k, v] of Object.entries(sig(l))) (seen.get(k) ?? seen.set(k, new Set()).get(k)!).add(v);
  const varied = [...seen].filter(([, vs]) => vs.size > 1).map(([k]) => k);
  expect(varied.length, `${levels[0]?.landmark?.concept}: varies in ${varied.join(', ') || 'nothing'}`).toBeGreaterThanOrEqual(n);
}
