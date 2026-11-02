import type { Cell, Vec } from '../../../core/geom';
import { addTrigger, cellOf, defineModule, solidId } from '../registry';
import type { ModuleOf } from '../types';

type Keg = ModuleOf<'keg'>;

const S = Math.SQRT1_2;
/** Compass unit vectors, screen space: 0 right, 2 down, 4 left, 6 up. A table, so aiming needs no trig. */
export const COMPASS: readonly Vec[] = [
  [1, 0],
  [S, S],
  [0, 1],
  [-S, S],
  [-1, 0],
  [-S, -S],
  [0, -1],
  [S, -S],
];

export const KEG = {
  /** Grab zone radius (px): about the cask's belly. */
  zone: 12,
  /** Share of the distance to the center kept each frame while being stuffed in. */
  suck: 0.68,
  /** Distance (px) that counts as fully inside. */
  snug: 0.5,
  /** Frames a turn between two stops takes (art; a press during one locks the stop it's heading for). */
  turn: 10,
  /** Backfire speed, as a share of `power`. */
  backfire: 0.75,
  /** Frames of soot a backfire leaves on you. */
  soot: 100,
} as const;

export interface KegAim {
  dir: number;
  /** Direction it's turning from. */
  from: number;
  /** 0..1 through the turn; 1 once it has settled. */
  turn: number;
}

/** Where a keg points at frame f: it tips from stop to stop, pausing `step` frames on each. */
export function kegAim(m: Keg, f: number, phase: number): KegAim {
  const n = m.dirs.length;
  if (n <= 1) return { dir: m.dirs[0], from: m.dirs[0], turn: 1 };
  const total = n * m.step;
  const g = (f + Math.floor(phase * total)) % total;
  const i = Math.floor(g / m.step);
  return { dir: m.dirs[i], from: m.dirs[(i + n - 1) % n], turn: Math.min(1, (g - i * m.step) / KEG.turn) };
}

/**
 * A cask with a fuse in its rear. Touching it stuffs you in. Jump locks the
 * aim and fires you out of the mouth a beat later. Sit in there until the
 * fuse burns down and it goes off the wrong way, out of the back, and leaves
 * you sooty.
 */
export const keg = defineModule<'keg'>({
  type: 'keg',
  resolve(m, x) {
    const turns = Math.round(x.da / (Math.PI / 4));
    return { ...m, at: x.P(m.at), dirs: m.dirs.map((d) => (d + turns) % 8) };
  },
  anchors(m) {
    const [x, y] = cellOf(m.at);
    const cells: Cell[] = [
      [x - 1, y - 1],
      [x, y - 1],
      [x - 1, y],
      [x, y],
    ];
    return cells;
  },
  build(m, ctx, out) {
    const x = m.at[0] + ctx.off[0];
    const y = m.at[1] + ctx.off[1];
    const r = KEG.zone;
    addTrigger(out, {
      r: { x: x - r, y: y - r, w: r * 2, h: r * 2 },
      circle: { x, y, r },
      uid: ctx.r.pp.uid,
      mi: ctx.mi,
      key: solidId(ctx.r.pp.uid, ctx.mi, 0),
    });
  },
  touch(m, ctx, who, _t, first) {
    if (!ctx.live || !first) return;
    const b = who.body;
    ctx.grab({ x: b.x + b.w / 2 - m.at[0] - ctx.off[0], y: b.y + b.h / 2 - m.at[1] - ctx.off[1], sealed: true, kind: 'keg-in' });
  },
  hold(m, ctx, who, g, inp) {
    const b = who.body;
    const ax = m.at[0] + ctx.off[0];
    const ay = m.at[1] + ctx.off[1];
    g.x = Math.abs(g.x) < KEG.snug ? 0 : g.x * KEG.suck;
    g.y = Math.abs(g.y) < KEG.snug ? 0 : g.y * KEG.suck;
    b.x = ax + g.x - b.w / 2;
    b.y = ay + g.y - b.h / 2;
    b.vx = 0;
    b.vy = 0;
    if (g.fuse < 0 && inp.jumpPressed) {
      g.fuse = m.delay;
      g.aim = kegAim(m, ctx.frame, ctx.r.phase).dir;
      ctx.emit({ type: 'prop', kind: 'keg-lit', x: ax, y: ay });
    }
    const snug = g.x === 0 && g.y === 0;
    const fire = g.fuse >= 0 && snug && --g.fuse <= 0;
    const backfire = g.fuse < 0 && g.t >= m.burn;
    if (!fire && !backfire) return true;
    const [dx, dy] = COMPASS[fire ? g.aim : kegAim(m, ctx.frame, ctx.r.phase).dir];
    const v = fire ? m.power : -m.power * KEG.backfire;
    b.vx = dx * v;
    b.vy = dy * v;
    ctx.state.lastFire = ctx.frame;
    if (backfire) who.attach.soot = KEG.soot;
    ctx.emit({ type: 'prop', kind: fire ? 'keg-fire' : 'keg-backfire', x: ax, y: ay, x2: ax + (dx * v) / 16, y2: ay + (dy * v) / 16 });
    return false;
  },
});
