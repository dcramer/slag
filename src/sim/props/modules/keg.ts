import type { Cell, Vec } from '../../../core/geom';
import type { InputFrame } from '../../types';
import type { Grip } from '../attach';
import { addTrigger, cellOf, defineModule, type RunnerMut, solidId, type TouchCtx } from '../registry';
import type { ModuleOf, PropState } from '../types';

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

/** Y-Fling (a keg with `aim: 'player'`): a slingshot you aim and pull yourself. */
export const FLING = {
  /** Share of `power` an unpulled flick still gets. */
  flick: 0.35,
  /** How far (px) a full pull draws the pouch back. */
  draw: 7,
  /** Pull lost per frame with the stick let go (frames of charge): the band creeps back. */
  ease: 2,
} as const;

/** Compass index (0 right, 2 down, 4 left, 6 up) of a direction on the 8-way stick, or -1 for none. */
export function compassOf(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return -1;
  for (let i = 0; i < 8; i++) if (Math.sign(COMPASS[i][0]) === Math.sign(dx) && Math.sign(COMPASS[i][1]) === Math.sign(dy)) return i;
  return -1;
}

/** Where the stick pulls (screen space, one of -1/0/1 each way). */
const pullOf = (inp: InputFrame): Vec => [(inp.right ? 1 : 0) - (inp.left ? 1 : 0), (inp.down ? 1 : 0) - (inp.up ? 1 : 0)];

const snapKey = (mi: number) => `${mi}:snap`;

/** Frame a snapped band is whole again (0 if it never snapped). */
export function flingBack(st: PropState | undefined, mi: number): number {
  return st?.vars.get(snapKey(mi)) ?? 0;
}

/** How hard a fling would go for this much pull (frames): from a flick to full power. */
export function flingSpeed(m: Keg, pull: number): number {
  const full = Math.max(1, m.charge ?? 1);
  return m.power * (FLING.flick + (1 - FLING.flick) * Math.min(1, pull / full));
}

/**
 * One frame in a slingshot's pouch. The stick pulls the pouch back and the
 * aim is the other way; holding it builds the pull, letting go eases it off.
 * Jump fires along the aim. Sit there past `burn` and the band snaps: you drop
 * out and it's gone for `regrow` frames. `g.s` is the pull in frames, `g.aim`
 * the compass aim; the pouch sits `g.x, g.y` off the fork.
 */
function holdFling(m: Keg, ctx: TouchCtx, who: RunnerMut, g: Grip, inp: InputFrame): boolean {
  const b = who.body;
  const ax = m.at[0] + ctx.off[0];
  const ay = m.at[1] + ctx.off[1];
  if (g.t === 0) g.aim = m.dirs[0];
  const [px, py] = pullOf(inp);
  const dir = compassOf(-px, -py);
  const full = Math.max(1, m.charge ?? 1);
  if (dir >= 0) {
    g.aim = dir;
    g.s = Math.min(full, g.s + 1);
  } else g.s = Math.max(0, g.s - FLING.ease);
  // The pouch comes to the fork, then draws back against the aim as far as the pull and the room around it allow.
  const [cx, cy] = COMPASS[g.aim];
  const back = (FLING.draw * g.s) / full;
  const tx = -cx * back;
  const ty = -cy * back;
  const nx = Math.abs(g.x - tx) < KEG.snug ? tx : tx + (g.x - tx) * KEG.suck;
  const ny = Math.abs(g.y - ty) < KEG.snug ? ty : ty + (g.y - ty) * KEG.suck;
  if (!ctx.blocked({ x: ax + nx - b.w / 2, y: ay + ny - b.h / 2, w: b.w, h: b.h })) {
    g.x = nx;
    g.y = ny;
  }
  b.x = ax + g.x - b.w / 2;
  b.y = ay + g.y - b.h / 2;
  b.vx = 0;
  b.vy = 0;
  if (inp.jumpPressed) {
    const v = flingSpeed(m, g.s);
    b.vx = cx * v;
    b.vy = cy * v;
    ctx.state.lastFire = ctx.frame;
    ctx.emit({ type: 'prop', kind: 'fling-fire', x: ax, y: ay, x2: ax + (cx * v) / 16, y2: ay + (cy * v) / 16 });
    return false;
  }
  if (g.t < m.burn) return true;
  ctx.state.vars.set(snapKey(ctx.mi), ctx.frame + (m.regrow ?? 0));
  ctx.emit({ type: 'prop', kind: 'fling-snap', x: ax, y: ay });
  return false;
}

/** Nothing to grab while a slingshot's band is snapped. */
function canGrab(m: Keg, ctx: TouchCtx): boolean {
  return m.aim !== 'player' || ctx.frame >= flingBack(ctx.state, ctx.mi);
}

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
    if (!ctx.live || !first || !canGrab(m, ctx)) return;
    const b = who.body;
    const sling = m.aim === 'player';
    ctx.grab({ x: b.x + b.w / 2 - m.at[0] - ctx.off[0], y: b.y + b.h / 2 - m.at[1] - ctx.off[1], sealed: !sling, kind: sling ? 'fling-in' : 'keg-in' });
  },
  hold(m, ctx, who, g, inp) {
    if (m.aim === 'player') return holdFling(m, ctx, who, g, inp);
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
    if (backfire) who.attach.soot = ctx.frame + KEG.soot;
    ctx.emit({ type: 'prop', kind: fire ? 'keg-fire' : 'keg-backfire', x: ax, y: ay, x2: ax + (dx * v) / 16, y2: ay + (dy * v) / 16 });
    return false;
  },
});
