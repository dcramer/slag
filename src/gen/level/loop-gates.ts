import { isProtected, type Level, LOOP_BAND, LOOP_SPAWN, T_EMPTY, T_ONEWAY } from '../../sim/level';
import type { Cell } from '../../core/geom';
import { type Module, type PlacedProp, type PropDef, sweptCells } from '../../sim/props';
import type { TideGate } from '../../sim/tide';

/**
 * Rising Slag's regroup gates (docs/MODES.md → Rising Slag): a shutter across the whole shaft that shuts and opens on
 * the race clock, so whoever leads and gets there while it's shut has to wait under it, and the pack closes in. The
 * slag waits with them (sim/tide.ts `hold`), so the wait costs the pack nothing. A gate spans a row of open air from
 * wall to wall, with no board in it (a board would be a hole you jump up through), and is the same gate every lap.
 *
 * It's blink blocks (sim/props/modules/phase.ts) on the race clock (`clock`), open from the race's first frame: the
 * proof sees a gate open long enough to slip through as open air (sim/props/barrier.ts `MIN_OPENING`), and the bots'
 * map counts a solid that wasn't there at the start as one moving into their way (brain/route.ts `moving`), which
 * they wait out.
 */

/**
 * Where up the lap each gate goes, as shares of the lap from the spawn's floor: two, about 3 s of climbing apart. Four
 * Normal bots (512 seeds) kept the 15 s leader on top 57% of the time with one gate a lap, 51% with two and 54% with
 * three, from 64% with none.
 */
export const GATE_AT: readonly number[] = [1 / 3, 2 / 3];
/**
 * Frames a gate stays shut, then open: the cycle every gate shares, so they shut together and a leader who slips
 * through one meets the next one shut. 3 s shut regrouped too little (63%), 5.5 s left more rounds over by 15 s (12%);
 * 5 s with two gates was 49%, with rounds 2 s longer.
 */
const GATE_SHUT = 4 * 60;
const GATE_OPEN = 2 * 60;
/** Frames into the cycle the race starts at: just opened, so the field gets a window before the first shut. */
const GATE_START = GATE_SHUT;
/**
 * Rows under a shut gate a leader counts as waiting at it, with the slag waiting too: the ledges under it and the row of
 * ledges below those. Nobody gets past a shut gate, so a leader that close is waiting on it.
 */
export const GATE_HOLD = 8;
/** Most cells one blink module holds: its hold on a runner inside a cell is a bit per cell (phase.ts). */
const PER_MODULE = 24;
/** Fewest open cells a row needs to be a gate's: most of the shaft's width. */
const MIN_SHARE = 0.6;

/**
 * A gate's cells across row `y`: every open cell between the walls, or null if the row has a board, too little air, or
 * ground in the `air` rows under it, with a row of ledges under those. Two rows of air are best: a leader waits on the
 * ledges with the gate a row over their head, and the jump up onto them stays under it, so they're reached while it's
 * shut. With one, a jump onto them meets the shut gate and the pack waits a ledge further down, two jumps from through.
 */
function gateCells(level: Level, y: number, air: number): Cell[] | null {
  const { w } = level;
  const at = (x: number, yy: number) => level.tiles[yy * w + x];
  const cells: Cell[] = [];
  let ledges = 0;
  for (let x = 1; x < w - 1; x++) {
    const t = at(x, y);
    if (t === T_ONEWAY || isProtected(level, x, y)) return null;
    if (t !== T_EMPTY) continue;
    for (let d = 1; d <= air; d++) if (at(x, y + d) !== T_EMPTY) return null;
    if (at(x, y + air + 1) !== T_EMPTY) ledges++;
    cells.push([x, y]);
  }
  return cells.length >= MIN_SHARE * (w - 2) && ledges > 0 ? cells : null;
}

/** Rows a gate with only one row of air over its ledges counts as further from where it's wanted: most shafts have a two-row spot near it. */
const TIGHT = 8;

function gateAt(cells: readonly Cell[], g: TideGate): PropDef {
  const modules: Module[] = [];
  for (let i = 0; i < cells.length; i += PER_MODULE)
    modules.push({ type: 'phase', cells: cells.slice(i, i + PER_MODULE), on: g.shut, off: g.open, offset: g.offset, clock: true, look: 'gate' });
  return {
    key: 'loop-gate',
    name: 'Regroup Gate',
    maker: 'the level',
    archetype: 'blinker',
    role: 'build',
    style: { metal: 'steel', trim: 'none', hue: 0, glowHue: 40, woodHue: 30 },
    motion: { type: 'none' },
    modules,
    footprint: cells.map(([x, y]) => [x, y] as Cell),
  };
}

/**
 * A loop's gates, among its set pieces `pieces` (kept off their cells), each kept only if `keep` says the level still
 * plays with it in place. Each goes in the row of open air nearest its share of the lap, and comes back with the
 * cycle the slag reads (`Tide.gates`).
 */
export function loopGates(
  level: Level,
  pieces: readonly PlacedProp[],
  keep: (pieces: readonly PlacedProp[]) => boolean,
): { pieces: PlacedProp[]; gates: TideGate[] } {
  const loop = level.loop;
  if (!loop) return { pieces: [], gates: [] };
  const taken = new Set(pieces.flatMap((p) => sweptCells(p).map(([x, y]) => y * level.w + x)));
  const floor = loop + LOOP_SPAWN + 1;
  const out: PlacedProp[] = [];
  const gates: TideGate[] = [];
  for (const share of GATE_AT) {
    const want = Math.round(floor - share * loop);
    const spots = Array.from({ length: loop - LOOP_BAND }, (_, i) => LOOP_BAND + i).flatMap((y) => [
      { y, air: 2, far: Math.abs(y - want) },
      { y, air: 1, far: Math.abs(y - want) + TIGHT },
    ]);
    spots.sort((a, b) => a.far - b.far || a.y - b.y || b.air - a.air);
    for (const { y, air } of spots) {
      if (gates.some((g) => Math.abs(g.row - y) < 4)) continue;
      const cells = gateCells(level, y, air);
      if (!cells || cells.some(([x]) => taken.has(y * level.w + x))) continue;
      const g: TideGate = { row: y, shut: GATE_SHUT, open: GATE_OPEN, offset: GATE_START };
      const pp: PlacedProp = { uid: 0, def: gateAt(cells, g), owner: -1, tx: 0, ty: 0, rot: 0 };
      if (!keep([...pieces, ...out, pp])) continue;
      out.push(pp);
      gates.push(g);
      break;
    }
  }
  return { pieces: out, gates };
}
