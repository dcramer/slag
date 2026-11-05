import { dcos, dsin } from '../../core/dmath';
import type { Rng } from '../../core/rng';
import { harvester, liveFence, REEL_REACH } from '../stage/farm';
import { cannons, pendulums, vehicles, wheels } from './builders';
import { defineSetPiece } from './contract';
import { best, makeStyle, type Piece, type Recipe, type Run, SAFE_TILES, type Site } from './place';
import { DOWN } from '../../core/geom';

/**
 * Farm: a tractor ploughing a field, a windmill with rideable sails, a swinging hay bale on a hoist and a
 * live fence across a field path; and the farm's own hazards, which
 * no other theme has: a hay hook's heavy block swinging from a jib, a muck spreader flinging slow muck,
 * a pumpkin catapult lobbing pumpkins that bounce and knock you about, and a combine harvester driving a
 * field reel first, revving before it pulls away. Big enough to read across the
 * level, and everything that hangs hangs from a post that stands on the ground (docs/SETPIECES.md).
 */

const pick = (rng: Rng, a: readonly string[]) => rng.pick(a);

/** A live fence across a path: two posts a few columns apart on a ground run, the wire at knee height. */
function* fences(rng: Rng, s: Site): Generator<Piece> {
  const D = rng.int(3, 5);
  const runs = s.groundRuns(3, D + 1).filter((r) => s.zoneDist(Math.floor((r.x0 + r.x1) / 2), r.y) > SAFE_TILES + 1);
  for (const run of best(rng, runs, (r) => (s.runReachable(r) ? 3 : 0) + Math.min(1, (r.x1 - r.x0) / 12))) {
    const x0 = run.x0 + rng.int(0, run.x1 - run.x0 - D);
    if (s.zoneDist(x0, run.y) <= SAFE_TILES + 1 || s.zoneDist(x0 + D, run.y) <= SAFE_TILES + 1) continue;
    yield liveFence(rng, x0, x0 + D, run.y);
  }
}

/**
 * A hay hook on a chain from a jib, swinging across a path with its hook at head height. The jib's post
 * stands on the ground beside the swing (drawn behind), so the whole arc stays in the open.
 */
function* hooks(rng: Rng, s: Site): Generator<Piece> {
  const arm = rng.range(3.4, 4.6);
  const radius = 0.7;
  const swing = rng.range(0.7, 0.95);
  const spots: { x: number; hy: number; score: number }[] = [];
  for (const run of s.groundRuns(Math.ceil(arm) + 2, 3)) {
    for (let x = run.x0; x <= run.x1; x++) {
      const hy = run.y + 0.15 - arm;
      if (hy < 1) continue;
      let ok = true;
      for (let k = -4; ok && k <= 4; k++) {
        const a = DOWN + (swing * k) / 4;
        const px = x + 0.5 + dcos(a) * arm;
        const py = hy + dsin(a) * arm;
        for (let yy = Math.floor(py - radius); ok && yy <= Math.floor(py + radius); yy++)
          for (let xx = Math.floor(px - radius); ok && xx <= Math.floor(px + radius); xx++) ok = s.free(xx, yy) && s.zoneDist(xx, yy) > SAFE_TILES;
      }
      // The jib's post, beside the arc: ground under it, air up its length.
      const reach = Math.ceil(arm * dsin(swing) + radius + 1);
      const side = x - reach >= 1 && s.ground(x - reach, run.y + 1) ? -1 : 1;
      const mx = x + side * reach;
      if (!ok || !s.ground(mx, run.y + 1) || !s.freeRect(mx, Math.floor(hy), mx, run.y)) continue;
      spots.push({ x, hy, score: s.reachable(x, run.y) ? 3 : 0 });
    }
  }
  for (const c of best(rng, spots, (c) => c.score)) {
    yield {
      name: rng.pick(['Hay Hook', 'The Bale Grabber', 'Hook, Line and Sinker', 'Hay There']),
      archetype: 'flail',
      role: 'hazard',
      style: makeStyle(rng, ['steel', 'rust'], [4, 120, 30], { woodHue: rng.range(20, 30) }),
      modules: [
        { type: 'swinger', head: 'mace', hub: [c.x + 0.5, c.hy], arm, angle0: DOWN, period: rng.int(150, 200), swing, dir: 1, radius, count: 1, link: 'chain' },
      ],
    };
  }
}

/** Rows a combine stands in over its stand row: its tank, and a rider on it. */
const COMBINE_ROWS = 4;

/** Stretches of a run where a combine keeps clear of the spawn and the goal, every row it stands in. */
function fieldsOf(s: Site, run: Run): Run[] {
  const out: Run[] = [];
  let x0 = -1;
  for (let x = run.x0; x <= run.x1 + 1; x++) {
    let ok = x <= run.x1;
    for (let k = 0; ok && k < COMBINE_ROWS; k++) ok = s.zoneDist(x, run.y - k) > SAFE_TILES;
    if (ok && x0 < 0) x0 = x;
    if (!ok && x0 >= 0) {
      out.push({ y: run.y, x0, x1: x - 1 });
      x0 = -1;
    }
  }
  return out;
}

/** Fewest columns a combine drives: enough that its reel leaves every cell it covers clear for a window each way (at 3, a lane could leave two cells under its reel never clear for 60 frames). */
const MIN_DRIVE = 4;

interface Lane {
  x0: number;
  cw: number;
  travel: number;
  face: -1 | 1;
}

/**
 * Where a combine `cw` wide facing `face` fits on a run, driving up to `want` columns: its reel's air out
 * front where it parks first (over the drop off the run's end, often), its body and drive on the run, and
 * a free column past where the drive ends, to push a runner into. Worked as facing left on a mirrored run.
 */
function laneOn(s: Site, run: Run, cw: number, want: number, face: -1 | 1): Lane | null {
  const G = run.y + 1;
  // Column `u` along the run from the end the reel faces.
  const at = (u: number) => (face < 0 ? run.x0 + u : run.x1 - u);
  const open = (u0: number, u1: number) => s.freeRect(Math.min(at(u0), at(u1)), G - COMBINE_ROWS, Math.max(at(u0), at(u1)), G - 1);
  const len = run.x1 - run.x0 + 1;
  let a = 0;
  while (a + cw + MIN_DRIVE <= len && !open(a - REEL_REACH, a - 1)) a++;
  if (a + cw + MIN_DRIVE > len) return null;
  let travel = Math.min(want, len - a - cw);
  while (travel >= MIN_DRIVE && !open(a + cw + travel, a + cw + travel)) travel--;
  if (travel < MIN_DRIVE) return null;
  return { x0: face < 0 ? at(a) : at(a + cw - 1), cw, travel, face };
}

/**
 * A combine harvester on a field (`harvester`, gen/stage/farm.ts), sized for a classic level, whose fields
 * are short: its body and its drive on a flat run, with head room over it for a rider. A field of earth
 * first; most long flat runs on a farm's hills are boards, though, and it drives those as the tractor does.
 * Its reel only needs air, so it parks first at whichever end of the run has room for it, mostly facing the
 * spawn.
 */
function* combines(rng: Rng, s: Site): Generator<Piece> {
  const big = rng.int(4, 5);
  const want = rng.int(MIN_DRIVE, 7);
  const faces: (-1 | 1)[] = rng.chance(0.65) ? [-1, 1] : [1, -1];
  const runs = s.groundRuns(COMBINE_ROWS, 4 + MIN_DRIVE).flatMap((r) => fieldsOf(s, r).filter((c) => c.x1 - c.x0 + 1 >= 4 + MIN_DRIVE));
  const earth = (r: Run) => s.solid(r.x0, r.y + 1) && s.solid(r.x1, r.y + 1) && s.solid((r.x0 + r.x1) >> 1, r.y + 1);
  for (const run of best(rng, runs, (r) => (earth(r) ? 2 : 0) + (s.runReachable(r) ? 3 : 0) + Math.min(1.5, (r.x1 - r.x0) / 12))) {
    let lane: Lane | null = null;
    for (const cw of new Set([big, 4])) for (const face of faces) lane ??= laneOn(s, run, cw, want, face);
    if (!lane) continue;
    const dwell = rng.int(60, 100);
    yield harvester(rng, {
      ...lane,
      G: run.y + 1,
      speed: rng.range(2.2, 3.4),
      dwell,
      warn: rng.int(30, 42),
      names: ['Combine Harvester', 'The Reaper', 'Little Red', 'Grim Reaper', 'Harvest Moon', 'Threshold'],
      // Red or green: the machine everyone pictures.
      paints: [0, 1],
    });
  }
}

export const FARM: Recipe[] = [
  {
    name: 'tractor',
    weight: 3,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: `${pick(rng, ['Old', 'Big', 'Grumpy', 'Rusty', 'Trusty', 'Diesel'])} ${pick(rng, ['Tractor', 'Plougher', 'Harvester', 'Bessie'])}`,
        look: 'tractor',
        style: makeStyle(rng, 'steel', [2, 118, 205, 26, 48], { woodHue: rng.range(20, 32) }),
        w: [3, 5],
        // Cab at the back (left), lower hood in front; mirrored when it faces left.
        cols: (r, w) => (w === 3 ? [2.25, 1.4, 1.3] : w === 4 ? [2.3, 2.3, 1.45, 1.3] : [2.6, 2.6, 1.6, 1.5, 1.4]).map((h) => h + r.range(-0.05, 0.1)),
        speed: [1.6, 3.1],
        span: [5, 12],
        flip: 0.5,
        pause: [40, 110],
      }),
  },
  {
    name: 'windmill',
    weight: 2.5,
    role: 'build',
    candidates: (rng, s) =>
      wheels(rng, s, {
        name: `${pick(rng, ['Creaky', 'Old', 'Whistling', 'Painted'])} Windmill`,
        look: 'windmill',
        support: 'tower',
        style: makeStyle(rng, 'rust', [10, 30, 200, 0], { woodHue: rng.range(22, 34) }),
        arm: [3.4, 4.6],
        width: [2, 3],
        count: [4, 4],
        period: [460, 720],
        material: 'wood',
      }),
  },
  {
    name: 'hay hoist',
    weight: 1.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Hay Hoist',
        look: 'hay',
        support: 'mast',
        style: makeStyle(rng, 'rust', [40, 45, 50], { woodHue: rng.range(22, 32) }),
        arm: [3.5, 5.5],
        swing: [0.45, 0.8],
        width: [2, 3],
        thick: 0.75,
        period: [170, 240],
        material: 'wood',
      }),
  },
  defineSetPiece({ name: 'electric fence', weight: 2, role: 'hazard', candidates: fences }),
  defineSetPiece({
    name: 'hay hook',
    weight: 1.6,
    role: 'hazard',
    unique: true,
    codex: { title: 'Hay Hook', note: 'Hay there.', about: 'A heavy block on a chain, swinging from a jib with its hook at head height.' },
    candidates: hooks,
  }),
  defineSetPiece({
    name: 'muck spreader',
    codex: { title: 'Muck Spreader', note: 'Organic.', about: 'Flings slow muck in short bursts. It sticks, and you slow down.' },
    weight: 1.6,
    role: 'hazard',
    unique: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: pick(rng, ['Muck Spreader', 'The Fertilizer', 'Manure Express', 'Organic Matter']),
        look: 'spitter',
        style: makeStyle(rng, ['rust', 'steel'], [4, 118, 30], { woodHue: rng.range(20, 30) }),
        ammo: 'goo',
        speed: [200, 260],
        interval: [130, 190],
        burst: [2, 3],
        elev: [0.35, 0.7],
        length: 1.2,
      }),
  }),
  defineSetPiece({
    name: 'combine',
    codex: {
      title: 'Combine Harvester',
      note: 'Reaps what you sow.',
      about: 'Drives a field reel first. The reel idles while it waits, and revs before it pulls away.',
    },
    weight: 4,
    role: 'hazard',
    unique: true,
    candidates: combines,
  }),
  defineSetPiece({
    name: 'pumpkin catapult',
    codex: { title: 'Pumpkin Catapult', note: 'Gourd for you.', about: 'Lobs pumpkins that bounce about and knock you off your feet.' },
    weight: 1.4,
    role: 'hazard',
    unique: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: pick(rng, ['Pumpkin Catapult', 'Gourd Thrower', 'Harvest Festival', 'Squash Court']),
        look: 'totem',
        style: makeStyle(rng, ['rust', 'steel'], [24, 30], { woodHue: rng.range(20, 32) }),
        ammo: 'rubber',
        speed: [220, 290],
        interval: [160, 230],
        burst: [1, 1],
        elev: [0.6, 0.95],
        length: 1.3,
      }),
  }),
];
