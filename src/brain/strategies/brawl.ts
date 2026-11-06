import { floorAt, hurtsAt, ITEM_TACTICS, KNOCKS, knockedInto, slagRow, tile } from '../tactics';
import type { ItemKind } from '../../sim/items/types';
import type { BrainView, Cell, Intent, RunnerSense, SelfSense } from '../types';
import { aimOf } from './headway';
import { type Errands, ItemPlay } from './items';
import type { StrategyDef } from './types';

/** Frames it sticks with a rival before looking round for a nearer one. */
const MARK_FRAMES = 90;
/** Rows of slag under its feet, once it's pouring, that send it up out of the way, and how far it looks for higher ground. */
const SLAG_CLOSE = 9;
const LOOK_ACROSS = 16;
const LOOK_UP = 12;
/** Frames between looks for higher ground. */
const REFUGE_EVERY = 15;
/** Frames it gives a spot of high ground before it gives up on getting there. */
const REFUGE_FRAMES = 4 * 60;
/** The arena is one screen and its boxes are what it fights with: it goes anywhere it can get to for one (a detour, to a race, is there and back to the far end). */
const BRAWL_ERRANDS: Errands = { across: Infinity, rows: Infinity, detour: Infinity, slag: false, shun: true };
/** Frames between looks for a hit, staggered by seat. */
const STRIKE_EVERY = 4;
/** Frames it holds an item waiting for a hit that throws someone into something, before it takes any hit it gets. */
const PATIENCE = 4 * 60;
/** Its knack, scaled, for a hit that throws nobody into anything: a daze still opens them up to a shove. */
const LOOSE_KNACK = 0.35;
/** Tiles off its rival it stands to hit with each item: in reach, and no nearer. */
const GAP: Partial<Record<ItemKind, number>> = { sword: 1, bat: 1, glove: 2, puck: 4, boomerang: 4 };
/** Tiles past its reach (bare-handed, past touching) and rows a rival is close enough to line it up. */
const THREAT_ACROSS = 1.5;
const THREAT_ROWS = 1.5;
/** Frames it shoves at the same rival up close, getting nowhere, before it leaves them be a while. */
const STALEMATE = 3 * 60;
const SHUN_FRAMES = 3 * 60;

/**
 * The highest stand cell near it, a few rows over its own, out of the parts' way, that it can get to (`detour`
 * finite) and hasn't given up on (`banned`), or null. The first
 * ask about a cell costs the route a field (tens of ms) and later ones are free, so it asks about one new cell a look
 * (`priced` holds the ones it has asked about), highest first.
 */
function highGround(v: BrainView, me: SelfSense, priced: Set<number>, banned: ReadonlySet<number>): Cell | null {
  for (let ty = Math.max(1, me.ty - LOOK_UP); ty < me.ty - 1; ty++)
    for (let dx = 0; dx <= LOOK_ACROSS; dx++)
      for (const tx of dx ? [me.tx - dx, me.tx + dx] : [me.tx]) {
        const k = ty * v.level.w + tx;
        if (tile(v, tx, ty) !== 0 || !floorAt(v, tx, ty + 1) || banned.has(k) || hurtsAt(v, tx, ty)) continue;
        const fresh = !priced.has(k);
        priced.add(k);
        if (Number.isFinite(v.detour(tx, ty))) return { tx, ty };
        if (fresh) return null;
      }
  return null;
}

/** Where `r` stands, as a stand cell: the row over the floor its feet are on. */
const standOf = (r: { x: number; y: number }): Cell => ({ tx: Math.floor(r.x), ty: Math.round(r.y) - 1 });

/** The stand cell nearest column `x` on row `ty` (or a row either side), a few tiles at most, or null. */
function standNear(v: BrainView, x: number, ty: number): Cell | null {
  const c = Math.floor(x);
  for (let dx = 0; dx <= 3; dx++)
    for (const tx of dx ? [c - dx, c + dx] : [c])
      for (const y of [ty, ty - 1, ty + 1]) if (tx >= 0 && tx < v.level.w && tile(v, tx, y) === 0 && floorAt(v, tx, y + 1)) return { tx, ty: y };
  return null;
}

/** Rivals still in it. */
const rivals = (v: BrainView) => v.runners.filter((r) => r.alive && !r.finished);

/** The nearest rival still in it but `skip` (unless it's the only one), by tiles across and rows. */
function nearest(v: BrainView, me: SelfSense, skip: number): RunnerSense | null {
  let best: RunnerSense | null = null;
  let bestD = Infinity;
  for (const r of rivals(v)) {
    if (r.slot === skip) continue;
    const d = Math.abs(r.x - me.x) + Math.abs(r.y - me.y);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best ?? (skip >= 0 ? nearest(v, me, -1) : null);
}

const sideOf = (from: number, to: number): -1 | 1 => (to < from ? -1 : 1);

/**
 * The way to knock `r` that throws it into something (an edge, a drop, a hazard, the slag), with `kind` in hand or
 * bare-handed, the way it's already facing them first; or null when neither does.
 */
function lineOf(v: BrainView, me: SelfSense, r: RunnerSense, kind: ItemKind | null): -1 | 1 | null {
  const ahead = sideOf(me.x, r.x);
  for (const d of [ahead, -ahead as -1 | 1]) if (knockedInto(v, me, r, d, kind)) return d;
  return null;
}

interface Threat {
  r: RunnerSense;
  /** The way it would fly. */
  d: -1 | 1;
}

/** A rival close enough to hit it with what it holds (or shove it, bare-handed), from a side that throws it into something. */
function threat(v: BrainView, me: SelfSense): Threat | null {
  const self: RunnerSense = { slot: v.slot, x: me.x, y: me.y, up: me.up, grounded: me.grounded, alive: true, finished: false, held: me.held?.kind ?? null };
  for (const r of rivals(v)) {
    const kind = r.held && KNOCKS[r.held] ? r.held : null;
    const reach = (kind ? (GAP[kind] ?? 1) : 0) + THREAT_ACROSS;
    if (Math.abs(r.x - me.x) > reach || Math.abs(r.y - me.y) > THREAT_ROWS) continue;
    const d = sideOf(r.x, me.x);
    if (knockedInto(v, me, self, d, kind)) return { r, d };
  }
  return null;
}

/** Away from a rival lined up to throw it into something: round to their other side, by the motor's own safe moves. */
function dodge(v: BrainView, t: Threat): Intent | null {
  const c = standNear(v, t.r.x - t.d * 1.5, standOf(t.r).ty);
  if (!c) return null;
  return { do: 'goTo', ...c };
}

/**
 * Brawl: knock everyone else into the level. It fetches what the arena's boxes hand out from anywhere in the arena,
 * and with something in hand gets to the side of its rival away from whatever would kill them (an edge, a drop, a
 * hazard, the slag; tactics.ts `knockedInto`) and hits them there; it takes any hit once it has waited long enough,
 * or when it's the one lined up. Bare-handed it walks into them from that side, which shoves on the race's own
 * physics, and leaves a shoving match that goes nowhere. A rival lined up to throw it into something, it gets round
 * (one bare-handed only once they're on it, a box coming first). When the slag pours in, it climbs out of its way.
 */
export const brawlStrategy: StrategyDef = {
  make(rng, traits) {
    const items = new ItemPlay(rng, traits, BRAWL_ERRANDS);
    let frame = 0;
    let mark = -1;
    let until = 0;
    let at: Cell | null = null;
    let slagWas = Infinity;
    let pouring = false;
    let heldSince = -1;
    let refuge: Cell | null = null;
    const priced = new Set<number>();
    const banned = new Set<number>();
    let since = 0;
    let looked = -Infinity;
    let close = 0;
    let shun = -1;
    let shunUntil = 0;

    /** Its item's hit now, if it's worth it: one that throws someone into something, or any, cornered or kept waiting. */
    function strike(v: BrainView, me: SelfSense, cornered: boolean): Intent | null {
      const held = me.held;
      if (!held || !me.armed || traits.knack <= 0 || (frame + v.slot) % STRIKE_EVERY !== 0) return null;
      const use = ITEM_TACTICS[held.kind].when({ v, me, stalled: false });
      if (!use) return null;
      if (!KNOCKS[held.kind]) return rng.chance(traits.knack) ? use : null;
      const dir = use.dir ?? me.facing;
      let victim: RunnerSense | null = null;
      for (const r of rivals(v)) if (sideOf(me.x, r.x) === dir && (!victim || Math.abs(r.x - me.x) < Math.abs(victim.x - me.x))) victim = r;
      if ((victim && knockedInto(v, me, victim, dir, held.kind)) || cornered) return rng.chance(traits.knack) ? use : null;
      return frame - heldSince > PATIENCE && rng.chance(traits.knack * LOOSE_KNACK) ? use : null;
    }

    /**
     * Up out of the slag's way once it pours: the highest ground in reach, looked for again now and then, and given up
     * on if it isn't there in a few seconds (the way can be blocked, or crowded).
     */
    function climb(v: BrainView, me: SelfSense): Cell | null {
      if (!pouring || me.slag === null || me.slag >= SLAG_CLOSE) return (refuge = null);
      if (refuge && frame - since > REFUGE_FRAMES && (refuge.tx !== me.tx || refuge.ty !== me.ty)) {
        banned.add(refuge.ty * v.level.w + refuge.tx);
        refuge = null;
      }
      if (frame - looked >= REFUGE_EVERY && me.grounded) {
        looked = frame;
        const higher = highGround(v, me, priced, banned);
        if (higher && (!refuge || higher.ty < refuge.ty)) {
          refuge = higher;
          since = frame;
        }
      }
      if (!refuge || (refuge.tx === me.tx && refuge.ty === me.ty)) {
        since = frame;
        return null;
      }
      return refuge;
    }

    return {
      think(v, me) {
        frame++;
        const sr = slagRow(me);
        if (sr < slagWas - 0.1 && slagWas !== Infinity) pouring = true;
        slagWas = sr;
        heldSince = me.held ? (heldSince < 0 ? frame : heldSince) : -1;
        const up = climb(v, me);
        if (up) return { do: 'goTo', ...up };
        // Lined up itself: hit them first, or get round them, so a hit throws it clear.
        const t = threat(v, me);
        // With the slag closing in, any hit throws someone toward it: no waiting for a better one.
        const hit = strike(v, me, t !== null || (pouring && me.slag !== null && me.slag < SLAG_CLOSE));
        if (hit) return hit;
        if (t && t.r.held) {
          const away = dodge(v, t);
          if (away) return away;
        }
        if (!me.held) {
          const side = items.think(v, me, false);
          if (side) return side;
        }
        if (t && Math.abs(t.r.x - me.x) < 1.5) {
          const away = dodge(v, t);
          if (away) return away;
        }
        let r = v.runners.find((q) => q.slot === mark && q.alive && !q.finished) ?? null;
        if (!r || frame > until) {
          r = nearest(v, me, frame < shunUntil ? shun : -1);
          mark = r?.slot ?? -1;
          until = frame + MARK_FRAMES;
          at = null;
          close = 0;
        }
        if (!r) return { do: 'goTo', ...aimOf(v.objective) };
        // Shoving at the same rival up close, getting nowhere: leave them be a while.
        close = Math.abs(r.x - me.x) < 2 && Math.abs(r.y - me.y) < 1.5 ? close + 1 : 0;
        if (close > STALEMATE) {
          shun = r.slot;
          shunUntil = frame + SHUN_FRAMES;
          until = 0;
        }
        if (r.grounded) at = standOf(r);
        if (!at) return { do: 'goTo', ...aimOf(v.objective) };
        const kind = me.held?.kind ?? null;
        const d = lineOf(v, me, r, kind) ?? sideOf(me.x, r.x);
        // Bare-handed it walks into them from the far side of the danger; armed, it stands off in reach.
        const gap = kind ? (GAP[kind] ?? 1) : 0;
        const wrong = sideOf(me.x, r.x) !== d;
        if (!kind && !wrong && Math.abs(r.x - me.x) >= 0.75) return { do: 'goTo', ...at };
        const c = standNear(v, r.x - d * Math.max(gap, 1.5), at.ty) ?? at;
        return { do: 'goTo', ...c };
      },
    };
  },
};
