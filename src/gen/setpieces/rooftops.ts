import type { Cell } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { Module, PropStyle } from '../../sim/props';
import { acUnits, antennas, pendulums } from './builders';
import { defineSetPiece } from './contract';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Rooftops: AC condensers blowing updrafts, arcing antenna pairs, a window-washer gondola, and three things
 * no other theme has (docs/SETPIECES.md, Rooftops), its family of electricity and signage:
 *
 * - **Falling signs**: a sign hung over a walkway (chains to an overhang, or a bracket off a wall) that
 *   drops onto the roof under it and lies there live for a moment before it's winched back up (`sign`).
 * - **Live wires**: a power line strung low between two poles, a spark racing along it now and then
 *   (`wire`).
 * - **Neon letters**: a word of neon standing on the roof, its letters lit one after another, each live
 *   while it's lit (`neon` on a `body`).
 *
 * The builders below are shared with the landmarks (gen/stage/rooftops.ts).
 */

/** Paint and steel for the city's own pieces. */
export const CITY = (rng: Rng): PropStyle => makeStyle(rng, ['steel', 'rust'], [200, 18, 46, 320], { trim: 'rivets', glowHue: rng.pick([320, 190, 280, 48]) });

// ------------------------------------------------------------------------------------------------ falling sign

/** Rows of clear air a hanging sign leaves over a walkway: a runner walks under it untouched. */
const SIGN_CLEAR = 3;

/** The falling sign's timing and box, hanging with its top-left at (x, y) (tiles) over a floor `drop` tiles below its top. */
export function signModule(rng: Rng, x: number, y: number, w: number, h: number, floor: number): Module {
  const drop = floor - (y + h);
  return {
    type: 'sign',
    at: [x, y],
    w,
    h,
    drop,
    off: rng.int(150, 230),
    warn: rng.int(40, 56),
    fall: 8 + Math.round(drop * 2.2),
    live: rng.int(34, 48),
    lift: rng.int(90, 130),
    seed: rng.int(0, 1 << 20),
  };
}

export const signPiece = (rng: Rng, m: Module): Piece => ({
  name: rng.pick(['Falling Sign', 'Going Out of Business', 'Grand Opening', 'Loose Fixture', 'Watch This Space']),
  archetype: 'dropper',
  role: 'hazard',
  style: CITY(rng),
  modules: [m],
});

/**
 * Signs over the route: a box `w`×2 of free air with SIGN_CLEAR rows under it down to flat ground, held up
 * by a ceiling a few rows over it (it hangs on chains) or a wall beside its top (a bracket off the wall).
 */
function* fallingSigns(rng: Rng, s: Site): Generator<Piece> {
  const h = 2;
  const spots: { x: number; y: number; w: number; floor: number; score: number }[] = [];
  for (const r of s.groundRuns(h + SIGN_CLEAR + 1, 3))
    for (const w of [4, 3])
      for (let x = r.x0; x + w - 1 <= r.x1; x++) {
        const floor = r.y + 1;
        for (let y = floor - SIGN_CLEAR - h; y >= Math.max(1, floor - SIGN_CLEAR - h - 3); y--) {
          if (!s.freeRect(x, y, x + w - 1, floor - 1)) break;
          if (s.zoneDist(x, y) <= SAFE_TILES + 1 || s.zoneDist(x + w - 1, floor - 1) <= SAFE_TILES + 1) continue;
          let hung = false;
          for (let k = 1; k <= 3 && !hung; k++) for (let i = 0; i < w; i++) if (s.solid(x + i, y - k)) hung = true;
          const bracket = s.solid(x - 1, y) || s.solid(x + w, y);
          if (!hung && !bracket) continue;
          let under = 0;
          for (let i = 0; i < w; i++) if (s.reachable(x + i, floor - 1)) under++;
          spots.push({ x, y, w, floor, score: under ? 3 + under * 0.3 : 0 });
        }
      }
  for (const c of best(rng, spots, (c) => c.score)) yield signPiece(rng, signModule(rng, c.x, c.y, c.w, h, c.floor));
}

// ------------------------------------------------------------------------------------------------ live wire

/** How high a pole holds the wire's ends over the floor (tiles), and how high its sag leaves the middle. */
const POLE = 3;
const LOW = 1;

/** A live wire between poles standing at columns x0 and x1 on the floor `floor` (the ground row), its middle LOW tiles over it. */
export function wireModule(rng: Rng, x0: number, x1: number, floor: number, pole = POLE, low = LOW): Module {
  return {
    type: 'wire',
    a: [x0 + 0.5, floor - pole],
    b: [x1 + 0.5, floor - pole],
    sag: pole - low,
    off: rng.int(110, 170),
    warn: rng.int(30, 42),
    run: rng.int(22, 34),
    seed: rng.int(0, 1 << 20),
  };
}

export const wirePiece = (rng: Rng, mods: Module[]): Piece => ({
  name: rng.pick(['Live Wire', 'Downed Line', 'High Voltage', 'Shocking Development', 'Power Cut']),
  archetype: 'tesla',
  role: 'hazard',
  style: CITY(rng),
  modules: mods,
});

/** Every cell the cable's curve passes through, from x0 to x1 (tiles). */
function wireCells(x0: number, x1: number, floor: number): Cell[] {
  const out: Cell[] = [];
  const n = (x1 - x0) * 4;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = x0 + 0.5 + (x1 - x0) * u;
    const y = floor - POLE + (POLE - LOW) * 4 * u * (1 - u);
    out.push([Math.floor(x), Math.floor(y)]);
  }
  return out;
}

/** Power lines strung low over a stretch of roof, a pole at each end standing on the floor. */
function* liveWires(rng: Rng, s: Site): Generator<Piece> {
  const spots: { x0: number; x1: number; floor: number; score: number }[] = [];
  for (const r of s.groundRuns(POLE + 1, 6)) {
    const floor = r.y + 1;
    for (let x0 = r.x0; x0 <= r.x1 - 5; x0++)
      for (const span of [9, 8, 7, 6, 5]) {
        const x1 = x0 + span;
        if (x1 > r.x1) continue;
        const cells = wireCells(x0, x1, floor);
        if (!cells.every(([x, y]) => s.free(x, y)) || cells.some(([x, y]) => s.zoneDist(x, y) <= SAFE_TILES + 1)) continue;
        let under = 0;
        for (let x = x0 + 1; x < x1; x++) if (s.reachable(x, r.y)) under++;
        spots.push({ x0, x1, floor, score: under ? 3 + under * 0.15 : 0 });
        break;
      }
  }
  for (const c of best(rng, spots, (c) => c.score)) yield wirePiece(rng, [wireModule(rng, c.x0, c.x1, c.floor)]);
}

// ------------------------------------------------------------------------------------------------ neon letters

/** Neon letters on the stand cells `cells` (a word, one cell a letter), chasing along it. */
export function neonModules(rng: Rng, cells: Cell[]): Module[] {
  return [
    { type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
    { type: 'neon', cells: cells.slice(), off: rng.int(90, 130), warn: rng.int(24, 32), on: rng.int(40, 56), lag: rng.int(7, 11), seed: rng.int(0, 1 << 20) },
  ];
}

export const neonPiece = (rng: Rng, mods: Module[]): Piece => ({
  name: rng.pick(['Neon Sign', 'Open 24 Hours', 'Live Letters', 'Bright Lights', 'Vacancy']),
  archetype: 'blinker',
  role: 'hazard',
  style: CITY(rng),
  modules: mods,
});

/** A word of neon standing on a stretch of open roof: hop across it on the letters that are dark. */
function* neonWords(rng: Rng, s: Site): Generator<Piece> {
  const spots: { x: number; y: number; n: number; score: number }[] = [];
  for (const r of s.groundRuns(4, 7))
    for (const n of [5, 4]) {
      for (let x = r.x0 + 1; x + n <= r.x1; x++) {
        if (s.zoneDist(x, r.y) <= SAFE_TILES + 1 || s.zoneDist(x + n - 1, r.y) <= SAFE_TILES + 1) continue;
        let reach = 0;
        for (let i = -1; i <= n; i++) if (s.reachable(x + i, r.y)) reach++;
        spots.push({ x, y: r.y, n, score: reach ? 3 + reach * 0.2 : 0 });
      }
    }
  for (const c of best(rng, spots, (c) => c.score)) {
    const cells: Cell[] = Array.from({ length: c.n }, (_, i) => [c.x + i, c.y] as Cell);
    yield { ...neonPiece(rng, neonModules(rng, cells)), pathSafe: true };
  }
}

export const ROOFTOPS: Recipe[] = [
  {
    name: 'ac updraft',
    weight: 3,
    role: 'utility',
    repeat: true,
    candidates: (rng, s) =>
      acUnits(rng, s, {
        name: 'Rooftop Condenser',
        style: makeStyle(rng, 'steel', [200, 40, 0], { trim: 'rivets' }),
        length: [5, 9],
        strength: [1900, 2500],
      }),
  },
  {
    name: 'antennas',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      antennas(rng, s, {
        name: 'Pirate Antenna',
        style: makeStyle(rng, 'steel', [0], { glowHue: rng.pick([190, 210, 280]) }),
        gap: [3, 6],
        on: [45, 70],
        off: [90, 140],
      }),
  },
  {
    name: 'gondola',
    weight: 2,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Window Gondola',
        look: 'gondola',
        support: 'mast',
        style: makeStyle(rng, 'steel', [200, 0, 48, 120], { trim: 'stripes' }),
        arm: [3, 5],
        swing: [0.25, 0.5],
        width: [3, 4],
        period: [240, 340],
        material: 'metal',
      }),
  },
  defineSetPiece({
    name: 'falling sign',
    unique: true,
    weight: 2,
    role: 'hazard',
    repeat: true,
    codex: {
      title: 'Falling Sign',
      note: 'Under new management.',
      about: 'A sign on chains lurches as a bracket gives, drops to the floor, lies there sparking, then gets winched back up.',
    },
    candidates: fallingSigns,
  }),
  defineSetPiece({
    name: 'live wire',
    unique: true,
    weight: 2,
    role: 'hazard',
    repeat: true,
    codex: {
      title: 'Live Wire',
      note: 'The bill remembers.',
      about: 'A spark races along a cable strung low between two poles. The insulator crackles first.',
    },
    candidates: liveWires,
  }),
  defineSetPiece({
    name: 'neon sign',
    unique: true,
    weight: 2,
    role: 'hazard',
    codex: {
      title: 'Neon Sign',
      note: 'Open 24 hours.',
      about: 'A word standing on the roof. Each letter is live while it’s lit, and the light chases along the word.',
    },
    candidates: neonWords,
  }),
];
