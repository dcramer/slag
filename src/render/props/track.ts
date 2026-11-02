import { css, type HSL } from '../../core/color';
import { frac } from '../../core/geom';
import { TILE } from '../../sim/constants';
import { dirOf, motionOffset, type Resolved } from '../../sim/props';
import { line, type P, stroke } from '../ink';
import { INK, ovalPts, part, sprite, stamp, tick } from '../ink-props';
import { METALS, type RC } from '../kit';

/**
 * The guide a whole moving prop runs on: a track's polyline, or a lift's rail
 * (a rail with `dwell`, sim/props/transform.ts). It's the scenery half of the
 * piece, so it paints with the backdrop, behind the terrain and the body: a
 * cable in the prop's metal in a dark channel, clamped every tile, ending in a pulley at each
 * end (an open path) or turning round one at each corner (a closed loop). The
 * pulleys' spokes turn as the body travels, so you can read which way it's
 * going. Nothing here looks solid enough to stand on, and nothing is.
 *
 * Plain rails and loops keep their dashed placing preview (`drawPath`); they
 * don't move like machines with a guide.
 */
export function drawTrack(rc: RC, r: Resolved): void {
  const g = guide(r, rc.frame);
  if (!g) return;
  const s = rc.s;
  const pal = METALS[r.pp.def.style.metal];
  const seed = r.pp.uid % 97;
  // The guide: a dark channel, the cable lit along its upper-left side. Sampled finely, so the pen's
  // pressure has something to work on and its tapers stay at the very ends.
  const pts = dense(g.pts);
  s.fillStyle = INK;
  stroke(s, pts, { w: 3.12, seed, taper: [0.01, 0.01], press: 0.15, wobble: 0.15 });
  s.fillStyle = css(pal.base, -4);
  stroke(s, pts, { w: 2.1, seed: seed + 1, taper: [0.02, 0.02], press: 0.1 });
  s.fillStyle = css(pal.light);
  for (const p of pts) {
    p.x -= 0.35;
    p.y -= 0.4;
  }
  stroke(s, pts, { w: 0.8, seed: seed + 2, taper: [0.05, 0.05], press: 0.3 });
  // Clamps, one per tile along it, keyed to the distance from the start so they don't crawl.
  for (let i = 1; i < g.pts.length; i++) {
    const a = g.pts[i - 1];
    const b = g.pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    for (let d = TILE / 2; d < len - 3; d += TILE) {
      const x = a.x + ux * d;
      const y = a.y + uy * d;
      tick(s, x - uy * 2.6, y + ux * 2.6, x + uy * 2.6, y - ux * 2.6, 0.9, i * 31 + d);
    }
  }
  // Pulleys, turning with the distance travelled.
  const spin = g.travel / PULLEY_R;
  for (const p of g.wheels) {
    stamp(s, pulley(pal.base, pal.dark), p.x, p.y);
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * Math.PI * 2) / 3;
      s.fillStyle = INK;
      line(s, p.x, p.y, p.x + Math.cos(a) * (PULLEY_R - 1.6), p.y + Math.sin(a) * (PULLEY_R - 1.6), { w: 0.9, seed: k, taper: [0.1, 0.3], press: 0 });
    }
    s.fillStyle = css(pal.light);
    s.fillRect(p.x - 0.7, p.y - 0.7, 1.4, 1.4);
  }
}

const PULLEY_R = 5.5;

/** The polyline resampled every few px. */
function dense(path: readonly P[]): P[] {
  const out: P[] = [{ x: path[0].x, y: path[0].y }];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** A pulley wheel at the origin: a dark rim round a grooved face. Spokes are drawn live. */
function pulley(base: HSL, dark: HSL) {
  return sprite(`track|pulley|${base.h}|${base.l}|${dark.l}`, -PULLEY_R - 2, -PULLEY_R - 2, PULLEY_R * 2 + 4, PULLEY_R * 2 + 4, (g) => {
    part(g, ovalPts(0, 0, PULLEY_R, PULLEY_R, 5, 0.02), dark, 5, { depth: 0.8, thin: 0.6, thick: 1.3 });
    part(g, ovalPts(0, 0, PULLEY_R - 1.8, PULLEY_R - 1.8, 6, 0.02), base, 6, { depth: 0.6, thin: 0.3, thick: 0.6 });
    g.fillStyle = INK;
    g.beginPath();
    g.arc(0, 0, 1.3, 0, Math.PI * 2);
    g.fill();
  });
}

interface Guide {
  /** The polyline the body's middle follows, out to the pulleys. */
  pts: P[];
  /** Where the pulleys go. */
  wheels: P[];
  /** How far the body has come along its path, px: turns the pulleys. */
  travel: number;
}

/** The middle of the prop's body at rest, px: what its guide runs through. */
function middle(r: Resolved): { x: number; y: number; ex: number; ey: number } {
  const cells = r.mods.flatMap((m) => (m.type === 'body' ? m.cells : []));
  if (!cells.length) return { x: (r.pp.tx + 0.5) * TILE, y: (r.pp.ty + 0.5) * TILE, ex: TILE / 2, ey: TILE / 2 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of cells) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  return { x: ((x0 + x1) / 2) * TILE, y: ((y0 + y1) / 2) * TILE, ex: ((x1 - x0) / 2) * TILE, ey: ((y1 - y0) / 2) * TILE };
}

/**
 * The guide for a prop whose whole body travels a path, or null. An open
 * path runs on past each end, out from under the parked body, to a pulley.
 */
function guide(r: Resolved, frame: number): Guide | null {
  const m = r.motion;
  if (m.type !== 'track' && !(m.type === 'rail' && m.dwell)) return null;
  const c = middle(r);
  if (m.type === 'rail') {
    const [dx, dy] = dirOf(m.angle);
    const a = { x: c.x, y: c.y };
    const b = { x: c.x + dx * m.range, y: c.y + dy * m.range };
    const pts = runOut([a, b], c.ex, c.ey);
    const [ox, oy] = motionOffset(r, frame);
    return { pts, wheels: [pts[0], pts[1]], travel: Math.hypot(ox, oy) };
  }
  if (m.pts.length < 2) return null;
  const path = m.pts.map(([x, y]) => ({ x: c.x + x, y: c.y + y }));
  let len = 0;
  for (let i = 1; i < path.length + (m.closed ? 1 : 0); i++) {
    const a = path[i - 1];
    const b = path[i % path.length];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (m.closed) {
    // A loop is a cable round a pulley at every corner.
    return { pts: [...path, path[0]], wheels: path, travel: (frame / m.period + r.phase) * len };
  }
  const pts = runOut(path, c.ex, c.ey);
  // Out and back: the pulleys turn one way, then the other.
  const s = frac(frame / m.period + r.phase) * 2 * len;
  return { pts, wheels: [pts[0], ...path.slice(1, -1), pts[pts.length - 1]], travel: s > len ? 2 * len - s : s };
}

/** The path with each end pushed out past the body parked there, plus the pulley's radius. */
function runOut(path: P[], ex: number, ey: number): P[] {
  const out = path.map((p) => ({ ...p }));
  const push = (end: P, from: P) => {
    const dx = end.x - from.x;
    const dy = end.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    // Half the body's extent along this direction, then clear of it.
    const reach = Math.abs(ux) * ex + Math.abs(uy) * ey + PULLEY_R + 1;
    end.x += ux * reach;
    end.y += uy * reach;
  };
  push(out[0], path[1]);
  push(out[out.length - 1], path[path.length - 2]);
  return out;
}
