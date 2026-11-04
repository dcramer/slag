import { describe, expect, it } from 'vitest';
import { BotSeats } from '../src/brain/bots';
import { isBotDevice } from '../src/brain/device';
import { Match } from '../src/game/match';
import { DEFAULT_RULES } from '../src/game/rules';
import { roomSeed } from '../src/game/room';
import { NetSession } from '../src/net/session';
import { hashMatch } from '../src/net/snapshot';
import { LoopbackHub } from '../src/net/transport';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/**
 * Bot seats online belong to the room, and the host runs them (DESIGN.md → Bots: "when the host leaves, its bot seats
 * move with the room and their brains start fresh on the new host"). Each peer here runs a BotSeats beside its
 * session, as game-client.ts does.
 */

const TICK = 1000 / 60;
const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });
const FAST = { ...DEFAULT_RULES, targetScore: 80, maxRounds: 25, pickSeconds: 10, placeSeconds: 15, raceSeconds: 30 };

/** Ready when told to, click a free card, run right, skip scores. */
function person(s: NetSession, f: number, ready: boolean): Record<string, InputFrame> {
  const m = s.match;
  const me = m.players.find((p) => p.device === s.globalDevice('kb1'));
  if (m.phase === 'lobby') return ready && me && !me.ready && f % 20 === 0 ? { kb1: press({ confirmPressed: true }) } : {};
  if (m.phase === 'pick') {
    const card = m.crate.find((c) => c.claimedBy < 0);
    return card ? { kb1: press({ pointer: { x: card.rect.x + 8, y: card.rect.y + 8 }, confirmPressed: f % 15 === 0 }) } : {};
  }
  if (m.phase === 'run') return { kb1: press({ right: true, jump: f % 30 < 15, jumpPressed: f % 30 === 0 }) };
  return { kb1: press({ pointer: { x: 100 + (f % 600), y: 60 + (f % 300) }, confirmPressed: f % 30 === 0 }) };
}

class Room {
  hub = new LoopbackHub({ latency: 30, jitter: 10, seed: 5 });
  peers = new Map<string, { s: NetSession; bots: BotSeats; play: boolean }>();
  frame = 0;
  /** People ready up in the lobby (bots ready themselves). */
  ready = false;

  join(id: string, play = true): NetSession {
    const s = new NetSession({ transport: this.hub.transport(id), match: new Match(roomSeed('BOTS')), now: () => this.hub.now });
    this.peers.set(id, { s, bots: new BotSeats(), play });
    return s;
  }

  /** The host's Add Bot, as game-client.ts does it. */
  addBot(id: string): string {
    const { s, bots } = this.peers.get(id)!;
    const dev = s.globalDevice(bots.add(s.match));
    s.act({ t: 'join', dev });
    return dev;
  }

  leave(id: string) {
    this.peers.get(id)!.s.close();
    this.peers.delete(id);
  }

  run(ticks: number) {
    for (let i = 0; i < ticks; i++) {
      this.hub.advance(TICK);
      for (const { s, bots, play } of this.peers.values()) {
        const frames = play ? person(s, this.frame, this.ready) : {};
        Object.assign(
          frames,
          bots.frames(s.match, (d) => s.globalDevice(d)),
        );
        s.tick(frames);
        void s.view;
        s.drainEvents();
      }
      this.frame++;
    }
  }

  until(what: () => boolean, max: number) {
    for (let i = 0; i < max && !what(); i++) this.run(1);
    expect(what()).toBe(true);
  }

  get(id: string) {
    return this.peers.get(id)!.s;
  }

  /** Freeze the host, let guests drain, compare. */
  hashes() {
    const h = [...this.peers.values()].find((p) => p.s.isHost)!.s;
    for (let i = 0; i < 120; i++) {
      if (i % 20 === 0) h.flush();
      this.hub.advance(TICK);
      for (const { s } of this.peers.values()) if (s !== h) s.tick({});
    }
    return new Set([...this.peers.values()].map(({ s }) => `${s.match.frame}:${hashMatch(s.match)}`));
  }
}

const bots = (s: NetSession) => s.match.players.filter((p) => isBotDevice(p.device));

/** Host aaaa with two bots, and two guests. */
function roomWithBots() {
  const r = new Room();
  const a = r.join('aaaa');
  a.act({ t: 'rules', rules: FAST });
  r.run(5);
  r.join('bbbb');
  r.run(5);
  r.join('cccc');
  r.run(60);
  r.addBot('aaaa');
  r.run(10);
  r.addBot('aaaa');
  r.run(60);
  expect(bots(r.get('cccc'))).toHaveLength(2);
  return r;
}

describe('bot seats online', () => {
  it('move to the new host when the host leaves the lobby, and play on from there', () => {
    const r = roomWithBots();
    const names = bots(r.get('cccc')).map((p) => p.character.name);
    r.leave('aaaa');
    r.run(240);
    const b = r.get('bbbb');
    expect(b.isHost).toBe(true);
    expect(bots(b).map((p) => p.character.name)).toEqual(names);
    expect(bots(b).every((p) => p.device.startsWith('bbbb:'))).toBe(true);
    // Their brains run on the new host: they ready up, and the match starts with them in it.
    r.ready = true;
    r.until(() => b.match.phase === 'pick', 3000);
    expect(bots(b)).toHaveLength(2);
    expect(r.hashes().size).toBe(1);
  });

  it('move to the new host when the host crashes mid-race, never away, and keep racing', () => {
    const r = roomWithBots();
    const c = r.get('cccc');
    r.ready = true;
    r.until(() => c.match.phase === 'run', 6000);
    r.run(60);
    r.leave('aaaa');
    r.run(240);
    expect(r.get('bbbb').isHost).toBe(true);
    expect(bots(c)).toHaveLength(2);
    expect(bots(c).every((p) => p.device.startsWith('bbbb:') && !p.away)).toBe(true);
    // Driven again: their last input is recent.
    const at = c.match.frame;
    r.run(120);
    if (c.match.phase === 'run') expect(bots(c).some((p) => p.lastInput > at)).toBe(true);
    expect(r.hashes().size).toBe(1);
  });

  it("stay seated when the host starts watching, run by whoever hosts next, and the old host's stale inputs never reseat them", () => {
    const r = roomWithBots();
    const a = r.get('aaaa');
    const c = r.get('cccc');
    const before = bots(c).map((p) => p.slot);
    r.peers.get('aaaa')!.play = false;
    a.watch();
    r.run(30);
    expect(a.seated).toBe(false);
    expect(bots(c).map((p) => p.slot)).toEqual(before);
    // No human seat: the watcher steps behind the players, and the room and its bots go to the next in line.
    r.until(() => r.get('bbbb').isHost && bots(c).every((p) => p.device.startsWith('bbbb:')), 1200);
    r.run(120);
    expect(c.match.players.map((p) => p.device).sort()).toEqual(['bbbb:bot1', 'bbbb:bot2', 'bbbb:kb1', 'cccc:kb1']);
    expect(a.watching).toBeDefined();
    r.ready = true;
    r.until(() => c.match.phase === 'pick', 3000);
    expect(r.hashes().size).toBe(1);
  });

  it('input for a bot seat that moved never seats it again under its old device (a lobby confirm would)', () => {
    const r = roomWithBots();
    const c = r.get('cccc');
    // What a host that just handed its bots over still sends for a few frames: its old bot's ready presses.
    const { s } = r.peers.get('bbbb')!;
    const tick = s.tick.bind(s);
    s.tick = (local) => tick({ ...local, bot9: press({ confirmPressed: r.frame % 10 === 0 }) });
    r.run(120);
    expect(c.match.players.some((p) => p.device === 'bbbb:bot9')).toBe(false);
    expect(r.hashes().size).toBe(1);
  });

  it('a watching host with bots can take a seat again', () => {
    const r = roomWithBots();
    const a = r.get('aaaa');
    a.watch();
    r.run(30);
    a.play();
    r.run(60);
    expect(a.seated).toBe(true);
    expect(a.seatAsk).toBe('won');
  });
});
