import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { DEFAULT_RULES, type MatchRules } from '../src/game/rules';
import { generateLevel, partsNeeded } from '../src/gen/level';
import { dryLean, generateRoster, isBridgePart, type Part, type Role, rollSecret, rosterSize } from '../src/gen/props';
import { sanitizeRules } from '../src/net/actions';
import { cloneSnap, hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { NetSession } from '../src/net/session';
import { LoopbackHub } from '../src/net/transport';
import { TILE } from '../src/sim/constants';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const SECRET: MatchRules = { ...DEFAULT_RULES, secretParts: true, pickSeconds: 0, placeSeconds: 0 };
const press = (k: Partial<InputFrame> = {}): InputFrame => ({ ...NO_INPUT, ...k });
const TICK = 1000 / 60;

/** A secret-parts match with `n` local players, in pick. */
function inPick(n: number, seed = 4242): Match {
  const m = new Match(seed, 'farm', SECRET);
  for (let i = 0; i < n; i++) m.join(`kb${i}`);
  m.startMatch();
  for (let f = 0; f < 12; f++) m.step({});
  return m;
}

const middle = (m: Match, i: number) => ({ x: m.crate[i].rect.x + m.crate[i].rect.w / 2, y: m.crate[i].rect.y + m.crate[i].rect.h / 2 });

/** Players click cards (device → card index) on one frame. */
function click(m: Match, picks: Record<string, number>) {
  m.step(Object.fromEntries(Object.entries(picks).map(([dev, i]) => [dev, press({ pointer: middle(m, i), confirmPressed: true })])));
}

describe('the Secret Parts rule', () => {
  it('is off by default and survives sanitize either way', () => {
    expect(DEFAULT_RULES.secretParts).toBe(false);
    expect(sanitizeRules({ ...DEFAULT_RULES, secretParts: true }).secretParts).toBe(true);
    expect(sanitizeRules({ ...DEFAULT_RULES, secretParts: 'yes' as unknown as boolean }).secretParts).toBe(false);
  });

  it('turns every card into a role card, keeping the crate’s mix of roles', () => {
    const plain = new Match(4242, 'farm', { ...SECRET, secretParts: false });
    plain.join('kb0');
    plain.join('kb1');
    plain.startMatch();
    expect(plain.crate.every((c) => c.secret === undefined)).toBe(true);
    const m = inPick(2);
    expect(m.crate.length).toBe(plain.crate.length);
    expect(m.crate.map((c) => c.secret)).toEqual(plain.crate.map((c) => c.def.role));
    expect(m.crate.some((c) => c.secret === 'hazard')).toBe(true);
  });
});

describe('claiming a role card', () => {
  it('is one card per player, first come first served', () => {
    const m = inPick(3);
    click(m, { kb0: 1, kb1: 1 });
    expect(m.crate[1].claimedBy).toBe(0);
    expect(m.player(1)!.claim).toBe(-1);
    click(m, { kb0: 2, kb1: 2, kb2: 0 });
    expect(m.player(0)!.claim).toBe(1); // already holds one: the second click does nothing
    expect(m.crate[2].claimedBy).toBe(1);
    expect(m.crate[0].claimedBy).toBe(2);
    expect(m.crate.filter((c) => c.claimedBy >= 0)).toHaveLength(3);
  });

  it('rolls a roster part of the card’s role, the same way for the same inputs', () => {
    const rolls = () => {
      const m = inPick(4);
      const roster = generateRoster(m.seed, rosterSize(m.crate.length));
      click(m, { kb0: 0, kb1: 1, kb2: 2, kb3: 3 });
      return m.crate.slice(0, 4).map((c) => {
        const part = roster.find((p) => p.id === c.def.part)!;
        expect(part, c.def.name).toBeDefined();
        expect(c.def.role).toBe(c.secret);
        expect(part.role).toBe(c.secret);
        expect(part.variants.map((v) => v.name)).toContain(c.def.name);
        return c.def;
      });
    };
    expect(rolls()).toEqual(rolls());
  });

  it('can’t be told from the crate: the same card rolls different parts at different moments', () => {
    const seen = new Set<string>();
    for (let wait = 0; wait < 30; wait++) {
      const m = inPick(1);
      const i = m.crate.findIndex((c) => c.secret === 'hazard');
      for (let f = 0; f < wait; f++) m.step({});
      click(m, { kb0: i });
      seen.add(m.crate[i].def.part!);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('stays in its role, and leans toward the parts that unstick a match after dry rounds, like the crate', () => {
    const count = (roster: Part[], dry: number, role: Role) => {
      const rng = new Rng(9);
      const hits = new Map<string, number>();
      for (let i = 0; i < 600; i++) {
        const def = rollSecret(rng, roster, role, dry, []);
        hits.set(def.part!, (hits.get(def.part!) ?? 0) + 1);
      }
      return hits;
    };
    let leaned = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const roster = generateRoster(seed, rosterSize(6));
      for (const role of ['hazard', 'build', 'utility', 'demolish'] as const) {
        const parts = roster.filter((p) => p.role === role);
        expect(parts.length, `${seed} ${role}`).toBeGreaterThan(0);
        for (const id of count(roster, 0, role).keys()) expect(parts.map((p) => p.id)).toContain(id);
        const pushed = parts.find((p) => parts.some((q) => dryLean(p.archetype, 5) > dryLean(q.archetype, 5)));
        const other = parts.find((q) => pushed && dryLean(pushed.archetype, 5) > dryLean(q.archetype, 5));
        if (!pushed || !other) continue;
        const share = (h: Map<string, number>) => (h.get(pushed.id) ?? 0) / ((h.get(other.id) ?? 0) + 1);
        expect(share(count(roster, 5, role)), `${seed} ${role}`).toBeGreaterThan(share(count(roster, 0, role)));
        leaned++;
      }
    }
    expect(leaned).toBeGreaterThan(3);
  });
});

describe('every peer rolls the same secret part', () => {
  it('over a 3-peer loopback room, and a snapshot carries it', () => {
    const hub = new LoopbackHub({ latency: 40, jitter: 10, seed: 5 });
    const peers = new Map<string, NetSession>();
    const join = (id: string) => {
      const s = new NetSession({ transport: hub.transport(id), match: new Match(roomSeed('SECRET')), now: () => hub.now });
      peers.set(id, s);
      return s;
    };
    const tick = (inputs: Record<string, Record<string, InputFrame>> = {}) => {
      hub.advance(TICK);
      for (const [id, s] of peers) {
        s.tick(inputs[id] ?? {});
        void s.view;
        s.drainEvents();
      }
    };
    const run = (n: number) => {
      for (let i = 0; i < n; i++) tick();
    };
    const a = join('aaaa');
    run(5);
    const b = join('bbbb');
    run(5);
    const c = join('cccc');
    run(30);
    a.act({ t: 'rules', rules: { ...DEFAULT_RULES, secretParts: true } });
    const ready = press({ confirmPressed: true });
    tick({ aaaa: { kb1: ready }, bbbb: { kb1: ready }, cccc: { kb1: ready } });
    run(30);
    tick({ aaaa: { kb1: ready }, bbbb: { kb1: ready }, cccc: { kb1: ready } });
    for (let i = 0; i < 90 && a.match.phase !== 'pick'; i++) tick();
    run(40);
    for (const s of peers.values()) {
      expect(s.match.phase).toBe('pick');
      expect(s.match.crate.every((x) => x.secret)).toBe(true);
    }
    const at = (i: number) => press({ pointer: middle(a.match, i), confirmPressed: true });
    tick({ bbbb: { kb1: at(0) }, cccc: { kb1: at(0) } }); // a race for one card
    run(3);
    tick({ aaaa: { kb1: at(1) } });
    run(40);
    const loser = [b, c].find((s) => s.match.players.find((p) => p.device.startsWith(s === b ? 'bbbb' : 'cccc'))!.claim < 0)!;
    tick({ [loser === b ? 'bbbb' : 'cccc']: { kb1: at(2) } });
    run(40);
    const host = [...peers.values()].find((s) => s.isHost)!;
    host.flush();
    for (let i = 0; i < 200; i++) {
      hub.advance(TICK);
      for (const s of peers.values()) if (s !== host) s.tick({});
    }
    const defs = (s: NetSession) => s.match.crate.map((x) => (x.claimedBy >= 0 ? x.def : null));
    expect(defs(a).filter(Boolean)).toHaveLength(3);
    for (const s of peers.values()) {
      expect(defs(s)).toEqual(defs(a));
      expect(hashMatch(s.match)).toBe(hashMatch(host.match));
    }
    const copy = new Match(a.match.seed);
    restoreMatch(copy, cloneSnap(snapshotMatch(a.match)));
    expect(copy.crate).toEqual(a.match.crate);
    expect(copy.rules.secretParts).toBe(true);
    expect(hashMatch(copy)).toBe(hashMatch(a.match));
  });
});

describe('winnability with secret parts', () => {
  /** A level whose recorded solution takes `n` parts. */
  function levelNeeding(n: number) {
    for (let i = 0; i < 300; i++) {
      const seed = (i * 2654435761 + 91) >>> 0;
      const level = generateLevel(seed, 'farm', { size: 'classic' });
      if (level.solution?.length === n) return { seed, level };
    }
    throw new Error(`no level needing ${n} parts`);
  }

  it('offers a build card for every bridge the plan needs, and claiming them all yields the bridges', () => {
    for (let s = 1; s <= 12; s++) {
      const m = inPick(8, s * 7919);
      const need = m.plan.length;
      const builds = m.crate.map((c, i) => (c.secret === 'build' ? i : -1)).filter((i) => i >= 0);
      expect(builds.length).toBeGreaterThanOrEqual(Math.min(need, m.crate.length - 1));
      builds.slice(0, 8).forEach((i, k) => {
        m.players[k].cursor = middle(m, i);
      });
      m.step(Object.fromEntries(builds.slice(0, 8).map((_, k) => [`kb${k}`, press({ confirmPressed: true })])));
      const bridges = builds.filter((i) => isBridgePart(m.crate[i].def)).length;
      expect(bridges, `seed ${m.seed}`).toBeGreaterThanOrEqual(need);
    }
  });

  it('a solo match on a two-part level gets its bridges from build cards and then needs none', { timeout: 60_000 }, () => {
    const { seed, level } = levelNeeding(2);
    const m = new Match(seed, 'farm', SECRET);
    m.forceProfile = { size: 'classic' };
    m.newLevel(seed, 'farm');
    m.join('kb0');
    m.startMatch();
    const p = m.players[0];
    const step = (i: Partial<InputFrame> = {}) => m.step({ kb0: press(i) });
    for (const spot of level.solution!) {
      for (let f = 0; f < 30 && m.phase !== 'pick'; f++) step();
      const i = m.crate.findIndex((c) => c.secret === 'build');
      expect(i).toBeGreaterThanOrEqual(0);
      p.cursor = middle(m, i);
      for (let f = 0; f < 60 && m.phase === 'pick'; f++) step({ confirmPressed: f === 15 });
      expect(isBridgePart(m.crate[i].def)).toBe(true);
      expect(m.phase).toBe('place');
      p.cursor = { x: (spot.x + 1.5) * TILE, y: (spot.y + 0.5) * TILE };
      for (let f = 0; f < 60 && m.phase === 'place'; f++) step({ confirmPressed: f === 15 });
      for (let f = 0; f < 400 && m.phase === 'run'; f++) step({ altPressed: f === 100 });
      for (let f = 0; f < 900 && m.phase === 'score'; f++) step({ confirmPressed: f % 30 === 29 });
    }
    expect(m.placed.length).toBe(2);
    expect(partsNeeded(m.level, m.placed)).toBe(0);
  });
});
