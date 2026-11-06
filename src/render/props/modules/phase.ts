import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { T_SOLID } from '../../../sim/level';
import { type ModuleOf, PHASE_WARN, phaseCycle, phaseSolid } from '../../../sim/props';
import { inkFor } from '../../ink';
import { retroGhost } from '../../ink-build';
import { stampPhaseTile } from '../../ink-blocks';
import { boxPts, dot, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { bulb, light, type RC } from '../../kit';
import { type DrawCtx, defineArt } from '../common';

const GATE_STEEL: HSL = { h: 215, s: 10, l: 46 };
const GATE_PAINT: HSL = { h: 44, s: 88, l: 50 };
const LAMP_SHUT: HSL = { h: 4, s: 82, l: 50 };
const LAMP_OPEN: HSL = { h: 128, s: 58, l: 46 };
/** Frames a gate warns before it opens or shuts: longer than a blink block's, since a whole pack is watching it. */
const GATE_WARN = 60;

/** One slat of a gate's shutter, a cell wide: a steel plate, a rib, two rivets and a hazard band on its underside. */
function slat(seed: number) {
  return sprite(`ph|gate|${seed}`, -1, -1, TILE + 2, TILE + 2, (g) => {
    const plate = boxPts(0.2, 0.6, TILE - 0.4, TILE - 1.2, 0.6, seed, 0.08);
    part(g, plate, GATE_STEEL, seed, { depth: 0.6, shade: -18, thin: 0.4, thick: 1 });
    g.save();
    path(g, plate);
    g.clip();
    g.fillStyle = css(GATE_PAINT);
    g.fillRect(0, TILE - 5, TILE, 3.6);
    g.fillStyle = inkFor(GATE_PAINT);
    for (let k = -4; k < TILE + 4; k += 4) {
      path(g, poly(k, TILE - 1.4, k + 2, TILE - 1.4, k + 5.6, TILE - 5, k + 3.6, TILE - 5));
      g.fill();
    }
    g.restore();
    tick(g, 1.6, 5.6, TILE - 1.6, 5.7, 0.45, seed + 1, css(GATE_STEEL, -28));
    for (const x of [3, TILE - 3]) dot(g, x, 2.7, 0.5, seed + x, css(GATE_STEEL, 24), inkFor(GATE_STEEL));
  });
}

/** Is every tile from the wall to (x, y), not including it, rock: the gate's end there meets the shaft's wall? */
function atWall(d: DrawCtx, x: number, y: number, dir: -1 | 1): boolean {
  const level = d.o.level;
  if (!level) return true;
  for (let cx = x + dir; cx >= 0 && cx < level.w; cx += dir) if (level.tiles[y * level.w + cx] !== T_SOLID) return false;
  return true;
}

/**
 * A Rising Slag gate (gen/level/loop-gates.ts): a steel shutter across the shaft, a slat a cell. Shut, a red lamp
 * burns at each wall; in its last GATE_WARN frames the slats rattle and the lamps flash green. Open, only the guides
 * it runs in show, faint on the backdrop, and the lamps are green; before it shuts the lamps flash amber and the
 * shutter's ghost fills in across the gap, so nobody under it is surprised.
 */
function drawGate(rc: RC, m: ModuleOf<'phase'>, d: DrawCtx) {
  const s = rc.s;
  const c = phaseCycle(m, rc.frame, d.r.phase);
  const left = c.len - c.t;
  const shut = c.seg === 0;
  const warn = !!d.o.level && left <= GATE_WARN;
  const flash = Math.floor(rc.frame / (left < 20 ? 3 : 6)) % 2 === 0;
  const ox = d.off[0];
  const oy = d.off[1];
  m.cells.forEach(([cx, cy], ci) => {
    const x = cx * TILE + ox;
    const y = cy * TILE + oy;
    if (!d.o.level || phaseSolid(m, rc.frame, d.r.phase, d.o.state, d.mi, ci)) {
      stamp(s, slat((cx * 7 + cy) % 5), x + (warn && shut && flash ? 0.5 : 0), y);
      return;
    }
    tick(rc.bg, x + 1.5, y + 1.2, x + TILE - 1.5, y + 1.2, 0.8, cx * 3 + cy, css(GATE_STEEL, 22, 0.75));
    tick(rc.bg, x + 1.5, y + TILE - 1.2, x + TILE - 1.5, y + TILE - 1.2, 0.8, cx * 5 + cy, css(GATE_PAINT, -8, 0.6));
    if (warn && !shut) {
      const u = 1 - left / GATE_WARN;
      rc.bg.fillStyle = css(GATE_PAINT, 0, 0.15 + 0.4 * u);
      path(rc.bg, boxPts(x, y + TILE * (1 - u) * 0.5, TILE, TILE * u, 0.5, cx * 3 + cy, 0.1));
      rc.bg.fill();
    }
  });
  const lamp = shut ? (warn && flash ? LAMP_OPEN : LAMP_SHUT) : warn && flash ? GATE_PAINT : LAMP_OPEN;
  const ends: [number, number, -1 | 1][] = [
    [m.cells[0][0], m.cells[0][1], -1],
    [m.cells[m.cells.length - 1][0], m.cells[m.cells.length - 1][1], 1],
  ];
  for (const [cx, cy, dir] of ends) {
    if (!atWall(d, cx, cy, dir)) continue;
    const x = (dir < 0 ? cx * TILE : (cx + 1) * TILE) + ox;
    const y = (cy + 0.5) * TILE + oy;
    part(s, boxPts(x - (dir < 0 ? 6 : 0), y - 7, 6, 14, 0.8, cx, 0.1), GATE_STEEL, cx + 3, { depth: 0.5, shade: -16, thin: 0.4, thick: 1 });
    bulb(s, x + dir * 3, y, 2.4, lamp);
  }
}

/**
 * Blink blocks, as retro blocks: the first set is bricks, a paired second set is exclamation switch
 * blocks in the complementary color, so you can see which set is next. Solid cells flicker in their last
 * PHASE_WARN frames. A gone cell is its four corners in pencil, and fills from the bottom in the
 * PHASE_WARN frames before it returns.
 */
defineArt<'phase'>({
  type: 'phase',
  layer: 1,
  draw(rc, m, d) {
    if (m.look === 'gate') return drawGate(rc, m, d);
    const s = rc.s;
    const c = phaseCycle(m, rc.frame, d.r.phase);
    const left = c.len - c.t;
    const brick = m.offset === 0;
    const hue = (d.style.glowHue + (m.offset > 0 ? 180 : 0)) % 360;
    const col: HSL = { h: hue, s: 85, l: 58 };
    const ox = d.off[0];
    const oy = d.off[1];
    m.cells.forEach(([cx, cy], ci) => {
      const x = cx * TILE + ox;
      const y = cy * TILE + oy;
      // A card shows every block there: what you buy is the bricks, not the moment between them.
      if (!d.o.level || phaseSolid(m, rc.frame, d.r.phase, d.o.state, d.mi, ci)) {
        const warn = left <= PHASE_WARN;
        const blink = !!d.o.level && warn && Math.floor(rc.frame / (left < 12 ? 2 : 4)) % 2 === 0;
        const a0 = s.globalAlpha;
        s.globalAlpha = a0 * (blink ? 0.45 : 1);
        stampPhaseTile(s, x, y, hue, ci + cx * 7, brick);
        s.globalAlpha = a0;
      } else {
        retroGhost(s, x, y, css(col, 12, 0.6), cx * 7 + cy);
        if (c.seg === 1 && left <= PHASE_WARN) {
          const u = 1 - left / PHASE_WARN;
          const h = (TILE - 4) * u;
          s.fillStyle = css(col, 0, 0.3 + u * 0.4);
          path(s, boxPts(x + 2, y + TILE - 2 - h, TILE - 4, h, 1, cx * 3 + cy, 0.2));
          s.fill();
        }
      }
    });
    const [cx, cy] = m.cells[0];
    light(rc, (cx + 0.5) * TILE + ox, (cy + 0.5) * TILE + oy, 40, col, c.seg === 0 ? 0.35 : 0.1);
  },
});
