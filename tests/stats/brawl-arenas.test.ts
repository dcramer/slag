import { describe, expect, it } from 'vitest';
import { MODES } from '../../src/game/modes';
import { generateLevel, lastGenInfo } from '../../src/gen/level';
import { LEVEL_H } from '../../src/sim/constants';
import { T_EMPTY, type Level } from '../../src/sim/level';
import { analyzeReach } from '../../src/sim/reach';
import { THEME_IDS } from '../../src/themes';

/**
 * Brawl's arenas over every set (gen/level/builders/arena.ts, docs/MODES.md → Brawl): built for knocking people off
 * things. Most places you stand have a drop beside them, the field reaches ledges in the top third of the screen,
 * both sides are open to a knock over most of their height, the two ends mirror each other, and the shapes vary.
 */
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Columns either side of a stand cell within which a drop counts as beside it. */
const BESIDE = 3;

interface Arena {
  /** Share of the stand cells the field reaches with a drop within `BESIDE` columns on its row. */
  edgy: number;
  /** The field reaches a stand cell in the top third of the screen. */
  high: boolean;
  /** The tallest run of terrain in either side column, in rows: a wall a knock stops against. */
  wall: number;
  /** Share of terrain cells whose mirror across the middle is terrain too. */
  mirrored: number;
  /** Distinct rows the field stands on. */
  tiers: number;
  /** Stand cells the field reaches: places to stand, and to be knocked off. */
  stands: number;
  /** Boxes the arena hangs. */
  boxes: number;
  shape: string;
  fallback: boolean;
}

function measure(lv: Level): Arena {
  const { w, h, tiles } = lv;
  const at = (x: number, y: number) => (x < 0 || x >= w || y >= h ? T_EMPTY : tiles[y * w + x]);
  const reach = analyzeReach(lv, false).reachable;
  let edgy = 0;
  const rows = new Set<number>();
  for (const k of reach) {
    const x = k % w;
    const y = Math.floor(k / w);
    rows.add(y);
    for (let d = 1; d <= BESIDE; d++) {
      const drop = (cx: number) => cx < 0 || cx >= w || (at(cx, y) === T_EMPTY && at(cx, y + 1) === T_EMPTY);
      const wall = (cx: number) => cx >= 0 && cx < w && at(cx, y) !== T_EMPTY;
      // A drop only counts if no wall stands between it and you.
      if ((drop(x - d) && ![...Array(d - 1).keys()].some((i) => wall(x - 1 - i))) || (drop(x + d) && ![...Array(d - 1).keys()].some((i) => wall(x + 1 + i)))) {
        edgy++;
        break;
      }
    }
  }
  const run = (x: number) => {
    let best = 0;
    let cur = 0;
    for (let y = 0; y < h; y++) best = Math.max(best, (cur = at(x, y) === T_EMPTY ? 0 : cur + 1));
    return best;
  };
  let solid = 0;
  let both = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (at(x, y) !== T_EMPTY) {
        solid++;
        if (at(w - 1 - x, y) !== T_EMPTY) both++;
      }
  return {
    edgy: edgy / reach.size,
    high: [...reach].some((k) => Math.floor(k / w) < h / 3),
    wall: Math.max(run(0), run(w - 1)),
    mirrored: both / solid,
    tiers: rows.size,
    stands: reach.size,
    boxes: lv.setPieces.filter((p) => p.def.key === 'loop-box').length,
    shape: lv.style.split(':arena-')[1] ?? lv.style,
    fallback: lastGenInfo.fallback,
  };
}

describe('Brawl arenas', () => {
  const arenas = THEME_IDS.flatMap((theme) => SEEDS.map((seed) => ({ theme, a: measure(generateLevel(seed, theme, MODES.brawl.profile)) })));
  const all = arenas.map((x) => x.a);
  const mean = (f: (a: Arena) => number) => all.reduce((s, a) => s + f(a), 0) / all.length;
  const shapes: Record<string, number> = {};
  for (const a of all) shapes[a.shape] = (shapes[a.shape] ?? 0) + 1;
  console.log(
    `${all.length} arenas: ${Math.round(mean((a) => a.edgy) * 100)}% of stand cells by a drop, ${Math.round(mean((a) => +a.high) * 100)}% reach the top third, side walls ${Math.max(...all.map((a) => a.wall))} rows at most, ${Math.round(mean((a) => a.mirrored) * 100)}% mirrored, ${mean((a) => a.tiers).toFixed(1)} rows stood on; ${JSON.stringify(shapes)}`,
  );

  it('never falls back', () => expect(arenas.filter((x) => x.a.fallback).map((x) => x.theme)).toEqual([]));
  it('most places you stand have a drop beside them', () => expect(mean((a) => a.edgy)).toBeGreaterThan(0.6));
  it('the field gets up into the top third of the screen in most', () => expect(mean((a) => +a.high)).toBeGreaterThan(0.6));
  it('no wall at either side: a knock carries you off the map', () => expect(Math.max(...all.map((a) => a.wall))).toBeLessThan(LEVEL_H / 4));
  it('the two ends mirror each other', () => expect(mean((a) => a.mirrored)).toBeGreaterThan(0.9));
  it('every shape comes up in a fair share', () => {
    expect(Object.keys(shapes).sort()).toEqual(['bowl', 'pyramid', 'tiers']);
    for (const n of Object.values(shapes)) expect(n / all.length).toBeGreaterThan(0.18);
  });
  it('every arena hangs at least three boxes', () => expect(Math.min(...all.map((a) => a.boxes))).toBeGreaterThanOrEqual(3));
  it('every set gives the field about as many places to stand as the busiest (low gravity included)', () => {
    const per = THEME_IDS.map((theme) => {
      const mine = arenas.filter((x) => x.theme === theme);
      return mine.reduce((s, x) => s + x.a.stands, 0) / mine.length;
    });
    console.log(`stand cells by set: ${THEME_IDS.map((t, i) => `${t} ${Math.round(per[i])}`).join(', ')}`);
    expect(Math.min(...per)).toBeGreaterThan(0.8 * Math.max(...per));
  });
  it('every set builds arenas of several tiers', () => {
    for (const theme of THEME_IDS) expect(Math.min(...arenas.filter((x) => x.theme === theme).map((x) => x.a.tiers)), theme).toBeGreaterThanOrEqual(3);
  });
});
