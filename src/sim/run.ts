import { inset, overlaps, type Rect, rectCircle } from '../core/geom';
import { KILL_Y, PLAYER_W, RUN_COUNTDOWN } from './constants';
import { type CrowdMember, nudgeCrowd } from './crowd';
import {
  absorbHit,
  bonk,
  burstSmoke,
  catchShot,
  creditKill,
  type ItemWorld,
  itemInput,
  itemPostStep,
  newItemWorld,
  newRunnerItems,
  type RunnerItems,
  spawnItem,
  stepItems,
} from './items';
import { goalRect, type Level, spawnZone, tileAt } from './level';
import { type Body, bodyAtCell, type CollisionWorld, firstOverlap, type Solid, stepBody } from './physics';
import {
  buildProjectile,
  type Contrib,
  dirOf,
  type GrabRequest,
  type Hazard,
  letGo,
  makeProjectile,
  moduleSim,
  motionOffset,
  newAttach,
  newPropState,
  newStatus,
  type Projectile,
  type ProjectileSpawn,
  type ProjItems,
  type ProjWorld,
  type PlacedProp,
  type PropCtx,
  type PropState,
  type Resolved,
  type RunnerAttach,
  type RunnerStatus,
  type RunnerView,
  resolveProp,
  settleGrabs,
  statusInput,
  statusPostStep,
  statusPreStep,
  stepHold,
  stepProjectile,
  type TickCtx,
  type TouchCtx,
  touchesTrigger,
} from './props';
import type { GameEvent, InputFrame } from './types';
import { windAt } from './wind';
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
  /** Status effects (frozen, slowed) and trigger contact (props/status.ts). */
  status: RunnerStatus;
  /** Held item and its effects (src/sim/items). */
  items: RunnerItems;
  /** The rope or keg holding this runner, and its re-grab cooldown (props/attach.ts). */
  attach: RunnerAttach;
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
  /** Loose held items and smoke clouds (src/sim/items). */
  items: ItemWorld = newItemWorld();
  /**
   * Spawn safe zone (world px), or null. A runner whose body overlaps it can't
   * be killed by props: hazards, projectiles (they pop harmlessly) and crushing.
   * Falling into the pit, giving up and the race timer still apply.
   */
  readonly safeZone: Rect | null;
  /** Projectiles spawned so far (ids for projectile-owned solids). */
  private seq = 0;
  /** Grabs asked for this frame; settled and emptied once everyone has moved. */
  private grabs: GrabRequest[] = [];

  solids: Solid[] = [];
  private out: Contrib = { solids: this.solids, hazards: [], springs: [], winds: [], triggers: [] };
  readonly world: CollisionWorld;
  private goal: Rect;

  constructor(
    readonly level: Level,
    readonly placed: readonly PlacedProp[],
    slots: number[],
    /** Race time limit in frames after the countdown; 0 = unlimited. */
    readonly timeLimit = 0,
    /** Seed of this race's item rolls. Match varies it per round: crates survive rounds and must not replay the same items. */
    readonly itemSeed = level.seed,
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
      items: newRunnerItems(),
      attach: newAttach(),
    }));
    this.resolved = [...level.setPieces, ...placed].map(resolveProp);
    for (const r of this.resolved) {
      const st = newPropState();
      r.mods.forEach((m, i) => m.type === 'launcher' && st.aim.set(i, m.angle));
      this.propState.set(r.pp.uid, st);
    }
    this.world = { tileAt: (x, y) => tileAt(level, x, y), solids: this.solids };
    this.goal = goalRect(level);
    this.safeZone = spawnZone(level);
  }

  /** Is this runner inside the spawn safe zone (immune to props) right now? */
  isSafe(r: Runner): boolean {
    return !!this.safeZone && overlaps(r.body, this.safeZone);
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
      spawn: (p) => this.spawnProjectile(p),
      emit: (e) => this.events.push(e),
      spawnItem: (s) => spawnItem(this, s),
      itemSeed: this.itemSeed,
    };
  }

  /** Add a projectile to this frame's world (prop ticks, held items). */
  spawnProjectile(s: ProjectileSpawn) {
    this.projectiles.push(makeProjectile(s, this.frame, this.seq++));
  }

  step(inputs: readonly InputFrame[]): void {
    const f = this.frame;
    this.buildProps(f);
    const live = f >= RUN_COUNTDOWN && this.endFrame < 0;
    const x0 = this.runners.map((r) => r.body.x);

    this.runners.forEach((r, i) => {
      if (!r.alive) return;
      // Finished runners lose control but keep falling, landing and riding
      // platforms naturally. Nothing can hurt them and they don't push anyone.
      if (r.finished) {
        if (r.body.y <= KILL_Y) stepBody(r.body, NO_INPUT, this.world, windAt(r.body, this.out.winds));
        return;
      }
      const inp = itemInput(r.items, statusInput(r.status, live ? (inputs[i] ?? NO_INPUT) : NO_INPUT));
      const b = r.body;
      if (inp.altPressed) return this.kill(r, -1, 'pop');
      // A rope or keg moves this body instead of the controller, and a held runner skips springs, fields and kickers.
      const held = stepHold(this, r, inp, f);
      if (!held) statusPreStep(r.status, b);

      // Wind is a velocity field applied inside stepBody (sim/wind.ts); grounding stays physics' call.
      if (!held && !stepBody(b, inp, this.world, windAt(b, this.out.winds)) && !this.isSafe(r)) {
        // Credit whoever's moving solid did the squishing.
        const s = this.solids.find((s) => s.propUid >= 0 && overlaps(b, s));
        const owner = s ? (this.resolved.find((x) => x.pp.uid === s.propUid)?.pp.owner ?? -1) : -1;
        return this.kill(r, owner, 'crush');
      }
      statusPostStep(r.status, b);
      if (!held) itemPostStep(r.items, b);

      if (b.onGround && b.groundRef >= 0) {
        const s = this.solids.find((s) => s.id === b.groundRef);
        const rp = s && this.resolved.find((p) => p.pp.uid === s.propUid);
        if (s && rp && s.mi >= 0) moduleSim(rp.mods[s.mi].type).onStand?.(rp.mods[s.mi], this.tickCtx(rp, s.mi, f));
      }

      if (r.springCooldown > 0) r.springCooldown--;
      for (const sp of this.out.springs) {
        if (!held && r.springCooldown === 0 && overlaps(b, sp.rect)) {
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

      // The spawn zone shields you from fields and kickers too (see safeZone).
      if (this.isSafe(r)) r.status.inside.length = 0;
      else if (!held) this.touchTriggers(r, f);

      const hb = inset(b, 1.5);
      if (!this.isSafe(r)) {
        for (const h of this.out.hazards) {
          if (!hitHazard(hb, h)) continue;
          this.kill(r, h.owner, 'hazard');
          // A shield can cancel the hit; then the rest of this frame still applies.
          if (!r.alive) return;
        }
      }
      if (b.y > KILL_Y) return this.kill(r, -1, 'fall');
      if (overlaps(b, this.goal)) {
        letGo(r);
        r.finished = true;
        r.finishFrame = f;
        this.finishOrder.push(r.slot);
        this.events.push({ type: 'finish', slot: r.slot, place: this.finishOrder.length, x: b.x + b.w / 2, y: b.y });
      }
    });

    settleGrabs(this, this.grabs);

    // Runners softly shove each other (src/sim/crowd.ts). Order-independent.
    const crowd: CrowdMember[] = [];
    this.runners.forEach((r, i) => r.alive && !r.finished && !r.attach.grip && crowd.push({ key: r.slot, body: r.body, x0: x0[i] }));
    nudgeCrowd(crowd, this.world);

    stepItems(this, inputs, live);
    this.stepProjectiles(f);
    for (const rp of this.resolved) rp.mods.forEach((m, mi) => moduleSim(m.type).tick?.(m, this.tickCtx(rp, mi, f)));

    if (this.endFrame < 0) {
      if (live && this.timeLeft === 0) for (const r of this.active) this.kill(r, -1, 'timeout');
      if (this.active.length === 0) this.endFrame = f;
    }
    this.frame++;
  }

  /** Kill a runner, unless a shield cancels it. Bonks pass kill credit on. */
  private kill(r: Runner, killer: number, cause: DeathCause) {
    if (absorbHit(this, r, cause)) return;
    letGo(r);
    killer = creditKill(r, killer, cause);
    r.alive = false;
    r.deathFrame = this.frame;
    r.killer = killer;
    r.cause = cause;
    if (killer >= 0) this.kills.push({ victim: r.slot, killer });
    this.events.push({ type: 'death', slot: r.slot, x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h / 2, cause, vx: r.body.vx, vy: r.body.vy });
  }

  /**
   * Call `touch` on every module whose trigger this runner overlaps (once per
   * trigger key), tracking entries frame to frame.
   */
  private touchTriggers(r: Runner, f: number) {
    const st = r.status;
    const now: number[] = [];
    for (const t of this.out.triggers!) {
      if (now.includes(t.key) || !touchesTrigger(r.body, t)) continue;
      now.push(t.key);
      const rp = this.resolved.find((x) => x.pp.uid === t.uid);
      if (!rp) continue;
      const m = rp.mods[t.mi];
      const sim = moduleSim(m.type);
      if (!sim.touch) continue;
      sim.touch(m, this.touchCtx(rp, t.mi, f, r, now), r, t, !st.inside.includes(t.key));
    }
    st.inside = now;
  }

  /** What a module gets while it touches or holds `r`. `seen` is the runner's trigger list this frame. */
  touchCtx(rp: Resolved, mi: number, f: number, r: Runner, seen: number[] = r.status.inside): TouchCtx {
    return {
      ...this.tickCtx(rp, mi, f),
      blocked: (q) => firstOverlap(q, this.world) !== null,
      mark: (key) => seen.includes(key) || seen.push(key),
      grab: (g) => this.grabs.push({ r, uid: rp.pp.uid, mi, g }),
    };
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

  private projItems: ProjItems = {
    caught: (i, kind) => catchShot(this, this.runners[i], kind),
    loose: (s) => spawnItem(this, s),
    bonk: (i, owner) => bonk(this.runners[i], owner),
    burst: (x, y) => burstSmoke(this, x, y),
  };

  /** Projectile behavior lives in props/ammo.ts; this just wires it to the world. */
  private stepProjectiles(f: number) {
    if (this.projectiles.length === 0) return;
    const spawned: Projectile[] = [];
    const runners = this.runners.map((r) => ({ body: r.body, status: r.status, active: r.alive && !r.finished, safe: this.isSafe(r) }));
    const w: ProjWorld = {
      level: this.level,
      frame: f,
      solids: this.solids,
      gravity: 1,
      runners,
      spawn: (p) => spawned.push(makeProjectile(p, f, this.seq++)),
      emit: (e) => this.events.push(e),
      kill: (i, owner) => {
        this.kill(this.runners[i], owner, 'hazard');
        runners[i].active = this.runners[i].alive;
      },
      items: this.projItems,
    };
    const keep: Projectile[] = [];
    for (const p of this.projectiles) if (stepProjectile(p, w)) keep.push(p);
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
