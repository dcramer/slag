import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import { blob, type EdgeP, line, type P, stroke } from './ink';
import { type Block, type Run, runsOf } from './ink-build';
import { boxPts, dot, INK, ovalPts, path, pen, poly, sprite, stamp, tone } from './ink-props';
import type { MetalPalette } from './kit';

/**
 * Surface blocks drawn as the things they parody: a belt conveyor (rubber belt round two drive drums, a
 * painted side rail, legs and a luggage tag), a slab of gelatin, and a block of tar that drips and strings.
 *
 * The block is baked once (`ink-blocks.ts`), cut to its hand-cut outline, so the silhouette is the
 * fair-play shape whatever is drawn inside it. Only the belt's cleats and the drums' spokes are drawn
 * live, and they move by the sim's own belt speed and frame, never a clock.
 */

/**
 * A block as baked: its hand-cut outline, and for a conveyor the way its belt runs (`dir`, ±1) and the
 * face it's on (`turn`, quarter turns clockwise from the top, as the part was rotated).
 */
export type Cut = Block & { loops: readonly EdgeP[][]; dir: number; turn: number };

const mod = (a: number, m: number) => ((a % m) + m) % m;

/** Clip to the cells of one run, reaching past the run's edges only where nothing of the block is next to it. */
function clipRun(g: CanvasRenderingContext2D, b: Block, r: Run) {
  g.beginPath();
  for (let x = r.x0; x <= r.x1; x++) {
    const l = b.has(x - 1, r.y) ? 0 : 3;
    const t = b.has(x, r.y - 1) ? 0 : 3;
    const rr = b.has(x + 1, r.y) ? 0 : 3;
    const d = b.has(x, r.y + 1) ? 0 : 3;
    g.rect(x * TILE - l, r.y * TILE - t, TILE + l + rr, TILE + t + d);
  }
  g.clip();
}

const topOpen = (b: Block, r: Run) => {
  for (let x = r.x0; x <= r.x1; x++) if (!b.has(x, r.y - 1)) return true;
  return false;
};

/** Quarter turns clockwise, the way the canvas turns: cos and sin of each. */
const COS = [1, 0, -1, 0];
const SIN = [0, 1, 0, -1];

/** A point turned `t` quarter turns clockwise about the cells' origin. */
const turnPt = (t: number, x: number, y: number): P => ({ x: x * COS[t] - y * SIN[t], y: x * SIN[t] + y * COS[t] });

/**
 * The block as its belt sees it: the cells turned back so the belt's face is the top. Drawn under a
 * canvas turned `turn` quarter turns, everything lands back on the real cells.
 */
function beltFrame(b: Cut): Block {
  if (!b.turn) return b;
  const back = (4 - b.turn) & 3;
  const cells = b.cells.map(([x, y]) => {
    const c = turnPt(back, x + 0.5, y + 0.5);
    return [Math.floor(c.x), Math.floor(c.y)] as [number, number];
  });
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  return { ...b, cells, has, runs: runsOf(cells, has) };
}

/** Where `tone` pulls a lit shape in the belt's frame, so the light still comes from the world's upper left. */
let LIGHT: P = { x: -1, y: -1.1 };

/** Two flat tones and a hard shadow, lit from the world's upper left whichever way the belt is turned. */
function lit(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, depth: number, shade: number) {
  g.fillStyle = css(base, shade, 1, 6);
  path(g, pts);
  g.fill();
  g.save();
  g.clip();
  g.translate(LIGHT.x * depth, LIGHT.y * depth);
  g.fillStyle = css(base);
  path(g, pts);
  g.fill();
  g.restore();
}

function trace(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], dx: number, dy: number) {
  g.beginPath();
  for (const loop of loops) {
    loop.forEach((p, i) => (i ? g.lineTo(p.x + dx, p.y + dy) : g.moveTo(p.x + dx, p.y + dy)));
    g.closePath();
  }
}

// ------------------------------------------------------------------------------------------- conveyor

/**
 * One belt: a run of cells with a top a foot can reach. Like the real thing it runs between a big head
 * drum at the end it carries you to and a small tail drum at the other, so its top run is flat and its
 * return run slants. Everything the live marks need.
 */
export interface Belt {
  X0: number;
  X1: number;
  Y: number;
  bt: number;
  /** Outer radii of the belt round the left and right drums; each drum itself is `bt` smaller. */
  rl: number;
  rr: number;
  /** Outward normal of the return run. */
  nx: number;
  ny: number;
  /** One lap of the belt, and the cleat pitch that divides it evenly, so the marks loop without a seam. */
  lap: number;
  pitch: number;
}

function beltOf(r: Run, dir: number): Belt {
  const X0 = r.x0 * TILE;
  const X1 = (r.x1 + 1) * TILE;
  const Y = r.y * TILE;
  const one = r.x0 === r.x1;
  const head = one ? 5.6 : 6.6;
  const tail = one ? 3.6 : 4.8;
  const bt = one ? 2 : 2.3;
  const rl = dir < 0 ? head : tail;
  const rr = dir < 0 ? tail : head;
  // The return run is the drums' other common tangent: the top run mirrored in the line through their centres.
  const dx = X1 - rr - (X0 + rl);
  const dy = rr - rl;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -2 * uy * ux;
  const ny = 1 - 2 * uy * uy;
  const phi = Math.atan2(ny, nx);
  const bottom = Math.hypot(dx + (rr - rl) * nx, dy + (rr - rl) * ny);
  const lap = dx + rr * (phi + Math.PI / 2) + bottom + rl * ((3 * Math.PI) / 2 - phi);
  return { X0, X1, Y, bt, rl, rr, nx, ny, lap, pitch: lap / Math.max(4, Math.round(lap / 5.5)) };
}

export const beltsOf = (b: Cut): Belt[] => {
  const f = beltFrame(b);
  return f.runs.filter((r) => topOpen(f, r)).map((r) => beltOf(r, b.dir));
};

/** Machinery paint for the side rail, picked by the part's hue: safety yellow, orange, blue, green, red. */
const PAINTS: HSL[] = [
  { h: 45, s: 82, l: 52 },
  { h: 24, s: 78, l: 50 },
  { h: 204, s: 56, l: 46 },
  { h: 140, s: 40, l: 40 },
  { h: 2, s: 64, l: 46 },
];
export const paintOf = (hue: number): HSL => PAINTS[Math.floor(mod(hue, 360) / 72) % PAINTS.length];

const RUBBER = '#2c2932';
const RUBBER_TOP = '#5a5562';
const RUBBER_LOW = '#1d1b21';
export const CLEAT_LIT = '#8f8a98';
const CLEAT_LOW = '#3f3b45';

/** The belt's outline round both drums, `inset` in from its outer face; the top run reaches `lift` past the cell to meet the cut. */
function loopPts(bl: Belt, inset: number, lift: number): P[] {
  const { X0, X1, Y, rl, rr, nx, ny } = bl;
  const phi = Math.atan2(ny, nx);
  const pts: P[] = [
    { x: X0 + rl, y: Y + inset - lift },
    { x: X1 - rr, y: Y + inset - lift },
  ];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * (phi + Math.PI / 2);
    pts.push({ x: X1 - rr + Math.cos(a) * (rr - inset), y: Y + rr + Math.sin(a) * (rr - inset) });
  }
  for (let i = 0; i <= 10; i++) {
    const a = phi + (i / 10) * ((3 * Math.PI) / 2 - phi);
    pts.push({ x: X0 + rl + Math.cos(a) * (rl - inset), y: Y + rl + Math.sin(a) * (rl - inset) });
  }
  return pts;
}

/** The drums: centre, and the belt's outer radius round each. */
const drumsOf = (bl: Belt): [number, number, number][] => [
  [bl.X0 + bl.rl, bl.Y + bl.rl, bl.rl],
  [bl.X1 - bl.rr, bl.Y + bl.rr, bl.rr],
];

/** A paper luggage tag on a string, with the airline's stripe: the baggage-claim joke. */
function luggageTag(g: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  const tip = { x: x + 1.4, y: y + 3.1 };
  g.fillStyle = 'rgb(236 226 206)';
  line(g, x, y, tip.x, tip.y, { w: 0.45, seed, taper: [0.1, 0.1], press: 0.1 });
  const a = 0.38;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const at = (u: number, v: number): P => ({ x: tip.x + u * c - v * s, y: tip.y + u * s + v * c });
  const card = [at(-1.5, 0.6), at(-0.6, 0), at(0.6, 0), at(1.5, 0.6), at(1.5, 4.4), at(-1.5, 4.4)];
  tone(g, card, { h: 42, s: 60, l: 88 }, { depth: 0.5, shade: -16 });
  g.fillStyle = 'hsl(356 70% 48%)';
  path(g, [at(-1.5, 2.3), at(1.5, 2.3), at(1.5, 3.1), at(-1.5, 3.1)]);
  g.fill();
  pen(g, card, seed, 0.3, 0.6, 2);
  g.fillStyle = INK;
  const h = at(0, 1);
  blob(g, h.x, h.y, 0.35, seed, 1, 0.1);
  g.fill();
}

/** A painted arrow on the side rail, the way the belt runs, so a still picture says it too. */
function chevron(g: CanvasRenderingContext2D, x: number, y: number, h: number, dir: number, drop: string, seed: number) {
  const w = h * 0.55 * dir;
  for (const [col, dx, dy] of [
    [drop, 0.35, 0.45],
    ['rgb(246 234 214)', 0, 0],
  ] as const) {
    g.fillStyle = col;
    stroke(
      g,
      [
        { x: x - w / 2 + dx, y: y - h / 2 + dy },
        { x: x + w / 2 + dx, y: y + dy },
        { x: x - w / 2 + dx, y: y + h / 2 + dy },
      ],
      { w: 1.05, seed, taper: [0.1, 0.1], press: 0.1 },
    );
  }
}

/** One conveyor: the steel side frame and its feet, the rubber belt, the painted rail inside it, and the drums' still parts. */
function beltMachine(g: CanvasRenderingContext2D, b: Cut, bl: Belt, tag: boolean): P | null {
  const { pal, seed } = b;
  const { X0, X1, Y, bt, rl, rr, nx, ny } = bl;
  const B = Y + TILE;
  const xl = X0 + rl;
  const xr = X1 - rr;
  const paint = paintOf(b.st.hue);
  const steel = pal.base;
  const back = css(pal.dark, -13, 1, -4);
  g.fillStyle = back;
  g.fillRect(X0 - 3, Y - 3, X1 - X0 + 6, TILE + 6);

  // The side frame: a steel bracket at each end that holds a drum's axle and stands on its own foot, and
  // a short post on every other tile line between. The belt's round ends show against the brackets.
  for (const [i, e] of [-1, 1].entries()) {
    const k = seed + i * 13;
    const out = e < 0 ? X0 - 3 : X1 + 3;
    const inn = e < 0 ? xl + 1.6 : xr - 1.6;
    const [l, r] = e < 0 ? [out, inn] : [inn, out];
    lit(g, poly(l, Y - 3, r, Y - 3, r + (e < 0 ? 1.2 : 0), B + 3, l - (e < 0 ? 0 : 1.2), B + 3), steel, 0.9, -24);
    const low = Y + 2 * (e < 0 ? rl : rr);
    if (B - low > 2.2) dot(g, e < 0 ? X0 + 2.4 : X1 - 2.4, (low + B) / 2 + 0.2, 0.55, k, css(pal.light, -4));
  }
  for (let k = Math.ceil(X0 / TILE) + 1; k * TILE < X1; k++) {
    const x = k * TILE;
    if (k % 2 !== 0 || x < xl + 6 || x > xr - 6) continue;
    lit(g, poly(x - 1.2, Y + 6, x + 1.2, Y + 6, x + 1.8, B + 3, x - 1.8, B + 3), steel, 0.7, -22);
    lit(g, boxPts(x - 3, B - 1.5, 6, 4.5, 0.8, seed + x, 0.1), steel, 0.5, -22);
  }

  // The belt: rubber round both drums. Its outer run is lit when it faces up or left (a top, or a left
  // face) and its return run is in shadow; turned the other way round, so are the tones.
  const outerLit = b.turn === 0 || b.turn === 3;
  g.save();
  path(g, loopPts(bl, 0, 3));
  g.fillStyle = outerLit ? RUBBER : RUBBER_LOW;
  g.fill();
  g.clip();
  g.fillStyle = outerLit ? RUBBER_LOW : RUBBER;
  path(g, poly(X0 - 3, Y + rl + 0.6, X1 + 3, Y + rr + 0.6, X1 + 3, B + 3, X0 - 3, B + 3));
  g.fill();
  if (outerLit) {
    g.fillStyle = RUBBER_TOP;
    g.fillRect(X0 - 3, Y - 3, X1 - X0 + 6, 3.8);
    // Wear on the top run: a long dull sheen, broken where the hand lifted.
    g.fillStyle = 'rgb(128 122 136)';
    for (let x = Math.floor(X0 / 8) * 8; x < xr; x += 8) {
      if (x < xl - 2 || hash2(x, Y, seed) < 0.45) continue;
      line(g, x + 1, Y + 0.35, x + 4 + hash2(x, Y, seed + 1) * 3, Y + 0.35, { w: 0.5, seed: seed + x, taper: [0.3, 0.3], press: 0.1 });
    }
  }
  g.restore();
  // Inside the loop: the dark gap, then the painted side rail between the drum axles, its underside
  // following the return run in.
  path(g, loopPts(bl, bt, 0));
  g.fillStyle = back;
  g.fill();
  const rt = Y + bt + 0.7;
  const ins = (r: number) => r - bt - 0.7;
  const pl = { x: xl + ins(rl) * nx, y: Y + rl + ins(rl) * ny };
  const pr = { x: xr + ins(rr) * nx, y: Y + rr + ins(rr) * ny };
  const rb = (x: number) => pl.y + ((pr.y - pl.y) * (x - pl.x)) / (pr.x - pl.x || 1);
  let hang: P | null = null;
  if (xr - xl > 0.5) {
    lit(g, [{ x: xl, y: rt }, { x: xr, y: rt }, pr, pl], paint, 0.7, -18);
    if (outerLit) {
      // The belt's shadow along the rail's top, and the rail's own lit lip under it.
      g.fillStyle = css(paint, -30, 1, 6);
      g.fillRect(xl, rt, xr - xl, 0.75);
      g.fillStyle = css(paint, 16, 1, -8);
      line(g, xl + 0.5, rt + 1.25, xr - 0.5, rt + 1.2, { w: 0.5, seed: seed + 4, taper: [0.1, 0.4], press: 0.2 });
    }
    // Arrows on tile lines (or one in the middle), bolts on tile centres: keyed to the grid, not the run.
    const ca = xl + rl - bt + 1.6;
    const ce = xr - rr + bt - 1.6;
    const arrows: number[] = [];
    for (let k = Math.ceil(ca / TILE); k * TILE <= ce; k++) arrows.push(k * TILE);
    if (!arrows.length && ce - ca > 1.5) arrows.push((ca + ce) / 2);
    for (const ax of arrows) chevron(g, ax, (rt + rb(ax)) / 2 + 0.3, rb(ax) - rt - 2.2, b.dir, css(paint, -30, 1, 6), seed + ax);
    const bolts: number[] = [];
    for (let k = Math.ceil((ca - 8) / TILE); k * TILE + 8 <= ce; k++) if (k * TILE + 8 >= ca) bolts.push(k * TILE + 8);
    for (const bx of bolts) {
      dot(g, bx, rt + 1.9, 0.62, seed + bx, css(paint, 26, 1, -10));
      dot(g, bx, rb(bx) - 1.4, 0.62, seed + bx + 1, css(paint, 26, 1, -10));
    }
    if (tag && bolts.length) hang = { x: bolts[0], y: rt + 1.9 };
  }

  // The drums' still parts: a lit steel rim round a recessed face. Spokes and hubs turn, so they're live.
  for (const [i, [cx, cy, R]] of drumsOf(bl).entries()) {
    const k = seed + i * 31;
    const rd = R - bt;
    const rim = ovalPts(cx, cy, rd, rd, k, 0.015, 18);
    lit(g, rim, steel, 0.8, -22);
    g.fillStyle = css(pal.dark, 2);
    path(g, ovalPts(cx + 0.2, cy + 0.25, rd - 0.95, rd - 0.95, k + 1, 0.015, 16));
    g.fill();
    g.fillStyle = css(pal.spec, -8);
    stroke(
      g,
      [0, 1, 2].map((j) => {
        const a = Math.PI * (1.1 + j * 0.16) - (b.turn * Math.PI) / 2;
        return { x: cx + Math.cos(a) * (rd - 0.45), y: cy + Math.sin(a) * (rd - 0.45) };
      }),
      { w: 0.55, seed: k, taper: [0.25, 0.35], press: 0.1 },
    );
    pen(g, rim, k, 0.35, 0.85, 3);
  }
  return hang;
}

/** A row under another row: the belt's drive housing, a louvred steel box. */
function housing(g: CanvasRenderingContext2D, b: Cut, r: Run) {
  const { pal, seed } = b;
  const Y = r.y * TILE;
  g.fillStyle = css(pal.dark, -13, 1, -4);
  g.fillRect(r.x0 * TILE - 3, Y - 3, (r.x1 - r.x0 + 1) * TILE + 6, TILE + 6);
  for (let x = r.x0; x <= r.x1; x++) {
    const px = x * TILE;
    const k = seed + x * 17 + r.y * 7;
    lit(g, boxPts(px + 0.7, Y + 0.7, TILE - 1.4, TILE - 1.4, 1.2, k, 0.15), pal.base, 1, -20);
    for (let i = 0; i < 3; i++) {
      const ly = Y + 5 + i * 2.6;
      g.fillStyle = INK;
      line(g, px + 4, ly, px + TILE - 4, ly, { w: 1, seed: k + i, taper: [0.15, 0.15], press: 0.1 });
      g.fillStyle = css(pal.light, -8);
      line(g, px + 4.4, ly + 0.9, px + TILE - 4.4, ly + 0.9, { w: 0.45, seed: k + i + 5, taper: [0.2, 0.2], press: 0.1 });
    }
    for (const [dx, dy] of [
      [2.4, 2.4],
      [TILE - 2.4, 2.4],
      [2.4, TILE - 2.4],
      [TILE - 2.4, TILE - 2.4],
    ])
      dot(g, px + dx, Y + dy, 0.55, k + dx + dy, css(pal.light, -2));
  }
}

/**
 * The conveyor's still parts, inside the block's cut: a belt machine on every row of the belt's own frame
 * that its belt face is open on, turned onto the face the part was rotated to. The luggage tag hangs the
 * world's way down whichever way that is.
 */
export function markConveyor(g: CanvasRenderingContext2D, b: Cut) {
  const f = beltFrame(b);
  LIGHT = turnPt((4 - b.turn) & 3, -1, -1.1);
  let tag: P | null = null;
  g.save();
  g.rotate((b.turn * Math.PI) / 2);
  for (const r of f.runs) {
    g.save();
    clipRun(g, f, r);
    if (topOpen(f, r)) tag ??= beltMachine(g, b, beltOf(r, b.dir), !tag);
    else housing(g, b, r);
    g.restore();
  }
  g.restore();
  LIGHT = { x: -1, y: -1.1 };
  if (tag) {
    const p = turnPt(b.turn, tag.x, tag.y);
    luggageTag(g, p.x, p.y, b.seed + 9);
  }
}

const hubOf = (pal: MetalPalette) =>
  sprite(`belthub|${pal.base.h}|${pal.base.l}`, -1.8, -1.8, 3.6, 3.6, (g) => {
    g.fillStyle = INK;
    blob(g, 0.15, 0.2, 1.25, 3, 1, 0.06);
    g.fill();
    g.fillStyle = css(pal.light, -6);
    blob(g, -0.05, -0.05, 0.85, 4, 1, 0.06);
    g.fill();
    g.fillStyle = css(pal.spec);
    g.fillRect(-0.55, -0.6, 0.45, 0.4);
  });

/** Where the belt's outer face is, `u` px round its lap clockwise from the top run's left end. */
function onLap(bl: Belt, u: number, o: { x: number; y: number; nx: number; ny: number }) {
  const { X0, X1, Y, rl, rr, nx, ny } = bl;
  const top = X1 - rr - (X0 + rl);
  const phi = Math.atan2(ny, nx);
  const arcR = rr * (phi + Math.PI / 2);
  const ax = X1 - rr + rr * nx;
  const ay = Y + rr + rr * ny;
  const bx = X0 + rl + rl * nx;
  const by = Y + rl + rl * ny;
  const bottom = Math.hypot(ax - bx, ay - by);
  let cx = X0 + rl;
  let cy = Y + rl;
  let R = rl;
  let a: number;
  if (u < top) {
    o.x = X0 + rl + u;
    o.y = Y;
    o.nx = 0;
    o.ny = -1;
    return;
  } else if (u < top + arcR) {
    cx = X1 - rr;
    cy = Y + rr;
    R = rr;
    a = -Math.PI / 2 + (u - top) / rr;
  } else if (u < top + arcR + bottom) {
    const t = (u - top - arcR) / bottom;
    o.x = ax + (bx - ax) * t;
    o.y = ay + (by - ay) * t;
    o.nx = nx;
    o.ny = ny;
    return;
  } else a = phi + (u - top - arcR - bottom) / rl;
  o.nx = Math.cos(a);
  o.ny = Math.sin(a);
  o.x = cx + o.nx * R;
  o.y = cy + o.ny * R;
}

const at = { x: 0, y: 0, nx: 0, ny: 0 };

/**
 * The belt's moving parts, at offset (ox, oy): cleats riding the whole lap and the drums' spokes, both at
 * `speed` (the sim's belt speed, px/s, clockwise round the block for positive) on sim frame `frame`, on
 * the face `turn` quarter turns clockwise from the top. Clipped to the block's cut, so nothing moving
 * ever pokes past the shape that's solid.
 */
export function drawBelts(
  s: CanvasRenderingContext2D,
  belts: readonly Belt[],
  loops: readonly EdgeP[][],
  ox: number,
  oy: number,
  frame: number,
  speed: number,
  pal: MetalPalette,
  hue: number,
  turn = 0,
) {
  const dir = speed < 0 ? -1 : 1;
  const travel = (frame * Math.abs(speed)) / 60;
  const c0 = COS[turn];
  const s0 = SIN[turn];
  s.save();
  trace(s, loops, ox, oy);
  s.clip();
  for (const bl of belts) {
    // In the belt's own frame, turned onto its face.
    s.save();
    s.translate(ox, oy);
    s.rotate((turn * Math.PI) / 2);
    const n = Math.round(bl.lap / bl.pitch);
    const ph = mod(dir * travel, bl.pitch);
    const o = 0.75;
    const i = bl.bt - 0.35;
    const lean = dir * 0.4;
    // Two passes, lit run then return run, so each is one fill.
    for (const lit of [true, false]) {
      s.beginPath();
      for (let c = 0; c < n; c++) {
        onLap(bl, mod(c * bl.pitch + ph, bl.lap), at);
        // Lit where the belt faces the world's upper left.
        if (0.55 * (at.nx * c0 - at.ny * s0) + 0.83 * (at.nx * s0 + at.ny * c0) < 0.2 !== lit) continue;
        const tx = -at.ny;
        const ty = at.nx;
        const x = at.x;
        const y = at.y;
        const ax = x - at.nx * o + tx * lean;
        const ay = y - at.ny * o + ty * lean;
        const bx = x - at.nx * i - tx * lean;
        const by = y - at.ny * i - ty * lean;
        s.moveTo(ax - tx * 0.55, ay - ty * 0.55);
        s.lineTo(ax + tx * 0.55, ay + ty * 0.55);
        s.lineTo(bx + tx * 0.4, by + ty * 0.4);
        s.lineTo(bx - tx * 0.4, by - ty * 0.4);
        s.closePath();
      }
      s.fillStyle = lit ? CLEAT_LIT : CLEAT_LOW;
      s.fill();
    }
    // Spokes: three, one painted, so a turn reads even at speed. A drum too small for them shows its hub.
    for (const painted of [false, true]) {
      s.beginPath();
      for (const [cx0, cy0, R] of drumsOf(bl)) {
        const rd = R - bl.bt;
        if (rd < 2.2) continue;
        const spin = (dir * travel) / rd + cx0 * 0.13;
        const cx = cx0;
        const cy = cy0;
        const r1 = rd - 0.9;
        for (let k = painted ? 0 : 1; k < (painted ? 1 : 3); k++) {
          const a = spin + (k * Math.PI * 2) / 3;
          const c = Math.cos(a);
          const sn = Math.sin(a);
          s.moveTo(cx - sn * 0.6, cy + c * 0.6);
          s.lineTo(cx + c * r1 - sn * 0.35, cy + sn * r1 + c * 0.35);
          s.lineTo(cx + c * r1 + sn * 0.35, cy + sn * r1 - c * 0.35);
          s.lineTo(cx + sn * 0.6, cy - c * 0.6);
          s.closePath();
        }
      }
      s.fillStyle = painted ? css(paintOf(hue)) : css(pal.base, 4);
      s.fill();
    }
    s.restore();
    // Hubs go on in the world's frame, so their glint stays upper left.
    const hub = hubOf(pal);
    for (const [cx, cy] of drumsOf(bl)) {
      const w = turnPt(turn, cx, cy);
      stamp(s, hub, w.x + ox, w.y + oy);
    }
  }
  s.restore();
}

// ---------------------------------------------------------------------------------------------- jelly

/**
 * A slab of gelatin in three cel tones: its deep shade along the far edges, then the band of light that
 * comes out through the jelly just inside them, then the body. A hard white window of gloss on every top,
 * and a few bubbles caught in it.
 */
export function markJelly(g: CanvasRenderingContext2D, b: Cut) {
  const { T, seed } = b;
  g.fillStyle = T.light;
  trace(g, b.loops, -0.9, -1.2);
  g.fill();
  g.fillStyle = T.base;
  trace(g, b.loops, -2.1, -3.3);
  g.fill();
  for (const [x, y] of b.cells) {
    if (hash2(x, y, seed + 2) > 0.6) continue;
    const bx = x * TILE + 4 + hash2(x, y, seed + 3) * 8;
    const by = y * TILE + 7 + hash2(x, y, seed + 4) * 5;
    const br = 0.9 + hash2(x, y, seed + 5) * 0.8;
    g.fillStyle = T.light;
    blob(g, bx, by, br + 0.55, seed + x, 1, 0.1);
    g.fill();
    g.fillStyle = T.base;
    blob(g, bx + 0.3, by + 0.35, br, seed + y, 1, 0.1);
    g.fill();
    g.fillStyle = 'rgb(255 250 252)';
    g.fillRect(bx - br * 0.6, by - br * 0.7, 0.55, 0.5);
  }
  for (const r of b.runs) {
    if (!topOpen(b, r)) continue;
    const X0 = r.x0 * TILE;
    const X1 = (r.x1 + 1) * TILE;
    const Y = r.y * TILE;
    const k = seed + r.y * 31 + r.x0;
    const reach = Math.min(X1 - X0 - 7, 7 + (X1 - X0) * 0.38);
    g.fillStyle = 'rgb(255 251 253)';
    // The window: a hard bar under the top, turning down the lit side, then a short dash and a dot.
    stroke(
      g,
      [
        { x: X0 + 2.3, y: Y + 7.2 },
        { x: X0 + 2.5, y: Y + 4.2 },
        { x: X0 + 4.4, y: Y + 2.7 },
        { x: X0 + reach, y: Y + 2.6 },
      ],
      { w: 1.9, seed: k, taper: [0.3, 0.25], press: 0.1 },
    );
    if (X1 - X0 > 20) line(g, X0 + reach + 2.4, Y + 2.65, X0 + reach + 5.4, Y + 2.7, { w: 1.4, seed: k + 1, taper: [0.25, 0.25], press: 0.1 });
    blob(g, X1 - 4.2, Y + 3.6, 0.7, k + 2, 1, 0.1);
    g.fill();
  }
}

// ------------------------------------------------------------------------------------------------ goo

/**
 * Tar poured over a block: a lighter fresh layer on every top that runs down the face in thick tongues
 * with a hard shadow under them, bubbles in the dark body and popped craters on top, wet glints.
 */
export function markGoo(g: CanvasRenderingContext2D, b: Cut) {
  const { T, seed } = b;
  for (const [x, y] of b.cells) {
    if (hash2(x, y, seed + 7) > 0.7) continue;
    const bx = x * TILE + 3 + hash2(x, y, seed + 8) * 10;
    const by = y * TILE + 9 + hash2(x, y, seed + 9) * 4;
    const br = 0.8 + hash2(x, y, seed + 10) * 1;
    g.fillStyle = T.base;
    blob(g, bx, by, br + 0.6, seed + x, 1, 0.12);
    g.fill();
    g.fillStyle = T.shade;
    blob(g, bx + 0.3, by + 0.35, br, seed + y, 1, 0.12);
    g.fill();
    g.fillStyle = T.light;
    g.fillRect(bx - br * 0.7, by - br * 0.75, 0.6, 0.45);
  }
  for (const r of b.runs) {
    const Y = r.y * TILE;
    for (let x = r.x0; x <= r.x1; x++) {
      if (b.has(x, r.y - 1)) continue;
      const px = x * TILE;
      const l = b.has(x - 1, r.y) && !b.has(x - 1, r.y - 1) ? px : px - 3;
      const e = b.has(x + 1, r.y) && !b.has(x + 1, r.y - 1) ? px + TILE : px + TILE + 3;
      // The layer's lower edge sags between tongues; tongues fall at keyed spots on the tile.
      const lay: P[] = [
        { x: l, y: Y - 3 },
        { x: e, y: Y - 3 },
      ];
      for (let sx = e; sx >= l; sx -= 1) lay.push({ x: sx, y: Y + 3.4 + Math.sin(sx * 0.55 + seed) * 0.35 });
      for (const [col, dx, dy] of [
        [T.shade, 0.5, 0.9],
        [T.light, 0, 0],
      ] as const) {
        g.fillStyle = col;
        path(
          g,
          lay.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        );
        g.fill();
        for (let i = 0; i < 2; i++) {
          if (hash2(x * 2 + i, r.y, seed + 11) < 0.3) continue;
          const tx = px + 3 + i * 7 + hash2(x + i, r.y, seed + 12) * 3;
          const len = 2.5 + hash2(x, r.y + i, seed + 13) * 5.5;
          const w = 2.1 + hash2(x + i, r.y + i, seed + 14) * 1.2;
          stroke(
            g,
            [
              { x: tx + dx, y: Y + 2.5 + dy },
              { x: tx + dx, y: Y + 3 + len * 0.6 + dy },
              { x: tx + dx + 0.1, y: Y + 3 + len + dy },
            ],
            { w, seed: seed + x + i, taper: [0, 0.18], press: 0 },
          );
          blob(g, tx + dx + 0.1, Y + 3 + len + dy - 0.2, w * 0.5, seed + i, 1, 0.12);
          g.fill();
          if (col === T.light) {
            g.fillStyle = 'rgb(255 252 240)';
            line(g, tx - w * 0.22, Y + 3.2 + len * 0.4, tx - w * 0.22, Y + 2.8 + len * 0.85, { w: 0.5, seed: seed + i, taper: [0.2, 0.2], press: 0 });
            g.fillStyle = col;
          }
        }
      }
      // A popped bubble on top every so often, and the wet glint along the layer.
      if (hash2(x, r.y, seed + 15) < 0.4) {
        const cx = px + 4 + hash2(x, r.y, seed + 16) * 8;
        g.fillStyle = T.shade;
        blob(g, cx, Y + 1.1, 1.1, seed + x, 0.55, 0.1);
        g.fill();
        g.fillStyle = 'rgb(255 252 240)';
        g.fillRect(cx - 0.9, Y + 0.25, 0.6, 0.35);
      }
      g.fillStyle = 'rgb(255 252 240)';
      if (hash2(x, r.y, seed + 17) < 0.7)
        line(g, px + 1.5 + hash2(x, r.y, seed + 18) * 3, Y + 0.8, px + 6 + hash2(x, r.y, seed + 19) * 4, Y + 0.75, {
          w: 0.7,
          seed: seed + x,
          taper: [0.25, 0.4],
          press: 0.1,
        });
    }
  }
}

/** Strings of tar sagging under every open bottom, and short beads at the low points. Thin, so decoration. */
export function overGoo(g: CanvasRenderingContext2D, b: Cut) {
  const { T, seed } = b;
  for (const [x, y] of b.cells) {
    if (b.has(x, y + 1)) continue;
    const B = (y + 1) * TILE - 0.6;
    const px = x * TILE;
    if (hash2(x, y, seed + 20) < 0.55) {
      const a = px + 2 + hash2(x, y, seed + 21) * 3;
      const e = a + 5 + hash2(x, y, seed + 22) * 5;
      const sag = 2 + hash2(x, y, seed + 23) * 2.2;
      const pts: P[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        pts.push({ x: a + (e - a) * t, y: B + 4 * sag * t * (1 - t) });
      }
      g.fillStyle = T.ink;
      stroke(g, pts, { w: 0.85, seed: seed + x, taper: [0.05, 0.05], press: 0.3 });
      g.fillStyle = T.base;
      stroke(g, pts, { w: 0.4, seed: seed + x + 1, taper: [0.1, 0.1], press: 0.3 });
    }
    const dx = px + 11 + hash2(x, y, seed + 24) * 3;
    const h = 1.6 + hash2(x, y, seed + 25) * 1.4;
    g.fillStyle = T.ink;
    stroke(
      g,
      [
        { x: dx, y: B - 0.4 },
        { x: dx, y: B + h },
      ],
      { w: 2, seed: seed + y, taper: [0, 0.3], press: 0 },
    );
    g.fillStyle = T.base;
    stroke(
      g,
      [
        { x: dx - 0.1, y: B - 0.6 },
        { x: dx - 0.1, y: B + h - 0.4 },
      ],
      { w: 1.1, seed: seed + y, taper: [0, 0.35], press: 0 },
    );
  }
}
