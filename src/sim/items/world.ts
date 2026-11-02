import { sq } from '../../core/dmath';
import { overlaps, pointInRect, type Rect } from '../../core/geom';
import { DT, KILL_Y, TILE } from '../constants';
import { isProtected } from '../level';
import type { Body } from '../physics';
import { AMMO_SIM, statusInput } from '../props';
import type { DeathCause, Runner, RunWorld } from '../run';
import { type InputFrame, NO_INPUT } from '../types';
import { cx, cy, giveOrDrop, isActive, itemEvent, moveBox, spawnDrop } from './common';
import { BONK_CREDIT, BONK_DAZE, ITEMS, ROCKET, SHIELD, SMOKE, SWORD, tossHeld } from './roster';
import { DROP_HALF, DROP_LIFE, type ItemKind, type ItemSpawn, type RunnerItems } from './types';

/**
 * The per-frame item step and the small hooks RunWorld calls. Order inside a
 * RunWorld frame: runners move (`itemInput` / `itemPostStep`), then `stepItems`
 * (timers, use, sword hits, pickups, loose items, smoke), then projectiles,
 * then prop ticks (crates pop through `spawnItem`). Each pass resolves
 * simultaneous effects before applying them, so nobody wins a tie by runner
 * order.
 */

const DROP_GRAVITY = 1000;
const DROP_MAX_FALL = 420;
/** Status refreshed each frame inside a cloud: it wears off the moment you're out. */
const SMOKE_SLOW = 2;

/** Drop a loose item into the run (crate pops use this through TickCtx.spawnItem). */
export function spawnItem(w: RunWorld, s: ItemSpawn): void {
  spawnDrop(w, s, ITEMS[s.kind].uses);
}

/** Put an item straight into a runner's hands (debug tools, tests). */
export function giveItem(r: Runner, kind: ItemKind, uses = ITEMS[kind].uses): void {
  r.items.held = { kind, uses };
}

/** The controls a runner actually gets. Like freezing, a daze leaves only giving up (alt). */
export function itemInput(it: RunnerItems, inp: InputFrame): InputFrame {
  if (it.daze > 0) return inp.altPressed ? { ...NO_INPUT, altPressed: true } : NO_INPUT;
  return inp;
}

/** After `stepBody`: heavy items cap jumps, swings cap speed, the rocket keeps pushing and then dazes you. */
export function itemPostStep(it: RunnerItems, b: Body): void {
  const cap = it.held ? ITEMS[it.held.kind].jumpCap : undefined;
  if (cap !== undefined && b.jumping && b.vy < -cap) b.vy = -cap;
  if (it.swing > 0 && Math.abs(b.vx) > SWORD.crawl) b.vx = b.vx > 0 ? SWORD.crawl : -SWORD.crawl;
  if (it.thrust > 0) {
    if (b.vy > -ROCKET.vy) b.vy = -ROCKET.vy;
    if (--it.thrust === 0) it.daze = Math.max(it.daze, ROCKET.daze);
  }
}

/** Shield and post-shield guard: true cancels this death. Only hazards are blockable, not falls, crushes, self-destructs or timeouts. */
export function absorbHit(w: RunWorld, r: Runner, cause: DeathCause): boolean {
  if (cause !== 'hazard') return false;
  const it = r.items;
  if (it.guard > 0) return true;
  if (it.held?.kind !== 'shield') return false;
  it.held = null;
  it.guard = SHIELD.guard;
  launch(r.body, 0, -SHIELD.pop);
  r.body.vx = 0;
  itemEvent(w, 'block', 'shield', r.slot, cx(r), cy(r));
  return true;
}

/** Deaths the level dealt soon after a rival's bonk credit that rival (trap points), like any prop kill. */
export function creditKill(r: Runner, killer: number, cause: DeathCause): number {
  if (killer >= 0 || cause === 'pop' || cause === 'timeout') return killer;
  const it = r.items;
  return it.bonkCredit > 0 && it.bonkedBy !== r.slot ? it.bonkedBy : killer;
}

/** Stars and kill credit for a bonk, however it landed. */
export function bonk(r: Runner, by: number): void {
  const it = r.items;
  it.daze = Math.max(it.daze, BONK_DAZE);
  it.bonkedBy = by;
  it.bonkCredit = BONK_CREDIT;
}

/** A shot came back to the hand that threw it. */
export function catchShot(w: RunWorld, r: Runner, kind: ItemKind): void {
  giveOrDrop(w, r, kind, 1, cx(r), r.body.y);
  itemEvent(w, 'catch', kind, r.slot, cx(r), cy(r));
}

/** Smoke bomb burst. Like goo and frost patches, smoke never lands inside a protected zone. */
export function burstSmoke(w: RunWorld, x: number, y: number): void {
  if (isProtected(w.level, Math.floor(x / TILE), Math.floor(y / TILE))) return;
  w.items.clouds.push({ x, y: y - 6, r: SMOKE.radius, born: w.frame, until: w.frame + SMOKE.life });
  itemEvent(w, 'smoke', 'smoke', -1, x, y - 6);
}

const tick = (n: number) => (n > 0 ? n - 1 : 0);

function launch(b: Body, vx: number, vy: number): void {
  b.vx = vx;
  b.vy = vy;
  b.onGround = false;
  b.groundRef = -1;
  b.jumping = false;
  b.coyote = 0;
}

function bladeBox(r: Runner): Rect {
  const b = r.body;
  return { x: b.facing > 0 ? b.x + b.w - 2 : b.x + 2 - SWORD.reach, y: b.y - 6, w: SWORD.reach, h: b.h + 6 };
}

/** Timers, and letting go of what dead and finished runners held. Items that die in the pit are gone. */
function stepTimers(w: RunWorld): void {
  for (const r of w.runners) {
    const it = r.items;
    it.cooldown = tick(it.cooldown);
    it.swing = tick(it.swing);
    it.guard = tick(it.guard);
    it.noPickup = tick(it.noPickup);
    if (it.thrust === 0) it.daze = tick(it.daze);
    if (it.bonkCredit > 0 && --it.bonkCredit === 0) it.bonkedBy = -1;
    if (isActive(r) || !it.held) continue;
    const h = it.held;
    it.held = null;
    if (r.body.y >= KILL_Y - 24) continue;
    spawnDrop(w, { kind: h.kind, x: cx(r), y: r.body.y + 2, vx: (r.slot & 1 ? 1 : -1) * 50, vy: -200, grace: 20 }, h.uses);
    itemEvent(w, 'drop', h.kind, r.slot, cx(r), r.body.y);
  }
}

/** Fire held items. Down + use tosses whatever you hold. */
function useHeld(w: RunWorld, inputs: readonly InputFrame[]): void {
  w.runners.forEach((r, i) => {
    const it = r.items;
    if (!isActive(r) || !it.held || it.cooldown > 0 || it.thrust > 0) return;
    const inp = itemInput(it, statusInput(r.status, inputs[i] ?? NO_INPUT));
    if (!inp.usePressed) return;
    if (inp.down) return tossHeld(w, r);
    const h = it.held;
    if (ITEMS[h.kind].use(w, r, inp) && --h.uses <= 0) it.held = null;
  });
}

/** Resolve every live swing against this frame's positions, then apply all the knocks at once. */
function swingSwords(w: RunWorld): void {
  const rs = w.runners;
  const knocks = rs.map(() => ({ vx: 0, by: -1 }));
  rs.forEach((a, ai) => {
    const it = a.items;
    if (!isActive(a) || it.swing < SWORD.activeLo || it.swing > SWORD.activeHi) return;
    const box = bladeBox(a);
    rs.forEach((v, vi) => {
      // The spawn zone shields you from kicks too.
      if (vi === ai || !isActive(v) || w.isSafe(v) || it.swingHits & (1 << vi) || !overlaps(box, v.body)) return;
      it.swingHits |= 1 << vi;
      const k = knocks[vi];
      k.vx += a.body.facing * SWORD.knockVx;
      if (k.by < 0 || a.slot < k.by) k.by = a.slot;
    });
    for (const p of w.projectiles) {
      const sim = AMMO_SIM[p.ammo];
      if (p.stuck >= 0 || sim?.platform || !pointInRect(p.x, p.y, box) || (p.owner === a.slot && p.vx * a.body.facing > 0)) continue;
      p.vx = a.body.facing * Math.max(Math.abs(p.vx), SWORD.swatSpeed);
      p.vy = Math.min(p.vy, -40);
      p.owner = a.slot;
      p.born = w.frame;
      sim?.init?.(p);
      itemEvent(w, 'hit', p.ammo, a.slot, p.x, p.y);
    }
  });
  rs.forEach((v, vi) => {
    const k = knocks[vi];
    if (k.by < 0) return;
    launch(v.body, k.vx, -SWORD.knockVy);
    bonk(v, k.by);
    itemEvent(w, 'hit', 'sword', k.by, cx(v), cy(v));
  });
}

/** Empty-handed runners grab loose items they touch. Contested items go to the nearest runner, then the lower slot. */
function pickUp(w: RunWorld): void {
  const drops = w.items.drops;
  if (!drops.length) return;
  const keep = [];
  for (const d of drops) {
    let best: Runner | null = null;
    let bestD = Infinity;
    if (w.frame - d.born >= d.grace) {
      for (const r of w.runners) {
        if (!isActive(r) || r.items.held || r.items.noPickup > 0) continue;
        if (!overlaps({ x: d.x - DROP_HALF, y: d.y - DROP_HALF, w: DROP_HALF * 2, h: DROP_HALF * 2 }, r.body)) continue;
        const dx = cx(r) - d.x;
        const dy = cy(r) - d.y;
        const dd = dx * dx + dy * dy;
        if (dd < bestD || (dd === bestD && best && r.slot < best.slot)) {
          best = r;
          bestD = dd;
        }
      }
    }
    if (best) {
      best.items.held = { kind: d.kind, uses: d.uses };
      itemEvent(w, 'pickup', d.kind, best.slot, d.x, d.y);
    } else keep.push(d);
  }
  w.items.drops = keep;
}

/** Loose items fall, land, slide to a stop, ride what they rest on, and fizzle out after DROP_LIFE frames. */
function stepDrops(w: RunWorld): void {
  const drops = w.items.drops;
  if (!drops.length) return;
  const keep = [];
  for (const d of drops) {
    d.vy = Math.min(d.vy + DROP_GRAVITY * DT, DROP_MAX_FALL);
    const hit = moveBox(w, d, d.vx * DT, d.vy * DT, DROP_HALF);
    if (hit.hitX) d.vx = -d.vx * 0.3;
    d.onGround = hit.hitY && d.vy > 0;
    if (hit.hitY) d.vy = 0;
    if (d.onGround) {
      d.vx *= 0.82;
      if (Math.abs(d.vx) < 2) d.vx = 0;
      if (hit.ground) {
        d.x += hit.ground.dx;
        d.y += hit.ground.dy;
      }
    }
    if (d.y > KILL_Y) continue;
    if (w.frame - d.born > DROP_LIFE) {
      itemEvent(w, 'fizzle', d.kind, -1, d.x, d.y);
      continue;
    }
    keep.push(d);
  }
  w.items.drops = keep;
}

/** Clouds slow everyone inside through the ordinary slowed status, except in the spawn zone. */
function stepClouds(w: RunWorld): void {
  const clouds = w.items.clouds;
  if (!clouds.length) return;
  for (const r of w.runners) {
    if (!isActive(r) || w.isSafe(r)) continue;
    const inside = clouds.some((c) => sq(cx(r) - c.x) + sq(cy(r) - c.y) < c.r * c.r);
    if (inside && r.status.slowed < SMOKE_SLOW) r.status.slowed = SMOKE_SLOW;
  }
  if (clouds.some((c) => w.frame >= c.until)) w.items.clouds = clouds.filter((c) => w.frame < c.until);
}

/** One frame of the item system. `inputs` are per runner index; no `use` lands before the race is live. */
export function stepItems(w: RunWorld, inputs: readonly InputFrame[], live: boolean): void {
  stepTimers(w);
  if (live) useHeld(w, inputs);
  swingSwords(w);
  pickUp(w);
  stepDrops(w);
  stepClouds(w);
}
