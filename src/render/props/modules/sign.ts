import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_EMPTY, tileAt } from '../../../sim/level';
import { type ModuleOf, SIGN_FALL, SIGN_LIFT, SIGN_LIVE, SIGN_WARN, signCycle, signRect } from '../../../sim/props';
import { line } from '../../ink';
import { boxPts, dot, INK, part, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light, lightning, type RC } from '../../kit';
import { type DrawCtx, defineArt } from '../common';

/**
 * A falling sign (sim/props/modules/sign.ts), drawn on the very box that kills. It hangs on two chains from
 * whatever is over it, or from a bracket off the wall beside it. In the warning one chain lets go: the sign
 * lurches down at that end and the bracket spits sparks. Then it drops, lands flat on the floor cracked
 * and sparking (still live: that's what kills while it lies there), and is winched back up on its chains.
 */

type Sign = ModuleOf<'sign'>;

/** Face, rim and lettering, picked by the sign's seed: an old shop sign's colours, calm enough to sit in the city. */
const PAINTS: readonly [HSL, HSL, HSL][] = [
  [
    { h: 4, s: 56, l: 44 },
    { h: 30, s: 14, l: 22 },
    { h: 42, s: 60, l: 86 },
  ],
  [
    { h: 182, s: 34, l: 38 },
    { h: 200, s: 14, l: 20 },
    { h: 50, s: 30, l: 90 },
  ],
  [
    { h: 44, s: 70, l: 56 },
    { h: 30, s: 20, l: 20 },
    { h: 20, s: 30, l: 14 },
  ],
  [
    { h: 40, s: 30, l: 84 },
    { h: 10, s: 30, l: 26 },
    { h: 2, s: 60, l: 42 },
  ],
  [
    { h: 226, s: 38, l: 34 },
    { h: 230, s: 14, l: 18 },
    { h: 46, s: 80, l: 64 },
  ],
];
const SPARK: HSL = { h: 50, s: 100, l: 72 };
const CHAIN: HSL = { h: 210, s: 6, l: 40 };

const paintOf = (m: Sign) => PAINTS[m.seed % PAINTS.length];

/** Where the sign hangs from: the underside of whatever is over it (`up`), else a bracket off the wall beside it. */
function mountOf(level: Level | undefined, m: Sign, ox: number, oy: number): { up: number | null; wall: -1 | 0 | 1 } {
  if (!level) return { up: null, wall: 0 };
  const x0 = Math.floor((m.at[0] + ox) / TILE);
  const x1 = Math.floor((m.at[0] + ox + m.w - 1) / TILE);
  const y0 = Math.floor((m.at[1] + oy) / TILE);
  for (let k = 1; k <= 4; k++) for (let x = x0; x <= x1; x++) if (tileAt(level, x, y0 - k) !== T_EMPTY) return { up: (y0 - k + 1) * TILE, wall: 0 };
  if (tileAt(level, x0 - 1, y0) === 1) return { up: null, wall: -1 };
  if (tileAt(level, x1 + 1, y0) === 1) return { up: null, wall: 1 };
  return { up: null, wall: 0 };
}

/** The sign's face, baked: a rim, the painted face, a row of hand-lettered glyphs (lettering, not a word), and bulbs on a tall one. */
function face(m: Sign) {
  const [bg, rim, ink] = paintOf(m);
  return sprite(`sign|${m.w}|${m.h}|${m.seed}`, -1, -1, m.w + 2, m.h + 2, (g) => {
    const pts = boxPts(0, 0, m.w, m.h, 1.2, m.seed, 0.12);
    part(g, pts, rim, m.seed, { depth: 0.6, thin: 0.4, thick: 0.9 });
    const inner = boxPts(1.6, 1.6, m.w - 3.2, m.h - 3.2, 0.8, m.seed + 1, 0.1);
    tone(g, inner, bg, { depth: 0.8 });
    // Glyphs: strokes and loops at a letter's pitch, centred, every one its own from the seed.
    const gh = Math.min(m.h - 6, 9);
    const pitch = Math.max(5, gh * 0.72);
    const n = Math.max(2, Math.floor((m.w - 8) / pitch));
    const x0 = (m.w - n * pitch) / 2 + pitch * 0.2;
    const y0 = (m.h - gh) / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * pitch;
      const k = hash2(i, 1, m.seed);
      const w = pitch * 0.62;
      const c = css(ink);
      tick(g, x, y0, x, y0 + gh, 1.1, i, c);
      if (k < 0.3) tick(g, x, y0, x + w, y0, 1, i + 5, c);
      else if (k < 0.55) tick(g, x + w, y0, x + w, y0 + gh, 1.1, i + 6, c);
      else if (k < 0.75) tick(g, x, y0 + gh * 0.5, x + w, y0 + gh * 0.5, 1, i + 7, c);
      if (hash2(i, 2, m.seed) < 0.5) tick(g, x, y0 + gh, x + w, y0 + gh, 1, i + 8, c);
    }
    // A long sign's bulbs, top and bottom.
    if (m.h >= TILE * 1.5) {
      g.fillStyle = css({ h: 46, s: 50, l: 78 });
      for (let x = 4; x < m.w - 2; x += 5) {
        dot(g, x, 2.2, 0.75, x);
        dot(g, x, m.h - 2.2, 0.75, x + 1);
      }
    }
    // A lit edge along the top.
    tick(g, 2.2, 1.9, m.w - 2.2, 1.9, 0.5, 3, css(bg, 18));
  });
}

/** A hanging chain from (ax, ay) to (bx, by): ink links on a thin line. */
function chain(s: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, seed: number) {
  s.fillStyle = INK;
  line(s, ax, ay, bx, by, { w: 0.85, seed, taper: [0, 0], press: 0 });
  s.fillStyle = css(CHAIN, 16);
  const len = Math.hypot(bx - ax, by - ay);
  for (let t = 1.5; t < len - 1; t += 2.6) {
    const u = t / len;
    dot(s, ax + (bx - ax) * u, ay + (by - ay) * u, 0.45, t);
  }
}

/** Sparks spitting off a point: short jagged threads, hot. */
function sparks(rc: RC, x: number, y: number, k: number) {
  glowDot(rc.g, x, y, 4 + 4 * k, SPARK, 0.35 + 0.5 * k);
  rc.g.strokeStyle = css(SPARK, 14, 0.8);
  rc.g.lineWidth = 0.6;
  for (let i = 0; i < 2; i++) {
    if (Math.random() > 0.35 + 0.6 * k) continue;
    const a = Math.random() * Math.PI * 2;
    const r = 3 + Math.random() * 5;
    lightning(rc.g, x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, 2, 3);
  }
}

function draw(rc: RC, m: Sign, d: DrawCtx) {
  const s = rc.s;
  const c = signCycle(m, rc.frame, d.r.phase);
  const r = signRect(m, rc.frame, d.r.phase, d.off[0], d.off[1]);
  const lv = d.o.level ?? undefined;
  const mount = mountOf(lv, m, d.off[0], d.off[1]);
  const hx = m.at[0] + d.off[0];
  const hy = m.at[1] + d.off[1];
  // The two hooks it hangs from: the underside over it, or a bracket arm out of the wall.
  const top = mount.up ?? hy - (mount.wall ? 6 : TILE);
  const hooks: [number, number][] = [
    [hx + 3, top],
    [hx + m.w - 3, top],
  ];
  if (mount.wall) {
    const wx = mount.wall < 0 ? hx - 1 : hx + m.w + 1;
    const ex = mount.wall < 0 ? hx + m.w - 2 : hx + 2;
    s.fillStyle = INK;
    line(s, wx, top, ex, top, { w: 2.1, seed: m.seed, taper: [0, 0], press: 0 });
    s.fillStyle = css(CHAIN, -4);
    line(s, wx, top - 0.3, ex, top - 0.3, { w: 1.2, seed: m.seed + 1, taper: [0, 0], press: 0 });
    // The strut under the arm, back to the wall.
    s.fillStyle = INK;
    line(s, wx, top + 6, wx + (ex - wx) * 0.45, top + 0.6, { w: 1, seed: m.seed + 2, taper: [0, 0], press: 0 });
  } else if (mount.up !== null) {
    for (const [x] of hooks) dot(s, x, top + 0.6, 0.9, x);
  }
  // Which end lets go: the one away from the wall, else the seed's.
  const loose = mount.wall ? (mount.wall < 0 ? 1 : 0) : m.seed % 2;
  let tilt = 0;
  let jx = 0;
  if (c.seg === SIGN_WARN) {
    const u = c.t / Math.max(1, c.len);
    tilt = (loose ? 1 : -1) * (0.04 + 0.1 * u * u);
    jx = Math.sin(rc.frame * 1.7) * 0.6 * u;
  }
  const hanging = c.seg !== SIGN_FALL && c.seg !== SIGN_LIVE;
  // The chains: taut while it hangs and while it's winched up, the loose one gone from the warning on.
  if (hanging) {
    hooks.forEach(([x, y], i) => {
      if (c.seg === SIGN_WARN && i === loose) return;
      const px = i === 0 ? r.x + 3 : r.x + r.w - 3;
      chain(s, x, y, px + jx, r.y, m.seed + i);
    });
  } else {
    // Snapped ends dangling from the hooks.
    hooks.forEach(([x, y], i) => chain(s, x, y, x + (i ? 1 : -1), y + 5, m.seed + i));
  }
  // The sign itself.
  const sp = face(m);
  s.save();
  if (tilt) {
    const pivot = loose ? r.x + 3 : r.x + r.w - 3;
    s.translate(pivot + jx, r.y);
    s.rotate(tilt);
    s.translate(-pivot, -r.y);
  }
  stamp(s, sp, r.x + jx, r.y);
  s.restore();
  if (c.seg === SIGN_WARN) {
    const u = c.t / Math.max(1, c.len);
    sparks(rc, loose ? r.x + r.w - 3 : r.x + 3, r.y + 1, u);
    if (Math.random() < 0.3 * u) {
      // A bolt or a flake of paint, dropping ahead of it.
      s.fillStyle = INK;
      dot(s, r.x + Math.random() * r.w, r.y + r.h + Math.random() * 10, 0.6, rc.frame);
    }
  }
  if (c.seg === SIGN_FALL) {
    // The air it falls through: a few speed strokes over it.
    s.fillStyle = css(paintOf(m)[1], 30, 0.5);
    for (let i = 0; i < 3; i++) {
      const x = r.x + (i + 0.5) * (r.w / 3);
      line(s, x, r.y - 2, x, r.y - 8 - 6 * (c.t / c.len), { w: 0.7, seed: i, taper: [0.1, 0.8], press: 0 });
    }
  }
  if (c.seg === SIGN_LIVE) {
    // Cracked across its face, and live: sparks crawling along it and its light flickering.
    s.fillStyle = INK;
    const cx = r.x + r.w * (0.3 + 0.4 * hash2(1, 2, m.seed));
    line(s, cx, r.y + 1.5, cx + 3, r.y + r.h * 0.6, { w: 0.6, seed: 4, taper: [0.1, 0.6], press: 0 });
    line(s, cx + 3, r.y + r.h * 0.6, cx - 2, r.y + r.h - 1.5, { w: 0.5, seed: 5, taper: [0.2, 0.7], press: 0 });
    const k = 1 - c.t / Math.max(1, c.len);
    for (let i = 0; i < 2; i++) sparks(rc, r.x + 2 + Math.random() * (r.w - 4), r.y + Math.random() * r.h, 0.5 + 0.5 * k);
    if (Math.random() < 0.6) light(rc, r.x + r.w / 2, r.y + r.h / 2, 46, SPARK, 0.5);
  }
  if (c.seg === SIGN_LIFT || c.seg === 0) {
    // A lit sign hanging there: its glow on what's under it.
    light(rc, r.x + r.w / 2, r.y + r.h, 34, paintOf(m)[0], 0.25);
  }
}

defineArt<'sign'>({ type: 'sign', layer: 1, draw });
