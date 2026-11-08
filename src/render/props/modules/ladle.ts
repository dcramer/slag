import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { T_SOLID, tileAt } from '../../../sim/level';
import {
  LADLE_OFF,
  LADLE_POUR,
  LADLE_SET,
  LADLE_WARN,
  ladleCycle,
  ladleTilt,
  landed,
  type ModuleOf,
  SPILL_H,
  spillReach,
  spillRect,
  STREAM_W,
} from '../../../sim/props';
import { blob, inkFor, line, type P } from '../../ink';
import { boxPts, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { glowDot, light, type RC } from '../../kit';
import { BACKDROP, beamOf, defineArt, type DrawCtx } from '../common';

/**
 * A ladle of molten slag (sim/props/modules/ladle.ts). A riveted bucket with a pouring lip, slung in a
 * bail from a crane hook: on a chain from the ceiling, or, with nothing over it, from the crossbeam of a
 * little gantry standing behind it (BACKDROP, thin legs, nowhere to stand). It eases over in the warning
 * as the lip brightens and smokes, pours a rope of slag straight down exactly as far as the sim's beam
 * reaches, and the spill runs out along the floor on the rect that burns, then crusts dark after the
 * pour and fades. Only the slag glows: it's the hot thing.
 */

type Ladle = ModuleOf<'ladle'>;

const SHELL: HSL = { h: 20, s: 14, l: 30 };
const BAND: HSL = { h: 24, s: 22, l: 42 };
const IRON: HSL = { h: 215, s: 8, l: 34 };
const FRAME: HSL = { h: 44, s: 46, l: 44 };
const SLAG: HSL = { h: 24, s: 100, l: 54 };
const HOT: HSL = { h: 40, s: 100, l: 70 };
const CRUST: HSL = { h: 18, s: 18, l: 22 };

/** Turn the ladle's bowl to: a little short of a right angle, so the lip is the lowest point. */
const TIP = 1.45;

/** The bowl in its own frame (px, pivot at the trunnions, upright, lip toward +x): a tapered bucket. */
const BOWL = { top: -9, bottom: 9, half: 10, foot: 7 };
/** The pouring lip's tip in the bowl's frame. */
const LIP: P = { x: BOWL.half + 3.5, y: BOWL.top - 1 };

/** The trunnions: where the bowl turns, placed so the tipped lip lands on the stream's origin. */
function pivot(m: Ladle): P {
  const a = TIP * m.dir;
  const lx = LIP.x * m.dir;
  return { x: m.at[0] - (lx * Math.cos(a) - LIP.y * Math.sin(a)), y: m.at[1] - (lx * Math.sin(a) + LIP.y * Math.cos(a)) };
}

/** The upright bowl, baked: shell, two bands, rivets and the lip, mirrored for `dir`. */
function bowl(dir: 1 | -1) {
  return sprite(`ladle|bowl|${dir}`, -18, -14, 36, 26, (g) => {
    const { top, bottom, half, foot } = BOWL;
    const shell = poly(-half * dir, top, half * dir, top, (half + 3.5) * dir, top - 1, half * dir, top + 2.5, foot * dir, bottom, -foot * dir, bottom);
    part(g, shell, SHELL, 3, { depth: 1.4, thin: 0.5, thick: 1.2 });
    for (const y of [top + 4.5, bottom - 4]) {
      const k = (y - top) / (bottom - top);
      const w = half - (half - foot) * k;
      part(g, boxPts(-w - 0.4, y - 1.1, 2 * w + 0.8, 2.2, 0.5, y, 0.1), BAND, y, { depth: 0.4, thin: 0.3, thick: 0.6 });
      for (let x = -w + 2.5; x < w - 1; x += 4.5) {
        g.fillStyle = inkFor(BAND);
        blob(g, x, y, 0.45, x + y, 1, 0.1);
        g.fill();
      }
    }
    // The trunnion boss each side of the pivot.
    part(g, ovalPts(0, 0, 2.4, 2.4, 9, 0.03, 10), IRON, 9, { depth: 0.5, thin: 0.3, thick: 0.7 });
  });
}

/** The slag's surface at the bowl's mouth: a hot band, brighter as it comes to the lip. */
function surface(s: CanvasRenderingContext2D, g: CanvasRenderingContext2D, px: number, py: number, a: number, dir: 1 | -1, heat: number) {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const at = (x: number, y: number): P => ({ x: px + x * c - y * sn, y: py + x * sn + y * c });
  const { top, half } = BOWL;
  const pts = [at(-half * dir * 0.92, top + 0.6), at(half * dir * 0.92, top + 0.6), at(half * dir * 0.9, top + 2.2), at(-half * dir * 0.9, top + 2.2)];
  s.fillStyle = css(SLAG, -6 + heat * 10);
  path(s, pts);
  s.fill();
  const lip = at(LIP.x * dir, LIP.y);
  glowDot(g, lip.x, lip.y, 6 + heat * 8, SLAG, 0.35 + heat * 0.5);
}

/** The bail: a U of round bar from the trunnions up to the hook's eye. */
function bail(s: CanvasRenderingContext2D, p: P, hookY: number) {
  const ink = inkFor(IRON);
  for (const k of [-1, 1]) {
    s.fillStyle = ink;
    line(s, p.x + k * 11.5, p.y, p.x + k * 3, hookY + 3, { w: 1.9, seed: 4 + k, taper: [0, 0], press: 0.05 });
    s.fillStyle = css(IRON, 10);
    line(s, p.x + k * 11.5, p.y, p.x + k * 3, hookY + 3, { w: 1.1, seed: 6 + k, taper: [0, 0], press: 0 });
  }
  s.fillStyle = ink;
  line(s, p.x - 3.4, hookY + 3, p.x + 3.4, hookY + 3, { w: 2, seed: 8, taper: [0, 0], press: 0.05 });
  // The hook itself, closed round the bail.
  part(s, poly(p.x - 2.6, hookY + 3.5, p.x - 2.2, hookY - 2, p.x + 1.8, hookY - 2.4, p.x + 2.6, hookY + 1, p.x + 0.6, hookY + 3.8), IRON, 11, {
    depth: 0.4,
    thin: 0.3,
    thick: 0.7,
  });
}

/** A chain of links, top to bottom. */
function chain(s: CanvasRenderingContext2D, x: number, y0: number, y1: number) {
  const ink = inkFor(IRON);
  for (let y = y0, i = 0; y < y1 - 1; y += 3.2, i++) {
    s.fillStyle = ink;
    if (i % 2) line(s, x, y, x, y + 3.4, { w: 1.6, seed: i, taper: [0, 0], press: 0 });
    else {
      blob(s, x, y + 1.6, 1.6, i, 1.5, 0.05);
      s.fill();
      s.fillStyle = css(IRON, 4);
      blob(s, x, y + 1.6, 0.7, i + 1, 1.5, 0.05);
      s.fill();
    }
  }
}

/** The gantry a ceilingless ladle hangs in: two splayed lattice legs and a crossbeam, from the floor up. */
function gantry(span: number, rise: number) {
  return sprite(`ladle|gantry|${span | 0}|${rise | 0}`, -span / 2 - 6, -rise - 6, span + 12, rise + 8, (g) => {
    const ink = inkFor(FRAME);
    const leg = (x0: number, x1: number, sd: number) => {
      for (const o of [-1.4, 1.4]) {
        g.fillStyle = ink;
        line(g, x0 + o, 0, x1 + o, -rise + 2, { w: 1.5, seed: sd + o, taper: [0, 0], press: 0.05 });
        g.fillStyle = css(FRAME, -6);
        line(g, x0 + o, 0, x1 + o, -rise + 2, { w: 0.8, seed: sd + o + 1, taper: [0, 0], press: 0 });
      }
      for (let k = 1; k < 6; k++) {
        const u0 = (k - 1) / 6;
        const u1 = k / 6;
        tick(g, x0 + (x1 - x0) * u0 - 1.2, -rise * u0, x0 + (x1 - x0) * u1 + 1.2, -rise * u1, 0.5, sd + k, ink);
      }
      part(g, boxPts(x0 - 3.5, -2, 7, 2.2, 0.4, sd, 0.1), FRAME, sd, { depth: 0.3, thin: 0.3, thick: 0.6 });
    };
    leg(-span / 2, -span / 2 + 4, 1);
    leg(span / 2, span / 2 - 4, 7);
    part(g, boxPts(-span / 2 + 1, -rise - 1, span - 2, 4, 0.6, 13, 0.15), FRAME, 13, { depth: 0.6, thin: 0.4, thick: 0.9 });
    g.fillStyle = css(FRAME, 16);
    g.fillRect(-span / 2 + 3, -rise - 0.6, span - 6, 0.7);
  });
}

/** The ladle's art scale (a landmark hangs bigger ones), and its pivot and hook in world px. The lip stays on the stream. */
function frame(m: Ladle, ox: number, oy: number) {
  const k = m.size ?? 1;
  const p0 = pivot(m);
  const lx = m.at[0] + ox;
  const ly = m.at[1] + oy;
  const p = { x: lx + (p0.x - m.at[0]) * k, y: ly + (p0.y - m.at[1]) * k };
  return { k, lx, ly, p, hy: p.y - 17 * k };
}

/** Draw on `g` about the pivot `p` at scale `k`. */
function scaled(g: CanvasRenderingContext2D, p: P, k: number, draw: () => void) {
  g.save();
  g.translate(p.x, p.y);
  g.scale(k, k);
  g.translate(-p.x, -p.y);
  draw();
  g.restore();
}

defineArt<'ladle'>({
  type: 'ladle',
  layer: BACKDROP,
  draw: (rc, m, d) => {
    if (m.hang > 0) return;
    const f = frame(m, d.off[0], d.off[1]);
    const floor = m.at[1] + m.drop + d.off[1];
    // Its legs stand at the ends of the spill, on the floor the recipe found under both (gen/setpieces/factory.ts
    // `ladleSpots`), the bowl hanging between them.
    const l = m.at[0] + d.off[0] - m.spill[0];
    const r = m.at[0] + d.off[0] + m.spill[1];
    stamp(rc.s, gantry(r - l, floor - f.hy + 4), (l + r) / 2, floor);
  },
});

defineArt<'ladle'>({
  type: 'ladle',
  layer: 2,
  draw: (rc, m, d) => drawLadle(rc.s, rc, m, d),
});

function drawLadle(s: CanvasRenderingContext2D, rc: RC, m: Ladle, d: DrawCtx) {
  const c = ladleCycle(m, rc.frame, d.r.phase);
  const tilt = ladleTilt(m, rc.frame, d.r.phase);
  const { k, p, hy } = frame(m, d.off[0], d.off[1]);
  // Whatever it hangs from: the chain up to the ceiling, or a short one to the gantry's beam.
  chain(s, p.x, m.hang > 0 ? m.at[1] + d.off[1] - m.hang : hy - 6, hy - k);
  // In the warning it shivers in its bail as it goes over.
  const shake = c.seg === LADLE_WARN ? Math.sin(rc.frame * 1.3) * 0.025 : 0;
  const a = (tilt * TIP + shake) * m.dir;
  const heat = c.seg === LADLE_WARN ? c.t / Math.max(1, c.len) : c.seg === LADLE_POUR ? 1 : c.seg === LADLE_SET ? 0.6 : 0.15;
  // The bail, bowl and slag, drawn about the pivot at the ladle's own size.
  scaled(s, p, k, () => {
    bail(s, p, p.y - 17);
    s.save();
    s.translate(p.x, p.y);
    s.rotate(a);
    stamp(s, bowl(m.dir));
    s.restore();
    scaled(rc.g, p, k, () => surface(s, rc.g, p.x, p.y, a, m.dir, heat));
  });
  if (c.seg === LADLE_WARN) smoke(rc.bg, p.x + m.dir * 8 * k, p.y - 12 * k, c.t);
  const lx = m.at[0] + d.off[0];
  const ly = m.at[1] + d.off[1];
  const beam = beamOf(d.o, d.r, d.mi);
  if (c.seg === LADLE_POUR && beam) {
    stream(s, rc.g, lx, ly, beam.len, rc.frame);
    light(rc, lx, ly + beam.len * 0.6, 60, SLAG, 0.6);
  }
  if ((c.seg === LADLE_POUR || c.seg === LADLE_SET) && beam && landed(m, beam.len, beam.hit)) {
    const r = spillRect(m, spillReach(m, rc.frame, d.r.phase), d.off[0], d.off[1]);
    const cool = c.seg === LADLE_SET ? c.t / Math.max(1, c.len) : 0;
    spill(s, rc.g, r, cool, rc.frame);
    light(rc, lx, r.y, 40 + r.w * 0.5, SLAG, 0.5 * (1 - cool * 0.5));
  }
  // After the pour, the crust it left goes dark and fades, if it spilled on its floor.
  const lv = d.o.level;
  if (c.seg === LADLE_OFF && c.t < 60 && lv && tileAt(lv, Math.floor(m.at[0] / TILE), Math.floor((m.at[1] + m.drop + 1) / TILE)) === T_SOLID)
    crust(s, spillRect(m, 1, d.off[0], d.off[1]), 1 - c.t / 60, m.seed);
}

/** The pour: a rope of slag from the lip down `len` px, a white-hot core, wobbling as it falls. */
function stream(s: CanvasRenderingContext2D, g: CanvasRenderingContext2D, x: number, y: number, len: number, f: number) {
  const pts: P[] = [];
  const n = Math.max(2, Math.ceil(len / 6));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push({ x: x + Math.sin(f * 0.35 + u * 7) * 0.5 * u, y: y + len * u });
  }
  s.fillStyle = css(SLAG, -10);
  for (let i = 1; i < pts.length; i++) line(s, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, { w: STREAM_W, seed: i, taper: [0, 0], press: 0 });
  s.fillStyle = css(HOT);
  for (let i = 1; i < pts.length; i++) line(s, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, { w: STREAM_W * 0.4, seed: i + 30, taper: [0, 0], press: 0 });
  for (let i = 0; i <= n; i += 2) glowDot(g, pts[i].x, pts[i].y, 9, SLAG, 0.5);
  // Splashes where it lands.
  for (let k = 0; k < 4; k++) {
    const u = ((f * 0.09 + k * 0.27) % 1) * 1;
    const sx = x + (k % 2 ? 1 : -1) * (2 + u * 7);
    const sy = y + len - Math.sin(u * Math.PI) * 5;
    s.fillStyle = css(HOT, -10, 1 - u);
    blob(s, sx, sy, 0.9, k, 1, 0.1);
    s.fill();
  }
}

/** The spill on the floor: a molten skin on the rect that burns, its top edge rolling, darkening as it sets. */
function spill(s: CanvasRenderingContext2D, g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, cool: number, f: number) {
  if (r.w <= 0) return;
  const top: P[] = [];
  const n = Math.max(2, Math.ceil(r.w / 4));
  for (let i = 0; i <= n; i++) top.push({ x: r.x + (r.w * i) / n, y: r.y + 1 + Math.sin(f * 0.12 + i * 1.7) * 0.5 * (1 - cool) });
  const pts = [...top, { x: r.x + r.w, y: r.y + SPILL_H }, { x: r.x, y: r.y + SPILL_H }];
  s.fillStyle = css(SLAG, -12 - cool * 14);
  path(s, pts);
  s.fill();
  s.fillStyle = css(HOT, 0, 0.9 - cool * 0.7);
  for (let i = 1; i < top.length; i++) line(s, top[i - 1].x, top[i - 1].y + 0.4, top[i].x, top[i].y + 0.4, { w: 0.9, seed: i, taper: [0, 0], press: 0 });
  for (let x = r.x + 3; x < r.x + r.w - 2; x += 7) glowDot(g, x, r.y + 2, 7, SLAG, 0.45 * (1 - cool * 0.6));
}

/** The crust a spill leaves: a dark, cracked skin that fades out. */
function crust(s: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, a: number, seed: number) {
  s.fillStyle = css(CRUST, 0, a);
  path(s, poly(r.x + 1, r.y + SPILL_H, r.x + 2, r.y + 2.2, r.x + r.w - 2, r.y + 2, r.x + r.w - 1, r.y + SPILL_H));
  s.fill();
  for (let x = r.x + 4; x < r.x + r.w - 3; x += 6) tick(s, x, r.y + 2.4, x + 1.5 + ((seed + x) % 3) * 0.5, r.y + 3.6, 0.4, x, inkFor(CRUST, a));
}

/** Smoke curling off the lip as it comes over: on the background layer, where soft things belong. */
function smoke(bg: CanvasRenderingContext2D, x: number, y: number, t: number) {
  for (let k = 0; k < 3; k++) {
    const u = ((t * 0.02 + k / 3) % 1) * 1;
    bg.fillStyle = css({ h: 25, s: 6, l: 46 }, 0, 0.35 * (1 - u));
    blob(bg, x + Math.sin(u * 5 + k) * 2, y - u * 16, 1.8 + u * 3, k + 7, 1, 0.3);
    bg.fill();
  }
}
