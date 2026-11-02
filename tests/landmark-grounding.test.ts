import { describe, expect, it } from 'vitest';
import { generateLevel, lastGenInfo } from '../src/gen/level';
import { CONCEPTS } from '../src/gen/stage';
import { TILE } from '../src/sim/constants';
import { type Level, type TileRect, T_SOLID } from '../src/sim/level';
import { type PlacedProp, resolveProp } from '../src/sim/props';
import { SHELLS } from '../src/sim/props/modules/deco';
import { THEME_IDS } from '../src/themes';

/**
 * Nothing a landmark builds floats (docs/SETPIECES.md §4, Grounding): every column of its box that holds
 * structure reaches the terrain under it, either through solid tiles or, where a doorway, a room or a pit
 * opens under its lowest tile, through the landmark's backdrop shell, which covers that column and stands
 * on the ground. A shell stands on the lowest ground under its whole footprint. Static blocks among the
 * landmark's own pieces (a conveyor bed) count as ground; hanging things (chandeliers, droppers, a wheel
 * on its hub) are props, not tiles, so they're not structure here.
 */

const SEEDS = [1, 2, 3];
const SIZES = ['classic', 'wide'] as const;

/** Shells that turn with what's in front of them (a wheel's rim): they stand on a stand, not on their box's bottom. */
const TURNS = new Set(['flywheel']);

const ownPieces = (l: Level) => l.setPieces.filter((p) => l.landmark && p.def.key.endsWith(`:${l.landmark.concept}`));

/** Tile boxes of the landmark's backdrop shells. */
function shells(l: Level): (TileRect & { turns: boolean })[] {
  const out: (TileRect & { turns: boolean })[] = [];
  for (const pp of ownPieces(l))
    for (const m of resolveProp(pp).mods)
      if (m.type === 'deco' && SHELLS.has(m.kind))
        out.push({
          x: Math.round(m.at[0] / TILE),
          y: Math.round(m.at[1] / TILE),
          w: Math.round(m.w / TILE),
          h: Math.round(m.h / TILE),
          turns: TURNS.has(m.kind),
        });
  return out;
}

/** Cells of the landmark's static blocks: ground as far as a column standing on them is concerned. */
function blocks(l: Level, pieces: readonly PlacedProp[]): Set<number> {
  const out = new Set<number>();
  for (const pp of pieces) {
    if (pp.def.motion.type !== 'none') continue;
    for (const m of resolveProp(pp).mods) if (m.type === 'body' && !m.breakFrames) for (const [x, y] of m.cells) out.add(y * l.w + x);
  }
  return out;
}

function check(l: Level, at: string) {
  const r = l.landmark!.rect;
  const boxes = shells(l);
  const support = blocks(l, ownPieces(l));
  const ground = (x: number, y: number) => l.tiles[y * l.w + x] === T_SOLID || support.has(y * l.w + x);
  /** First ground row at or below y in column x (the level's bottom if none). */
  const below = (x: number, y: number) => {
    while (y < l.h && !ground(x, y)) y++;
    return y;
  };
  for (let x = r.x; x < r.x + r.w; x++) {
    let low = -1;
    for (let y = r.y; y < r.y + r.h && y < l.h; y++) if (l.tiles[y * l.w + x] === T_SOLID) low = y;
    if (low < 0) continue;
    const g = below(x, low + 1);
    if (g === low + 1 || g >= l.h) continue;
    const held = boxes.some((b) => x >= b.x && x < b.x + b.w && b.y <= low + 1 && b.y + b.h >= g);
    expect(held, `${at}: column ${x} hangs over open air from row ${low + 1} to ${g}`).toBe(true);
  }
  for (const b of boxes) {
    if (b.turns) {
      // A turning rim stands on a stand the art draws down to the ground under its feet: there has to be ground there.
      for (const x of [b.x + Math.floor(b.w / 4), b.x + b.w - 1 - Math.floor(b.w / 4)])
        expect(below(x, b.y + b.h - 1), `${at}: no ground under its stand at column ${x}`).toBeLessThan(l.h);
      continue;
    }
    for (let x = b.x; x < b.x + b.w; x++) {
      const g = below(x, b.y + b.h - 1);
      expect(b.y + b.h, `${at}: its backdrop stops short of the ground in column ${x}`).toBeGreaterThanOrEqual(Math.min(g, l.h));
    }
  }
}

describe('landmarks stand on the ground', () => {
  for (const theme of THEME_IDS)
    for (const c of CONCEPTS[theme])
      it(`${theme} ${c.id}`, () => {
        let seen = 0;
        for (const size of SIZES) {
          if (!c.sizes.includes(size)) continue;
          for (const seed of SEEDS) {
            const l = generateLevel(seed, theme, { concept: c.id, size });
            if (lastGenInfo.concept !== c.id) continue;
            seen++;
            check(l, `${theme} ${c.id} ${size} ${seed}`);
          }
        }
        expect(seen).toBeGreaterThan(0);
      });
});
