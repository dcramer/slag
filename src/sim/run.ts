import { inset, overlaps, pointInRect, rectCircle, type Rect, type Vec } from '../core/geom';
import { AMMO, type Ammo } from '../gen/props';
import { DT, KILL_Y, PLAYER_W, RUN_COUNTDOWN, RUN_TIME_LIMIT, TILE } from './constants';
import { goalRect, tileAt, type Level } from './level';
import { bodyAtCell, stepBody, type Body, type CollisionWorld, type Solid } from './physics';
import {
  conveyorSurface,
  dirOf,
  fanZone,
  flameCycle,
  footprintCells,
  laserAngle,
  laserCycle,
  launcherAngle,
  motionOffset,
  pistonHead,
  pistonState,
  rayToWall,
  resolveProp,
  SURFACES,
  swingHeads,
  teslaCycle,
  type PlacedProp,
  type Resolved,
} from './props';
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
  ammo: Ammo;
}

type Hazard = { owner: number } & ({ kind: 'rect'; r: Rect } | { kind: 'circle'; x: number; y: number; r: number } | { kind: 'seg'; x1: number; y1: number; x2: number; y2: number; r: number });

export interface PropState {
  /** Crumble: frame it was first stood on, -1 if idle. */
  triggerFrame: number;
  brokenUntil: number;
  /** Spring/launcher: last activation frame (for animation). */
  lastFire: number;
  /** Tracking launchers: current aim angle per module index. */
  aim: Map<number, number>;
}

const TRACK_TURN = 0.045; // rad/frame

/**
 * One race through the level. Pure function of (level, props, inputs);
 * all time is measured in sim frames since the round started.
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
  resolved: Resolved[];
  events: GameEvent[] = [];

  solids: Solid[] = [];
  private hazards: Hazard[] = [];
  private springs: { rect: Rect; angle: number; power: number; uid: number }[] = [];
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
    this.resolved = placed.map(resolveProp);
    for (const r of this.resolved) {
      const aim = new Map<number, number>();
      r.mods.forEach((m, i) => m.type === 'launcher' && aim.set(i, m.angle));
      this.propState.set(r.pp.uid, { triggerFrame: -1, brokenUntil: -1, lastFire: -999, aim });
    }
    this.world = { tileAt: (x, y) => tileAt(level, x, y), solids: this.solids };
    this.goal = goalRect(level);
  }

  get active(): Runner[] {
    return this.runners.filter((r) => r.alive && !r.finished);
  }

  get timeLeft(): number {
    return Math.max(0, RUN_TIME_LIMIT - (this.frame - RUN_COUNTDOWN));
  }

  isBroken(uid: number, f = this.frame): boolean {
    const st = this.propState.get(uid);
    return !!st && f < st.brokenUntil;
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
        // Credit whoever's moving solid did the squishing.
        const s = this.solids.find((s) => s.propUid >= 0 && overlaps(b, s));
        const owner = s ? this.ownerOf(s.propUid) : -1;
        return this.kill(r, owner, 'crush');
      }

      // Crumbles notice who's standing on them.
      if (b.onGround && b.groundRef >= 0) {
        const s = this.solids.find((s) => s.id === b.groundRef);
        if (s) {
          const st = this.propState.get(s.propUid);
          const rp = this.resolved.find((p) => p.pp.uid === s.propUid);
          if (st && rp?.pp.def.archetype === 'crumble' && st.triggerFrame < 0) {
            st.triggerFrame = f;
            this.events.push({ type: 'crumble-start', uid: rp.pp.uid });
          }
        }
      }

      if (r.springCooldown > 0) r.springCooldown--;
      for (const sp of this.springs) {
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

      const hb = inset(b, 1.5);
      for (const h of this.hazards) {
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
    this.stepPropTimers(f);

    if (this.endFrame < 0) {
      if (live && this.timeLeft === 0) for (const r of this.active) this.kill(r, -1, 'timeout');
      if (this.active.length === 0) this.endFrame = f;
    }
    this.frame++;
  }

  private ownerOf(uid: number): number {
    return this.resolved.find((r) => r.pp.uid === uid)?.pp.owner ?? -1;
  }

  private kill(r: Runner, killer: number, cause: DeathCause) {
    r.alive = false;
    r.deathFrame = this.frame;
    r.killer = killer;
    r.cause = cause;
    if (killer >= 0) this.kills.push({ victim: r.slot, killer });
    this.events.push({ type: 'death', slot: r.slot, x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h / 2, cause, vx: r.body.vx, vy: r.body.vy });
  }

  /** Rebuild this frame's solids, hazards and triggers from placed props. */
  private buildProps(f: number) {
    this.solids.length = 0;
    this.hazards.length = 0;
    this.springs.length = 0;
    this.winds.length = 0;
    for (const rp of this.resolved) {
      const uid = rp.pp.uid;
      const owner = rp.pp.owner;
      const off = motionOffset(rp, f);
      const prev = motionOffset(rp, f - 1);
      const mdx = off[0] - prev[0];
      const mdy = off[1] - prev[1];
      rp.mods.forEach((m, mi) => {
        const id = (uid * 16 + mi) * 64;
        switch (m.type) {
          case 'body': {
            if (m.material === 'crumble' && this.isBroken(uid, f)) break;
            const surface = m.material === 'conveyor' ? conveyorSurface(rp.pp.rot >= 2 ? -m.conveyor : m.conveyor) : SURFACES[m.material];
            // One solid per body module (merged rows would be nicer, but cells are few).
            m.cells.forEach(([cx, cy], ci) => {
              this.solids.push({ x: cx * TILE + off[0], y: cy * TILE + off[1], w: TILE, h: TILE, id: id + Math.min(ci, 62), dx: mdx, dy: mdy, surface, propUid: uid });
            });
            break;
          }
          case 'spikes': {
            const [dx, dy] = dirOf(m.angle);
            for (const [cx, cy] of m.cells) {
              const x = cx * TILE + off[0];
              const y = cy * TILE + off[1];
              const d = 7;
              const r: Rect = dx > 0 ? { x: x + TILE, y: y + 2, w: d, h: TILE - 4 } : dx < 0 ? { x: x - d, y: y + 2, w: d, h: TILE - 4 } : dy > 0 ? { x: x + 2, y: y + TILE, w: TILE - 4, h: d } : { x: x + 2, y: y - d, w: TILE - 4, h: d };
              this.hazards.push({ owner, kind: 'rect', r });
            }
            break;
          }
          case 'swinger':
            for (const hd of swingHeads(m, f, rp.phase, off)) this.hazards.push({ owner, kind: 'circle', x: hd.x, y: hd.y, r: m.radius * (m.head === 'axe' ? 0.8 : 0.85) });
            break;
          case 'flame': {
            const c = flameCycle(m, f, rp.phase);
            if (c.seg === 2) {
              const len = rayToWall(this.level, m.at[0] + off[0], m.at[1] + off[1], m.angle, m.length + TILE / 2, 8);
              const [dx, dy] = dirOf(m.angle);
              const x1 = m.at[0] + off[0] + dx * TILE * 0.5;
              const y1 = m.at[1] + off[1] + dy * TILE * 0.5;
              this.hazards.push({ owner, kind: 'seg', x1, y1, x2: m.at[0] + off[0] + dx * len, y2: m.at[1] + off[1] + dy * len, r: 5 });
            }
            break;
          }
          case 'laser': {
            const c = laserCycle(m, f, rp.phase);
            if (c.seg === 2) {
              const a = laserAngle(m, f, rp.phase);
              const x = m.at[0] + off[0];
              const y = m.at[1] + off[1];
              const len = rayToWall(this.level, x, y, a, 1200, 9);
              this.hazards.push({ owner, kind: 'seg', x1: x + Math.cos(a) * 9, y1: y + Math.sin(a) * 9, x2: x + Math.cos(a) * len, y2: y + Math.sin(a) * len, r: 3 });
            }
            break;
          }
          case 'tesla': {
            const c = teslaCycle(m, f, rp.phase);
            if (c.seg === 2) this.hazards.push({ owner, kind: 'seg', x1: m.a[0] + off[0], y1: m.a[1] + off[1], x2: m.b[0] + off[0], y2: m.b[1] + off[1], r: 4 });
            break;
          }
          case 'piston': {
            const st = pistonState(m, f, rp.phase);
            const head = pistonHead(m, st.ext, off);
            const prevHead = pistonHead(m, pistonState(m, f - 1, rp.phase).ext, prev);
            this.solids.push({ ...head, id: id + 63, dx: head.x - prevHead.x, dy: head.y - prevHead.y, surface: SURFACES.metal, propUid: uid });
            if (st.slamming) {
              const [dx, dy] = dirOf(m.angle);
              const lead: Rect = dx > 0 ? { x: head.x + head.w, y: head.y, w: 4, h: head.h } : dx < 0 ? { x: head.x - 4, y: head.y, w: 4, h: head.h } : dy > 0 ? { x: head.x, y: head.y + head.h, w: head.w, h: 4 } : { x: head.x, y: head.y - 4, w: head.w, h: 4 };
              this.hazards.push({ owner, kind: 'rect', r: lead });
            }
            break;
          }
          case 'spring': {
            const [dx, dy] = dirOf(m.angle);
            const ox = m.at[0] + off[0] - TILE / 2;
            const oy = m.at[1] + off[1] - TILE / 2;
            const pad = { x: ox + 2, y: oy + 2, w: TILE - 4, h: TILE - 4 };
            if (dy < 0) pad.y = oy + TILE / 2;
            if (dy > 0) pad.h = TILE / 2;
            if (dx > 0) pad.w = TILE / 2;
            if (dx < 0) pad.x = ox + TILE / 2;
            this.springs.push({ rect: pad, angle: m.angle, power: m.power, uid });
            break;
          }
          case 'fan':
            this.winds.push(fanZone(this.level, m, off));
            break;
          case 'launcher':
          case 'bomb':
            break;
        }
      });
    }
  }

  private stepPropTimers(f: number) {
    for (const rp of this.resolved) {
      const st = this.propState.get(rp.pp.uid)!;
      const off = motionOffset(rp, f);
      rp.mods.forEach((m, mi) => {
        if (m.type === 'body' && m.material === 'crumble') {
          if (st.triggerFrame >= 0 && f - st.triggerFrame >= m.breakFrames) {
            st.triggerFrame = -1;
            st.brokenUntil = f + m.respawnFrames;
            this.events.push({ type: 'crumble-break', uid: rp.pp.uid });
          }
          // Don't respawn on top of someone.
          if (st.brokenUntil === f + 1) {
            const rects = footprintCells(rp.pp).map(([x, y]) => ({ x: x * TILE, y: y * TILE, w: TILE, h: TILE }));
            if (this.runners.some((r) => r.alive && !r.finished && rects.some((rc) => overlaps(r.body, rc)))) st.brokenUntil++;
          }
        } else if (m.type === 'launcher' && f >= RUN_COUNTDOWN) {
          const x = m.at[0] + off[0];
          const y = m.at[1] + off[1];
          let angle = launcherAngle(m, f, rp.phase);
          if (m.aim === 'track') {
            angle = this.trackAim(st.aim.get(mi) ?? m.angle, x, y, m.angle, m.speed, AMMO[m.ammo].gravity);
            st.aim.set(mi, angle);
          }
          const t = f - RUN_COUNTDOWN + Math.floor(rp.phase * m.interval);
          const k = t % m.interval;
          if (k < m.burst * 7 && k % 7 === 0) {
            for (let s = 0; s < m.spread; s++) {
              const a = angle + (s - (m.spread - 1) / 2) * m.spreadAngle;
              this.projectiles.push({ x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10, vx: Math.cos(a) * m.speed, vy: Math.sin(a) * m.speed, owner: rp.pp.owner, born: f, ammo: m.ammo });
            }
            st.lastFire = f;
            this.events.push({ type: 'fire', x: x + Math.cos(angle) * 10, y: y + Math.sin(angle) * 10, angle, style: m.style });
          }
        }
      });
    }
  }

  /** Turn toward the nearest active runner within a 100° cone of the mount's facing. */
  private trackAim(cur: number, x: number, y: number, base: number, speed: number, gravity: number): number {
    let best: Vec | null = null;
    let bestD = Infinity;
    for (const r of this.runners) {
      if (!r.alive || r.finished) continue;
      const tx = r.body.x + r.body.w / 2;
      const ty = r.body.y + r.body.h / 2;
      const d = (tx - x) ** 2 + (ty - y) ** 2;
      const rel = angleDiff(Math.atan2(ty - y, tx - x), base);
      if (Math.abs(rel) < 1.75 && d < bestD) {
        bestD = d;
        best = [tx, ty];
      }
    }
    const target = best ? ballisticAngle(best[0] - x, best[1] - y, speed, gravity) : base;
    const diff = angleDiff(target, cur);
    return cur + Math.max(-TRACK_TURN, Math.min(TRACK_TURN, diff));
  }

  private stepProjectiles(f: number) {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      const spec = AMMO[p.ammo];
      p.vy += spec.gravity * DT;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      if (spec.wobble) {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const w = Math.sin((f - p.born) * 0.25) * spec.wobble;
        p.x += (-p.vy / sp) * w;
        p.y += (p.vx / sp) * w;
      }
      let dead = f - p.born > 60 * 8 || p.x < -16 || p.x > this.level.w * TILE + 16 || p.y > this.level.h * TILE + 16 || p.y < -200;
      if (!dead && tileAt(this.level, Math.floor(p.x / TILE), Math.floor(p.y / TILE))) dead = true;
      if (!dead && f - p.born > 2 && this.solids.some((s) => pointInRect(p.x, p.y, s))) dead = true;
      if (!dead) {
        for (const r of this.runners) {
          if (r.alive && !r.finished && rectCircle(r.body, p.x, p.y, spec.radius)) {
            this.kill(r, p.owner, 'hazard');
            dead = true;
            break;
          }
        }
      }
      if (dead) this.events.push({ type: 'pop', x: p.x, y: p.y, ammo: p.ammo });
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

/** Launch angle (screen space) to hit offset (dx, dy) at `speed` under `gravity`; low arc, direct if unreachable. */
export function ballisticAngle(dx: number, dy: number, speed: number, gravity: number): number {
  if (gravity <= 0) return Math.atan2(dy, dx);
  const X = Math.abs(dx);
  const Y = -dy;
  const v2 = speed * speed;
  const disc = v2 * v2 - gravity * (gravity * X * X + 2 * Y * v2);
  if (disc < 0 || X < 1) return Math.atan2(dy, dx);
  const th = Math.atan((v2 - Math.sqrt(disc)) / (gravity * X));
  return dx >= 0 ? -th : Math.PI + th;
}

export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
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

