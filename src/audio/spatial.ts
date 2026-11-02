import type { Match } from '../game/match';
import { VIEW_H, VIEW_W } from '../sim/constants';

/**
 * Stereo placement. The whole 768×432 world is (almost) always on screen,
 * so one-shots are panned by screen position and only gently attenuated;
 * continuous hazard loops are attenuated hard by the distance to the
 * nearest active runner, so a level full of saws only whines where the
 * action is.
 */

export interface Listener {
  x: number;
  y: number;
  zoom: number;
  /** Active runner positions (empty outside races). */
  runners: { x: number; y: number }[];
}

/** Approximate the renderer's camera (centre of active runners, zoomed in a bit). */
export function listenerFor(m: Match): Listener {
  const runners: { x: number; y: number }[] = [];
  if (m.phase === 'run' && m.run) {
    for (const r of m.run.runners) if (r.alive && !r.finished) runners.push({ x: r.body.x + r.body.w / 2, y: r.body.y + r.body.h / 2 });
  }
  if (!runners.length) return { x: VIEW_W / 2, y: VIEW_H / 2, zoom: 1, runners };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of runners) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const zoom = Math.max(1, Math.min(1.45, VIEW_W / (x1 - x0 + 240), VIEW_H / (y1 - y0 + 240)));
  const hw = VIEW_W / (2 * zoom);
  const hh = VIEW_H / (2 * zoom);
  return {
    x: Math.max(hw, Math.min(VIEW_W - hw, (x0 + x1) / 2)),
    y: Math.max(hh, Math.min(VIEW_H - hh, (y0 + y1) / 2)),
    zoom,
    runners,
  };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Pan in [-0.85, 0.85] for a world x relative to the (approximate) camera. */
export function panFor(x: number, L: Listener): number {
  return clamp(((x - L.x) / (VIEW_W / 2 / L.zoom)) * 0.75, -0.85, 0.85);
}

/** One-shot placement: pan + mild distance rolloff (never below 45%). */
export function placeOneShot(x: number, y: number, L: Listener): { pan: number; gain: number } {
  const d = Math.hypot(x - L.x, (y - L.y) * 1.2) * L.zoom;
  return { pan: panFor(x, L), gain: 0.45 + 0.55 / (1 + (d / 320) ** 2) };
}

/**
 * Loop attenuation: inverse-square-ish rolloff from the nearest active
 * runner (radius ~5 tiles), with a quiet floor from the camera centre so
 * hazards stay faintly audible during countdowns and spectating.
 */
export function loopGain(x: number, y: number, L: Listener): number {
  let near = Infinity;
  for (const r of L.runners) near = Math.min(near, Math.hypot(x - r.x, y - r.y));
  const fromRunner = Number.isFinite(near) ? 1 / (1 + (near / 80) ** 2) : 0;
  const cam = Math.hypot(x - L.x, y - L.y);
  const fromCam = 0.22 / (1 + (cam / 260) ** 2);
  return Math.min(1, Math.max(fromRunner, fromCam));
}
