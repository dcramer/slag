import { pointInRect } from '../../core/geom';
import { DT, TILE } from '../constants';
import type { Runner, RunWorld } from '../run';
import { leaderOf } from '../standing';
import { bonk, cx, cy, isActive, itemEvent, launch } from './common';
import type { TaxShell } from './types';

/**
 * Front-Runner Tax: a winged shell that flies over everything to whoever
 * leads (sim/standing.ts: in a race nearest the flag by route, not a straight
 * line, so a runner high in a tower beside the flag isn't the leader when the
 * way up is long; in a climb highest), hovers over them as a warning, then
 * dives on the spot they stood. If the thrower leads, it comes for the thrower.
 *
 * The shell is plain data on ItemWorld and never collides with anything; the
 * spawn zone and finishing are the only cover.
 */
export const TAX = {
  /** Cruise speed (px/s) over terrain, and dive speed: a sprint or a jump as it drops can just get clear. */
  speed: 260,
  dive: 300,
  /** Hover this high over the target's center (px), for this many frames. */
  above: 44,
  hover: 60,
  /** It follows a target sideways during the hover at most this fast (px/s): faster than a run. */
  track: 240,
  /** Dive blast: bonk and knock every runner whose center is this close (px). */
  radius: 2 * TILE,
  knockVx: 240,
  knockVy: 300,
  /** Pops on its own after this many frames. */
  life: 60 * 8,
} as const;

/** Fire a shell from the runner's head. */
export function launchTax(w: RunWorld, r: Runner): void {
  w.items.shells.push({ id: w.items.nextId++, owner: r.slot, x: cx(r), y: r.body.y - 4, target: -1, phase: 'fly', t: 0, dx: 0, dy: 0, born: w.frame });
  itemEvent(w, 'use', 'tax', r.slot, cx(r), r.body.y);
}

/** Move (x, y) toward (tx, ty) by at most `step` px; true once it's there. */
function approach(s: { x: number; y: number }, tx: number, ty: number, step: number): boolean {
  const dx = tx - s.x;
  const dy = ty - s.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= step) {
    s.x = tx;
    s.y = ty;
    return true;
  }
  s.x += (dx / d) * step;
  s.y += (dy / d) * step;
  return false;
}

/** One shell, one frame. False when it's gone. */
function stepShell(w: RunWorld, s: TaxShell): boolean {
  s.t++;
  if (w.frame - s.born > TAX.life) return pop(w, s);
  if (s.phase !== 'dive') {
    // The leader can change until the dive: someone overtakes, or the leader finishes.
    const lead = leaderOf(w);
    if (lead < 0) return pop(w, s);
    if (lead !== s.target) {
      s.target = lead;
      if (s.phase === 'hover') {
        s.phase = 'fly';
        s.t = 0;
      }
    }
    const v = w.runners[s.target];
    const hx = cx(v);
    const hy = cy(v) - TAX.above;
    if (s.phase === 'fly') {
      if (approach(s, hx, hy, TAX.speed * DT)) {
        s.phase = 'hover';
        s.t = 0;
        itemEvent(w, 'warn', 'tax', s.owner, s.x, s.y);
      }
      return true;
    }
    // Hovering: it drifts after the target, slower than a run.
    const step = TAX.track * DT;
    s.x += Math.max(-step, Math.min(step, hx - s.x));
    s.y = hy;
    if (s.t >= TAX.hover) {
      s.phase = 'dive';
      s.t = 0;
      s.dx = cx(v);
      s.dy = cy(v);
    }
    return true;
  }
  if (!approach(s, s.dx, s.dy, TAX.dive * DT)) return true;
  // The spawn zone is cover: a dive that lands there just pops.
  if (w.safeZones.some((z) => pointInRect(s.x, s.y, z.zone))) return pop(w, s);
  blast(w, s);
  return false;
}

/** The dive lands: every runner close by is bonked and thrown outward, unless they're in the spawn zone. */
function blast(w: RunWorld, s: TaxShell): void {
  const hit = w.runners.filter((r) => isActive(r) && !w.isSafe(r) && (cx(r) - s.x) * (cx(r) - s.x) + (cy(r) - s.y) * (cy(r) - s.y) <= TAX.radius * TAX.radius);
  for (const r of hit) {
    const side = cx(r) > s.x ? 1 : cx(r) < s.x ? -1 : r.body.facing;
    launch(r.body, side * TAX.knockVx, -TAX.knockVy);
    bonk(r, s.owner);
  }
  itemEvent(w, 'hit', 'tax', s.owner, s.x, s.y);
}

function pop(w: RunWorld, s: TaxShell): false {
  itemEvent(w, 'fizzle', 'tax', -1, s.x, s.y);
  return false;
}

/** Every shell in flight, in launch order (each one only reads runners, so the order changes nothing). */
export function stepShells(w: RunWorld): void {
  const shells = w.items.shells;
  if (!shells.length) return;
  w.items.shells = shells.filter((s) => stepShell(w, s));
}
