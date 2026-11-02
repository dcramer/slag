import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import type { DecoKind, ModuleOf } from '../../../sim/props';
import { rotorAngles } from '../../../sim/props/modules/rotor';
import { blob, line, type P, stroke } from '../../ink';
import { boxPts, ovalPts, path, pen, poly, sprite, stamp, tone } from '../../ink-props';
import type { RC } from '../../kit';
import type { DrawCtx } from '../common';

/**
 * The backdrop shells behind a stage concept's landmark (docs/SETPIECES.md §4): a manor's facade behind its
 * rooms, a gantry, the flywheel rim behind the great wheel, a headframe, a ship's ribs, a billboard and a
 * clock dial. They paint on BACKDROP, behind the terrain, and nothing in them is solid: so they are open
 * lattice or flat tones pulled toward the sky's haze, with a thin pen in a dark of their own color, never a
 * slab you'd try to stand on. Each stands on the bottom of its box, which is the ground the concept levelled.
 * Theme skins (../skins/<theme>.ts) can draw any of them their own way; these are what every theme gets.
 */

type Deco = ModuleOf<'deco'>;
type Shell = (rc: RC, m: Deco, d: DrawCtx) => void;

/** Share of the way a shell's tones go toward the sky's haze: far enough to sit back, not so far it vanishes. */
const HAZE = 0.32;

/** A shell's palette under this level's sky: each tone hazed, and a pen that's a dark of the wood or metal, not black. */
interface Tones {
  key: string;
  c: (base: HSL, dl?: number) => string;
  hsl: (base: HSL) => HSL;
  ink: (base: HSL) => string;
}

function tonesOf(d: DrawCtx): Tones {
  const fog = d.o.level?.theme.fog;
  // Haze takes color and contrast, not hue: mixing hues toward a blue sky would turn timber green.
  const hsl = (c: HSL) => (fog ? { h: c.h, s: c.s * (1 - HAZE * 1.4), l: c.l + (fog.l - c.l) * HAZE } : c);
  return {
    key: fog ? `${fog.h | 0},${fog.s | 0},${fog.l | 0}` : '-',
    hsl,
    c: (base, dl = 0) => css(hsl(base), dl),
    ink: (base) => css({ h: base.h, s: base.s * 0.5, l: Math.max(6, hsl(base).l * 0.28) }),
  };
}

const WOOD: HSL = { h: 26, s: 34, l: 34 };
const STEEL: HSL = { h: 212, s: 9, l: 46 };
const BRASS: HSL = { h: 42, s: 48, l: 44 };
const PLASTER: HSL = { h: 36, s: 16, l: 46 };
const SLATE: HSL = { h: 240, s: 10, l: 26 };
const GLASS: HSL = { h: 228, s: 24, l: 15 };
const HAZARD: HSL = { h: 46, s: 88, l: 50 };

/** A member drawn with the backdrop pen: a dark ribbon, the member's tone over it, thinner than anything in play. */
function member(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, base: HSL, t: Tones, seed: number) {
  g.fillStyle = t.ink(base);
  line(g, ax, ay, bx, by, { w: w + 0.9, seed, taper: [0, 0], press: 0.05 });
  g.fillStyle = t.c(base);
  line(g, ax, ay, bx, by, { w, seed: seed + 1, taper: [0, 0], press: 0.05 });
}

/** An open truss between two points: two chords and a zigzag of web between them. */
function truss(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, width: number, base: HSL, t: Tones, seed: number) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const nx = -uy * (width / 2);
  const ny = ux * (width / 2);
  const n = Math.max(1, Math.round(len / (width * 1.1)));
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const k = i & 1 ? 1 : -1;
    member(g, ax + (bx - ax) * t0 + nx * k, ay + (by - ay) * t0 + ny * k, ax + (bx - ax) * t1 - nx * k, ay + (by - ay) * t1 - ny * k, 0.8, base, t, seed + i);
  }
  for (const k of [-1, 1]) member(g, ax + nx * k, ay + ny * k, bx + nx * k, by + ny * k, 1.5, base, t, seed + 50 + k);
}

/** A flat shape in a hazed tone, penned thin. */
function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Tones, seed: number, depth = 1) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, 0.35, 0.9, 3, t.ink(base));
}

/** A foot plate under a leg, so it bears on the ground rather than stopping short of it. */
function foot(g: CanvasRenderingContext2D, x: number, y: number, w: number, base: HSL, t: Tones, seed: number) {
  flat(g, boxPts(x - w / 2, y - 2.5, w, 2.5, 0.5, seed), base, t, seed, 0.4);
}

/** A manor wing's front, behind its rooms: gable and slates, a timber frame, tall windows, a chimney, a stone plinth. */
const facade: Shell = (rc, m, d) => {
  const t = tonesOf(d);
  const { w, h } = m;
  const sd = m.seed % 8;
  const sp = sprite(`shell|facade|${w}|${h}|${sd}|${t.key}`, -6, -14, w + 12, h + 15, (g) => {
    const rh = Math.min(h * 0.3, w * 0.36);
    // Chimney first: the roof overlaps its foot.
    const cx = w * (0.62 + 0.16 * hash2(sd, 1, 1));
    flat(g, boxPts(cx, -10, 7, rh, 0.6, sd), { h: 10, s: 30, l: 32 }, t, sd + 1, 0.8);
    const roof = poly(-5, rh, w / 2, -2, w + 5, rh);
    flat(g, roof, SLATE, t, sd + 2, 1.4);
    g.save();
    path(g, roof);
    g.clip();
    for (let y = 3, i = 0; y < rh; y += 3.6, i++) {
      g.fillStyle = t.ink(SLATE);
      line(g, -5, y, w + 5, y, { w: 0.55, seed: i, taper: [0, 0], press: 0 });
      for (let x = (i & 1) * 3; x < w + 5; x += 6) line(g, x, y, x, y + 3.6, { w: 0.4, seed: x + i, taper: [0, 0], press: 0 });
    }
    g.restore();
    const wall = boxPts(1, rh, w - 2, h - rh, 0.8, sd + 3, 0.15);
    flat(g, wall, PLASTER, t, sd + 4, 0.6);
    g.save();
    path(g, wall);
    g.clip();
    // Wallpaper: faint stripes, the only pattern a back wall gets.
    g.fillStyle = t.c(PLASTER, -4);
    for (let x = 4; x < w; x += 6) g.fillRect(x, rh, 1.4, h - rh);
    // Tall windows, one per bay on every storey, some with a pane gone.
    for (let y = rh + 6; y + 18 < h - 4; y += 32) {
      for (let x = 7; x + 9 < w - 3; x += 24) {
        const win: P[] = [{ x, y: y + 18 }];
        for (let i = 0; i <= 8; i++) win.push({ x: x + 4.5 - Math.cos((i / 8) * Math.PI) * 4.5, y: y + 4.5 - Math.sin((i / 8) * Math.PI) * 4.5 });
        win.push({ x: x + 9, y: y + 18 });
        flat(g, win, GLASS, t, x + y, 0.3);
        g.fillStyle = t.c(WOOD);
        line(g, x + 4.5, y + 1, x + 4.5, y + 18, { w: 0.8, seed: x, taper: [0, 0], press: 0 });
        line(g, x, y + 10, x + 9, y + 10, { w: 0.8, seed: y, taper: [0, 0], press: 0 });
        if (hash2(x, y, sd) < 0.3) {
          g.fillStyle = t.c(PLASTER, 6);
          path(g, poly(x + 5.5, y + 11, x + 8.5, y + 11, x + 8.5, y + 17, x + 7, y + 13.5));
          g.fill();
        }
        flat(g, boxPts(x - 1.5, y + 18, 12, 2, 0.4, x + 1), WOOD, t, x + 2, 0.3);
      }
    }
    g.restore();
    // The frame: posts and rails on the same storeys the rooms have.
    for (let x = 1; x <= w - 1; x += 24) member(g, x, rh, x, h, 2.2, WOOD, t, x);
    member(g, w - 1, rh, w - 1, h, 2.2, WOOD, t, w);
    for (let y = rh; y < h - 4; y += 32) member(g, 0, y, w, y, 2.4, WOOD, t, y);
    flat(g, boxPts(-1, h - 5, w + 2, 5, 0.6, sd + 5), { h: 30, s: 6, l: 44 }, t, sd + 6, 0.6);
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

/** A gantry: two lattice legs on foot plates, a truss across the top with hazard ends and a hoist rail under it. */
const gantry: Shell = (rc, m, d) => {
  const t = tonesOf(d);
  const { w, h } = m;
  const sp = sprite(`shell|gantry|${w}|${h}|${t.key}`, -6, -2, w + 12, h + 3, (g) => {
    const lw = Math.min(10, w * 0.12);
    for (const x of [lw / 2 + 1, w - lw / 2 - 1]) {
      truss(g, x, 10, x, h - 2.5, lw, STEEL, t, x | 0);
      foot(g, x, h, lw + 6, STEEL, t, (x | 0) + 7);
    }
    truss(g, 0, 5, w, 5, 9, STEEL, t, 3);
    for (const x of [0, w - 7]) flat(g, boxPts(x, 0, 7, 10, 0.4, x | 0), HAZARD, t, (x | 0) + 1, 0.4);
    member(g, lw + 2, 13, w - lw - 2, 13, 1.6, STEEL, t, 9);
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

/** The flywheel's rim: a ring of plate on spokes, bolted, baked once and turned with the wheel it stands behind. */
function rim(r: number, n: number, t: Tones) {
  return sprite(`shell|rim|${r | 0}|${n}|${t.key}`, -r - 3, -r - 3, r * 2 + 6, r * 2 + 6, (g) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      // Each spoke a narrow open frame, so the rim never reads as a disc to land on.
      for (const k of [-1.6, 1.6]) member(g, -s * k + c * 6, c * k + s * 6, -s * k * 0.6 + c * (r - 4), c * k * 0.6 + s * (r - 4), 1.1, STEEL, t, i * 7 + k);
    }
    const ring = (rad: number, wd: number, seed: number) => {
      const pts: P[] = [];
      for (let i = 0; i <= 48; i++) pts.push({ x: Math.cos((i / 48) * Math.PI * 2) * rad, y: Math.sin((i / 48) * Math.PI * 2) * rad });
      g.fillStyle = t.ink(STEEL);
      stroke(g, pts, { w: wd + 1, seed, taper: [0, 0], press: 0 });
      g.fillStyle = t.c(STEEL);
      stroke(g, pts, { w: wd, seed: seed + 1, taper: [0, 0], press: 0 });
      g.fillStyle = t.c(STEEL, 10);
      stroke(
        g,
        pts.filter((q) => q.x + q.y < 0),
        { w: wd * 0.25, seed: seed + 2, taper: [0.2, 0.2], press: 0 },
      );
    };
    ring(r - 2, 3.4, 1);
    ring(r - 6.5, 1.2, 4);
    g.fillStyle = t.ink(STEEL);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + 0.13;
      blob(g, Math.cos(a) * (r - 2), Math.sin(a) * (r - 2), 0.7, i, 1, 0.1);
      g.fill();
    }
    flat(g, ovalPts(0, 0, 6, 6, 3, 0.03, 16), STEEL, t, 5, 0.8);
  });
}

const flywheel: Shell = (rc, m, d) => {
  const t = tonesOf(d);
  // Behind the great wheel it turns with the wheel; on its own it holds still.
  const wheel = d.r.mods.find((x): x is ModuleOf<'rotor'> => x.type === 'rotor' && x.swing === 0);
  const r = Math.max(8, Math.min(m.w, m.h) / 2 - 2);
  const cx = wheel ? wheel.hub[0] + d.off[0] : m.at[0] + d.off[0] + m.w / 2;
  const cy = wheel ? wheel.hub[1] + d.off[1] : m.at[1] + d.off[1] + m.h / 2;
  const a = wheel ? rotorAngles(wheel, rc.frame, d.r.phase)[0] : 0;
  const s = rc.s;
  s.save();
  s.translate(cx, cy);
  s.rotate(a);
  stamp(s, rim(r, wheel ? Math.max(4, Math.min(8, wheel.count)) : 8, t));
  s.restore();
};

/** A pit headframe: splayed timber legs, a back stay, braces, a deck, the sheave wheel on top and its cable down the shaft. */
const headframe: Shell = (rc, m, d) => {
  const t = tonesOf(d);
  const { w, h } = m;
  const sp = sprite(`shell|headframe|${w}|${h}|${t.key}`, -4, -4, w + 8, h + 5, (g) => {
    const top = 14;
    const sr = Math.min(10, w * 0.2);
    const cx = w / 2;
    g.fillStyle = t.ink(STEEL);
    line(g, cx, top - sr + 1, cx, h, { w: 0.8, seed: 2, taper: [0, 0], press: 0 });
    member(g, w - 2, h - 2, cx + 3, top + 2, 2.6, WOOD, t, 3);
    for (const [ax, bx] of [
      [3, cx - 4],
      [w - 9, cx + 4],
    ])
      member(g, ax, h - 2, bx, top + 2, 3.2, WOOD, t, ax);
    // X braces between the legs, wider apart as the legs spread.
    for (let y = top + 14; y < h - 8; y += 16) {
      const k0 = (y - top) / (h - top);
      const k1 = (Math.min(h - 4, y + 16) - top) / (h - top);
      const l = (k: number) => cx - 4 + (3 - (cx - 4)) * k;
      const r = (k: number) => cx + 4 + (w - 9 - (cx + 4)) * k;
      member(g, l(k0), y, r(k1), Math.min(h - 4, y + 16), 1.2, WOOD, t, y);
      member(g, r(k0), y, l(k1), Math.min(h - 4, y + 16), 1.2, WOOD, t, y + 1);
      member(g, l(k0), y, r(k0), y, 1.4, WOOD, t, y + 2);
    }
    flat(g, boxPts(cx - 9, top, 18, 3, 0.4, 4), WOOD, t, 5, 0.5);
    for (const x of [3, w - 9, w - 2]) foot(g, x, h, 7, { h: 30, s: 6, l: 44 }, t, x);
    // The sheave: a spoked wheel on its bearing.
    const pts: P[] = [];
    for (let i = 0; i <= 32; i++) pts.push({ x: cx + Math.cos((i / 32) * 6.28) * sr, y: top - sr + 1 + Math.sin((i / 32) * 6.28) * sr });
    g.fillStyle = t.ink(STEEL);
    stroke(g, pts, { w: 2.6, seed: 6, taper: [0, 0], press: 0 });
    g.fillStyle = t.c(STEEL);
    stroke(g, pts, { w: 1.6, seed: 7, taper: [0, 0], press: 0 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      member(g, cx, top - sr + 1, cx + Math.cos(a) * sr, top - sr + 1 + Math.sin(a) * sr, 0.7, STEEL, t, 8 + i);
    }
    flat(g, ovalPts(cx, top - sr + 1, 2, 2, 9, 0.02, 10), STEEL, t, 9, 0.3);
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

/** A ship's ribs in frame: keel, curved ribs up to the sheer line, a few strakes planked on low, a rail along the top. */
const hullRibs: Shell = (rc, m, d) => {
  const t = tonesOf(d);
  const { w, h } = m;
  const sd = m.seed % 8;
  const sp = sprite(`shell|hull|${w}|${h}|${sd}|${t.key}`, -6, -6, w + 12, h + 7, (g) => {
    // Sheer and keel lines: both rise toward the bow (right) and the stern.
    const sheer = (x: number) => 4 - 4 * Math.pow((x / w - 0.5) * 2, 2) + (x > w * 0.7 ? -((x - w * 0.7) / w) * 10 : 0);
    const keel = (x: number) => h - 3 - Math.max(0, Math.pow(Math.abs((x / w - 0.5) * 2), 4) * h * 0.55);
    const strakes = 3 + (sd % 2);
    for (let i = 0; i < strakes; i++) {
      const pts: P[] = [];
      const bot: P[] = [];
      for (let x = 2; x <= w - 2; x += 4) {
        const k = keel(x);
        const y0 = k - (i + 1) * 5;
        if (y0 < sheer(x) + 6) continue;
        pts.push({ x, y: y0 });
        bot.unshift({ x, y: y0 + 4.6 });
      }
      if (pts.length < 2) continue;
      flat(g, [...pts, ...bot], WOOD, t, i + sd, 0.4);
    }
    const n = Math.max(3, Math.round(w / 14));
    for (let i = 0; i <= n; i++) {
      const x = 3 + ((w - 6) * i) / n;
      const lean = (x / w - 0.5) * 6;
      const pts: P[] = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        const y = keel(x) + (sheer(x) - keel(x)) * u;
        pts.push({ x: x + lean * u * u - Math.sin(u * Math.PI) * 1.5, y });
      }
      const rw = Math.max(2.3, Math.min(5, w / 40));
      g.fillStyle = t.ink(WOOD);
      stroke(g, pts, { w: rw + 1.1, seed: i, taper: [0, 0.1], press: 0 });
      g.fillStyle = t.c(WOOD, 4);
      stroke(g, pts, { w: rw, seed: i + 1, taper: [0, 0.1], press: 0 });
    }
    const along = (f: (x: number) => number, dy: number): P[] => {
      const pts: P[] = [];
      for (let x = 0; x <= w; x += 4) pts.push({ x, y: f(x) + dy });
      return pts;
    };
    g.fillStyle = t.ink(WOOD);
    stroke(g, along(sheer, 0), { w: 3.4, seed: 30, taper: [0, 0], press: 0 });
    g.fillStyle = t.c(WOOD, 8);
    stroke(g, along(sheer, 0), { w: 2.2, seed: 31, taper: [0, 0], press: 0 });
    g.fillStyle = t.ink(WOOD);
    stroke(g, along(keel, 1), { w: 4.6, seed: 32, taper: [0, 0], press: 0 });
    g.fillStyle = t.c(WOOD, -6);
    stroke(g, along(keel, 1), { w: 3.4, seed: 33, taper: [0, 0], press: 0 });
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

/** A billboard on scaffolding: lamps on arms, a framed face of pasted sheets selling a crate, legs to the roof. */
const billboard: Shell = (rc, m, d) => {
  const t = tonesOf(d);
  const { w, h } = m;
  const sd = m.seed % 6;
  const ink = (c: HSL) => t.ink(c);
  const sp = sprite(`shell|billboard|${w}|${h}|${sd}|${t.key}`, -4, -8, w + 8, h + 9, (g) => {
    const bh = Math.max(14, Math.round(h * 0.56));
    for (let x = w * 0.18; x < w; x += w * 0.32) {
      member(g, x, 0, x, -5, 0.8, STEEL, t, x | 0);
      member(g, x, -5, x + 4, -6, 0.8, STEEL, t, (x | 0) + 1);
      flat(g, boxPts(x + 2.5, -7.5, 4, 2.5, 0.6, x | 0), STEEL, t, (x | 0) + 2, 0.3);
    }
    for (const x of [w * 0.2, w * 0.8]) {
      truss(g, x, bh, x, h - 2.5, 7, STEEL, t, x | 0);
      foot(g, x, h, 11, STEEL, t, (x | 0) + 3);
    }
    member(g, 2, bh + 4, w - 2, bh + 4, 1.6, WOOD, t, 5);
    const face = boxPts(0, 0, w, bh, 0.6, sd, 0.1);
    flat(g, face, { h: 40, s: 20, l: 72 }, t, sd + 1, 0.4);
    g.save();
    path(g, face);
    g.clip();
    const hue = [12, 200, 140, 290, 48, 330][sd];
    g.fillStyle = t.c({ h: hue, s: 55, l: 52 });
    g.fillRect(0, 0, w, bh * 0.3);
    // The crate it sells: a box with its brace, big on the left; a burst beside it. No words.
    const cs = Math.min(bh * 0.55, w * 0.3);
    const bx = w * 0.12;
    const by = bh * 0.38;
    flat(g, boxPts(bx, by, cs, cs, 0.8, sd + 2), { h: 30, s: 50, l: 48 }, t, sd + 3, 0.6);
    g.fillStyle = ink({ h: 30, s: 50, l: 48 });
    line(g, bx + 1.5, by + 1.5, bx + cs - 1.5, by + cs - 1.5, { w: 1.04, seed: sd, taper: [0, 0], press: 0 });
    line(g, bx + 1.5, by + cs * 0.5, bx + cs - 1.5, by + cs * 0.5, { w: 0.56, seed: sd + 1, taper: [0, 0], press: 0 });
    const sx = bx + cs + w * 0.18;
    const sy = by + cs * 0.45;
    const burst: P[] = [];
    for (let i = 0; i < 16; i++) {
      const rr = i & 1 ? cs * 0.28 : cs * 0.5;
      burst.push({ x: sx + Math.cos((i / 16) * 6.28) * rr, y: sy + Math.sin((i / 16) * 6.28) * rr });
    }
    flat(g, burst, { h: 52, s: 80, l: 56 }, t, sd + 4, 0.3);
    // Pasted sheets: seams down the face, one corner peeling.
    g.fillStyle = ink({ h: 40, s: 20, l: 72 });
    for (let x = w / 4; x < w - 1; x += w / 4) line(g, x, 1, x + 0.3, bh - 1, { w: 0.5, seed: x | 0, taper: [0.1, 0.1], press: 0 });
    g.restore();
    flat(g, boxPts(-1.5, -1.5, w + 3, 3, 0.4, sd + 5), STEEL, t, sd + 6, 0.3);
    flat(g, boxPts(-1.5, bh - 1.5, w + 3, 3, 0.4, sd + 7), STEEL, t, sd + 8, 0.3);
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

/** A clock dial set into the wall: bezel, face, hour marks heavier at the quarters. Its hands are the rotors in front. */
const clockface: Shell = (rc, m, d) => {
  const t = tonesOf(d);
  const r = Math.max(8, Math.min(m.w, m.h) / 2 - 1);
  const hands = d.r.mods.some((x) => x.type === 'rotor');
  const sp = sprite(`shell|clock|${r | 0}|${hands ? 1 : 0}|${t.key}`, -r - 2, -r - 2, r * 2 + 4, r * 2 + 4, (g) => {
    flat(g, ovalPts(0, 0, r, r, 1, 0.01, 40), BRASS, t, 1, 1.2);
    flat(g, ovalPts(0, 0, r - 3, r - 3, 2, 0.01, 40), { h: 44, s: 30, l: 80 }, t, 2, 0.6);
    g.fillStyle = t.ink(BRASS);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const q = i % 3 === 0;
      const r0 = r - (q ? 8 : 6);
      line(g, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * (r - 4), Math.sin(a) * (r - 4), { w: q ? 1.8 : 0.9, seed: i, taper: [0, 0], press: 0 });
    }
    if (!hands) {
      // Stopped, when nothing turns in front of it.
      line(g, 0, 0, Math.cos(-2.2) * (r - 10), Math.sin(-2.2) * (r - 10), { w: 1.6, seed: 20, taper: [0, 0.6], press: 0 });
      line(g, 0, 0, Math.cos(-0.5) * (r - 6), Math.sin(-0.5) * (r - 6), { w: 1.1, seed: 21, taper: [0, 0.6], press: 0 });
    }
    flat(g, ovalPts(0, 0, 1.8, 1.8, 3, 0.02, 10), BRASS, t, 3, 0.2);
  });
  stamp(rc.s, sp, m.at[0] + d.off[0] + m.w / 2, m.at[1] + d.off[1] + m.h / 2);
};

/** Every backdrop shell a landmark can stand in front of. */
export const SHELLS: Partial<Record<DecoKind, Shell>> = { facade, gantry, flywheel, headframe, hull: hullRibs, billboard, clockface };
