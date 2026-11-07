import { withDifficulty } from '../difficulty';
import { Grid, POCKET, T_EMPTY, T_ONEWAY, T_SOLID } from '../kit';
import { jumpProfile } from '../probe';
import { easyRise, hopGap, knobs, LAST_RESORT } from '../sculptors/common';
import type { Storey, TallKit } from '../sculptors/tall';
import type { SculptCtx, Shape } from '../types';

/**
 * A Brawl arena (docs/MODES.md → Brawl): one screen of ledges stacked in tiers from islands over the pit up to the top
 * of the view, built for knocking people off things. The screen is cut into bands of columns with shafts between them,
 * clear from the top tier down to the pit: every tier is a ledge on each band, so a knock off nearly any ledge falls
 * out of the arena rather than onto the ledge below, and the outermost ledges run off the open sides, where a knock
 * carries you off the map. Each tier's ledges step in a column at alternate ends, so every band climbs (`climbs`).
 * One band each side is a hall: a floor on the bottom tier, nothing over it but a roof `HALL_ROWS` up, stepped and
 * with a pier hanging at one end, and nothing over the roof: room for whatever the set stands on a floor, hangs from a
 * ceiling or mounts on a wall, which tiers a jump apart never leave (the set's pieces are the placer's, the room is
 * the arena's, the same for every set). The two ends mirror each other (the same tiers, ledges and kinds; the set's
 * floor varies the details), so neither spawn gets the high ground.
 *
 * What varies by seed: how the tiers fill the screen (`SHAPES`: full tiers, a pyramid with the high ground in the
 * middle, a bowl with it at the sides), which tier the two spawns stand on, the tiers' rows, the bands and shafts,
 * whether the halls stand by the sides or by the middle, which ledges are boards you jump up through and which are the
 * set's own floor, and which islands of the bottom tier stand on the bottom. It owes no part: every tier is a jump or a
 * drop from the next, shafts are walking jumps (`hopGap`), and the pipeline proves each end reaches the other bare.
 */

/**
 * How the tiers fill the screen: every tier full width, upper tiers drawn in to the middle, or out to the sides.
 * Weighted against the draws the pipeline turns down for their precision (a bowl's way across is the bottom tiers'
 * running jumps, a tight route for a gentle level), so each comes out in about a third of arenas.
 */
type ArenaShape = 'tiers' | 'pyramid' | 'bowl';
const SHAPES: readonly (readonly [ArenaShape, number])[] = [
  ['tiers', 2],
  ['pyramid', 2],
  ['bowl', 3],
];

/**
 * Band widths and the share of upper ledges that are boards, per tier: wide and forgiving on gentle, narrow on hard.
 * Narrow enough that from anywhere on a ledge a knock of three tiles or so reaches a shaft or a side.
 */
const LEDGES = {
  gentle: { ledge: [5, 6], boards: 0.5 },
  medium: { ledge: [4, 6], boards: 0.4 },
  hard: { ledge: [3, 5], boards: 0.3 },
} as const;

/** Stand rows the top tier takes: in the top third of the view, with room over it for a jump. */
const TOP = [5, 7] as const;
/** Share of the bottom tier's islands that stand on the bottom (a mesa) rather than float over the pit. */
const MESAS = 0.35;
/** Columns the spawn ledge runs on past its pocket. */
const SPAWN_STEPS = [1, 3] as const;
/** Rows of the lip at the outer edge of each spawn pocket. */
const LIP = 2;
/** How far in (a share of the half width) the top tier's band starts (pyramid) or stops short (bowl). */
const DRAW_IN = 0.55;
/**
 * A hall's floor columns, and the rows from its floor up to its roof: room for what stands on a floor and what hangs
 * from a ceiling (a press in its gantry, a forklift's run, a ladle's pour, a pendulum's arc, a roof's cave-in), which
 * tiers a jump apart never leave between them, and nothing over the roof, the same room again on top of it.
 */
const HALL = [9, 11] as const;
const HALL_ROWS = 9;
/** Rows a hall's pier hangs under its roof. */
const PIER = 4;

/** A band of the left half's columns, a ledge on it every tier; `b` at the half's last column joins its mirror. */
interface Band {
  a: number;
  b: number;
  hall: boolean;
}

/** One ledge of the left half: stand row `row`, columns [a, b]; `b` at the half's last column joins its mirror. */
interface Ledge {
  /** Its tier, and its band (-1 for a board over a bowl's middle). */
  t: number;
  i: number;
  row: number;
  a: number;
  b: number;
  board: boolean;
  ground: boolean;
}

/** Build the arena with a set's tower kit: its floor for the solid ledges and islands, its dressing on them. */
export function sculptArena(ctx: SculptCtx, kit: TallKit): Shape {
  const { rng } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const g = new Grid(W, H);
  const j = jumpProfile();
  // The last attempts lay gentle ledges, which always connect.
  const tier = ctx.attempt >= LAST_RESORT ? 'gentle' : ctx.profile.difficulty;
  const sizes = LEDGES[tier];
  const shape = rng.weighted(SHAPES);
  const half = W >> 1;
  const mid = half - 1;

  // Tier rows, bottom first, evenly from the bottom tier up to the top one near the top of the view: as many as keep
  // them at most a jump apart (one rise up through a board or beside a ledge).
  // No farther apart than at normal gravity: a floatier jump goes higher, but the screen keeps its tiers.
  const spacing = Math.max(4, Math.min(j.rise, withDifficulty(tier, () => Math.min(easyRise(), easyRise(1))) + 1));
  const bottom = H - rng.int(5, 7);
  const top = rng.int(TOP[0], TOP[1]);
  const steps = Math.max(1, Math.ceil((bottom - top) / spacing));
  const rows = Array.from({ length: steps + 1 }, (_, i) => Math.round(bottom - ((bottom - top) * i) / steps));
  const n = rows.length;
  // The spawns stand at the two ends of the bottom tier or the one over it: never the top, never the high ground.
  const spawnTier = n > 2 && rng.chance(0.5) ? 1 : 0;

  // Gaps as wide as a normal gravity's: a floatier jump carries further, but a wider gap only empties the screen.
  const floaty = Math.min(1, jumpProfile(1).walkGap / j.walkGap);
  const widest = jumpProfile(1).walkGap;
  const gap = () => Math.min(widest, Math.max(2, Math.round(hopGap(rng, 2) * floaty)));
  const most = Math.min(widest, Math.max(2, Math.round(j.walkGap * floaty)));

  // The bands, from the side in: the side band holds the spawn; a hall either side, by the side or by the middle, and
  // bands of ledges the rest of the way; in the middle, a ledge across it beyond a shaft, or a shaft no wider than a
  // gap. Each shaft is a gap's width less the column every tier's ledges step in by at one end (below), so every tier
  // crosses it with a hop.
  const shaft = () => Math.max(1, gap() - 1);
  const [least, widestBand] = sizes.ledge;
  const bands: Band[] = [];
  /** Bands from column `x` to `end`, shafts between them. */
  const fill = (x: number, end: number) => {
    for (;;) {
      const rest = end - x + 1;
      const c = shaft();
      // Three columns at least, so a ledge stepped in at one end still has two.
      if (rest <= widestBand || rest - c < 6) return void bands.push({ a: x, b: end, hall: false });
      const w = Math.max(3, Math.min(rng.int(least, widestBand), rest - c - 3));
      bands.push({ a: x, b: x + w - 1, hall: false });
      x += w + c;
    }
  };
  const side = POCKET + rng.int(SPAWN_STEPS[0], SPAWN_STEPS[1]);
  bands.push({ a: 0, b: side - 1, hall: false });
  const x = side + shaft();
  const across = rng.chance(0.5) ? rng.int(2, 3) : 0;
  const end = across ? mid - across - shaft() : mid - 1;
  // A pyramid's halls stand by the sides, under the air its drawn-in tiers leave; a bowl's by the middle, under its.
  const inner = shape === 'bowl' || (shape === 'tiers' && rng.chance(0.5));
  const room = end - x + 1;
  const c = shaft();
  let w = rng.int(HALL[0], HALL[1]);
  if (room < w + c + 3) w = room >= HALL[0] - 1 + c + 3 ? room - c - 3 : room;
  if (w === room) bands.push({ a: x, b: end, hall: true });
  else if (inner) {
    fill(x, end - w - c);
    bands.push({ a: end - w + 1, b: end, hall: true });
  } else {
    bands.push({ a: x, b: x + w - 1, hall: true });
    fill(x + w + c, end);
  }
  if (across) bands.push({ a: mid - across + 1, b: mid, hall: false });
  // A hall's floor is the bottom tier and its roof `HALL_ROWS` over it, the set's floor whole across the band, a
  // ceiling to hang from; no tier takes its band but the floor, so the roof has the sky over it. The roof counts as
  // the tier at or under its row, for the climbs.
  const roofRow = rows[0] - HALL_ROWS;
  const roof = Math.max(1, rows.filter((r) => r >= roofRow).length - 1);
  const inHall = (band: Band, t: number) => band.hall && t > 0;
  const hallEnd = Math.max(...bands.filter((b) => b.hall).map((b) => b.b));

  const ledges: Ledge[] = [];
  // Bricks in miniature: each tier's ledges step in a column at one end and the next tier's at the other, so every
  // band climbs, a jump up beside the ledge over it at alternate ends.
  const phase = rng.int(0, 1);
  for (let t = 0; t < n; t++) {
    const row = rows[t];
    const up = n > 1 ? t / (n - 1) : 0;
    // The band of the half this tier fills: a pyramid draws its upper tiers in to the middle, a bowl out to the sides.
    let lo = shape === 'pyramid' ? Math.round(up * half * DRAW_IN) : 0;
    const hi = shape === 'bowl' ? mid - Math.round(up * half * DRAW_IN) : mid;
    if (t === spawnTier) lo = 0;
    // The tier over the spawns keeps off the air over their pockets, which would cut it, and the one under them off
    // the columns under the pockets: an island stacked under a whole spawn ledge is a crawlspace a runner can't jump
    // out of (a bot spent most of 17 s in one), and under the open side it should be the drop anyway.
    if (t === spawnTier + 1) lo = Math.max(lo, POCKET + 1);
    if (t === spawnTier - 1) lo = Math.max(lo, POCKET);
    const islands = t === 0;
    const right = (t + phase) % 2 === 0;
    bands.forEach((band, i) => {
      if (inHall(band, t)) return;
      const spawn = i === 0 && t === spawnTier;
      // A hall's floor runs whole, the width of its band; any other ledge steps in, across the middle with its mirror.
      const whole = band.hall;
      const a = Math.max(lo, band.a + (!right && !spawn && !whole ? 1 : 0));
      const b = Math.min(hi, band.b - (right && !whole ? 1 : 0));
      if (b - a + 1 < 2) return;
      const board = !islands && !spawn && rng.chance(sizes.boards);
      // An island at the side floats, so the side stays open down to the pit.
      ledges.push({ t, i, row, a, b, board, ground: islands && i > 0 && rng.chance(MESAS) });
    });
    // The middle: no wider a void than a gap. A bowl's tiers under the top one, drawn back to the sides, get a board
    // over it, clear of a hall's air.
    const far = ledges.filter((l) => l.row === row).reduce((m, l) => Math.max(m, l.b), lo - 1);
    const a = Math.max(mid - rng.int(1, 3), hallEnd + 2);
    if (far < mid && 2 * (mid - far) > widest && t < n - 1 && a <= mid) ledges.push({ t, i: -1, row, a, b: mid, board: true, ground: false });
  }
  bands.forEach((band, i) => {
    if (band.hall && roofRow > TOP[0]) ledges.push({ t: roof, i, row: roofRow, a: band.a, b: band.b, board: false, ground: false });
  });
  climbs(ledges, n, spawnTier, W, most);

  // Lay each ledge and its mirror (one ledge across the middle when it reaches it): boards as one-way planks, the rest
  // as the set's floor, its two ends solid whatever boards the set lays in it, for the climb onto it.
  const lay = (l: Ledge, a: number, b: number) => {
    if (l.board) return g.plank(a, b, l.row + 1);
    kit.deck(g, rng, storey(l.row, a, b), a, b, l.ground, k);
    for (const x of [a, b]) if (g.get(x, l.row + 1) === T_ONEWAY) g.set(x, l.row + 1, T_SOLID, true);
  };
  for (const l of ledges) {
    if (l.b === mid) lay(l, l.a, W - 1 - l.a);
    else {
      lay(l, l.a, l.b);
      lay(l, W - 1 - l.b, W - 1 - l.a);
    }
  }
  const spans = ledges.flatMap((l) =>
    l.b === mid
      ? [[l.row, l.a, W - 1 - l.a]]
      : [
          [l.row, l.a, l.b],
          [l.row, W - 1 - l.b, W - 1 - l.a],
        ],
  );
  kit.dress?.(
    g,
    rng,
    spans.map(([row, a, b]) => storey(row, a, b)),
    [],
    k,
  );
  // Whatever the set's floor or dressing lays, every ledge keeps two rows of air over it: a thick ledge above only
  // reaches down into them, and is thinned there.
  for (const [row, a, b] of spans) g.clear(a, row - 1, b, row);
  // The shafts stay open from over the top tier down to the pit, whatever the set's dressing hung in them.
  bands.forEach((band, i) => {
    const a = band.b + 1;
    const b = i + 1 < bands.length ? bands[i + 1].a - 1 : mid;
    if (a > b) return;
    g.clear(a, rows[n - 1] - 2, b, H - 1);
    g.clear(W - 1 - b, rows[n - 1] - 2, W - 1 - a, H - 1);
  });
  // Each hall's roof steps a row down over its outer half, two heights of room under it (a low roof's gas pocket, a
  // tall one's pendulum), and at its end by the middle a pier hangs `PIER` rows: a wall face to mount on (a broken
  // window's glass), with more than a runner's height of air under it.
  const under = (x: number) => {
    let c = roofRow + 1;
    if (g.get(x, c) !== T_SOLID) return -1;
    while (c + 1 < H && g.get(x, c + 1) === T_SOLID) c++;
    return c;
  };
  const both = (x: number, y0: number, y1: number) => {
    g.fill(x, y0, x, y1, T_SOLID, true);
    g.fill(W - 1 - x, y0, W - 1 - x, y1, T_SOLID, true);
  };
  for (const band of bands) {
    if (!band.hall || roofRow <= TOP[0]) continue;
    for (let x = band.a; x < (band.a + band.b + 1) >> 1; x++) {
      const c = under(x);
      if (c >= 0) both(x, c + 1, c + 1);
    }
    const c = under(band.b);
    if (c >= 0 && rows[0] - (c + PIER) >= 3) both(band.b, c + 1, c + PIER);
  }
  // A board is somewhere to stand or it goes: none in the top rows, over the top tier (timber the set's dressing hangs
  // under a ceiling the arena hasn't got), and none without two rows of air over it (timber under a ledge, a second
  // board doubled under the first),
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (g.get(x, y) === T_ONEWAY && (y <= TOP[0] - 3 || !g.empty(x, y - 1) || !g.empty(x, y - 2))) g.set(x, y, T_EMPTY, true);
  // and a stub that leaves goes too: a board a tile wide with nothing either side.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.get(x, y) === T_ONEWAY && g.empty(x - 1, y) && g.empty(x + 1, y)) g.set(x, y, T_EMPTY, true);

  // The two ends, mirrored: a pocket on the spawn tier at each side, with a lip at the edge, so nobody holding a
  // direction at GO walks off the map; leaving takes a jump on purpose. A post taller than a jump (a race's spawn)
  // would wall the spawn tier's sides, and with them a third of the knocks off the map. Above and below it the sides
  // are open.
  const row = rows[spawnTier];
  for (const [x0, edge] of [
    [0, 0],
    [W - POCKET, W - 1],
  ] as const) {
    g.clear(x0, row - 3, x0 + POCKET - 1, row);
    g.fill(x0, row + 1, x0 + POCKET - 1, row + 1, T_SOLID, true);
    g.fill(edge, row - LIP + 1, edge, row, T_SOLID, true);
  }
  return {
    w: W,
    h: H,
    tiles: g.t,
    spawn: { tx: 2, ty: row },
    goal: { tx: W - 3, ty: row },
    protectedRects: [
      { x: 0, y: row - 3, w: POCKET, h: 5 },
      { x: W - POCKET, y: row - 3, w: POCKET, h: 5 },
    ],
    style: `${kit.style}:arena-${shape}`,
    bridgeHints: [],
    open: bands
      .filter((b) => b.hall)
      .flatMap((b): [number, number][] =>
        b.b === mid
          ? [[b.a, W - 1 - b.a]]
          : [
              [b.a, b.b],
              [W - 1 - b.b, W - 1 - b.a],
            ],
      ),
  };
}

/** Columns of air a jump up from one tier onto the next carries across beside a ledge, from a standstill. */
const ACROSS = 3;

/**
 * Every tier climbs, by construction: a ledge is climbed onto from the tier under it where the ledge under it sticks
 * out past one of its ends (a jump up beside it), or across a shaft of `ACROSS` or less; a board only from its own
 * tier (the real controller never lands on one a full tier's rise straight over it, src/sim/reach.ts). The ledges a
 * hop apart on a tier are one stretch, climbed when any of its solid ledges is. A stretch none of whose ledges climbs
 * gets a board of it laid solid where that climbs, or else one ledge stepped in a column over the ledge under it. The
 * rule is the normal gravity's and cautious: a stretch it can't prove stays, for a floatier jump or a run-up to reach.
 * Ledges are the left half's; a ledge to the middle (`b` at the half's last column) is whole across it, and a band's
 * mirror across the middle is a neighbour.
 */
function climbs(ledges: Ledge[], n: number, from: number, W: number, hop: number): void {
  const mid = (W >> 1) - 1;
  // Both halves' spans of a tier, for the neighbours across the middle.
  const spans = (t: number) =>
    ledges
      .filter((l) => l.t === t)
      .flatMap((l) =>
        l.b === mid
          ? [{ l, a: l.a, b: W - 1 - l.a }]
          : [
              { l, a: l.a, b: l.b },
              { l, a: W - 1 - l.b, b: W - 1 - l.a },
            ],
      );
  let reached = new Set(ledges.filter((l) => l.t <= from));
  for (let t = from + 1; t < n; t++) {
    const below = spans(t - 1).filter((s) => reached.has(s.l));
    const onto = (l: Ledge) =>
      !l.board &&
      below.some(
        (d) =>
          (d.l.i === l.i && d.l.i >= 0 && (d.a < l.a || d.b > (l.b === mid ? W - 1 - l.a : l.b))) ||
          (d.b < l.a && l.a - d.b - 1 <= ACROSS) ||
          (d.a > l.b && d.a - l.b - 1 <= ACROSS),
      );
    // The tier's stretches, left to right over the left half (a ledge to the middle ends it).
    const tier = ledges.filter((l) => l.t === t).sort((p, q) => p.a - q.a);
    const stretches: Ledge[][] = [];
    for (const l of tier) {
      const s = stretches[stretches.length - 1];
      if (s && l.a - s[s.length - 1].b - 1 <= hop) s.push(l);
      else stretches.push([l]);
    }
    const next = new Set(reached);
    for (const s of stretches) {
      // A board of it laid solid climbs from across a shaft; or one ledge steps in over the ledge under it. Innermost
      // first: the middle is where the fight goes.
      const inward = s.map((_, k) => s[s.length - 1 - k]);
      for (const l of inward) {
        if (s.some(onto) || !l.board) continue;
        l.board = false;
        if (!onto(l)) l.board = true;
      }
      if (!s.some(onto)) {
        for (const l of inward) {
          const under = below.filter((q) => q.l.i === l.i && l.i >= 0);
          const left = under.find((q) => q.a <= l.a && q.b >= l.a && l.b - q.a >= 2);
          const right = l.b === mid ? undefined : under.find((q) => q.a <= l.b && q.b >= l.b && q.b - l.a >= 2);
          if (!left && !right) continue;
          l.board = false;
          if (left) l.a = left.a + 1;
          else if (right) l.b = right.b - 1;
          break;
        }
      }
      if (s.some(onto)) for (const l of s) next.add(l);
    }
    reached = next;
  }
}

/** A ledge as the tower kit's storey: arrive and leave at its ends, so the set's dressing keeps off them. */
function storey(row: number, a: number, b: number): Storey {
  return { row, arrive: a, leave: b, x0: a, x1: b };
}
