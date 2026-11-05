import { afterEach, describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo, MAX_LANDMARK_REJECTS, planHolds, withBridges } from '../src/gen/level';
import { finish, Grid, groundFromHeights, T_EMPTY } from '../src/gen/level/kit';
import { carrierReach } from '../src/gen/level/ride';
import { SCULPTORS } from '../src/gen/level/sculptors';
import { claimSite, hardGap, knobs, pit, raiseLandmark, rollChallenges, Slots } from '../src/gen/level/sculptors/common';
import type { Sculptor } from '../src/gen/level/types';
import type { Piece } from '../src/gen/setpieces';
import { type Concept, CONCEPTS, rollConcept } from '../src/gen/stage';
import { type PropStyle } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';

/**
 * The stage-concept hook (src/gen/stage, docs/SETPIECES.md) end to end, with a throwaway
 * concept registered only here and a flat test sculptor standing in for a theme's: the
 * concept is rolled, claims a site, builds tiles, places its piece, retries on a failure,
 * and falls back to plain. A carrier concept's ferry goes through the ride proof.
 */

const STYLE: PropStyle = { metal: 'steel', trim: 'none', hue: 0, glowHue: 0, woodHue: 30 };
const SEEDS = [11, 12];

/** Flat ground, the level's hard pits, and the concept's site: the calls a theme sculptor makes. */
const flat: Sculptor = (ctx) => {
  const k = knobs(ctx);
  const { W, H } = k;
  const g = new Grid(W, H);
  const f = H - 6;
  const surf = new Array<number>(W).fill(f);
  const slots = new Slots(6, W - 7);
  const claim = claimSite(ctx, k, slots, surf);
  const challenges = rollChallenges(ctx.attempt, k);
  g.wantsProps = challenges > 0;
  const pits: [number, number][] = [];
  for (let i = 0; i < challenges; i++) {
    const w = hardGap(ctx.rng);
    const a = slots.take(ctx.rng, w + 4, 2, 8, W - 9);
    if (a !== null) pits.push([a + 2, a + 1 + w]);
  }
  groundFromHeights(g, surf);
  for (const [x0, x1] of pits) pit(g, x0, x1, f, true);
  if (claim) raiseLandmark(g, ctx, claim);
  return finish(g, { row: f - 1 }, { row: f - 1 }, 'test:flat');
};

/** A one-row plinth with a small lift bobbing over it. `fail(n)` makes the n-th attempt's piece impossible. */
function plinth(fail: (n: number) => boolean = () => false): Concept {
  let n = 0;
  return {
    id: 'test-plinth',
    weight: 1,
    sizes: ['classic', 'wide', 'tall'],
    ownsCrossing: false,
    family: [],
    names: ['The Test Plinth of {place}'],
    // A fixture of the hook, not content: a box just big enough to measure large (gen/stage/contract.ts), and one flat plinth has one way past it.
    ways: 1,
    box: () => ({ w: 8, h: 19 }),
    build(g, _rng, at) {
      const ground = at.y + at.h;
      g.fill(at.x, ground - 1, at.x + at.w - 1, ground - 1);
      return { concept: 'test-plinth', rect: at, air: [{ x: at.x, y: at.y, w: at.w, h: at.h - 1 }], anchors: { top: [at.x + 3, ground - 4] }, skin: 'brick' };
    },
    *pieces(_rng, _s, l): Generator<Piece> {
      const [x, y] = l.anchors.top;
      // A failing attempt asks for a cell inside the plinth, which finalize refuses.
      const cy = fail(++n) ? y + 3 : y;
      yield {
        name: 'Test Lift',
        archetype: 'platform',
        role: 'build',
        style: STYLE,
        modules: [
          {
            type: 'body',
            cells: [
              [x, cy],
              [x + 1, cy],
            ],
            material: 'metal',
            conveyor: 0,
            breakFrames: 0,
            respawnFrames: 0,
          },
        ],
        motion: { type: 'rail', angle: -Math.PI / 2, range: 1, period: 120 },
      };
    },
  };
}

const farm = SCULPTORS.farm;
afterEach(() => {
  SCULPTORS.farm = farm;
  CONCEPTS.farm.length = 0;
});

function use(c: Concept) {
  SCULPTORS.farm = flat;
  CONCEPTS.farm.push(c);
}

describe('stage concepts', () => {
  it('a concept claims its site, builds its tiles, places its piece and names the level', () => {
    use(plinth());
    for (const seed of SEEDS) {
      const l = generateLevel(seed, 'farm', { concept: 'test-plinth' });
      expect(lastGenInfo.concept).toBe('test-plinth');
      expect(lastGenInfo.fallback).toBe(false);
      const r = l.landmark!.rect;
      expect(l.landmark).toMatchObject({ concept: 'test-plinth', skin: 'brick' });
      for (let x = r.x; x < r.x + r.w; x++) expect(l.tiles[(r.y + r.h - 1) * l.w + x]).toBe(1);
      // Its air stays empty: no lane, no filler, no decor.
      for (let y = r.y; y < r.y + r.h - 1; y++) for (let x = r.x; x < r.x + r.w; x++) expect(l.tiles[y * l.w + x]).toBe(T_EMPTY);
      expect(l.setPieces[0].def.key).toBe('setpiece:farm:test-plinth');
      expect(l.setPieces[0].def.motion.type).toBe('rail');
      expect(l.theme.name).toMatch(/^The Test Plinth of /);
      expect(planHolds(l, [], l.solution!)).toBe(true);
    }
  });

  it('is rolled once per level, with a plain share, and a forced plain level is the level without concepts', () => {
    const c = plinth();
    use(c);
    const rolled = Array.from({ length: 20 }, (_, s) => rollConcept(s, 'farm', { size: 'classic', route: 'ltr' }));
    expect(rolled).toContain(c);
    expect(rolled).toContain(null);
    const seed = rolled.indexOf(c);
    generateLevel(seed, 'farm');
    expect(lastGenInfo.concept).toBe('test-plinth');
    const plain = generateLevel(SEEDS[0], 'farm', { concept: 'plain' });
    expect(lastGenInfo.concept).toBeUndefined();
    expect(lastGenInfo.conceptFallback).toBe(false);
    CONCEPTS.farm.length = 0;
    const none = generateLevel(SEEDS[0], 'farm');
    expect(plain.tiles).toEqual(none.tiles);
    expect(JSON.stringify(plain.setPieces)).toBe(JSON.stringify(none.setPieces));
    expect(plain.theme.name).toBe(none.theme.name);
  });

  it('retries the attempt when a landmark piece fails, and falls back to plain after too many', () => {
    use(plinth((n) => n <= 2));
    generateLevel(SEEDS[0], 'farm', { concept: 'test-plinth', draw: 0 });
    expect(lastGenInfo.concept).toBe('test-plinth');
    expect(lastGenInfo.rejects.landmark).toBe(2);

    CONCEPTS.farm.length = 0;
    use(plinth(() => true));
    const l = generateLevel(SEEDS[1], 'farm', { concept: 'test-plinth', draw: 0 });
    expect(lastGenInfo.concept).toBeUndefined();
    expect(lastGenInfo.conceptFallback).toBe(true);
    expect(lastGenInfo.rejects.landmark).toBe(MAX_LANDMARK_REJECTS);
    expect(lastGenInfo.fallback).toBe(false);
    expect(l.landmark).toBeUndefined();
    expect(l.theme.name).not.toMatch(/Test Plinth/);
  });

  it('a carrier carries you over a chasm no parts close, and the level still needs parts', () => {
    const ferry: Concept = {
      id: 'test-ferry',
      weight: 1,
      sizes: ['wide'],
      ownsCrossing: false,
      family: [],
      carrier: {},
      box: () => ({ w: carrierReach().cols + 5, h: 10 }),
      build(g, _rng, at) {
        const ground = at.y + at.h;
        g.clear(at.x + 2, 0, at.x + at.w - 3, g.h - 1);
        return { concept: 'test-ferry', rect: at, air: [{ x: at.x + 2, y: ground - 3, w: at.w - 4, h: 4 }], anchors: { near: [at.x + 2, ground + 1] } };
      },
      *pieces(_rng, _s, l) {
        const [x, y] = l.anchors.near;
        const span = l.rect.w - 4 - 3;
        yield {
          name: 'Test Ferry',
          archetype: 'platform',
          role: 'build',
          style: STYLE,
          modules: [{ type: 'vehicle', look: 'minecart', at: [x, y], cols: [1, 1, 1], colW: 1, span, speed: 4, pause: 90, hurt: 'none', flip: false, seed: 1 }],
          // It docks flush with both banks; the rider's own room is the ride proof's to check.
          crushOk: true,
        };
      },
    };
    use(ferry);
    const l = generateLevel(SEEDS[0], 'farm', { concept: 'test-ferry' });
    expect(lastGenInfo.concept).toBe('test-ferry');
    expect(l.rides?.length).toBeGreaterThan(0);
    expect(l.solution!.length).toBeGreaterThan(0);
    // The ride is on the proof: without it the solution doesn't finish; with it nothing finishes bare.
    expect(analyzeReach(withBridges(l, l.solution!)).goalReached).toBe(true);
    expect(analyzeReach(withBridges({ ...l, rides: undefined }, l.solution!)).goalReached).toBe(false);
    expect(analyzeReach(l).goalReached).toBe(false);
  });
});
