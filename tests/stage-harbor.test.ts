import { describe, expect, it } from 'vitest';
import { fieldOf, generateLevel, lastGenInfo, withBridges } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { rollConcept } from '../src/gen/stage';
import { HARBOR_CONCEPTS } from '../src/gen/stage/harbor';
import { TILE } from '../src/sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID, tileAt } from '../src/sim/level';
import { type Module, type ModuleOf, type PlacedProp, resolveProp } from '../src/sim/props';
import { MIN_OPENING } from '../src/sim/props/barrier';
import { analyzeReach } from '../src/sim/reach';

/**
 * The harbor's own behaviour (src/gen/stage/harbor*.ts, src/gen/setpieces/harbor.ts): what each landmark is
 * and the harbor-only hazards. The generic landmark and hazard contract (scale, footing, ways through,
 * varying with the seed, the static proof, free rides, tells, uniqueness) is tests/conformance's.
 */

const SEEDS = [1001, 1004];

const cache = new Map<string, Level[]>();
function levels(id: string): Level[] {
  let ls = cache.get(id);
  if (!ls) {
    ls = SEEDS.map((seed) => {
      const l = generateLevel(seed, 'harbor', { concept: id });
      expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
      return l;
    });
    cache.set(id, ls);
  }
  return ls;
}

const mods = (l: Level, pred: (m: Module) => boolean): { pp: PlacedProp; m: Module }[] =>
  l.setPieces.flatMap((pp) =>
    resolveProp(pp)
      .mods.filter(pred)
      .map((m) => ({ pp, m })),
  );
const stands = (l: Level) => analyzeReach(withBridges(fieldOf(l, []), l.solution!), false).reachable;
const t = (l: Level, x: number, y: number) => tileAt(l, x, y);

describe('harbor stage concepts', () => {
  it('has at least five, each on its share of harbor levels', () => {
    expect(HARBOR_CONCEPTS.length).toBeGreaterThanOrEqual(5);
    const seen = new Map<string, number>();
    for (let s = 0; s < 200; s++) {
      const id = rollConcept(s, 'harbor', rollProfile(s, 'harbor'))?.id ?? 'plain';
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    for (const c of HARBOR_CONCEPTS) expect(seen.get(c.id) ?? 0, c.id).toBeGreaterThan(12);
  });

  it('the galleon is run through its gun deck under the main deck, its masts carry yards, its guns aim down the ship', () => {
    for (const l of levels('galleon')) {
      const r = l.landmark!.rect;
      const reach = stands(l);
      // A gun deck: stand cells reached under solid main deck, inside the hull.
      let below = 0;
      let yards = 0;
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) {
          if (reach.has(y * l.w + x) && [1, 2, 3, 4, 5].some((k) => t(l, x, y - k) === T_SOLID) && t(l, x, y + 1) === T_SOLID) below++;
          if (t(l, x, y) === T_ONEWAY) yards++;
        }
      expect(below, `seed ${l.seed} gun deck`).toBeGreaterThan(6);
      expect(yards, `seed ${l.seed} yards`).toBeGreaterThan(5);
      for (const { m } of mods(l, (m) => m.type === 'cannon')) {
        if (m.type !== 'cannon') continue;
        const mid = (r.x + r.w / 2) * TILE;
        // Inside the ship, pointing toward its middle.
        if (m.at[0] >= r.x * TILE && m.at[0] <= (r.x + r.w) * TILE) expect(Math.sign(Math.cos(m.angle))).toBe(Math.sign(mid - m.at[0]) || 1);
      }
    }
  });

  it("the pier's tide stays under its boardwalk, its wave breaks along the sand, and sand shelves up to the banks with ladders by them", () => {
    for (const l of levels('tidal-pier')) {
      const tide = mods(l, (m) => m.type === 'flood')[0]?.m as ModuleOf<'flood'>;
      expect(tide, `seed ${l.seed}`).toBeDefined();
      const crest = (tide.at[1] - tide.high) / TILE;
      const x0 = Math.round(tide.at[0] / TILE);
      const x1 = x0 + Math.round(tide.w / TILE) - 1;
      for (let x = x0; x <= x1; x++) {
        let plank = 0;
        while (plank < l.h && t(l, x, plank) !== T_ONEWAY) plank++;
        expect(crest, `seed ${l.seed} column ${x}`).toBeGreaterThanOrEqual(plank + 1);
      }
      const wave = mods(l, (m) => m.type === 'geyser')[0]?.m as ModuleOf<'geyser'>;
      expect([wave.look, wave.lethal, Math.abs(Math.sin(wave.angle)) < 1e-9]).toEqual(['water', false, true]);
      for (const side of [-1, 1]) {
        const cols = [1, 2, 3].map((k) => (side < 0 ? x0 - k : x1 + k));
        expect(
          cols.some((x) => t(l, x, tide.at[1] / TILE - 1) === T_ONEWAY || t(l, x, tide.at[1] / TILE - 2) === T_ONEWAY),
          `ladder by ${cols}`,
        ).toBe(true);
      }
    }
  });

  it("the terminal's open containers make a tunnel along the quay, under stacks you can also climb and a box on the hook", () => {
    for (const l of levels('container-terminal')) {
      const r = l.landmark!.rect;
      const reach = stands(l);
      let G = r.y;
      while (t(l, r.x + 1, G) !== T_SOLID) G++;
      let roofed = 0;
      let tops = 0;
      for (let x = r.x; x < r.x + r.w; x++) {
        if (reach.has((G - 1) * l.w + x) && t(l, x, G - 3) === T_SOLID) roofed++;
        for (let y = r.y; y < G - 3; y++) if (reach.has(y * l.w + x) && t(l, x, y + 1) === T_SOLID) tops++;
      }
      expect(roofed, `seed ${l.seed} tunnel`).toBeGreaterThan(5);
      expect(tops, `seed ${l.seed} stack tops`).toBeGreaterThan(5);
      // The swinging box hangs from the boom over the stacks, clear of their tops.
      for (const { m } of mods(l, (m) => m.type === 'rotor')) {
        if (m.type !== 'rotor' || m.look !== 'crane') continue;
        const x = Math.floor(m.hub[0] / TILE);
        let top = Math.floor(m.hub[1] / TILE);
        while (top < l.h && t(l, x, top) !== T_SOLID) top++;
        expect(top * TILE - (m.hub[1] + m.arm), `seed ${l.seed}`).toBeGreaterThan(TILE);
      }
    }
  });

  it('the lighthouse is gone through at the bottom or climbed to its gallery, its lamp a beam on a long dark', () => {
    for (const l of levels('lighthouse')) {
      const lamp = mods(l, (m) => m.type === 'laser')[0]?.m;
      if (lamp?.type === 'laser') {
        expect(lamp.look).toBe('lamp');
        expect(lamp.off).toBeGreaterThan(lamp.fire * 2);
      }
      const r = l.landmark!.rect;
      const reach = stands(l);
      // Stand cells well up the tower: the climb is proven, not only the door.
      let high = 0;
      let G = r.y;
      while (t(l, r.x, G) !== T_SOLID) G++;
      for (const k of reach) if (k % l.w >= r.x && k % l.w < r.x + r.w && Math.floor(k / l.w) < G - 6) high++;
      expect(high, `seed ${l.seed}`).toBeGreaterThan(3);
    }
  });

  it("the lagoon's tentacles rise out of open water and stop short of the rope bridge", () => {
    for (const l of levels('kraken-lagoon')) {
      const arms = mods(l, (m) => m.type === 'geyser' && m.look === 'tentacle').filter(({ pp }) => pp.def.key.endsWith(':kraken-lagoon'));
      expect(arms.length, `seed ${l.seed}`).toBeGreaterThan(0);
      for (const { m } of arms) {
        if (m.type !== 'geyser') continue;
        const x = Math.floor(m.at[0] / TILE);
        expect(m.at[1]).toBe(l.h * TILE);
        const tip = Math.floor((m.at[1] - m.length) / TILE);
        for (let y = tip; y < l.h; y++) expect(t(l, x, y), `seed ${l.seed} ${x},${y}`).toBe(T_EMPTY);
        expect(
          [1, 2, 3].some((k) => t(l, x, tip - k) === T_ONEWAY),
          `seed ${l.seed} bridge over ${x}`,
        ).toBe(true);
      }
    }
  });
});

describe('harbor hazards', () => {
  const plain = [3, 11, 12, 21, 30].map((s) => generateLevel(s, 'harbor', { concept: 'plain', hazards: 4, danger: 1 }));
  const all = [...plain, ...levels('galleon'), ...levels('kraken-lagoon'), ...levels('lighthouse'), ...levels('tidal-pier')];

  it('harpoon guns fire harpoons that fly long and drop, on a rhythm', () => {
    const guns = all.flatMap((l) => mods(l, (m) => m.type === 'cannon' && m.look === 'harpoon'));
    expect(guns.length).toBeGreaterThan(0);
    for (const { m } of guns) if (m.type === 'cannon') expect([m.ammo, m.interval >= MIN_OPENING * 3]).toEqual(['arrow', true]);
  });

  it('whirlpools turn in open water, on a beat with a warning', () => {
    const pools = all.flatMap((l) => mods(l, (m) => m.type === 'magnet' && m.look === 'whirlpool').map((p) => ({ l, ...p })));
    expect(pools.length).toBeGreaterThan(0);
    for (const { l, m } of pools) {
      if (m.type !== 'magnet') continue;
      expect(m.polarity).toBe(1);
      expect(m.off).toBeGreaterThanOrEqual(MIN_OPENING);
      expect(m.warn).toBeGreaterThanOrEqual(18);
      const x = Math.floor(m.at[0] / TILE);
      for (let y = Math.floor(m.at[1] / TILE); y < l.h; y++) expect(t(l, x, y), `seed ${l.seed} column ${x}`).toBe(T_EMPTY);
    }
  });

  it('channel lights stand on a quay or pier edge and sweep out over the water beside it', () => {
    const lights = all.flatMap((l) => mods(l, (m) => m.type === 'laser' && m.look === 'lamp').map((p) => ({ l, ...p })));
    expect(lights.length).toBeGreaterThan(0);
    for (const { l, m, pp } of lights) {
      if (m.type !== 'laser' || pp.def.name.includes('Lamp') || pp.def.name.includes('Beam') || pp.def.name.includes('Keeper')) continue;
      const x = Math.floor(m.at[0] / TILE);
      const y = Math.floor(m.at[1] / TILE);
      expect(t(l, x, y + 1), `seed ${l.seed}`).toBe(T_SOLID);
      const d = Math.cos(m.angle) > 0 ? 1 : -1;
      for (let yy = 0; yy < l.h; yy++) expect(t(l, x + d, yy)).toBe(T_EMPTY);
    }
  });
});
