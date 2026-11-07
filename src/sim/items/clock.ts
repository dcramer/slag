import { dhypot } from '../../core/dmath';
import { DT, TILE } from '../constants';
import { killY, T_SOLID, tileAt } from '../level';
import type { Runner, RunWorld } from '../run';
import { gustAir } from '../weather';
import { bonk, cx, cy, isActive, itemEvent, launch, moveBox } from './common';
import type { AlarmClock } from './types';

/**
 * Rude Awakening: an alarm clock lobbed in an arc, over a lip or up onto a ledge, the brawl's way to reach someone
 * nobody can walk up to. It comes down, rings for a beat (the tell: a ring the size of its blast, and the bells
 * hammering), then goes off, throwing everyone near it outward from it and up, all but its thrower: they set it for
 * someone else, and the catch is the beat it rings, long enough to step out of its reach. Nothing kills on
 * its own: the blast only throws, and the level does the rest. Rock between the clock and a body shields it.
 */
export const CLOCK = {
  /** A lob (px/s): forward and up, and the high one with up held, for a ledge overhead. The thrower's run adds a share. */
  vx: 170,
  vy: 260,
  highVx: 110,
  highVy: 430,
  carry: 0.3,
  gravity: 1000,
  maxFall: 420,
  /** Half-size of its box (px). */
  half: 4,
  /**
   * Frames from the throw to the blast: once down it rings out what's left of `fuse`, but never less than `ring`
   * (the tell); and the longest it can fly before it rings anyway.
   */
  fuse: 54,
  ring: 24,
  flight: 90,
  /** Everyone whose middle is this close (px) when it goes off is thrown. */
  radius: 3 * TILE,
  /** The throw at the clock itself (px/s, out and up), easing to `edge` of it at the blast's rim. */
  vxOut: 400,
  vyOut: 300,
  edge: 0.5,
  cooldown: 30,
} as const;

/** Lob one from the runner's hand: the high lob with up held. */
export function lobClock(w: RunWorld, r: Runner, up: boolean): void {
  const b = r.body;
  const vx = b.facing * (up ? CLOCK.highVx : CLOCK.vx) + b.vx * CLOCK.carry;
  w.items.clocks.push({
    id: w.items.nextId++,
    owner: r.slot,
    x: cx(r),
    y: b.y + 4,
    vx,
    vy: -(up ? CLOCK.highVy : CLOCK.vy),
    born: w.frame,
    fuse: 0,
    ring: 0,
    onGround: false,
  });
  r.items.cooldown = CLOCK.cooldown;
  itemEvent(w, 'use', 'clock', r.slot, cx(r), b.y + 4);
}

/** No rock on the straight line from (ax, ay) to (bx, by): sampled every few px, which a tile can't slip between. */
function clearLine(w: RunWorld, ax: number, ay: number, bx: number, by: number): boolean {
  const n = Math.max(1, Math.ceil(dhypot(bx - ax, by - ay) / 4));
  for (let i = 1; i < n; i++) {
    const x = ax + ((bx - ax) * i) / n;
    const y = ay + ((by - ay) * i) / n;
    if (tileAt(w.level, Math.floor(x / TILE), Math.floor(y / TILE)) === T_SOLID) return false;
  }
  return true;
}

/**
 * The throw a blast at (x, y) gives a body whose middle is at (px, py), or null out of its reach: out from the clock
 * across, never toward it, and always up, hardest at the clock and `edge` of that at the rim. One straight overhead goes
 * straight up.
 */
export function blastThrow(x: number, y: number, px: number, py: number): { vx: number; vy: number } | null {
  const dx = px - x;
  const d = dhypot(dx, py - y);
  if (d > CLOCK.radius) return null;
  const k = 1 - (1 - CLOCK.edge) * (d / CLOCK.radius);
  return { vx: (dx > 0 ? 1 : dx < 0 ? -1 : 0) * CLOCK.vxOut * k, vy: CLOCK.vyOut * k };
}

/**
 * It goes off: every rival in reach with no rock between is thrown (`blastThrow`) and bonked, credited to the thrower,
 * all judged before any of them moves. The spawn zone and a part that shuts someone in keep them out of it.
 */
function blast(w: RunWorld, c: AlarmClock): void {
  const hit: { r: Runner; vx: number; vy: number }[] = [];
  for (const r of w.runners) {
    if (r.slot === c.owner || !isActive(r) || w.isSafe(r) || r.attach.grip?.sealed) continue;
    const t = blastThrow(c.x, c.y, cx(r), cy(r));
    if (t && clearLine(w, c.x, c.y, cx(r), cy(r))) hit.push({ r, ...t });
  }
  for (const { r, vx, vy } of hit) {
    launch(r.body, vx, -vy);
    bonk(r, c.owner);
  }
  itemEvent(w, 'hit', 'clock', c.owner, c.x, c.y);
}

/** One clock, one frame: it flies, comes down and settles on what it lands on, rings, and goes off. False once it's gone. */
function stepClock(w: RunWorld, c: AlarmClock): boolean {
  c.vy = Math.min(c.vy + CLOCK.gravity * (w.level.gravity ?? 1) * DT, CLOCK.maxFall);
  const hit = moveBox(w, c, (c.vx + (c.onGround ? 0 : gustAir(w.level, w.frame))) * DT, c.vy * DT, CLOCK.half);
  if (hit.hitX) c.vx = -c.vx * 0.35;
  const landed = hit.hitY && c.vy > 0;
  if (hit.hitY) c.vy = 0;
  c.onGround = landed;
  if (landed) {
    c.vx *= 0.6;
    if (Math.abs(c.vx) < 4) c.vx = 0;
    if (hit.ground) {
      c.x += hit.ground.dx;
      c.y += hit.ground.dy;
    }
  }
  if (c.y > killY(w.level)) return false;
  if (c.fuse === 0 && (landed || w.frame - c.born >= CLOCK.flight)) {
    c.fuse = Math.max(CLOCK.ring, CLOCK.fuse - (w.frame - c.born));
    itemEvent(w, 'warn', 'clock', c.owner, c.x, c.y);
  }
  if (c.fuse === 0 || ++c.ring < c.fuse) return true;
  blast(w, c);
  return false;
}

/** Every clock in flight or ringing, in throw order (a blast only moves runners, and later clocks judge where they are now). */
export function stepClocks(w: RunWorld): void {
  if (w.items.clocks.length) w.items.clocks = w.items.clocks.filter((c) => stepClock(w, c));
}
