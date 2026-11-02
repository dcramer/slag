import type { ProjectileSpawn } from '../props/registry';
import type { Runner, RunWorld } from '../run';
import type { InputFrame } from '../types';
import { cx, cy, itemEvent, spawnDrop } from './common';
import { placeBlock } from './pocket';
import { launchTax } from './tax';
import type { ItemKind } from './types';

/**
 * The held-item roster. Every item has an upside and a catch, and none of them
 * kills on its own (docs/DESIGN.md: "not everything is death"): they shove,
 * daze and misdirect, and the level does the rest. Adding an item: extend
 * ItemKind, add a spec here and art in src/render/items.ts.
 */
export interface ItemSpec {
  kind: ItemKind;
  name: string;
  /** Uses when it pops out of a crate. */
  uses: number;
  /** What `use` does, as a button label (`Swing`, `Throw`). */
  verb: string;
  /** Carrying it caps jump take-off speed (px/s). */
  jumpCap?: number;
  /** Fire it. Called only when `use` is pressed with uses left and no cooldown. Returns true if a use was spent. */
  use(w: RunWorld, r: Runner, inp: InputFrame): boolean;
}

/** Tuning shared with the step code and the tests. */
export const SWORD = {
  /** Swing length; the blade connects while `swing` is within [activeLo, activeHi]. */
  swing: 16,
  activeLo: 5,
  activeHi: 12,
  cooldown: 26,
  /** Swinging is heavy: speed cap (px/s) for the whole swing. */
  crawl: 70,
  reach: 18,
  knockVx: 360,
  knockVy: 280,
  /** Slowest a swatted shot leaves the blade (px/s). */
  swatSpeed: 160,
} as const;

export { BONK_CREDIT, BONK_DAZE } from './common';

export const PUCK = { speed: 230, maxFall: 420, bounces: 5 } as const;
const BOOMERANG = { speed: 340 } as const;
export const SHIELD = { jumpCap: 300, guard: 18, pop: 280 } as const;
export const ROCKET = { thrust: 7, vy: 470, vx: 120, daze: 50 } as const;
export const SMOKE = { vx: 190, vy: 230, radius: 46, life: 60 * 5, cooldown: 30 } as const;
/**
 * Walk-Off Bat: frames to a full wind-up, knock (× the noodle's) from a tap to full, how much of that goes
 * into lift at most, and reach (px).
 */
export const BAT = { windup: 36, tap: 0.6, full: 3, lift: 1.6, reach: 22 } as const;
/** Tremor Brick: frames it's held up before it comes down (the tell), and the hop it gives the grounded. */
export const TREMOR = { delay: 14, pop: 230 } as const;

/** Toss the held item forward as a loose drop (down + use, or use with a shield). */
export function tossHeld(w: RunWorld, r: Runner): void {
  const h = r.items.held;
  if (!h) return;
  const b = r.body;
  spawnDrop(w, { kind: h.kind, x: cx(r), y: b.y + 4, vx: b.facing * 150 + b.vx * 0.3, vy: -180, grace: 6 }, h.uses);
  r.items.held = null;
  r.items.windup = 0;
  r.items.noPickup = 30;
  itemEvent(w, 'drop', h.kind, r.slot, cx(r), b.y + 4);
}

/** Start a swing of the noodle or the bat; the blade connects through SWORD's active window. */
function startSwing(r: Runner, kind: ItemKind, power: number): void {
  const it = r.items;
  it.swing = SWORD.swing;
  it.swingHits = 0;
  it.swingKind = kind;
  it.swingPower = power;
  it.cooldown = SWORD.cooldown;
}

/** Let a wound-up bat go: the longer the wind-up, the harder the knock. Spends the bat. */
export function swingBat(w: RunWorld, r: Runner): void {
  const it = r.items;
  const charge = Math.min(1, (it.windup - 1) / BAT.windup);
  it.windup = 0;
  startSwing(r, 'bat', BAT.tap + (BAT.full - BAT.tap) * charge);
  itemEvent(w, 'use', 'bat', r.slot, cx(r), r.body.y);
}

/** Launch a shot from the runner's center: it clears them on its own (THROW_GRACE), and can't start inside a wall they're hugging. */
function fire(w: RunWorld, r: Runner, s: Omit<ProjectileSpawn, 'owner' | 'thrower'>): void {
  w.spawnProjectile({ ...s, owner: r.slot, thrower: w.runners.indexOf(r) });
}

export const ITEMS: Record<ItemKind, ItemSpec> = {
  sword: {
    kind: 'sword',
    name: 'Master Noodle',
    verb: 'Swing',
    uses: 4,
    use(w, r) {
      startSwing(r, 'sword', 1);
      itemEvent(w, 'use', 'sword', r.slot, cx(r), r.body.y);
      return true;
    },
  },
  puck: {
    kind: 'puck',
    name: 'Evicted Shell',
    verb: 'Kick',
    uses: 1,
    use(w, r) {
      const b = r.body;
      fire(w, r, { ammo: 'puck', x: cx(r), y: b.y + b.h - 4.5, vx: b.facing * PUCK.speed, vy: 0 });
      itemEvent(w, 'use', 'puck', r.slot, cx(r), b.y + b.h);
      return true;
    },
  },
  boomerang: {
    kind: 'boomerang',
    name: 'Stunnerang',
    verb: 'Throw',
    uses: 1,
    use(w, r, inp) {
      const b = r.body;
      fire(w, r, { ammo: 'boomerang', effect: 'bonk', x: cx(r), y: cy(r), vx: b.facing * BOOMERANG.speed, vy: inp.up ? -BOOMERANG.speed * 0.45 : 0 });
      itemEvent(w, 'use', 'boomerang', r.slot, cx(r), cy(r));
      return true;
    },
  },
  shield: {
    kind: 'shield',
    name: 'Bubble Wrap',
    verb: 'Drop',
    uses: 1,
    jumpCap: SHIELD.jumpCap,
    use(w, r) {
      tossHeld(w, r);
      return false;
    },
  },
  rocket: {
    kind: 'rocket',
    name: 'Free-Trial Jetpack',
    verb: 'Blast Off',
    uses: 1,
    use(w, r, inp) {
      const b = r.body;
      b.vy = -ROCKET.vy;
      b.vx += ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * ROCKET.vx;
      b.onGround = false;
      b.groundRef = -1;
      b.jumping = false;
      b.coyote = 0;
      b.jumpBuffer = 0;
      r.items.thrust = ROCKET.thrust;
      itemEvent(w, 'use', 'rocket', r.slot, cx(r), b.y + b.h);
      return true;
    },
  },
  smoke: {
    kind: 'smoke',
    name: 'Fog of War',
    verb: 'Lob',
    uses: 2,
    use(w, r) {
      const b = r.body;
      fire(w, r, { ammo: 'smokebomb', x: cx(r), y: cy(r), vx: b.facing * SMOKE.vx + b.vx * 0.3, vy: -SMOKE.vy });
      r.items.cooldown = SMOKE.cooldown;
      itemEvent(w, 'use', 'smoke', r.slot, cx(r), cy(r));
      return true;
    },
  },
  bat: {
    kind: 'bat',
    name: 'Walk-Off Bat',
    verb: 'Swing',
    uses: 1,
    // First press winds up (rooted); a second press, or a full wind-up, lets it go.
    use(w, r) {
      if (r.items.windup === 0) {
        r.items.windup = 1;
        return false;
      }
      swingBat(w, r);
      return true;
    },
  },
  tremor: {
    kind: 'tremor',
    name: 'Tremor Brick',
    verb: 'Slam',
    uses: 1,
    use(w, r) {
      r.items.slam = TREMOR.delay;
      itemEvent(w, 'use', 'tremor', r.slot, cx(r), r.body.y);
      return true;
    },
  },
  tax: {
    kind: 'tax',
    name: 'Front-Runner Tax',
    verb: 'Launch',
    uses: 1,
    use(w, r) {
      launchTax(w, r);
      return true;
    },
  },
  block: {
    kind: 'block',
    name: 'Pocket Block',
    verb: 'Build',
    uses: 3,
    use(w, r) {
      if (!placeBlock(w, r)) return false;
      r.items.cooldown = 8;
      return true;
    },
  },
};
