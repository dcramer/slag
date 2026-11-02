import { parseSeed, Rng } from './core/rng';
import type { Match } from './game/match';
import { ARCHETYPE_WEIGHTS, type Archetype, DEMOLISH, generateProp } from './gen/props';
import type { NetSession } from './net/session';
import { hashMatch } from './net/snapshot';
import type { Renderer } from './render/renderer';
import { giveItem, ITEM_KINDS, type ItemKind } from './sim/items';
import { canPlace, landedDef } from './sim/props';
import type { ProfileOverride } from './gen/level';
import type { InputFrame } from './sim/types';
import { WEATHER_KINDS } from './sim/weather';
import type { ThemeId } from './themes';

/**
 * Debug/automation API, exposed as `window.slagDebug` and driven by URL
 * params. Used by tools/shot.ts; handy in the browser console too.
 *
 *   ?seed=abc           level seed
 *   ?theme=farm         force a theme (see src/themes.ts)
 *   ?players=2          auto-join N keyboard/pad players and start the match
 *   ?race=saw,laser     drop those archetypes in and jump straight to a race
 *   ?race=all           one of every archetype
 *   ?propseed=7         seed for debug-generated props
 *   ?size=tall          force the level profile's size class (classic|wide|tall)
 *   ?route=zigzag       force the route shape (ltr|climb|descent|zigzag)
 *   ?density=0.9        force terrain density (0..1)
 *   ?gravity=0.7        force world gravity scale
 *   ?weather=rain       force the weather (clear|wind|mist|rain|snow), skipping worldgen's solvability gate
 *   ?debug=1            open the dev overlay (see installDevtoolsHooks)
 *   ?give=sword,puck    hand race runners these held items, cycled (`all` = one of each)
 *   ?lettering=0        no impact words (read by the Renderer)
 *   ?zoom=1             force the phone camera on (`?zoom=0` off, `?zoom=2.4` pins a zoom); see render/camera-follow.ts
 */
export interface SlagDebug {
  match: Match;
  renderer: Renderer;
  /** Online session (status, peers, stats); `?net=off` or debug params make it offline. */
  net: NetSession | null;
  /** Join N players (kb1, kb2, pad0…pad5) and start round 1. */
  quickStart(players?: number): void;
  /** Place one prop of each archetype at deterministic legal spots (owner = player 1). */
  addProps(kinds: Archetype[], seed?: number): number;
  /** Skip pick/place and start a race now. */
  race(kinds?: Archetype[], seed?: number): void;
  /** Hand each race runner a held item, cycling through `kinds`. */
  give(kinds: ItemKind[]): void;
  /** Regenerate the level for a seed (optionally forcing a theme). */
  loadLevel(seed: string | number, theme?: ThemeId): void;
  phase(): string;
  /** Freeze/unfreeze the real-time loop (for deterministic screenshots). */
  pause(on?: boolean): void;
  /** Advance the sim `n` frames with these per-device inputs (default none), then render once. */
  step(n?: number, inputs?: Record<string, InputFrame>): void;
  /** Render one frame at time `ms` (defaults to now). */
  render(ms?: number): void;
  /** Deterministic state hash of the confirmed match (peers in sync ⇔ equal hashes at equal frames). */
  hash(): number;
}

export interface LoopControl {
  paused: boolean;
}

const DEVICES = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5'];

/** Installs `window.slagDebug` for this game; it goes away again when `signal` aborts (the game left the page). */
export function installDebug(match: Match, renderer: Renderer, loop: LoopControl, net: NetSession | null, signal: AbortSignal): SlagDebug {
  let uid = 5000;
  // Online, match devices are '<peer>:kb1'; offline sessions keep raw ids.
  const dev = (d: string) => net?.globalDevice(d) ?? d;
  const api: SlagDebug = {
    match,
    renderer,
    net,
    quickStart(players = 2) {
      for (let i = 0; i < players; i++) match.join(dev(DEVICES[i]));
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
            match.placed.push({ uid: uid++, def: landedDef(match.level, match.placed, def, 0, tx, ty), owner: match.players[1]?.slot ?? 0, tx, ty, rot: 0 });
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
    give(kinds) {
      if (kinds.length) match.run?.runners.forEach((r, i) => giveItem(r, kinds[i % kinds.length]));
    },
    loadLevel(seed, theme) {
      match.newLevel(typeof seed === 'number' ? seed : parseSeed(seed), theme ?? match.themeOverride);
    },
    phase: () => match.phase,
    pause(on = true) {
      loop.paused = on;
      // Stepped frames are pictures of a finished level: ink a new one whole, not a chunk per render.
      renderer.bakeBudgetMs = on ? Infinity : 5;
    },
    step(n = 1, inputs = {}) {
      for (let i = 0; i < n; i++) match.step(inputs);
      renderer.render(match, performance.now(), match.drainEvents());
    },
    render(ms) {
      renderer.render(match, ms ?? performance.now(), match.drainEvents());
    },
    hash: () => hashMatch(match),
  };
  const w = window as unknown as { slagDebug?: SlagDebug };
  w.slagDebug = api;
  signal.addEventListener('abort', () => {
    if (w.slagDebug === api) delete w.slagDebug;
  });

  const q = new URLSearchParams(location.search);
  const force: ProfileOverride = {};
  const size = q.get('size');
  if (size === 'classic' || size === 'wide' || size === 'tall') force.size = size;
  const route = q.get('route');
  if (route === 'ltr' || route === 'climb' || route === 'descent' || route === 'zigzag') force.route = route;
  if (q.get('density')) force.density = Number(q.get('density'));
  if (q.get('gravity')) force.gravity = Number(q.get('gravity'));
  const weather = WEATHER_KINDS.find((k) => k === q.get('weather'));
  if (weather) force.weather = weather;
  if (Object.keys(force).length) {
    match.forceProfile = force;
    match.newLevel(match.seed);
  }
  installDevtoolsHooks(api, q.get('debug'), signal);
  const players = Number(q.get('players') ?? 0);
  const race = q.get('race');
  if (race) {
    const kinds = race === 'all' ? ARCHETYPE_WEIGHTS.map(([k]) => k).filter((k) => !DEMOLISH.has(k)) : (race.split(',').filter(Boolean) as Archetype[]);
    if (players) api.quickStart(players);
    api.race(kinds, Number(q.get('propseed') ?? 1));
    const give = q.get('give');
    if (give) api.give(give === 'all' ? [...ITEM_KINDS] : (give.split(',').filter(Boolean) as ItemKind[]));
  } else if (players) api.quickStart(players);
  return api;
}

/**
 * Dev overlay (src/devtools). A production page does nothing here unless its URL asks: `?debug=1`
 * opens the overlay, `?debug=perf` installs the profiler (window.slagPerf) for tools/perf.ts without
 * showing it, `?debug=load` only marks `slag:first-frame`. `next dev`, or any `?debug`, also toggles
 * the overlay with ` (backquote). The dynamic import keeps it out of what players download.
 */
function installDevtoolsHooks(api: SlagDebug, mode: string | null, signal: AbortSignal) {
  if (!mode && process.env.NODE_ENV === 'production') return;
  const { renderer } = api;
  const render = renderer.render;
  let first = true;
  // A flag, not an unwrap: the profiler may wrap render on top of this before the first frame.
  renderer.render = (...a) => {
    render.apply(renderer, a);
    if (first) performance.mark('slag:first-frame');
    first = false;
  };
  const devtools = () => import('./devtools/overlay').then(({ installDevtools }) => installDevtools(api));
  if (mode === 'perf') void devtools();
  if (mode === '1') void devtools().then((d) => d.show(true));
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code !== 'Backquote' || e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      void devtools().then((d) => d.show());
    },
    { signal },
  );
}
