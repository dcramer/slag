import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import type { Match } from '../game/match';
import { type BloodCell, FACE_UP, OOZE_FRAMES } from '../sim/blood';
import { TILE } from '../sim/constants';
import { COAT_PX, FACE } from '../sim/props';
import { glowDot, type RC } from './kit';

/**
 * Blood as the sim has it (`Match.blood`), redrawn every frame so it can't
 * drift from the footing: a bold, wet puddle standing on the floor exactly as
 * thick as what you stand on, in the victim's body color. The silhouette gets
 * the cel pass's ink for free; the bright dashes along it are what say "wet".
 * A wall smear is the same puddle run down the wall.
 */

/** A puddle stands a little proud of the footing and laps a little over the floor's edge. */
const CREST = COAT_PX + 1.5;
const LAP = 1.5;
/** Px between samples along a puddle's top edge. */
const STEP = 2;
const FALLBACK: HSL = { h: 0, s: 70, l: 40 };

/** How far the ooze has filled this cell, 0..1. Cells from an earlier round have settled. */
const filled = (c: BloodCell, frame: number) => (c.at <= 0 ? 1 : Math.max(0, Math.min(1, (frame - c.at) / OOZE_FRAMES)));

/** A player's blood: their body color, pushed a little deeper so a pale character still leaves a bold puddle. */
export function bloodColor(m: Match, slot: number): HSL {
  const c = m.player(slot)?.character.body ?? FALLBACK;
  return { h: c.h, s: Math.min(100, c.s + 8), l: Math.max(26, Math.min(58, c.l - 4)) };
}

const isFloor = (c: BloodCell) => c.face === FACE_UP;
/** Where a cell sits along its surface, and which surface: floors are rows, walls are columns. */
const along = (c: BloodCell) => (isFloor(c) ? c.tx : c.ty);
const across = (c: BloodCell) => (isFloor(c) ? c.ty : c.tx);

/** Cells that join up in one color on one surface. */
function runsOf(cells: readonly BloodCell[], frame: number): BloodCell[][] {
  const live = cells.filter((c) => filled(c, frame) > 0).sort((a, b) => a.face - b.face || across(a) - across(b) || along(a) - along(b));
  const runs: BloodCell[][] = [];
  for (const c of live) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    if (run && last && last.face === c.face && across(last) === across(c) && along(last) + 1 === along(c) && last.slot === c.slot) run.push(c);
    else runs.push([c]);
  }
  return runs;
}

/**
 * One puddle: a lumpy crest over a flat base, a hard tone of shade under it and
 * wet dashes along the top. Drawn lying on a floor, with x along the surface
 * and -y off it; `drawBlood` turns the canvas for a wall.
 */
function drawRun(rc: RC, run: readonly BloodCell[], color: HSL, frame: number) {
  const s = rc.s;
  const first = run[0];
  const last = run[run.length - 1];
  // The ends lead the ooze: a lone cell opens from its middle, anything else runs out from its neighbor.
  const kL = filled(first, frame);
  const kR = filled(last, frame);
  const x0 = first === last ? (along(first) + 0.5 - kL / 2) * TILE : (along(first) + 1 - kL) * TILE;
  const x1 = first === last ? (along(first) + 0.5 + kL / 2) * TILE : (along(last) + kR) * TILE;
  const crest = (x: number) => {
    const tip = Math.min(1, Math.min(x - x0, x1 - x) / 5);
    const lump = 0.84 + 0.16 * Math.sin(x * 0.42 + along(first) * 1.9);
    return CREST * lump * Math.sqrt(Math.max(0, 1 - (1 - tip) * (1 - tip)));
  };

  // Body.
  s.fillStyle = css(color);
  s.beginPath();
  s.moveTo(x0, LAP);
  for (let x = x0; x < x1; x += STEP) s.lineTo(x, -crest(x));
  s.lineTo(x1, 0);
  s.lineTo(x1, LAP);
  s.closePath();
  s.fill();

  // Shade: one hard tone against the surface.
  s.fillStyle = css(color, -16);
  s.beginPath();
  s.moveTo(x0 + 2, LAP);
  for (let x = x0 + 2; x < x1 - 2; x += STEP) s.lineTo(x, -crest(x) * 0.28);
  s.lineTo(x1 - 2, LAP);
  s.closePath();
  s.fill();

  // Wet: long bright dashes riding the crest. A light tint of the blood, not white, or they ink over.
  s.strokeStyle = css(color, 34, 1, -24);
  s.lineWidth = 1.5;
  s.lineCap = 'round';
  for (let x = x0 + 4 + hash2(along(first), across(first), 3) * 3; x < x1 - 6; x += TILE * 0.9) {
    const len = 3 + hash2(Math.floor(x), across(first), 4) * 4;
    const y = -crest(x + len / 2) * 0.62;
    s.beginPath();
    s.moveTo(x, y);
    s.lineTo(Math.min(x + len, x1 - 3), y);
    s.stroke();
  }
}

/** What only a floor gets: drips over its lip, and a glint that travels along it so a still puddle looks wet from across the screen. */
function drawFloorExtras(rc: RC, run: readonly BloodCell[], color: HSL) {
  const s = rc.s;
  const first = run[0];
  const y = first.ty * TILE;
  s.fillStyle = css(color, -16);
  for (const c of run) {
    if (hash2(c.tx, c.ty, 7) > 0.55) continue;
    s.beginPath();
    s.roundRect((c.tx + 0.2 + hash2(c.tx, c.ty, 8) * 0.6) * TILE - 1, y, 2, LAP + 1.5 + hash2(c.tx, c.ty, 9) * 2.5, 1);
    s.fill();
  }
  const x0 = first.tx * TILE;
  const sweep = (rc.t * 0.35 + first.tx * 0.17 + first.ty * 0.11) % 1;
  if (sweep < 0.35)
    glowDot(rc.g, x0 + (run.length * TILE * sweep) / 0.35, y - CREST * 0.6, 7, { h: color.h, s: 60, l: 86 }, 0.5 * Math.sin((sweep / 0.35) * Math.PI));
}

/** Every puddle and smear. `frame` is the race frame; anything does once none are still oozing. */
export function drawBlood(rc: RC, m: Match, frame: number) {
  if (m.blood.length === 0) return;
  const s = rc.s;
  for (const run of runsOf(m.blood, frame)) {
    const c = run[0];
    const color = bloodColor(m, c.slot);
    s.save();
    if (isFloor(c)) s.translate(0, c.ty * TILE);
    else {
      // Lay the floor drawing down the wall: x runs down it, and -y points off the face.
      const side = FACE[c.face][0];
      s.translate((c.tx + (side > 0 ? 1 : 0)) * TILE, 0);
      s.scale(side, 1);
      s.rotate(Math.PI / 2);
    }
    drawRun(rc, run, color, frame);
    s.restore();
    if (isFloor(c)) drawFloorExtras(rc, run, color);
  }
}
