import { TILE } from '../sim/constants';
import { type Level, LOOP_BAND } from '../sim/level';
import { tideWarn } from '../sim/tide';
import type { Fx } from './fx';
import type { RC } from './kit';
import { type Liquid, paintBody, paintSurface } from './props/modules/flood';

/**
 * Rising Slag's slag (sim/tide.ts), drawn with the stage flood's pen: the body behind the terrain, so the level
 * stands in it, and the crest in front on the very line the sim burns at. It runs on past the world's sides
 * under the surroundings, so the world doesn't end in a wall of slag.
 *
 * Slag is the Foundry's runoff, darker and more crusted than a volcano's lava: the same hot bands, a duller body.
 */
const SLAG: Liquid = {
  top: { h: 30, s: 100, l: 58 },
  body: { h: 14, s: 88, l: 42 },
  deep: { h: 6, s: 60, l: 22 },
  glint: { h: 44, s: 100, l: 80 },
  hot: true,
};

/** How far down past the crest the body is drawn below the world: the surroundings reach about this far. */
const SUNK = 12 * TILE;

/**
 * The slag's body, before the terrain, its surface at world y `line`. `margin` is how far past the world's sides
 * the view can see and `bottom` the lowest world y it shows: round a loop the slag can be under the level's last
 * row (a lap down), and it fills down to the bottom of the view whatever the level's own edge.
 */
export function drawTideBody(rc: RC, level: Level, line: number, margin: number, bottom: number) {
  const floor = Math.max(level.h * TILE, bottom) + SUNK;
  if (line >= floor) return;
  paintBody(rc, SLAG, -margin, level.w * TILE + margin * 2, floor, floor - line);
}

/** The copy of the shaft (laps down) whose rows world y `line` is in, round a loop; 0 anywhere else. */
function copyOf(level: Level, line: number): number {
  const lap = (level.loop ?? 0) * TILE;
  let k = 0;
  if (lap) {
    while (line - k * lap >= level.h * TILE) k++;
    while (line - k * lap < LOOP_BAND * TILE) k--;
  }
  return k;
}

/** Embers a second the slag throws off a view's width of crest, and how many more while it rushes. */
const EMBERS = 14;
const RUSH_EMBERS = 30;

/**
 * Embers off the crest across the view `vis`: a steady drift, thicker while the slag is rushing. Cosmetic, so
 * `Math.random` is fine. They're spawned on the copy of the shaft the crest is in, since particles live in the
 * level's own rows and every copy draws them.
 */
export function slagEmbers(fx: Fx, level: Level, line: number, vis: { x: number; w: number }, dt: number, rushing: boolean) {
  const lap = (level.loop ?? 0) * TILE;
  const y = line - copyOf(level, line) * lap;
  let n = (EMBERS + (rushing ? RUSH_EMBERS : 0)) * dt;
  for (; n > 0; n--) {
    if (n < 1 && Math.random() > n) break;
    const x = vis.x + Math.random() * vis.w;
    fx.add('ember', x, y - 1, (Math.random() - 0.5) * 30, -40 - Math.random() * 60, SLAG.glint, 1.2 + Math.random() * 0.9, 0.9 + Math.random() * 0.8);
  }
}

/**
 * The slag's crest, glints and glow, in front of the terrain, on run frame `frame`. Before it moves, it boils where
 * it pools. The crest breaks where terrain stands in it, so round a loop it's drawn on the copy of the shaft whose
 * rows it's in, moved to where it shows.
 */
export function drawTideSurface(rc: RC, level: Level, line: number, frame: number) {
  const warn = tideWarn(level, frame) < 1 ? tideWarn(level, frame) : 0;
  const lap = (level.loop ?? 0) * TILE;
  const k = copyOf(level, line);
  const lights = rc.lights ?? [];
  const n = lights.length;
  for (const c of [rc.s, rc.g]) {
    c.save();
    c.translate(0, k * lap);
  }
  paintSurface(rc, level, SLAG, 0, level.w * TILE, level.h * TILE, level.h * TILE - (line - k * lap), warn);
  for (const c of [rc.s, rc.g]) c.restore();
  for (let i = n; i < lights.length; i++) lights[i].y += k * lap;
}
