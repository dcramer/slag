import type { Match, Player } from '../game/match';
import { DT, TILE } from '../sim/constants';
import { T_ONEWAY, T_SOLID } from '../sim/level';
import type { Body, Controls } from '../sim/physics';
import { AMMO, AMMO_SIM, footprint, touchesHazard } from '../sim/props';
import { type Move, movesFrom } from '../sim/reach';
import type { RunWorld } from '../sim/run';
import { type InputFrame, NO_INPUT } from '../sim/types';
import { type RaceMap, raceMap } from './route';
import type { Intent } from './types';

/**
 * A seat's hands: turns intents into the InputFrame a player would produce.
 * It's the game's own code and reads the real state, as a player's hands
 * act on the real game, but it only ever presses buttons.
 *
 * In a race it plays the controller's own moves (reach.ts `movesFrom`): from
 * where the body is, it takes the move whose landing is nearest the target
 * by the route, counting the time it takes, among those that keep clear of
 * the hazards the parts' cycles will bring; with none clear it waits a beat.
 * It plays the move's recorded inputs and picks again as soon as the body
 * isn't where the recording said it would be (a bump, a gust, a part the
 * route didn't know). The route's moves start from rest at a cell's middle,
 * so when nothing from where it is does as well as the route promises, it
 * stops and lines up first. Cursor intents move the cursor with the arrows
 * and click, so everyone watches it choose.
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
/** Px of room kept from a hazard's edge. */
const MARGIN = 2;
/** Within this many px of the target, the cursor taps instead of holding, so it stops where it means to. */
const TAP_NEAR = 40;

type Act =
  | { kind: 'move'; m: Move; i: number }
  | { kind: 'settle'; at: number; t: number }
  | { kind: 'wait' }
  /** A leap of faith: run at it, jump off the edge or at the wall, hold on until it lands. */
  | { kind: 'leap'; dir: -1 | 1; t: number; jumped: boolean; flown: boolean };

/** Frames a leap may last before the motor lets it go. */
const LEAP_FRAMES = 200;

export class Motor {
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
    if (act?.kind === 'move' && run.projectiles.length > this.shots && hurts(map, act.m, run.frame, b, shotsAhead(run, map), act.i)) this.act = null;
    this.shots = run.projectiles.length;
    const go = this.follow(b);
    if (go) return go;
    this.act = this.choose(map, run, b, ty * map.field.w + tx);
    return this.follow(b) ?? NO_INPUT;
  }

  /** The next input of the act under way, or null if there's none or it's over. */
  private follow(b: Body): InputFrame | null {
    const act = this.act;
    if (!act) return null;
    switch (act.kind) {
      case 'wait':
        this.act = null;
        return NO_INPUT;
      case 'move': {
        const { m, i } = act;
        if (i >= m.controls.length || (i > 0 && (Math.abs(b.x - m.path[2 * i - 2]) > DRIFT || Math.abs(b.y - m.path[2 * i - 1]) > DRIFT)))
          return (this.act = null);
        act.i++;
        return this.press(m.controls[i]);
      }
      case 'settle': {
        // Stop, then tap toward the middle of the cell, where the route's moves start.
        const mid = (act.at % (this.run?.level.w ?? 1)) * TILE + (TILE - b.w) / 2;
        const off = mid - b.x;
        if (!b.onGround || act.t++ > SETTLE_FRAMES || (Math.abs(b.vx) < 0.5 && Math.abs(off) <= 1)) return (this.act = null);
        if (Math.abs(b.vx) >= 0.5) return this.press({ left: b.vx > 120, right: b.vx < -120, jump: false, jumpPressed: false });
        return this.press({ left: off < 0 && act.t % 3 === 0, right: off > 0 && act.t % 3 === 0, jump: false, jumpPressed: false });
      }
      case 'leap':
        return (this.act = null); // a leap belongs to the leap intent; a route picks afresh
    }
  }

  private press(c: Controls): InputFrame {
    const down = !!c.down;
    return { ...NO_INPUT, left: c.left, right: c.right, down, downPressed: down && !this.prev.down, jump: c.jump, jumpPressed: c.jumpPressed, run: !!c.run };
  }

  /**
   * The best thing to do from here: every move the controller has from this
   * body, scored by the time it takes plus the route from where it lands.
   * With no route anywhere, the open-air distance at least points the way.
   */
  private choose(map: RaceMap, run: RunWorld, b: Body, target: number): Act | null {
    const f = run.frame;
    const w = map.field.w;
    const here = cellOf(b, w);
    if (here === target && b.onGround) return null;
    if (b.onGround && here !== this.last) {
      this.last = here;
      this.visits.set(here, (this.visits.get(here) ?? 0) + 1);
    }
    const moves = movesFrom(map.field, b, run.solids);
    const shots = shotsAhead(run, map);
    // Standing here is about to hurt: no waiting for a better moment.
    const exposed = hurtsStill(map, f, b, shots);
    for (const dist of [map.dist(target), map.rough(target)]) {
      let best: Move | null = null;
      let cost = Infinity;
      // The best move a hazard is in the way of: worth waiting for if it beats every clear one.
      let held = Infinity;
      for (const mv of moves) {
        // A hop that lands where it stands only ever dodges something; otherwise standing still says the same.
        if (mv.to === here && b.onGround && !exposed) continue;
        const c = dist[mv.to] + mv.controls.length * FRAME_COST + (this.visits.get(mv.to) ?? 0) * AGAIN;
        if (c >= cost) continue;
        if (!hurts(map, mv, f, b, shots)) {
          cost = c;
          best = mv;
        } else if (c < held) held = c;
      }
      if (held < cost - SHORT && !exposed) return { kind: 'wait' };
      if (b.onGround && !exposed && this.settled !== here && cost > dist[here] + SHORT) {
        this.settled = here;
        return { kind: 'settle', at: here, t: 0 };
      }
      if (best) {
        if (best.to !== here) this.settled = -1;
        return { kind: 'move', m: best, i: 0 };
      }
    }
    return null;
  }
}

function cellOf(b: Body, w: number): number {
  return Math.floor((b.y + b.h - 1) / TILE) * w + Math.floor((b.x + b.w / 2) / TILE);
}

/** Frames ahead a body standing still checks for something coming its way, and that shots in flight are followed. */
const STILL_AHEAD = 20;
const SHOTS_AHEAD = 120;

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

/** Would a hazard reach the body if it stood where it is for the next few frames? */
function hurtsStill(map: RaceMap, f: number, b: Body, shots: readonly Shot[]): boolean {
  const box = { x: b.x - MARGIN, y: b.y - MARGIN, w: b.w + 2 * MARGIN, h: b.h + 2 * MARGIN };
  for (let i = 0; i < STILL_AHEAD; i++) if (struck(map, shots, f, i, box)) return true;
  return false;
}

/** Does the body meet a hazard anywhere along `mv` from its `from`th frame on, which is race frame `f`? */
function hurts(map: RaceMap, mv: Move, f: number, b: Body, shots: readonly Shot[], from = 0): boolean {
  const box = { x: 0, y: 0, w: b.w + 2 * MARGIN, h: b.h + 2 * MARGIN };
  for (let i = from; i < mv.controls.length; i++) {
    box.x = mv.path[2 * i] - MARGIN;
    box.y = mv.path[2 * i + 1] - MARGIN;
    if (struck(map, shots, f, i - from, box)) return true;
  }
  return false;
}
