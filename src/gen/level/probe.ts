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
  /** Widest jumpable gap (empty columns) between ledges at equal height, with a run-up. */
  gap: number;
  /** Widest gap between ledges at equal height from a ledge too short to run on: a walking jump. */
  walkGap: number;
  /** Tallest step (rows) that can be climbed from a standstill. */
  rise: number;
  /** Widest jumpable gap to a ledge `dy` rows up (dy in [-6, rise]); -1 if unreachable. */
  gapAt(dy: number): number;
}

const MIN_DY = -6;
const MAX_DY = 10;
const MAX_GAP = 16;

const cached = new Map<number, JumpProfile>();
let current = 1;

/**
 * Gravity the sculptor helpers measure at (set by the pipeline per level:
 * sculpting is synchronous, so a module-level "current" is safe and keeps
 * every gap/step helper's signature unchanged).
 */
export function setProbeGravity(gravity: number): void {
  current = gravity;
}

export function probeGravity(): number {
  return current;
}

export function jumpProfile(gravity = current): JumpProfile {
  const hit = cached.get(gravity);
  if (hit) return hit;
  const table = new Map<number, number>();
  for (let dy = MIN_DY; dy <= MAX_DY; dy++) {
    // Reachability is monotone in gap width: binary-search the widest jumpable gap.
    let best = -1;
    if (probe(0, dy, gravity)) {
      let lo = 0;
      let hi = MAX_GAP + 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (probe(mid, dy, gravity)) lo = mid;
        else hi = mid;
      }
      best = lo;
    }
    table.set(dy, best);
    if (dy > 0 && best < 0) break;
  }
  let rise = 0;
  while ((table.get(rise + 1) ?? -1) >= 0) rise++;
  const gap = table.get(0) ?? 1;
  let walkGap = 1;
  while (walkGap < gap && probe(walkGap + 1, 0, gravity, WALK_LEDGE)) walkGap++;
  const p: JumpProfile = {
    gap,
    walkGap,
    rise,
    gapAt: (dy) => (dy < MIN_DY ? (table.get(MIN_DY) ?? gap) : (table.get(dy) ?? -1)),
  };
  cached.set(gravity, p);
  return p;
}

/** A ledge this wide gives no run-up: reach.ts only runs from platforms of 4 cells or more. */
const WALK_LEDGE = 3;

function probe(gap: number, dy: number, gravity: number, ledge = 10): boolean {
  const w = LEVEL_W;
  const h = LEVEL_H;
  const tiles = new Uint8Array(w * h);
  const row = 14; // stand row of the left ledge
  const leftEnd = 9;
  const rx0 = leftEnd + 1 + gap;
  const rRow = row - dy;
  for (let x = leftEnd - ledge + 1; x <= leftEnd; x++) tiles[(row + 1) * w + x] = 1;
  for (let x = rx0; x < Math.min(w, rx0 + 4); x++) for (let y = rRow + 1; y <= Math.min(h - 1, rRow + 2); y++) tiles[y * w + x] = 1;
  const level: Level = {
    seed: 0,
    w,
    h,
    gravity,
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
