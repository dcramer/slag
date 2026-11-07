import { inset, overlaps, pointInRect, type Rect, type Vec } from '../core/geom';
import { deriveSeed, Rng } from '../core/rng';
import { type BloodCell, buildBlood, groundOf, spillBlood } from './blood';
import { FPS, PLAYER_W, POP_HOLD, RUN_COUNTDOWN, SHIELD_FRAMES, TILE } from './constants';
import { BUMP, type Bump, collideRunners, contactStart, footing as stackFooting } from './collide';
import {
  absorbHit,
  bonk,
  buildBlocks,
  burstSmoke,
  catchShot,
  creditKill,
  giveItem,
  type ItemWorld,
  itemInput,
  itemPostStep,
  newItemWorld,
  newRunnerItems,
  type RunnerItems,
  spawnItem,
  stepItems,
} from './items';
import { goalRect, killY, lapShift, type Level, offMap, spawnsOf, spawnZones, tileAt } from './level';
import { leaderOf } from './standing';
import { tideStart } from './tide';
import { type RunFeature, RUN_FEATURES } from './features';
import { type Body, bodyAtCell, type CollisionWorld, firstOverlap, type Solid, stepBody } from './physics';
import {
  type Beam,
  buildProjectile,
  buildSolids,
  type Contrib,
  dirOf,
  type GrabRequest,
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
  touchesHazard,
  touchesTrigger,
  traceRays,
  launchFrom,
} from './props';
import type { GameEvent, InputFrame } from './types';
import { groundSurfaceAt } from './ground';
import { footing, gustAir, gustWind, wetSolids } from './weather';
import { windAt } from './wind';
import { NO_INPUT } from './types';

export type { Projectile, PropState } from './props';

/** `out`: left the level off its left or right edge. */
export type DeathCause = 'hazard' | 'fall' | 'crush' | 'pop' | 'timeout' | 'out';

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
  /** Slot of the runner this one is standing on, or -1 (sim/collide.ts). */
  ride: number;
  /** Frames in a row this runner has stood on heads: a head holds nobody for long (PERCH in sim/collide.ts). */
  perch: number;
  /** Frames this runner has held alt toward a self-destruct (`popCharge`), 0 when not charging. Everyone sees it fill. */
  pop: number;
  /** Frames this runner has been held up by other bodies; enough of them and it slips through (sim/collide.ts). */
  press: number;
  /** Laps climbed round a looping shaft (`Level.loop`): +1 each time it carries on a lap up, -1 a lap down. */
  lap: number;
}

/** Feet of `r` in climbed coordinates (world y, minus a loop's rows for every lap up): what the slag measures. */
export function feetUp(level: Level, r: Pick<Runner, 'body' | 'lap'>): number {
  return r.body.y + r.body.h - r.lap * (level.loop ?? 0) * TILE;
}

/**
 * The self-destruct charge after one more frame of `inp`. It starts only on a fresh alt press, so a hold carried
 * over from place (where alt rotates) or the countdown never counts, and a resting thumb never does it. Releasing alt,
 * steering, jumping or using an item ends it, and the next try needs a new press. At POP_HOLD the runner pops.
 */
export function popCharge(n: number, inp: InputFrame): number {
  if (!inp.alt || inp.left || inp.right || inp.jump || inp.jumpPressed || inp.usePressed) return 0;
  return n > 0 || inp.altPressed ? n + 1 : 0;
}

/** A charge as the on-screen countdown reads it: whole seconds left (3, 2, 1), and frames since that number came up. */
export function popCountdown(pop: number): { secs: number; since: number } {
  const secs = Math.ceil((POP_HOLD - pop) / FPS);
  return { secs, since: pop - (POP_HOLD - secs * FPS) };
}

/**
 * What a race is played for, as the match's mode sets it (game/modes.ts). Plain data the run reads, so the
 * run knows nothing of modes: a new mode picks its numbers here instead of branching in the step.
 */
export interface RunRules {
  /** Reaching the flag finishes you. Off, the goal is only the top of the level, and nobody finishes. */
  flag: boolean;
  /** With more than one runner, the race ends when one is left standing. */
  lastStanding: boolean;
  /** What ahead means (sim/standing.ts): nearer the flag by route, higher up (laps and all), or nothing (a brawl). */
  ahead: 'route' | 'height' | 'none';
  /** The round's own time limit, seconds after GO, over the match's race time rule; when it runs out, everyone left is out. */
  seconds?: number;
}

/** The race the game was built on: run for the flag. */
export const RACE_RUN: RunRules = { flag: true, lastStanding: false, ahead: 'route' };

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
  /** Rising Slag: world y of the slag's surface (sim/tide.ts), or null on a level without one. Under it, everything burns. */
  slag: number | null;
  /** What this race has beyond running the level (sim/features.ts), from its level and rules. */
  readonly features: readonly RunFeature[];
  propState = new Map<number, PropState>();
  /** Set pieces first, then player props. */
  resolved: Resolved[];
  events: GameEvent[] = [];
  /** Loose held items and smoke clouds (src/sim/items). */
  items: ItemWorld = newItemWorld();
  /**
   * Spawn safe zone (world px), or null. Until the shield runs out (`shieldLeft`), a runner whose body overlaps it
   * can't be killed by props: hazards, projectiles (they pop harmlessly) and crushing. Falling into the pit, giving up
   * and the race timer still apply. Ask `isSafe` or `safeAt`, which know the time, rather than the rect.
   */
  readonly safeZone: Rect | null;
  /** Every spawn cell's safe zone (Level.spawns), the first being `safeZone`. */
  readonly safeZones: readonly { cell: { tx: number; ty: number }; zone: Rect }[];
  /** Projectiles spawned so far (ids for projectile-owned solids). */
  private seq = 0;
  /** Grabs asked for this frame; settled and emptied once everyone has moved. */
  private grabs: GrabRequest[] = [];
  /** Where shots struck a solid this frame (px): parts a hit sets off read it in `tick`. Emptied every step. */
  private struck: Vec[] = [];

  solids: Solid[] = [];
  private out: Contrib = { solids: this.solids, hazards: [], springs: [], winds: [], triggers: [], beams: [] };
  readonly world: CollisionWorld;
  private goal: Rect;
  private killY: number;

  constructor(
    readonly level: Level,
    readonly placed: readonly PlacedProp[],
    slots: number[],
    /** Race time limit in frames after the countdown; 0 = unlimited. */
    readonly timeLimit = 0,
    /** Seed of this race's item rolls. Match varies it per round: crates survive rounds and must not replay the same items. */
    readonly itemSeed = level.seed,
    /** The match's blood, shared with it: deaths add to this list and its floors are solid. */
    public blood: BloodCell[] = [],
    /** False under the blood rule's Off: deaths spill nothing. */
    public bleeds = true,
    /** What the race is played for (the match's mode). */
    readonly rules: RunRules = RACE_RUN,
  ) {
    // Runner i starts at the i-th spawn cell, round and round (Level.spawns), fanned out over its pad with whoever
    // shares it; tighter spacing for big lobbies.
    const cells = spawnsOf(level);
    const k = cells.length;
    this.runners = slots.map((slot, i) => {
      const cell = cells[i % k];
      const n = Math.floor((slots.length - 1 - (i % k)) / k) + 1;
      const j = Math.floor(i / k);
      return {
        slot,
        body: bodyAtCell(cell.tx, cell.ty, (j - (n - 1) / 2) * Math.min(PLAYER_W * 0.7, 40 / Math.max(1, n - 1))),
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
        ride: -1,
        perch: 0,
        pop: 0,
        press: 0,
        lap: 0,
      };
    });
    this.resolved = [...level.setPieces, ...placed].map(resolveProp);
    for (const r of this.resolved) {
      const st = newPropState();
      r.mods.forEach((m, i) => m.type === 'launcher' && st.aim.set(i, m.angle));
      this.propState.set(r.pp.uid, st);
    }
    this.world = {
      tileAt: (x, y) => tileAt(level, x, y),
      cols: level.w,
      solids: this.solids,
      gravity: level.gravity ?? 1,
      tileSurface: footing(level),
      surfaceAt: groundSurfaceAt(level),
    };
    this.goal = goalRect(level);
    this.slag = tideStart(level);
    this.features = RUN_FEATURES.filter((ft) => ft.on(this));
    this.safeZones = spawnZones(level);
    this.safeZone = this.safeZones[0]?.zone ?? null;
    this.killY = killY(level);
    this.buildProps(0); // A race can be drawn before its first step, and the art reads what the build reports.
  }

  /** Every reach of the last frame built, which is what the art draws: see Beam. */
  get beams(): readonly Beam[] {
    return this.out.beams!;
  }

  /** Frames left of the spawn shield (SHIELD_FRAMES from GO), 0 once it's gone: then the zones are just ground. */
  get shieldLeft(): number {
    return Math.max(0, RUN_COUNTDOWN + SHIELD_FRAMES - this.frame);
  }

  /** Is this runner inside a spawn safe zone while the shield lasts (immune to props) right now? The one place that decides. */
  isSafe(r: Runner): boolean {
    return this.shieldLeft > 0 && this.safeZones.some((s) => overlaps(r.body, s.zone));
  }

  /** Is this point in a spawn safe zone while the shield lasts (a dive landing there just pops)? */
  safeAt(x: number, y: number): boolean {
    return this.shieldLeft > 0 && this.safeZones.some((s) => pointInRect(x, y, s.zone));
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
    const runners: RunnerView[] = this.runners.map((x) => ({
      x: x.body.x,
      y: x.body.y,
      w: x.body.w,
      h: x.body.h,
      active: x.alive && !x.finished,
    }));
    let leader: number | undefined;
    return {
      ...this.ctx(r, mi, f),
      runners,
      spawn: (p) => this.spawnProjectile(p),
      emit: (e) => this.events.push(e),
      spawnItem: (s) => spawnItem(this, s),
      handItem: (i, kind) => {
        const r = this.runners[i];
        if (!r || r.items.held) return false;
        giveItem(r, kind);
        this.events.push({ type: 'item', what: 'pickup', kind, slot: r.slot, x: r.body.x + r.body.w / 2, y: r.body.y });
        return true;
      },
      itemSeed: this.itemSeed,
      leader: () => (leader ??= leaderOf(this)),
      solids: this.solids,
      hazards: this.out.hazards,
      struck: this.struck,
    };
  }

  /** Add a projectile to this frame's world (prop ticks, held items). */
  spawnProjectile(s: ProjectileSpawn) {
    this.projectiles.push(makeProjectile(s, this.frame, this.seq++));
  }

  step(inputs: readonly InputFrame[]): void {
    const f = this.frame;
    this.struck.length = 0;
    this.buildProps(f);
    for (const ft of this.features) ft.step?.(this, f);
    const live = f >= RUN_COUNTDOWN && this.endFrame < 0;
    const start = contactStart(this.runners);

    this.runners.forEach((r, i) => {
      if (!r.alive) return;
      // Finished runners lose control but keep falling, landing and riding
      // platforms naturally. Nothing can hurt them and they don't push anyone.
      if (r.finished) {
        if (r.body.y <= this.killY) stepBody(r.body, NO_INPUT, this.world, windAt(r.body, this.out.winds));
        return;
      }
      const raw = live ? (inputs[i] ?? NO_INPUT) : NO_INPUT;
      // Counted from the raw input, so frozen, dazed or held runners can still give up.
      r.pop = popCharge(r.pop, raw);
      if (r.pop >= POP_HOLD) return this.kill(r, -1, 'pop');
      const inp = itemInput(r.items, statusInput(r.status, raw));
      const b = r.body;
      // A rope, keg or pipe moves this body instead of the controller, and a held runner skips springs, fields and kickers.
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
      // Round a loop: climbing into its top band carries on from the same place in the bottom one, a lap up.
      const laps = lapShift(this.level, b.y + b.h);
      if (laps) {
        b.y += laps * this.level.loop! * TILE;
        r.lap += laps;
      }
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
          if (sp.set) {
            // A Launch Plate throws from its own center whatever you came in with, so every flight is the same one.
            const { x, y } = b;
            launchFrom(b, [sp.set.x, sp.set.y], [sp.set.vx, sp.set.vy]);
            if (firstOverlap(b, this.world)) {
              b.x = x;
              b.y = y;
            }
          } else if (dy !== 0) b.vy = dy * sp.power;
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
      else if (!held) this.touchTriggers(r, f, inp);

      const hb = inset(b, 1.5);
      if (!this.isSafe(r)) {
        for (const h of this.out.hazards) {
          if (!touchesHazard(hb, h)) continue;
          this.kill(r, h.owner, h.sink ? 'fall' : 'hazard');
          // A shield can cancel the hit; then the rest of this frame still applies.
          if (!r.alive) return;
        }
      }
      if (b.y > this.killY) return this.kill(r, -1, 'fall');
      if (offMap(b, this.level.w)) return this.kill(r, -1, 'out');
      for (const ft of this.features) {
        const cause = ft.kills?.(this, r, hb);
        if (cause) return this.kill(r, -1, cause);
      }
      if (this.rules.flag && overlaps(b, this.goal)) {
        letGo(r);
        r.finished = true;
        r.finishFrame = f;
        this.finishOrder.push(r.slot);
        this.events.push({ type: 'finish', slot: r.slot, place: this.finishOrder.length, x: b.x + b.w / 2, y: b.y });
      }
    });

    settleGrabs(this, this.grabs);

    // Bodies are solid to each other (sim/collide.ts): everyone has moved, so nobody's order matters.
    for (const bump of collideRunners(this.runners, start, this.world, (r) => this.isSafe(r))) this.bump(bump);

    stepItems(this, inputs, live);
    this.stepProjectiles(f);
    this.lapThings();
    for (const rp of this.resolved) rp.mods.forEach((m, mi) => moduleSim(m.type).tick?.(m, this.tickCtx(rp, mi, f)));

    if (this.endFrame < 0) {
      if (live && this.timeLeft === 0) for (const r of this.active) this.kill(r, -1, 'timeout');
      if (this.active.length <= (this.rules.lastStanding && this.runners.length > 1 ? 1 : 0)) this.endFrame = f;
    }
    this.frame++;
  }

  /** Shots and loose items round a loop go a lap with whatever crosses its line, as runners do. */
  private lapThings() {
    if (!this.level.loop) return;
    const rows = this.level.loop * TILE;
    for (const t of [...this.projectiles, ...this.items.drops]) t.y += lapShift(this.level, t.y) * rows;
  }

  /**
   * A runner bumped from below (sim/collide.ts): knocked sideways, seeing stars, the bump credited like any bonk. Off
   * a ledge it hops clear; in the air it never leaves faster upward than that hop, so a bump can't lift anyone.
   */
  private bump({ victim, by, side, stood }: Bump) {
    const r = this.runners.find((x) => x.slot === victim)!;
    letGo(r);
    r.body.vx = side * BUMP.kick;
    r.body.vy = stood ? -BUMP.hop : Math.max(r.body.vy, -BUMP.hop);
    r.body.onGround = false;
    r.body.groundRef = -1;
    r.body.jumping = false;
    bonk(r, by);
    this.events.push({ type: 'item', what: 'hit', kind: 'bump', slot: by, x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h });
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
    if (this.bleeds && cause !== 'out')
      spillBlood(this.blood, groundOf(this.level, this.placed), r.body, r.slot, this.frame, new Rng(deriveSeed(this.itemSeed, `blood:${r.slot}`)));
  }

  /**
   * Call `touch` on every module whose trigger this runner overlaps (once per
   * trigger key), tracking entries frame to frame.
   */
  private touchTriggers(r: Runner, f: number, inp: InputFrame) {
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
      sim.touch(m, this.touchCtx(rp, t.mi, f, r, now, inp), r, t, !st.inside.includes(t.key));
    }
    st.inside = now;
  }

  /** What a module gets while it touches or holds `r`. `seen` is the runner's trigger list this frame, `inp` its input. */
  touchCtx(rp: Resolved, mi: number, f: number, r: Runner, seen: number[] = r.status.inside, inp?: InputFrame): TouchCtx {
    return {
      ...this.tickCtx(rp, mi, f),
      blocked: (q) => firstOverlap(q, this.world) !== null,
      mark: (key) => seen.includes(key) || seen.push(key),
      grab: (g) => this.grabs.push({ r, uid: rp.pp.uid, mi, g }),
      inp,
      peer: (uid) => this.resolved.find((x) => x.pp.uid === uid),
    };
  }

  /** Rebuild this frame's solids, hazards and triggers from all props (and projectile patches). */
  private buildProps(f: number) {
    this.solids.length = 0;
    this.out.hazards.length = 0;
    this.out.springs.length = 0;
    this.out.winds.length = 0;
    this.out.triggers!.length = 0;
    this.out.beams!.length = 0;
    const ctx = (r: Resolved, mi: number) => this.ctx(r, mi, f);
    buildSolids(this.resolved, ctx, this.out);
    for (const p of this.projectiles) buildProjectile(p, f, this.out);
    buildBlood(this.blood, f, this.solids);
    buildBlocks(this.items, f, this.solids); // Pocket Blocks: transient, never part of the proof.
    traceRays(this.resolved, ctx, this.out); // Last, so what travels sees every solid whatever order the props came in.
    wetSolids(this.solids, this.level);
    const gust = gustWind(this.level, f);
    if (gust) this.out.winds.push(gust);
  }

  /** A method, not a field: prediction copies RunWorld, and a closure field would keep writing to the original. */
  private projItems(): ProjItems {
    return {
      caught: (i, kind) => catchShot(this, this.runners[i], kind),
      loose: (s) => spawnItem(this, s),
      bonk: (i, owner) => bonk(this.runners[i], owner),
      burst: (x, y) => burstSmoke(this, x, y),
    };
  }

  /** Projectile behavior lives in props/ammo.ts; this just wires it to the world. */
  private stepProjectiles(f: number) {
    if (this.projectiles.length === 0) return;
    const spawned: Projectile[] = [];
    const runners = this.runners.map((r) => ({
      body: r.body,
      status: r.status,
      active: r.alive && !r.finished,
      safe: this.isSafe(r),
      ground: stackFooting(this.runners, r),
    }));
    const w: ProjWorld = {
      level: this.level,
      frame: f,
      solids: this.solids,
      gravity: this.level.gravity ?? 1,
      gust: gustAir(this.level, f),
      runners,
      spawn: (p) => spawned.push(makeProjectile(p, f, this.seq++)),
      emit: (e) => this.events.push(e),
      kill: (i, owner) => {
        this.kill(this.runners[i], owner, 'hazard');
        runners[i].active = this.runners[i].alive;
      },
      items: this.projItems(),
      hit: (x, y) => this.struck.push([x, y]),
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
