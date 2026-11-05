import { FPS, RUN_COUNTDOWN, TILE } from '../sim/constants';
import { dirOf, flameCycle, laserCycle, motionOffset, pistonState, swingAngles, swingHeads, teslaCycle } from '../sim/props';
import type { Level } from '../sim/level';
import { feetUp, type RunWorld } from '../sim/run';
import { leashRows } from '../sim/tide';
import { gustShown, type WeatherKind } from '../sim/weather';
import type { SfxName } from './sfx';

/**
 * Reads (never writes) a race's prop state and turns it into sound sources:
 *
 *  - continuous emitters (saw whine, flame roar, laser charge/hum, tesla
 *    crackle, fan wind, conveyor rumble, wall-slide scrape), refreshed
 *    every rendered frame and fed to the loop bank;
 *  - transients at module cycle edges (flame ignites, laser fires, tesla
 *    arcs, piston slams, mace/axe swings), found by comparing frame f−1 to f.
 *
 *  - the weather's sound, which is everywhere at once. A gust is heard from
 *    its warning on, off the same clock the sim pushes with.
 *
 * Pure functions of (RunWorld, frame) using the sim's own pose/cycle
 * helpers, so what you hear always matches what the sim does.
 */

export type LoopKind = 'saw' | 'flame' | 'laserCharge' | 'laserFire' | 'tesla' | 'fan' | 'conveyor' | 'slide' | 'gust' | 'rain' | 'snow' | 'mist' | 'slag';

export interface Emitter {
  kind: LoopKind;
  x: number;
  y: number;
  /** 0..1 loudness before distance. */
  level: number;
  /** Kind-specific 0..1 parameter (laser charge progress, flame sputter, slide speed…). */
  p: number;
  /** Heard the same everywhere: no distance or pan (weather). */
  ambient?: boolean;
}

export interface PropCue {
  name: SfxName;
  x: number;
  y: number;
  pitch?: number;
}

/** A gust's loudness and pitch through its warning and push. Still air is silent. */
const WEATHER_SOUND: Partial<Record<WeatherKind, (level: Level, f: number) => { level: number; p: number }>> = {
  wind(level, f) {
    const shown = Math.abs(gustShown(level.weather, f));
    return { level: shown, p: shown };
  },
  rain: () => ({ level: 0.7, p: 0 }),
  snow: () => ({ level: 0.6, p: 0 }),
  mist: () => ({ level: 0.6, p: 0 }),
};

/** The level's weather as one sound. `f` is the race frame, or the match clock before a race. */
export function weatherEmitters(level: Level, f: number, x: number, y: number, out: Emitter[]): void {
  const kind = level.weather?.kind ?? 'clear';
  const s = WEATHER_SOUND[kind]?.(level, f);
  if (s && kind !== 'clear') out.push({ kind: kind === 'wind' ? 'gust' : kind, x, y, level: s.level, p: s.p, ambient: true });
}

/** Rows under the leader the slag's boil fades out by: past this the leader can't hear it coming. */
const SLAG_HEARD = 24;

/**
 * Rising Slag's boil (sim/tide.ts): one source on the leader's lap, as far below the listener as the slag is below
 * the leader, so it swells as it closes. Its `p` is the rush: the slag tearing up after a leader who got more than
 * the leash ahead hisses, and slag at its floor pace only bubbles. Silent while it boils in place, before it moves.
 */
export function slagEmitters(run: RunWorld, f: number, x: number, y: number, out: Emitter[]): void {
  const tide = run.level.tide;
  if (!tide || run.slag === null) return;
  let lead: number | null = null;
  for (const r of run.runners) if (r.alive && !r.finished) lead = Math.min(lead ?? Infinity, feetUp(run.level, r));
  if (lead === null) return;
  const gap = Math.max(0, run.slag - lead) / TILE;
  const boiling = f < RUN_COUNTDOWN + tide.wait * FPS;
  const climbed = ((run.level.spawn.ty + 1) * TILE - lead) / TILE;
  const rush = !boiling && gap > leashRows(tide, climbed, f) + 0.5 ? 1 : 0;
  out.push({ kind: 'slag', x, y: y + gap * TILE * 0.5, level: Math.max(0, 1 - gap / SLAG_HEARD) * (boiling ? 0.4 : 1), p: rush });
}

/** The pour: the slag's boil breaking into its rise, crossed between frame f−1 and f. */
export function slagTransients(run: RunWorld, f: number, x: number, y: number, out: PropCue[]): void {
  const tide = run.level.tide;
  if (!tide || run.slag === null) return;
  const go = RUN_COUNTDOWN + Math.ceil(tide.wait * FPS);
  if (f === go) out.push({ name: 'flame-ignite', x, y: y + 6 * TILE, pitch: 0.45 });
}

/** Continuous sources for the race state at frame `f`. */
export function collectEmitters(run: RunWorld, f: number, out: Emitter[] = []): Emitter[] {
  for (const r of run.resolved) {
    const off = motionOffset(r, f);
    r.mods.forEach((m) => {
      switch (m.type) {
        case 'swinger':
          if (m.head !== 'saw') return;
          for (const h of swingHeads(m, f, r.phase, off)) out.push({ kind: 'saw', x: h.x, y: h.y, level: Math.min(1, 0.55 + m.radius / 40), p: 0.5 });
          return;
        case 'flame': {
          const c = flameCycle(m, f, r.phase);
          if (c.seg === 0) return;
          const [dx, dy] = dirOf(m.angle);
          const x = m.at[0] + off[0] + (dx * m.length) / 2;
          const y = m.at[1] + off[1] + (dy * m.length) / 2;
          out.push({ kind: 'flame', x, y, level: c.seg === 2 ? 1 : 0.3, p: c.seg === 1 ? 1 : 0 });
          return;
        }
        case 'laser': {
          const c = laserCycle(m, f, r.phase);
          const x = m.at[0] + off[0];
          const y = m.at[1] + off[1];
          if (c.seg === 1) out.push({ kind: 'laserCharge', x, y, level: 0.35 + 0.65 * (c.t / c.len), p: c.t / c.len });
          else if (c.seg === 2) out.push({ kind: 'laserFire', x, y, level: 1, p: 0 });
          return;
        }
        case 'tesla': {
          const c = teslaCycle(m, f, r.phase);
          if (c.seg === 0) return;
          out.push({
            kind: 'tesla',
            x: (m.a[0] + m.b[0]) / 2 + off[0],
            y: (m.a[1] + m.b[1]) / 2 + off[1],
            level: c.seg === 2 ? 1 : 0.3,
            p: c.seg === 2 ? 1 : 0,
          });
          return;
        }
        case 'fan':
          out.push({ kind: 'fan', x: m.at[0] + off[0], y: m.at[1] + off[1], level: Math.min(1, 0.4 + m.strength / 3000), p: 0 });
          return;
        case 'body': {
          if (m.material !== 'conveyor' || !m.cells.length) return;
          let sx = 0;
          let sy = 0;
          for (const [cx, cy] of m.cells) {
            sx += cx;
            sy += cy;
          }
          const n = m.cells.length;
          out.push({
            kind: 'conveyor',
            x: (sx / n + 0.5) * TILE + off[0],
            y: (sy / n + 0.5) * TILE + off[1],
            level: Math.min(1, 0.35 + Math.sqrt(n) * 0.15),
            p: 0,
          });
          return;
        }
      }
    });
  }
  for (const rn of run.runners) {
    const b = rn.body;
    if (!rn.alive || rn.finished || b.onGround || b.wallDir === 0 || b.vy < 30) continue;
    out.push({ kind: 'slide', x: b.x + b.w / 2, y: b.y + b.h / 2, level: Math.min(1, b.vy / 220), p: b.wallSurface.friction > 1.2 ? 1 : 0 });
  }
  return out;
}

const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const TAU = Math.PI * 2;

/** One-shot cues for cycle edges crossed between frame f−1 and f. */
export function propTransients(run: RunWorld, f: number, out: PropCue[] = []): PropCue[] {
  if (f <= 0) return out;
  for (const r of run.resolved) {
    const off = motionOffset(r, f);
    r.mods.forEach((m) => {
      switch (m.type) {
        case 'flame':
          if (flameCycle(m, f, r.phase).seg === 2 && flameCycle(m, f - 1, r.phase).seg !== 2)
            out.push({ name: 'flame-ignite', x: m.at[0] + off[0], y: m.at[1] + off[1] });
          return;
        case 'laser':
          if (laserCycle(m, f, r.phase).seg === 2 && laserCycle(m, f - 1, r.phase).seg !== 2)
            out.push({ name: 'laser-fire', x: m.at[0] + off[0], y: m.at[1] + off[1] });
          return;
        case 'tesla':
          if (teslaCycle(m, f, r.phase).seg === 2 && teslaCycle(m, f - 1, r.phase).seg !== 2)
            out.push({ name: 'tesla-arc', x: (m.a[0] + m.b[0]) / 2 + off[0], y: (m.a[1] + m.b[1]) / 2 + off[1] });
          return;
        case 'piston': {
          const now = pistonState(m, f, r.phase).slamming;
          const before = pistonState(m, f - 1, r.phase).slamming;
          if (now && !before) out.push({ name: 'piston-hiss', x: m.at[0] + off[0], y: m.at[1] + off[1] });
          else if (!now && before) out.push({ name: 'piston-slam', x: m.at[0] + off[0], y: m.at[1] + off[1] });
          return;
        }
        case 'swinger': {
          if (m.head === 'saw' || m.arm <= 0) return;
          // Whoosh as each head sweeps through the bottom of its arc (peak speed).
          const a = swingAngles(m, f, r.phase);
          const b = swingAngles(m, f - 1, r.phase);
          a.forEach((ang, i) => {
            const crossed =
              m.swing > 0 ? sgn(ang - m.angle0) !== sgn(b[i] - m.angle0) : Math.floor((ang - Math.PI / 2) / TAU) !== Math.floor((b[i] - Math.PI / 2) / TAU);
            if (!crossed) return;
            const x = m.hub[0] + off[0] + Math.cos(ang) * m.arm;
            const y = m.hub[1] + off[1] + Math.sin(ang) * m.arm;
            out.push({ name: 'swoosh', x, y, pitch: m.head === 'axe' ? 1.2 : 0.85 });
          });
          return;
        }
      }
    });
  }
  return out;
}
