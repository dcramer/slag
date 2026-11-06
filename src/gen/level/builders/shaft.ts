import type { Rng } from '../../../core/rng';
import { LOOP_BAND, LOOP_SPAWN } from '../../../sim/level';
import { withDifficulty } from '../difficulty';
import { finish, Grid, POCKET, T_SOLID } from '../kit';
import { easyRise, knobs, LAST_RESORT } from '../sculptors/common';
import type { Storey, TallKit } from '../sculptors/tall';
import type { SculptCtx, Shape } from '../types';

/**
 * A Rising Slag shaft as open air (docs/DESIGN.md → Modes): ledges staggered like bricks up a walled shaft instead
 * of storeys with two ways up each, so every height has several lines and a pack can pass. Each ledge above starts
 * where the gap below it does, so whatever ledge you stand on has one up either side; some are the set's own floor
 * (solid: go round), the rest boards you jump up through. A wall-jump chimney runs up one side for part of the lap:
 * the quick way for whoever can climb a wall.
 *
 * The shaft's tier sets the bricks: wide ledges, short gaps and boards on gentle, narrow ledges, gaps near a
 * jump's reach and solid floors on hard. Like every loop it closes on itself (`closeLoop`), the spawn storey's floor
 * a lap up being the goal, and asks for no part.
 */

/**
 * Ledge widths, gaps between ledges in a row, the share of boards, and the share of ledges left out, per tier. A
 * ledge left out opens a well: a slip there falls past the row it would have caught you on, rows the slag gains.
 */
const BRICKS = {
  gentle: { ledge: [6, 8], gap: [3, 4], boards: 0.7, wells: 0 },
  medium: { ledge: [4, 6], gap: [4, 5], boards: 0.45, wells: 0.2 },
  hard: { ledge: [3, 4], gap: [4, 5], boards: 0.2, wells: 0.35 },
} as const;

/** Columns a chimney keeps clear beside its wall, and the share of the lap it runs. */
const CHIMNEY_W = 3;
const CHIMNEY_SHARE = 0.5;

/** One row of ledges: stand row `row`, ledges as inclusive column spans. */
interface Course {
  row: number;
  ledges: [number, number][];
}

/**
 * Lay a row of bricks over [lo, hi]: ledges `ledge` wide, `gap` apart, starting `phase` columns into the period so
 * rows alternate. A ledge cut short by an edge stays if it's at least two wide.
 */
function course(rng: Rng, row: number, lo: number, hi: number, phase: number, ledge: readonly [number, number], gap: readonly [number, number]): Course {
  const ledges: [number, number][] = [];
  let x = lo - phase;
  while (x <= hi) {
    const w = rng.int(ledge[0], ledge[1]);
    const a = Math.max(lo, x);
    const b = Math.min(hi, x + w - 1);
    if (b - a + 1 >= 2) ledges.push([a, b]);
    x += w + rng.int(gap[0], gap[1]);
  }
  return { row, ledges };
}

/** Build the open shaft with a set's tower kit: its floor for the solid ledges and the decks, its shell for the walls. */
export function sculptShaft(ctx: SculptCtx, kit: TallKit): Shape {
  const { rng } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const g = new Grid(W, H);
  const loop = H - LOOP_BAND;
  // The last attempts lay gentle bricks, which always climb.
  const tier = ctx.attempt >= LAST_RESORT ? 'gentle' : ctx.profile.difficulty;
  const bricks = BRICKS[tier];
  const lo = kit.margin;
  const hi = W - 1 - kit.margin;
  // The spawn storey stands at the bottom; its copy a lap up (the goal) is the top. Its floor is boards outside the
  // spawn pocket, so the climb comes up through it.
  const bottom = loop + LOOP_SPAWN;
  const top = LOOP_SPAWN;
  const spawn: Storey = { row: bottom, arrive: 2, leave: W - 3, x0: 0, x1: W - 1 };
  const goal: Storey = { row: top, arrive: 2, leave: W - 3, x0: 0, x1: W - 1 };
  kit.deck(g, rng, spawn, 0, POCKET + 1, true, k);
  g.plank(POCKET + 2, W - 1, bottom + 1);
  kit.deck(g, rng, goal, 0, POCKET + 1, false, k);
  g.plank(POCKET + 2, W - 1, top + 1);

  // Rows of ledges, evenly spaced a tier's rise and one apart, from just over the spawn to just under the goal.
  const rise = withDifficulty(tier, easyRise) + 1;
  const steps = Math.ceil((bottom - top) / rise);
  const side = rng.chance(0.5) ? 'left' : 'right';
  const chimneyFrom = rng.int(1, Math.max(1, Math.floor(steps * (1 - CHIMNEY_SHARE))));
  const period = (bricks.ledge[0] + bricks.ledge[1] + bricks.gap[0] + bricks.gap[1]) / 2;
  const courses: Course[] = [];
  for (let i = 1; i < steps; i++) {
    const row = Math.round(bottom - ((bottom - top) * i) / steps);
    const chimney = i >= chimneyFrom && i < chimneyFrom + Math.ceil(steps * CHIMNEY_SHARE);
    const a = chimney && side === 'left' ? lo + CHIMNEY_W : lo;
    const b = chimney && side === 'right' ? hi - CHIMNEY_W : hi;
    const phase = Math.round((i % 2) * (period / 2)) + rng.int(0, 1);
    const c = course(rng, row, a, b, phase, bricks.ledge, bricks.gap);
    // Wells: a ledge left out, never beside another in its row nor over one in the row below, so every ledge above
    // still has one a rise under it on at least one side. The reach proof checks the rest.
    const below = courses.at(-1)?.ledges ?? [];
    let left = false;
    c.ledges = c.ledges.filter(([x0, x1]) => {
      const over = below.some(([p0, p1]) => p1 >= x0 && p0 <= x1);
      const drop = !left && over && i > 1 && rng.chance(bricks.wells);
      left = drop;
      return !drop;
    });
    courses.push(c);
  }
  for (const c of courses)
    for (const [a, b] of c.ledges) {
      if (rng.chance(bricks.boards)) g.plank(a, b, c.row + 1);
      else kit.deck(g, rng, { row: c.row, arrive: a, leave: b, x0: a, x1: b }, a, b, false, k);
    }
  // Whatever the set's floor lays, every ledge keeps two rows of air over it: a thick ledge in the next row up only
  // reaches down into them, and is thinned there. The next row's own floor is a rise up, past them.
  for (const c of courses) for (const [a, b] of c.ledges) g.clear(a, c.row - 1, b, c.row);

  kit.shell?.(g, rng, [spawn, goal], k);
  return closeLoop(finish(g, { row: bottom }, { row: top, depth: 2 }, `${kit.style}:shaft`), loop);
}

/**
 * Close a Rising Slag shaft into a loop (`Level.loop`): make its top band the same rows as its bottom one. Above the
 * spawn storey's floor the spawn storey wins (its air, and the foot of the climb out of it); from the floor down the
 * top storey wins (the head of the climb into it), except under the spawn pocket. Then wall both sides, terrain you
 * can see all the way up, and put the goal on the spawn's copy a lap up: proving it reachable proves a lap. The
 * band is protected, both copies, so nothing placed can make the two differ.
 */
function closeLoop(shape: Shape, loop: number): Shape {
  const { w, h, tiles } = shape;
  const sync = (a: Uint8Array) => {
    for (let r = 0; r < LOOP_BAND; r++)
      for (let x = 0; x < w; x++) {
        const upper = r * w + x;
        const lower = (r + loop) * w + x;
        if (r <= LOOP_SPAWN || x < POCKET) a[upper] = a[lower];
        else a[lower] = a[upper];
      }
  };
  sync(tiles);
  if (shape.ground) sync(shape.ground);
  for (let y = 0; y < h; y++) {
    tiles[y * w] = T_SOLID;
    tiles[y * w + w - 1] = T_SOLID;
  }
  return {
    ...shape,
    spawn: { tx: shape.spawn.tx, ty: loop + LOOP_SPAWN },
    goal: { tx: shape.spawn.tx, ty: LOOP_SPAWN },
    protectedRects: [
      { x: 0, y: 0, w, h: LOOP_BAND },
      { x: 0, y: loop, w, h: LOOP_BAND },
    ],
    bridgeHints: [],
  };
}
