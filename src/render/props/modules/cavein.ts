import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { CAVE_OFF, CAVE_ON, CAVE_WARN, caveCycle, type ModuleOf, rockCount, rocksAt } from '../../../sim/props';
import { blob, line } from '../../ink';
import { INK } from '../../ink-props';
import { circle, flame, glowDot, light, type RC } from '../../kit';
import { type DrawCtx, defineArt } from '../common';

/**
 * A cave-in (sim/props/modules/cavein.ts), drawn from the sim's own cycle so each boulder is drawn on the
 * very circle that kills. The roof over it is cracked all the time; in the warning grit sifts out of the
 * cracks, thicker and faster toward the end, and pebbles skitter down ahead of the rocks. Then the
 * boulders drop, trailing dust, and a cloud of it rolls off the floor where they land. The firedamp
 * variant: a sour haze that seeps out of the roof and pools in the pocket through the warning, a spark,
 * and then the pocket is fire, which glows (it's hot), and goes out in a puff of soot.
 */

type Cavein = ModuleOf<'cavein'>;

const GAS: HSL = { h: 72, s: 45, l: 58 };
const FIRE: HSL = { h: 28, s: 100, l: 56 };
const HOT: HSL = { h: 46, s: 100, l: 70 };

const rockOf = (d: DrawCtx): HSL => d.o.level?.theme.terrain.base ?? { h: 28, s: 14, l: 30 };

/** The cracks in the roof over the box: always there, so you can see which stretch of roof is rotten. */
function cracks(rc: RC, m: Cavein, x: number, y: number) {
  const s = rc.s;
  const n = rockCount(m);
  s.fillStyle = INK;
  for (let i = 0; i < n; i++) {
    if (hash2(i, 7, m.seed) < 0.35) continue;
    const cx = x + (i + 0.5) * (m.w / n) + (hash2(i, 8, m.seed) - 0.5) * 6;
    const len = 3 + hash2(i, 9, m.seed) * 4;
    line(s, cx, y - 0.4, cx + (hash2(i, 10, m.seed) - 0.5) * 4, y + len * 0.4, { w: 0.8, seed: i, taper: [0.1, 0.5], press: 0 });
    line(s, cx, y - 0.4, cx - len * 0.6, y - 0.2, { w: 0.6, seed: i + 30, taper: [0.1, 0.6], press: 0 });
  }
}

/** Grit sifting from the roof, `k` 0..1 through the warning: thin streams of it, and pebbles ahead of the fall. */
function grit(rc: RC, m: Cavein, x: number, y: number, k: number, rock: HSL) {
  const n = rockCount(m);
  const cw = m.w / n;
  for (let i = 0; i < n; i++) {
    const cx = x + (i + 0.5) * cw + (hash2(i, 2, m.seed) - 0.5) * cw * 0.25;
    // A dusty stream, soft on the background, longer as the roof works loose.
    const len = (0.25 + 0.75 * k) * m.h;
    for (let j = 0; j < 6; j++) {
      const p = (rc.frame * (0.02 + 0.03 * k) + j / 6 + hash2(i, j, m.seed)) % 1;
      rc.bg.fillStyle = `rgba(150,128,104,${0.4 * (1 - p) * (0.4 + 0.6 * k)})`;
      circle(rc.bg, cx + Math.sin(p * 9 + i) * 1.2, y + p * len, 0.6 + p * 1.6);
    }
    // Pebbles, once it's well along.
    if (k > 0.45 && hash2(i, 3, m.seed) < 0.6) {
      const p = (rc.frame * 0.045 + hash2(i, 4, m.seed)) % 1;
      const py = y + p * p * m.h;
      rc.s.fillStyle = INK;
      circle(rc.s, cx + 2, py, 1.2);
      rc.s.fillStyle = css(rock, 6);
      circle(rc.s, cx + 1.8, py - 0.2, 0.7);
    }
  }
  // The roof's own dust, hanging under it.
  rc.bg.fillStyle = `rgba(140,118,96,${0.18 + 0.25 * k})`;
  for (let i = 0; i <= n; i++) circle(rc.bg, x + (i * m.w) / n, y + 2, 3 + 3 * k);
}

/** A boulder: a lumpy blob of the level's own rock, lit up-left, ink round it. */
function boulder(rc: RC, x: number, y: number, r: number, rock: HSL, seed: number, spin: number) {
  const s = rc.s;
  s.fillStyle = INK;
  blob(s, x, y, r + 1.1, seed, 1, 0.22);
  s.fill();
  s.fillStyle = css(rock, -12);
  blob(s, x, y, r, seed, 1, 0.22);
  s.fill();
  s.fillStyle = css(rock, 6);
  blob(s, x - r * 0.22, y - r * 0.25, r * 0.66, seed + 1, 1, 0.25);
  s.fill();
  s.fillStyle = INK;
  line(s, x + Math.cos(spin) * r * 0.5, y + Math.sin(spin) * r * 0.5, x - Math.cos(spin) * r * 0.1, y - Math.sin(spin) * r * 0.1, {
    w: 0.6,
    seed,
    taper: [0.2, 0.4],
    press: 0,
  });
}

/** Dust rolling off the floor where the rocks land, `k` 1 fresh to 0 settled. */
function dustCloud(rc: RC, m: Cavein, x: number, floor: number, k: number) {
  const n = rockCount(m);
  for (let i = 0; i <= n * 2; i++) {
    const spread = 1 - k;
    const cx = x + (i * m.w) / (n * 2) + (hash2(i, 5, m.seed) - 0.5) * 8 * spread;
    rc.bg.fillStyle = `rgba(150,128,104,${0.42 * k})`;
    circle(rc.bg, cx, floor - 3 - spread * 7, 3 + spread * 7);
  }
}

function rocks(rc: RC, m: Cavein, d: DrawCtx) {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const floor = y + m.h;
  const rock = rockOf(d);
  cracks(rc, m, x, y);
  const c = caveCycle(m, rc.frame, d.r.phase);
  if (c.seg === CAVE_WARN) grit(rc, m, x, y, c.t / Math.max(1, c.len), rock);
  if (c.seg === CAVE_OFF && c.t < 50) {
    // Rubble on the floor, and the dust settling.
    const k = 1 - c.t / 50;
    dustCloud(rc, m, x, floor, k);
    const n = rockCount(m);
    for (let i = 0; i < n; i++) {
      const cx = x + (i + 0.5) * (m.w / n) + (hash2(i, 6, m.seed) - 0.5) * 6;
      rc.s.globalAlpha = Math.min(1, k * 2);
      boulder(rc, cx, floor - 1.6, 1.8 + hash2(i, 11, m.seed), rock, i + 40, i);
      rc.s.globalAlpha = 1;
    }
  }
  if (c.seg !== CAVE_ON) return;
  for (const r of rocksAt(m, rc.frame, d.r.phase, d.off[0], d.off[1])) {
    // Its dust trail, soft and behind it.
    for (let j = 1; j <= 3; j++) {
      rc.bg.fillStyle = `rgba(150,128,104,${0.25 * (1 - j / 4)})`;
      circle(rc.bg, r.x, r.y - j * r.r * 1.2 * (0.4 + r.u), r.r * (0.7 + j * 0.25));
    }
    boulder(rc, r.x, r.y, r.r, rock, r.i * 13 + 5, r.u * 6 + r.i);
    if (r.u > 0.85) dustCloud(rc, { ...m, w: TILE, seed: m.seed + r.i }, r.x - TILE / 2, floor, (r.u - 0.85) / 0.15);
  }
}

/** The firedamp pocket's haze: wisps pooled under the roof, deeper and thicker as `k` (0..1) rises. */
function haze(rc: RC, m: Cavein, x: number, y: number, k: number) {
  const n = Math.max(3, Math.round(m.w / 7));
  const depth = m.h * (0.3 + 0.7 * k);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 3; j++) {
      const u = (i + 0.5) / n;
      const wob = Math.sin(rc.t * (0.8 + j * 0.3) + i * 1.7 + m.seed) * 3;
      rc.bg.fillStyle = css(GAS, -6 + j * 4, (0.07 + 0.2 * k) * (1 - j * 0.25));
      circle(rc.bg, x + u * m.w + wob, y + depth * (0.25 + j * 0.3), 4 + (m.w / n) * 0.5 + j);
    }
  }
}

function gas(rc: RC, m: Cavein, d: DrawCtx) {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const c = caveCycle(m, rc.frame, d.r.phase);
  // Where it seeps from: dark fissures in the roof, always there.
  cracks(rc, m, x, y);
  if (c.seg === CAVE_OFF) {
    // A thin seep between burns, and soot falling after one.
    haze(rc, m, x, y, 0.05);
    if (c.t < 40) {
      const k = 1 - c.t / 40;
      for (let i = 0; i < 6; i++) {
        rc.bg.fillStyle = `rgba(40,34,30,${0.35 * k})`;
        circle(rc.bg, x + ((i + 0.5) / 6) * m.w, y + 4 - (1 - k) * 6, 4 + (1 - k) * 6);
      }
    }
    return;
  }
  if (c.seg === CAVE_WARN) {
    const k = c.t / Math.max(1, c.len);
    haze(rc, m, x, y, k);
    // Bubbles of it working out of the cracks.
    for (let i = 0; i < 4; i++) {
      const p = (rc.frame * 0.03 + i / 4 + m.seed * 0.1) % 1;
      rc.s.fillStyle = css(GAS, 14, 0.7 * (1 - p));
      circle(rc.s, x + ((i + 0.5) / 4) * m.w, y + 1 + p * 6 * k, 0.8 + p * 1.2);
    }
    // The spark that lights it, flicking at the near end in the last moments: flat and bright.
    if (k > 0.75 && (rc.frame >> 2) % 2 === 0) {
      const sx = x + 3;
      const sy = y + m.h * 0.5;
      rc.s.fillStyle = css(HOT, 10);
      circle(rc.s, sx, sy, 1.3);
      glowDot(rc.g, sx, sy, 6, HOT, 0.8);
    }
    return;
  }
  // The burn: the whole pocket alight, the fire licking up into the roof.
  const k = c.t / Math.max(1, c.len);
  const fade = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
  const n = Math.max(3, Math.round(m.w / 6));
  for (let i = 0; i < n; i++) {
    const fx = x + ((i + 0.5) / n) * m.w;
    const fh = m.h * (0.75 + 0.25 * Math.sin(rc.t * 9 + i * 2.1));
    flame(rc.g, fx, y + m.h, (m.w / n) * 0.75, fh * fade, FIRE, rc.t + i);
  }
  // Its body: billows of flame filling the pocket, roof to floor, in two flat tones.
  const rows = Math.max(1, Math.round(m.h / 9));
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const bx = x + ((i + 0.5) / n) * m.w + Math.sin(rc.t * 7 + i + j) * 1.5;
      const by = y + ((j + 0.5) / rows) * m.h;
      const br = Math.min(m.w / n, m.h / rows) * 0.62 * (0.6 + 0.4 * fade);
      rc.s.fillStyle = css(FIRE, 0, 0.85 * fade);
      blob(rc.s, bx, by, br, i * 7 + j + (rc.frame >> 2), 1, 0.3);
      rc.s.fill();
      rc.s.fillStyle = css(HOT, 6, 0.9 * fade);
      blob(rc.s, bx - br * 0.15, by + br * 0.1, br * 0.55, i * 5 + j + 3, 1, 0.3);
      rc.s.fill();
    }
  glowDot(rc.g, x + m.w / 2, y + m.h / 2, Math.max(m.w, m.h) * 0.9, FIRE, 0.8 * fade);
  light(rc, x + m.w / 2, y + m.h / 2, Math.max(m.w, m.h) * 2, FIRE, 1.2 * fade);
}

defineArt<'cavein'>({
  type: 'cavein',
  layer: 2,
  draw: (rc, m, d) => {
    if (m.kind === 'gas') gas(rc, m, d);
    else rocks(rc, m, d);
  },
});
