import { describe, expect, it } from 'vitest';
import { runnerBrain } from '../src/brain/brains/runner';
import { BotSeats } from '../src/brain/bots';
import { Grudges } from '../src/brain/grudge';
import { Motor } from '../src/brain/motor';
import { rollPersonality } from '../src/brain/personality';
import { GRUDGE, rollTemperament, TEMPERAMENT_IDS, TEMPERAMENTS, type TemperamentId } from '../src/brain/temperament';
import { Match } from '../src/game/match';
import { TILE } from '../src/sim/constants';
import { BRAIN_VIEW_VERSION, type BrainView, type CardSense, type Intent, type RivalSense } from '../src/brain/types';

/** A view of a small empty level: what the brain is told, with the match left out. */
function view(over: Partial<BrainView>): BrainView {
  return {
    version: BRAIN_VIEW_VERSION,
    phase: 'lobby',
    phaseFrame: 0,
    slot: 0,
    ready: false,
    score: 0,
    level: { w: 24, h: 12, tiles: new Uint8Array(24 * 12), spawn: { tx: 1, ty: 9 }, goal: { tx: 22, ty: 9 }, plan: [] },
    props: [],
    crate: [],
    claim: -1,
    placed: false,
    self: null,
    runners: [],
    rivals: [],
    kills: [],
    live: false,
    canPlace: () => true,
    keepsWay: () => true,
    ...over,
  };
}

const card = (role: CardSense['role'], by = -1): CardSense => ({ claimed: by >= 0, by, role, bridge: false, clears: false });
const CRATE = [card('build'), card('utility'), card('hazard'), card('hazard')];
const rival = (slot: number, over: Partial<RivalSense> = {}): RivalSense => ({ slot, score: 0, hover: -1, cursor: null, ...over });
/** Slot 1 dies at (DEATH, 10): standing there, its trail's heaviest cell. */
const DEATH = 14;

/**
 * A bot of `mood` (spiteful as a Hard bot at its meanest) through one race
 * where `killer`'s part kills it and slot 1 dies at DEATH, then a pick where
 * slot 1 points at card 2 and slot 2 at card 0, and a place holding a hazard
 * with slot 1's cursor at (5, 4): every intent of the pick and the place.
 */
function round(mood: TemperamentId, { killer = 1, scores = [0, 0] }: { killer?: number; scores?: number[] } = {}) {
  const brain = runnerBrain(7, { ...rollPersonality(7, 'hard'), spite: 1 }, TEMPERAMENTS[mood]);
  brain.think(view({}));
  const self = {
    x: 2.5,
    y: 10,
    tx: 2,
    ty: 9,
    pace: 'still',
    lift: 'level',
    facing: 1,
    grounded: true,
    wall: 0,
    alive: true,
    finished: false,
    togo: 20,
    away: 20,
  } as const;
  for (let f = 0; f < 60; f++) {
    const x = 3 + f / 5;
    const dead = x >= DEATH;
    brain.think(
      view({
        phase: 'run',
        phaseFrame: f,
        live: true,
        self: { ...self, alive: f < 50 },
        runners: [
          { slot: 1, x: dead ? DEATH + 0.5 : x, y: 10, alive: !dead, finished: false },
          { slot: 2, x: 3, y: 10, alive: true, finished: false },
        ],
        kills: f < 50 ? [] : [{ victim: 0, killer }],
      }),
    );
  }
  brain.think(view({ phase: 'score', kills: [{ victim: 0, killer }] }));
  const rivals = [rival(1, { score: scores[0] }), rival(2, { score: scores[1] })];
  const picks: Intent[] = [];
  for (let f = 0; f < 600; f++) {
    const it = brain.think(
      view({
        phase: 'pick',
        phaseFrame: f,
        crate: CRATE,
        rivals: [
          { ...rivals[0], hover: 2 },
          { ...rivals[1], hover: 0 },
        ],
      }),
    );
    picks.push(it);
    if (it.do === 'pick') break;
  }
  const places: Intent[] = [];
  const crate = CRATE.map((c, i) => (i === 3 ? card('hazard', 0) : c));
  for (let f = 0; f < 600; f++) {
    const it = brain.think(view({ phase: 'place', phaseFrame: f, crate, claim: 3, rivals: [{ ...rivals[0], cursor: { x: 5, y: 4 } }, rivals[1]] }));
    places.push(it);
    if (it.do === 'place') break;
  }
  return { picks, places, took: picks.at(-1), put: places.at(-1) };
}

describe('temperaments and grudges', () => {
  it('rolls a temperament from its seed, and every one comes up', () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => rollTemperament(i + 1).id));
    expect([...seen].sort()).toEqual([...TEMPERAMENT_IDS].sort());
  });

  it('heats a rival by what its temperament makes of a slight, and cools a round at a time', () => {
    const g = new Grudges(TEMPERAMENTS.grudger);
    g.feel(3, 'kill');
    expect(g.target([1, 3])).toBe(3);
    let rounds = 0;
    while (g.target([1, 3]) === 3) {
      g.cool();
      rounds++;
    }
    expect(rounds).toBeGreaterThan(2);
    const b = new Grudges(TEMPERAMENTS.builder);
    b.feel(3, 'kill');
    expect(b.of(3)).toBeLessThan(GRUDGE);
    expect(b.target([3])).toBe(-1);
    // A rival who's gone isn't anyone's target.
    expect(g.target([1])).toBe(-1);
  });

  it('a grudger goes for the card its killer points at, eyes their cursor, then traps where they died', () => {
    const { took, places, put } = round('grudger');
    expect(took).toEqual({ do: 'pick', card: 2 });
    const aims = places.filter((x) => x.do === 'aim');
    expect(aims.length).toBeGreaterThanOrEqual(70);
    expect(aims[0]).toEqual({ do: 'aim', x: 5, y: 4 });
    expect(put).toMatchObject({ do: 'place', tx: DEATH, ty: 9 });
  });

  it('holds the grudge against whoever killed it, not whoever stood nearest', () => {
    const { took, places } = round('grudger', { killer: 2 });
    expect(took).toEqual({ do: 'pick', card: 0 });
    // Slot 2 has no cursor up: nobody to eye.
    expect(places.some((x) => x.do === 'aim')).toBe(false);
  });

  it('a builder lets a kill go: no glare, and its hazard goes where the level allows, not on a trail', () => {
    const { places, put } = round('builder');
    expect(places.some((x) => x.do === 'aim')).toBe(false);
    expect(put).not.toMatchObject({ tx: DEATH, ty: 9 });
  });

  it('a sheriff goes after the leader with no kill to avenge, where a grudger lets a lead go', () => {
    const sheriff = round('sheriff', { killer: -1, scores: [0, 30] });
    expect(sheriff.took).toEqual({ do: 'pick', card: 0 });
    const grudger = round('grudger', { killer: -1, scores: [0, 30] });
    expect(grudger.places.some((x) => x.do === 'aim')).toBe(false);
  });

  it('eyes a spot in place with the cursor, as a player does, without placing there', () => {
    const m = new Match(2);
    const bots = new BotSeats();
    const dev = bots.add(m);
    const p = m.join(dev)!;
    m.rules = { ...m.rules, pickSeconds: 0, placeSeconds: 0 };
    m.startMatch();
    for (let f = 0; f < 30 * 60 && m.phase !== 'place'; f++) m.step(bots.frames(m));
    const motor = new Motor(rollPersonality(1, 'hard'), 1);
    for (let f = 0; f < 240; f++) m.step({ [dev]: motor.drive(m, p, { do: 'aim', x: 10, y: 6 }) });
    expect(Math.abs(p.cursor.x / TILE - 10)).toBeLessThan(1);
    expect(Math.abs(p.cursor.y / TILE - 6)).toBeLessThan(1);
    expect(p.placed).toBe(false);
  });
});
