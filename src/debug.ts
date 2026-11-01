import { parseSeed, Rng } from './core/rng';
import type { Match } from './game/match';
import { ARCHETYPE_WEIGHTS, type Archetype, generateProp } from './gen/props';
import type { Renderer } from './render/renderer';
import { canPlace } from './sim/props';

/**
 * Debug/automation API, exposed as `window.slagDebug` and driven by URL
 * params. Used by tools/shot.ts; handy in the browser console too.
 *
 *   ?seed=abc           level seed
 *   ?players=2          auto-join N keyboard/pad players and start the match
 *   ?race=saw,laser     drop those archetypes in and jump straight to a race
 *   ?race=all           one of every archetype
 *   ?propseed=7         seed for debug-generated props
 */
export interface SlagDebug {
  match: Match;
  renderer: Renderer;
  /** Join N players (kb1, kb2, pad0, pad1) and start round 1. */
  quickStart(players?: number): void;
  /** Place one prop of each archetype at deterministic legal spots (owner = player 1). */
  addProps(kinds: Archetype[], seed?: number): number;
  /** Skip pick/place and start a race now. */
  race(kinds?: Archetype[], seed?: number): void;
  /** Regenerate the level for a new seed and return to the lobby. */
  loadLevel(seed: string | number): void;
  phase(): string;
  /** Freeze/unfreeze the real-time loop (for deterministic screenshots). */
  pause(on?: boolean): void;
  /** Advance the sim `n` frames with no input, then render once. */
  step(n?: number): void;
  /** Render one frame at time `ms` (defaults to now). */
  render(ms?: number): void;
}

export interface LoopControl {
  paused: boolean;
}

const DEVICES = ['kb1', 'kb2', 'pad0', 'pad1'];

export function installDebug(match: Match, renderer: Renderer, loop: LoopControl): SlagDebug {
  let uid = 5000;
  const api: SlagDebug = {
    match,
    renderer,
    quickStart(players = 2) {
      for (let i = 0; i < players; i++) match.join(DEVICES[i]);
      if (match.phase === 'lobby') match.startMatch();
    },
    addProps(kinds, seed = 1) {
      let added = 0;
      kinds.forEach((k, i) => {
        const def = generateProp(new Rng(seed * 977 + i * 131), k, `dbg-${i}`);
        for (let n = 0; n < 4000; n++) {
          const tx = 6 + ((i * 7 + n * 13) % (match.level.w - 12));
          const ty = 3 + ((i * 5 + n * 7) % (match.level.h - 6));
          if (canPlace(match.level, match.placed, def, 0, tx, ty)) {
            match.placed.push({ uid: uid++, def, owner: match.players[1]?.slot ?? 0, tx, ty, rot: 0 });
            added++;
            return;
          }
        }
      });
      return added;
    },
    race(kinds = [], seed = 1) {
      if (match.players.length === 0) api.quickStart(2);
      if (match.phase === 'lobby') match.startMatch();
      api.addProps(kinds, seed);
      match.startRun();
    },
    loadLevel(seed) {
      match.newLevel(typeof seed === 'number' ? seed : parseSeed(seed));
    },
    phase: () => match.phase,
    pause(on = true) {
      loop.paused = on;
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) match.step({});
      renderer.render(match, performance.now());
    },
    render(ms) {
      renderer.render(match, ms ?? performance.now());
    },
  };
  (window as unknown as { slagDebug: SlagDebug }).slagDebug = api;

  const q = new URLSearchParams(location.search);
  const players = Number(q.get('players') ?? 0);
  const race = q.get('race');
  if (race) {
    const kinds = race === 'all' ? ARCHETYPE_WEIGHTS.map(([k]) => k).filter((k) => k !== 'bomb') : (race.split(',').filter(Boolean) as Archetype[]);
    if (players) api.quickStart(players);
    api.race(kinds, Number(q.get('propseed') ?? 1));
  } else if (players) api.quickStart(players);
  return api;
}
