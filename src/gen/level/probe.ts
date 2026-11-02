import { LEVEL_H, LEVEL_W } from '../../sim/constants';
import type { Level } from '../../sim/level';
import { analyzeReach } from '../../sim/reach';
import type { Theme } from '../theme';

/**
 * What the player controller can jump, measured (never hardcoded) by asking
 * sim/reach.ts about tiny synthetic levels: a ledge, a gap, a target ledge
 * `dy` rows higher (negative = lower). Sculptors use this to size "easy"
 * gaps (always jumpable) and "hard" gaps (need a bridge prop), so the
 * bridge-needed share survives physics retuning.
 */
export interface JumpProfile {
  /** Widest jumpable gap (empty columns) between ledges at equal height. */
  gap: number;
  /** Tallest step (rows) that can be climbed from a standstill. */
  rise: number;
  /** Widest jumpable gap to a ledge `dy` rows up (dy in [-6, rise]); -1 if unreachable. */
  gapAt(dy: number): number;
}

const MIN_DY = -6;
const MAX_DY = 10;
const MAX_GAP = 16;

let cached: JumpProfile | null = null;

export function jumpProfile(): JumpProfile {
  if (cached) return cached;
  const table = new Map<number, number>();
  for (let dy = MIN_DY; dy <= MAX_DY; dy++) {
    let best = -1;
    for (let gap = 0; gap <= MAX_GAP; gap++) {
      if (!probe(gap, dy)) break;
      best = gap;
    }
    table.set(dy, best);
    if (dy > 0 && best < 0) break;
  }
  let rise = 0;
  while ((table.get(rise + 1) ?? -1) >= 0) rise++;
  const gap = table.get(0) ?? 1;
  cached = {
    gap,
    rise,
    gapAt: (dy) => (dy < MIN_DY ? (table.get(MIN_DY) ?? gap) : (table.get(dy) ?? -1)),
  };
  return cached;
}

function probe(gap: number, dy: number): boolean {
  const w = LEVEL_W;
  const h = LEVEL_H;
  const tiles = new Uint8Array(w * h);
  const row = 14; // stand row of the left ledge
  const leftEnd = 9;
  const rx0 = leftEnd + 1 + gap;
  const rRow = row - dy;
  for (let x = 0; x <= leftEnd; x++) tiles[(row + 1) * w + x] = 1;
  for (let x = rx0; x < Math.min(w, rx0 + 4); x++) for (let y = rRow + 1; y <= Math.min(h - 1, rRow + 2); y++) tiles[y * w + x] = 1;
  const level: Level = {
    seed: 0,
    w,
    h,
    tiles,
    spawn: { tx: leftEnd, ty: row },
    goal: { tx: rx0 + 1, ty: rRow },
    protectedRects: [],
    theme: {} as Theme,
    style: 'probe',
    version: 0,
    setPieces: [],
  };
  return analyzeReach(level).goalReached;
}
