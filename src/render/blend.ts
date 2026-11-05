import { DT, TILE } from '../sim/constants';
import type { Match } from '../game/match';
import type { Runner, RunWorld } from '../sim/run';

/**
 * Drawing between fixed sim steps. The sim moves at 60 Hz and the display at whatever it likes (120, 144, or 60
 * with rAF jitter that lands 0 or 2 steps on a frame), so runners drawn where the latest step left them judder
 * against a camera that glides on wall-clock time. Here the renderer keeps the last two step poses it saw and
 * draws a little behind the newest one, at the fraction of a step the accumulator has banked. Everything is
 * render-side: the sim never sees any of it.
 */

/** Steps between two looks past which the older pose says nothing (a hidden tab, a guest catching up): draw the newest. */
export const MAX_GAP = 4;
/** Px a runner can move in one step and still be moving: past that it was put somewhere (a pipe, a swap). */
export const SNAP_STEP_PX = 40;

/** What a pose needs from a runner: where it stands, and what says it didn't get there by moving. */
export interface Sample {
  x: number;
  y: number;
  /** Laps round a looping shaft: crossing the lap line moves y by a lap, which is no movement at all. */
  lap: number;
  alive: boolean;
  /** Held by a rope or keg: the part says where it is, so it's drawn where the sim has it. */
  held: boolean;
}

export function sampleOf(r: Runner): Sample {
  return { x: r.body.x, y: r.body.y, lap: r.lap, alive: r.alive, held: !!r.attach.grip };
}

/**
 * Where to draw a runner `u` of the way (0..1) from its older pose to its newer, `gap` steps apart. It snaps to
 * the newer pose whenever the two aren't one runner moving: no older pose (it just spawned), dead in the older one
 * (respawned), held by a part in either, or further apart than any runner moves in that many steps.
 */
export function blendPose(prev: Sample | undefined, cur: Sample, u: number, gap: number, lapPx: number): { x: number; y: number } {
  if (!prev || !prev.alive || prev.held || cur.held || u >= 1) return { x: cur.x, y: cur.y };
  // The older pose in the newer one's lap, so a lap line crossed between them isn't a teleport.
  const py = prev.y + (cur.lap - prev.lap) * lapPx;
  const dx = cur.x - prev.x;
  const dy = cur.y - py;
  if (dx * dx + dy * dy > (SNAP_STEP_PX * gap) ** 2) return { x: cur.x, y: cur.y };
  return { x: prev.x + dx * u, y: py + dy * u };
}

/**
 * The last two step poses of every runner, as the renderer saw them. `observe` once per drawn frame with the
 * accumulator's fraction of a step; `pose` then says where each runner goes, and `at` which fractional frame the
 * picture shows (props are pure functions of the frame, so they're drawn at that same moment).
 */
export class StepBlend {
  private prev = new Map<number, Sample>();
  private cur = new Map<number, Sample>();
  private frame = -1;
  private gap = 1;
  /** How far into the newest step the picture is (0..1). */
  private into = 1;

  /**
   * Take this frame's look: the race's frame and runners, or the match's frame and none outside a race. `alpha` is the accumulator's banked fraction of a step (acc / DT), or
   * undefined for a picture of exactly this step (stepped screenshots, the codex). `dt` is seconds since the last
   * drawn frame: when the sim didn't step (a guest waiting on the host, a host on a peer) the picture runs on to
   * the newest pose and waits there, instead of the accumulator's fraction swinging it back each tick.
   */
  observe(frame: number, runners: readonly Runner[], alpha: number | undefined, dt: number) {
    if (frame !== this.frame) {
      const gap = frame - this.frame;
      const swap = this.prev;
      this.prev = this.cur;
      this.cur = swap;
      this.cur.clear();
      // A race that started over, or one we last looked at too long ago: the older poses say nothing.
      if (this.frame < 0 || gap < 0 || gap > MAX_GAP) this.prev.clear();
      this.gap = gap > 0 && gap <= MAX_GAP ? gap : 1;
      this.frame = frame;
      this.into = alpha ?? 1;
    } else this.into = alpha === undefined ? 1 : Math.min(1, this.into + dt / DT);
    this.into = Math.max(0, this.into);
    for (const r of runners) this.cur.set(r.slot, sampleOf(r));
  }

  /** The fraction from the older poses to the newer: a step behind the newest, plus what's banked. */
  get u(): number {
    return (this.gap - 1 + this.into) / this.gap;
  }

  /** The fractional frame the picture shows, never before 0. */
  get at(): number {
    return Math.max(0, this.frame - 1 + this.into);
  }

  pose(r: Runner, lapPx: number): { x: number; y: number } {
    const cur = this.cur.get(r.slot) ?? sampleOf(r);
    return blendPose(this.prev.get(r.slot), cur, this.u, this.gap, lapPx);
  }
}

/**
 * The match as drawn: its race shows each runner where `blend` puts it, and everything else is the match itself.
 * The copies sit over the match through the prototype chain, so every reader of `run.runners` (the camera, the
 * HUD, weather, items) sees the drawn poses without being told, and nothing is ever written to sim state.
 */
export function drawnMatch(m: Match, blend: StepBlend): Match {
  const run = m.run;
  if (!run || m.phase !== 'run') return m;
  const lapPx = (m.level.loop ?? 0) * TILE;
  const runners = run.runners.map((r) => {
    const p = blend.pose(r, lapPx);
    return p.x === r.body.x && p.y === r.body.y ? r : { ...r, body: { ...r.body, x: p.x, y: p.y } };
  });
  const shown: RunWorld = Object.create(run, { runners: { value: runners } });
  return Object.create(m, { run: { value: shown } });
}
