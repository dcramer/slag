import { datan2, dhypot } from '../../core/dmath';
import type { Cell, Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { Module } from '../../sim/props';
import { jumpProfile } from '../level/probe';
import { antennas, cannons, geysers, pendulums, wheels } from './builders';
import { defineSetPiece } from './contract';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Space: flares licking up out of the void, a point-defense turret, an arcing comm array, a centrifuge to
 * ride, a docking arm; and its own hazards, which nothing else in the game does: meteors falling out of the
 * sky, an airlock that blows you off the deck, and fuel cells that go up a moment after you land on them.
 */

/** Columns a stand cell is from the nearest bridge of the level's solution (a hard crossing), or far. */
function crossingDist(s: Site, x: number, y: number): number {
  let d = 99;
  for (const b of s.level.solution ?? []) d = Math.min(d, Math.max(Math.abs(x - (b.x + 1)), Math.abs(y - b.y)));
  return d;
}

/**
 * Meteor Shower: two or three glints high in the sky, each dropping a burning rock on a slant onto a body's
 * deck on its own beat. Each streak is aimed at a stand cell, its path over open air, and seen the whole
 * way down: the glint swells before each one falls.
 */
function* meteorShower(rng: Rng, s: Site): Generator<Piece> {
  const spots: { x: number; y: number; hits: number }[] = [];
  for (let y = 2; y < s.h - 1; y++) for (let x = 2; x < s.w - 2; x++) if (s.reachable(x, y) && s.zoneDist(x, y) > SAFE_TILES + 3) spots.push({ x, y, hits: 0 });
  const rifts: { at: Vec; angle: number; tx: number }[] = [];
  for (const t of best(rng, spots, () => 0, 40)) {
    if (rifts.length >= 3) break;
    if (rifts.some((r) => Math.abs(r.tx - t.x) < 4)) continue;
    // From high up and to one side, so it comes in on a slant you can read.
    const side = rng.chance(0.5) ? 1 : -1;
    const ry = rng.int(1, Math.max(1, Math.min(3, t.y - 6)));
    const rx = t.x + side * rng.int(3, Math.max(3, Math.round((t.y - ry) * 0.6)));
    if (rx < 1 || rx > s.w - 2 || !s.free(rx, ry)) continue;
    const at: Vec = [rx + 0.5, ry + 0.5];
    const aim: Vec = [t.x + 0.5, t.y + 0.6];
    // The fall is over open air all the way to its target, and nowhere near the spawn or the flag.
    const n = Math.ceil(dhypot(aim[0] - at[0], aim[1] - at[1]) * 2);
    let clear = true;
    for (let i = 1; i < n && clear; i++) {
      const cx = Math.floor(at[0] + ((aim[0] - at[0]) * i) / n);
      const cy = Math.floor(at[1] + ((aim[1] - at[1]) * i) / n);
      if (s.solid(cx, cy) || s.zoneDist(cx, cy) <= SAFE_TILES + 1) clear = false;
    }
    if (clear) rifts.push({ at, angle: datan2(aim[1] - at[1], aim[0] - at[0]), tx: t.x });
  }
  if (rifts.length < 2) return;
  yield {
    name: rng.pick(['Meteor Shower', 'Shooting Stars', 'Make a Wish', 'Space Weather']),
    archetype: 'launcher',
    role: 'hazard',
    style: makeStyle(rng, 'obsidian', [20, 30], { glowHue: rng.pick([24, 36, 190]) }),
    modules: rifts.map((r) => ({
      type: 'cannon' as const,
      look: 'meteor' as const,
      at: r.at,
      angle: r.angle,
      ammo: 'meteor' as const,
      interval: rng.int(170, 260),
      burst: 1,
      speed: rng.int(110, 150),
      length: 0.4,
      seed: rng.int(0, 1 << 20),
    })),
  };
}

/**
 * Airlock: a hatch in a deck that blows out on a cycle, shoving everyone near it away from it (a pushing
 * field, the magnet's mechanism the other way round) and, near an edge, off into the void. It warns first
 * (the beacon spins, the hatch rattles). Kept well clear of any hard crossing, so the push never carries a
 * bare run over one.
 */
function* airlock(rng: Rng, s: Site): Generator<Piece> {
  const radius = rng.range(3, 4);
  const far = radius + jumpProfile().gap + 4;
  const spots: { x: number; y: number; edge: number }[] = [];
  for (let y = 2; y < s.h - 1; y++)
    for (let x = 2; x < s.w - 2; x++) {
      if (!s.reachable(x, y) || !s.solid(x, y + 1) || !s.free(x, y) || s.zoneDist(x, y) <= SAFE_TILES + Math.ceil(radius)) continue;
      if (crossingDist(s, x, y) < far) continue;
      // Near an edge of its deck, so the blast means something.
      let edge = 99;
      for (let d = 1; d <= 4; d++) if (!s.ground(x - d, y + 1) || !s.ground(x + d, y + 1)) edge = Math.min(edge, d);
      spots.push({ x, y, edge });
    }
  for (const c of best(rng, spots, (c) => (c.edge <= 3 ? 2 : 0), 12)) {
    const m: Module = {
      type: 'magnet',
      at: [c.x + 0.5, c.y + 0.98],
      radius,
      strength: rng.int(900, 1200),
      polarity: -1,
      on: rng.int(50, 80),
      off: rng.int(150, 220),
      warn: rng.int(40, 55),
    };
    yield {
      name: rng.pick(['Airlock', 'Blowout Hatch', 'Explosive Decompression', 'Mind the Door']),
      archetype: 'magnet',
      role: 'hazard',
      style: makeStyle(rng, 'steel', [48, 205], { trim: 'stripes', glowHue: 40 }),
      modules: [m],
    };
  }
}

/**
 * Fuel Cells: a rack of one to three canisters standing on a deck. You can stand on them, for a moment:
 * landing on one lights it, and it goes up a short count later, taking anyone close with it, and is gone
 * a while before a new one is racked. Never by a crossing (they're ground a jump could use).
 */
function* fuelCells(rng: Rng, s: Site): Generator<Piece> {
  for (const run of best(rng, s.groundRuns(3, 3), (r) => (s.runReachable(r) ? 2 : 0) + Math.min(2, (r.x1 - r.x0) / 6), 16)) {
    const n = Math.min(rng.int(1, 3), run.x1 - run.x0 - 1);
    if (n < 1) continue;
    const x0 = rng.int(run.x0 + 1, run.x1 - n);
    const cells: Cell[] = [];
    for (let i = 0; i < n; i++) cells.push([x0 + i, run.y]);
    if (cells.some(([x, y]) => !s.solid(x, y + 1) || s.zoneDist(x, y) <= SAFE_TILES + 2 || crossingDist(s, x, y) < jumpProfile().gap + 3)) continue;
    yield {
      name: rng.pick(['Fuel Cells', 'Volatile Cargo', 'Do Not Stand On', 'Hydrogen Rack']),
      archetype: 'fuse',
      role: 'hazard',
      style: makeStyle(rng, 'steel', [0, 48, 120], { trim: 'stripes', glowHue: rng.pick([0, 48]) }),
      modules: [{ type: 'fuse', cells, trigger: 'land', count: rng.int(30, 45), radius: rng.range(1.6, 2.1), regrow: rng.int(300, 420) }],
    };
  }
}

/** Space: flares licking up out of the void, a point-defense turret, an arcing comm array, a centrifuge to ride, a docking arm. */
export const SPACE: Recipe[] = [
  {
    name: 'solar flare',
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: 'Solar Flare',
        look: 'lava',
        where: 'pit',
        style: makeStyle(rng, 'obsidian', [40]),
        length: [8, 13],
        width: 0.95,
        off: [120, 180],
        warn: 60,
        on: [40, 65],
        lethal: true,
      }),
  },
  defineSetPiece({
    name: 'turret',
    codex: { title: 'Turret', note: 'Warranty void.', about: 'Fires plasma, one to three shots at a time, at whatever is in front of it.' },
    unique: true,
    weight: 2,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: `${rng.pick(['Point-Defense', 'Overzealous', 'Warranty-Void', 'Friendly-Fire'])} Turret`,
        look: 'castle',
        style: makeStyle(rng, 'steel', [200, 0, 48], { trim: 'stripes', glowHue: rng.pick([190, 330, 120]) }),
        ammo: 'plasma',
        speed: [150, 210],
        interval: [130, 200],
        burst: [1, 3],
        elev: [0, 0.3],
        length: 1.1,
      }),
  }),
  {
    name: 'comm array',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      antennas(rng, s, {
        name: 'Comm Array',
        style: makeStyle(rng, 'steel', [0], { glowHue: rng.pick([190, 280, 60]) }),
        gap: [3, 6],
        on: [45, 70],
        off: [90, 140],
      }),
  },
  {
    name: 'centrifuge',
    weight: 2,
    role: 'build',
    candidates: (rng, s) =>
      wheels(rng, s, {
        name: `${rng.pick(['Spin-Grav', 'Artificial Gravity', 'Nauseous', 'Salad Spinner'])} Centrifuge`,
        look: 'cog',
        support: 'tower',
        style: makeStyle(rng, ['steel', 'brass'], [200, 48], { trim: 'rivets' }),
        arm: [2.6, 3.5],
        width: [2, 2],
        count: [3, 4],
        period: [420, 680],
        material: 'metal',
      }),
  },
  {
    name: 'docking arm',
    weight: 1.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Docking Arm',
        look: 'crane',
        support: 'mast',
        style: makeStyle(rng, 'steel', [48, 0, 205], { trim: 'stripes' }),
        arm: [3, 5],
        swing: [0.3, 0.6],
        width: [2, 3],
        thick: 1,
        period: [240, 340],
        material: 'metal',
      }),
  },
  defineSetPiece({
    name: 'meteor shower',
    unique: true,
    weight: 2.5,
    role: 'hazard',
    codex: { title: 'Meteor Shower', note: 'Make a wish.', about: 'Glints high in the sky swell, then drop burning rocks on a slant onto the deck.' },
    candidates: meteorShower,
  }),
  defineSetPiece({
    name: 'airlock',
    unique: true,
    weight: 2,
    role: 'hazard',
    repeat: true,
    codex: { title: 'Airlock', note: 'Please exit to your left.', about: 'A hatch in the deck that blows everyone near it away.' },
    candidates: airlock,
  }),
  defineSetPiece({
    name: 'fuel cells',
    unique: true,
    weight: 2,
    role: 'hazard',
    repeat: true,
    codex: { title: 'Fuel Cells', note: 'Do not stand on the fuel.', about: 'Canisters on a deck that light when you land on them, then go up.' },
    candidates: fuelCells,
  }),
];
