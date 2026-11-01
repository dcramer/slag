import { inset, overlaps, pointInRect, rectCircle, type Rect } from '../core/geom';
import { DT, KILL_Y, PLAYER_W, RUN_COUNTDOWN, RUN_TIME_LIMIT, TILE } from './constants';
import { goalRect, tileAt, type Level } from './level';
import { bodyAtCell, stepBody, type Body, type CollisionWorld, type Solid } from './physics';
import { conveyorSurface, fanZone, footprintCells, moverRect, propDir, sawCircle, SURFACES, type PlacedProp } from './props';
import type { GameEvent, InputFrame } from './types';
import { NO_INPUT } from './types';

export type DeathCause = 'hazard' | 'fall' | 'crush' | 'pop' | 'timeout';

export interface Runner {
  slot: number;
  body: Body;
  alive: boolean;
  finished: boolean;
  finishFrame: number;
  deathFrame: number;
  /** Slot whose prop killed this runner, or -1. */
  killer: number;
  cause: DeathCause | null;
  springCooldown: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  born: number;
}

interface Hazard {
  rect?: Rect;
  circle?: { x: number; y: number; r: number };
  owner: number;
}

interface PropState {
  /** Crumble: frame it was first stood on, -1 if idle. */
  triggerFrame: number;
  brokenUntil: number;
  /** Spring/turret: last activation frame (for animation). */
  lastFire: number;
}

/**
 * One race through the level. Pure function of (level, props, inputs); all
 * time is measured in sim frames since the round started.
 */
export class RunWorld {
  frame = 0;
  runners: Runner[];
  projectiles: Projectile[] = [];
  finishOrder: number[] = [];
  kills: { victim: number; killer: number }[] = [];
  /** Frame the race ended (everyone done), or -1. */
  endFrame = -1;
  propState = new Map<number, PropState>();
  events: GameEvent[] = [];

  solids: Solid[] = [];
  private hazards: Hazard[] = [];
  private springs: { rect: Rect; pp: PlacedProp }[] = [];
  private winds: (Rect & { ax: number; ay: number })[] = [];
  private world: CollisionWorld;
  private goal: Rect;

  constructor(
    readonly level: Level,
    readonly placed: readonly PlacedProp[],
    slots: number[],
  ) {
    const n = slots.length;
    this.runners = slots.map((slot, i) => ({
      slot,
      body: bodyAtCell(level.spawn.tx, level.spawn.ty, (i - (n - 1) / 2) * (PLAYER_W * 0.7)),
      alive: true,
      finished: false,
      finishFrame: -1,
      deathFrame: -1,
      killer: -1,
      cause: null,
      springCooldown: 0,
    }));
    for (const p of placed) this.propState.set(p.uid, { triggerFrame: -1, brokenUntil: -1, lastFire: -999 });
    this.world = { tileAt: (x, y) => tileAt(level, x, y), solids: this.solids };
    this.goal = goalRect(level);
  }

  get active(): Runner[] {
    return this.runners.filter((r) => r.alive && !r.finished);
  }

  get timeLeft(): number {
    return Math.max(0, RUN_TIME_LIMIT - (this.frame - RUN_COUNTDOWN));
  }

  step(inputs: readonly InputFrame[]): void {
    const f = this.frame;
    this.buildProps(f);
    const live = f >= RUN_COUNTDOWN && this.endFrame < 0;

    this.runners.forEach((r, i) => {
      if (!r.alive || r.finished) return;
      const inp = live ? (inputs[i] ?? NO_INPUT) : NO_INPUT;
      const b = r.body;
      if (inp.altPressed) return this.kill(r, -1, 'pop');

      for (const w of this.winds) {
        if (overlaps(b, w)) {
          b.vx += w.ax * DT;
          b.vy += w.ay * DT;
          if (b.vy < -420) b.vy = -420;
          if (w.ay < 0) b.onGround = false;
        }
      }
      if (!stepBody(b, { left: inp.left, right: inp.right, jump: inp.jump, jumpPressed: inp.jumpPressed }, this.world)) {
        return this.kill(r, -1, 'crush');
      }

      // Crumbles notice who's standing on them.
      if (b.onGround && b.groundRef >= 0) {
        const s = this.solids.find((s) => s.id === b.groundRef);
        if (s) {
          const st = this.propState.get(s.propUid);
          const pp = this.placed.find((p) => p.uid === s.propUid);
          if (st && pp?.def.kind === 'crumble' && st.triggerFrame < 0) {
            st.triggerFrame = f;
            this.events.push({ type: 'crumble-start', uid: pp.uid });
          }
        }
      }

      if (r.springCooldown > 0) r.springCooldown--;
      for (const sp of this.springs) {
        if (r.springCooldown === 0 && overlaps(b, sp.rect) && sp.pp.def.kind === 'spring') {
          const [dx, dy] = propDir(sp.pp.def, sp.pp.rot);
          const p = sp.pp.def.power;
          if (dy !== 0) b.vy = dy * p;
          else {
            b.vx = dx * p;
            b.vy = -260;
          }
          b.onGround = false;
          b.groundRef = -1;
          b.jumping = false;
          b.coyote = 0;
          r.springCooldown = 10;
          this.propState.get(sp.pp.uid)!.lastFire = f;
          this.events.push({ type: 'spring', x: b.x + b.w / 2, y: b.y + b.h });
        }
      }

      const hb = inset(b, 1.5);
      for (const h of this.hazards) {
        if ((h.rect && overlaps(hb, h.rect)) || (h.circle && rectCircle(hb, h.circle.x, h.circle.y, h.circle.r))) {
          return this.kill(r, h.owner, 'hazard');
        }
      }
      if (b.y > KILL_Y) return this.kill(r, -1, 'fall');
      if (overlaps(b, this.goal)) {
        r.finished = true;
        r.finishFrame = f;
        this.finishOrder.push(r.slot);
        this.events.push({ type: 'finish', slot: r.slot, place: this.finishOrder.length, x: b.x + b.w / 2, y: b.y });
      }
    });

    this.stepProjectiles(f);
    this.stepPropTimers(f);

    if (this.endFrame < 0) {
      if (live && this.timeLeft === 0) for (const r of this.active) this.kill(r, -1, 'timeout');
      if (this.active.length === 0) this.endFrame = f;
    }
    this.frame++;
  }

  private kill(r: Runner, killer: number, cause: DeathCause) {
    r.alive = false;
    r.deathFrame = this.frame;
    r.killer = killer;
    r.cause = cause;
    if (killer >= 0) this.kills.push({ victim: r.slot, killer });
    this.events.push({ type: 'death', slot: r.slot, x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h / 2, cause });
  }

  isBroken(uid: number, f = this.frame): boolean {
    const st = this.propState.get(uid);
    return !!st && f < st.brokenUntil;
  }

  /** Rebuild this frame's solids, hazards and triggers from placed props. */
  private buildProps(f: number) {
    this.solids.length = 0;
    this.hazards.length = 0;
    this.springs.length = 0;
    this.winds.length = 0;
    for (const pp of this.placed) {
      const d = pp.def;
      const ox = pp.tx * TILE;
      const oy = pp.ty * TILE;
      const cellRects = () => footprintRects(pp);
      switch (d.kind) {
        case 'block': {
          const surface = d.material === 'conveyor' ? conveyorSurface(pp.rot >= 2 ? -d.conveyor : d.conveyor) : SURFACES[d.material];
          cellRects().forEach((rc, i) => this.solids.push({ ...rc, id: pp.uid * 64 + i, dx: 0, dy: 0, surface, propUid: pp.uid }));
          break;
        }
        case 'crumble':
          if (!this.isBroken(pp.uid, f)) {
            cellRects().forEach((rc, i) => this.solids.push({ ...rc, id: pp.uid * 64 + i, dx: 0, dy: 0, surface: SURFACES.stone, propUid: pp.uid }));
          }
          break;
        case 'spikes':
          for (const rc of cellRects()) this.hazards.push({ rect: inset(rc, 2), owner: pp.owner });
          break;
        case 'mover': {
          const now = moverRect(pp, f);
          const prev = moverRect(pp, f - 1);
          this.solids.push({ ...now, id: pp.uid * 64, dx: now.x - prev.x, dy: now.y - prev.y, surface: SURFACES.stone, propUid: pp.uid });
          break;
        }
        case 'saw':
          this.hazards.push({ circle: sawCircle(pp, f), owner: pp.owner });
          break;
        case 'spring': {
          const [dx, dy] = propDir(d, pp.rot);
          // Trigger pad sits on the face the spring points out of.
          const pad = { x: ox + 2, y: oy + 2, w: TILE - 4, h: TILE - 4 };
          if (dy < 0) pad.y = oy + TILE / 2;
          if (dy > 0) pad.h = TILE / 2;
          if (dx > 0) pad.w = TILE / 2;
          if (dx < 0) pad.x = ox + TILE / 2;
          this.springs.push({ rect: pad, pp });
          break;
        }
        case 'turret':
          this.solids.push({ x: ox, y: oy, w: TILE, h: TILE, id: pp.uid * 64, dx: 0, dy: 0, surface: SURFACES.stone, propUid: pp.uid });
          break;
        case 'fan':
          this.solids.push({ x: ox, y: oy, w: TILE, h: TILE, id: pp.uid * 64, dx: 0, dy: 0, surface: SURFACES.stone, propUid: pp.uid });
          this.winds.push(fanZone(this.level, pp));
          break;
        case 'bomb':
          break;
      }
    }
  }

  private stepPropTimers(f: number) {
    for (const pp of this.placed) {
      const st = this.propState.get(pp.uid)!;
      const d = pp.def;
      if (d.kind === 'crumble') {
        if (st.triggerFrame >= 0 && f - st.triggerFrame >= d.breakFrames) {
          st.triggerFrame = -1;
          st.brokenUntil = f + d.respawnFrames;
          this.events.push({ type: 'crumble-break', uid: pp.uid });
        }
        // Don't respawn on top of someone.
        if (st.brokenUntil === f + 1) {
          const rects = footprintRects(pp);
          if (this.runners.some((r) => r.alive && !r.finished && rects.some((rc) => overlaps(r.body, rc)))) st.brokenUntil++;
        }
      } else if (d.kind === 'turret' && f >= RUN_COUNTDOWN) {
        const t = f - RUN_COUNTDOWN + Math.floor((pp.uid * 37) % d.interval);
        const k = t % d.interval;
        if (k < d.burst * 8 && k % 8 === 0) {
          const [dx, dy] = propDir(d, pp.rot);
          const cx = (pp.tx + 0.5) * TILE + dx * (TILE / 2 + 3);
          const cy = (pp.ty + 0.5) * TILE + dy * (TILE / 2 + 3);
          this.projectiles.push({ x: cx, y: cy, vx: dx * d.speed, vy: dy * d.speed, owner: pp.owner, born: f });
          st.lastFire = f;
        }
      }
    }
  }

  private stepProjectiles(f: number) {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      let dead = f - p.born > 60 * 8 || p.x < -8 || p.x > this.level.w * TILE + 8 || p.y < -8 || p.y > this.level.h * TILE + 8;
      if (!dead && tileAt(this.level, Math.floor(p.x / TILE), Math.floor(p.y / TILE))) dead = true;
      if (!dead && this.solids.some((s) => pointInRect(p.x, p.y, s))) dead = true;
      if (!dead) {
        for (const r of this.runners) {
          if (r.alive && !r.finished && rectCircle(r.body, p.x, p.y, 3)) {
            this.kill(r, p.owner, 'hazard');
            dead = true;
            break;
          }
        }
      }
      if (dead) this.events.push({ type: 'pop', x: p.x, y: p.y });
      else keep.push(p);
    }
    this.projectiles = keep;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

function footprintRects(pp: PlacedProp): Rect[] {
  const d = pp.def;
  if (d.kind !== 'block' && d.kind !== 'crumble' && d.kind !== 'spikes') return [];
  return footprintCells(pp).map(([x, y]) => ({ x: x * TILE, y: y * TILE, w: TILE, h: TILE }));
}
