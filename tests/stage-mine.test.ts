import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { rollConcept } from '../src/gen/stage';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import {
  CART_BACK,
  CART_PARKED,
  CART_RUN,
  CART_WARN,
  CAVE_ON,
  cartCycle,
  cartDist,
  caveCycle,
  type Contrib,
  type Module,
  type ModuleOf,
  moduleSim,
  motionOffset,
  type PlacedProp,
  type PropCtx,
  resolveProp,
  rockCount,
} from '../src/sim/props';

/**
 * The mine's stage concepts (src/gen/stage/mine.ts) and its own hazards, as mine behaviour: what each
 * landmark's pieces do where they stand. What every landmark owes (scale, footing, ways through, a layout
 * that varies, the static proof, no free ride, tells) is held by tests/conformance.
 */

function landmark(id: string, seed: number, size?: 'classic' | 'wide'): Level {
  const l = generateLevel(seed, 'mine', { concept: id, ...(size ? { size } : {}) });
  expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
  return l;
}

const solid = (l: Level, x: number, y: number) => tileAt(l, x, y) === T_SOLID;
const own = (l: Level) => l.setPieces.filter((pp) => pp.def.key.endsWith(`:${l.landmark!.concept}`));
const mods = (l: Level) => own(l).flatMap((pp) => resolveProp(pp).mods);
const ofType = <T extends Module['type']>(l: Level, t: T) => mods(l).filter((m): m is ModuleOf<T> => m.type === t);

/** A set piece of one module, placed at the origin, to drive the module by hand. */
function alone(m: Module): { pp: PlacedProp; hazards: (f: number) => Contrib['hazards'] } {
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
      archetype: 'dropper',
      role: 'hazard',
      style: { metal: 'rust', trim: 'none', hue: 0, glowHue: 0, woodHue: 0 },
      motion: { type: 'none' },
      modules: [m],
      footprint: [[0, 0]],
    },
  };
  const r = resolveProp(pp);
  return {
    pp,
    hazards: (f) => {
      const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
      moduleSim(r.mods[0].type).build!(r.mods[0], { r, off: [0, 0], prev: [0, 0], frame: f, mi: 0, live: true } as unknown as PropCtx, out);
      return out.hazards;
    },
  };
}

describe('mine stage concepts', () => {
  it('each gets its share of mine levels', () => {
    const seen = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      const id = rollConcept(s, 'mine', rollProfile(s, 'mine'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const id of ['headframe', 'trestle-line', 'ore-crusher', 'crystal-geode']) expect(seen.get(id) ?? 0, id).toBeGreaterThan(12);
    // The gallery is for wide levels only.
    expect(seen.get('flooded-gallery') ?? 0).toBeGreaterThan(4);
  });

  it('the Headframe parks its cage flush in the floor and at the deck, through the hole in it', () => {
    for (const seed of [1, 4]) {
      const l = landmark('headframe', seed);
      const cage = own(l).find((pp) => pp.def.motion.type === 'rail')!;
      const r = resolveProp(cage);
      const body = r.mods.find((m): m is ModuleOf<'body'> => m.type === 'body')!;
      const [sx, G] = body.cells[0];
      // Parked at the bottom, it fills the floor's slot.
      expect(tileAt(l, sx, G)).toBe(T_EMPTY);
      expect(solid(l, sx, G + 1)).toBe(true);
      expect(solid(l, sx - 1, G) || solid(l, sx + 2, G)).toBe(true);
      // At the top of its rail it fills the hole in the deck, flush with the deck either side.
      const range = (cage.def.motion as { range: number }).range;
      const D = G - range;
      expect(tileAt(l, sx, D)).toBe(T_EMPTY);
      expect(solid(l, sx - 1, D) && solid(l, sx + 2, D)).toBe(true);
      // Somewhere in its cycle it's at each end.
      const ys = new Set<number>();
      for (let f = 0; f < 2000; f += 2) ys.add(Math.round(motionOffset(r, f)[1] / TILE));
      expect(ys.has(0)).toBe(true);
      expect(ys.has(-range)).toBe(true);
    }
  });

  it('the Trestle Line runs a cart along the low line and its breaks are hops', () => {
    const l = landmark('trestle-line', 2, 'wide');
    const carts = ofType(l, 'cart');
    expect(carts.length).toBeGreaterThan(0);
    for (const c of carts) {
      // Every cart rolls on solid floor the whole way.
      const y = Math.round(c.at[1] / TILE);
      const x0 = Math.floor((c.dir > 0 ? c.at[0] : c.at[0] - c.span) / TILE);
      const x1 = Math.floor((c.dir > 0 ? c.at[0] + c.span + c.w : c.at[0] + c.w) / TILE) - 1;
      for (let x = x0; x <= x1; x++) expect(solid(l, x, y), `rail at ${x},${y}`).toBe(true);
    }
  });

  it('the Ore Crusher pours its ore down the hopper into the tunnel, and its belts carry toward the hopper', () => {
    const l = landmark('ore-crusher', 3);
    const [fall] = ofType(l, 'cavein');
    expect(fall.kind).toBe('rocks');
    const x = Math.floor(fall.at[0] / TILE);
    const top = Math.round(fall.at[1] / TILE);
    const bottom = Math.round((fall.at[1] + fall.h) / TILE);
    // Out of the roof's hopper mouth, down to the tunnel's floor.
    expect(solid(l, x - 1, top)).toBe(true);
    expect(solid(l, x, bottom)).toBe(true);
    for (let y = top; y < bottom; y++) expect(tileAt(l, x, y), `hopper ${x},${y}`).toBe(T_EMPTY);
    for (const b of ofType(l, 'body').filter((m) => m.material === 'conveyor')) {
      const bx = (b.cells[0][0] + b.cells[b.cells.length - 1][0]) / 2;
      expect(Math.sign(b.conveyor)).toBe(Math.sign(x + 1 - bx));
    }
  });

  it('the Crystal Geode floors its bowl with crystal spikes, under ledges across it', () => {
    const l = landmark('crystal-geode', 2);
    const [sp] = ofType(l, 'spikes');
    expect(sp.look).toBe('crystal');
    expect(sp.angle).toBeLessThan(0);
    // A one-way ledge crosses over the spikes somewhere.
    const xs = sp.cells.map(([x]) => x);
    const y = sp.cells[0][1];
    let over = false;
    for (const x of xs) for (let yy = y - 8; yy < y; yy++) if (tileAt(l, x, yy) === 2) over = true;
    expect(over).toBe(true);
  });

  it('the Flooded Gallery floods its floor with water that never reaches its refuges', () => {
    const l = landmark('flooded-gallery', 2, 'wide');
    const tide = ofType(l, 'flood');
    expect(tide.length).toBeGreaterThan(1);
    expect(new Set(tide.map((m) => `${m.off},${m.rise},${m.hold}`)).size).toBe(1);
    // Each run of floor but the last ends at a refuge rock standing over high water; the last runs out of the gallery.
    const runs = tide.slice().sort((a, b) => a.at[0] - b.at[0]);
    for (const m of runs.slice(0, -1)) {
      expect(m.look).toBe('water');
      const crest = Math.floor((m.at[1] - m.high) / TILE);
      const right = Math.round((m.at[0] + m.w) / TILE);
      expect(solid(l, right, crest - 1) || solid(l, right, crest), `refuge at ${right}`).toBe(true);
    }
  });
});

describe('the cave-in', () => {
  const rocks: Module = { type: 'cavein', kind: 'rocks', at: [2, 4], w: 4, h: 5, off: 100, warn: 40, on: 48, seed: 3 };
  const gas: Module = { ...rocks, kind: 'gas', on: 30 };

  it('hurts nothing while it waits and warns; then its rocks fall down their columns, roof to floor', () => {
    const { pp, hazards } = alone(rocks);
    const m = resolveProp(pp).mods[0] as ModuleOf<'cavein'>;
    let fell = 0;
    const lowest = new Map<number, number>();
    for (let f = 0; f < 188; f++) {
      const c = caveCycle(m, f, resolveProp(pp).phase);
      const hz = hazards(f);
      if (c.seg !== CAVE_ON) expect(hz).toEqual([]);
      else fell++;
      for (const h of hz) {
        if (h.kind !== 'circle') throw new Error('a rock is a circle');
        expect(h.x).toBeGreaterThan(2 * TILE);
        expect(h.x).toBeLessThan(6 * TILE);
        expect(h.y - h.r).toBeGreaterThanOrEqual(4 * TILE - 0.01);
        expect(h.y + h.r).toBeLessThanOrEqual(9 * TILE + 0.01);
        const col = Math.floor(h.x / TILE);
        lowest.set(col, Math.max(lowest.get(col) ?? 0, h.y));
      }
    }
    expect(fell).toBe(48);
    expect(rockCount(m)).toBe(4);
    // Each column's rock reaches the floor.
    expect(lowest.size).toBe(4);
    for (const y of lowest.values()) expect(y).toBeGreaterThan(8 * TILE);
  });

  it('firedamp burns the whole pocket at once, and only while it burns', () => {
    const { pp, hazards } = alone(gas);
    const m = resolveProp(pp).mods[0] as ModuleOf<'cavein'>;
    let burnt = 0;
    for (let f = 0; f < 170; f++) {
      const hz = hazards(f);
      if (caveCycle(m, f, resolveProp(pp).phase).seg !== CAVE_ON) expect(hz).toEqual([]);
      else {
        burnt++;
        expect(hz).toHaveLength(1);
        const h = hz[0];
        if (h.kind !== 'rect') throw new Error('the burn is the box');
        expect(h.r.w).toBeGreaterThan(4 * TILE - 4);
        expect(h.r.h).toBeGreaterThan(5 * TILE - 4);
      }
    }
    expect(burnt).toBe(30);
  });
});

describe('the runaway cart', () => {
  const cart: Module = { type: 'cart', at: [3, 10], w: 2, h: 1.1, span: 8, dir: 1, off: 80, warn: 40, run: 40, back: 120, seed: 1 };

  it('rings and rocks parked, breaks loose gathering speed, kills only on the way down, and is winched back', () => {
    const { pp, hazards } = alone(cart);
    const r = resolveProp(pp);
    const m = r.mods[0] as ModuleOf<'cart'>;
    let prev = 0;
    let prevStep = 0;
    let ran = 0;
    for (let f = 0; f < 280; f++) {
      const c = cartCycle(m, f, r.phase);
      const d = cartDist(m, f, r.phase);
      const hz = hazards(f);
      if (c.seg === CART_PARKED || c.seg === CART_WARN) {
        expect(d).toBe(0);
        expect(hz).toEqual([]);
      }
      if (c.seg === CART_BACK) expect(hz).toEqual([]);
      if (c.seg === CART_RUN) {
        ran++;
        expect(hz).toHaveLength(1);
        // Faster and faster: each frame's step no shorter than the last.
        if (c.t > 0) expect(d - prev).toBeGreaterThanOrEqual(prevStep - 1e-9);
        prevStep = c.t > 0 ? d - prev : 0;
        const h = hz[0];
        if (h.kind !== 'rect') throw new Error('the cart is a box');
        expect(h.r.x).toBeGreaterThanOrEqual(3 * TILE);
        expect(h.r.x + h.r.w).toBeLessThanOrEqual((3 + 8 + 2) * TILE);
      }
      prev = d;
    }
    expect(ran).toBe(40);
  });
});
