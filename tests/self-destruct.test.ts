import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { DEFAULT_RULES } from '../src/game/rules';
import { roomSeed } from '../src/game/room';
import { TouchInput, touchLayout } from '../src/input/touch';
import { decode, encode, held, merge } from '../src/net/codec';
import { NetSession } from '../src/net/session';
import { LoopbackHub } from '../src/net/transport';
import { FPS, POP_HOLD, RUN_COUNTDOWN } from '../src/sim/constants';
import { popCountdown } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });
const HOLD = press({ alt: true });
const PRESS = press({ alt: true, altPressed: true });

/** A solo match past its countdown, the runner standing on the spawn pad. */
function racing(seed = 7): Match {
  const m = new Match(seed);
  m.join('kb1');
  m.startMatch();
  m.startRun();
  while (m.run!.frame < RUN_COUNTDOWN) m.step({});
  return m;
}

/** Step with `inp` until the runner dies or `max` frames pass; the race frame it died on, or -1. */
function holdFor(m: Match, max: number, inp: (i: number) => InputFrame): number {
  const r = m.run!.runners[0];
  for (let i = 0; i < max && r.alive; i++) m.step({ kb1: inp(i) });
  return r.alive ? -1 : r.deathFrame;
}

describe('self-destruct', () => {
  it('pops after POP_HOLD frames of a fresh hold, not a frame sooner', () => {
    const m = racing();
    const r = m.run!.runners[0];
    const start = m.run!.frame;
    holdFor(m, POP_HOLD - 1, (i) => (i === 0 ? PRESS : HOLD));
    expect(r.alive).toBe(true);
    expect(r.pop).toBe(POP_HOLD - 1);
    m.step({ kb1: HOLD });
    expect(r.alive).toBe(false);
    expect(r.cause).toBe('pop');
    expect(r.deathFrame - start).toBe(POP_HOLD - 1);
  });

  it('takes three seconds, counted down 3, 2, 1, each number coming up fresh', () => {
    expect(POP_HOLD).toBe(3 * FPS);
    const shown: number[] = [];
    for (let pop = 1; pop < POP_HOLD; pop++) {
      const { secs, since } = popCountdown(pop);
      if (since === 0 || pop === 1) shown.push(secs);
      expect(since).toBeGreaterThanOrEqual(0);
      expect(since).toBeLessThan(FPS);
    }
    expect(shown).toEqual([3, 2, 1]);
  });

  it('letting go, steering, jumping or using cancels, and the next try needs a fresh press', () => {
    for (const other of [{ alt: false }, { left: true }, { right: true }, { jump: true, jumpPressed: true }, { usePressed: true }]) {
      const m = racing();
      const r = m.run!.runners[0];
      holdFor(m, POP_HOLD - 5, (i) => (i === 0 ? PRESS : HOLD));
      m.step({ kb1: press({ alt: true, ...other }) });
      expect(r.pop, JSON.stringify(other)).toBe(0);
      // Still holding alt afterwards is not a new press: nothing charges.
      expect(holdFor(m, POP_HOLD * 2, () => HOLD)).toBe(-1);
      expect(r.pop).toBe(0);
      // A fresh press starts over from zero.
      const from = m.run!.frame;
      expect(holdFor(m, POP_HOLD * 2, (i) => (i === 0 ? PRESS : HOLD)) - from).toBe(POP_HOLD - 1);
    }
  });

  it('a hold carried over from place (where alt rotates) never counts', () => {
    const m = new Match(7);
    m.rules = { ...DEFAULT_RULES, pickSeconds: 1, placeSeconds: 1 };
    m.join('kb1');
    m.startMatch();
    const p = m.players[0];
    for (let i = 0; i < 200 && m.phase === 'pick'; i++) m.step({});
    expect(m.phase).toBe('place');
    const rot = p.rot;
    m.step({ kb1: PRESS });
    expect(p.rot).toBe((rot + 1) % 4);
    // Hold on through the rest of place, the countdown and well into the race.
    for (let i = 0; i < 200 && m.phase === 'place'; i++) m.step({ kb1: HOLD });
    expect(m.phase).toBe('run');
    expect(holdFor(m, RUN_COUNTDOWN + POP_HOLD * 3, () => HOLD)).toBe(-1);
  });

  it('a held alt crosses the wire as a held bit: repeated on frames with no input, the press edge never is', () => {
    expect(decode(encode(PRESS))).toMatchObject({ alt: true, altPressed: true });
    expect(decode(held(encode(PRESS)))).toMatchObject({ alt: true, altPressed: false });
    const tapped = decode(merge(encode(PRESS), encode(NO_INPUT)));
    expect([!!tapped.alt, tapped.altPressed]).toEqual([false, true]);
  });

  it('pops on the same race frame on every peer', () => {
    const hub = new LoopbackHub({ latency: 40, jitter: 20 });
    const peers: [string, NetSession][] = [];
    const join = (id: string) => peers.push([id, new NetSession({ transport: hub.transport(id), match: new Match(roomSeed('POPS')), now: () => hub.now })]);
    const tick = (script: (id: string, s: NetSession, f: number) => Record<string, InputFrame>) => {
      hub.advance(1000 / 60);
      for (const [id, s] of peers) s.tick(script(id, s, f));
      f++;
    };
    let f = 0;
    // Join, then ready up once both are in.
    const lobby = (_id: string, s: NetSession, n: number): Record<string, InputFrame> => {
      const me = s.match.players.find((q) => q.device === s.globalDevice('kb1'));
      return s.match.phase === 'lobby' && (!me || (!me.ready && s.match.players.length >= 2)) && n % 20 === 0 ? { kb1: press({ confirmPressed: true }) } : {};
    };
    join('aaaa');
    for (let i = 0; i < 5; i++) tick(() => ({}));
    join('bbbb');
    for (let i = 0; i < 40; i++) tick(() => ({}));
    const [, a] = peers[0];
    a.act({ t: 'rules', rules: { ...DEFAULT_RULES, pickSeconds: 10, placeSeconds: 15, raceSeconds: 30 } });
    for (let i = 0; i < 3000 && !(a.match.phase === 'run' && a.match.run!.frame > RUN_COUNTDOWN + 10); i++) tick(lobby);
    expect(a.match.phase).toBe('run');
    // The guest holds self-destruct, through latency and jitter.
    let held = 0;
    for (let i = 0; i < POP_HOLD + 120; i++) tick((id): Record<string, InputFrame> => (id === 'bbbb' ? { kb1: held++ === 0 ? PRESS : HOLD } : {}));
    const slot = a.match.players.find((q) => q.device === 'bbbb:kb1')!.slot;
    const runners = peers.map(([, s]) => s.match.run!.runners.find((r) => r.slot === slot)!);
    expect(runners.map((r) => r.cause)).toEqual(['pop', 'pop']);
    expect(runners[1].deathFrame).toBe(runners[0].deathFrame);
  });
});

describe('self-destruct on touch', () => {
  const W = 844;
  const H = 390;
  const make = () => {
    const t = new TouchInput();
    t.layout = touchLayout(W, H);
    t.setMode('race');
    return t;
  };

  it('a thumb resting on the button while steering never pops, and nor does it once the steering stops', () => {
    const m = racing();
    const r = m.run!.runners[0];
    const t = make();
    const { pop, stickHome: st, stickR } = t.layout;
    t.down(1, st.x, st.y);
    t.move(1, st.x + stickR * 0.5, st.y);
    t.down(2, pop.x, pop.y);
    for (let i = 0; i < POP_HOLD * 2; i++) m.step({ kb1: t.sample() });
    expect(r.alive).toBe(true);
    t.up(1, st.x + stickR * 0.5, st.y);
    for (let i = 0; i < POP_HOLD * 2; i++) m.step({ kb1: t.sample() });
    expect(r.alive).toBe(true);
    // Lift and press again, hands off the stick: that one is meant.
    t.up(2, pop.x, pop.y);
    m.step({ kb1: t.sample() });
    t.down(3, pop.x, pop.y);
    for (let i = 0; i < POP_HOLD && r.alive; i++) m.step({ kb1: t.sample() });
    expect(r.cause).toBe('pop');
  });

  it("the old ALT spot is just jump in a race, and a thumb sliding onto the button doesn't hold it", () => {
    const t = make();
    const { secondary: s, pop } = t.layout;
    t.down(1, s.x, s.y);
    expect(t.sample()).toMatchObject({ jump: true, alt: false, altPressed: false });
    t.up(1, s.x, s.y);
    t.down(2, pop.x, pop.y + pop.r * 3);
    t.move(2, pop.x, pop.y);
    expect(t.sample()).toMatchObject({ alt: false, altPressed: false });
  });
});
