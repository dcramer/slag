import { clamp } from '../core/geom';
import type { Match } from '../game/match';
import { overview, viewToWorld, type ViewXform, worldToView } from '../game/view';
import { PHYS, RUN_COUNTDOWN, TILE, VIEW_H, VIEW_W } from '../sim/constants';
import { leaderOf } from '../sim/standing';
import type { Camera } from './camera';

/**
 * Phone camera, render-only. A phone squeezes the play view into ~600 CSS px,
 * so a tile is ~12 px and a runner is a speck. This drives the shared Camera
 * differently on small screens and leaves it alone everywhere else:
 *
 * - **Race, solo:** a close follow (tile ≥ ~24 CSS px, look-ahead, vertical
 *   dead zone, clamped to the level). The whole level shows for the first half
 *   of the countdown, then it closes in.
 * - **Race, more than one player, local or remote:** `Camera.frameAll`, always.
 *   Rising Slag adds the slag and a few rows over the leader to the frame.
 *   Every live runner stays on screen, whatever that costs in tile size. Only
 *   the zoom cap rises, so a tight pack still gets close.
 * - **Pick and place:** start on the overview; pinch zooms about the fingers,
 *   two fingers pan, and a ghost dragged near an edge pans that way.
 *
 * Nothing here reaches the sim. Cursors stay in world px: a finger maps through
 * this device's own pose to the world, then back into the overview coords every
 * peer's `Match` expects (`toBoard`), so other players' cursors and ghosts land
 * in the right place whatever each player's zoom.
 */

/** Tile size to aim for on phones, in CSS px. */
export const MIN_TILE_CSS = 24;
/** Never closer than this, or there's too little level left to react to. */
export const MAX_PHONE_ZOOM = 2.6;
/** `?zoom=1` on a screen that needs no zoom still zooms this far, so the camera can be seen working. */
const FORCED_ZOOM = 2;
/** The race camera's zoom cap and framing pad off phones. */
const RACE_MAX_ZOOM = 1.45;
const RACE_PAD = 120;
/** Rising Slag's frame: rows shown over the leader, the most shown below it (about the longest leash), and a tighter pad. */
const SLAG_LOOK_UP = 4;
const SLAG_VIEW_DOWN = 20;
const SLAG_PAD = 40;

/** Look-ahead at full run speed, as a share of the visible width. */
const LOOK_AHEAD = 0.2;
/** Facing bias standing still, as a share of the full look-ahead. */
const IDLE_LOOK = 0.25;
/** Half the vertical dead zone, as a share of the visible height. */
export const DEAD_ZONE_Y = 0.14;
/** The runner never drifts further from the window's middle than this share of the half-window. */
const KEEP_IN = 0.8;
/** Horizontal chase rate (per second); leading by vx/rate cancels the lag of chasing a moving point. */
const CHASE_RATE = 6;
const ZOOM_RATE = 3;
const LOOK_RATE = 2.2;
const LAND_RATE = 3;
const AIR_RATE = 5;

/** Auto-pan band inside the window's edges (view px), and its top speed (view px/s). */
export const EDGE_BAND = 56;
const EDGE_SPEED = 420;
/** Deepest pinch, relative to the race zoom, and its lowest ceiling. */
const PINCH_OVER_RACE = 1.25;
const PINCH_MIN_MAX = 2;

const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Zoom that makes a tile `minTileCss` CSS px when a view px is `cssPerView` CSS px. Never below 1. */
export function phoneZoom(cssPerView: number, minTileCss = MIN_TILE_CSS): number {
  if (!(cssPerView > 0)) return 1;
  return clamp(minTileCss / (TILE * cssPerView), 1, MAX_PHONE_ZOOM);
}

/**
 * Does this screen get the phone camera, and how close? Small or touch-first
 * screens do. `?zoom=0` forces it off, `?zoom=1` on, `?zoom=2.4` pins a zoom.
 */
export function phoneView(search: string, shortSide: number, touchFirst: boolean, cssPerView: number): { enabled: boolean; zoom: number } {
  const q = new URLSearchParams(search).get('zoom');
  const auto = phoneZoom(cssPerView);
  if (q === null) return { enabled: shortSide < 500 || touchFirst, zoom: auto };
  const forced = Number(q);
  if (!(forced > 0)) return { enabled: false, zoom: auto };
  return { enabled: true, zoom: forced === 1 ? Math.max(FORCED_ZOOM, auto) : forced };
}

/** What the follow needs from a runner. */
export interface FollowTarget {
  /** Body centre, world px. */
  x: number;
  y: number;
  vx: number;
  facing: number;
  onGround: boolean;
}

/** One runner, seen up close: leads their run, and holds still for a hop. */
export class FollowCam {
  private pose: ViewXform | null = null;
  private look = 0;

  reset() {
    this.pose = null;
    this.look = 0;
  }

  /** One frame. `from` is where the camera is now: a new follow eases out of it instead of jumping. */
  update(t: FollowTarget, zoom: number, dt: number, cam: Pick<Camera, 'frame' | 'fit'>, from: ViewXform): ViewXform {
    const p = (this.pose ??= { ...from });
    const f = cam.frame;
    p.zoom += (zoom - p.zoom) * ease(ZOOM_RATE, dt);
    const vw = f.w / p.zoom;
    const vh = f.h / p.zoom;
    // The pose that puts the runner in the middle of the window, which needn't be the middle of the play view.
    const midX = t.x - ((f.x0 + f.x1) / 2 - VIEW_W / 2) / p.zoom;
    const midY = t.y - ((f.y0 + f.y1) / 2 - VIEW_H / 2) / p.zoom;
    const speed = clamp(t.vx / PHYS.runSpeed, -1, 1);
    const want = (Math.abs(speed) > 0.05 ? speed : t.facing * IDLE_LOOK) * LOOK_AHEAD * vw;
    this.look += (want - this.look) * ease(LOOK_RATE, dt);
    p.cx += (midX + this.look + t.vx / CHASE_RATE - p.cx) * ease(CHASE_RATE, dt);
    // Vertical: in the air, hold still until they leave the dead zone. On the ground, settle back onto them.
    const dz = DEAD_ZONE_Y * vh;
    let ty = p.cy;
    if (t.onGround) ty = midY;
    else if (midY < p.cy - dz) ty = midY + dz;
    else if (midY > p.cy + dz) ty = midY - dz;
    p.cy += (ty - p.cy) * ease(t.onGround ? LAND_RATE : AIR_RATE, dt);
    // However fast they move, they stay in the window.
    p.cx = clamp(p.cx, midX - (vw / 2) * KEEP_IN, midX + (vw / 2) * KEEP_IN);
    p.cy = clamp(p.cy, midY - (vh / 2) * KEEP_IN, midY + (vh / 2) * KEEP_IN);
    const at = cam.fit(p.cx, p.cy, p.zoom);
    p.cx = at.x;
    p.cy = at.y;
    return p;
  }
}

/** The runner a close follow may stick to: only with exactly one player in the match. */
export function soloRunner(m: Match) {
  if (m.players.length !== 1 || !m.run) return null;
  const slot = m.players[0].slot;
  return m.run.runners.find((r) => r.slot === slot && r.alive && !r.finished) ?? null;
}

/** The camera for phones. Off (`enabled` false), races frame as they always did and pick and place stay on the overview. */
export class PhoneCam {
  enabled = false;
  /** Zoom of the solo follow, and the cap for a pack. */
  zoom = 1;
  /** Where the ghost being dragged is (view px), for edge auto-pan. Set by the client each frame. */
  dragPoint: { x: number; y: number } | null = null;

  private follow = new FollowCam();
  private phase = '';
  /** The hand-moved pick/place pose; null while on the overview. */
  private pose: ViewXform | null = null;
  private ov: ViewXform | null = null;

  constructor(private cam: Camera) {}

  /** The lap a loop's race is framed on: the leader's (frameRace). The renderer draws runners and the slag in it. */
  lap = 0;

  private enter(phase: string) {
    if (phase === this.phase) return;
    this.phase = phase;
    this.lap = 0;
    this.follow.reset();
    this.pose = null;
  }

  /** Race: closes in on a solo player, frames everyone otherwise. The all-players rule lives here and has no exceptions. */
  frameRace(m: Match, dt: number) {
    const cam = this.cam;
    this.enter(m.phase);
    const run = m.run!;
    const racing = run.runners.filter((r) => r.alive && !r.finished);
    // Round a loop the view is the leader's lap (`lap`): the others sit a loop up or down by their own, and the
    // camera crosses the lap line with the leader, which shows the same rows.
    const L = (m.level.loop ?? 0) * TILE;
    const leader = leaderOf(run);
    if (L && leader >= 0) {
      const lap = run.runners[leader].lap;
      if (lap !== this.lap) cam.shiftY((lap - this.lap) * L);
      this.lap = lap;
    }
    const solo = this.enabled ? soloRunner(m) : null;
    if (solo && run.frame >= RUN_COUNTDOWN / 2) {
      const b = solo.body;
      const t = { x: b.x + b.w / 2, y: b.y + b.h / 2, vx: b.vx, facing: b.facing, onGround: b.onGround };
      cam.snap(this.follow.update(t, this.zoom, dt, cam, { cx: cam.x, cy: cam.y, zoom: cam.zoom }));
      cam.update(dt, false);
      return;
    }
    const pts = racing.map((r) => ({ x: r.body.x + r.body.w / 2, y: r.body.y - (r.lap - this.lap) * L }));
    const slag = run.slag !== null && pts.length > 0;
    if (slag) {
      // Rising Slag frames like a racer that follows the leader: from a few rows over whoever is highest down to
      // the slag, so the slag is the bottom of the screen and falling behind is falling off it.
      const lead = pts[racing.indexOf(run.runners[leader])];
      pts.push({ x: lead.x, y: lead.y - SLAG_LOOK_UP * TILE }, { x: lead.x, y: Math.min(run.slag! + this.lap * L, lead.y + SLAG_VIEW_DOWN * TILE) });
    }
    if (pts.length && !solo) cam.frameAll(pts, this.enabled ? Math.max(RACE_MAX_ZOOM, this.zoom) : RACE_MAX_ZOOM, slag ? SLAG_PAD : RACE_PAD);
    else cam.wide();
    cam.update(dt);
  }

  /** Pick and place: the pose to show this frame. Starts on the overview, and off (`enabled` false) it stays there. */
  board(m: Match, dt: number): ViewXform {
    this.ov = overview(m.level);
    if (!this.enabled) return this.ov;
    this.enter(m.phase);
    if (m.phase === 'place') this.autoPan(dt);
    return this.pose ?? this.ov;
  }

  /** Two-finger step: the spread grew by `ratio`, the midpoint moved by `delta` to `mid` (view px). What was under the fingers stays under them. */
  pinch(ratio: number, mid: { x: number; y: number }, delta: { x: number; y: number }) {
    const ov = this.ov;
    if (!this.enabled || !ov || (this.phase !== 'pick' && this.phase !== 'place')) return;
    const p = this.pose ?? ov;
    const anchor = viewToWorld(p, mid.x - delta.x, mid.y - delta.y);
    const zoom = clamp(p.zoom * (ratio > 0 ? ratio : 1), ov.zoom, Math.max(PINCH_MIN_MAX, this.zoom * PINCH_OVER_RACE));
    // All the way out is the overview exactly, so the mapping is the identity again.
    this.pose = zoom <= ov.zoom ? null : this.fitted(anchor.x - (mid.x - VIEW_W / 2) / zoom, anchor.y - (mid.y - VIEW_H / 2) / zoom, zoom);
  }

  /** Scroll toward whichever window edge the ghost is near, faster the closer it gets. */
  private autoPan(dt: number) {
    const p = this.pose;
    const at = this.dragPoint;
    if (!p || !at) return;
    const f = this.cam.frame;
    const push = (v: number, lo: number, hi: number) => (v < lo + EDGE_BAND ? -(1 - (v - lo) / EDGE_BAND) : v > hi - EDGE_BAND ? 1 - (hi - v) / EDGE_BAND : 0);
    const dx = clamp(push(at.x, f.safeX0, f.safeX1), -1, 1);
    const dy = clamp(push(at.y, f.safeY0, f.y1), -1, 1);
    if (!dx && !dy) return;
    const step = (EDGE_SPEED * dt) / p.zoom;
    this.pose = this.fitted(p.cx + dx * step, p.cy + dy * step, p.zoom);
  }

  private fitted(x: number, y: number, zoom: number): ViewXform {
    const at = this.cam.fit(x, y, zoom);
    return { cx: at.x, cy: at.y, zoom };
  }

  /**
   * A view-px pointer on this device, as the overview coords the match reads:
   * what's under the finger here is where the cursor lands, on every peer.
   * The identity on the overview.
   */
  toBoard(p: { x: number; y: number }): { x: number; y: number } {
    if (!this.pose || !this.ov) return p;
    const w = viewToWorld(this.pose, p.x, p.y);
    return worldToView(this.ov, w.x, w.y);
  }
}
