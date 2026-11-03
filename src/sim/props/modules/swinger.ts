import { dcos, dsin } from '../../../core/dmath';
import type { Rect, Vec } from '../../../core/geom';
import { cellOf, defineModule } from '../registry';
import type { Drive, ModuleOf } from '../types';

type Swinger = ModuleOf<'swinger'>;

/** A drive's cycle in frames: parked, out, parked, back (the piece's rail with `dwell`). */
const driveCycle = (d: Drive) => 2 * (d.park + d.move);

/**
 * Where a drive is in its cycle at frame f: `rev`, how far it has wound up (0 idling, rising to 1 over the
 * warning, 1 while it moves), whether the machine is `moving`, and `turns`, the frames of full-speed
 * turning it has run so far (idle and wind-up count for their share). Counted with the same phase and
 * comparisons as the rail it rides (transform.ts `liftAt`), so the reel hits full speed on the frame the
 * machine pulls away. Closed form: a pure function of the frame, like every other mover.
 */
export function driveAt(d: Drive, f: number, phase: number): { rev: number; moving: boolean; turns: number } {
  const P = d.park;
  const M = d.move;
  const W = Math.min(d.warn, P);
  const i = d.idle;
  const total = driveCycle(d);
  const winding = (u: number) => W > 0 && u >= P - W;
  // Turning while parked: idle, then a linear wind-up from idle to full over the last W frames.
  const parked = (u: number) => (winding(u) ? i * u + ((1 - i) * (u - P + W) * (u - P + W)) / (2 * W) : i * u);
  const parkTurns = parked(P);
  const g = f + Math.floor(phase * total);
  const n = Math.floor(g / total);
  let t = g - n * total;
  let turns = n * 2 * (parkTurns + M);
  for (let leg = 0; leg < 2; leg++) {
    if (t < P) return { rev: winding(t) ? (t - P + W) / W : 0, moving: false, turns: turns + parked(t) };
    t -= P;
    turns += parkTurns;
    if (t < M) return { rev: 1, moving: true, turns: turns + t };
    t -= M;
    turns += M;
  }
  return { rev: 1, moving: true, turns };
}

/** Angles of each head at frame f. */
export function swingAngles(m: Swinger, f: number, phase: number): number[] {
  if (m.swing > 0) return [m.angle0 + m.swing * dsin(Math.PI * 2 * (f / m.period + phase))];
  const turn = m.drive ? driveAt(m.drive, f, phase).turns / m.period : f / m.period + phase;
  const base = m.angle0 + m.dir * Math.PI * 2 * turn;
  return Array.from({ length: m.count }, (_, i) => base + (i * Math.PI * 2) / m.count);
}

export function swingHeads(m: Swinger, f: number, phase: number, off: Vec): { x: number; y: number; a: number }[] {
  return swingAngles(m, f, phase).map((a) => ({ x: m.hub[0] + off[0] + dcos(a) * m.arm, y: m.hub[1] + off[1] + dsin(a) * m.arm, a }));
}

/** A log head's length and thickness, in radii: a trunk three and a half radii long, a little over one thick. */
export const LOG_LEN = 3.4;
export const LOG_THICK = 1.1;

/**
 * Where a log head hurts: the whole log, level whatever the swing (it hangs on two parallel ropes, so it
 * stays level as it swings), centred on the head. The art draws the same box.
 */
export function logBox(m: Swinger, h: { x: number; y: number }): Rect {
  const L = m.radius * LOG_LEN;
  const T = m.radius * LOG_THICK;
  return { x: h.x - L / 2, y: h.y - T / 2, w: L, h: T };
}

/** Saw / mace / axe heads on an arm: static, orbiting, or pendulum; or a log slung level, battering along its length. */
export const swinger = defineModule<'swinger'>({
  type: 'swinger',
  resolve: (m, x) => ({ ...m, hub: x.P(m.hub), arm: m.arm * x.T, radius: m.radius * x.T, angle0: m.angle0 + x.da }),
  anchors: (m) => [cellOf(m.hub)],
  build(m, ctx, out) {
    for (const h of swingHeads(m, ctx.frame, ctx.r.phase, ctx.off)) {
      if (m.head === 'log') out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: logBox(m, h) });
      else out.hazards.push({ owner: ctx.r.pp.owner, kind: 'circle', x: h.x, y: h.y, r: m.radius * (m.head === 'axe' ? 0.8 : 0.85) });
    }
  },
});
