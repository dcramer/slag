import { css, type HSL } from '../../../core/color';
import type { Rect } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import { type ModuleOf, type RotorArm, rotorAngles, rotorArms, rotorPlatform } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { circle, ellipse, glowDot, light, METALS, metalFill, type RC, rivet, rrect, sphereFill } from '../../kit';
import { BACKDROP, type DrawCtx, defineArt } from '../common';
import { ceilingAbovePx, chain, groundBelowPx, lattice, plank, rope } from './setpiece';

/**
 * Rotor art: windmills, cog lifts and pendulum platforms (chandelier, hay
 * bale, vine log, basalt slab, crane crate, ore bucket, window gondola).
 * Every moving part is placed with rotorArms/rotorPlatform — the same pose
 * functions the sim uses — so what you see is exactly what you stand on.
 * Supports are scenery and stand behind the terrain; sails, links and
 * platforms stay in front of it.
 */

type Rotor = ModuleOf<'rotor'>;

const PENDULUM_LINK: Record<string, 'chain' | 'rope' | 'vine' | 'cable'> = {
  chandelier: 'chain',
  hay: 'rope',
  log: 'vine',
  slab: 'chain',
  crane: 'cable',
  bucket: 'chain',
  gondola: 'cable',
};

function hub(m: Rotor, d: DrawCtx): [number, number] {
  return [m.hub[0] + d.off[0], m.hub[1] + d.off[1]];
}

// ---------------------------------------------------------------------------
// Backdrop: supports. Layer 0: arms.

function drawSupport(rc: RC, m: Rotor, d: DrawCtx) {
  const s = rc.s;
  const [hx, hy] = hub(m, d);
  const lv = d.o.level;
  const st = d.style;
  if (m.support === 'tower') {
    const gy = groundBelowPx(lv, hx, hy + 8);
    if (m.look === 'windmill') {
      const top = hy - 9;
      const tw = 8;
      const bw = Math.min(30, 12 + (gy - hy) * 0.18);
      const wall: HSL = { h: st.woodHue, s: 22, l: 80 };
      s.fillStyle = 'rgba(0,0,0,0.25)';
      s.beginPath();
      s.moveTo(hx - tw + 2, top + 2);
      s.lineTo(hx + tw + 2, top + 2);
      s.lineTo(hx + bw + 2, gy);
      s.lineTo(hx - bw + 2, gy);
      s.fill();
      const g = s.createLinearGradient(hx - bw, 0, hx + bw, 0);
      g.addColorStop(0, css(wall, 6));
      g.addColorStop(0.55, css(wall, -4));
      g.addColorStop(1, css(wall, -26));
      s.fillStyle = g;
      s.beginPath();
      s.moveTo(hx - tw, top);
      s.lineTo(hx + tw, top);
      s.lineTo(hx + bw, gy);
      s.lineTo(hx - bw, gy);
      s.closePath();
      s.fill();
      s.strokeStyle = css(wall, -45);
      s.lineWidth = 1;
      s.stroke();
      // Clapboard lines.
      s.save();
      s.clip();
      s.strokeStyle = css(wall, -22, 0.6);
      s.lineWidth = 0.6;
      for (let y = top + 4; y < gy; y += 4) {
        s.beginPath();
        s.moveTo(hx - bw, y);
        s.lineTo(hx + bw, y);
        s.stroke();
      }
      s.restore();
      // Window and door.
      const mid = top + (gy - top) * 0.45;
      if (gy - top > 40) {
        s.fillStyle = '#2a2018';
        rrect(s, hx - 3, mid - 4, 6, 8, [3, 3, 0, 0]);
        s.fill();
        s.strokeStyle = css({ h: st.hue, s: 50, l: 40 });
        s.lineWidth = 1;
        s.stroke();
      }
      if (lv && gy <= lv.h * 16) {
        s.fillStyle = css({ h: st.hue, s: 45, l: 32 });
        rrect(s, hx - 5, gy - 13, 10, 13, [5, 5, 0, 0]);
        s.fill();
        s.strokeStyle = css({ h: st.hue, s: 45, l: 18 });
        s.stroke();
        s.fillStyle = '#d8c070';
        circle(s, hx + 2.5, gy - 6, 0.8);
      }
      // Cap roof behind the hub.
      s.fillStyle = css({ h: st.hue, s: 40, l: 34 });
      s.beginPath();
      s.moveTo(hx - 12, top + 2);
      s.quadraticCurveTo(hx, top - 18, hx + 12, top + 2);
      s.closePath();
      s.fill();
      s.strokeStyle = css({ h: st.hue, s: 40, l: 18 });
      s.lineWidth = 1;
      s.stroke();
      s.strokeStyle = css({ h: st.hue, s: 40, l: 50 }, 0, 0.5);
      s.beginPath();
      s.moveTo(hx - 7, top - 4);
      s.quadraticCurveTo(hx, top - 12, hx + 4, top - 8);
      s.stroke();
    } else {
      // Girder tower for cog lifts.
      lattice(s, hx - 5, hy, gy, 7, d.pal);
      lattice(s, hx + 5, hy, gy, 7, d.pal);
      s.fillStyle = metalFill(s, d.pal, hx - 14, gy - 4, 28, 4);
      s.fillRect(hx - 14, gy - 4, 28, 4);
    }
    return;
  }
  if (m.support === 'ceiling') {
    const cy = ceilingAbovePx(lv, hx, hy);
    if (m.look === 'log') {
      // Vines dangle from the canopy to the pivot branch.
      rope(s, hx - 1, cy, hx - 1, hy, { h: 105, s: 40, l: 30 }, 1.6, 1.5);
      leaves(s, hx, cy, hy, d.r.pp.uid);
      s.fillStyle = css({ h: st.woodHue, s: 35, l: 26 });
      rrect(s, hx - 10, hy - 2.5, 20, 5, 2.5);
      s.fill();
    } else {
      chain(s, hx, cy, hx, hy - 3, d.pal, 3.6);
      if (cy > 0) {
        s.fillStyle = metalFill(s, d.pal, hx - 6, cy, 12, 3);
        rrect(s, hx - 6, cy - 0.5, 12, 3.5, 1);
        s.fill();
        rivet(s, hx - 3.5, cy + 1.2, d.pal, 0.8);
        rivet(s, hx + 3.5, cy + 1.2, d.pal, 0.8);
      }
    }
    return;
  }
  if (m.support === 'mast') {
    const mx = m.mastX + d.off[0];
    const gy = groundBelowPx(lv, mx, hy);
    const side = Math.sign(hx - mx) || 1;
    const topY = hy - 7;
    if (m.look === 'crane') {
      const paint: HSL = { h: st.hue, s: 80, l: 50 };
      lattice(s, mx, topY - 6, gy, 9, d.pal, paint);
      // Jib out to the trolley and a counter-jib with a weight.
      for (const [y0, y1] of [
        [topY - 6, hy - 3],
        [topY, hy - 1],
      ]) {
        s.strokeStyle = css(paint, -25);
        s.lineWidth = 2.2;
        s.beginPath();
        s.moveTo(mx - side * 18, y0);
        s.lineTo(hx + side * 8, y1);
        s.stroke();
        s.strokeStyle = css(paint);
        s.lineWidth = 1.2;
        s.stroke();
      }
      s.strokeStyle = css(paint, -10);
      s.lineWidth = 0.8;
      s.beginPath();
      for (let x = mx; Math.abs(x - mx) < Math.abs(hx - mx) + 6; x += side * 7) {
        const t = (x - mx) / (hx - mx || 1);
        const ya = topY - 6 + (hy - 3 - (topY - 6)) * t;
        const yb = topY + (hy - 1 - topY) * t;
        s.moveTo(x, ya);
        s.lineTo(x + side * 3.5, yb);
        s.lineTo(x + side * 7, ya + ((hy - 3 - (topY - 6)) * 7) / Math.abs(hx - mx || 1));
      }
      s.stroke();
      s.fillStyle = '#3b3f48';
      rrect(s, mx - side * 18 - 5, topY - 5, 9, 9, 1.5);
      s.fill();
      // Operator cab with a lit window.
      s.fillStyle = css(paint, -8);
      rrect(s, mx + side * 3 - 5, topY + 3, 10, 9, 1.5);
      s.fill();
      s.fillStyle = '#9fd4ee';
      s.fillRect(mx + side * 3 - 3, topY + 5, 6, 4);
      rc.g.fillStyle = 'rgba(255,220,150,0.35)';
      rc.g.fillRect(mx + side * 3 - 3, topY + 5, 6, 4);
      // Trolley on the jib.
      s.fillStyle = '#2d3038';
      rrect(s, hx - 4, hy - 5, 8, 5, 1);
      s.fill();
      // Red beacon.
      const blink = Math.sin(rc.t * 3 + d.r.pp.uid) > 0.4;
      s.fillStyle = blink ? '#ff4030' : '#702020';
      circle(s, mx, topY - 8, 1.6);
      if (blink) {
        glowDot(rc.g, mx, topY - 8, 9, { h: 5, s: 100, l: 55 }, 0.9);
        light(rc, mx, topY - 8, 40, { h: 5, s: 100, l: 55 }, 0.5);
      }
    } else if (m.look === 'hay') {
      const wood: HSL = { h: st.woodHue, s: 40, l: 34 };
      s.fillStyle = css(wood, -6);
      rrect(s, mx - 3.5, topY - 3, 7, gy - topY + 3, 1);
      s.fill();
      s.strokeStyle = css(wood, -22);
      s.lineWidth = 1;
      s.stroke();
      s.fillStyle = css(wood, 4);
      rrect(s, Math.min(mx, hx) - 6, topY - 4, Math.abs(hx - mx) + 12, 6, 1.5);
      s.fill();
      s.stroke();
      // Diagonal brace.
      s.strokeStyle = css(wood, -10);
      s.lineWidth = 3;
      s.beginPath();
      s.moveTo(mx, topY + 18);
      s.lineTo(mx + side * 16, topY + 1);
      s.stroke();
      // Pulley wheel.
      s.fillStyle = css(wood, -20);
      circle(s, hx, hy - 1, 3.5);
      s.fillStyle = '#c9b58a';
      circle(s, hx, hy - 1, 1.2);
    } else {
      // Rooftop davit: a steel pipe curving out over the edge.
      s.lineCap = 'round';
      for (const [w, c] of [
        [4.5, css(d.pal.dark, -8)],
        [3, css(d.pal.base, 6)],
      ] as const) {
        s.strokeStyle = c;
        s.lineWidth = w;
        s.beginPath();
        s.moveTo(mx, gy);
        s.lineTo(mx, topY + 8);
        s.quadraticCurveTo(mx, topY - 2, mx + side * 10, topY - 2);
        s.lineTo(hx + side * 2, topY - 2);
        s.stroke();
      }
      s.fillStyle = metalFill(s, d.pal, mx - 6, gy - 4, 12, 4);
      s.fillRect(mx - 6, gy - 4, 12, 4);
      s.fillStyle = '#2d3038';
      circle(s, hx, hy - 1, 3);
    }
  }
}

function leaves(s: CanvasRenderingContext2D, x: number, y0: number, y1: number, seed: number) {
  for (let y = Math.max(y0, -10) + 4; y < y1 - 2; y += 7) {
    const k = hash2(Math.floor(y), seed, 3);
    const side = k > 0.5 ? 1 : -1;
    s.fillStyle = css({ h: 100 + k * 30, s: 50, l: 32 + k * 10 });
    ellipse(s, x + side * 2.5, y, 2.6, 1.3, side * 0.6);
  }
}

function drawArms(rc: RC, m: Rotor, d: DrawCtx, arms: RotorArm[]) {
  const s = rc.s;
  const [hx, hy] = hub(m, d);
  const st = d.style;
  if (m.look === 'windmill') {
    const wood: HSL = { h: st.woodHue, s: 40, l: 30 };
    const cloth: HSL = { h: 40, s: 30, l: 88 };
    for (const a of arms) {
      s.save();
      s.translate(hx, hy);
      s.rotate(a.a);
      const L = m.arm;
      const x0 = L * 0.2;
      const x1 = L - 5;
      const w = Math.min(14, L * 0.24);
      // Canvas cloth on the trailing side, lattice over it.
      s.fillStyle = css(cloth, 0, 0.82);
      s.fillRect(x0, 1.5, x1 - x0, w);
      s.strokeStyle = css(wood, 0);
      s.lineWidth = 1;
      s.strokeRect(x0, 1.5, x1 - x0, w);
      s.lineWidth = 0.6;
      s.beginPath();
      for (let x = x0 + 5; x < x1; x += 5) {
        s.moveTo(x, 1.5);
        s.lineTo(x, 1.5 + w);
      }
      for (let k = 1; k < 3; k++) {
        s.moveTo(x0, 1.5 + (w * k) / 3);
        s.lineTo(x1, 1.5 + (w * k) / 3);
      }
      s.stroke();
      s.restore();
      // Main spar.
      s.lineCap = 'round';
      s.strokeStyle = css(wood, -12);
      s.lineWidth = 3.4;
      s.beginPath();
      s.moveTo(hx, hy);
      s.lineTo(a.x, a.y);
      s.stroke();
      s.strokeStyle = css(wood, 8);
      s.lineWidth = 1.6;
      s.stroke();
    }
    return;
  }
  if (m.look === 'cog') {
    inkCog(rc, m, d, arms, hx, hy);
    return;
  }
  // Pendulums: link from the pivot to the platform.
  const link = PENDULUM_LINK[m.look] ?? 'rope';
  for (const a of arms) {
    const p = rotorPlatform(m, a);
    const crownY = p.y - (m.look === 'crane' ? 9 : m.look === 'bucket' ? 7 : 6);
    const ends: [number, number][] =
      m.look === 'log' || m.look === 'gondola'
        ? [
            [p.x + 4, p.y + 1],
            [p.x + p.w - 4, p.y + 1],
          ]
        : m.look === 'bucket'
          ? []
          : [
              [p.x + 3, p.y],
              [p.x + p.w - 3, p.y],
            ];
    const direct = m.look === 'log' || m.look === 'gondola';
    const draw = (x1: number, y1: number, x2: number, y2: number) => {
      if (link === 'chain') chain(s, x1, y1, x2, y2, d.pal, 3.2);
      else if (link === 'vine') rope(s, x1, y1, x2, y2, { h: 100, s: 45, l: 32 }, 1.5, 1);
      else if (link === 'cable') {
        s.strokeStyle = '#26282e';
        s.lineWidth = 1.1;
        s.beginPath();
        s.moveTo(x1, y1);
        s.lineTo(x2, y2);
        s.stroke();
      } else rope(s, x1, y1, x2, y2, { h: 38, s: 40, l: 55 }, 1.2, 0.5);
    };
    if (direct) for (const [ex, ey] of ends) draw(hx, hy, ex, ey);
    else {
      draw(hx, hy, a.x, crownY);
      for (const [ex, ey] of ends) draw(a.x, crownY, ex, ey);
    }
    if (m.look === 'log') leavesAlong(s, hx, hy, ends, d.r.pp.uid);
    if (m.look === 'crane') {
      // Hook.
      s.strokeStyle = '#30333a';
      s.lineWidth = 2;
      s.beginPath();
      s.arc(a.x, crownY + 2.5, 2.5, -Math.PI * 0.1, Math.PI * 1.15);
      s.stroke();
      s.fillStyle = css({ h: d.style.hue, s: 80, l: 50 });
      rrect(s, a.x - 2.5, crownY - 5, 5, 4, 1);
      s.fill();
    }
  }
}

function leavesAlong(s: CanvasRenderingContext2D, hx: number, hy: number, ends: [number, number][], seed: number) {
  for (const [ex, ey] of ends) {
    const n = Math.floor(Math.hypot(ex - hx, ey - hy) / 9);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const k = hash2(i, seed, ex > hx ? 1 : 2);
      s.fillStyle = css({ h: 95 + k * 35, s: 55, l: 30 + k * 12 });
      ellipse(s, hx + (ex - hx) * t + (k - 0.5) * 3, hy + (ey - hy) * t, 2.4, 1.2, k * 3);
    }
  }
}

/**
 * A cog lift's wheel: a hand-cut gear whose shadow stays where the light puts it while the teeth turn,
 * on inked spokes out to each paddle.
 */
function inkCog(rc: RC, m: Rotor, d: DrawCtx, arms: RotorArm[], hx: number, hy: number) {
  const s = rc.s;
  const pal = d.pal;
  const ink = css({ h: pal.dark.h, s: pal.dark.s, l: 8 });
  for (const a of arms) {
    s.fillStyle = ink;
    line(s, hx, hy, a.x, a.y, { w: 4.4, seed: 3, taper: [0, 0], press: 0 });
    s.fillStyle = css(pal.base, -8);
    line(s, hx, hy, a.x, a.y, { w: 2.2, seed: 3, taper: [0, 0], press: 0 });
  }
  const base = rotorAngles(m, rc.frame, d.r.phase)[0];
  const R = Math.min(m.arm * 0.5, 30);
  const teeth = Math.max(10, Math.round(R * 0.55));
  const pts: P[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = base + (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    const wob = 1 + (hash2(i, 1, m.seed) - 0.5) * 0.05;
    for (const [u, r] of [
      [0, R],
      [0.1, R + 3.6 * wob],
      [0.45, R + 3.6 * wob],
      [0.57, R],
    ] as const)
      pts.push({ x: hx + Math.cos(a0 + da * u) * r, y: hy + Math.sin(a0 + da * u) * r });
  }
  const path = () => {
    s.beginPath();
    pts.forEach((q, i) => (i ? s.lineTo(q.x, q.y) : s.moveTo(q.x, q.y)));
    s.closePath();
  };
  s.fillStyle = css(pal.dark, 8);
  path();
  s.fill();
  s.save();
  s.clip();
  // The lit face: a disc shifted toward the light, fixed while the gear turns.
  s.fillStyle = css(pal.base);
  s.beginPath();
  s.arc(hx - R * 0.12, hy - R * 0.14, R * 1.08, 0, Math.PI * 2);
  s.fill();
  s.fillStyle = css(pal.light, -6);
  s.beginPath();
  s.arc(hx - R * 0.12, hy - R * 0.14, R * 0.86, Math.PI * 1.05, Math.PI * 1.6);
  s.arc(hx - R * 0.12, hy - R * 0.14, R * 0.72, Math.PI * 1.6, Math.PI * 1.05, true);
  s.fill();
  s.restore();
  s.fillStyle = ink;
  stroke(s, [...pts, pts[0], pts[1]], { w: 1.3, seed: m.seed & 0xffff, taper: [0.01, 0.01], press: 0.35 });
  // Lightening holes, each a dark with a lit far rim, inked.
  for (let i = 0; i < 5; i++) {
    const a = base + (i / 5) * Math.PI * 2;
    const cx = hx + Math.cos(a) * R * 0.58;
    const cy = hy + Math.sin(a) * R * 0.58;
    const r = R * 0.19;
    s.fillStyle = css(pal.base, -6);
    blob(s, cx, cy, r, i + 3, 1, 0.05);
    s.fill();
    s.fillStyle = css(pal.dark, -12);
    blob(s, cx - r * 0.25, cy - r * 0.25, r * 0.92, i + 3, 1, 0.05);
    s.fill();
    s.fillStyle = ink;
    const ring: P[] = [];
    for (let k = 0; k <= 10; k++) ring.push({ x: cx + Math.cos((k / 10) * Math.PI * 2) * r, y: cy + Math.sin((k / 10) * Math.PI * 2) * r });
    stroke(s, ring, { w: 0.8, seed: i, taper: [0.1, 0.4] });
  }
}

/** A cog lift's paddle: a steel tread plate with a hazard lip and grip slots, inked. */
function inkPaddle(s: CanvasRenderingContext2D, p: Rect, d: DrawCtx, a: RotorArm, seed: number) {
  const pal = d.pal;
  const ink = css({ h: pal.dark.h, s: pal.dark.s, l: 8 });
  const r = 2;
  const box = (x: number, y: number, w: number, h: number) => {
    s.beginPath();
    s.roundRect(x, y, w, h, r);
  };
  s.fillStyle = css(pal.dark, 10);
  box(p.x, p.y, p.w, p.h);
  s.fill();
  s.save();
  s.clip();
  s.fillStyle = css(pal.base);
  box(p.x - 1.2, p.y - 1.2, p.w, p.h);
  s.fill();
  // Hazard lip along the top, flat.
  s.fillStyle = '#1b1a18';
  s.fillRect(p.x, p.y, p.w, 2.2);
  s.fillStyle = 'rgb(246 196 38)';
  for (let x = p.x - 4; x < p.x + p.w + 4; x += 5) {
    s.beginPath();
    s.moveTo(x, p.y + 2.2);
    s.lineTo(x + 2.5, p.y + 2.2);
    s.lineTo(x + 4.7, p.y);
    s.lineTo(x + 2.2, p.y);
    s.fill();
  }
  s.fillStyle = ink;
  for (let x = p.x + 3.5; x < p.x + p.w - 3; x += 4.2) line(s, x, p.y + 3.8, x, p.y + p.h - 1.4, { w: 1.1, seed: seed + x, taper: [0.15, 0.15], press: 0.1 });
  s.restore();
  // The outline, heavy underneath.
  s.fillStyle = ink;
  line(s, p.x + 0.5, p.y + p.h, p.x + p.w - 0.5, p.y + p.h, { w: 1.9, seed, taper: [0.1, 0.1], press: 0.3 });
  line(s, p.x + p.w, p.y + 0.5, p.x + p.w, p.y + p.h - 0.5, { w: 1.6, seed: seed + 1, taper: [0.1, 0.1], press: 0.3 });
  line(s, p.x + 0.5, p.y, p.x + p.w - 0.5, p.y, { w: 0.9, seed: seed + 2, taper: [0.1, 0.2], press: 0.3 });
  line(s, p.x, p.y + 0.5, p.x, p.y + p.h - 0.5, { w: 0.9, seed: seed + 3, taper: [0.1, 0.2], press: 0.3 });
  s.fillStyle = ink;
  blob(s, a.x, a.y + 1, 1.3, seed, 1, 0.1);
  s.fill();
}

// ---------------------------------------------------------------------------
// Layer 1: the platforms you stand on.

function drawPlatform(rc: RC, m: Rotor, d: DrawCtx, a: RotorArm, i: number) {
  const s = rc.s;
  const g = rc.g;
  const p = rotorPlatform(m, a);
  const st = d.style;
  const seed = d.r.pp.uid * 7 + i;
  switch (m.look) {
    case 'windmill':
      plank(s, p.x, p.y, p.w, p.h, st.woodHue, seed, 42);
      s.fillStyle = css(d.pal.dark);
      circle(s, a.x, a.y, 1.6);
      break;
    case 'cog':
      inkPaddle(s, p, d, a, seed);
      break;
    case 'chandelier':
      drawChandelier(rc, p, d, seed);
      break;
    case 'hay':
      drawHay(s, p, seed);
      break;
    case 'log':
      drawLog(s, p, st.woodHue, seed);
      break;
    case 'slab':
      drawSlab(rc, p, seed);
      break;
    case 'crane':
      drawCrate(s, p, st.woodHue, st.hue, seed);
      break;
    case 'bucket':
      drawBucket(rc, p, d, a, seed);
      break;
    case 'gondola':
      drawGondola(s, p, d);
      break;
  }
  void g;
}

function drawChandelier(rc: RC, p: Rect, d: DrawCtx, seed: number) {
  const s = rc.s;
  const g = rc.g;
  const pal = d.pal;
  const cx = p.x + p.w / 2;
  // Hanging crystal drops (behind).
  for (let k = 0; k < 5; k++) {
    const x = p.x + 5 + ((p.w - 10) * k) / 4;
    const len = 4 + (k % 2) * 3;
    s.strokeStyle = css(pal.light, 0, 0.6);
    s.lineWidth = 0.5;
    s.beginPath();
    s.moveTo(x, p.y + p.h);
    s.lineTo(x, p.y + p.h + len);
    s.stroke();
    s.fillStyle = 'rgba(220,240,255,0.9)';
    ellipse(s, x, p.y + p.h + len + 1.2, 1, 1.6);
    glowDot(g, x, p.y + p.h + len + 1, 3, { h: 200, s: 60, l: 80 }, 0.25);
  }
  // The ring, seen side-on, with scrolled ends.
  s.fillStyle = 'rgba(0,0,0,0.3)';
  rrect(s, p.x + 1, p.y + 2, p.w, p.h, p.h / 2);
  s.fill();
  s.fillStyle = metalFill(s, pal, p.x, p.y, p.w, p.h);
  rrect(s, p.x, p.y, p.w, p.h, p.h / 2);
  s.fill();
  s.strokeStyle = css(pal.dark, -6);
  s.lineWidth = 1;
  s.stroke();
  s.strokeStyle = css(pal.dark);
  s.lineWidth = 1.2;
  for (const sx of [-1, 1]) {
    s.beginPath();
    s.arc(cx + sx * (p.w / 2 + 1), p.y + p.h / 2 - 2, 3, sx > 0 ? Math.PI * 0.5 : Math.PI * 0.5, sx > 0 ? Math.PI * 2.1 : -Math.PI * 1.1, sx < 0);
    s.stroke();
  }
  for (let x = p.x + 4; x < p.x + p.w - 2; x += 5) {
    s.fillStyle = css(pal.light, 0, 0.7);
    circle(s, x, p.y + p.h / 2, 0.9);
  }
  // Candles on cups along the top.
  const flame: HSL = { h: d.style.glowHue, s: 100, l: 62 };
  const n = Math.max(3, Math.round(p.w / 10));
  for (let k = 0; k < n; k++) {
    const x = p.x + 4 + ((p.w - 8) * k) / (n - 1);
    const h = 4 + hash2(k, seed, 9) * 2;
    s.fillStyle = css(pal.base, 8);
    rrect(s, x - 2.2, p.y - 1.5, 4.4, 1.8, 0.8);
    s.fill();
    s.fillStyle = '#f2ead6';
    s.fillRect(x - 1.1, p.y - 1.5 - h, 2.2, h);
    s.fillStyle = 'rgba(0,0,0,0.15)';
    s.fillRect(x + 0.3, p.y - 1.5 - h, 0.8, h);
    const fy = p.y - 3.8 - h;
    const fl = 1 + Math.sin(rc.t * 13 + k * 2.1 + seed) * 0.18;
    g.fillStyle = css({ h: 48, s: 100, l: 80 }, 0, 0.95);
    ellipse(g, x, fy, 0.9, 2 * fl);
    glowDot(g, x, fy, 7 * fl, flame, 0.75);
    if (k % 2 === 0) light(rc, x, fy, 46, flame, 0.55);
  }
}

function drawHay(s: CanvasRenderingContext2D, p: Rect, seed: number) {
  const base: HSL = { h: 46, s: 70, l: 58 };
  s.fillStyle = 'rgba(0,0,0,0.28)';
  rrect(s, p.x + 1, p.y + 2, p.w, p.h, 3);
  s.fill();
  const gr = s.createLinearGradient(0, p.y, 0, p.y + p.h);
  gr.addColorStop(0, css(base, 14));
  gr.addColorStop(1, css(base, -16));
  s.fillStyle = gr;
  rrect(s, p.x, p.y, p.w, p.h, 3);
  s.fill();
  s.save();
  s.clip();
  s.lineWidth = 0.6;
  for (let k = 0; k < p.w * 1.4; k++) {
    const x = p.x + hash2(k, seed, 1) * p.w;
    const y = p.y + hash2(k, seed, 2) * p.h;
    s.strokeStyle = css(base, hash2(k, seed, 3) > 0.5 ? 18 : -18, 0.8);
    s.beginPath();
    s.moveTo(x, y);
    s.lineTo(x + 2.5 + hash2(k, seed, 4) * 2, y + (hash2(k, seed, 5) - 0.5) * 1.5);
    s.stroke();
  }
  s.restore();
  s.strokeStyle = css(base, -30);
  s.lineWidth = 0.9;
  rrect(s, p.x, p.y, p.w, p.h, 3);
  s.stroke();
  // Twine.
  s.strokeStyle = '#7a3f22';
  s.lineWidth = 1.2;
  for (const t of [0.28, 0.72]) {
    s.beginPath();
    s.moveTo(p.x + p.w * t, p.y);
    s.lineTo(p.x + p.w * t, p.y + p.h);
    s.stroke();
  }
  // Stray straws.
  s.strokeStyle = css(base, 20);
  s.lineWidth = 0.6;
  for (let k = 0; k < 4; k++) {
    const x = p.x + 3 + hash2(k, seed, 7) * (p.w - 6);
    s.beginPath();
    s.moveTo(x, p.y + 0.5);
    s.lineTo(x + (hash2(k, seed, 8) - 0.5) * 5, p.y - 2);
    s.stroke();
  }
}

function drawLog(s: CanvasRenderingContext2D, p: Rect, woodHue: number, seed: number) {
  const bark: HSL = { h: woodHue - 4, s: 35, l: 27 };
  const r = p.h / 2 + 1;
  s.fillStyle = 'rgba(0,0,0,0.3)';
  rrect(s, p.x + 1, p.y + 2, p.w, p.h + 2, r);
  s.fill();
  const gr = s.createLinearGradient(0, p.y - 1, 0, p.y + p.h + 1);
  gr.addColorStop(0, css(bark, 14));
  gr.addColorStop(0.4, css(bark, 2));
  gr.addColorStop(1, css(bark, -12));
  s.fillStyle = gr;
  rrect(s, p.x, p.y - 1, p.w, p.h + 2, r);
  s.fill();
  s.save();
  s.clip();
  s.strokeStyle = css(bark, -14, 0.8);
  s.lineWidth = 0.7;
  for (let k = 0; k < p.w / 3; k++) {
    const x = p.x + hash2(k, seed, 1) * p.w;
    const y = p.y + hash2(k, seed, 2) * p.h;
    s.beginPath();
    s.moveTo(x, y);
    s.lineTo(x + 4 + hash2(k, seed, 3) * 5, y + 0.3);
    s.stroke();
  }
  // Moss on top.
  s.fillStyle = css({ h: 95, s: 50, l: 36 }, 0, 0.9);
  for (let x = p.x + 2; x < p.x + p.w - 2; x += 3) {
    const k = hash2(Math.floor(x), seed, 4);
    if (k > 0.35) ellipse(s, x, p.y - 0.5, 2 + k, 1.2 + k * 0.6);
  }
  s.restore();
  // Cut end showing rings.
  const ex = p.x + p.w - r * 0.4;
  const ey = p.y + p.h / 2;
  s.fillStyle = css({ h: woodHue + 6, s: 45, l: 62 });
  ellipse(s, ex, ey, r * 0.55, r);
  s.strokeStyle = css({ h: woodHue, s: 40, l: 42 }, 0, 0.8);
  s.lineWidth = 0.5;
  for (const k of [0.35, 0.65]) {
    s.beginPath();
    s.ellipse(ex, ey, r * 0.55 * k, r * k, 0, 0, Math.PI * 2);
    s.stroke();
  }
}

function drawSlab(rc: RC, p: Rect, seed: number) {
  const s = rc.s;
  const g = rc.g;
  const rock: HSL = { h: 260, s: 10, l: 20 };
  s.fillStyle = 'rgba(0,0,0,0.3)';
  rrect(s, p.x + 1, p.y + 2, p.w, p.h + 1, 2);
  s.fill();
  s.beginPath();
  s.moveTo(p.x + 1, p.y);
  s.lineTo(p.x + p.w - 1, p.y);
  s.lineTo(p.x + p.w, p.y + p.h * 0.6);
  s.lineTo(p.x + p.w - 4, p.y + p.h + 2);
  s.lineTo(p.x + p.w * 0.5, p.y + p.h + 3.5);
  s.lineTo(p.x + 3, p.y + p.h + 1.5);
  s.lineTo(p.x, p.y + p.h * 0.5);
  s.closePath();
  const gr = s.createLinearGradient(0, p.y, 0, p.y + p.h + 3);
  gr.addColorStop(0, css(rock, 16));
  gr.addColorStop(1, css(rock, -8));
  s.fillStyle = gr;
  s.fill();
  s.strokeStyle = css(rock, -12);
  s.lineWidth = 1;
  s.stroke();
  // Glowing cracks.
  const hot: HSL = { h: 22, s: 100, l: 55 };
  const pulse = 0.65 + 0.35 * Math.sin(rc.t * 2.2 + seed);
  g.strokeStyle = css(hot, 10, 0.85 * pulse);
  g.lineWidth = 0.9;
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    let x = p.x + 4 + hash2(k, seed, 1) * (p.w - 8);
    let y = p.y + 1.5;
    g.moveTo(x, y);
    for (let j = 0; j < 3; j++) {
      x += (hash2(k, j, seed) - 0.5) * 6;
      y += p.h / 3;
      g.lineTo(x, y);
    }
  }
  g.stroke();
  glowDot(g, p.x + p.w / 2, p.y + p.h, p.w * 0.6, hot, 0.25 * pulse);
  light(rc, p.x + p.w / 2, p.y + p.h, 40, hot, 0.35 * pulse);
}

function drawCrate(s: CanvasRenderingContext2D, p: Rect, woodHue: number, hue: number, seed: number) {
  const wood: HSL = { h: woodHue, s: 45, l: 44 };
  s.fillStyle = 'rgba(0,0,0,0.3)';
  s.fillRect(p.x + 1.5, p.y + 2.5, p.w, p.h);
  s.fillStyle = css(wood);
  s.fillRect(p.x, p.y, p.w, p.h);
  s.strokeStyle = css(wood, -14, 0.8);
  s.lineWidth = 0.6;
  for (let y = p.y + 4; y < p.y + p.h; y += 4) {
    s.beginPath();
    s.moveTo(p.x, y);
    s.lineTo(p.x + p.w, y);
    s.stroke();
  }
  s.strokeStyle = css(wood, -22);
  s.lineWidth = 2.2;
  s.strokeRect(p.x + 1.1, p.y + 1.1, p.w - 2.2, p.h - 2.2);
  s.lineWidth = 1.8;
  s.beginPath();
  s.moveTo(p.x + 2, p.y + 2);
  s.lineTo(p.x + p.w - 2, p.y + p.h - 2);
  s.stroke();
  s.fillStyle = css({ h: hue, s: 70, l: 45 }, 0, 0.8);
  s.font = 'bold 6px monospace';
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.fillText(['FRAGILE', 'THIS▲UP', 'SLAG CO', 'PORT 7'][seed % 4], p.x + p.w / 2, p.y + p.h / 2 + 0.5);
  s.fillStyle = css(wood, 25, 0.5);
  s.fillRect(p.x + 1, p.y + 0.5, p.w - 2, 0.8);
}

function drawBucket(rc: RC, p: Rect, d: DrawCtx, a: RotorArm, seed: number) {
  const s = rc.s;
  const pal = d.pal;
  // Bail handle.
  s.strokeStyle = css(pal.dark, -4);
  s.lineWidth = 1.4;
  s.beginPath();
  s.arc(a.x, p.y + 1, p.w / 2 - 1, Math.PI, Math.PI * 2);
  s.stroke();
  // Ore heap peeking over the rim.
  for (let k = 0; k < 6; k++) {
    const x = p.x + 4 + hash2(k, seed, 1) * (p.w - 8);
    const r = 2 + hash2(k, seed, 2) * 1.6;
    s.fillStyle = css({ h: 25, s: 12, l: 28 + hash2(k, seed, 3) * 12 });
    circle(s, x, p.y + 1, r);
  }
  const gem: HSL = { h: [190, 300, 50, 140][seed % 4], s: 90, l: 62 };
  rc.g.fillStyle = css(gem, 10, 0.9);
  circle(rc.g, p.x + p.w * 0.6, p.y + 0.2, 1.1);
  glowDot(rc.g, p.x + p.w * 0.6, p.y + 0.2, 4, gem, 0.5);
  // Tub.
  s.fillStyle = 'rgba(0,0,0,0.3)';
  s.beginPath();
  s.moveTo(p.x + 1, p.y + 2);
  s.lineTo(p.x + p.w + 1, p.y + 2);
  s.lineTo(p.x + p.w - 2, p.y + p.h + 4);
  s.lineTo(p.x + 4, p.y + p.h + 4);
  s.fill();
  s.beginPath();
  s.moveTo(p.x, p.y);
  s.lineTo(p.x + p.w, p.y);
  s.lineTo(p.x + p.w - 3, p.y + p.h + 2);
  s.lineTo(p.x + 3, p.y + p.h + 2);
  s.closePath();
  s.fillStyle = metalFill(s, pal, p.x, p.y, p.w, p.h + 2, Math.PI / 2);
  s.fill();
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 1;
  s.stroke();
  s.fillStyle = css(pal.dark, 0, 0.8);
  s.fillRect(p.x + 0.5, p.y, p.w - 1, 1.6);
  for (let x = p.x + 4; x < p.x + p.w - 3; x += 5) rivet(s, x, p.y + p.h - 0.5, pal, 0.8);
  // Lantern hung off the side.
  const lx = p.x + p.w + 1.5;
  const ly = p.y + 2;
  s.strokeStyle = '#2a2a2e';
  s.lineWidth = 0.7;
  s.beginPath();
  s.moveTo(p.x + p.w - 1, p.y);
  s.lineTo(lx, ly - 2);
  s.stroke();
  s.fillStyle = '#26262c';
  s.fillRect(lx - 2, ly - 2, 4, 1.2);
  s.fillRect(lx - 2, ly + 3.5, 4, 1.2);
  const warm: HSL = { h: d.style.glowHue, s: 100, l: 62 };
  rc.g.fillStyle = css(warm, 15, 0.95);
  rc.g.fillRect(lx - 1.4, ly - 0.8, 2.8, 4.3);
  glowDot(rc.g, lx, ly + 1.5, 12, warm, 0.7);
  light(rc, lx, ly + 1.5, 70, warm, 0.8);
}

function drawGondola(s: CanvasRenderingContext2D, p: Rect, d: DrawCtx) {
  const pal = d.pal;
  const paint: HSL = { h: d.style.hue, s: 55, l: 48 };
  // Railing (behind the rider, but readable).
  s.strokeStyle = css(paint, -10);
  s.lineWidth = 1.2;
  s.beginPath();
  s.moveTo(p.x + 1, p.y);
  s.lineTo(p.x + 1, p.y - 9);
  s.lineTo(p.x + p.w - 1, p.y - 9);
  s.lineTo(p.x + p.w - 1, p.y);
  for (let x = p.x + 8; x < p.x + p.w - 4; x += 8) {
    s.moveTo(x, p.y);
    s.lineTo(x, p.y - 9);
  }
  s.moveTo(p.x + 1, p.y - 4.5);
  s.lineTo(p.x + p.w - 1, p.y - 4.5);
  s.stroke();
  s.fillStyle = 'rgba(0,0,0,0.3)';
  s.fillRect(p.x + 1, p.y + 2, p.w, p.h);
  s.fillStyle = metalFill(s, pal, p.x, p.y, p.w, p.h);
  s.fillRect(p.x, p.y, p.w, p.h);
  s.fillStyle = css(paint);
  s.fillRect(p.x, p.y + p.h - 3, p.w, 3);
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 0.8;
  s.strokeRect(p.x, p.y, p.w, p.h);
  // Bucket & squeegee.
  s.fillStyle = '#3c78c8';
  rrect(s, p.x + p.w - 9, p.y - 5, 5, 5, 1);
  s.fill();
  s.strokeStyle = '#d8d8d8';
  s.lineWidth = 0.8;
  s.beginPath();
  s.moveTo(p.x + 6, p.y);
  s.lineTo(p.x + 9, p.y - 8);
  s.moveTo(p.x + 7.5, p.y - 8.5);
  s.lineTo(p.x + 11, p.y - 7);
  s.stroke();
  void METALS;
}

// ---------------------------------------------------------------------------
// Layer 2: hub caps and pivots.

function drawHub(rc: RC, m: Rotor, d: DrawCtx) {
  const s = rc.s;
  const [hx, hy] = hub(m, d);
  if (m.swing > 0) {
    if (m.support === 'ceiling' && m.look !== 'log') {
      s.strokeStyle = css(d.pal.dark, -6);
      s.lineWidth = 1.6;
      s.beginPath();
      s.arc(hx, hy, 2.6, 0, Math.PI * 2);
      s.stroke();
    }
    return;
  }
  const r = m.look === 'windmill' ? 5.5 : 6;
  const base = m.look === 'windmill' ? ({ h: d.style.woodHue, s: 40, l: 26 } as HSL) : d.pal.base;
  s.fillStyle = sphereFill(s, hx, hy, r, base, 30, 25);
  circle(s, hx, hy, r);
  s.strokeStyle = 'rgba(0,0,0,0.5)';
  s.lineWidth = 0.8;
  s.stroke();
  s.fillStyle = sphereFill(s, hx, hy, 2.2, METALS.brass.base);
  circle(s, hx, hy, 2.2);
}

defineArt<'rotor'>({ type: 'rotor', layer: BACKDROP, draw: (rc, m, d) => drawSupport(rc, m, d) });
defineArt<'rotor'>({ type: 'rotor', layer: 0, draw: (rc, m, d) => drawArms(rc, m, d, rotorArms(m, rc.frame, d.r.phase, d.off)) });
defineArt<'rotor'>({
  type: 'rotor',
  layer: 1,
  draw: (rc, m, d) => rotorArms(m, rc.frame, d.r.phase, d.off).forEach((a, i) => drawPlatform(rc, m, d, a, i)),
});
defineArt<'rotor'>({ type: 'rotor', layer: 2, draw: (rc, m, d) => drawHub(rc, m, d) });
