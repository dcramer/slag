import { checkedInto, floorAt, hurtsAt, ITEM_TACTICS, KNOCKS, knockedInto, slagRow, tile } from '../tactics';
import { T_SOLID } from '../../sim/level';
import type { ItemKind } from '../../sim/items/types';
import type { BrainView, Cell, Intent, RunnerSense, SelfSense } from '../types';
import { aimOf } from './headway';
import { type Errands, ItemPlay } from './items';
import type { StrategyDef } from './types';

/** Frames it sticks with a rival before looking round for a nearer one. */
const MARK_FRAMES = 90;
/** Tiles nearer than its mark another rival has to be for it to turn on them at once. */
const SWITCH = 1.5;
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
/** Frames it aims a hit that throws its rival into nothing whichever way it lands, by `press`. */
const BEAT = [0.6 * 60, 0.15 * 60] as const;
/** Tiles off its nearest rival (across plus rows) inside which, empty-handed, it shoves one it could shove into something rather than fetch a box, by `press`. */
const NEAR = [2, 4] as const;
/** Tiles off a rival (across plus rows) inside which it won't turn its back on them to fetch something. */
const TURN_BACK = 6;
/**
 * Tiles off its rival it stands to hit with each item: in reach, and no nearer. The clock and the rod reach further
 * (a lob, a cast) but stand in at 3: from 5 a bot spent the fight standing off, half a screen from anyone.
 */
const GAP: Partial<Record<ItemKind, number>> = { sword: 1, bat: 1, glove: 2, puck: 4, boomerang: 4, clock: 3, rod: 3 };
/** Tiles past a rival's reach and rows it is close enough that its hit is coming. */
const THREAT_ACROSS = 0.75;
const THREAT_ROWS = 1.25;
/** Frames it shoves at the same rival up close, getting nowhere, before it tries another way in, by `press`. */
const STALEMATE = [3 * 60, 1.25 * 60] as const;
/**
 * Tiles across from a rival on its row it charges from (a run is most of the way to a check's speed by two and a bit:
 * sim/collide.ts `ShoveRules.check`), and frames a charge may run before it looks again.
 */
const RUNUP = [2.25, 5] as const;
/** Looks over which it reads a rival's way, and tiles toward it over them that count as coming at it. */
const TRACK = 5;
const COMING = 0.25;
const CHARGE_HOLD = 50;
/** Tiles across a rival's reach counts as melee: its swing winding back up, it shoves instead of standing off. */
const MELEE = 2;
/**
 * Rows up a rival standing over it may be for a hop to bump from below (past a step, inside a jump), and tiles across
 * its feet may be from its middle: a bump hits only someone standing (sim/collide.ts `ShoveRules.footed`).
 */
const BUMP_ROWS = [1, 3.5] as const;
const BUMP_ACROSS = 0.75;
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

/**
 * A rival a hop from under them would bump: standing a jump's height over it, on a board it rises up through or out
 * over a lip it rises past, nothing solid between. Someone in the air a hop only bucks, as a rider is.
 */
function bumpable(v: BrainView, me: SelfSense, r: RunnerSense): boolean {
  const rise = me.y - r.y;
  if (!r.grounded || rise <= BUMP_ROWS[0] || rise > BUMP_ROWS[1] || Math.abs(r.x - me.x) >= BUMP_ACROSS) return false;
  const x = Math.floor(me.x);
  for (let y = Math.round(r.y); y < me.ty; y++) if (tile(v, x, y) === T_SOLID) return false;
  return true;
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

/** The way a body check (a run-up into `r`, tactics.ts `checkedInto`) throws it into something, the way it's facing them first, or null. */
function chargeOf(v: BrainView, me: SelfSense, r: RunnerSense): -1 | 1 | null {
  const ahead = sideOf(me.x, r.x);
  for (const d of [ahead, -ahead as -1 | 1]) if (checkedInto(v, me, r, d)) return d;
  return null;
}

/** Open floor along its row from `me` to `r`, nothing that hurts on it: room to run at them. */
function runway(v: BrainView, me: SelfSense, r: RunnerSense): boolean {
  const to = Math.floor(r.x);
  for (let x = Math.min(me.tx, to); x <= Math.max(me.tx, to); x++)
    if (tile(v, x, me.ty) === T_SOLID || !floorAt(v, x, me.ty + 1) || hurtsAt(v, x, me.ty)) return false;
  return true;
}

interface Threat {
  r: RunnerSense;
  /** The way it would fly. */
  d: -1 | 1;
}

/** A rival with something that knocks, in reach of it, on the side that throws it into something: a hit that's coming. */
function threat(v: BrainView, me: SelfSense): Threat | null {
  const self: RunnerSense = {
    slot: v.slot,
    x: me.x,
    y: me.y,
    up: me.up,
    grounded: me.grounded,
    alive: true,
    finished: false,
    held: me.held?.kind ?? null,
    shielded: me.shielded,
  };
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
 * tactics.ts `knockedInto`), but takes the hit it has once they've been in reach a moment (`press`; a moment's aim
 * when neither way would throw them anywhere), cornered or with the slag close at once. Empty-handed it fetches a box,
 * unless a rival a shove would throw into something is right there, or the box is the other way from a rival close by. Level with a rival a few tiles off
 * on open floor, one a check throws into something who isn't coming at it, it charges (`checkedInto`); otherwise it
 * walks into them from that side, which shoves on the mode's physics, and a shove that goes nowhere it gets over,
 * onto their head and down the far side. A swing winding back up is bare hands up close, and an item that doesn't
 * knock is no help at all. It never sends itself to the cell it stands in (the motor would stand it there), and jumps
 * at a rival in the air over it. It gets round a rival only when their hit is coming, and goes straight back at them.
 * Once the slag pours and comes close, it climbs out of its way.
 */
export const brawlStrategy: StrategyDef = {
  haste: true,
  make(rng, traits) {
    const items = new ItemPlay(rng, traits, BRAWL_ERRANDS);
    const patience = lerp(PATIENCE, traits.press);
    const beat = lerp(BEAT, traits.press);
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
    /** Each rival's x over its last `TRACK` looks, oldest first. */
    const seen = new Map<number, number[]>();
    /** Has `q` been going `way` (±1) the last few looks, faster than a creep? */
    const comingAt = (q: RunnerSense, way: number) => (q.x - (seen.get(q.slot)?.[0] ?? q.x)) * way > COMING;
    /** The charge it's running, the frame it set off and at whom. */
    let charge: { at: number; mark: number; go: Extract<Intent, { do: 'charge' }> } | null = null;

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
      // Neither way throws them into anything: waiting won't bring a better hit, only a moment's aim.
      const wait = lined || (victim !== null && knockedInto(v, me, victim, -dir as -1 | 1, held.kind)) ? patience : beat;
      return (lined || cornered || frame - inReach >= wait) && rng.chance(traits.knack) ? use : null;
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
        // Where each rival stood the last few looks: which way they're going.
        for (const q of v.runners) {
          const xs = seen.get(q.slot) ?? [];
          xs.push(q.x);
          if (xs.length > TRACK) xs.shift();
          seen.set(q.slot, xs);
        }
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
        // A charge under way: it runs it through, unless it's thrown off its feet or it has stopped past them.
        if (charge) {
          const q = v.runners.find((x) => x.slot === charge!.mark);
          const passed = me.pace === 'still' && (charge.go.tx + 0.5 - me.x) * charge.go.dir <= 0;
          // They turned to meet it: a body pushing back isn't checked, only shoved, so it gives the charge up.
          if (frame - charge.at > CHARGE_HOLD || !me.grounded || charge.mark !== mark || passed || (q && comingAt(q, -charge.go.dir))) charge = null;
        }
        if (charge) return charge.go;
        // Empty-handed: get something to hit them with, unless a rival it could shove into something is right there.
        if (!me.held && (!r || apart(me, r) > near || r.held !== null || lineOf(v, me, r, null) === null)) {
          const side = items.think(v, me, false);
          // Not with its back to a rival right there: an errand the other way is a run from the fight, and they follow. Two
          // in a spawn's shield at GO aren't a fight yet.
          const turns =
            side?.do === 'goTo' &&
            r &&
            !(r.shielded && me.shielded) &&
            apart(me, r) <= TURN_BACK &&
            (side.tx + 0.5 - me.x) * (r.x - me.x) < 0 &&
            Math.abs(side.tx + 0.5 - me.x) > 2;
          if (side && !turns) return side;
        }
        if (!r) return { do: 'goTo', ...aimOf(v.objective) };
        // Shoving at the same rival up close, getting nowhere: over their head and down the other side.
        close = !(me.held && KNOCKS[me.held.kind]) && Math.abs(r.x - me.x) < 2 && Math.abs(r.y - me.y) < 1.5 ? close + 1 : 0;
        if (close > stalemate) {
          close = 0;
          flank = frame + FLANK_FRAMES;
        }
        if (frame < flank) return { do: 'hop', tx: Math.floor(r.x) };
        at = r.grounded ? standOf(r) : (at ?? standNear(v, r.x, Math.round(r.y) - 1));
        if (!at) return { do: 'goTo', ...aimOf(v.objective) };
        // What it hits them with: an item that knocks, but a swing winding back up is as good as bare hands up close,
        // and what doesn't knock (a shield, a jetpack) is no help in a fight at all.
        const knock = me.held && KNOCKS[me.held.kind] ? me.held.kind : null;
        const kind = knock && (me.armed || (GAP[knock] ?? 1) > MELEE) ? knock : null;
        const line = lineOf(v, me, r, kind);
        const mine = (c: Cell) => c.tx === me.tx && c.ty === me.ty;
        // A run-up into them throws them into something, and nothing in hand does: on its way in, level with them on
        // open floor a few tiles off, it charges.
        const cd = r.grounded && !r.shielded && !me.shielded && (line === null || !kind) ? chargeOf(v, me, r) : null;
        if (cd !== null) {
          const across = (r.x - me.x) * cd;
          // Not at one coming its way (they'd be pushing back, and a check needs someone who isn't), nor running the
          // other way itself.
          const turning = me.pace === 'running' && me.facing !== cd;
          if (!comingAt(r, -cd) && !turning && me.grounded && Math.abs(r.y - me.y) < 0.5 && across >= RUNUP[0] && across <= RUNUP[1] && runway(v, me, r)) {
            charge = { at: frame, mark, go: { do: 'charge', dir: cd, tx: Math.floor(r.x), ty: at.ty } };
            return charge.go;
          }
        }
        const d = line ?? sideOf(me.x, r.x);
        // Bare-handed it walks into them from the far side of the danger; armed, it stands off in reach.
        const gap = kind ? (GAP[kind] ?? 1) : 0;
        const wrong = sideOf(me.x, r.x) !== d;
        // Under them standing on a board or a lip over it: up into their feet.
        const aim = (c: Cell): Intent => (bumpable(v, me, r) ? { do: 'hop', tx: Math.floor(r.x) } : { do: 'goTo', ...c });
        // Bare-handed on the right side it walks in, but not to the cell it's in already (they share it): from there it
        // backs off a step and comes again, where a goTo its own cell would stand it still beside them.
        if (!kind && !wrong && !mine(at) && Math.abs(r.x - me.x) >= 0.75) return aim(at);
        const c = standNear(v, r.x - d * Math.max(gap, 1.5), at.ty) ?? at;
        // In reach already, on the side that throws them into something, its hit a look or two off: it holds its ground
        // rather than back off to the full stand-off as they come, which is only running from the fight. Where it means
        // to stand off, and they're still out of reach: in after them.
        const holds = me.grounded && kind && line !== null && !wrong && inReach >= 0 && Math.abs(c.tx + 0.5 - r.x) > Math.abs(me.x - r.x);
        const go: Intent = holds ? { do: 'goTo', tx: me.tx, ty: me.ty } : kind && inReach < 0 && mine(c) ? aim(at) : aim(c);
        // Sent to the cell it stands in with no hit coming of its own (a hit it's lining up is a moment's aim): the motor
        // would stand it there, beside a rival doing the same. It backs off a step and comes again, or past them where
        // there's no step back (a wall, the open side), so the next look finds it a way in.
        if (!me.grounded || go.do !== 'goTo' || !mine(go) || (kind && inReach >= 0)) return go;
        const back = r.x === me.x ? -me.facing : -sideOf(me.x, r.x);
        const step = [standNear(v, me.x + back * 2, me.ty), standNear(v, r.x - back * 2, me.ty)].find((s) => s && !mine(s) && s.ty >= 0 && s.ty < v.level.h);
        return step ? { do: 'goTo', ...step } : go;
      },
    };
  },
};
