import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { geyserColumn, geyserCycle, geyserWind, type ModuleOf } from '../../../sim/props';
import { windProfile } from '../../../sim/wind';
import { circle, ellipse, glowDot, light, type RC, sphereFill } from '../../kit';
import { beamOf, type DrawCtx, defineArt } from '../common';

/**
 * Geyser art: a vent mound (ground vents), a rumbling telegraph, and the
 * erupting column — drawn from geyserCycle / geyserColumn / geyserWind, the
 * sim's own cycle and shapes. Three readable phases, all on the sim frame:
 * dormant (still: nothing moves, nothing pushes), rumbling (shake, sputter
 * and a growing hiss plume: the warning), erupting (the column; steam puffs
 * travel at the updraft's air speed and thin out where its push tapers).
 */

type Geyser = ModuleOf<'geyser'>;

const LAVA: HSL = { h: 22, s: 100, l: 52 };
const HOT: HSL = { h: 42, s: 100, l: 66 };

function isPit(m: Geyser, d: DrawCtx): boolean {
  return !!d.o.level && m.at[1] >= d.o.level.h * TILE - 1;
}

function drawVent(rc: RC, m: Geyser, d: DrawCtx) {
  if (isPit(m, d)) return;
  const s = rc.s;
  const g = rc.g;
  const c = geyserCycle(m, rc.frame, d.r.phase);
  const shake = c.seg === 1 ? Math.sin(rc.frame * 1.9) * (0.4 + (c.t / c.len) * 1.1) : 0;
  const x = m.at[0] + d.off[0] + shake;
  const y = m.at[1] + d.off[1];
  const lava = m.look === 'lava';
  const rock: HSL = lava ? { h: 260, s: 10, l: 19 } : { h: 30, s: 12, l: 40 };
  s.fillStyle = sphereFill(s, x - 3, y - 6, 14, rock, 16, 10);
  s.beginPath();
  s.moveTo(x - 13, y + 0.5);
  s.quadraticCurveTo(x - 9, y - 4, x - 4, y - 7);
  s.lineTo(x + 4, y - 7);
  s.quadraticCurveTo(x + 9, y - 4, x + 13, y + 0.5);
  s.closePath();
  s.fill();
  s.strokeStyle = css(rock, -12);
  s.lineWidth = 1;
  s.stroke();
  // Crater lip.
  s.fillStyle = lava ? '#1a0805' : '#2c2a28';
  ellipse(s, x, y - 7, 4.5, 1.6);
  if (!lava) {
    // Sulphur crust.
    s.fillStyle = 'rgba(230,210,90,0.75)';
    for (const [dx, dy, r] of [
      [-6, -4, 1.4],
      [5, -3, 1.1],
      [-2, -6.5, 0.9],
    ])
      circle(s, x + dx, y + dy, r);
  }
  const heat = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0;
  if (lava) {
    g.fillStyle = css(LAVA, 10, 0.4 + heat * 0.6);
    ellipse(g, x, y - 7, 3.5, 1.2);
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
        s.fillStyle = `rgba(240,244,248,${(0.35 + p * 0.45) * (1 - u)})`;
        circle(s, x + Math.sin(i * 2.1 + f * 0.3) * 1.5, base - u * hgt, 2 + u * 3 + p * 2);
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
    // Albedo body so it reads in daylight, emissive core on top.
    const gr = s.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, css(LAVA, -25, 0.0));
    gr.addColorStop(0.25, css(LAVA, -10, 0.9));
    gr.addColorStop(0.5, css(HOT, 10, 1));
    gr.addColorStop(0.75, css(LAVA, -10, 0.9));
    gr.addColorStop(1, css(LAVA, -25, 0));
    s.fillStyle = gr;
    s.beginPath();
    const n = Math.max(4, Math.ceil(col.len / 6));
    for (let i = 0; i <= n; i++) {
      const yy = col.y - (col.len * i) / n;
      s.lineTo(x - w * 0.62 * k - Math.sin(rc.t * 18 + i * 1.3) * 1.4, yy);
    }
    for (let i = n; i >= 0; i--) {
      const yy = col.y - (col.len * i) / n;
      s.lineTo(x + w * 0.62 * k + Math.sin(rc.t * 16 + i * 1.7) * 1.4, yy);
    }
    s.closePath();
    s.fill();
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
      s.fillStyle = `rgba(240,244,248,${0.55 * (1 - u * 0.5) * (0.35 + 0.65 * push)})`;
      circle(s, x + Math.sin(i * 2.3 + f * 0.1) * 2 * u, yy, r);
    }
    s.fillStyle = 'rgba(255,255,255,0.75)';
    circle(s, x, col.y - 2, w * 0.4 * k);
    if (emit && Math.random() < 0.6)
      emit('smoke', x + (Math.random() - 0.5) * w, top + 4, (Math.random() - 0.5) * 50, -50 - Math.random() * 40, { h: 0, s: 0, l: 92 });
  }
}

defineArt<'geyser'>({ type: 'geyser', layer: 1, draw: (rc, m, d) => drawVent(rc, m, d) });
defineArt<'geyser'>({ type: 'geyser', layer: 3, draw: (rc, m, d) => drawColumn(rc, m, d) });
