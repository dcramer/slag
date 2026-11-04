import type { Match, Player } from '../game/match';
import { DT, PHYS, TILE } from '../sim/constants';
import { type Level, T_ONEWAY, T_SOLID } from '../sim/level';
import type { Body, Controls } from '../sim/physics';
import { AMMO, AMMO_SIM, footprint, touchesHazard } from '../sim/props';
import { brakeFrom, isStandable, type Move, movesFrom, type WindColumns } from '../sim/reach';
import { gustAir } from '../sim/weather';
import type { RunWorld } from '../sim/run';
import { type InputFrame, NO_INPUT } from '../sim/types';
import { Rng } from '../core/rng';
import type { Personality } from './personality';
import { type RaceMap, raceMap } from './route';
import type { Intent } from './types';

/**
 * A seat's hands: turns intents into the InputFrame a player would produce.
 * It's the game's own code and reads the real state, as a player's hands
 * act on the real game, but it only ever presses buttons.
 *
 * In a race it plays the controller's own moves (reach.ts `movesFrom`, run
 * steps along the ground included, traced in the gust blowing now and in the
 * parts' winds as they will blow): from where the body is, it takes the move
 * whose landing is nearest the target by the route, counting the time it
 * takes, among those that keep clear of
 * the hazards the parts' cycles will bring, of the parts' solids moving into
 * the way, and (in the air) of a gust changing under it. It looks one move
 * past a landing a hazard is about to reach, and won't land where it can't
 * stop and has no clear way on. A held move is worth waiting for only while
 * it still beats the clear ones once the wait it needs is counted as time,
 * and waiting means braking to a stop it can make, running into a gust that
 * would carry it off, never letting go in the air. With nothing clear and
 * something coming, it takes the move that's hit last. It plays the move's
 * recorded inputs and picks again as soon as the body isn't where the
 * recording said it would be (a bump, a part the route didn't know). The
 * route's moves start from rest at a cell's middle, so when nothing from
 * where it is does as well as the route promises, it stops and lines up
 * first, where stopping is safe. Cursor intents move the cursor with the
 * arrows and click, so everyone watches it choose.
 */

/** Route units (tenths of a tile) one frame is worth: about a walk. */
const FRAME_COST = 1.1;
/** How far (px) the body may be from where its move said before it picks again. */
const DRIFT = 0.5;
/** Route units a choice may fall short of the route's promise before the motor lines up and looks again. */
const SHORT = 12;
/** Frames lining up may take. */
const SETTLE_FRAMES = 40;
/** Route units added to a landing per time the motor has already set off from that cell this race: it tries something new rather than circle. */
const AGAIN = 15;
/** Within this many px of the target, the cursor taps instead of holding, so it stops where it means to. */
const TAP_NEAR = 40;

type Act =
  /** `loose`: a slipped move's fumbled frames, up to this index, are played as pressed whatever the body does; then it steers again. */
  | { kind: 'move'; m: Move; i: number; loose?: number }
  | { kind: 'settle'; at: number; t: number }
  /** Standing (against the gust, if one blows) until race frame `until`, unless something comes for it first. */
  | { kind: 'wait'; until: number }
  /** A leap of faith: run at it, jump off the edge or at the wall, hold on until it lands. */
  | { kind: 'leap'; dir: -1 | 1; t: number; jumped: boolean; flown: boolean };

/** Frames a leap may last before the motor lets it go. */
const LEAP_FRAMES = 200;

export class Motor {
  private readonly rng: Rng;
  /** Frames left before it acts on what's next (Personality.reaction), holding what it held. */
  private hesitate = 0;
  private run: RunWorld | null = null;
  private act: Act | null = null;
  /** The intent it was last given: a new one drops whatever it was doing. */
  private doing: Intent['do'] | '' = '';
  /** The cell it last lined up in: once per arrival, or it would never leave a cell no move suits. */
  private settled = -1;
  /** Shots in flight when the move under way was chosen: a new one means checking the rest of it again. */
  private shots = 0;
  /** Times it has set off from each cell this race. */
  private visits = new Map<number, number>();
  private last = -1;
  private prev: InputFrame = NO_INPUT;
  /** Frame of the last confirm or alt press: a press is an edge, so never on two frames running. */
  private pressed = -2;

  constructor(
    /** Its hands: how quick, clean and careful it is. Set again when the room's Bots rule changes. */
    public traits: Personality,
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }

  /** This frame's input for seat `p` doing `intent`. */
  drive(m: Match, p: Player, intent: Intent): InputFrame {
    const out = this.frame(m, p, intent);
    if (out.confirmPressed || out.altPressed) this.pressed = m.frame;
    this.prev = out;
    return out;
  }

  private canPress(m: Match): boolean {
    return m.frame - this.pressed > 1;
  }

  private frame(m: Match, p: Player, intent: Intent): InputFrame {
    if (intent.do !== this.doing) {
      this.doing = intent.do;
      this.act = null;
    }
    switch (intent.do) {
      case 'wait':
        return NO_INPUT;
      case 'ready':
        return m.phase === 'lobby' && !p.ready && this.canPress(m) ? { ...NO_INPUT, confirmPressed: true } : NO_INPUT;
      case 'giveUp':
        return { ...NO_INPUT, alt: true, altPressed: !this.prev.alt };
      case 'pick':
      case 'hover': {
        const card = m.crate[intent.card];
        if (m.phase !== 'pick' || !card || p.claim >= 0) return NO_INPUT;
        const r = card.rect;
        if (m.crateItemAt(p.cursor.x, p.cursor.y) === intent.card) return intent.do === 'pick' ? this.click(m, m.phaseFrame > 10) : NO_INPUT;
        return this.steer(p, r.x + r.w / 2, r.y + r.h / 2, 1);
      }
      case 'place': {
        if (m.phase !== 'place' || p.placed || p.claim < 0) return NO_INPUT;
        if (p.rot !== intent.rot) return this.canPress(m) ? { ...NO_INPUT, altPressed: true } : NO_INPUT;
        const cells = footprint(m.crate[p.claim].def, intent.rot);
        let w = 0;
        let h = 0;
        for (const [x, y] of cells) {
          w = Math.max(w, x + 1);
          h = Math.max(h, y + 1);
        }
        // The cursor point Match.ghostOrigin turns back into (tx, ty).
        const cx = (intent.tx + (w - 1) / 2 + 0.5) * TILE;
        const cy = (intent.ty + (h - 1) / 2 + 0.5) * TILE;
        const tol = TILE / 2 - 2;
        if (Math.abs(p.cursor.x - cx) <= tol && Math.abs(p.cursor.y - cy) <= tol) return this.click(m, m.phaseFrame > 10 && m.canPlaceFor(p));
        return this.steer(p, cx, cy, tol);
      }
      case 'goTo':
        return this.race(m, p, intent.tx, intent.ty);
      case 'leap':
        return this.leap(m, p, intent.tx);
    }
  }

  /** Run toward column `tx` and jump at the first edge or wall: what a player tries with no better idea. */
  private leap(m: Match, p: Player, tx: number): InputFrame {
    const run = m.phase === 'run' ? m.run : null;
    const r = run?.runners.find((x) => x.slot === p.slot);
    if (!run || !r || !r.alive || r.finished) return NO_INPUT;
    const b = r.body;
    let act = this.act?.kind === 'leap' ? this.act : null;
    if (!act) {
      if (!b.onGround) return NO_INPUT;
      const to = (tx + 0.5) * TILE - (b.x + b.w / 2);
      act = this.act = { kind: 'leap', dir: to < 0 ? -1 : to > 0 ? 1 : b.facing, t: 0, jumped: false, flown: false };
    }
    const { dir } = act;
    if (!b.onGround) act.flown = true;
    if (act.t++ > LEAP_FRAMES || (act.flown && b.onGround)) {
      this.act = null;
      return NO_INPUT;
    }
    let press = false;
    if (b.onGround && !act.jumped) {
      // About to run off the ground, or stopped by a wall after the run-up: jump now.
      const field = raceMap(run).field;
      const ahead = Math.floor((dir > 0 ? b.x + b.w + Math.max(1, Math.abs(b.vx) / 60) : b.x - Math.max(1, Math.abs(b.vx) / 60)) / TILE);
      const under = field.tiles[Math.floor((b.y + b.h + 1) / TILE) * field.w + ahead];
      press = (under !== T_SOLID && under !== T_ONEWAY) || (act.t > 10 && Math.abs(b.vx) < 5);
      act.jumped = press;
    }
    return { ...NO_INPUT, left: dir < 0, right: dir > 0, run: true, jump: act.jumped, jumpPressed: press };
  }

  private click(m: Match, ok: boolean): InputFrame {
    return ok && this.canPress(m) ? { ...NO_INPUT, confirmPressed: true } : NO_INPUT;
  }

  /** Arrows toward (x, y) in the cursor's own space: held from afar, tapped up close so the ramp starts over. */
  private steer(p: Player, x: number, y: number, tol: number): InputFrame {
    const dx = x - p.cursor.x;
    const dy = y - p.cursor.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < TAP_NEAR && p.cursorHeld > 0) return NO_INPUT;
    return { ...NO_INPUT, left: dx < -tol, right: dx > tol, up: dy < -tol, down: dy > tol };
  }

  private race(m: Match, p: Player, tx: number, ty: number): InputFrame {
    const run = m.phase === 'run' ? m.run : null;
    const r = run?.runners.find((x) => x.slot === p.slot);
    if (!run || !r || !r.alive || r.finished) return NO_INPUT;
    if (run !== this.run) {
      this.run = run;
      this.act = null;
      this.settled = -1;
      this.visits.clear();
      this.last = -1;
    }
    const map = raceMap(run);
    const b = r.body;
    const act = this.act;
    if (
      act?.kind === 'move' &&
      act.loose === undefined &&
      run.projectiles.length > this.shots &&
      hurts(map, act.m, run.frame, b, shotsAhead(run, map), this.traits.margin, act.i)
    ) {
      this.act = null;
      this.hesitate = this.traits.reaction;
    }
    this.shots = run.projectiles.length;
    // Waiting for its moment, but something is coming for it where it stands: it looks again now.
    if (act?.kind === 'wait' && hurtsStill(map, run.frame, b, shotsAhead(run, map), this.traits.margin)) this.act = null;
    const go = this.follow(b);
    if (go) return go;
    // On landing, a moment to see what's next, unless something is coming for it where it stands: anyone flinches.
    // In the air there's no time to stand and look: it steers at once.
    if (this.hesitate > 0 && b.onGround && !hurtsStill(map, run.frame, b, shotsAhead(run, map), this.traits.margin)) {
      this.hesitate--;
      return NO_INPUT;
    }
    this.hesitate = 0;
    this.act = this.choose(map, run, b, ty * map.field.w + tx);
    return this.follow(b) ?? NO_INPUT;
  }

  /** The next input of the act under way, or null if there's none or it's over. */
  private follow(b: Body): InputFrame | null {
    const act = this.act;
    if (!act) return null;
    switch (act.kind) {
      case 'wait':
        if (!this.run || this.run.frame >= act.until || !b.onGround) return (this.act = null);
        return this.still(b);
      case 'move': {
        const { m, i } = act;
        const off = i > 0 && i > (act.loose ?? -1) && (Math.abs(b.x - m.path[2 * i - 2]) > DRIFT || Math.abs(b.y - m.path[2 * i - 1]) > DRIFT);
        if (i >= m.controls.length || off) {
          // A landing, or the world not doing what it expected: it takes a moment to see what's next.
          if (m.air || off) this.hesitate = this.traits.reaction;
          return (this.act = null);
        }
        act.i++;
        return this.press(m.controls[i]);
      }
      case 'settle': {
        // Stop, then tap toward the middle of the cell, where the route's moves start.
        const mid = (act.at % (this.run?.level.w ?? 1)) * TILE + (TILE - b.w) / 2;
        const off = mid - b.x;
        // In a gust there's no lining up: it stands against it (wait) or goes.
        if (this.gust() !== 0 || !b.onGround || act.t++ > SETTLE_FRAMES || (Math.abs(b.vx) < 0.5 && Math.abs(off) <= 1)) return (this.act = null);
        // Against the skid past a walk, as the landing's own stop was proven (reach.ts brakeFrom).
        const hard = Math.abs(b.vx) > PHYS.walkSpeed + 1;
        if (Math.abs(b.vx) >= 0.5) return this.press({ left: hard && b.vx > 0, right: hard && b.vx < 0, jump: false, jumpPressed: false });
        return this.press({ left: off < 0 && act.t % 3 === 0, right: off > 0 && act.t % 3 === 0, jump: false, jumpPressed: false });
      }
      case 'leap':
        return (this.act = null); // a leap belongs to the leap intent; a route picks afresh
    }
  }

  /** The gust blowing on the race this frame, px/s (+ right). */
  private gust(): number {
    return this.run ? gustAir(this.run.level, this.run.frame) : 0;
  }

  /**
   * Standing still: nothing pressed, or in a gust, running into it whenever
   * it's carrying the body off, which holds the ground a walk would lose.
   */
  private still(b: Body): InputFrame {
    const air = b.onGround ? this.gust() : 0;
    if (air === 0 || b.vx * Math.sign(air) <= 2) return NO_INPUT;
    return this.press({ left: air > 0, right: air < 0, run: true, jump: false, jumpPressed: false });
  }

  private press(c: Controls): InputFrame {
    const down = !!c.down;
    return { ...NO_INPUT, left: c.left, right: c.right, down, downPressed: down && !this.prev.down, jump: c.jump, jumpPressed: c.jumpPressed, run: !!c.run };
  }

  /**
   * The best thing to do from here: every move the controller has from this
   * body, scored by the time it takes plus the route from where it lands.
   * With no route anywhere, the open-air distance at least points the way.
   * Moves are traced in the gust blowing now and the parts' winds, and one in
   * the air while the gust changes is held back like one a hazard is in the
   * way of: a player waits for the lull. A move that lands somewhere about
   * to hurt with no clear way on is a trap, worth waiting out like a blocked
   * one. Waiting brakes to a stop first, and only where it can stop. With
   * nothing clear and danger coming, it takes whatever is hit last rather
   * than stand there.
   */
  private choose(map: RaceMap, run: RunWorld, b: Body, target: number): Act | null {
    const f = run.frame;
    const here = standCell(map.field, b);
    if (here === target && b.onGround) return null;
    if (b.onGround && here !== this.last) {
      this.last = here;
      this.visits.set(here, (this.visits.get(here) ?? 0) + 1);
    }
    const air = gustAir(run.level, f);
    const moves = movesFrom(map.field, b, run.solids, air, columns(map, f));
    const shots = shotsAhead(run, map);
    // Standing here is about to hurt: no waiting for a better moment.
    const margin = this.traits.margin;
    const exposed = hurtsStill(map, f, b, shots, margin);
    const blocked = (mv: Move) => hurts(map, mv, f, b, shots, margin) || (mv.air && gusty(run.level, mv, f, air));
    for (const dist of [map.dist(target), map.rough(target)]) {
      // `c` ranks moves, with what it has tried already counted against them; `p` is what the route promises.
      const ranked: { mv: Move; c: number; p: number }[] = [];
      for (const mv of moves) {
        // A hop that lands where it stands only ever dodges something; otherwise standing still says the same.
        if (mv.to === here && b.onGround && !exposed) continue;
        const p = dist[mv.to] + mv.controls.length * FRAME_COST;
        if (Number.isFinite(p)) ranked.push({ mv, c: p + (this.visits.get(mv.to) ?? 0) * AGAIN, p });
      }
      ranked.sort((x, y) => x.c - y.c);
      let best: Move | null = null;
      let cost = Infinity;
      // Moves a hazard is in the way of, or that land in a trap: worth waiting for if one still promises more once the wait is counted.
      const held: { mv: Move; p: number; trap: boolean }[] = [];
      let looks = 0;
      for (const { mv, p } of ranked) {
        if (blocked(mv)) {
          held.push({ mv, p, trap: false });
          continue;
        }
        if (looks < TRAP_LOOKS && !exposed && this.trap(map, run, mv, f, dist)) {
          looks++;
          held.push({ mv, p, trap: true });
          continue;
        }
        best = mv;
        cost = p;
        break;
      }
      if (held.length && !exposed && b.onGround) {
        const wait = this.waitFor(map, run, b, held, cost - this.traits.hurry);
        if (wait) {
          const hold = this.hold(map, run, b, shots, air, wait);
          if (hold) return hold;
        }
      }
      if (!best) {
        const trap = held.find((h) => h.trap);
        if (trap) {
          best = trap.mv;
          cost = trap.p;
        }
      }
      if (b.onGround && !exposed && this.settled !== here && cost > dist[here] + SHORT && this.canStop(map, run, b, shots, air)) {
        this.settled = here;
        return { kind: 'settle', at: here, t: 0 };
      }
      if (best) {
        if (best.to !== here) this.settled = -1;
        if (best.air && this.rng.chance(this.traits.slip)) {
          const s = slipped(best, this.rng);
          if (s) return { kind: 'move', m: s.m, i: 0, loose: s.until };
        }
        return { kind: 'move', m: best, i: 0 };
      }
      if (held.length && !exposed && b.onGround) {
        // Nothing clear and nothing worth a known wait: stand a beat and look again, if it can stop here.
        const hold = this.hold(map, run, b, shots, air, run.frame + 1);
        if (hold) return hold;
        break; // it can neither stop nor go clear: the least bad move
      }
    }
    return exposed || !b.onGround ? this.escape(map, run, b, shots, moves, target) : null;
  }

  /**
   * The frame to wait until, if a held move started then (from standing
   * here) still promises more than `beat` with the wait counted as time:
   * the first frame within WAIT_AHEAD a blocked one comes clear, as a player
   * watches the saw come round. A trap is looked at again a beat later.
   * Null when no wait pays.
   */
  private waitFor(map: RaceMap, run: RunWorld, b: Body, held: readonly { mv: Move; p: number; trap: boolean }[], beat: number): number | null {
    const f = run.frame;
    const margin = this.traits.margin;
    let until: number | null = null;
    let value = beat;
    for (const { mv, p, trap } of held.slice(0, WAIT_LOOKS)) {
      if (p + FRAME_COST >= value) continue;
      if (trap) {
        if (p + TRAP_WAIT * FRAME_COST < value) {
          value = p + TRAP_WAIT * FRAME_COST;
          until = f + 1;
        }
        continue;
      }
      for (let k = WAIT_STEP; k <= WAIT_AHEAD && p + k * FRAME_COST < value; k += WAIT_STEP) {
        if (!hurts(map, mv, f + k, b, NO_SHOTS, margin) && !(mv.air && gusty(run.level, mv, f + k, gustAir(run.level, f + k)))) {
          value = p + k * FRAME_COST;
          until = f + k;
          break;
        }
      }
    }
    return until;
  }

  /** Waiting where it is until race frame `until`: still already, or braking to a stop it can make without anything reaching it on the way. */
  private hold(map: RaceMap, run: RunWorld, b: Body, shots: readonly Shot[], air: number, until: number): Act | null {
    if (!b.onGround) return null; // no standing still in the air: it steers
    if (Math.abs(b.vx) < 0.5) return { kind: 'wait', until };
    const stop = brakeFrom(map.field, b, run.solids, air, columns(map, run.frame));
    if (!stop || hurts(map, stop, run.frame, b, shots, this.traits.margin)) return null;
    return { kind: 'move', m: stop, i: 0 };
  }

  /** Could it stop where it is, braking if it's moving, with nothing reaching it on the way or once it's stopped? */
  private canStop(map: RaceMap, run: RunWorld, b: Body, shots: readonly Shot[], air: number, f = run.frame, ahead = STILL_AHEAD): boolean {
    const margin = this.traits.margin;
    if (Math.abs(b.vx) < 0.5) return !hurtsStill(map, f, b, shots, margin, ahead);
    const stop = brakeFrom(map.field, b, run.solids, air, columns(map, f));
    return !!stop && !hurts(map, stop, f, b, shots, margin) && !hurtsStill(map, f + stop.controls.length, stop.end, NO_SHOTS, margin, ahead);
  }

  /**
   * Does `mv` land somewhere a hazard is about to reach, with no clear move
   * on from there? One move further ahead, as a player sees that the beach
   * they could jump down to is about to flood.
   */
  private trap(map: RaceMap, run: RunWorld, mv: Move, f: number, dist: Float64Array): boolean {
    const margin = this.traits.margin;
    const t = f + mv.controls.length;
    const e = mv.end;
    const air = gustAir(run.level, t);
    if (this.canStop(map, run, e, NO_SHOTS, air, t, TRAP_AHEAD)) return false;
    for (const next of movesFrom(map.field, e, run.solids, air, columns(map, t))) {
      if (next.to === mv.to || !Number.isFinite(dist[next.to])) continue;
      if (!hurts(map, next, t, e, NO_SHOTS, margin) && !hurtsStill(map, t + next.controls.length, next.end, NO_SHOTS, margin)) return false;
    }
    return true;
  }

  /** Nothing is clear, and standing is about to hurt or it is in the air: the move it is hit latest on (if later than standing), nearest the target among those. */
  private escape(map: RaceMap, run: RunWorld, b: Body, shots: readonly Shot[], moves: readonly Move[], target: number): Act | null {
    const dist = map.rough(target);
    let best: Move | null = null;
    let hit = b.onGround && Math.abs(b.vx) < 0.5 ? firstHitStill(map, run.frame, b, shots) : -1;
    let cost = Infinity;
    for (const mv of moves) {
      const h = firstHit(map, mv, run.frame, b, shots);
      const c = dist[mv.to] + mv.controls.length * FRAME_COST;
      if (h > hit || (h === hit && best && c < cost)) {
        best = mv;
        hit = h;
        cost = c;
      }
    }
    return best && { kind: 'move', m: best, i: 0 };
  }
}

/** The parts' winds from race frame `f` on, as a trace started then meets them. */
function columns(map: RaceMap, f: number): WindColumns {
  return (i) => map.winds(f + i);
}

/**
 * The cell a body stands in, named as the trace names a landing (reach.ts
 * `landing`): under its middle, or else under whichever edge is on the
 * ledge. A body on a ledge's lip with its middle over the drop is on the
 * ledge's cell, where the route goes on from; by its middle alone it would
 * be nowhere, and every hop in place there would look like getting on.
 */
function standCell(field: Level, b: Body): number {
  const ty = Math.floor((b.y + b.h - 1) / TILE);
  const mid = Math.floor((b.x + b.w / 2) / TILE);
  if (b.onGround && !isStandable(field, mid, ty))
    for (const tx of [Math.floor(b.x / TILE), Math.floor((b.x + b.w - 1) / TILE)]) if (isStandable(field, tx, ty)) return ty * field.w + tx;
  return ty * field.w + mid;
}

/** Frames ahead a body standing still checks for something coming its way, and that shots in flight are followed. */
const STILL_AHEAD = 20;
const SHOTS_AHEAD = 120;
/** Frames after a landing it should be able to stand there, or else have a clear move on: what makes a landing a trap. */
const TRAP_AHEAD = 30;
/** Clear moves per choice it looks one move further past (each is a trace from where it lands); past that it takes the next clear one. */
const TRAP_LOOKS = 4;
/** Px/s the gust may differ from the one an air move was traced in before the move won't land where it said. */
const GUST_SLACK = 20;
const NO_SHOTS: readonly Shot[] = [];
/** How far ahead (frames) and how finely it watches a blocked move for its moment, and how many blocked moves it watches. */
const WAIT_AHEAD = 150;
const WAIT_STEP = 3;
const WAIT_LOOKS = 3;
/** Frames a trap is reckoned to take to pass, when weighing it against a clear move. */
const TRAP_WAIT = 20;

/** A shot in flight, followed ahead: center per frame from now, until it hits rock or flies off. */
interface Shot {
  xs: number[];
  ys: number[];
  r: number;
}

/**
 * Where the shots in flight will be, as anyone watching would guess: on
 * their way, falling as their kind falls, until they meet rock. Shots that
 * steer or bounce go wrong after that, and the motor sees it and picks again.
 */
function shotsAhead(run: RunWorld, map: RaceMap): Shot[] {
  const g = run.level.gravity ?? 1;
  const out: Shot[] = [];
  for (const p of run.projectiles) {
    if (p.stuck >= 0 || AMMO_SIM[p.ammo]?.platform) continue;
    const spec = AMMO[p.ammo];
    const s: Shot = { xs: [], ys: [], r: spec.radius };
    let { x, y, vx, vy } = p;
    for (let i = 0; i < SHOTS_AHEAD; i++) {
      vx += p.ax * DT;
      vy += (p.ay + spec.gravity * g) * DT;
      x += vx * DT;
      y += vy * DT;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx < 0 || tx >= map.field.w || ty >= map.field.h || map.field.tiles[ty * map.field.w + tx] === T_SOLID) break;
      s.xs.push(x);
      s.ys.push(y);
    }
    out.push(s);
  }
  return out;
}

/** Does a box at (x, y) meet anything that hurts `i` frames from race frame `f`? */
function struck(map: RaceMap, shots: readonly Shot[], f: number, i: number, box: { x: number; y: number; w: number; h: number }): boolean {
  for (const h of map.hazards(f + i)) if (touchesHazard(box, h)) return true;
  for (const s of shots) if (i < s.xs.length && touchesHazard(box, { owner: -1, kind: 'circle', x: s.xs[i], y: s.ys[i], r: s.r })) return true;
  return false;
}

/** Would a hazard reach the body if it stood where it is for the next `ahead` frames? */
function hurtsStill(map: RaceMap, f: number, b: Body, shots: readonly Shot[], margin: number, ahead = STILL_AHEAD): boolean {
  const box = { x: b.x - margin, y: b.y - margin, w: b.w + 2 * margin, h: b.h + 2 * margin };
  for (let i = 0; i < ahead; i++) if (struck(map, shots, f, i, box)) return true;
  return false;
}

/** Frames until something reaches a body standing where it is (Infinity if nothing does within STILL_AHEAD), with no room to spare. */
function firstHitStill(map: RaceMap, f: number, b: Body, shots: readonly Shot[]): number {
  for (let i = 0; i < STILL_AHEAD; i++) if (struck(map, shots, f, i, b)) return i;
  return Infinity;
}

/** Frames into `mv` it's first hit (Infinity if never), with no room to spare. */
function firstHit(map: RaceMap, mv: Move, f: number, b: Body, shots: readonly Shot[]): number {
  const box = { x: 0, y: 0, w: b.w, h: b.h };
  for (let i = 0; i < mv.controls.length; i++) {
    box.x = mv.path[2 * i];
    box.y = mv.path[2 * i + 1];
    if (struck(map, shots, f, i, box)) return i;
  }
  return Infinity;
}

/** Does the gust change under `mv` from the `air` it was traced in, while it's off the ground? */
function gusty(level: RunWorld['level'], mv: Move, f: number, air: number): boolean {
  for (let i = 0; i < mv.controls.length; i++) if (Math.abs(gustAir(level, f + i) - air) > GUST_SLACK) return true;
  return false;
}

/** Does the body meet a hazard, or a part's solid that has moved into its way, anywhere along `mv` from its `from`th frame on, which is race frame `f`? */
function hurts(map: RaceMap, mv: Move, f: number, b: Body, shots: readonly Shot[], margin: number, from = 0): boolean {
  const box = { x: 0, y: 0, w: b.w + 2 * margin, h: b.h + 2 * margin };
  for (let i = from; i < mv.controls.length; i++) {
    box.x = mv.path[2 * i] - margin;
    box.y = mv.path[2 * i + 1] - margin;
    if (struck(map, shots, f, i - from, box) || bumped(map, f + i - from, mv.path[2 * i], mv.path[2 * i + 1], b)) return true;
  }
  return false;
}

/** Px a moving solid may overlap a body's box before it counts: riding on one or brushing past isn't a bump. */
const BUMP = 1;

/** Would a body at (x, y) on race frame `f` be inside a part's solid that has moved there since the race began? */
function bumped(map: RaceMap, f: number, x: number, y: number, b: Body): boolean {
  for (const s of map.moving(f)) if (x + b.w - BUMP > s.x && x + BUMP < s.x + s.w && y + b.h - BUMP > s.y && y + BUMP < s.y + s.h) return true;
  return false;
}

/**
 * `mv` as a thumb might fumble it: the jump pressed a few frames late, or let
 * go a few frames early. The path no longer says where the body will be, so
 * the fumbled frames, up to `until`, are played without checking (Act
 * `loose`); after that the body is off its recording and the motor steers
 * from wherever it got to, as a player saves a fumbled jump in the air.
 */
function slipped(mv: Move, rng: Rng): { m: Move; until: number } | null {
  const controls = mv.controls.map((c) => ({ ...c }));
  const j = controls.findIndex((c) => c.jumpPressed);
  if (j < 0) return null;
  if (j > 0 && rng.chance(0.5)) {
    const n = rng.int(1, 3);
    controls.splice(j, 0, ...Array.from({ length: n }, () => ({ ...controls[j - 1], jumpPressed: false })));
    return { m: { ...mv, controls }, until: j + n + 1 };
  }
  let end = j;
  while (end + 1 < controls.length && controls[end + 1].jump) end++;
  const from = Math.max(j + 1, end - rng.int(2, 6));
  for (let k = from; k <= end; k++) controls[k].jump = false;
  return { m: { ...mv, controls }, until: end + 1 };
}
