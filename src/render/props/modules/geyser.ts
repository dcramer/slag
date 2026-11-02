import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { geyserColumn, geyserCycle, geyserWind, type ModuleOf } from '../../../sim/props';
import { windProfile } from '../../../sim/wind';
import { blob } from '../../ink';
import { boxPts, INK, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { circle, ellipse, glowDot, light, type RC } from '../../kit';
import type { ThemeId } from '../../../themes';
import { beamOf, type DrawCtx, defineArt } from '../common';
import { themeOf } from './skins';

/**
 * Geyser art: a vent mound (ground vents), a rumbling telegraph, and the
 * erupting column — drawn from geyserCycle / geyserColumn / geyserWind, the
 * sim's own cycle and shapes. Three readable phases, all on the sim frame:
 * dormant (still: nothing moves, nothing pushes), rumbling (shake, sputter
 * and a growing hiss plume: the warning), erupting (the column; steam puffs
 * travel at the updraft's air speed and thin out where its push tapers).
 */

type Geyser = ModuleOf<'geyser'>;

/** What a vent erupts, by theme: the volcano's lava, the glacier's frost, a space station's solar flares. */
interface VentLook {
  rock: HSL;
  lava: HSL;
  hot: HSL;
  /** Steam puff color as "r,g,b". */
  steam: string;
  crust: 'sulphur' | 'ice';
  /** A flare loop arcs off the top of the column. */
  loop?: boolean;
  /** Snowflakes ride the column. */
  flakes?: boolean;
}

const VOLCANO: VentLook = {
  rock: { h: 30, s: 12, l: 40 },
  lava: { h: 22, s: 100, l: 52 },
  hot: { h: 42, s: 100, l: 66 },
  steam: '240,244,248',
  crust: 'sulphur',
};
const VENTS: Partial<Record<ThemeId, VentLook>> = {
  glacier: { ...VOLCANO, rock: { h: 200, s: 26, l: 70 }, steam: '228,242,255', crust: 'ice', flakes: true },
  space: { ...VOLCANO, lava: { h: 40, s: 100, l: 56 }, hot: { h: 52, s: 100, l: 84 }, loop: true },
};
const ventOf = (d: DrawCtx): VentLook => VENTS[themeOf(d) ?? 'farm'] ?? VOLCANO;

function isPit(m: Geyser, d: DrawCtx): boolean {
  return !!d.o.level && m.at[1] >= d.o.level.h * TILE - 1;
}

/**
 * The vent: a squat cone of broken rock plates round a crater, the far plate leaning in, the near ones
 * cracked, a lit lip on the crater's back rim, and a crust of sulphur or ice in the cracks. Baked.
 */
function ventMound(rock: HSL, lava: boolean, crust: VentLook['crust']) {
  return sprite(`gy|vent|${rock.h},${rock.l}|${lava}|${crust}`, -15, -11, 30, 13, (g) => {
    const back = poly(-7.6, -4.8, -5, -8.2, -1, -9.2, 3.6, -8.8, 7.4, -5.6, 4, -6.2, -4, -6.4);
    part(g, back, { ...rock, l: rock.l - 6 }, 2, { depth: 0.8, shade: -14, thin: 0.45, thick: 1 });
    // The crater: dark, with the lit back rim.
    g.fillStyle = lava ? '#2a0c06' : '#221f1d';
    path(g, ovalPts(0, -6.6, 4.8, 1.6, 4, 0.06, 14));
    g.fill();
    const left = poly(-13.2, 0.6, -11.6, -2.8, -8.8, -5.2, -5, -6.6, -2.4, -5.6, -1.6, -2.4, -3.6, 0.6);
    const right = poly(-3.8, 0.6, -1.8, -2.6, -0.6, -5.4, 3, -6.6, 7.4, -5.4, 10.6, -3, 13.2, 0.6);
    part(g, left, rock, 3, { depth: 1.2, shade: -18, thin: 0.5, thick: 1.4 });
    part(g, right, { ...rock, l: rock.l + 4 }, 4, { depth: 1.2, shade: -20, thin: 0.5, thick: 1.4 });
    // Cracks and the strata on the plates.
    const crack = lava ? css({ h: 22, s: 100, l: 55 }) : css(rock, -26);
    tick(g, -9.4, -2.6, -7.2, -0.4, 0.55, 5, crack);
    tick(g, -7.2, -0.4, -6.6, 0.4, 0.45, 6, crack);
    tick(g, 5.4, -4.4, 7, -2, 0.55, 7, crack);
    tick(g, 7, -2, 6.2, 0.2, 0.45, 8, crack);
    tick(g, -11, -1, -5.8, -1.8, 0.35, 9, css(rock, 14));
    tick(g, 2, -3.2, 9.6, -2, 0.35, 10, css(rock, 14));
    g.fillStyle = css(rock, 22);
    path(g, poly(-4.6, -6.2, -1.4, -7.4, 2.8, -7.2, 1, -6.8, -2.6, -6.6));
    g.fill();
    if (lava) return;
    if (crust === 'ice') {
      for (const [dx, dy, r] of [
        [-6.4, -4.2, 1.8],
        [5, -4.4, 1.5],
        [-1.8, -7.6, 1.1],
        [9, -2, 1.2],
      ])
        part(g, poly(dx, dy - r * 1.6, dx + r * 0.7, dy, dx, dy + r * 0.6, dx - r * 0.7, dy), { h: 195, s: 50, l: 94 }, dx, {
          depth: 0.2,
          thin: 0.25,
          thick: 0.5,
          ink: '#16364d',
        });
    } else
      for (const [dx, dy, r] of [
        [-6.4, -4.4, 1.3],
        [4.6, -5.2, 1],
        [8.6, -2.6, 0.8],
        [-2.6, -7.4, 0.8],
      ]) {
        g.fillStyle = '#e6d25a';
        blob(g, dx, dy, r, dx + 9, 1, 0.25);
        g.fill();
        g.fillStyle = '#a8902a';
        blob(g, dx + r * 0.3, dy + r * 0.35, r * 0.5, dx + 3, 1, 0.2);
        g.fill();
      }
  });
}

/**
 * The Floor Is Lava: a couch cushion beside the plume, half sunk, tilted and smoking. It's a joke, not a
 * step: it sits low in the lava with the lava lapping over it, so nothing about it reads as footing.
 */
function cushion() {
  return sprite('gy|cushion', -9, -6, 18, 11, (g) => {
    g.save();
    g.rotate(-0.32);
    const c: HSL = { h: 168, s: 40, l: 42 };
    part(g, boxPts(-7, -3.5, 14, 6, 2.6, 7), c, 7, { depth: 0.9, thin: 0.5, thick: 1.1 });
    tick(g, -6, -0.6, 6, -0.6, 0.45, 8, css(c, -20));
    g.fillStyle = INK;
    blob(g, -1, -1.6, 0.7, 9, 1, 0.1);
    g.fill();
    g.restore();
    // Lava lapping over its lower half.
    const lap = poly(-9, 1.2, -5, 0.4, -1, 1.4, 3, 0.2, 7, 1.2, 9, 0.6, 9, 5, -9, 5);
    g.fillStyle = css({ h: 18, s: 100, l: 50 });
    path(g, lap);
    g.fill();
    g.fillStyle = css({ h: 40, s: 100, l: 66 });
    for (const [lx, ly] of [
      [-6, 2],
      [1, 2.4],
      [6, 2],
    ])
      g.fillRect(lx, ly, 2.2, 0.6);
  });
}

function drawVent(rc: RC, m: Geyser, d: DrawCtx) {
  if (isPit(m, d)) {
    if (m.look === 'lava' && themeOf(d) === 'volcano') {
      const cx = m.at[0] + d.off[0] + m.width + 10;
      const cy = m.at[1] + d.off[1] - 5 + Math.sin(rc.t * 1.3 + d.r.pp.uid) * 0.4;
      stamp(rc.s, cushion(), cx, cy);
      if (d.o.emit && Math.random() < 0.04) d.o.emit('smoke', cx + 2, cy - 4, (Math.random() - 0.5) * 6, -16, { h: 0, s: 0, l: 40 });
    }
    return;
  }
  const s = rc.s;
  const g = rc.g;
  const c = geyserCycle(m, rc.frame, d.r.phase);
  const shake = c.seg === 1 ? Math.sin(rc.frame * 1.9) * (0.4 + (c.t / c.len) * 1.1) : 0;
  const x = m.at[0] + d.off[0] + shake;
  const y = m.at[1] + d.off[1];
  const lava = m.look === 'lava';
  const v = ventOf(d);
  const LAVA = v.lava;
  const rock: HSL = lava ? { h: 260, s: 10, l: 19 } : v.rock;
  stamp(s, ventMound(rock, lava, v.crust), x, y);
  const heat = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0;
  if (lava) {
    g.fillStyle = css(LAVA, 10, 0.4 + heat * 0.6);
    ellipse(g, x, y - 6.6, 3.8, 1.2);
    glowDot(g, x, y - 7, 6 + heat * 12, LAVA, 0.35 + heat * 0.5);
    light(rc, x, y - 8, 30 + heat * 50, LAVA, 0.25 + heat * 0.7);
  }
}

function drawColumn(rc: RC, m: Geyser, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const f = rc.frame;
  const c = geyserCycle(m, f, d.r.phase);
  const pit = isPit(m, d);
  const x = m.at[0] + d.off[0];
  const base = pit ? m.at[1] + d.off[1] - 6 : m.at[1] + d.off[1] - 7;
  const lava = m.look === 'lava';
  const v = ventOf(d);
  const LAVA = v.lava;
  const HOT = v.hot;
  const emit = d.o.emit;
  if (c.seg === 1) {
    // Telegraph: glowing upwell (pit) / sputter and wisps (vent).
    const p = c.t / c.len;
    if (lava) {
      glowDot(g, x, base, 8 + p * 16, LAVA, 0.4 + p * 0.5);
      light(rc, x, base, 40 + p * 60, LAVA, 0.3 + p * 0.7);
      if (emit && Math.random() < 0.15 + p * 0.6)
        emit('ember', x + (Math.random() - 0.5) * 8, base, (Math.random() - 0.5) * 40, -60 - Math.random() * 120 * p, HOT);
      if (pit) {
        g.fillStyle = css(HOT, 0, 0.3 + p * 0.5);
        ellipse(g, x, base + 2, 6 + p * 6, 2 + p);
      }
    } else {
      // Steam warning: a sputtering hiss plume that grows (and pulses faster) until it erupts.
      const pulse = 0.5 + 0.5 * Math.sin(f * (0.25 + p * 0.5));
      const hgt = 5 + p * 20 * (0.6 + 0.4 * pulse);
      for (let i = 0; i < 5; i++) {
        const u = (i + ((f * (1 + p * 2)) % 8) / 8) / 5;
        rc.bg.fillStyle = `rgba(${v.steam},${(0.35 + p * 0.45) * (1 - u)})`;
        circle(rc.bg, x + Math.sin(i * 2.1 + f * 0.3) * 1.5, base - u * hgt, 2 + u * 3 + p * 2);
      }
      if (emit && Math.random() < 0.2 + p * 0.6)
        emit('smoke', x + (Math.random() - 0.5) * 6, base, (Math.random() - 0.5) * 20, -40 - p * 60, { h: 0, s: 0, l: 85 });
    }
    return;
  }
  const col = geyserColumn(m, f, d.r.phase, beamOf(d.o, d.r, d.mi)?.len ?? m.length, d.off[0], d.off[1]);
  if (!col) return;
  const top = col.y - col.len;
  const w = m.width;
  const k = col.k;
  if (lava) {
    // Albedo body so it reads in daylight: three flat tiers, licking at the edges, and a dark line round it.
    const n = Math.max(4, Math.ceil(col.len / 6));
    const tier = (wk: number, c: string) => {
      s.fillStyle = c;
      s.beginPath();
      for (let i = 0; i <= n; i++) s.lineTo(x - w * wk * k - Math.sin(rc.t * 18 + i * 1.3) * 1.4 * wk, col.y - (col.len * i) / n);
      for (let i = n; i >= 0; i--) s.lineTo(x + w * wk * k + Math.sin(rc.t * 16 + i * 1.7) * 1.4 * wk, col.y - (col.len * i) / n);
      s.closePath();
      s.fill();
    };
    tier(0.7, css(LAVA, -30, 1, 0, -6));
    tier(0.62, css(LAVA, -6));
    tier(0.38, css(HOT, 4));
    tier(0.16, css(HOT, 22));
    for (let yy = col.y; yy > top; yy -= 7) glowDot(g, x + Math.sin(yy * 0.3 + rc.t * 9) * 1.5, yy, w * 0.95, LAVA, 0.55 * k, 0.4);
    g.strokeStyle = css(HOT, 25, 0.9 * k);
    g.lineWidth = w * 0.25;
    g.beginPath();
    g.moveTo(x, col.y);
    g.lineTo(x, top + 4);
    g.stroke();
    // Splash crown.
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5 + Math.sin(rc.t * 7 + i) * 0.2;
      const r = 3 + (i % 2) * 2;
      const px = x + Math.cos(a) * 6 * k;
      const py = top + 2 + Math.sin(a) * 5 * k;
      s.fillStyle = css(LAVA, 0, 0.95);
      circle(s, px, py, r * 0.6 * k);
      glowDot(g, px, py, r * 2, HOT, 0.6 * k);
    }
    if (v.loop) {
      // A prominence: a loop of plasma arcing off the top and back down beside the column.
      const R = 7 + w * 0.4;
      const side = Math.sin(rc.t * 0.7 + d.r.pp.uid) > 0 ? 1 : -1;
      for (let i = 0; i <= 9; i++) {
        const a = Math.PI + (i / 9) * Math.PI;
        const px = x + side * (R + Math.cos(a) * R);
        const py = top + 8 + Math.sin(a) * R * 1.2;
        glowDot(g, px, py, 4.5, HOT, 0.55 * k);
      }
    }
    for (let yy = col.y; yy > top; yy -= 26) light(rc, x, yy, 80, LAVA, 0.9 * k);
    light(rc, x, top, 70, HOT, 0.9 * k);
    if (emit && Math.random() < 0.8) emit('ember', x + (Math.random() - 0.5) * w, top + 4, (Math.random() - 0.5) * 120, -40 - Math.random() * 90, HOT);
    if (emit && Math.random() < 0.25) emit('smoke', x, top, (Math.random() - 0.5) * 30, -30, { h: 10, s: 10, l: 30 });
  } else {
    // Steam: billowing puffs rising at the updraft's air speed, widening and
    // thinning toward the tip where the push tapers off (same profile as the sim).
    const wind = geyserWind(m, col);
    const step = wind.speed / 60;
    for (let i = 0; i < col.len / 5; i++) {
      const along = (i * 5 + f * step) % col.len;
      const u = along / col.len;
      const yy = col.y - along;
      const push = Math.max(0, windProfile(wind, yy - wind.y));
      const r = (w * 0.45 + u * w * 0.5) * k;
      rc.bg.fillStyle = `rgba(${v.steam},${0.55 * (1 - u * 0.5) * (0.35 + 0.65 * push)})`;
      circle(rc.bg, x + Math.sin(i * 2.3 + f * 0.1) * 2 * u, yy, r);
    }
    rc.bg.fillStyle = 'rgba(255,255,255,0.75)';
    circle(rc.bg, x, col.y - 2, w * 0.4 * k);
    if (v.flakes) {
      // Snow riding the updraft: little six-point flakes, on the sim's own clock.
      g.fillStyle = 'rgba(245,250,255,0.9)';
      for (let i = 0; i < 6; i++) {
        const along = (i * 13 + f * step * 0.8) % col.len;
        const fx = x + Math.sin(i * 1.9 + f * 0.05) * w * 0.6;
        const fy = col.y - along;
        for (let a = 0; a < 3; a++) {
          const ca = Math.cos((a * Math.PI) / 3) * 1.4;
          const sa = Math.sin((a * Math.PI) / 3) * 1.4;
          g.fillRect(fx - ca - 0.2, fy - sa - 0.2, 0.4, 0.4);
          g.fillRect(fx + ca - 0.2, fy + sa - 0.2, 0.4, 0.4);
        }
        g.fillRect(fx - 0.3, fy - 0.3, 0.6, 0.6);
      }
    }
    if (emit && Math.random() < 0.6)
      emit('smoke', x + (Math.random() - 0.5) * w, top + 4, (Math.random() - 0.5) * 50, -50 - Math.random() * 40, { h: 0, s: 0, l: 92 });
  }
}

defineArt<'geyser'>({ type: 'geyser', layer: 1, draw: (rc, m, d) => drawVent(rc, m, d) });
defineArt<'geyser'>({ type: 'geyser', layer: 3, draw: (rc, m, d) => drawColumn(rc, m, d) });
