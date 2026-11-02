import { inset, overlaps, type Rect, rectCircle } from '../core/geom';
import { DT, KILL_Y, PLAYER_W, RUN_COUNTDOWN } from './constants';
import { goalRect, type Level, tileAt } from './level';
import { type Body, bodyAtCell, type CollisionWorld, firstOverlap, type Solid, stepBody } from './physics';
import {
  buildProjectile,
  type Contrib,
  dirOf,
  type Hazard,
  makeProjectile,
  moduleSim,
  motionOffset,
  newPropState,
  newStatus,
  type Projectile,
  type ProjWorld,
  type PlacedProp,
  type PropCtx,
  type PropState,
  type Resolved,
  type RunnerMut,
  type RunnerStatus,
  type RunnerView,
  resolveProp,
  statusInput,
  statusPostStep,
  statusPreStep,
  stepProjectile,
  type TickCtx,
  type TouchCtx,
  touchesTrigger,
} from './props';
import type { GameEvent, InputFrame } from './types';
import { NO_INPUT } from './types';

export type { Projectile, PropState } from './props';

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
  /** Status effects (frozen, slowed, held by a barrel) and trigger contact (props/status.ts). */
  status: RunnerStatus;
}

/**
 * One race through the level. Pure function of (level, set pieces, placed
 * props, inputs); all time is measured in sim frames since the round
 * started. Prop behavior is delegated to module plugins (src/sim/props).
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
  /** Set pieces first, then player props. */
  resolved: Resolved[];
  events: GameEvent[] = [];
  /** Projectiles spawned so far (ids for projectile-owned solids). */
  private seq = 0;

  solids: Solid[] = [];
  private out: Contrib = { solids: this.solids, hazards: [], springs: [], winds: [], triggers: [] };
  private world: CollisionWorld;
  private goal: Rect;

  constructor(
    readonly level: Level,
    readonly placed: readonly PlacedProp[],
    slots: number[],
    /** Race time limit in frames after the countdown; 0 = unlimited. */
    readonly timeLimit = 0,
  ) {
    const n = slots.length;
    this.runners = slots.map((slot, i) => ({
      slot,
      // Fan players out over the spawn pad; tighter spacing for big lobbies.
      body: bodyAtCell(level.spawn.tx, level.spawn.ty, (i - (n - 1) / 2) * Math.min(PLAYER_W * 0.7, 40 / Math.max(1, n - 1))),
      alive: true,
      finished: false,
      finishFrame: -1,
      deathFrame: -1,
      killer: -1,
      cause: null,
      springCooldown: 0,
      status: newStatus(),
    }));
    this.resolved = [...level.setPieces, ...placed].map(resolveProp);
    for (const r of this.resolved) {
      const st = newPropState();
      r.mods.forEach((m, i) => m.type === 'launcher' && st.aim.set(i, m.angle));
      this.propState.set(r.pp.uid, st);
    }
    this.world = { tileAt: (x, y) => tileAt(level, x, y), solids: this.solids };
    this.goal = goalRect(level);
  }

  get active(): Runner[] {
    return this.runners.filter((r) => r.alive && !r.finished);
  }

  /** Frames left before the race times out (Infinity when unlimited). */
  get timeLeft(): number {
    return this.timeLimit > 0 ? Math.max(0, this.timeLimit - (this.frame - RUN_COUNTDOWN)) : Infinity;
  }

  isBroken(uid: number, f = this.frame): boolean {
    const st = this.propState.get(uid);
    return !!st && f < st.brokenUntil;
  }

  private ctx(r: Resolved, mi: number, f: number): PropCtx {
    return {
      level: this.level,
      frame: f,
      r,
      off: motionOffset(r, f),
      prev: motionOffset(r, f - 1),
      state: this.propState.get(r.pp.uid)!,
      mi,
      live: f >= RUN_COUNTDOWN,
    };
  }

  private tickCtx(r: Resolved, mi: number, f: number): TickCtx {
    const runners: RunnerView[] = this.runners.map((x) => ({ x: x.body.x, y: x.body.y, w: x.body.w, h: x.body.h, active: x.alive && !x.finished }));
    return {
      ...this.ctx(r, mi, f),
      runners,
      spawn: (p) => this.projectiles.push(makeProjectile(p, f, this.seq++)),
      emit: (e) => this.events.push(e),
    };
  }

  step(inputs: readonly InputFrame[]): void {
    const f = this.frame;
    this.buildProps(f);
    const live = f >= RUN_COUNTDOWN && this.endFrame < 0;

    this.runners.forEach((r, i) => {
      if (!r.alive || r.finished) return;
      const inp = statusInput(r.status, live ? (inputs[i] ?? NO_INPUT) : NO_INPUT);
      const b = r.body;
      if (inp.altPressed) return this.kill(r, -1, 'pop');
      statusPreStep(r.status, b);

      for (const w of this.out.winds) {
        if (overlaps(b, w)) {
          b.vx += w.ax * DT;
          b.vy += w.ay * DT;
          if (b.vy < -420) b.vy = -420;
          if (w.ay < 0) b.onGround = false;
        }
      }
      // A runner held by a prop (launch barrel) is placed by that prop, not by the controller.
      if (r.status.hold >= 0) {
        b.vx = 0;
        b.vy = 0;
      } else if (!stepBody(b, inp, this.world)) {
        // Credit whoever's moving solid did the squishing.
        const s = this.solids.find((s) => s.propUid >= 0 && overlaps(b, s));
        const owner = s ? (this.resolved.find((x) => x.pp.uid === s.propUid)?.pp.owner ?? -1) : -1;
        return this.kill(r, owner, 'crush');
      }
      statusPostStep(r.status, b);

      if (b.onGround && b.groundRef >= 0) {
        const s = this.solids.find((s) => s.id === b.groundRef);
        const rp = s && this.resolved.find((p) => p.pp.uid === s.propUid);
        if (s && rp && s.mi >= 0) moduleSim(rp.mods[s.mi].type).onStand?.(rp.mods[s.mi], this.tickCtx(rp, s.mi, f));
      }

      if (r.springCooldown > 0) r.springCooldown--;
      for (const sp of this.out.springs) {
        if (r.springCooldown === 0 && overlaps(b, sp.rect)) {
          const [dx, dy] = dirOf(sp.angle);
          if (dy !== 0) b.vy = dy * sp.power;
          else {
            b.vx = dx * sp.power;
            b.vy = -260;
          }
          b.onGround = false;
          b.groundRef = -1;
          b.jumping = false;
          b.coyote = 0;
          r.springCooldown = 10;
          this.propState.get(sp.uid)!.lastFire = f;
          this.events.push({ type: 'spring', x: b.x + b.w / 2, y: b.y + b.h });
        }
      }

      this.touchTriggers(r, inp, f);

      const hb = inset(b, 1.5);
      for (const h of this.out.hazards) {
        if (hitHazard(hb, h)) return this.kill(r, h.owner, 'hazard');
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
    for (const rp of this.resolved) rp.mods.forEach((m, mi) => moduleSim(m.type).tick?.(m, this.tickCtx(rp, mi, f)));

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
    this.events.push({ type: 'death', slot: r.slot, x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h / 2, cause, vx: r.body.vx, vy: r.body.vy });
  }

  /**
   * Call `touch` on every module whose trigger this runner overlaps (once per
   * trigger key), tracking entries frame to frame. Releases a hold whose
   * trigger is gone.
   */
  private touchTriggers(r: Runner, input: InputFrame, f: number) {
    const st = r.status;
    const now: number[] = [];
    const who: RunnerMut = { slot: r.slot, body: r.body, status: st, input };
    for (const t of this.out.triggers!) {
      if (now.includes(t.key) || !touchesTrigger(r.body, t)) continue;
      now.push(t.key);
      const rp = this.resolved.find((x) => x.pp.uid === t.uid);
      if (!rp) continue;
      const m = rp.mods[t.mi];
      const sim = moduleSim(m.type);
      if (!sim.touch) continue;
      const ctx: TouchCtx = {
        ...this.tickCtx(rp, t.mi, f),
        blocked: (q) => firstOverlap(q, this.world) !== null,
        mark: (key) => now.includes(key) || now.push(key),
      };
      sim.touch(m, ctx, who, t, !st.inside.includes(t.key));
    }
    if (st.hold >= 0 && !now.includes(st.hold)) st.hold = -1;
    st.inside = now;
  }

  /** Rebuild this frame's solids, hazards and triggers from all props (and projectile patches). */
  private buildProps(f: number) {
    this.solids.length = 0;
    this.out.hazards.length = 0;
    this.out.springs.length = 0;
    this.out.winds.length = 0;
    this.out.triggers!.length = 0;
    for (const rp of this.resolved) rp.mods.forEach((m, mi) => moduleSim(m.type).build?.(m, this.ctx(rp, mi, f), this.out));
    for (const p of this.projectiles) buildProjectile(p, f, this.out);
  }

  /** Projectile behavior lives in props/ammo.ts; this just wires it to the world. */
  private stepProjectiles(f: number) {
    const spawned: Projectile[] = [];
    const w: ProjWorld = {
      level: this.level,
      frame: f,
      solids: this.solids,
      runners: this.runners.map((r) => ({ slot: r.slot, body: r.body, status: r.status, input: NO_INPUT, active: r.alive && !r.finished })),
      spawn: (p) => spawned.push(makeProjectile(p, f, this.seq++)),
      emit: (e) => this.events.push(e),
      kill: (i, owner) => this.kill(this.runners[i], owner, 'hazard'),
    };
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      if (stepProjectile(p, w)) keep.push(p);
      // A kill above changes who's active for the next projectile.
      w.runners.forEach((x, i) => (x.active = this.runners[i].alive && !this.runners[i].finished));
    }
    this.projectiles = keep.concat(spawned);
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

function hitHazard(b: Rect, h: Hazard): boolean {
  switch (h.kind) {
    case 'rect':
      return overlaps(b, h.r);
    case 'circle':
      return rectCircle(b, h.x, h.y, h.r);
    case 'seg': {
      const len = Math.hypot(h.x2 - h.x1, h.y2 - h.y1);
      const n = Math.max(1, Math.ceil(len / 4));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        if (rectCircle(b, h.x1 + (h.x2 - h.x1) * t, h.y1 + (h.y2 - h.y1) * t, h.r)) return true;
      }
      return false;
    }
  }
}
