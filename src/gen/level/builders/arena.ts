import { withDifficulty } from '../difficulty';
import { Grid, POCKET, T_EMPTY, T_ONEWAY, T_SOLID } from '../kit';
import { jumpProfile } from '../probe';
import { easyRise, hopGap, jumpGap, knobs, LAST_RESORT } from '../sculptors/common';
import type { Storey, TallKit } from '../sculptors/tall';
import type { SculptCtx, Shape } from '../types';

/**
 * A Brawl arena (docs/MODES.md → Brawl): one screen of ledges stacked in tiers from a floor of islands over the pit up
 * to the top of the view, built for knocking people off things. The islands are wider than the ledges over them: a
 * knock off a ledge most often comes down on one, and the pit between them is the drop that kills. Every tier is ledges with gaps between them, staggered
 * like bricks against the tier below, so most places you stand have a drop beside them; the outermost ledges run off
 * the open sides, where a knock carries you off the map. The two ends mirror each other (the same tiers, ledges and
 * kinds; the set's floor varies the details), so neither spawn gets the high ground.
 *
 * What varies by seed: how the tiers fill the screen (`SHAPES`: full tiers, a pyramid with the high ground in the
 * middle, a bowl with it at the sides), which tier the two spawns stand on, the tiers' rows, every ledge and gap,
 * which ledges are boards you jump up through and which are the set's own floor, and which islands of the bottom tier
 * stand on the bottom. It owes no part: every tier is a jump or a drop from the next, gaps are walking or running
 * jumps (`hopGap`, `jumpGap`), and the pipeline proves each end reaches the other bare.
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

/** Ledge widths and the share of upper ledges that are boards, per tier: wide and forgiving on gentle, narrow on hard. */
const LEDGES = {
  gentle: { ledge: [5, 8], boards: 0.5 },
  medium: { ledge: [4, 7], boards: 0.4 },
  hard: { ledge: [3, 6], boards: 0.3 },
} as const;

/** Stand rows the top tier takes: in the top third of the view, with room over it for a jump. */
const TOP = [5, 7] as const;
/** Share of the bottom tier's islands that stand on the bottom (a mesa) rather than float over the pit. */
const MESAS = 0.35;
/** Columns wider the bottom tier's islands are than the ledges over them: the floor a knock comes down on. */
const FLOOR = 3;
/** Columns the spawn ledge runs on past its pocket. */
const SPAWN_STEPS = [1, 3] as const;
/** Rows of the lip at the outer edge of each spawn pocket. */
const LIP = 2;
/** How far in (a share of the half width) the top tier's band starts (pyramid) or stops short (bowl). */
const DRAW_IN = 0.55;

/** One ledge of the left half: stand row `row`, columns [a, b]; `b` at the half's last column joins its mirror. */
interface Ledge {
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
  const wideLedge = jumpProfile(1).walkGap;
  const wideIsland = jumpProfile(1).gap;
  const ledges: Ledge[] = [];
  let phase = rng.int(0, 3);
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
    const widest = islands ? wideIsland : wideLedge;
    const gap = () => Math.min(widest, Math.max(2, Math.round((islands ? jumpGap(rng, 2) : hopGap(rng, 2)) * floaty)));
    const width = () => rng.int(sizes.ledge[0], sizes.ledge[1]) + (k.density > 0.6 ? 1 : 0) + (islands ? FLOOR : 0);
    // Bricks: each tier starts a few columns along from the one under it, so its ledges sit over the gaps below.
    let x = t === spawnTier ? 0 : lo - phase;
    let first = true;
    while (x <= hi) {
      // The spawn ledge holds the pocket and a step or two more.
      const w = first && t === spawnTier ? POCKET + rng.int(SPAWN_STEPS[0], SPAWN_STEPS[1]) : width();
      const a = Math.max(lo, x);
      let b = Math.min(hi, x + w - 1);
      // Close to the middle, a ledge reaches it: across the middle a gap is twice what's left, wider than any jump.
      if (hi === mid && mid - b <= 2) b = mid;
      if (b - a + 1 >= 2) {
        const board = !islands && !(first && t === spawnTier) && rng.chance(sizes.boards);
        // An island at the side floats, so the side stays open down to the pit.
        ledges.push({ row, a, b, board, ground: islands && a > 0 && rng.chance(MESAS) });
      }
      first = false;
      x = b + 1 + gap();
    }
    // The middle: no wider a void than the tier's widest gap. A tier that runs to the middle and stops short of it
    // gets a ledge across it; a bowl's tiers under the top one, drawn back to the sides, get a board over it.
    const last = ledges.filter((l) => l.row === row).reduce((m, l) => Math.max(m, l.b), lo - 1);
    if (last < mid && 2 * (mid - last) > widest) {
      if (hi === mid) ledges.push({ row, a: Math.min(mid - 1, last + 1 + gap()), b: mid, board: !islands && rng.chance(sizes.boards), ground: false });
      else if (t < n - 1) ledges.push({ row, a: mid - rng.int(1, 3), b: mid, board: true, ground: false });
    }
    phase = (phase + rng.int(2, 4)) % 6;
  }

  // Lay each ledge and its mirror (one ledge across the middle when it reaches it): boards as one-way planks, the rest
  // as the set's floor.
  const lay = (l: Ledge, a: number, b: number) => {
    if (l.board) g.plank(a, b, l.row + 1);
    else kit.deck(g, rng, storey(l.row, a, b), a, b, l.ground, k);
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
  // Nothing gets up into the top rows, over the top tier: no board the set's dressing hangs there (timber under a
  // ceiling the arena hasn't got) is left as a scrap nobody can stand on.
  for (let y = 0; y <= TOP[0] - 3; y++) for (let x = 0; x < W; x++) if (g.get(x, y) === T_ONEWAY) g.set(x, y, T_EMPTY, true);

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
  };
}

/** A ledge as the tower kit's storey: arrive and leave at its ends, so the set's dressing keeps off them. */
function storey(row: number, a: number, b: number): Storey {
  return { row, arrive: a, leave: b, x0: a, x1: b };
}
