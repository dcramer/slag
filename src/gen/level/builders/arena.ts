import { Grid, POCKET, T_EMPTY, T_ONEWAY, T_SOLID } from '../kit';
import { jumpProfile } from '../probe';
import { hopGap, knobs, LAST_RESORT } from '../sculptors/common';
import type { Storey, TallKit } from '../sculptors/tall';
import type { TileRect } from '../../../sim/level';
import type { SculptCtx, Shape } from '../types';

/**
 * A Brawl arena (docs/MODES.md → Brawl): a platform fighter's stage, as the crossover brawler's are (owner decision).
 * A main stage floats over the drop across the screen, open at both ends, with air between each end and the side of
 * the map, where a knock carries you off it, and nothing under it but the drop. It's laid in slabs a few columns wide
 * with seams of drop between them, each a walking jump (`hopGap`), so a knock from nearly anywhere on it is a fall that
 * kills (`Measures.falls`, level/measure.ts). Each slab is thick enough that its ends are wall faces a knocked runner
 * slides down and jumps back up from: the seams are chimneys and the ends cliffs, the recovery and the edge-guarding
 * over it. Over the stage, boards you jump up through (and drop through, down and jump) stand straight over the slabs
 * and their width, so a knock off one falls past the slab's end too: the spawn's slab a layer at a time, as high as
 * the real controller lands on one straight up, and every slab past it one board high up (`highRows`) with headroom
 * under it, reached across a seam from the layers beside it. Those boards are a second way across, over the stage.
 *
 * What varies by seed: its outline (`OUTLINES`: flat, stepped up at the ends, peaked or dipped in the middle), the
 * slabs, seams and side air, its centre (below), a court by the middle (a slab wider than the rest, for what runs along
 * a floor), canopies (a solid roof over a slab, two layers up: a ceiling over a floor and a floor with the sky over it),
 * a pillar under a slab a side (rock to the bottom, a wall down the seam beside it that still falls to the drop), the
 * layers stacked over the boards, and a small ledge out over each side's drop. Both spawns stand on the outermost
 * slab of their side, the spawn's shield covering GO. The two halves mirror each other (the set's floor varies the
 * details), so neither end gets the high ground. It owes no part, and the pipeline proves each end reaches the other.
 *
 * The set's pieces need room, the same for every set (no per-theme tuning): headroom over a floor (under the high
 * boards, in a court, a hall, the sky over the top boards and roofs), a ceiling (a canopy, a hall's roof, an arch's
 * beam, the stage's underside over the drop) and wall faces (every slab's ends, a hall's pier).
 */

/**
 * The stage's outline, slab by slab from the side in: flat, the outer slabs stepped up over the middle, the middle
 * peaked over the ends, or dipped under them. The style's last segment, so the contract's `shapes` counts each; a flat
 * one weighted up, as the pipeline turns more of them down.
 */
type Outline = 'flat' | 'ends' | 'peak' | 'dip';
const OUTLINES: readonly (readonly [Outline, number])[] = [
  ['flat', 1.5],
  ['ends', 1],
  ['peak', 1],
  ['dip', 1],
];

/**
 * Slab widths, by difficulty: no wider than six, so from anywhere on one a fall is within three tiles (`DEADLY_NEAR`,
 * level/measure.ts), and narrower on hard. The outermost holds a spawn and its fanned-out field, so it's five at least.
 * Wider (5 to 7) cost the falls share two points and stood no more set pieces.
 */
const SLABS = {
  gentle: [5, 6],
  medium: [4, 6],
  hard: [4, 5],
} as const;
/** The spawn's slab, at least. */
const SPAWN_SLAB = 5;
/** A court's width, and the odds of one: the innermost slab widened, when there's no hall. */
const COURT = [8, 9] as const;
const COURT_ODDS = 0.85;
/** Columns of air between the stage's ends and the side of the map. */
const SIDE = [2, 4] as const;
/** Rows from the stage's stand row down to the bottom of the screen, its slab and the drop under it. */
const UNDER = [10, 11] as const;
/** Rows thick a slab is (its ends' wall faces), and rows of drop under it at least. */
const THICK = [4, 5] as const;
const DROP = 5;
/** Rows a step of the outline rises or falls, from the stage's base row. */
const STEP = [1, 2] as const;
/** Boards over a slab, at most, but for the way up to a high board, a hall's roof or an arch's beam. */
const LAYERS = 4;
/** Odds a board has another over it on the layer up (never over a high board's height), and of a board over an arch's beam. */
const STACK = 0.35;
const CENTRE_BOARD = 0.6;
/** Odds of a small solid ledge out over each side's drop, a jump from the stage's end, and its width. */
const SIDE_LEDGE = 0.5;
const SIDE_LEDGE_W = [2, 3] as const;
const SIDE_RISE = 3;
/** Odds of a canopy over each high slab, and the rows from the slab's stand row to the canopy's. */
const CANOPY = 0.85;
const CANOPY_ROWS = [5, 7] as const;
/** Odds of a slab a side standing on a pillar of rock to the bottom. */
const PILLAR = 0.5;
/** The highest stand row a board takes: room over it for a jump. */
const TOP_BOARD = 4;

/**
 * A hall's floor columns, and the rows from its floor up to its roof: room for what stands on a floor and what hangs
 * from a ceiling (a press in its gantry, a forklift's run, a ladle's pour, a pendulum's arc, a roof's cave-in), which
 * boards a jump apart never leave between them, and nothing over the roof.
 */
const HALL = [8, 9] as const;
const HALL_ROWS = 9;
/** Rows a hall's pier hangs under its roof. */
const PIER = 4;

/**
 * What the arena is built round (`Shape.centre`): the room its centrepiece stands in, the set's own hazard that goes in
 * before any other set piece, and the stage laid to bring the fight to it.
 * - `pit`: the stage splits in the middle round a pit `PIT_HALF` × 2 columns wide, clear from the top of the view down,
 *   the two halves its islands: for what rises out of a pit, leaps across one or sweeps it.
 * - `halls`: a slab each side by the middle widened to a hall, a solid roof `HALL_ROWS` over it stepped a row down
 *   over its outer half with a pier hanging at its inner end: a floor, a ceiling and a wall face, for what stands on a
 *   floor, hangs from a ceiling or mounts on a wall, a pair, one in each, mirrored across the middle; shared once it
 *   stands, the room the rest of a set's machines need.
 * - `arch`: a crossing `ARCH_HALF` columns either side of the middle, split by a seam `ARCH_SEAM` wide under a beam
 *   `ARCH` rows up with nothing else between, for what swings or drops across the way over: a log, an axe, a hook.
 *   Shared once it stands.
 * Only a pit is the centrepiece's alone. A kind none of the set's hazards stood in (`SculptCtx.noCentre`) isn't laid
 * again in that draw, so a set whose hazards stand in neither a pit nor an arch gets the halls. The arch comes up
 * most, the halls as often as a pit (1 in 7 on the tiered arena, where other floors held a set's machines).
 */
const CENTRES = ['pit', 'halls', 'arch'] as const;
type CentreKind = (typeof CENTRES)[number];
const CENTRE_WEIGHTS: Record<CentreKind, number> = { pit: 2, halls: 2, arch: 3 };
/** Half a pit's width: as wide as a walking jump at normal gravity, and as a serpent's leap needs. */
const PIT_HALF = 2;
/** Half the crossing under an arch: as wide as a slung log's swing (`jungle.ts` logTraps) and then some. */
const ARCH_HALF = [4, 5] as const;
/** Rows from the crossing's stand row up to the beam's: what hangs from it swings through a runner's height over the floor. */
const ARCH = 7;
/** Half the beam's width. */
const BEAM_HALF = 2;
/**
 * Columns of the seam down the middle of an arch's crossing, under the beam: what swings or drops from the beam does it
 * over a fall, and nothing drives the crossing end to end (a tractor there walled the middle of the stage: what stood
 * either side of it was turned down for closing the last way across).
 */
const ARCH_SEAM = 2;
/** Half a plain centre slab across the middle, when there's no centrepiece to lay round. */
const MIDDLE_HALF = [2, 3] as const;

/** Something to stand on, in the left half: stand row `row`, columns [a, b]; `b` at the half's last column runs whole across the middle. */
interface Span {
  row: number;
  a: number;
  b: number;
  kind: 'slab' | 'board' | 'ledge';
  hall?: boolean;
  /** A court: a long floor with the headroom of a high board over it, never a canopy's. */
  court?: boolean;
  /** An arch's crossing, the left half of it: its seam down the middle under the beam. */
  arch?: boolean;
}

/** Build the arena with a set's tower kit: its floor for the slabs, roofs and ledges, its dressing on them. */
export function sculptArena(ctx: SculptCtx, kit: TallKit): Shape {
  const { rng } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const g = new Grid(W, H);
  const j = jumpProfile();
  // The last attempts lay gentle slabs, which always connect.
  const tier = ctx.attempt >= LAST_RESORT ? 'gentle' : ctx.profile.difficulty;
  const [least, widest] = SLABS[tier];
  const outline = rng.weighted(OUTLINES);
  const half = W >> 1;
  const mid = half - 1;
  // The centre first, of the kinds the set's hazards haven't turned down: the rest is laid round it.
  const kinds = CENTRES.filter((c) => !ctx.noCentre?.includes(c));
  let roll = rng.next() * kinds.reduce((t, c) => t + CENTRE_WEIGHTS[c], 0);
  const centre = kinds.find((c) => (roll -= CENTRE_WEIGHTS[c]) < 0) ?? kinds.at(-1) ?? null;

  // Layers of boards a jump up through apart: as high as the real controller lands on one straight over it
  // (src/sim/reach.ts), three rows at normal gravity and two at high; a step to a ledge beside it, a row or so more.
  const layer = Math.max(2, Math.min(4, j.rise - 3));
  // Seams as wide as a normal gravity's walking jump: a floatier jump carries further, but a wider seam only empties the stage.
  const floaty = Math.min(1, jumpProfile(1).walkGap / j.walkGap);
  const widestGap = jumpProfile(1).walkGap;
  const seam = () => Math.min(widestGap, Math.max(2, Math.round(hopGap(rng, 2) * floaty)));
  const step = rng.int(STEP[0], STEP[1]);
  // A dip's middle goes down from the base row, its slabs thinner there: the drop stays under it, the sky over it.
  const base = H - rng.int(UNDER[0], UNDER[1]);

  // The innermost slab, by the middle, is now and then a court, wider: a long floor for what runs along one (a cart, a
  // forklift, a combine, a robot arm's sweep), with the narrowest seams either side, so it fits by an arch too.
  let court = centre !== 'halls' && rng.chance(COURT_ODDS) ? rng.int(COURT[0], COURT[1]) : 0;
  const inner = () => (court ? 2 : seam());
  // The middle: a pit's lip, an arch's crossing, or (with no centre to lay round) a slab across it or a seam.
  const slabs: Span[] = [];
  let end: number;
  if (centre === 'pit') end = mid - PIT_HALF;
  else if (centre === 'arch') {
    const archHalf = rng.int(ARCH_HALF[0], ARCH_HALF[1]);
    slabs.push({ row: base, a: mid - archHalf + 1, b: mid - ARCH_SEAM / 2, kind: 'slab', arch: true });
    end = mid - archHalf - inner();
  } else if (rng.chance(0.5)) {
    const m = rng.int(MIDDLE_HALF[0], MIDDLE_HALF[1]);
    slabs.push({ row: base, a: mid - m + 1, b: mid, kind: 'slab' });
    end = mid - m - inner();
  } else end = mid - Math.max(1, seam() >> 1);
  // A hall stands by the middle, off the spawn's slab: its floor is the innermost slab.
  if (centre === 'halls') {
    const c = seam();
    // No wider than leaves the spawn's slab its room past it.
    const w = Math.min(rng.int(HALL[0], HALL[1]), end - c - SPAWN_SLAB - SIDE[0] + 1);
    slabs.push({ row: base, a: end - w + 1, b: end, kind: 'slab', hall: true });
    end -= w + c;
  }
  // Slabs from the middle out, seams between, until the side's air is what's left.
  for (let x = end; ;) {
    const c = inner();
    // A court with no room past it for the spawn's slab is a slab like the rest.
    if (x - court + 1 - c - SPAWN_SLAB < SIDE[0]) court = 0;
    const w = court || rng.int(least, widest);
    const wide = !!court;
    court = 0;
    const a = x - w + 1;
    // Room past it for the spawn's slab and the side's air: on; or it's the last, the spawn's, and the side takes the rest.
    if (a - c - SPAWN_SLAB >= SIDE[0] && !(a <= SIDE[1] + 2 && rng.chance(0.35))) {
      slabs.push({ row: base, a, b: x, kind: 'slab', ...(wide ? { court: true } : {}) });
      x = a - c - 1;
      continue;
    }
    // The spawn's slab, wide enough for the field it fans out. Past one with more air than the side takes, the
    // spawn's goes beyond it across the narrowest seam if it fits, or else it runs on out toward the side.
    const from = Math.max(2, Math.min(Math.max(SIDE[0], a), x - SPAWN_SLAB + 1));
    if (from > SIDE[1] && from - 3 - SPAWN_SLAB + 1 >= SIDE[0]) {
      slabs.push({ row: base, a: from, b: x, kind: 'slab' });
      slabs.push({ row: base, a: Math.max(SIDE[0], from - 2 - widest), b: from - 3, kind: 'slab' });
    } else slabs.push({ row: base, a: from > SIDE[1] ? Math.max(SIDE[1], x - widest - 1) : from, b: x, kind: 'slab' });
    break;
  }
  // Outermost first; each slab's row from the outline, by how far in it stands.
  slabs.sort((p, q) => p.a - q.a);
  const n = slabs.length;
  slabs.forEach((s, i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    const off = outline === 'ends' ? -Math.round(step * (1 - t)) : outline === 'peak' ? -Math.round(step * t) : outline === 'dip' ? Math.round(step * t) : 0;
    s.row = base + off;
  });
  const spawn = slabs[0];
  const hall = slabs.find((s) => s.hall);
  const crossing = slabs.find((s) => s.arch);
  const beamRow = crossing ? crossing.row - ARCH : -1;
  const roofRow = hall ? hall.row - HALL_ROWS : -1;
  // Past the spawn's, every slab outside a room (a hall, an arch's crossing) is high: its first board `highRows` up,
  // headroom under it for what stands on its floor (tried alternating low and high: the set pieces found too little
  // room, a factory's standing two in three of its ask). The spawn's slab is low, its layers the way up. A canopy over
  // most high slabs, but a court's or a pit's lip; and now and then one slab a side stands on a pillar.
  const regular = slabs.map((s) => !s.hall && s !== crossing);
  const high = slabs.map((_, i) => regular[i] && i > 0);
  const covers = slabs.filter((s, i) => i > 0 && high[i] && !s.court && !s.hall && s !== crossing && !(centre === 'pit' && s.b === mid - PIT_HALF));
  const canopies = new Set(covers.filter(() => rng.chance(CANOPY)));
  // A high board stands three layers up (no higher than a hall's roof); a canopy two.
  const highRows = Math.min(HALL_ROWS, 3 * layer);
  const roofed = Math.max(CANOPY_ROWS[0], Math.min(CANOPY_ROWS[1], 2 * layer));
  const pillar = n > 1 && rng.chance(PILLAR) ? rng.pick(slabs.slice(1)) : undefined;

  // The rooms nothing else stands in: a hall's air under its roof, the swing under an arch's beam, a pit's columns.
  const rooms = centreRooms(centre, slabs, mid, W, H, beamRow, roofRow);
  // A pit's room takes its lips, which the boards over the slabs beside it run to.
  const inRoom = (row: number, a: number, b: number) =>
    centre !== 'pit' &&
    rooms.some((r) => row + 1 >= r.y && row - 1 < r.y + r.h && [a, W - 1 - b].some((x0, i) => x0 < r.x + r.w && (i ? W - 1 - a : b) >= r.x));

  // Boards over the slabs, straight over them and their width, so a knock off one falls past the slab's end. None in
  // a room or over a pit; over a hall the way across goes on along its roof, over an arch's crossing along its beam,
  // reached from a board beside it a row over the beam.
  const spans: Span[] = [...slabs];
  const boards: Span[] = [];
  const over = (s: Span, row: number, a = s.a, b = s.b) => {
    if (row < TOP_BOARD || inRoom(row, a, b)) return null;
    // One there already runs on as far as this one would.
    const there = boards.find((q) => q.row === row && q.a <= b + 1 && q.b >= a - 1);
    if (there) return Object.assign(there, { a: Math.min(there.a, a), b: Math.max(there.b, b) });
    const board: Span = { row, a, b, kind: 'board' };
    boards.push(board);
    return board;
  };
  const by = (i: number) => slabs[i] as Span | undefined;
  // Each slab's first board: a layer up over a low one, `highRows` up over a high one; a canopy is a high one's. A high
  // one beside an arch's crossing is the board a row over the beam, that runs on to it: one board, not two a row apart.
  const first = slabs.map((s, i) =>
    canopies.has(s)
      ? s.row - roofed
      : s.hall || s === crossing
        ? -Infinity
        : high[i] && crossing && by(i + 1) === crossing && beamRow > TOP_BOARD
          ? beamRow - 1
          : s.row - (high[i] ? highRows : layer),
  );
  slabs.forEach((s, i) => {
    if (s.hall || s === crossing) return;
    // Beside a high board, a hall's or a canopy's roof, the layers go on up to a jump under it (a step under a roof);
    // beside an arch's crossing, to a jump under the board onto its beam. Over a high board or a canopy, by chance.
    const near = [by(i - 1), by(i + 1)];
    const need = Math.max(
      ...near.map((q, d) => (q && high[i + 2 * d - 1] ? first[i + 2 * d - 1] + (canopies.has(q) ? 2 : layer) : -Infinity)),
      hall && near.includes(hall) ? roofRow + 2 : -Infinity,
      crossing && near.includes(crossing) ? beamRow - 1 + layer : -Infinity,
    );
    let row = first[i];
    const canopy = canopies.has(s);
    if (canopy) spans.push({ row, a: s.a, b: s.b, kind: 'ledge' });
    for (let l = 1, up = canopy || !!over(s, row); up && row - layer >= TOP_BOARD; l++) {
      // By chance no higher than a high board, and never over a canopy: the sky over the top layer is room too.
      if (!(row > need || (!canopy && l < LAYERS && row - layer >= s.row - highRows && rng.chance(STACK)))) break;
      up = !!over(s, (row -= layer));
    }
  });
  if (crossing && beamRow > TOP_BOARD) {
    const inner = by(slabs.indexOf(crossing) - 1);
    if (inner) over(inner, beamRow - 1, inner.a, mid - BEAM_HALF - 1);
    // Over the beam, now and then, a board across the middle to stand over the swing on.
    if (rng.chance(CENTRE_BOARD)) over(crossing, beamRow - layer, mid - BEAM_HALF - 1, mid);
    spans.push({ row: beamRow, a: mid - BEAM_HALF + 1, b: mid, kind: 'ledge' });
  }
  // A hall's roof over its slab, the set's floor: a floor over the room, a ceiling in it.
  if (hall) spans.push({ row: roofRow, a: hall.a, b: hall.b, kind: 'ledge' });
  // A ledge out over each side's drop, a jump up and out from the stage's end.
  const out = rng.int(1, 2);
  const lw = rng.int(SIDE_LEDGE_W[0], SIDE_LEDGE_W[1]);
  if (spawn.a - out - lw >= 2 && rng.chance(SIDE_LEDGE)) spans.push({ row: spawn.row - SIDE_RISE, a: spawn.a - out - lw, b: spawn.a - out - 1, kind: 'ledge' });
  spans.push(...climbs(boards, spans, layer, W));

  // Lay each span and its mirror (one span across the middle when it reaches it). A slab is solid `thick` rows down,
  // the set's floor on top; a roof or ledge the set's floor alone; a board a one-way plank.
  const whole = (s: Span): [number, number][] =>
    s.b === mid
      ? [[s.a, W - 1 - s.a]]
      : [
          [s.a, s.b],
          [W - 1 - s.b, W - 1 - s.a],
        ];
  const thick = rng.int(THICK[0], THICK[1]);
  for (const s of spans)
    for (const [a, b] of whole(s)) {
      if (s.kind === 'board') {
        g.plank(a, b, s.row + 1);
        continue;
      }
      if (s.kind === 'slab') g.fill(a, s.row + 2, b, Math.max(s.row + 3, Math.min(H - 1 - DROP, s.row + thick)), T_SOLID, true);
      kit.deck(g, rng, storey(s.row, a, b), a, b, false, k);
      // Its top solid whatever boards the set lays in it: something to stand on with a wall under each end.
      for (let x = a; x <= b; x++) if (g.get(x, s.row + 1) === T_ONEWAY) g.set(x, s.row + 1, T_SOLID, true);
    }
  const laid = spans.flatMap((s) => whole(s).map(([a, b]) => [s.row, a, b] as const)).sort((p, q) => q[0] - p[0]);
  kit.dress?.(
    g,
    rng,
    laid.map(([row, a, b]) => storey(row, a, b)),
    [],
    k,
  );
  // Whatever the set's floor or dressing lays, everything stood on keeps its air over it: two rows, or the one a board
  // two rows over it leaves.
  const air = Math.min(2, layer - 1);
  for (const [row, a, b] of laid) g.clear(a, row - air + 1, b, row);
  // Nothing under the stage but the drop: under each column's solid, down from a slab's top, nothing to the bottom;
  // the seams, the sides and the pit open from over the highest board down (the pit from the top of the view).
  const top = Math.min(...laid.map(([row]) => row)) - 2;
  const stage = new Uint8Array(W);
  for (const s of slabs)
    for (const [a, b] of whole(s))
      for (let x = a; x <= b; x++) {
        stage[x] = 1;
        let y = s.row + 1;
        while (y < H && g.get(x, y) === T_SOLID) y++;
        if (s === pillar) g.fill(x, y, x, H - 1, T_SOLID, true);
        else g.clear(x, y, x, H - 1);
      }
  // Each hall's roof steps a row down over its outer half, two heights of room under it (a low roof's gas pocket, a
  // tall one's pendulum), and at its end by the middle a pier hangs `PIER` rows: a wall face to mount on, with more
  // than a runner's height of air under it.
  if (hall)
    for (const [a, b] of whole(hall)) {
      const outer = a < mid ? [a, (a + b) >> 1] : [((a + b) >> 1) + 1, b];
      const pier = a < mid ? b : a;
      const under = (x: number) => {
        let y = roofRow + 1;
        while (y + 1 < H && g.get(x, y + 1) === T_SOLID) y++;
        return y;
      };
      for (let x = outer[0]; x <= outer[1]; x++) g.set(x, under(x) + 1, T_SOLID, true);
      const p = under(pier);
      if (hall.row - (p + PIER) >= 3) g.fill(pier, p + 1, pier, p + PIER, T_SOLID, true);
    }
  // Nothing of the set's dressing hangs under an arch's beam, in the swing over the crossing.
  if (crossing) g.clear(crossing.a, beamRow + 2, W - 1 - crossing.a, crossing.row);
  const pit = centre === 'pit' ? [mid - PIT_HALF + 1, W - mid + PIT_HALF - 2] : null;
  // An arch's seam stays clear from under its beam down.
  const under = (x: number) => {
    let y = beamRow + 1;
    while (y < H && g.get(x, y) === T_SOLID) y++;
    return y;
  };
  for (let x = 0; x < W; x++)
    if (!stage[x])
      g.clear(x, pit && x >= pit[0] && x <= pit[1] ? 0 : crossing && x > mid - ARCH_SEAM / 2 && x < W - mid + ARCH_SEAM / 2 - 1 ? under(x) : top, x, H - 1);
  // A board's planks keep only to what's stood on, never doubled under another span or left a stub a tile wide.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (g.get(x, y) === T_ONEWAY && (y <= air || !g.empty(x, y - 1) || !g.empty(x, y - air))) g.set(x, y, T_EMPTY, true);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.get(x, y) === T_ONEWAY && g.empty(x - 1, y) && g.empty(x + 1, y)) g.set(x, y, T_EMPTY, true);

  // The two spawns: on the outermost slab of each side, a column in from its outer end, so the spawn's safe zone
  // keeps off the slabs past it, where the set pieces stand; the field fans out over it, and the shield covers GO.
  const tx = spawn.a + 1;
  const row = spawn.row;
  return {
    w: W,
    h: H,
    tiles: g.t,
    spawn: { tx, ty: row },
    goal: { tx: W - 1 - tx, ty: row },
    protectedRects: [
      { x: tx - 2, y: row - 3, w: POCKET, h: 5 },
      { x: W - 3 - tx, y: row - 3, w: POCKET, h: 5 },
    ],
    style: `${kit.style}:arena-${outline}`,
    ...(centre && rooms.length ? { centre: { kind: centre, rooms, alone: centre === 'pit' } } : {}),
    bridgeHints: [],
    open: hall ? whole(hall) : [],
  };
}

/**
 * Where the centrepiece stands: a pit's columns from the top down with a lip either side (something rooted on a lip
 * reaches over it); a hall's air, floor to roof, both mirrors; or under an arch's beam, down to the crossing and out
 * over the seams beside it, which a swing may cross.
 */
function centreRooms(centre: CentreKind | null, slabs: Span[], mid: number, W: number, H: number, beamRow: number, roofRow: number): TileRect[] {
  if (centre === 'pit') {
    const lip = mid - PIT_HALF;
    return [{ x: lip, y: 0, w: W - 2 * lip, h: H }];
  }
  if (centre === 'arch') {
    const c = slabs.find((s) => s.arch)!;
    return [{ x: c.a - 2, y: beamRow + 2, w: W - 2 * (c.a - 2), h: c.row - beamRow - 1 }];
  }
  const hall = slabs.find((s) => s.hall);
  if (centre !== 'halls' || !hall || roofRow < 2) return [];
  const room = (a: number, z: number): TileRect => ({ x: a, y: roofRow + 1, w: z - a + 1, h: hall.row - roofRow });
  return [room(hall.a, hall.b), room(W - 1 - hall.b, W - 1 - hall.a)];
}

/** Columns of air a jump up from one span onto the next carries across beside it, from a standstill. */
const ACROSS = 3;

/**
 * Every board climbs, by construction: a board is climbed onto from a span under it, a jump up through it where they
 * share two columns or more, or beside it where the span under it sticks out past one of its ends or stands within
 * `ACROSS` of it, a rise of `layer` at most; or dropped onto from a span over it that overlaps it. Slabs, roofs and
 * ledges stand where the field reaches (the pipeline proves the slabs; a roof or ledge it can't reach only stands
 * there). A board nothing climbs onto isn't laid. Spans are the left half's; one to the middle runs whole across it.
 */
function climbs(boards: Span[], ground: readonly Span[], layer: number, W: number): Span[] {
  const mid = (W >> 1) - 1;
  const full = (s: Span) => (s.b === mid ? W - 1 - s.a : s.b);
  const reached = [...ground];
  const left = new Set(boards);
  for (let more = true; more;) {
    more = false;
    for (const u of left) {
      const ub = full(u);
      const onto = reached.some((d) => {
        const db = full(d);
        const rise = d.row - u.row;
        const share = Math.min(ub, db) - Math.max(u.a, d.a) + 1;
        if (rise < 0) return share >= 1;
        if (rise === 0 || rise > layer) return false;
        return share >= 2 || (share >= 0 && (d.a < u.a || db > ub)) || (d.b < u.a && u.a - db - 1 <= ACROSS) || (d.a > ub && d.a - ub - 1 <= ACROSS);
      });
      if (!onto) continue;
      reached.push(u);
      left.delete(u);
      more = true;
    }
  }
  return boards.filter((b) => !left.has(b));
}

/** A span as the tower kit's storey: arrive and leave at its ends, so the set's dressing keeps off them. */
function storey(row: number, a: number, b: number): Storey {
  return { row, arrive: a, leave: b, x0: a, x1: b };
}
