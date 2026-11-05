import type { Rng } from '../../core/rng';
import type { Personality } from '../personality';
import { T_SOLID } from '../../sim/level';
import { floorAt, ITEM_TACTICS, tile } from '../tactics';
import type { BrainView, Intent, SelfSense } from '../types';

/**
 * What every mode's strategy does with items: use the one in hand when its tactic (tactics.ts) says it's worth it,
 * and with empty hands, go for a box or a loose item near the way it's going. How often a bot sees its chance is its
 * `knack`: at 0 it never uses an item or goes out of its way for one.
 */

/** Frames between looks at its item, staggered by seat: a player doesn't check every frame either. */
const USE_EVERY = 8;
/** Frames between looks round for a box or an item to fetch: each new spot asks the route for a field. */
const SCAN_EVERY = 15;
/** Tiles of route it will go out of its way for one. */
const DETOUR = 8;
/** How far off it notices one, in tiles across and rows. */
const SEE_ACROSS = 10;
const SEE_ROWS = 8;
/** Rows a box may hang over the floor it's knocked from: a full jump's head room. */
const BOX_HANG = 3;
/** Rows of slag under its feet it wants before it goes out of its way for anything. */
const ERRAND_SLAG = 10;
/** Frames it keeps at an errand before giving it up. */
const ERRAND_FRAMES = 4 * 60;
/** Frames it hops under a box before giving up on it. */
const HOP_FRAMES = 90;

/** Where it's going for something: a stand cell, and the box over it to knock, if any. */
interface Errand {
  tx: number;
  ty: number;
  box: { tx: number; ty: number } | null;
  until: number;
  hops: number;
}

export class ItemPlay {
  private errand: Errand | null = null;
  private frame = 0;
  /** Spots it priced and turned down this race (a box by its cell, negated; a loose item by where it lay). */
  private readonly passed = new Set<number>();

  constructor(
    private readonly rng: Rng,
    private readonly traits: Personality,
  ) {}

  /** Off on an errand: its strategy shouldn't count the detour as being stuck. */
  get away(): boolean {
    return this.errand !== null;
  }

  /** This frame's item play, or null to race as usual. */
  think(v: BrainView, me: SelfSense, stalled: boolean): Intent | null {
    this.frame++;
    if (this.traits.knack <= 0) return null;
    const turn = (this.frame + v.slot) % USE_EVERY === 0;
    if (me.held && me.armed && turn) {
      const use = ITEM_TACTICS[me.held.kind].when({ v, me, stalled });
      if (use && this.rng.chance(this.traits.knack)) return use;
    }
    if (me.held) return (this.errand = null);
    // The slag is close enough that any detour could cost it the climb: no time for errands.
    if (me.slag !== null && me.slag < ERRAND_SLAG) return (this.errand = null);
    if (!this.errand && (this.frame + v.slot) % SCAN_EVERY === 0) this.errand = this.scan(v, me);
    return this.errand ? this.run(v, me, this.errand) : null;
  }

  private run(v: BrainView, me: SelfSense, e: Errand): Intent | null {
    if (this.frame > e.until) return (this.errand = null);
    if (e.box) {
      const ready = v.boxes.some((b) => b.tx === e.box!.tx && b.ty === e.box!.ty && b.ready);
      // Popped: whatever it dropped is the next errand.
      if (!ready) return (this.errand = null);
      // Under it: hop until it pops, carrying on through each hop's air.
      if ((e.hops > 0 && !me.grounded) || (me.tx === e.tx && me.ty === e.ty && me.grounded)) {
        if (++e.hops > HOP_FRAMES) return (this.errand = null);
        return { do: 'hop', tx: e.tx };
      }
    } else if (!v.drops.some((d) => Math.floor(d.x) === e.tx && Math.floor(d.y) === e.ty)) return (this.errand = null);
    return { do: 'goTo', tx: e.tx, ty: e.ty };
  }

  /** The nearest thing worth fetching: a loose item, or a full box to knock, a short way off its route. */
  private scan(v: BrainView, me: SelfSense): Errand | null {
    const climbing = v.objective.kind === 'climb';
    // Climbing, only what's level with it or above is on the way.
    const near = (x: number, y: number) => Math.abs(x - me.tx) <= SEE_ACROSS && me.ty - y <= SEE_ROWS && y - me.ty <= (climbing ? 1 : SEE_ROWS);
    const spots: Spot[] = [];
    for (const d of v.drops) {
      const tx = Math.floor(d.x);
      const ty = Math.floor(d.y);
      if (near(tx, ty)) spots.push({ tx, ty, box: null });
    }
    // Round a climb the slag is leashed to the leader, so a detour costs it the climb, and a box deals it only
    // something to hold on with: boxes are for whoever is behind.
    const boxes = climbing && me.rank === 0 ? [] : v.boxes;
    for (const b of boxes) {
      if (!b.ready) continue;
      // The stand cell under it: open cells down to a floor, a jump's head room at most.
      for (let k = 1; k <= BOX_HANG; k++) {
        const y = b.ty + k;
        if (tile(v, b.tx, y) !== 0) break;
        if (floorAt(v, b.tx, y + 1)) {
          if (near(b.tx, y)) spots.push({ tx: b.tx, ty: y, box: { tx: b.tx, ty: b.ty } });
          break;
        }
      }
    }
    // Each new spot priced costs the route a field (tens of ms), so it prices one a look, nearest first, and
    // remembers the ones it turned down.
    const fresh = spots.filter((s) => !this.passed.has(key(s, v.level.w)));
    fresh.sort((a, b) => Math.abs(a.tx - me.tx) + Math.abs(a.ty - me.ty) - (Math.abs(b.tx - me.tx) + Math.abs(b.ty - me.ty)));
    const s = fresh[0];
    if (!s) return null;
    if (this.worth(v, me, s)) return { ...s, until: this.frame + ERRAND_FRAMES, hops: 0 };
    this.passed.add(key(s, v.level.w));
    return null;
  }

  /** A spot a short way off its route, and for a box, one where what it pops can be got at. */
  private worth(v: BrainView, me: SelfSense, s: Spot): boolean {
    const d = s.tx === me.tx && s.ty === me.ty ? 0 : v.detour(s.tx, s.ty);
    if (d > DETOUR) return false;
    // What a box pops comes out of the top (out of the bottom under a roof): only worth knocking if it can get there.
    return !s.box || tile(v, s.box.tx, s.box.ty - 1) === T_SOLID || Number.isFinite(v.detour(s.box.tx, s.box.ty - 1));
  }
}

type Spot = Pick<Errand, 'tx' | 'ty' | 'box'>;
const key = (s: Spot, w: number) => (s.box ? -1 - (s.box.ty * w + s.box.tx) : s.ty * w + s.tx);
