import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { MAX_BRIDGES } from '../src/gen/level';
import {
  type Archetype,
  ARCHETYPE_WEIGHTS,
  type Module,
  dryLean,
  generateCrate,
  generatePart,
  generateRoster,
  isBridgePart,
  type PropDef,
  rosterSize,
} from '../src/gen/props';
import { MAX_PLAYERS } from '../src/sim/constants';
import { restoreMatch, snapshotMatch } from '../src/net/snapshot';

const seedAt = (i: number) => (i * 2654435761 + 91) >>> 0;
const cardsFor = (players: number) => Math.max(3, players + 2);
const PLAYERS = Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1);
const HAZARDS = new Set<Archetype>(['spikestrip', 'spikeblock', 'saw', 'flail', 'launcher', 'flamer', 'laser', 'tesla', 'crusher', 'dropper', 'snapper']);
/** Parts with nothing to scale: one tile, or a beam that already reaches across the level. */
const ONE_SIZE = new Set<Archetype>(['launcher', 'laser', 'spring', 'hangar', 'mystery', 'keg']);

/** Module fields that size may change, by module type. Anything else differing between sizes is a bug. */
const SIZE_FIELDS: Partial<Record<Module['type'], string[]>> = {
  body: ['cells'],
  spikes: ['cells'],
  coat: ['cells'],
  swinger: ['radius'],
  flame: ['length'],
  tesla: ['b'],
  piston: ['at', 'width'],
  fan: ['length'],
  bomb: ['radius'],
  pipe: ['cells'],
  bumper: ['radius'],
  magnet: ['radius'],
  web: ['cells'],
  phase: ['cells'],
  dropper: ['cells'],
  snapper: ['cells'],
  rotor: ['arm', 'hub'],
  rope: ['length'],
};

const baseName = (name: string) => name.replace(/^(Small|Big) /, '');

/** Everything about a variant that has to match across its sizes. */
function identity(d: PropDef) {
  const modules = d.modules.map((m) => {
    const rest: Record<string, unknown> = { ...m };
    for (const f of SIZE_FIELDS[m.type] ?? []) delete rest[f];
    return rest;
  });
  return {
    name: baseName(d.name),
    maker: d.maker,
    part: d.part,
    archetype: d.archetype,
    role: d.role,
    style: d.style,
    motion: d.motion,
    mount: d.mount,
    modules,
  };
}

/** How much of the world a variant covers, in whatever unit its modules scale in. */
function measure(d: PropDef): number {
  let sum = d.footprint.length;
  for (const m of d.modules) {
    const r: Record<string, unknown> = { ...m };
    if (Array.isArray(r.cells)) sum += r.cells.length;
    for (const f of ['radius', 'length', 'arm', 'width']) if (typeof r[f] === 'number') sum += r[f];
    if (m.type === 'tesla') sum += m.b[0];
  }
  return sum;
}

describe('a match roster', () => {
  it('has the size its crates call for, one part per archetype', () => {
    for (const players of PLAYERS) {
      const cards = cardsFor(players);
      expect(rosterSize(cards)).toBeGreaterThan(cards);
      for (let i = 0; i < 40; i++) {
        const roster = generateRoster(seedAt(i), rosterSize(cards));
        expect(roster.length).toBe(rosterSize(cards));
        expect(new Set(roster.map((p) => p.id)).size).toBe(roster.length);
        expect(new Set(roster.slice(1).map((p) => p.archetype)).size).toBe(roster.length - 1);
      }
    }
  });

  it('is the same for the same seed, and differs between seeds', () => {
    expect(generateRoster(5, 12)).toEqual(generateRoster(5, 12));
    expect(generateRoster(5, 12).map((p) => p.id)).not.toEqual(generateRoster(6, 12).map((p) => p.id));
  });

  it('only grows when someone joins between rounds: parts keep their identity', () => {
    for (let i = 0; i < 40; i++) {
      const small = generateRoster(seedAt(i), rosterSize(cardsFor(1)));
      const big = generateRoster(seedAt(i), rosterSize(cardsFor(MAX_PLAYERS)));
      expect(big.slice(0, small.length)).toEqual(small);
    }
  });

  it('always holds what the crate guarantee and dry rounds rely on, and a mix of roles', () => {
    for (const players of PLAYERS) {
      for (let i = 0; i < 200; i++) {
        const roster = generateRoster(seedAt(i), rosterSize(cardsFor(players)));
        const ctx = `${players}p seed ${seedAt(i)}`;
        expect(roster.flatMap((p) => p.variants).some(isBridgePart), ctx).toBe(true);
        const breaker = roster.some((p) => p.variants.some((v) => v.modules.some((m) => m.type === 'bomb' && m.target !== 'props')));
        expect(breaker, ctx).toBe(true);
        expect(
          roster.some((p) => dryLean(p.archetype, 5) > 3 && p.role === 'demolish'),
          ctx,
        ).toBe(true);
        expect(
          roster.some((p) => p.archetype === 'mystery'),
          ctx,
        ).toBe(true);
        expect(roster.filter((p) => HAZARDS.has(p.archetype)).length, ctx).toBeGreaterThanOrEqual(3);
        for (const role of ['build', 'hazard', 'utility', 'demolish'])
          expect(
            roster.some((p) => p.role === role),
            `${ctx} ${role}`,
          ).toBe(true);
        expect(roster.filter((p) => p.role === 'utility' && p.archetype !== 'mystery').length, ctx).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('leaves plain footing to the bridge, so a second plank never reads as a different part', () => {
    for (let i = 0; i < 200; i++) {
      for (const p of generateRoster(seedAt(i), 14).slice(1)) expect(p.variants.some(isBridgePart), p.id).toBe(false);
    }
  });
});

describe('crates', () => {
  it('draw only from the roster, whatever the round, need or dry streak', () => {
    for (const players of PLAYERS) {
      const count = cardsFor(players);
      for (let i = 0; i < 12; i++) {
        const seed = seedAt(i);
        const variants = generateRoster(seed, rosterSize(count)).flatMap((p) => p.variants);
        for (let round = 1; round <= 25; round++) {
          const crate = generateCrate(seed, round, count, round % (MAX_BRIDGES + 1), round % 7);
          expect(crate.length).toBe(count);
          for (const card of crate) {
            const v = variants.find((x) => x.part === card.part && x.size === card.size);
            expect(v, card.name).toBeDefined();
            expect({ ...card, key: '' }).toEqual({ ...v, key: '' });
          }
        }
      }
    }
  });

  it('keep the guarantee for every player count, across many rounds', () => {
    for (const players of PLAYERS) {
      const count = cardsFor(players);
      for (let need = 0; need <= MAX_BRIDGES; need++) {
        for (let round = 1; round <= 25; round++) {
          for (const dry of [0, 2, 9]) {
            const crate = generateCrate(seedAt(round), round, count, need, dry);
            expect(crate.filter(isBridgePart).length).toBeGreaterThanOrEqual(Math.max(1, Math.min(need, count - 1)));
            expect(crate.some((d) => HAZARDS.has(d.archetype))).toBe(true);
          }
        }
      }
    }
  });

  it('never show the same card twice, past the bridges a level needs', () => {
    for (const players of PLAYERS) {
      const count = cardsFor(players);
      for (let round = 1; round <= 60; round++) {
        const need = 1 + (round % MAX_BRIDGES);
        const crate = generateCrate(seedAt(round), round, count, need, round % 6);
        const spare = crate.filter((d) => !isBridgePart(d)).map((d) => `${d.part}:${d.size}`);
        expect(new Set(spare).size).toBe(spare.length);
      }
    }
  });

  it('stay a choice: mostly different parts, sometimes one part at two sizes', () => {
    for (const players of PLAYERS) {
      const count = cardsFor(players);
      let distinct = 0;
      let repeats = 0;
      const crates = 200;
      for (let i = 0; i < crates; i++) {
        const parts = new Set(generateCrate(seedAt(i), 1 + (i % 15), count).map((d) => d.part));
        distinct += parts.size;
        if (parts.size < count) repeats++;
      }
      expect(distinct / crates, `${players}p`).toBeGreaterThan(count * 0.75);
      expect(repeats, `${players}p`).toBeGreaterThan(0);
    }
  });

  it('let every part on the roster turn up over a long match', () => {
    for (const players of [2, 4, 8]) {
      const count = cardsFor(players);
      for (let i = 0; i < 20; i++) {
        const seen = new Set<string>();
        for (let round = 1; round <= 25; round++) for (const d of generateCrate(seedAt(i), round, count)) seen.add(d.part!);
        expect(seen.size, `${players}p seed ${seedAt(i)}`).toBeGreaterThanOrEqual(rosterSize(count) - 1);
      }
    }
  });

  it('lean toward the roster breaker when a match is stuck', () => {
    const breakers = (dry: number) => {
      let n = 0;
      for (let i = 0; i < 300; i++) n += generateCrate(seedAt(i), 1 + (i % 9), 4, 1, dry).filter((d) => d.role === 'demolish').length;
      return n;
    };
    expect(breakers(5)).toBeGreaterThan(breakers(0) * 2);
  });
});

describe('a part across its sizes', () => {
  const kinds = ARCHETYPE_WEIGHTS.map(([k]) => k);

  it('differs in size and nothing else', () => {
    for (const k of kinds) {
      for (let i = 0; i < 60; i++) {
        const { variants } = generatePart(new Rng(i * 37 + 11), k, k);
        for (const v of variants) expect(identity(v), `${k} seed ${i}`).toEqual(identity(variants[0]));
      }
    }
  });

  it('comes small, medium and large, each bigger than the last, or in one size', () => {
    for (const k of kinds) {
      for (let i = 0; i < 40; i++) {
        const { variants } = generatePart(new Rng(i * 53 + 7), k, k);
        if (ONE_SIZE.has(k)) {
          expect(
            variants.map((v) => v.size),
            k,
          ).toEqual(['medium']);
          continue;
        }
        expect(
          variants.map((v) => v.size),
          k,
        ).toEqual(['small', 'medium', 'large']);
        expect(measure(variants[0]), `${k} seed ${i}`).toBeLessThan(measure(variants[1]));
        expect(measure(variants[1]), `${k} seed ${i}`).toBeLessThan(measure(variants[2]));
      }
    }
  });

  it('keeps its name, with a size word only off medium', () => {
    // Many seeds, so every word list gets a turn: none of them may lead with a size word.
    for (const k of kinds) {
      for (let i = 0; i < 40; i++) {
        const { variants } = generatePart(new Rng(i * 31 + 3), k, k);
        const plain = variants.find((v) => v.size === 'medium')!.name;
        expect(plain).not.toMatch(/^(Small|Big) /);
        for (const v of variants) expect(v.name).toBe({ small: `Small ${plain}`, medium: plain, large: `Big ${plain}` }[v.size!]);
      }
    }
  });
});

describe('peers', () => {
  const start = (seed: number, players: number) => {
    const m = new Match(seed, 'farm');
    for (let i = 0; i < players; i++) m.join(`p${i}`);
    m.startMatch();
    return m;
  };
  const defs = (m: Match) => m.crate.map((c) => c.def);

  it('see the same crates, and a guest restored mid-match keeps drawing the same roster', { timeout: 30_000 }, () => {
    const host = start(4242, 4);
    expect(defs(start(4242, 4))).toEqual(defs(host));
    const guest = new Match(1, 'farm');
    restoreMatch(guest, snapshotMatch(host));
    expect(defs(guest)).toEqual(defs(host));
    for (const m of [host, guest]) m['startRound']();
    expect(defs(guest)).toEqual(defs(host));
    const ids = new Set(generateRoster(host.seed, rosterSize(host.crate.length)).map((p) => p.id));
    for (const d of defs(host)) expect(ids.has(d.part!)).toBe(true);
  });
});
