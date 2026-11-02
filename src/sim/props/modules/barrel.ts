import type { Vec } from '../../../core/geom';
import { addTrigger, cellOf, defineModule, solidId } from '../registry';
import type { ModuleOf } from '../types';

type Barrel = ModuleOf<'barrel'>;

const S = Math.SQRT1_2;
/** Compass unit vectors, screen space: 0 right, 2 down, 4 left, 6 up (no trig needed). */
export const DIR8: readonly Vec[] = [
  [1, 0],
  [S, S],
  [0, 1],
  [-S, S],
  [-1, 0],
  [-S, -S],
  [0, -1],
  [S, -S],
];

/** Frames spent swinging between two directions; the barrel can't fire while turning. */
export const BARREL_TURN = 8;
/** Frames after being grabbed before a jump press can fire (so the press that got you in doesn't). */
export const BARREL_GRACE = 6;
/** Grab zone half-size (px). */
export const BARREL_R = 7;

export interface BarrelAim {
  /** Current direction index (0..7). */
  dir: number;
  /** Direction it's turning from. */
  from: number;
  /** 0..1 progress of the turn (1 = settled and ready to fire). */
  turn: number;
}

/** Where the barrel points at frame f: it cycles through `dirs`, pausing `step` frames on each. */
export function barrelAim(m: Barrel, f: number, phase: number): BarrelAim {
  const n = m.dirs.length;
  if (n <= 1) return { dir: m.dirs[0] ?? 6, from: m.dirs[0] ?? 6, turn: 1 };
  const total = n * m.step;
  const g = (((f + Math.floor(phase * total)) % total) + total) % total;
  const i = Math.floor(g / m.step);
  const t = g - i * m.step;
  return { dir: m.dirs[i], from: m.dirs[(i + n - 1) % n], turn: Math.min(1, t / BARREL_TURN) };
}

/** Signed shortest turn (in 45° steps) from compass index a to b. */
export function dirDelta(a: number, b: number): number {
  const d = (((b - a) % 8) + 8) % 8;
  return d > 4 ? d - 8 : d;
}

/**
 * Launch barrel. Touch it and it grabs you (you stop dead in its center),
 * then ticks around its directions; press jump to be fired the way it's
 * pointing at `power` px/s. Wait too long and it fires you by itself. A
 * single-direction barrel is a cannon pipe that fires after a short beat.
 */
export const barrel = defineModule<'barrel'>({
  type: 'barrel',
  resolve: (m, x) => {
    const steps = Math.round(x.da / (Math.PI / 4));
    return { ...m, at: x.P(m.at), dirs: m.dirs.map((d) => (((d + steps) % 8) + 8) % 8) };
  },
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    addTrigger(out, {
      r: { x: x - BARREL_R, y: y - BARREL_R, w: BARREL_R * 2, h: BARREL_R * 2 },
      uid: ctx.r.pp.uid,
      mi: ctx.mi,
      key: solidId(ctx.r.pp.uid, ctx.mi, 0),
    });
  },
  touch(m, ctx, who, t, first) {
    const st = who.status;
    const b = who.body;
    const cx = m.at[0] + ctx.off[0];
    const cy = m.at[1] + ctx.off[1];
    if (st.hold !== t.key) {
      // Only grab on a fresh entry (so you can fly out through its own zone), and never someone held elsewhere.
      if (!first || st.hold >= 0 || !ctx.live) return;
      st.hold = t.key;
      st.holdT = 0;
      ctx.state.vars.set(`${ctx.mi}:buf${who.slot}`, 0);
      ctx.emit({ type: 'prop', kind: 'barrel-in', x: cx, y: cy });
    }
    b.x = cx - b.w / 2;
    b.y = cy - b.h / 2;
    b.vx = 0;
    b.vy = 0;
    b.onGround = false;
    b.groundRef = -1;
    b.jumping = false;
    st.holdT++;
    const bufKey = `${ctx.mi}:buf${who.slot}`;
    if (who.input.jumpPressed && st.holdT > BARREL_GRACE) ctx.state.vars.set(bufKey, 1);
    const aim = barrelAim(m, ctx.frame, ctx.r.phase);
    const want = ctx.state.vars.get(bufKey) === 1 || st.holdT >= m.auto;
    if (!want || aim.turn < 1) return;
    const [dx, dy] = DIR8[aim.dir];
    b.vx = dx * m.power;
    b.vy = dy * m.power;
    b.jumpBuffer = 0;
    b.coyote = 0;
    st.hold = -1;
    st.holdT = 0;
    ctx.state.vars.set(bufKey, 0);
    ctx.state.lastFire = ctx.frame;
    ctx.emit({ type: 'fire', x: cx + dx * 9, y: cy + dy * 9, angle: (aim.dir * Math.PI) / 4, style: 'barrel' });
  },
});
