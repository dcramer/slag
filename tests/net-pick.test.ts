import { DEFAULT_RULES } from '../src/game/rules';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { generateProp } from '../src/gen/props';
import { decode, encode, held, INPUT_KEYS, merge } from '../src/net/codec';
import { Predictor } from '../src/net/predict';
import { NetSession } from '../src/net/session';
import { hashMatch, snapshotMatch } from '../src/net/snapshot';
import { LoopbackHub } from '../src/net/transport';
import { mountCells, type PropDef } from '../src/sim/props';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const TICK = 1000 / 60;
const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** A linked room, driven per tick with one input function per peer. */
class Room {
  hub: LoopbackHub;
  peers = new Map<string, NetSession>();
  constructor(latency = 40) {
    this.hub = new LoopbackHub({ latency, jitter: 10, seed: 5 });
  }
  join(id: string) {
    const s = new NetSession({ transport: this.hub.transport(id), match: new Match(roomSeed('TEST')), now: () => this.hub.now });
    this.peers.set(id, s);
    return s;
  }
  tick(inputs: Record<string, Record<string, InputFrame>> = {}) {
    this.hub.advance(TICK);
    for (const [id, s] of this.peers) {
      s.tick(inputs[id] ?? {});
      void s.view;
      s.drainEvents();
    }
  }
  run(n: number) {
    for (let i = 0; i < n; i++) this.tick();
  }
}

/** Three seated peers, in pick: `after` frames after the host got there (the guests a little less). */
function inPick(after = 40) {
  const r = new Room();
  const a = r.join('aaaa');
  r.run(5);
  const b = r.join('bbbb');
  r.run(5);
  const c = r.join('cccc');
  r.run(30);
  a.act({ t: 'rules', rules: { ...DEFAULT_RULES, targetScore: 80, maxRounds: 25, pickSeconds: 10, placeSeconds: 15, raceSeconds: 30 } });
  r.run(30);
  const ready = press({ confirmPressed: true });
  r.tick({ aaaa: { kb1: ready }, bbbb: { kb1: ready }, cccc: { kb1: ready } });
  for (let i = 0; i < 90 && !a.match.canStart(); i++) r.tick();
  a.act({ t: 'start' });
  for (let i = 0; i < 90 && a.match.phase !== 'pick'; i++) r.tick();
  r.run(after);
  if (after >= 40) expect(c.match.phase).toBe('pick');
  return { r, a, b, c };
}

const center = (s: NetSession, i: number) => {
  const c = s.match.crate[i].rect;
  return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
};
const mine = (s: NetSession, peer: string) => s.match.players.find((p) => p.device === `${peer}:kb1`)!;

describe('the claim gate', () => {
  it('a guest marks a click pending only when the host takes it: shut at the start of pick for both, then open for both', () => {
    const seen: { wait: number; pending: boolean; claimed: boolean }[] = [];
    for (const wait of [0, 4, 8, 14]) {
      const { r, a, b } = inPick(0);
      while (b.match.phase !== 'pick') r.tick();
      r.run(wait);
      const at = center(a, 2);
      let pending = false;
      r.tick({ bbbb: { kb1: press({ pointer: at, confirmPressed: true }) } });
      for (let i = 0; i < 40; i++) {
        pending ||= b.pendingCard === 2;
        r.tick();
      }
      const claimed = a.match.crate[2].claimedBy === mine(a, 'bbbb').slot;
      seen.push({ wait, pending, claimed });
      if (pending) expect(claimed, `wait ${wait}`).toBe(true);
    }
    expect(seen[0]).toMatchObject({ pending: false, claimed: false });
    expect(seen.at(-1)).toMatchObject({ pending: true, claimed: true });
  });
});

describe('claim races', () => {
  it('two peers clicking one card in the same tick: one winner everywhere, and the loser never sees it as theirs', () => {
    const { r, a, b, c } = inPick();
    const at = center(a, 0);
    const click = press({ pointer: at, confirmPressed: true });
    // Same tick on both guests: only host sequence decides.
    r.tick({ bbbb: { kb1: click }, cccc: { kb1: click } });
    const owners = new Set<number>();
    for (let i = 0; i < 40; i++) {
      r.tick();
      for (const s of [a, b, c]) {
        const seen = s.view.crate[0].claimedBy;
        if (seen >= 0) owners.add(seen);
      }
    }
    expect(owners.size).toBe(1);
    const winner = [...owners][0];
    for (const s of [a, b, c]) {
      expect(s.match.crate[0].claimedBy).toBe(winner);
      expect(s.match.players.filter((p) => p.claim === 0)).toHaveLength(1);
    }
    a.flush();
    for (let i = 0; i < 30; i++) {
      r.hub.advance(TICK);
      for (const s of [b, c]) s.tick({});
    }
    expect(new Set([a, b, c].map((s) => `${s.match.frame}:${hashMatch(s.match)}`)).size).toBe(1);
  });

  it('the click the host hears first wins, whichever peer clicked first on its own clock', () => {
    const { r, a, b, c } = inPick();
    const at = center(a, 1);
    r.tick({ cccc: { kb1: press({ pointer: at, confirmPressed: true }) } });
    r.run(1);
    r.tick({ bbbb: { kb1: press({ pointer: at, confirmPressed: true }) } });
    r.run(40);
    expect(mine(a, 'cccc').claim).toBe(1);
    expect(mine(a, 'bbbb').claim).toBe(-1);
    expect(mine(b, 'bbbb').claim).toBe(-1);
    expect(a.match.crate[1].claimedBy).toBe(mine(c, 'cccc').slot);
  });

  it('a guest sees its click as pending, never as a claim, until the host rules', () => {
    const { r, a, b } = inPick();
    const at = center(a, 2);
    r.tick({ bbbb: { kb1: press({ pointer: at, confirmPressed: true }) } });
    expect(b.pendingCard).toBe(2);
    expect(b.view.crate[2].claimedBy).toBe(-1);
    expect(b.view.players.find((p) => p.device === 'bbbb:kb1')!.claim).toBe(-1);
    r.run(40);
    expect(b.pendingCard).toBe(-1);
    expect(b.match.crate[2].claimedBy).toBe(mine(b, 'bbbb').slot);
  });

  it('the loser of a race is left with no pending mark', () => {
    const { r, a, b, c } = inPick();
    const at = center(a, 0);
    const click = press({ pointer: at, confirmPressed: true });
    r.tick({ bbbb: { kb1: click }, cccc: { kb1: click } });
    r.run(40);
    expect(b.pendingCard).toBe(-1);
    expect(c.pendingCard).toBe(-1);
  });

  it('time running out mid-race hands out each card once, identically on every peer', () => {
    const { r, a, b, c } = inPick();
    while (a.match.phaseTimeLeft > 3) r.tick();
    const at = center(a, 0);
    r.tick({ bbbb: { kb1: press({ pointer: at, confirmPressed: true }) } });
    r.tick({ cccc: { kb1: press({ pointer: at, confirmPressed: true }) } });
    r.run(30);
    const claims = a.match.players.map((p) => p.claim);
    expect(claims.every((i) => i >= 0)).toBe(true);
    expect(new Set(claims).size).toBe(claims.length);
    for (const s of [b, c]) expect(s.match.players.map((p) => p.claim)).toEqual(claims);
  });
});

describe('live cursors', () => {
  it('a remote cursor needs no click and glides, without touching match state', () => {
    const { r, a } = inPick();
    const start = mine(a, 'bbbb').cursor.x;
    const target = { x: start > 300 ? 100 : 700, y: 300 };
    r.tick({ bbbb: { kb1: press({ pointer: target }) } });
    while (mine(a, 'bbbb').cursor.x !== target.x) r.tick();
    // The sim jumped straight there; what's drawn is on its way.
    const drawn = () => a.view.players.find((p) => p.device === 'bbbb:kb1')!.cursor.x;
    expect(Math.abs(drawn() - target.x)).toBeGreaterThan(1);
    expect(Math.abs(drawn() - start)).toBeGreaterThan(1);
    expect(mine(a, 'bbbb').cursor).toEqual(target);
    r.run(30);
    expect(Math.abs(drawn() - target.x)).toBeLessThan(1);
  });

  it("a guest's own cursor doesn't wait for the host; the sim does", () => {
    const { r, b } = inPick();
    const before = { ...mine(b, 'bbbb').cursor };
    const target = { x: 123, y: 234 };
    r.tick({ bbbb: { kb1: press({ pointer: target }) } });
    expect(b.view.players.find((p) => p.device === 'bbbb:kb1')!.cursor).toEqual(target);
    expect(mine(b, 'bbbb').cursor).toEqual(before);
  });

  it('keyboard and gamepad cursors move remotely too, and keep moving while held', () => {
    const { r, a } = inPick();
    const start = mine(a, 'bbbb').cursor.x;
    for (let i = 0; i < 30; i++) r.tick({ bbbb: { kb1: press({ right: true }) } });
    r.run(10);
    expect(mine(a, 'bbbb').cursor.x).toBeGreaterThan(start);
  });
});

describe('remote ghosts', () => {
  it('every peer sees every held part, with its rotation and validity', () => {
    const { r, a, b, c } = inPick();
    r.tick({ aaaa: { kb1: press({ pointer: center(a, 0), confirmPressed: true }) } });
    r.tick({ bbbb: { kb1: press({ pointer: center(a, 1), confirmPressed: true }) } });
    r.tick({ cccc: { kb1: press({ pointer: center(a, 2), confirmPressed: true }) } });
    for (let i = 0; i < 90 && c.match.phase !== 'place'; i++) r.tick();
    r.run(30);
    expect(c.match.phase).toBe('place');
    r.tick({ bbbb: { kb1: press({ pointer: { x: 400, y: 200 }, altPressed: true }) } });
    r.run(30);
    const pa = a.view.players.find((p) => p.device === 'bbbb:kb1')!;
    const pc = c.view.players.find((p) => p.device === 'bbbb:kb1')!;
    expect(pa.rot).toBe(1);
    expect(pc.rot).toBe(1);
    expect(c.view.ghostOrigin(pc)).toEqual(a.view.ghostOrigin(pa));
    expect(c.view.canPlaceFor(pc)).toBe(a.view.canPlaceFor(pa));
    expect(b.view.ghostOrigin(b.view.players.find((p) => p.device === 'aaaa:kb1')!)).not.toBeNull();
  });

  it('every peer sees and places the same trimmed attachment', () => {
    const { r, a, b, c } = inPick();
    r.tick({ aaaa: { kb1: press({ pointer: center(a, 0), confirmPressed: true }) } });
    r.tick({ bbbb: { kb1: press({ pointer: center(a, 1), confirmPressed: true }) } });
    r.tick({ cccc: { kb1: press({ pointer: center(a, 2), confirmPressed: true }) } });
    for (let i = 0; i < 90 && c.match.phase !== 'place'; i++) r.tick();
    r.run(30);
    expect(c.match.phase).toBe('place');
    // B's card becomes a strip, on every peer alike, and B aims it where only part of it mounts.
    let strip: PropDef | null = null;
    for (let i = 0; i < 200 && !strip; i++) {
      const d = generateProp(new Rng(i), 'spikestrip', 'x');
      if (d.footprint.length === 5) strip = d;
    }
    const claim = mine(a, 'bbbb').claim;
    for (const s of [a, b, c]) s.match.crate[claim].def = strip!;
    let spot: { x: number; y: number; kept: number } | null = null;
    for (let ty = 2; ty < a.match.level.h - 2 && !spot; ty++) {
      for (let tx = 6; tx < a.match.level.w - 6 && !spot; tx++) {
        const kept = mountCells(a.match.level, a.match.placed, strip!, 0, tx, ty).length;
        if (kept > 0 && kept < 5) spot = { x: (tx + 1.5) * 16 + 8, y: ty * 16 + 8, kept };
      }
    }
    expect(spot).not.toBeNull();
    const pointer = { x: spot!.x, y: spot!.y };
    r.tick({ bbbb: { kb1: press({ pointer }) } });
    r.run(60);
    const ghost = (s: NetSession) => s.view.ghostOrigin(s.view.players.find((p) => p.device === 'bbbb:kb1')!)!;
    const landing = ghost(a);
    expect(landing.def.footprint).toHaveLength(spot!.kept);
    expect(ghost(c)).toEqual(landing);
    expect(ghost(b)).toEqual(landing);
    r.tick({ bbbb: { kb1: press({ pointer, confirmPressed: true }) } });
    r.run(60);
    for (const s of [a, b, c]) expect(s.match.placed.map((p) => p.def)).toEqual([landing.def]);
    a.flush();
    for (let i = 0; i < 30; i++) {
      r.hub.advance(TICK);
      for (const s of [b, c]) s.tick({});
    }
    expect(new Set([a, b, c].map((s) => `${s.match.frame}:${hashMatch(s.match)}`)).size).toBe(1);
  });
});

/** Two seated peers mid-race, with a round trip long enough for prediction to go wrong. */
function inRace(latency: number) {
  const r = new Room(latency);
  const a = r.join('aaaa');
  r.run(5);
  const b = r.join('bbbb');
  r.run(Math.ceil(latency / 8) + 30);
  a.act({ t: 'rules', rules: { ...DEFAULT_RULES, targetScore: 80, maxRounds: 25, pickSeconds: 10, placeSeconds: 15, raceSeconds: 0 } });
  r.run(30);
  const ready = press({ confirmPressed: true });
  r.tick({ aaaa: { kb1: ready }, bbbb: { kb1: ready } });
  for (let i = 0; i < 90 && !a.match.canStart(); i++) r.tick();
  a.act({ t: 'start' });
  for (let i = 0; i < 3000 && (a.match.phase as string) !== 'run'; i++) r.tick();
  for (let i = 0; i < 80; i++) r.tick({ aaaa: { kb1: press({}) } });
  expect(a.match.phase).toBe('run');
  return { r, a, b };
}

describe('watching a remote runner', () => {
  /** A jump's take-off is about 6 px a frame. Twice that on screen is a teleport. */
  const MAX_STEP = 12;

  it('never teleports when a jump lands late, and the sim is untouched', () => {
    const { r, a, b } = inRace(50);
    const slot = mine(a, 'aaaa').slot;
    const drawnY = () => b.view.run!.runners.find((x) => x.slot === slot)!.body.y;
    // Prediction can't know a jump is coming, so the runner stays grounded for a round trip, then is already in the air.
    const steps: number[] = [];
    let last = drawnY();
    const rest = last;
    let top = last;
    for (let i = 0; i < 50; i++) {
      r.tick({ aaaa: { kb1: press({ jump: i < 20, jumpPressed: i === 0 }) } });
      const y = drawnY();
      steps.push(Math.abs(y - last));
      top = Math.min(top, y);
      last = y;
    }
    expect(rest - top).toBeGreaterThan(30);
    expect(Math.max(...steps)).toBeLessThan(MAX_STEP);
    for (let i = 0; i < 40; i++) r.tick();
    a.flush();
    for (let i = 0; i < 30; i++) {
      r.hub.advance(TICK);
      b.tick({});
    }
    expect(hashMatch(b.match)).toBe(hashMatch(a.match));
  });

  it('folds a host queue that stays long, so a burst costs one moment and not lasting lag', () => {
    const { r, a } = inRace(20);
    const queue = (a as any).queues.get('bbbb');
    queue.frames = Array.from({ length: 30 }, (_, i) => ({ seq: queue.consumed + i + 1, f: {}, at: r.hub.now }));
    r.run(20);
    expect(queue.frames.length).toBeLessThanOrEqual(4);
  });

  it('survives a lost bundle without waiting on a resend', () => {
    const { r, a, b } = inRace(20);
    let needs = 0;
    const send = (b as any).send.bind(b);
    (b as any).send = (m: { t: string }, to?: string, lossy?: boolean) => {
      if (m.t === 'need') needs++;
      send(m, to, lossy);
    };
    const hub = r.hub as any;
    const route = hub.route.bind(hub);
    let dropped = 0;
    hub.route = (from: string, data: { t: string }, to?: string) => {
      if (from === 'aaaa' && data.t === 'b' && dropped++ % 7 === 3) return;
      route(from, data, to);
    };
    r.run(120);
    hub.route = route;
    r.run(30);
    expect(dropped).toBeGreaterThan(20);
    expect(needs).toBe(0);
    expect(a.match.frame - b.match.frame).toBeLessThan(6);
  });

  it('survives a burst of lost bundles without waiting on a resend', () => {
    const { r, a, b } = inRace(40);
    let needs = 0;
    const send = (b as any).send.bind(b);
    (b as any).send = (m: { t: string }, to?: string, lossy?: boolean) => {
      if (m.t === 'need') needs++;
      send(m, to, lossy);
    };
    const hub = r.hub as any;
    const route = hub.route.bind(hub);
    let sent = 0;
    // Eight in a row lost, every second: what a congested or fading link does.
    hub.route = (from: string, data: { t: string }, to?: string, lossy?: boolean) => {
      if (from === 'aaaa' && data.t === 'b' && sent++ % 60 < 8) return;
      route(from, data, to, lossy);
    };
    r.run(240);
    hub.route = route;
    r.run(30);
    expect(needs).toBe(0);
    expect(a.match.frame - b.match.frame).toBeLessThan(6);
  });
});

describe('input codec', () => {
  it('carries every input field: a new one must not silently vanish online', () => {
    const block = /interface InputFrame \{([\s\S]*?)\n\}/.exec(readFileSync('src/sim/types.ts', 'utf8'))![1];
    const fields = [...block.matchAll(/^ {2}(\w+)\??: boolean;/gm)].map((m) => m[1]);
    expect(new Set(INPUT_KEYS), 'add the new InputFrame field to INPUT_KEYS in src/net/codec.ts (and PRESSED if it is an edge)').toEqual(new Set(fields));
    for (const k of INPUT_KEYS) expect(decode(encode({ ...NO_INPUT, [k]: true }))[k]).toBe(true);
  });

  it('keeps every one-frame edge when frames fold, and never repeats one', () => {
    for (const k of ['jumpPressed', 'confirmPressed', 'altPressed', 'downPressed', 'usePressed'] as const) {
      expect(decode(merge(encode(press({ [k]: true })), encode(press({}))))[k]).toBe(true);
      expect(decode(held(encode(press({ [k]: true }))))[k]).toBeFalsy();
    }
  });

  it('keeps run held when a queue runs dry, and rounds the pointer for the wire', () => {
    expect(decode(held(encode(press({ run: true, right: true, jumpPressed: true })))).run).toBe(true);
    expect(decode(held(encode(press({ jumpPressed: true })))).jumpPressed).toBe(false);
    expect(decode(encode(press({ pointer: { x: 10.4, y: 20.6 } }))).pointer).toEqual({ x: 10, y: 21 });
  });
});

describe('prediction copy', () => {
  it('steps exactly like the real match and shares no state with it', () => {
    const m = new Match(roomSeed('TEST'));
    for (const d of ['a:kb1', 'b:kb1']) m.join(d);
    m.startMatch();
    for (let i = 0; i < 2000 && m.phase !== 'run'; i++) {
      const pointer = { x: 100 + ((i * 7) % 560), y: 120 + ((i * 11) % 200) };
      m.step(Object.fromEntries(['a:kb1', 'b:kb1'].map((d) => [d, press({ pointer, confirmPressed: i % 13 === 0 })])));
    }
    expect(m.phase).toBe('run');
    for (let i = 0; i < 300; i++) m.step({ 'a:kb1': press({ right: true, run: true }), 'b:kb1': press({ right: true }) });
    const before = hashMatch(m);
    const p = new Predictor();
    const copy = p.copy(m);
    const inputs = { 'a:kb1': press({ right: true, run: true, jump: true, jumpPressed: true }), 'b:kb1': press({ left: true }) };
    for (let i = 0; i < 24; i++) copy.step(inputs);
    expect(hashMatch(m)).toBe(before);
    // Nested race state (status effects and the like) can't be shared with the copy.
    expect(copy.run!.runners[0].status).not.toBe(m.run!.runners[0].status);
    expect(copy.run!.runners[0].body).not.toBe(m.run!.runners[0].body);
    for (let i = 0; i < 24; i++) m.step(inputs);
    expect(JSON.stringify(snapshotMatch(copy).run)).toBe(JSON.stringify(snapshotMatch(m).run));
  });
});
