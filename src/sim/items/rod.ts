import { overlaps } from '../../core/geom';
import { DT, TILE } from '../constants';
import type { Runner, RunWorld } from '../run';
import { bonk, cx, cy, isActive, itemEvent, launch, moveBox } from './common';
import type { CastLine } from './types';

/**
 * Catch of the Day: a fishing rod that casts a lure out straight ahead (or up at a slant with up held) and yanks the
 * first rival it snags toward the caster, off whatever they stood on: the brawl's way to pull someone off a ledge
 * across a gap, into the drop between. Every other item knocks you away from whoever hit you; this one reels you in.
 * The catch: the caster stands rooted while the line goes out, and a bonk snaps it. The yank only throws; the level
 * does the rest.
 */
export const ROD = {
  /** Lure speed (px/s) out, and back in, and how far (px) the line pays out. */
  speed: 480,
  back: 720,
  range: 10 * TILE,
  /** The slant cast with up held: these shares of the speed across and up, a little steeper than a diagonal so it meets a body a row up per tile across at its middle. */
  slantX: 0.67,
  slantY: 0.74,
  /** Half-size (px) of the lure's box. */
  half: 2,
  /**
   * The yank toward the caster (px/s): `base` and `pull` more per px apart, at most `maxVx`, with a little `lift` to
   * pluck them off their feet. On open floor that skids them up to about a body short of the caster's feet; off a
   * ledge across a gap, it puts them over the drop.
   */
  base: 90,
  pull: 1.4,
  maxVx: 360,
  lift: 150,
  cooldown: 24,
} as const;

/** Where the line leaves the rod: out in front of the caster at about chest height. */
export const rodTip = (r: Runner) => ({ x: cx(r) + r.body.facing * 6, y: r.body.y + 5 });

/** Cast from the runner's rod: straight ahead, or slanting up with up held. */
export function castRod(w: RunWorld, r: Runner, up: boolean): void {
  const f = r.body.facing;
  const tip = rodTip(r);
  const vx = f * ROD.speed * (up ? ROD.slantX : 1);
  const vy = up ? -ROD.speed * ROD.slantY : 0;
  w.items.lines.push({ id: w.items.nextId++, owner: w.runners.indexOf(r), x: tip.x, y: tip.y, vx, vy, out: 0, back: false });
  r.items.cast = 1;
  r.items.cooldown = ROD.cooldown;
  itemEvent(w, 'use', 'rod', r.slot, tip.x, tip.y);
}

/** The yank across (px/s) on someone `dx` px from the caster (+: they're to the caster's right): toward the caster. */
export function yankVx(dx: number): number {
  const v = Math.min(ROD.maxVx, ROD.base + Math.abs(dx) * ROD.pull);
  return dx > 0 ? -v : dx < 0 ? v : 0;
}

/** The rival the lure touches now, nearest the caster first (then the lower slot), or null. */
function snagged(w: RunWorld, l: CastLine, owner: Runner): Runner | null {
  const box = { x: l.x - ROD.half, y: l.y - ROD.half, w: ROD.half * 2, h: ROD.half * 2 };
  let best: Runner | null = null;
  let bestD = Infinity;
  for (const r of w.runners) {
    if (r === owner || !isActive(r) || w.isSafe(r) || r.attach.grip?.sealed || !overlaps(box, r.body)) continue;
    const d = Math.abs(cx(r) - cx(owner)) + Math.abs(cy(r) - cy(owner));
    if (d < bestD || (d === bestD && best && r.slot < best.slot)) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

/** The line stops paying out: the caster can move again. */
function turnBack(l: CastLine, owner: Runner): void {
  l.back = true;
  owner.items.cast = 0;
}

/** One line, one frame. False once it's home, or snapped (its caster bonked, dazed or out). */
function stepLine(w: RunWorld, l: CastLine): boolean {
  const owner = w.runners[l.owner];
  if (!isActive(owner) || owner.items.daze > 0) {
    owner.items.cast = 0;
    return false;
  }
  const tip = rodTip(owner);
  if (l.back) {
    const dx = tip.x - l.x;
    const dy = tip.y - l.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const step = ROD.back * DT;
    if (d <= step) return false;
    l.x += (dx / d) * step;
    l.y += (dy / d) * step;
    return true;
  }
  owner.items.cast++;
  const hit = moveBox(w, l, l.vx * DT, l.vy * DT, ROD.half);
  l.out += Math.sqrt(l.vx * l.vx + l.vy * l.vy) * DT;
  if (hit.hitX || hit.hitY) {
    itemEvent(w, 'fizzle', 'rod', owner.slot, l.x, l.y);
    turnBack(l, owner);
    return true;
  }
  const v = snagged(w, l, owner);
  if (v) {
    launch(v.body, yankVx(cx(v) - cx(owner)), -ROD.lift);
    bonk(v, owner.slot);
    itemEvent(w, 'hit', 'rod', owner.slot, cx(v), cy(v));
    turnBack(l, owner);
    return true;
  }
  if (l.out >= ROD.range) turnBack(l, owner);
  return true;
}

/** Every line out, in cast order (a yank only moves runners, and later lines judge where they are now). */
export function stepLines(w: RunWorld): void {
  if (w.items.lines.length) w.items.lines = w.items.lines.filter((l) => stepLine(w, l));
}
