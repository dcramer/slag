import type { Match, Player } from '../game/match';
import { DT, PHYS, TILE } from '../sim/constants';
import { type Level, T_ONEWAY, T_SOLID } from '../sim/level';
import type { Body, Controls } from '../sim/physics';
import type { Rect } from '../core/geom';
import { AMMO, AMMO_SIM, type Hazard, touchesHazard } from '../sim/props';
import { brakeFrom, isStandable, type Move, movesFrom, type WindColumns } from '../sim/reach';
import { gustAir } from '../sim/weather';
import type { RunWorld } from '../sim/run';
import { type InputFrame, NO_INPUT } from '../sim/types';
import { Rng } from '../core/rng';
import { fatalSlips, type Slip, slip } from '../gen/level/precision';
import type { Personality } from './personality';
import { type Foresight, foresight } from './foresight';
import { type RaceMap, raceMap } from './route';
import type { Intent } from './types';
import { aimPoint } from './view';

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
 * the way, of parts a runner sets off (foresight.ts: its own approach
 * included), and (in the air) of a gust changing under it. It looks one move
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
 *
 * Its hands aren't flawless at any level (Personality): now and then a jump
 * comes out off, more often on a tight one (a slip would drop it) or with a rival at its
 * heels, and it plays the fumble out for a moment before steering again.
 * Before such a jump, or where a hazard made it weigh its moves, it may stop
 * to think, less often on ground it has thought on before, and a pause may
 * end on a worse line than the best.
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
/** Px a rival must be within for the bot to feel it at its heels. */
const HEELS = 3 * TILE;
/** Most a fumble's chance can climb under pressure. */
const MAX_SLIP = 0.5;
/** Scales the chance to stop and think where it has thought before in this level: it remembers, roughly. */
const FAMILIAR = 0.3;
/** Chance a pause runs twice as long: now and then it really has to think. */
const LONG_THINK = 0.1;
/** Route units a worse line may cost over the best one: a plausible mistake, not a walk the wrong way. */
const STRAY_COST = 40;
const FUMBLES: readonly Slip[] = ['short', 'late', 'early', 'long'];
const NO_SLIPS: readonly Slip[] = [];
/** Moves past a tight best one it looks at for a safe one. */
const SAFE_LOOKS = 4;
/** Px/s under which braking lets go, so it stops rather than turns round. */
const BRAKE_TO = 8;

type Act =
  /** `loose`: a slipped move's fumbled frames, up to this index, are played as pressed whatever the body does; then it steers again. */
  | { kind: 'move'; m: Move; i: number; loose?: number }
  | { kind: 'settle'; at: number; t: number }
  /** Standing (against the gust, if one blows) until race frame `until`, unless something comes for it first. */
  | { kind: 'wait'; until: number }
  /** A leap of faith: run at it, jump off the edge or at the wall, hold on until it lands. */
  | { kind: 'leap'; dir: -1 | 1; t: number; jumped: boolean; flown: boolean };

/** Tiles off its column a hop steers back from. */
const HOP_SLACK = 0.15;

/** Frames a leap may last before the motor lets it go. */
const LEAP_FRAMES = 200;

export class Motor {
  private readonly rng: Rng;
  /** Frames left before it acts on what's next (Personality.reaction), holding what it held. */
  private hesitate = 0;
  private run: RunWorld | null = null;
  /** The parts set off by a runner, as they'll go from where the race stands (set each frame of a race). */
  private fore: Foresight = BLIND;
  private act: Act | null = null;
  /** The intent it was last given: a new one drops whatever it was doing. */
  private doing: Intent['do'] | '' = '';
  /** The cell it last lined up in: once per arrival, or it would never leave a cell no move suits. */
  private settled = -1;
  /** Shots in flight when the move under way was chosen: a new one means checking the rest of it again. */
  private shots = 0;
  /** Times it has set off from each cell this race. */
  private visits = new Map<number, number>();
  /** Cells it has stopped to think on in this level, across its rounds: it doubts less where it has been. */
  private seen = new Set<number>();
  /** The cell it last weighed thinking on: once per arrival. */
  private mulled = -1;
  /** Frames of thinking still owed on that cell once it has stopped, and whether it ends on a worse line. */
  private musing = 0;
  private strays = false;
  private last = -1;
  private prev: InputFrame = NO_INPUT;
  /** The match frame being driven, and the frame and way it last braked (brake). */
  private now = -1;
  private braked = { frame: -2, dir: 0 };
  /** Frame of the last confirm or alt press: a press is an edge, so never on two frames running. */
  private pressed = -2;
  /** No time to pick a move this frame (see drive). */
  private rushed = false;

  constructor(
    /** Its hands: how quick, clean and careful it is. Set again when the room's Bots rule changes. */
    public traits: Personality,
    seed: number,
  ) {
    this.rng = new Rng(seed);
  }

  /**
   * This frame's input for seat `p` doing `intent`. `rushed`: the machine has
   * no time this frame (BotSeats' budget), so it plays on with the move under
   * way and picks no new one: on the ground it brakes, as on a landing's
   * pause; in the air it holds what it held, presses aside.
   */
  drive(m: Match, p: Player, intent: Intent, rushed = false): InputFrame {
    this.rushed = rushed;
    this.now = m.frame;
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
        if (m.crateItemAt(p.cursor.x, p.cursor.y) === intent.card) return intent.do === 'pick' ? this.click(m, m.acceptsConfirm()) : NO_INPUT;
        return this.steer(p, r.x + r.w / 2, r.y + r.h / 2, 1);
      }
      case 'place': {
        if (m.phase !== 'place' || p.placed || p.claim < 0) return NO_INPUT;
        if (p.rot !== intent.rot) return this.canPress(m) ? { ...NO_INPUT, altPressed: true } : NO_INPUT;
        const { x: cx, y: cy } = aimPoint(m.crate[p.claim].def, intent.rot, intent.tx, intent.ty);
        const tol = TILE / 2 - 2;
        if (Math.abs(p.cursor.x - cx) <= tol && Math.abs(p.cursor.y - cy) <= tol) return this.click(m, m.acceptsConfirm() && m.canPlaceFor(p));
        return this.steer(p, cx, cy, tol);
      }
      case 'aim':
        return m.phase === 'place' && !p.placed ? this.steer(p, intent.x * TILE, intent.y * TILE, TILE / 2 - 2) : NO_INPUT;
      case 'goTo':
        return this.race(m, p, intent.tx, intent.ty);
      case 'leap':
        return this.leap(m, p, intent.tx);
      case 'hop':
        return this.hop(m, p, intent.tx);
      case 'use':
        // An edge, so never on two frames running; the arrows turn it to face its mark as it lets go.
        if (this.prev.usePressed || m.phase !== 'run') return NO_INPUT;
        return { ...NO_INPUT, usePressed: true, left: intent.dir === -1, right: intent.dir === 1, up: !!intent.up };
    }
  }

  /**
   * Jump straight up in column `tx`, holding it while rising, and again each time it lands. It stops first and
   * steers back over the column in the air: a box hangs over a perch as often as a floor.
   */
  private hop(m: Match, p: Player, tx: number): InputFrame {
    const r = m.phase === 'run' ? m.run?.runners.find((x) => x.slot === p.slot) : undefined;
    if (!r || !r.alive || r.finished) return NO_INPUT;
    const b = r.body;
    const off = (tx * TILE + (TILE - b.w) / 2 - b.x) / TILE;
    const lean = { left: off < -HOP_SLACK, right: off > HOP_SLACK };
    if (!b.onGround) return { ...NO_INPUT, ...lean, jump: this.prev.jump && b.vy < 0 };
    if (Math.abs(b.vx) > BRAKE_TO) return this.brake(b);
    return this.prev.jump ? NO_INPUT : { ...NO_INPUT, jump: true, jumpPressed: true };
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
      if (run.level !== this.run?.level) this.seen.clear();
      this.run = run;
      this.mulled = -1;
      this.musing = 0;
      this.strays = false;
      this.act = null;
      this.settled = -1;
      this.visits.clear();
      this.last = -1;
    }
    const b = r.body;
    if (this.rushed) return this.follow(b) ?? this.coast(b);
    const map = raceMap(run);
    this.fore = foresight(run, map);
    const act = this.act;
    if (
      act?.kind === 'move' &&
      act.loose === undefined &&
      run.projectiles.length > this.shots &&
      hurts(map, this.fore, act.m, run.frame, b, shotsAhead(run, map), this.traits.margin, act.i)
    ) {
      this.act = null;
      this.hesitate = this.traits.reaction;
    }
    this.shots = run.projectiles.length;
    // Waiting for its moment, but something is coming for it where it stands: it looks again now.
    if (act?.kind === 'wait' && hurtsStill(map, this.fore, run.frame, b, shotsAhead(run, map), this.traits.margin)) this.act = null;
    const go = this.follow(b);
    if (go) return go;
    // On landing, a moment to see what's next, unless something is coming for it where it stands: anyone flinches.
    // It brakes meanwhile, as a player who doesn't know what's next stops rather than coasts off the ledge.
    // In the air there's no time to stand and look: it steers at once.
    if (this.hesitate > 0 && b.onGround && !hurtsStill(map, this.fore, run.frame, b, shotsAhead(run, map), this.traits.margin)) {
      this.hesitate--;
      return Math.abs(b.vx) <= BRAKE_TO || this.gust() !== 0 ? this.still(b) : this.brake(b);
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

  /**
   * Stop on the ground by pressing back, as a player does. At a walk a turn is instant, so a press back that turned it
   * round would press back again the other way next frame, and on, never stopping (or hopping): having just pressed
   * back the other way, it lets go instead, which stops it within a frame or two.
   */
  private brake(b: Body): InputFrame {
    const dir = b.vx > 0 ? -1 : 1;
    const turned = this.braked.frame === this.now - 1 && this.braked.dir === -dir;
    this.braked = { frame: this.now, dir: turned ? 0 : dir };
    return this.press({ left: !turned && dir < 0, right: !turned && dir > 0, jump: false, jumpPressed: false });
  }

  /** Rushed with nothing under way: brake on the ground, keep the held buttons in the air (a jump not cut short). */
  private coast(b: Body): InputFrame {
    if (b.onGround) return Math.abs(b.vx) <= BRAKE_TO || this.gust() !== 0 ? this.still(b) : this.brake(b);
    const { left, right, jump, run, down } = this.prev;
    return { ...NO_INPUT, left, right, jump, run, down };
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
    const exposed = hurtsStill(map, this.fore, f, b, shots, margin);
    const blocked = (mv: Move) => hurts(map, this.fore, mv, f, b, shots, margin) || (mv.air && gusty(run.level, mv, f, air));
    // Nothing clear, and nowhere to stop and wait for it: on a short ledge at a run, coasting is a fall.
    let cornered = false;
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
      let at = -1;
      // Moves a hazard is in the way of, or that land in a trap: worth waiting for if one still promises more once the wait is counted.
      const held: { mv: Move; p: number; trap: boolean }[] = [];
      let looks = 0;
      for (const { mv, p } of ranked) {
        if (blocked(mv)) {
          held.push({ mv, p, trap: false });
          continue;
        }
        if ((exposed || looks < TRAP_LOOKS) && this.trap(map, run, mv, f, dist)) {
          looks++;
          held.push({ mv, p, trap: true });
          continue;
        }
        best = mv;
        cost = p;
        at = ranked.findIndex((x) => x.mv === mv);
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
        let fatal = best.air ? fatalSlips(map.field, b, best.controls) : NO_SLIPS;
        // A tight jump: a safe move that costs little more is worth it, as a player takes the forgiving way.
        if (fatal.length && at >= 0)
          for (const x of ranked.slice(at + 1, at + 1 + SAFE_LOOKS)) {
            if (x.p > cost + this.traits.care) break;
            if (x.mv.to === here || blocked(x.mv)) continue;
            const risk = x.mv.air ? fatalSlips(map.field, b, x.mv.controls) : NO_SLIPS;
            if (risk.length || this.trap(map, run, x.mv, f, dist)) continue;
            best = x.mv;
            cost = x.p;
            fatal = risk;
            break;
          }
        const think = this.think(map, run, b, shots, air, here, exposed, fatal.length > 0 || held.length > 0);
        if (think) return think;
        if (this.strays && at >= 0) {
          this.strays = false;
          const worse = ranked.slice(at + 1).find((x) => x.mv.to !== here && x.mv.to !== best!.to && x.p <= cost + STRAY_COST && !blocked(x.mv));
          if (worse) best = worse.mv;
        }
        if (best.to !== here) {
          this.settled = -1;
          this.mulled = -1;
        }
        if (best.air && this.rng.chance(Math.min(MAX_SLIP, this.traits.slip * this.pressure(run, b, fatal.length > 0)))) {
          // On a tight jump, nerves pick the fumble that drops it; anywhere else it's any fumble, mostly saved.
          const s = slipped(best, this.rng, fatal.length ? fatal : FUMBLES);
          if (s) return { kind: 'move', m: s.m, i: 0, loose: Math.min(s.m.controls.length, s.until + this.traits.save) };
        }
        return { kind: 'move', m: best, i: 0 };
      }
      if (held.length && !exposed && b.onGround) {
        // Nothing clear and nothing worth a known wait: stand a beat and look again, if it can stop here.
        const hold = this.hold(map, run, b, shots, air, run.frame + 1);
        if (hold) return hold;
        cornered = true; // it can neither stop nor go clear: the least bad move
        break;
      }
    }
    return exposed || cornered || !b.onGround ? this.escape(map, run, b, shots, moves, target) : null;
  }

  /**
   * A pause to think before going on from `here`, if it takes one: rolled
   * once per arrival where the next move is a tight jump or a hazard made it
   * weigh its moves (`hard`), less often where it has thought before. It
   * brakes to a stop first, and only where standing is safe; whether the
   * pause ends on a worse line is rolled with it.
   */
  private think(map: RaceMap, run: RunWorld, b: Body, shots: readonly Shot[], air: number, here: number, exposed: boolean, hard: boolean): Act | null {
    if (!b.onGround || exposed) return null;
    if (this.mulled !== here) {
      this.mulled = here;
      this.musing = 0;
      this.strays = false;
      if (!hard || !this.rng.chance(this.traits.think * (this.seen.has(here) ? FAMILIAR : 1))) return null;
      this.seen.add(here);
      this.musing = Math.round(this.traits.muse * this.rng.range(0.5, 1.5) * (this.rng.chance(LONG_THINK) ? 2 : 1));
      this.strays = this.rng.chance(this.traits.stray);
    }
    if (this.musing <= 0) return null;
    const hold = this.hold(map, run, b, shots, air, run.frame + this.musing);
    if (hold?.kind === 'wait') this.musing = 0;
    // Nowhere safe to stop: no time to think either.
    else if (!hold) this.musing = 0;
    return hold;
  }

  /** How much more likely a jump is to come out off: a tight one, and a rival at its heels, each make it choke. */
  private pressure(run: RunWorld, b: Body, tight: boolean): number {
    let k = tight ? this.traits.choke : 1;
    const me = b.x + b.w / 2;
    const close = run.runners.some(
      (r) => r.body !== b && r.alive && !r.finished && Math.abs(r.body.x + r.body.w / 2 - me) < HEELS && Math.abs(r.body.y - b.y) < HEELS,
    );
    if (close) k *= Math.sqrt(this.traits.choke);
    return k;
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
        if (!hurts(map, this.fore, mv, f + k, b, NO_SHOTS, margin) && !(mv.air && gusty(run.level, mv, f + k, gustAir(run.level, f + k)))) {
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
    if (!stop || hurts(map, this.fore, stop, run.frame, b, shots, this.traits.margin)) return null;
    return { kind: 'move', m: stop, i: 0 };
  }

  /** Could it stop where it is, braking if it's moving, with nothing reaching it on the way or once it's stopped? */
  private canStop(map: RaceMap, run: RunWorld, b: Body, shots: readonly Shot[], air: number, f = run.frame, ahead = STILL_AHEAD): boolean {
    const margin = this.traits.margin;
    if (Math.abs(b.vx) < 0.5) return !hurtsStill(map, this.fore, f, b, shots, margin, ahead);
    const stop = brakeFrom(map.field, b, run.solids, air, columns(map, f));
    return (
      !!stop && !hurts(map, this.fore, stop, f, b, shots, margin) && !hurtsStill(map, this.fore, f + stop.controls.length, stop.end, NO_SHOTS, margin, ahead)
    );
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
      if (!hurts(map, this.fore, next, t, e, NO_SHOTS, margin) && !hurtsStill(map, this.fore, t + next.controls.length, next.end, NO_SHOTS, margin, TRAP_AHEAD))
        return false;
    }
    return true;
  }

  /** Nothing is clear, and standing is about to hurt or it is in the air: the move it is hit latest on (if later than standing), nearest the target among those. */
  private escape(map: RaceMap, run: RunWorld, b: Body, shots: readonly Shot[], moves: readonly Move[], target: number): Act | null {
    const dist = map.rough(target);
    let best: Move | null = null;
    let hit = b.onGround && Math.abs(b.vx) < 0.5 ? firstHitStill(map, this.fore, run.frame, b, shots) : -1;
    let cost = Infinity;
    for (const mv of moves) {
      const h = firstHit(map, this.fore, mv, run.frame, b, shots);
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
const BLIND: Foresight = { watch: () => ({ at: () => ({ hazards: [], moved: [] }) }) };
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

/** Does a box at (x, y) meet anything that hurts `i` frames from race frame `f`, the parts set off along the way (`set`) included? */
function struck(
  map: RaceMap,
  shots: readonly Shot[],
  f: number,
  i: number,
  box: { x: number; y: number; w: number; h: number },
  set: readonly Hazard[],
): boolean {
  for (const h of map.hazards(f + i)) if (touchesHazard(box, h)) return true;
  for (const h of set) if (touchesHazard(box, h)) return true;
  for (const s of shots) if (i < s.xs.length && touchesHazard(box, { owner: -1, kind: 'circle', x: s.xs[i], y: s.ys[i], r: s.r })) return true;
  return false;
}

/** Would a hazard reach the body if it stood where it is for the next `ahead` frames? Standing there sets off what watches the spot. */
function hurtsStill(map: RaceMap, fore: Foresight, f: number, b: Body, shots: readonly Shot[], margin: number, ahead = STILL_AHEAD): boolean {
  const box = { x: b.x - margin, y: b.y - margin, w: b.w + 2 * margin, h: b.h + 2 * margin };
  const w = fore.watch();
  for (let i = 0; i < ahead; i++) {
    const seen = w.at(f + i, box);
    if (struck(map, shots, f, i, box, seen.hazards) || bumpedBy(seen.moved, b.x, b.y, b)) return true;
  }
  return false;
}

/** Frames until something reaches a body standing where it is (Infinity if nothing does within STILL_AHEAD), with no room to spare. */
function firstHitStill(map: RaceMap, fore: Foresight, f: number, b: Body, shots: readonly Shot[]): number {
  const w = fore.watch();
  for (let i = 0; i < STILL_AHEAD; i++) if (struck(map, shots, f, i, b, w.at(f + i, b).hazards)) return i;
  return Infinity;
}

/** Frames into `mv` it's first hit (Infinity if never), with no room to spare. */
function firstHit(map: RaceMap, fore: Foresight, mv: Move, f: number, b: Body, shots: readonly Shot[]): number {
  const box = { x: 0, y: 0, w: b.w, h: b.h };
  const w = fore.watch();
  for (let i = 0; i < mv.controls.length; i++) {
    box.x = mv.path[2 * i];
    box.y = mv.path[2 * i + 1];
    if (struck(map, shots, f, i, box, w.at(f + i, box).hazards)) return i;
  }
  return Infinity;
}

/** Does the gust change under `mv` from the `air` it was traced in, while it's off the ground? */
function gusty(level: RunWorld['level'], mv: Move, f: number, air: number): boolean {
  for (let i = 0; i < mv.controls.length; i++) if (Math.abs(gustAir(level, f + i) - air) > GUST_SLACK) return true;
  return false;
}

/**
 * Does the body meet a hazard, or a part's solid that has moved into its
 * way, anywhere along `mv` from its `from`th frame on, which is race frame
 * `f`? Parts the move itself sets off on the way count as they'll go.
 */
function hurts(map: RaceMap, fore: Foresight, mv: Move, f: number, b: Body, shots: readonly Shot[], margin: number, from = 0): boolean {
  const box = { x: 0, y: 0, w: b.w + 2 * margin, h: b.h + 2 * margin };
  const w = fore.watch();
  for (let i = from; i < mv.controls.length; i++) {
    const x = mv.path[2 * i];
    const y = mv.path[2 * i + 1];
    box.x = x - margin;
    box.y = y - margin;
    const seen = w.at(f + i - from, box);
    if (struck(map, shots, f, i - from, box, seen.hazards) || bumped(map, f + i - from, x, y, b) || bumpedBy(seen.moved, x, y, b)) return true;
  }
  return false;
}

/** Px a moving solid may overlap a body's box before it counts: riding on one or brushing past isn't a bump. */
const BUMP = 1;

/** Would a body at (x, y) on race frame `f` be inside a part's solid that has moved there since the race began? */
function bumped(map: RaceMap, f: number, x: number, y: number, b: Body): boolean {
  return bumpedBy(map.moving(f), x, y, b);
}

function bumpedBy(solids: readonly Rect[], x: number, y: number, b: Body): boolean {
  for (const s of solids) if (x + b.w - BUMP > s.x && x + BUMP < s.x + s.w && y + b.h - BUMP > s.y && y + BUMP < s.y + s.h) return true;
  return false;
}

/**
 * `mv` as a thumb might fumble it, the way a level's difficulty counts
 * (gen/level/precision.ts `slip`): let go of jump early, pressed a beat late
 * or early, or never braking, carried on through the landing and past it.
 * Some come up short, some run straight off a stone or a short perch. The
 * path no longer says where the body will be, so the fumbled frames, up to
 * `until`, are played without checking (Act `loose`); after that the body
 * is off its recording and the motor steers from wherever it got to, as a
 * player saves a fumbled jump in the air.
 */
function slipped(mv: Move, rng: Rng, kinds: readonly Slip[]): { m: Move; until: number } | null {
  const j = mv.controls.findIndex((c) => c.jumpPressed);
  for (const kind of rng.shuffle([...kinds])) {
    const controls = slip(mv.controls, kind);
    if (!controls) continue;
    let end = j;
    while (end + 1 < mv.controls.length && mv.controls[end + 1].jump) end++;
    const shift = controls.length - mv.controls.length;
    const until = kind === 'short' ? end + 1 : kind === 'long' ? controls.length : j + Math.max(0, shift) + 1;
    return { m: { ...mv, controls }, until };
  }
  return null;
}
