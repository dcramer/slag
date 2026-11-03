import 'client-only';
import { Match, rulesProfile } from '../game/match';
import { DEFAULT_RULES } from '../game/rules';
import { levelKey, offerLevel } from '../gen/level/pregen';
import type { Level } from '../sim/level';
import { RunWorld } from '../sim/run';
import { Renderer } from '../render/renderer';
import { type MapJob, type MapShot, planShot } from './shots';

/**
 * The codex's map pictures, drawn by the game's own renderer: a race through the job's level with nobody in
 * it, the camera pinned where the plan says (./shots.ts). Plans come from a worker; a card gets a still the
 * first time it scrolls into view, and the close-up runs the race live.
 *
 * Two renderers, each on canvases of its own off the page: one paints card stills, one plays the close-up,
 * so the close-up's sparks and smoke never land in a card. Each renders the whole window, as in a game, and
 * the play view is cut out of it.
 */

const key = (j: MapJob) => `${j.kind}:${j.theme}:${j.id}`;
/** Each render advances this much: a renderer reads gaps between renders as slow frames and drops quality. */
const FRAME_MS = 1000 / 60;

interface Stage {
  renderer: Renderer;
  gl: HTMLCanvasElement;
  match: Match;
  /** The job on stage, and its race. */
  on: string;
  run: RunWorld;
  clock: number;
}

export class MapPainter {
  private worker: Worker | null = null;
  private shots = new Map<string, MapShot | null>();
  private waiting = new Map<string, ((s: MapShot | null) => void)[]>();
  /** Jobs wanted, most wanted first; the worker takes one at a time. */
  private queue: MapJob[] = [];
  private busy: string | null = null;
  private stills: Stage | null = null;
  private live: Stage | null = null;
  /** Stills waiting for a frame of their own: one render a frame, so scrolling never stalls on a pile of them. */
  private slots: (() => void)[] = [];
  private ticking = false;

  constructor() {
    try {
      this.worker = new Worker(new URL('./map-worker.ts', import.meta.url), { name: 'codex-maps' });
      this.worker.onmessage = ({ data }: MessageEvent<{ key: string; shot: MapShot | null }>) => {
        this.busy = null;
        this.settle(data.key, data.shot);
        this.pump();
      };
      this.worker.onerror = (e) => {
        e.preventDefault();
        this.worker?.terminate();
        this.worker = null;
        this.busy = null;
        this.pump();
      };
    } catch {
      this.worker = null;
    }
  }

  /** The job's plan: at once if known, else when the worker gets to it (first in line). */
  shot(job: MapJob): Promise<MapShot | null> {
    const k = key(job);
    if (this.shots.has(k)) return Promise.resolve(this.shots.get(k)!);
    return new Promise((done) => {
      const list = this.waiting.get(k);
      if (list) list.push(done);
      else this.waiting.set(k, [done]);
      this.queue = [job, ...this.queue.filter((j) => key(j) !== k)];
      this.pump();
    });
  }

  /** A card left the screen before its plan started: let it wait behind the ones still in view. */
  unwant(job: MapJob): void {
    const k = key(job);
    const i = this.queue.findIndex((j) => key(j) === k);
    if (i > 0) this.queue.push(...this.queue.splice(i, 1));
  }

  private settle(k: string, shot: MapShot | null): void {
    this.shots.set(k, shot);
    for (const done of this.waiting.get(k) ?? []) done(shot);
    this.waiting.delete(k);
  }

  private pump(): void {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) return;
    const k = key(job);
    if (this.shots.has(k)) return this.pump();
    if (this.worker) {
      this.busy = k;
      this.worker.postMessage({ key: k, job }, []);
      return;
    }
    // No worker: plan here, a frame at a time.
    this.busy = k;
    requestAnimationFrame(() => {
      this.busy = null;
      this.settle(k, planShot(job));
      this.pump();
    });
  }

  /** Paint the job's still into `canvas` (sized by the caller). False if it has no picture. */
  async paint(job: MapJob, canvas: HTMLCanvasElement): Promise<boolean> {
    const shot = await this.shot(job);
    if (!shot) return false;
    await this.turn();
    if (!canvas.width || !canvas.height) return false;
    const st = (this.stills ??= stage(shot.level));
    load(st, key(job), shot);
    st.renderer.render(st.match, (st.clock += FRAME_MS), []);
    blit(st, canvas.getContext('2d')!, 0, 0, canvas.width, canvas.height);
    return true;
  }

  private turn(): Promise<void> {
    return new Promise((go) => {
      this.slots.push(go);
      if (this.ticking) return;
      this.ticking = true;
      const tick = () => {
        this.slots.shift()?.();
        if (this.slots.length) requestAnimationFrame(tick);
        else this.ticking = false;
      };
      requestAnimationFrame(tick);
    });
  }

  /**
   * One frame of the close-up: the job's race a frame on, drawn into `ctx` at w×h. Until its plan is in, it
   * draws nothing and asks for it.
   */
  frame(job: MapJob, ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const k = key(job);
    const shot = this.shots.get(k);
    if (shot === undefined) {
      void this.shot(job);
      return;
    }
    if (!shot) return;
    const st = (this.live ??= stage(shot.level));
    if (st.on !== k) load(st, k, shot);
    st.run.step([]);
    st.renderer.render(st.match, (st.clock += FRAME_MS), st.match.drainEvents());
    blit(st, ctx, 0, 0, w, h);
  }

  /** Let go of the worker and both renderers. */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const st of [this.stills, this.live]) st?.renderer.dispose();
    this.stills = this.live = null;
  }
}

/** A renderer of its own, off the page, and a match to hand it. */
function stage(level: Level): Stage {
  const gl = document.createElement('canvas');
  const hud = document.createElement('canvas');
  const renderer = new Renderer(gl, hud);
  renderer.hud.hidden = true;
  // A stepped picture is a finished level: ink it whole, never a chunk per render.
  renderer.bakeBudgetMs = Infinity;
  // The match only carries the level and the race to the renderer. Handed a level up front, it builds none.
  offerLevel(levelKey({ seed: level.seed, theme: level.theme.id, profile: rulesProfile(DEFAULT_RULES) }), level);
  const match = new Match(level.seed, level.theme.id);
  return { renderer, gl, match, on: '', run: new RunWorld(level, [], []), clock: 0 };
}

/** Put a planned picture on stage: its level, a race with nobody in it run to the planned frame, the camera pinned. */
function load(st: Stage, k: string, shot: MapShot): void {
  if (st.on === k) return;
  const run = new RunWorld(shot.level, [], []);
  while (run.frame < shot.frame) run.step([]);
  run.drainEvents();
  st.on = k;
  st.run = run;
  st.match.level = shot.level;
  st.match.placed = [];
  st.match.run = run;
  st.match.phase = 'run';
  st.renderer.pin = shot.view;
}

/** Copy the play view out of the renderer's window-sized picture into `ctx`, cut to the box's shape round its middle. */
function blit(st: Stage, ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const k = st.gl.width / Math.max(1, innerWidth);
  const box = st.renderer.viewBox.style;
  let sx = parseFloat(box.left) * k;
  let sy = parseFloat(box.top) * k;
  let sw = parseFloat(box.width) * k;
  let sh = parseFloat(box.height) * k;
  if (w / h > sw / sh) {
    const cut = sh - (sw * h) / w;
    sy += cut / 2;
    sh -= cut;
  } else {
    const cut = sw - (sh * w) / h;
    sx += cut / 2;
    sw -= cut;
  }
  ctx.drawImage(st.gl, sx, sy, sw, sh, x, y, w, h);
}
