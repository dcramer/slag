import { ENDS_CLEAR, floorAt, hurtsAt, ITEM_TACTICS, KNOCKS, knockedInto, knockLanes, slagRow, tile } from '../tactics';
import type { ItemKind } from '../../sim/items/types';
import type { BrainView, Cell, Intent, PropSense, RunnerSense, SelfSense } from '../types';
import { aimOf } from './headway';
import { type Errands, ItemPlay } from './items';
import type { Lay, StrategyDef } from './types';

/** Frames it sticks with a rival before looking round for a nearer one. */
const MARK_FRAMES = 90;
/** Tiles nearer than its mark another rival has to be for it to turn on them at once. */
const SWITCH = 3;
/**
 * Rows the slag has to rise past the lowest it has seen before it counts as pouring: the view rounds its feet and the
 * slag apart, so a jump reads as the slag moving a quarter row or so.
 */
const POURED = 1;
/** Rows of slag under its feet, once it's pouring, that send it up out of the way, and how far it looks for higher ground. */
const SLAG_NEAR = 6;
const LOOK_ACROSS = 16;
const LOOK_UP = 12;
/** Rows of slag under its feet, once it's pouring, past which any hit throws someone toward it: no waiting for a better one. */
const SLAG_CLOSE = 9;
/** Frames between looks for higher ground. */
const REFUGE_EVERY = 15;
/** Frames it gives a spot of high ground before it gives up on getting there. */
const REFUGE_FRAMES = 4 * 60;
/** Its boxes are what it fights with, but one across the arena is time out of the fight: it goes for one within 14 tiles across and 10 rows, however far round the way there is. */
const BRAWL_ERRANDS: Errands = { across: 14, rows: 10, detour: Infinity, slag: false, shun: true };
/** Frames between looks for a hit, staggered by seat. */
const STRIKE_EVERY = 4;
/**
 * Frames a rival has been in reach of its item before it takes the hit it has rather than wait for one that throws
 * them into something: from the meekest bot to the pushiest (`press` 0 to 1).
 */
const PATIENCE = [2.5 * 60, 0.6 * 60] as const;
/** Tiles off its nearest rival (across plus rows) inside which, empty-handed, it shoves one it could shove into something rather than fetch a box, by `press`. */
const NEAR = [2, 4] as const;
/** Tiles off its rival it stands to hit with each item: in reach, and no nearer. */
const GAP: Partial<Record<ItemKind, number>> = { sword: 1, bat: 1, glove: 2, puck: 4, boomerang: 4, clock: 5, rod: 5 };
/** Tiles past a rival's reach and rows it is close enough that its hit is coming. */
const THREAT_ACROSS = 0.75;
const THREAT_ROWS = 1.25;
/** Frames it shoves at the same rival up close, getting nowhere, before it tries another way in, by `press`. */
const STALEMATE = [3 * 60, 1.25 * 60] as const;
/** Frames it spends getting over a rival it couldn't shove: hopping onto their head and down their other side. */
const FLANK_FRAMES = 50;

const lerp = ([a, b]: readonly [number, number], t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

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

/** The stand cell nearest column `x` on row `ty` (or a row either side), a few tiles at most, out of the parts' way, or null. */
function standNear(v: BrainView, x: number, ty: number): Cell | null {
  const c = Math.floor(x);
  for (let dx = 0; dx <= 3; dx++)
    for (const tx of dx ? [c - dx, c + dx] : [c])
      for (const y of [ty, ty - 1, ty + 1])
        if (tx >= 0 && tx < v.level.w && tile(v, tx, y) === 0 && floorAt(v, tx, y + 1) && !hurtsAt(v, tx, y)) return { tx, ty: y };
  return null;
}

/** Each arena's knock lanes, by its parts as they stand. */
const lanes = new WeakMap<readonly PropSense[], readonly number[]>();

/**
 * Where a brawl's parts go: where a knock throws someone and they'd still come down safe (tactics.ts `knockLanes`),
 * so the part turns that knock into a kill, and nowhere near where the field starts, where a part would only catch
 * someone walking off at GO. There's no route to block: everyone fights over the same screen.
 */
function brawlLay(v: BrainView): Lay {
  const ends = v.objective.kind === 'fight' ? v.objective.ends : [v.level.spawn];
  let cells = lanes.get(v.props);
  if (!cells) {
    cells = knockLanes(v, ends);
    lanes.set(v.props, cells);
  }
  return { cells, keeps: (tx, ty) => !ends.some((e) => Math.abs(e.tx - tx) <= ENDS_CLEAR && Math.abs(e.ty - ty) <= ENDS_CLEAR) };
}

/** Rivals still in it. */
const rivals = (v: BrainView) => v.runners.filter((r) => r.alive && !r.finished);

/** Tiles from `me` to `r`, across plus rows. */
const apart = (me: SelfSense, r: RunnerSense) => Math.abs(r.x - me.x) + Math.abs(r.y - me.y);

/** The nearest rival still in it, by tiles across and rows. */
function nearest(v: BrainView, me: SelfSense): RunnerSense | null {
  let best: RunnerSense | null = null;
  for (const r of rivals(v)) if (!best || apart(me, r) < apart(me, best)) best = r;
  return best;
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

/** A rival with something that knocks, in reach of it, on the side that throws it into something: a hit that's coming. */
function threat(v: BrainView, me: SelfSense): Threat | null {
  const self: RunnerSense = { slot: v.slot, x: me.x, y: me.y, up: me.up, grounded: me.grounded, alive: true, finished: false, held: me.held?.kind ?? null };
  for (const r of rivals(v)) {
    const kind = r.held && KNOCKS[r.held] ? r.held : null;
    if (Math.abs(r.x - me.x) > (kind ? (GAP[kind] ?? 1) : 0.5) + THREAT_ACROSS || Math.abs(r.y - me.y) > THREAT_ROWS) continue;
    const d = sideOf(r.x, me.x);
    if (knockedInto(v, me, self, d, kind)) return { r, d };
  }
  return null;
}

/** Out of the way of a hit that's coming: round to the rival's other side, by the motor's own safe moves, and back at them from there. */
function dodge(v: BrainView, me: SelfSense, t: Threat): Intent | null {
  const c = standNear(v, t.r.x - t.d * 1.5, standOf(t.r).ty);
  // Nowhere round them but where it stands: no dodge, so it fights.
  if (!c || (c.tx === me.tx && c.ty === me.ty)) return null;
  return { do: 'goTo', ...c };
}

/**
 * Brawl: knock everyone else into the level, and keep at it. It closes on the nearest rival, and with something in
 * hand would rather hit from the side that throws them into whatever kills them (an edge, a drop, a hazard, the slag;
 * tactics.ts `knockedInto`), but takes the hit it has once they've been in reach a moment (`press`), cornered or with
 * the slag close at once. Empty-handed it fetches a box, unless a rival a shove would throw into something is right
 * there, and with no box to fetch walks into its rival from that side, which shoves on the race's own physics; a
 * shove that goes nowhere it gets over, onto their head and down the far side. It gets round a rival only when their hit is coming, and goes straight back at them. Once the slag
 * pours and comes close, it climbs out of its way.
 */
export const brawlStrategy: StrategyDef = {
  lay: brawlLay,
  haste: true,
  make(rng, traits) {
    const items = new ItemPlay(rng, traits, BRAWL_ERRANDS);
    const patience = lerp(PATIENCE, traits.press);
    const near = lerp(NEAR, traits.press);
    const stalemate = lerp(STALEMATE, traits.press);
    let frame = 0;
    let mark = -1;
    let until = 0;
    let at: Cell | null = null;
    /** The lowest the slag has stood, as its row: it pours once it rises `POURED` past that. */
    let slagLow = -Infinity;
    let pouring = false;
    /** Frame a rival came into its item's reach, or -1. */
    let inReach = -1;
    let refuge: Cell | null = null;
    const priced = new Set<number>();
    const banned = new Set<number>();
    let since = 0;
    let looked = -Infinity;
    let close = 0;
    let flank = 0;

    /** Its item's hit now, if it's worth it: one that throws someone into something, or any, cornered or kept waiting. */
    function strike(v: BrainView, me: SelfSense, cornered: boolean): Intent | null {
      const held = me.held;
      if (!held || !me.armed || traits.knack <= 0 || (frame + v.slot) % STRIKE_EVERY !== 0) return null;
      const use = ITEM_TACTICS[held.kind].when({ v, me, stalled: false });
      if (!use) return ((inReach = -1), null);
      if (inReach < 0) inReach = frame;
      if (!KNOCKS[held.kind]) return rng.chance(traits.knack) ? use : null;
      const dir = use.dir ?? me.facing;
      let victim: RunnerSense | null = null;
      for (const r of rivals(v)) if (sideOf(me.x, r.x) === dir && (!victim || Math.abs(r.x - me.x) < Math.abs(victim.x - me.x))) victim = r;
      const lined = victim !== null && knockedInto(v, me, victim, dir, held.kind);
      return (lined || cornered || frame - inReach >= patience) && rng.chance(traits.knack) ? use : null;
    }

    /**
     * Up out of the slag's way once it pours and comes close: the highest ground in reach, looked for again now and
     * then, and given up on if it isn't there in a few seconds (the way can be blocked, or crowded).
     */
    function climb(v: BrainView, me: SelfSense): Cell | null {
      if (!pouring || me.slag === null || me.slag >= SLAG_NEAR) return (refuge = null);
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
        if (sr !== Infinity) {
          slagLow = Math.max(slagLow, sr);
          if (sr < slagLow - POURED) pouring = true;
        }
        if (!me.held) inReach = -1;
        const up = climb(v, me);
        if (up) return { do: 'goTo', ...up };
        // A hit coming its way: hit them first, if it can.
        const t = threat(v, me);
        const hit = strike(v, me, t !== null || (pouring && me.slag !== null && me.slag < SLAG_CLOSE));
        if (hit) return hit;
        const swinging = me.held && me.armed && KNOCKS[me.held.kind] && traits.knack > 0;
        if (t && !swinging) {
          const away = dodge(v, me, t);
          if (away) return away;
        }
        let r = v.runners.find((q) => q.slot === mark && q.alive && !q.finished) ?? null;
        const n = nearest(v, me);
        // It sticks with its mark a while, unless someone else walks right up to it.
        if (!r || frame > until || (n && n !== r && apart(me, n) + SWITCH < apart(me, r))) {
          r = n;
          if (r?.slot !== mark) close = 0;
          mark = r?.slot ?? -1;
          until = frame + MARK_FRAMES;
          at = null;
        }
        // Empty-handed: get something to hit them with, unless a rival it could shove into something is right there.
        if (!me.held && (!r || apart(me, r) > near || r.held !== null || lineOf(v, me, r, null) === null)) {
          const side = items.think(v, me, false);
          if (side) return side;
        }
        if (!r) return { do: 'goTo', ...aimOf(v.objective) };
        // Shoving at the same rival up close, getting nowhere: over their head and down the other side.
        close = !me.held && Math.abs(r.x - me.x) < 2 && Math.abs(r.y - me.y) < 1.5 ? close + 1 : 0;
        if (close > stalemate) {
          close = 0;
          flank = frame + FLANK_FRAMES;
        }
        if (frame < flank) return { do: 'hop', tx: Math.floor(r.x) };
        at = r.grounded ? standOf(r) : (at ?? standNear(v, r.x, Math.round(r.y) - 1));
        if (!at) return { do: 'goTo', ...aimOf(v.objective) };
        const kind = me.held?.kind ?? null;
        const d = lineOf(v, me, r, kind) ?? sideOf(me.x, r.x);
        // Bare-handed it walks into them from the far side of the danger; armed, it stands off in reach.
        const gap = kind ? (GAP[kind] ?? 1) : 0;
        const wrong = sideOf(me.x, r.x) !== d;
        if (!kind && !wrong && Math.abs(r.x - me.x) >= 0.75) return { do: 'goTo', ...at };
        const c = standNear(v, r.x - d * Math.max(gap, 1.5), at.ty) ?? at;
        // Where it means to stand off, and they're still out of reach: in after them.
        if (kind && inReach < 0 && c.tx === me.tx && c.ty === me.ty) return { do: 'goTo', ...at };
        return { do: 'goTo', ...c };
      },
    };
  },
};
