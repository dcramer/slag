import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo } from '../src/gen/level';
import { rollProfile } from '../src/gen/level/profile';
import { SET_PIECE_RECIPES } from '../src/gen/setpieces';
import { rollConcept } from '../src/gen/stage';
import { HARBOR_CONCEPTS } from '../src/gen/stage/harbor';
import { MIN_OPENING } from '../src/sim/props/barrier';
import { RECIPES } from '../src/gen/theme/presets';
import { DECOR } from '../src/render/decor';
import { Rng } from '../src/core/rng';
import type { Level } from '../src/sim/level';
import { type ModuleOf, resolveProp } from '../src/sim/props';
import { THEME_IDS } from '../src/themes';
import { floating, freeRiders, signature, staticProof, varying, waysThrough } from './lib/landmark-checks';

/**
 * The harbor's stage concepts (src/gen/stage/harbor*.ts, docs/SETPIECES.md): each appears, stands on the sea
 * floor with nothing floating, has at least two ways through, comes out a different building with each seed,
 * is proven without its movers, and gives no free ride. The harbor's own hazards and decor are counted too.
 */

const SEEDS = [1001, 1004, 1005];

const levels = new Map<string, Level[]>();
function of(id: string): Level[] {
  let ls = levels.get(id);
  if (!ls) {
    ls = SEEDS.map((seed) => {
      const l = generateLevel(seed, 'harbor', { concept: id });
      expect(lastGenInfo.concept, `${id} seed ${seed}`).toBe(id);
      expect(lastGenInfo.fallback).toBe(false);
      return l;
    });
    levels.set(id, ls);
  }
  return ls;
}

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

  for (const c of HARBOR_CONCEPTS) {
    describe(c.id, () => {
      it('is large: a third of the level or more, its berth included', () => {
        for (const l of of(c.id)) expect(l.landmark!.rect.w + 10, `${l.seed}`).toBeGreaterThanOrEqual(l.w / 3);
      });

      it('stands: nothing in it floats', () => {
        for (const l of of(c.id)) expect(floating(l), `seed ${l.seed}`).toEqual([]);
      });

      it('has at least two ways through', () => {
        for (const l of of(c.id)) expect(waysThrough(l), `seed ${l.seed}`).toBeGreaterThanOrEqual(2);
      });

      it('is a different building with each seed', () => {
        expect(varying(of(c.id).map((l) => signature(l))).length).toBeGreaterThanOrEqual(2);
      });

      it('is proven without its movers, and none of them gives a free ride', () => {
        for (const l of of(c.id)) {
          expect(staticProof(l), `seed ${l.seed}`).toEqual([]);
          expect(freeRiders(l), `seed ${l.seed}`).toEqual([]);
        }
      });
    });
  }

  it('the grand ones own most of a classic level', () => {
    for (const id of ['galleon', 'tidal-pier']) {
      const l = generateLevel(7, 'harbor', { concept: id, size: 'classic' });
      expect(lastGenInfo.concept).toBe(id);
      // The structure plus the berth in front of it.
      expect(l.landmark!.rect.x + l.landmark!.rect.w - 6, id).toBeGreaterThan(l.w / 2);
    }
  });

  it('the galleon has a gun deck under its main deck, and masts with yards', () => {
    for (const l of of('galleon')) {
      const r = l.landmark!.rect;
      let yards = 0;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (l.tiles[y * l.w + x] === 2) yards++;
      expect(yards, `seed ${l.seed}`).toBeGreaterThan(5);
    }
  });
});

describe('harbor hazards', () => {
  const pieces = [
    ...[3, 11, 12].map((s) => generateLevel(s, 'harbor', { concept: 'plain', hazards: 4, danger: 1 })),
    ...of('kraken-lagoon'),
    ...of('container-terminal'),
    ...of('galleon'),
  ].flatMap((l) => l.setPieces.map((pp) => ({ l, pp, mods: resolveProp(pp).mods })));
  const has = (pred: (m: ReturnType<typeof resolveProp>['mods'][number]) => boolean) => pieces.filter((p) => p.mods.some(pred));

  it('are harbor-only recipes: no other theme has a wave, a tentacle or a harpoon', () => {
    for (const t of THEME_IDS) {
      if (t === 'harbor') continue;
      for (const r of SET_PIECE_RECIPES[t]) expect(['wave', 'tentacle', 'harpoon']).not.toContain(r.name);
    }
    expect(SET_PIECE_RECIPES.harbor.map((r) => r.name)).toEqual(expect.arrayContaining(['wave', 'tentacle', 'harpoon']));
  });

  it('tentacles rise out of open water after a warning, and leave windows to slip past', () => {
    const t = has((m) => m.type === 'geyser' && m.look === 'tentacle');
    expect(t.length).toBeGreaterThan(0);
    for (const { l, mods } of t)
      for (const m of mods as ModuleOf<'geyser'>[]) {
        if (m.type !== 'geyser') continue;
        expect(m.lethal).toBe(true);
        expect(m.warn).toBeGreaterThanOrEqual(40);
        expect(m.off).toBeGreaterThanOrEqual(MIN_OPENING);
        // It comes up from the bottom of the sea: nothing solid under its vent.
        const x = Math.floor(m.at[0] / 16);
        for (let y = 0; y < l.h; y++) if (l.tiles[y * l.w + x] === 1) expect(y * 16).toBeLessThan(m.at[1] - m.length * 16);
      }
  });

  it('harpoon guns fire straight bolts on a rhythm, and cargo hangs from the crane over a stack', () => {
    const guns = has((m) => m.type === 'cannon' && m.look === 'harpoon');
    expect(guns.length).toBeGreaterThan(0);
    for (const { mods } of guns) for (const m of mods) if (m.type === 'cannon') expect([m.ammo, m.interval >= MIN_OPENING * 3]).toEqual(['bolt', true]);
    const cargo = has((m) => m.type === 'dropper' && m.look === 'cargo');
    expect(cargo.length).toBeGreaterThan(0);
    for (const { mods } of cargo) for (const m of mods) if (m.type === 'dropper') expect(m.warn).toBeGreaterThanOrEqual(20);
  });

  it('none of them gives a free ride or breaks the plan', () => {
    const ls = new Set(pieces.map((p) => p.l));
    for (const l of ls) {
      expect(freeRiders(l)).toEqual([]);
      expect(staticProof(l)).toEqual([]);
    }
  });
});

describe('harbor decor', () => {
  it('has at least twelve kinds of its own, all registered, varying by seed', () => {
    const seen = new Set<string>();
    const lists = new Set<string>();
    for (let s = 0; s < 40; s++) {
      const look = RECIPES.harbor(new Rng(s));
      for (const k of look.decor) seen.add(k);
      lists.add(look.decor.slice().sort().join());
    }
    for (const k of seen) expect(DECOR[k as keyof typeof DECOR], k).toBeDefined();
    expect(seen.size).toBeGreaterThanOrEqual(12);
    expect(lists.size).toBeGreaterThan(3);
  });
});
