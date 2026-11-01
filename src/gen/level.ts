import { clamp } from '../core/geom';
import { deriveSeed, Rng } from '../core/rng';
import { LEVEL_H, LEVEL_W } from '../sim/constants';
import type { Level, TileRect } from '../sim/level';
import { analyzeReach } from '../sim/reach';
import { generateTheme, type Theme } from './theme';

export type LevelStyle = 'islands' | 'caverns' | 'ruins' | 'towers';

const MIN_ROW = 5;
const MAX_ROW = LEVEL_H - 4;
const MAX_ATTEMPTS = 60;

/**
 * Generate a level for `seed`. Candidates are built from a guaranteed-ish
 * critical path plus style-specific decoration, then verified with the real
 * controller (see reach.ts). The first candidate that passes wins.
 */
export let lastGenAttempts = 0;

export function generateLevel(seed: number): Level {
  const theme = generateTheme(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = new Rng(deriveSeed(seed, `level:${attempt}`));
    const lvl = buildCandidate(seed, rng, theme);
    lastGenAttempts = attempt + 1;
    if (analyzeReach(lvl).goalReached) return lvl;
  }
  return buildFallback(seed, theme);
}

class Grid {
  tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  /** Cells decoration must not fill (above walkways and along jump arcs). */
  keep = new Uint8Array(LEVEL_W * LEVEL_H);

  in(x: number, y: number) {
    return x >= 0 && x < LEVEL_W && y >= 0 && y < LEVEL_H;
  }
  get(x: number, y: number) {
    return this.in(x, y) ? this.tiles[y * LEVEL_W + x] : 0;
  }
  fill(x0: number, y0: number, x1: number, y1: number, decor = false) {
    for (let y = Math.max(0, y0); y <= Math.min(LEVEL_H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(LEVEL_W - 1, x1); x++) {
        if (decor && this.keep[y * LEVEL_W + x]) continue;
        this.tiles[y * LEVEL_W + x] = 1;
      }
    }
  }
  markKeep(x0: number, y0: number, x1: number, y1: number) {
    for (let y = Math.max(0, y0); y <= Math.min(LEVEL_H - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(LEVEL_W - 1, x1); x++) this.keep[y * LEVEL_W + x] = 1;
    }
  }
}

interface Platform {
  x0: number;
  x1: number;
  row: number; // the empty row players stand in
}

function buildCandidate(seed: number, rng: Rng, theme: Theme): Level {
  const g = new Grid();
  const style = rng.weighted<LevelStyle>([
    ['islands', 3],
    ['caverns', 2],
    ['ruins', 2],
    ['towers', 2],
  ]);
  const path: Platform[] = [];

  const platform = (x0: number, x1: number, row: number, solidToBottom: boolean) => {
    const depth = solidToBottom ? LEVEL_H : rng.int(1, 3);
    g.fill(x0, row + 1, x1, row + depth);
    g.markKeep(x0, row - 4, x1, row);
    path.push({ x0, x1, row });
  };

  const pillarChance = style === 'towers' ? 0.7 : style === 'ruins' ? 0.45 : style === 'caverns' ? 0.2 : 0.08;

  // Spawn platform hugs the left wall.
  const spawnRow = rng.int(9, 20);
  platform(0, 4, spawnRow, rng.chance(pillarChance + 0.2));

  // Critical path of platforms marching right.
  let cur = { x1: 4, row: spawnRow };
  while (cur.x1 < LEVEL_W - 13) {
    let dy = rng.int(-3, 3);
    const row = clamp(cur.row + dy, MIN_ROW, MAX_ROW);
    dy = row - cur.row;
    const gap = dy <= -3 ? rng.int(1, 2) : dy < 0 ? rng.int(1, 3) : rng.int(2, 4);
    const len = rng.int(2, 6);
    const x0 = cur.x1 + gap + 1;
    const x1 = Math.min(x0 + len - 1, LEVEL_W - 8);
    platform(x0, x1, row, rng.chance(pillarChance));
    g.markKeep(cur.x1, Math.min(cur.row, row) - 4, x0, Math.max(cur.row, row));
    cur = { x1, row };
  }

  // Goal platform hugs the right wall.
  const goalRow = clamp(cur.row + rng.int(-3, 2), MIN_ROW, MAX_ROW);
  const goalGap = goalRow < cur.row ? rng.int(1, 2) : rng.int(1, 3);
  const gx0 = cur.x1 + goalGap + 1;
  platform(gx0, LEVEL_W - 1, goalRow, rng.chance(pillarChance + 0.2));
  g.markKeep(cur.x1, Math.min(cur.row, goalRow) - 4, gx0, Math.max(cur.row, goalRow));

  decorate(g, rng, style, path);

  const protectedRects: TileRect[] = [
    { x: 0, y: spawnRow - 3, w: 5, h: 5 },
    { x: gx0, y: goalRow - 3, w: LEVEL_W - gx0, h: 5 },
  ];

  return {
    seed,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles: g.tiles,
    spawn: { tx: 2, ty: spawnRow },
    goal: { tx: Math.max(gx0 + 1, LEVEL_W - 3), ty: goalRow },
    protectedRects,
    theme,
    style,
    version: 0,
  };
}

function decorate(g: Grid, rng: Rng, style: LevelStyle, path: Platform[]) {
  switch (style) {
    case 'islands': {
      const n = rng.int(4, 9);
      for (let i = 0; i < n; i++) {
        const x = rng.int(3, LEVEL_W - 6);
        const y = rng.int(3, LEVEL_H - 3);
        const len = rng.int(2, 5);
        g.fill(x, y, x + len - 1, y + rng.int(0, 1), true);
        // Dangly bits under islands.
        if (rng.chance(0.5)) g.fill(x + rng.int(0, len - 1), y + 1, x + rng.int(0, len - 1), y + rng.int(2, 3), true);
      }
      break;
    }
    case 'caverns': {
      // Lumpy ceiling.
      let depth = rng.int(1, 3);
      for (let x = 0; x < LEVEL_W; x++) {
        depth = clamp(depth + rng.int(-1, 1), 1, 5);
        g.fill(x, 0, x, depth - 1, true);
        if (rng.chance(0.12)) g.fill(x, depth, x, depth + rng.int(1, 4), true); // stalactite
      }
      // Patchy floor with pits.
      let x = 0;
      while (x < LEVEL_W) {
        const run = rng.int(2, 7);
        if (rng.chance(0.55)) g.fill(x, LEVEL_H - rng.int(1, 3), x + run - 1, LEVEL_H - 1, true);
        x += run;
      }
      break;
    }
    case 'ruins': {
      const n = rng.int(3, 7);
      for (let i = 0; i < n; i++) {
        // Broken wall segments.
        const x = rng.int(4, LEVEL_W - 5);
        const top = rng.int(4, LEVEL_H - 6);
        g.fill(x, top, x, top + rng.int(1, 4), true);
      }
      for (const p of path) {
        if (rng.chance(0.4)) {
          // Arches: lintel above a platform.
          const y = p.row - rng.int(5, 7);
          g.fill(p.x0 - 1, y, p.x1 + 1, y, true);
        }
      }
      break;
    }
    case 'towers': {
      const n = rng.int(3, 6);
      for (let i = 0; i < n; i++) {
        const x = rng.int(4, LEVEL_W - 6);
        const w = rng.int(1, 2);
        g.fill(x, rng.int(10, LEVEL_H - 2), x + w - 1, LEVEL_H - 1, true);
      }
      break;
    }
  }
}

/** Flat floor, always solvable. Only used if every candidate fails. */
function buildFallback(seed: number, theme: Theme): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  const row = LEVEL_H - 6;
  for (let y = row + 1; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    seed,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: row },
    goal: { tx: LEVEL_W - 3, ty: row },
    protectedRects: [
      { x: 0, y: row - 3, w: 5, h: 5 },
      { x: LEVEL_W - 5, y: row - 3, w: 5, h: 5 },
    ],
    theme,
    style: 'fallback',
    version: 0,
  };
}

export function cloneLevel(l: Level): Level {
  return { ...l, tiles: new Uint8Array(l.tiles), protectedRects: l.protectedRects.map((r) => ({ ...r })) };
}
