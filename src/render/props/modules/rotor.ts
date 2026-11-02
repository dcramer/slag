import { css, type HSL } from '../../../core/color';
import type { Rect } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import { type ModuleOf, type RotorArm, rotorAngles, rotorArms, rotorPlatform } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, circle, glowDot, light, type RC } from '../../kit';
import { BACKDROP, type DrawCtx, defineArt } from '../common';
import { ceilingAbovePx, chain, groundBelowPx, lattice, plank, rope } from './setpiece';
import { rotorSkin } from '../skins';
import { cogDeck, cogHub, cogWheel, waterBottle } from './wheel-art';

/**
 * Rotor art, inked: windmills, cog lifts and pendulum platforms (chandelier, hay bale, vine log, basalt
 * slab, crane crate, ore bucket, window gondola). Every moving part is placed with rotorArms /
 * rotorPlatform, the same pose functions the sim uses, so what you see is exactly what you stand on.
 * Supports are scenery and stand behind the terrain (BACKDROP); sails, links and platforms stay in front.
 * Platforms and supports are baked once and stamped; only what turns, swings or burns is drawn live.
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

const r1 = (v: number) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Backdrop: supports. Layer 0: arms.

/** The windmill's tower: a tapered clapboard body, a window, a door and a cap roof behind the hub. */
function windmillTower(s: CanvasRenderingContext2D, d: DrawCtx, hx: number, hy: number, gy: number, door: boolean) {
  const st = d.style;
  const top = hy - 9;
  const tw = 8;
  const bw = Math.min(30, 12 + (gy - hy) * 0.18);
  const key = `rt|mill|${r1(hx)}|${r1(hy)}|${r1(gy)}|${st.hue | 0}|${st.woodHue | 0}|${door}`;
  stamp(
    s,
    sprite(key, hx - bw - 3, top - 22, bw * 2 + 6, gy - top + 25, (g) => {
      const wall: HSL = { h: st.woodHue, s: 22, l: 80 };
      const body = poly(hx - tw, top, hx + tw, top, hx + bw, gy, hx - bw, gy);
      tone(g, body, wall, { depth: 2.2 });
      g.save();
      path(g, body);
      g.clip();
      for (let y = top + 4; y < gy; y += 4) tick(g, hx - bw, y, hx + bw, y + 0.2, 0.5, y, css(wall, -24));
      g.restore();
      pen(g, body, 3, 0.6, 1.6);
      const mid = top + (gy - top) * 0.45;
      if (gy - top > 40) part(g, boxPts(hx - 3, mid - 4, 6, 8, 2.6, 4), { h: 30, s: 25, l: 16 }, 4, { depth: 0.4, thin: 0.4, thick: 0.9 });
      if (door) {
        part(g, boxPts(hx - 5, gy - 13, 10, 13, 4, 5), { h: st.hue, s: 45, l: 32 }, 5, { depth: 0.8, thin: 0.45, thick: 1.1 });
        dot(g, hx + 2.5, gy - 6, 0.7, 6, '#d8c070');
      }
      const roof: P[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI + (i / 12) * Math.PI;
        roof.push({ x: hx + Math.cos(a) * 12, y: top + 2 + Math.sin(a) * 18 * (i === 0 || i === 12 ? 0 : 1) });
      }
      part(g, roof, { h: st.hue, s: 40, l: 34 }, 7, { depth: 1.2, thin: 0.5, thick: 1.3 });
      glint(g, poly(hx - 7, top - 4, hx - 3, top - 10, hx + 3, top - 9), css({ h: st.hue, s: 40, l: 52 }), 0.7);
    }),
  );
}

function drawSupport(rc: RC, m: Rotor, d: DrawCtx) {
  const skin = rotorSkin(m, d);
  if (skin?.support) return skin.support(rc, m, d);
  const s = rc.s;
  const [hx, hy] = hub(m, d);
  const lv = d.o.level;
  const st = d.style;
  if (m.support === 'tower') {
    const gy = groundBelowPx(lv, hx, hy + 8);
    if (m.look === 'windmill') windmillTower(s, d, hx, hy, gy, !!lv && gy <= lv.h * 16);
    else {
      // Girder tower for cog lifts.
      lattice(s, hx - 5, hy, gy, 7, d.pal);
      lattice(s, hx + 5, hy, gy, 7, d.pal);
      part(s, boxPts(hx - 14, gy - 4, 28, 4, 0.8, 9), d.pal.base, 9, { depth: 0.7, thin: 0.5, thick: 1.1 });
    }
    return;
  }
  if (m.support === 'ceiling') {
    const cy = ceilingAbovePx(lv, hx, hy);
    if (m.look === 'log') {
      // Vines dangle from the canopy to the pivot branch.
      rope(s, hx - 1, cy, hx - 1, hy, { h: 105, s: 40, l: 30 }, 1.6, 1.5);
      leaves(s, hx, cy, hy, d.r.pp.uid);
      part(s, boxPts(hx - 10, hy - 2.5, 20, 5, 2.4, 11), { h: st.woodHue, s: 35, l: 28 }, 11, { depth: 0.6, thin: 0.45, thick: 1 });
    } else {
      chain(s, hx, cy, hx, hy - 3, d.pal, 3.6);
      if (cy > 0) {
        part(s, boxPts(hx - 6, cy - 0.5, 12, 3.5, 1, 12), d.pal.base, 12, { depth: 0.6, thin: 0.45, thick: 1 });
        for (const ox of [-3.5, 3.5]) dot(s, hx + ox, cy + 1.2, 0.6, ox, css(d.pal.light));
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
      // Jib out to the trolley and a counter-jib, laced with braces.
      for (const [y0, y1] of [
        [topY - 6, hy - 3],
        [topY, hy - 1],
      ]) {
        s.fillStyle = INK;
        line(s, mx - side * 18, y0, hx + side * 8, y1, { w: 2.6, seed: y0, taper: [0, 0], press: 0.1 });
        s.fillStyle = css(paint);
        line(s, mx - side * 18, y0, hx + side * 8, y1, { w: 1.3, seed: y0 + 1, taper: [0, 0], press: 0.1 });
      }
      s.fillStyle = css(paint, -18);
      const span = Math.abs(hx - mx) || 1;
      for (let x = mx; Math.abs(x - mx) < Math.abs(hx - mx) + 6; x += side * 7) {
        const t = (x - mx) / (hx - mx || 1);
        const ya = topY - 6 + (hy - 3 - (topY - 6)) * t;
        const yb = topY + (hy - 1 - topY) * t;
        line(s, x, ya, x + side * 3.5, yb, { w: 0.8, seed: x, taper: [0, 0], press: 0 });
        line(s, x + side * 3.5, yb, x + side * 7, ya + ((hy - 3 - (topY - 6)) * 7) / span, { w: 0.8, seed: x + 1, taper: [0, 0], press: 0 });
      }
      part(s, boxPts(mx - side * 18 - 5, topY - 5, 9, 9, 1.2, 13), { h: 220, s: 8, l: 26 }, 13, { depth: 0.8, thin: 0.5, thick: 1.1 });
      // Operator cab with a lit window.
      part(s, boxPts(mx + side * 3 - 5, topY + 3, 10, 9, 1.2, 14), { ...paint, l: 44 }, 14, { depth: 0.8, thin: 0.5, thick: 1.1 });
      s.fillStyle = '#9fd4ee';
      s.fillRect(mx + side * 3 - 3, topY + 5, 6, 4);
      rc.g.fillStyle = 'rgba(255,220,150,0.35)';
      rc.g.fillRect(mx + side * 3 - 3, topY + 5, 6, 4);
      // Trolley on the jib.
      part(s, boxPts(hx - 4, hy - 5, 8, 5, 1, 15), { h: 220, s: 8, l: 22 }, 15, { depth: 0.4, thin: 0.4, thick: 0.9 });
      // Red beacon.
      const blink = Math.sin(rc.t * 3 + d.r.pp.uid) > 0.4;
      s.fillStyle = INK;
      circle(s, mx, topY - 8, 2.2);
      s.fillStyle = blink ? '#ff4030' : '#702020';
      circle(s, mx, topY - 8, 1.5);
      if (blink) {
        bulb(rc.g, mx, topY - 8, 1.5, { h: 5, s: 100, l: 55 }, 1);
        light(rc, mx, topY - 8, 40, { h: 5, s: 100, l: 55 }, 0.5);
      }
    } else if (m.look === 'hay') {
      const wood: HSL = { h: st.woodHue, s: 40, l: 36 };
      part(s, boxPts(mx - 3.5, topY - 3, 7, gy - topY + 3, 1, 16), wood, 16, { depth: 1, thin: 0.5, thick: 1.3 });
      part(s, boxPts(Math.min(mx, hx) - 6, topY - 4, Math.abs(hx - mx) + 12, 6, 1.4, 17), { ...wood, l: 42 }, 17, { depth: 0.9, thin: 0.5, thick: 1.2 });
      // Diagonal brace.
      s.fillStyle = INK;
      line(s, mx, topY + 18, mx + side * 16, topY + 1, { w: 3.6, seed: 18, taper: [0.02, 0.02], press: 0.1 });
      s.fillStyle = css(wood, 4);
      line(s, mx, topY + 18, mx + side * 16, topY + 1, { w: 2, seed: 19, taper: [0.02, 0.02], press: 0.1 });
      // Pulley wheel.
      ball(s, hx, hy - 1, 3.5, { ...wood, l: 24 }, 20);
      dot(s, hx, hy - 1, 1.1, 21, '#c9b58a');
    } else {
      // Rooftop davit: a steel pipe curving out over the edge.
      const pipe: P[] = [{ x: mx, y: gy }];
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI + (i / 6) * (Math.PI / 2);
        pipe.push({ x: mx + side * (10 + Math.cos(a) * 10), y: topY + 8 + Math.sin(a) * 10 });
      }
      pipe.push({ x: hx + side * 2, y: topY - 2 });
      s.fillStyle = INK;
      stroke(s, pipe, { w: 4.6, seed: 22, taper: [0, 0], press: 0.05 });
      s.fillStyle = css(d.pal.base, 6);
      stroke(s, pipe, { w: 3, seed: 22, taper: [0, 0], press: 0.05 });
      s.fillStyle = css(d.pal.light, 0, 0.8);
      stroke(
        s,
        pipe.map((p) => ({ x: p.x - 0.6, y: p.y - 0.6 })),
        { w: 0.7, seed: 23, taper: [0.1, 0.1], press: 0 },
      );
      part(s, boxPts(mx - 6, gy - 4, 12, 4, 0.8, 24), d.pal.base, 24, { depth: 0.6, thin: 0.45, thick: 1 });
      ball(s, hx, hy - 1, 3, { h: 220, s: 8, l: 24 }, 25);
    }
  }
}

function leaves(s: CanvasRenderingContext2D, x: number, y0: number, y1: number, seed: number) {
  for (let y = Math.max(y0, -10) + 4; y < y1 - 2; y += 7) {
    const k = hash2(Math.floor(y), seed, 3);
    leaf(s, x + (k > 0.5 ? 2.5 : -2.5), y, (k > 0.5 ? 1 : -1) * 0.6, k);
  }
}

/** A leaf: a pointed oval, two greens split down the vein, an ink edge. */
function leaf(s: CanvasRenderingContext2D, x: number, y: number, a: number, k: number) {
  const c = Math.cos(a);
  const q = Math.sin(a);
  const L = 2.8;
  const W = 1.3;
  const tip = { x: x + c * L, y: y + q * L };
  const tail = { x: x - c * L, y: y - q * L };
  const up = { x: x - q * W, y: y + c * W };
  const dn = { x: x + q * W, y: y - c * W };
  const leafC: HSL = { h: 100 + k * 30, s: 50, l: 34 + k * 10 };
  s.fillStyle = INK;
  path(s, [
    { x: tail.x - c * 0.4, y: tail.y - q * 0.4 },
    { x: up.x - q * 0.4, y: up.y + c * 0.4 },
    { x: tip.x + c * 0.4, y: tip.y + q * 0.4 },
    { x: dn.x + q * 0.4, y: dn.y - c * 0.4 },
  ]);
  s.fill();
  s.fillStyle = css(leafC, 8);
  path(s, [tail, dn, tip]);
  s.fill();
  s.fillStyle = css(leafC, -8);
  path(s, [tail, up, tip]);
  s.fill();
}

/** A windmill sail along +x from the hub: cloth on the trailing side, a lattice over it, the spar. */
function sail(L: number, woodHue: number) {
  const x0 = L * 0.2;
  const x1 = L - 5;
  const w = Math.min(14, L * 0.24);
  return sprite(`rt|sail|${r1(L)}|${woodHue | 0}`, -2, -3, L + 4, w + 6, (g) => {
    const wood: HSL = { h: woodHue, s: 40, l: 32 };
    const cloth: HSL = { h: 40, s: 30, l: 88 };
    const sheet = boxPts(x0, 1.5, x1 - x0, w, 0.6, 31, 0.3);
    tone(g, sheet, cloth, { depth: 1 });
    g.fillStyle = css(wood, -4);
    for (let x = x0 + 5; x < x1; x += 5) line(g, x, 1.5, x, 1.5 + w, { w: 0.6, seed: x, taper: [0, 0], press: 0 });
    for (let k = 1; k < 3; k++) line(g, x0, 1.5 + (w * k) / 3, x1, 1.5 + (w * k) / 3, { w: 0.6, seed: k, taper: [0, 0], press: 0 });
    pen(g, sheet, 32, 0.5, 1.1, 3, css(wood, -16));
    g.fillStyle = INK;
    line(g, 0, 0, L, 0, { w: 3.8, seed: 33, taper: [0, 0.05], press: 0.05 });
    g.fillStyle = css(wood, 8);
    line(g, 0, -0.2, L, -0.2, { w: 2, seed: 34, taper: [0, 0.05], press: 0.05 });
  });
}

function drawArms(rc: RC, m: Rotor, d: DrawCtx, arms: RotorArm[]) {
  const s = rc.s;
  const [hx, hy] = hub(m, d);
  const st = d.style;
  if (m.look === 'windmill') {
    const sp = sail(m.arm, st.woodHue);
    for (const a of arms) {
      s.save();
      s.translate(hx, hy);
      s.rotate(a.a);
      stamp(s, sp);
      s.restore();
    }
    return;
  }
  const skin = rotorSkin(m, d);
  if (m.look === 'cog') {
    if (skin?.wheel) skin.wheel(rc, m, d, arms, hx, hy);
    else {
      const base = rotorAngles(m, rc.frame, d.r.phase)[0];
      cogWheel(rc, m, d.pal, arms, hx, hy, base);
      if (d.r.pp.def.name.includes('Hamster')) waterBottle(s, hx, hy, Math.min(m.arm * 0.5, 30));
    }
    return;
  }
  if (skin?.link) {
    for (const a of arms) skin.link(rc, m, d, a, rotorPlatform(m, a));
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
        s.fillStyle = INK;
        line(s, x1, y1, x2, y2, { w: 1.2, seed: x1, taper: [0, 0], press: 0 });
      } else rope(s, x1, y1, x2, y2, { h: 38, s: 40, l: 55 }, 1.2, 0.5);
    };
    if (direct) for (const [ex, ey] of ends) draw(hx, hy, ex, ey);
    else {
      draw(hx, hy, a.x, crownY);
      for (const [ex, ey] of ends) draw(a.x, crownY, ex, ey);
    }
    if (m.look === 'log') leavesAlong(s, hx, hy, ends, d.r.pp.uid);
    if (m.look === 'crane') {
      // Hook and its block.
      const hook: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = -Math.PI * 0.1 + (i / 8) * Math.PI * 1.25;
        hook.push({ x: a.x + Math.cos(t) * 2.5, y: crownY + 2.5 + Math.sin(t) * 2.5 });
      }
      s.fillStyle = INK;
      stroke(s, hook, { w: 2.4, seed: 41, taper: [0.05, 0.3], press: 0 });
      s.fillStyle = '#7c838f';
      stroke(s, hook, { w: 1.1, seed: 41, taper: [0.05, 0.4], press: 0 });
      part(s, boxPts(a.x - 2.5, crownY - 5, 5, 4, 0.8, 42), { h: d.style.hue, s: 80, l: 50 }, 42, { depth: 0.4, thin: 0.4, thick: 0.8 });
    }
  }
}

function leavesAlong(s: CanvasRenderingContext2D, hx: number, hy: number, ends: [number, number][], seed: number) {
  for (const [ex, ey] of ends) {
    const n = Math.floor(Math.hypot(ex - hx, ey - hy) / 9);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const k = hash2(i, seed, ex > hx ? 1 : 2);
      leaf(s, hx + (ex - hx) * t + (k - 0.5) * 3, hy + (ey - hy) * t, k * 3, k);
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 1: the platforms you stand on.

// ---------------------------------------------------------------------------
// Layer 1: the platforms you stand on. Each is baked at its size, with its top-left at the origin.

function drawPlatform(rc: RC, m: Rotor, d: DrawCtx, a: RotorArm, i: number) {
  const s = rc.s;
  const p = rotorPlatform(m, a);
  const st = d.style;
  const seed = d.r.pp.uid * 7 + i;
  const skin = rotorSkin(m, d);
  if (skin?.platform) return skin.platform(rc, m, d, a, p, i);
  if (skin?.over) {
    drawPlatform(rc, m, { ...d, o: { ...d.o, level: null } }, a, i);
    return skin.over(rc, m, d, a, p, i);
  }
  switch (m.look) {
    case 'windmill':
      plank(s, p.x, p.y, p.w, p.h, st.woodHue, seed, 42);
      dot(s, a.x, a.y, 1.2, seed);
      break;
    case 'cog':
    case 'flywheel':
      cogDeck(s, p, st, d.pal);
      break;
    case 'chandelier':
      drawChandelier(rc, p, d, seed);
      break;
    case 'hay':
      stamp(s, hayBale(p.w, p.h, seed % 3), p.x, p.y);
      break;
    case 'log':
      stamp(s, vineLog(p.w, p.h, st.woodHue, seed % 3), p.x, p.y);
      break;
    case 'slab':
      drawSlab(rc, p, seed);
      break;
    case 'crane':
      stamp(s, crate(p.w, p.h, st.woodHue, st.hue, seed % 4), p.x, p.y);
      break;
    case 'bucket':
      drawBucket(rc, p, d, a, seed);
      break;
    case 'gondola':
      stamp(s, gondola(p.w, p.h, d), p.x, p.y);
      break;
  }
}

const sizeKey = (w: number, h: number) => `${r1(w)}x${r1(h)}`;

/** The chandelier: an iron ring seen side on with scrolled ends, candle cups along the top, crystal drops under it. */
function chandelier(w: number, h: number, d: DrawCtx, seed: number) {
  const pal = d.pal;
  return sprite(`rt|chand|${sizeKey(w, h)}|${pal.base.h},${pal.base.l}|${seed % 3}`, -6, -12, w + 12, h + 22, (g) => {
    // Crystal drops on threads (thin, behind).
    for (let k = 0; k < 5; k++) {
      const x = 5 + ((w - 10) * k) / 4;
      const len = 4 + (k % 2) * 3;
      tick(g, x, h, x, h + len, 0.4, k, css(pal.light, 0, 0.8));
      g.fillStyle = INK;
      path(g, poly(x, h + len - 0.6, x + 1.5, h + len + 1.4, x, h + len + 3.6, x - 1.5, h + len + 1.4));
      g.fill();
      g.fillStyle = 'rgba(220,240,255,0.95)';
      path(g, poly(x, h + len, x + 0.9, h + len + 1.4, x, h + len + 2.8, x - 0.9, h + len + 1.4));
      g.fill();
    }
    const ring = boxPts(0, 0, w, h, h / 2, 51, 0.1);
    part(g, ring, pal.base, 51, { depth: Math.min(1.2, h * 0.25), thin: 0.5, thick: 1.2 });
    for (let x = 4; x < w - 2; x += 5) dot(g, x, h / 2, 0.7, x, css(pal.light));
    // Scrolled ends.
    for (const sx of [-1, 1]) {
      const cx = w / 2 + sx * (w / 2 + 1);
      const curl: P[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * Math.PI * 1.6;
        const r = 3 - (i / 12) * 1.6;
        curl.push({ x: cx + sx * Math.cos(t + Math.PI / 2) * r, y: h / 2 - 2 + Math.sin(t + Math.PI / 2) * r });
      }
      g.fillStyle = INK;
      stroke(g, curl, { w: 1.6, seed: 52 + sx, taper: [0.05, 0.4], press: 0 });
      g.fillStyle = css(pal.base);
      stroke(g, curl, { w: 0.7, seed: 52 + sx, taper: [0.05, 0.5], press: 0 });
    }
    // Candle cups and candles.
    const n = Math.max(3, Math.round(w / 10));
    for (let k = 0; k < n; k++) {
      const x = 4 + ((w - 8) * k) / (n - 1);
      const ch = 4 + hash2(k, seed, 9) * 2;
      part(g, boxPts(x - 1.1, -1.5 - ch, 2.2, ch, 0.5, 53 + k), { h: 42, s: 40, l: 90 }, 53 + k, { depth: 0.4, thin: 0.3, thick: 0.6 });
      part(g, boxPts(x - 2.2, -1.6, 4.4, 1.8, 0.8, 60 + k), pal.base, 60 + k, { depth: 0.3, thin: 0.3, thick: 0.6 });
      tick(g, x, -1.5 - ch, x, -2.4 - ch, 0.35, k);
    }
  });
}

function drawChandelier(rc: RC, p: Rect, d: DrawCtx, seed: number) {
  stamp(rc.s, chandelier(p.w, p.h, d, seed), p.x, p.y);
  const g = rc.g;
  // Flames, live: they flicker.
  const flame: HSL = { h: d.style.glowHue, s: 100, l: 62 };
  const n = Math.max(3, Math.round(p.w / 10));
  for (let k = 0; k < n; k++) {
    const x = p.x + 4 + ((p.w - 8) * k) / (n - 1);
    const ch = 4 + hash2(k, seed % 3, 9) * 2;
    const fy = p.y - 3.8 - ch;
    const fl = 1 + Math.sin(rc.t * 13 + k * 2.1 + seed) * 0.18;
    g.fillStyle = css({ h: 48, s: 100, l: 80 }, 0, 0.95);
    g.beginPath();
    g.ellipse(x, fy, 0.9, 2 * fl, 0, 0, Math.PI * 2);
    g.fill();
    glowDot(g, x, fy, 7 * fl, flame, 0.75);
    if (k % 2 === 0) light(rc, x, fy, 46, flame, 0.55);
  }
}

/** A hay bale: a block of straw strokes in two turns of twine, a few straws standing loose. */
function hayBale(w: number, h: number, v: number) {
  return sprite(`rt|hay|${sizeKey(w, h)}|${v}`, -2, -4, w + 4, h + 6, (g) => {
    const base: HSL = { h: 46, s: 70, l: 58 };
    const seed = 71 + v;
    const body = boxPts(0, 0, w, h, 2.6, seed, 0.3);
    tone(g, body, base, { depth: Math.min(1.6, h * 0.22) });
    g.save();
    path(g, body);
    g.clip();
    for (let k = 0; k < w * 1.2; k++) {
      const x = hash2(k, seed, 1) * w;
      const y = hash2(k, seed, 2) * h;
      tick(
        g,
        x,
        y,
        x + 2.5 + hash2(k, seed, 4) * 2,
        y + (hash2(k, seed, 5) - 0.5) * 1.5,
        0.45,
        k,
        css(base, hash2(k, seed, 3) > 0.5 ? 20 : -22, 1, hash2(k, seed, 3) > 0.5 ? 0 : 6),
      );
    }
    for (const t of [0.28, 0.72]) {
      g.fillStyle = INK;
      line(g, w * t, -0.5, w * t + 0.3, h + 0.5, { w: 1.6, seed: t * 9, taper: [0, 0], press: 0.1 });
      g.fillStyle = '#9a5530';
      line(g, w * t - 0.2, -0.5, w * t + 0.1, h + 0.5, { w: 0.8, seed: t * 9 + 1, taper: [0, 0], press: 0.1 });
    }
    g.restore();
    pen(g, body, seed + 2, 0.5, 1.3, 3, css(base, -44, 1, 6));
    for (let k = 0; k < 4; k++) {
      const x = 3 + hash2(k, seed, 7) * (w - 6);
      tick(g, x, 0.4, x + (hash2(k, seed, 8) - 0.5) * 5, -2.4, 0.5, k + 20, css(base, 20));
    }
  });
}

/** The vine log: bark, a mossy top and a cut end showing its rings. */
function vineLog(w: number, h: number, woodHue: number, v: number) {
  return sprite(`rt|log|${sizeKey(w, h)}|${woodHue | 0}|${v}`, -2, -4, w + 4, h + 8, (g) => {
    const bark: HSL = { h: woodHue - 4, s: 35, l: 29 };
    const seed = 81 + v;
    const r = h / 2 + 1;
    const body = boxPts(0, -1, w, h + 2, r, seed, 0.2);
    tone(g, body, bark, { depth: 1.3 });
    g.save();
    path(g, body);
    g.clip();
    for (let k = 0; k < w / 3; k++) {
      const x = hash2(k, seed, 1) * w;
      const y = hash2(k, seed, 2) * h;
      tick(g, x, y, x + 4 + hash2(k, seed, 3) * 5, y + 0.3, 0.5, k, css(bark, -16, 1, 6));
    }
    g.restore();
    pen(g, body, seed + 1, 0.5, 1.3);
    // Moss on top: soft lumps, thin enough to read as growth.
    g.fillStyle = css({ h: 95, s: 50, l: 38 });
    for (let x = 2; x < w - 2; x += 3) {
      const k = hash2(Math.floor(x), seed, 4);
      if (k > 0.35) {
        blob(g, x, -0.8, 1.6 + k * 0.8, x, 0.55, 0.15);
        g.fill();
      }
    }
    const ex = w - r * 0.4;
    const ey = h / 2;
    part(g, ovalPts(ex, ey, r * 0.55, r, seed + 2, 0.03, 16), { h: woodHue + 6, s: 45, l: 62 }, seed + 2, { depth: 0.4, thin: 0.4, thick: 0.9 });
    for (const k of [0.35, 0.65]) {
      const ring = ovalPts(ex, ey, r * 0.55 * k, r * k, seed + 3, 0.05, 12);
      g.fillStyle = css({ h: woodHue, s: 40, l: 42 });
      stroke(g, [...ring, ring[0]], { w: 0.4, seed: k * 9, taper: [0.1, 0.1], press: 0.2 });
    }
  });
}

/** The volcano's basalt slab: two dark tones, a jagged underside, and cracks that glow (drawn live). */
function basalt(w: number, h: number, v: number) {
  return sprite(`rt|slab|${sizeKey(w, h)}|${v}`, -2, -2, w + 4, h + 6, (g) => {
    const rock: HSL = { h: 260, s: 10, l: 22 };
    const body = poly(1, 0, w - 1, 0, w, h * 0.6, w - 4, h + 2, w * 0.5, h + 2.4, 3, h + 1.5, 0, h * 0.5);
    tone(g, body, rock, { depth: 1.4 });
    g.save();
    path(g, body);
    g.clip();
    for (let k = 0; k < 4; k++) {
      const x = 3 + hash2(k, v, 3) * (w - 6);
      tick(g, x, 1, x + 2, 2.4, 0.5, k, css(rock, 22));
    }
    g.restore();
    pen(g, body, 91 + v, 0.6, 1.5);
  });
}

function drawSlab(rc: RC, p: Rect, seed: number) {
  stamp(rc.s, basalt(p.w, p.h, seed % 3), p.x, p.y);
  const g = rc.g;
  const hot: HSL = { h: 22, s: 100, l: 55 };
  const pulse = 0.65 + 0.35 * Math.sin(rc.t * 2.2 + seed);
  g.fillStyle = css(hot, 10, 0.85 * pulse);
  for (let k = 0; k < 3; k++) {
    let x = p.x + 4 + hash2(k, seed, 1) * (p.w - 8);
    let y = p.y + 1.5;
    for (let j = 0; j < 3; j++) {
      const nx = x + (hash2(k, j, seed) - 0.5) * 6;
      const ny = y + p.h / 3;
      line(g, x, y, nx, ny, { w: 0.9, seed: k * 3 + j, taper: [0.1, 0.1], press: 0 });
      x = nx;
      y = ny;
    }
  }
  glowDot(g, p.x + p.w / 2, p.y + p.h, p.w * 0.6, hot, 0.25 * pulse);
  light(rc, p.x + p.w / 2, p.y + p.h, 40, hot, 0.35 * pulse);
}

/** The crane's crate: boards, a frame, a brace, and a stencil on the side. */
function crate(w: number, h: number, woodHue: number, hue: number, v: number) {
  return sprite(`rt|crate|${sizeKey(w, h)}|${woodHue | 0}|${hue | 0}|${v}`, -2, -2, w + 4, h + 4, (g) => {
    const wood: HSL = { h: woodHue, s: 45, l: 44 };
    const body = boxPts(0, 0, w, h, 1, 101 + v, 0.1);
    tone(g, body, wood, { depth: 1.2 });
    g.save();
    path(g, body);
    g.clip();
    for (let y = 4; y < h; y += 4) tick(g, 0, y, w, y + 0.2, 0.5, y, css(wood, -20, 1, 6));
    g.fillStyle = INK;
    for (const [ax, ay, bx, by] of [
      [1.3, 1.3, w - 1.3, 1.3],
      [1.3, h - 1.3, w - 1.3, h - 1.3],
      [1.3, 1.3, 1.3, h - 1.3],
      [w - 1.3, 1.3, w - 1.3, h - 1.3],
      [2, 2, w - 2, h - 2],
    ])
      line(g, ax, ay, bx, by, { w: 2.4, seed: ax + by, taper: [0.02, 0.02], press: 0.15 });
    g.fillStyle = css(wood, 10);
    for (const [ax, ay, bx, by] of [
      [1.3, 1.3, w - 1.3, 1.3],
      [1.3, h - 1.3, w - 1.3, h - 1.3],
      [2, 2, w - 2, h - 2],
    ])
      line(g, ax, ay, bx, by, { w: 1.1, seed: ax + by + 1, taper: [0.02, 0.02], press: 0.15 });
    g.fillStyle = css({ h: hue, s: 70, l: 40 }, 0, 0.85);
    g.font = 'bold 6px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(['FRAGILE', 'THIS▲UP', 'SLAG CO', 'PORT 7'][v % 4], w / 2, h / 2 + 0.5);
    g.restore();
    pen(g, body, 102 + v, 0.55, 1.4);
  });
}

/** The ore bucket: a riveted tub with ore heaped over the rim and a bail handle. */
function oreTub(w: number, h: number, d: DrawCtx, v: number) {
  const pal = d.pal;
  return sprite(`rt|tub|${sizeKey(w, h)}|${pal.base.h},${pal.base.l}|${v}`, -2, -w / 2 - 2, w + 4, w / 2 + h + 7, (g) => {
    const handle: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      handle.push({ x: w / 2 + Math.cos(a) * (w / 2 - 1), y: 1 + Math.sin(a) * (w / 2 - 1) });
    }
    g.fillStyle = INK;
    stroke(g, handle, { w: 2, seed: 111, taper: [0, 0], press: 0 });
    g.fillStyle = css(pal.base, -6);
    stroke(g, handle, { w: 0.9, seed: 111, taper: [0, 0], press: 0 });
    for (let k = 0; k < 6; k++) {
      const x = 4 + hash2(k, v, 1) * (w - 8);
      const r = 2 + hash2(k, v, 2) * 1.6;
      ball(g, x, 1, r, { h: 25, s: 12, l: 30 + hash2(k, v, 3) * 12 }, k);
    }
    const tub = poly(0, 0, w, 0, w - 3, h + 2, 3, h + 2);
    part(g, tub, pal.base, 112 + v, { depth: 1.2, thin: 0.55, thick: 1.4 });
    g.fillStyle = INK;
    g.fillRect(0.5, 0, w - 1, 1.4);
    for (let x = 4; x < w - 3; x += 5) dot(g, x, h - 0.5, 0.55, x, css(pal.light));
  });
}

function drawBucket(rc: RC, p: Rect, d: DrawCtx, _a: RotorArm, seed: number) {
  stamp(rc.s, oreTub(p.w, p.h, d, seed % 3), p.x, p.y);
  const gem: HSL = { h: [190, 300, 50, 140][seed % 4], s: 90, l: 62 };
  bulb(rc.g, p.x + p.w * 0.6, p.y + 0.2, 1.1, gem, 0.9);
  // A lantern hung off the side.
  const s = rc.s;
  const lx = p.x + p.w + 1.5;
  const ly = p.y + 2;
  s.fillStyle = INK;
  line(s, p.x + p.w - 1, p.y, lx, ly - 2, { w: 0.6, seed: 1, taper: [0, 0], press: 0 });
  s.fillRect(lx - 2.2, ly - 2.2, 4.4, 1.4);
  s.fillRect(lx - 2.2, ly + 3.4, 4.4, 1.4);
  s.fillRect(lx - 1.8, ly - 1, 0.6, 4.5);
  s.fillRect(lx + 1.2, ly - 1, 0.6, 4.5);
  const warm: HSL = { h: d.style.glowHue, s: 100, l: 62 };
  rc.g.fillStyle = css(warm, 15, 0.95);
  rc.g.fillRect(lx - 1.2, ly - 0.8, 2.4, 4.3);
  glowDot(rc.g, lx, ly + 1.5, 7, warm, 0.6);
  light(rc, lx, ly + 1.5, 55, warm, 0.7);
}

/** The window-washer's gondola: a steel deck in a painted band, a thin railing, a bucket and a squeegee. */
function gondola(w: number, h: number, d: DrawCtx) {
  const pal = d.pal;
  const paint: HSL = { h: d.style.hue, s: 55, l: 48 };
  return sprite(`rt|gond|${sizeKey(w, h)}|${pal.base.h},${pal.base.l}|${paint.h | 0}`, -2, -11, w + 4, h + 13, (g) => {
    const rail = (ax: number, ay: number, bx: number, by: number) => {
      g.fillStyle = INK;
      line(g, ax, ay, bx, by, { w: 1.6, seed: ax + ay, taper: [0, 0], press: 0 });
      g.fillStyle = css(paint, -6);
      line(g, ax, ay, bx, by, { w: 0.7, seed: ax + ay, taper: [0, 0], press: 0 });
    };
    rail(1, 0, 1, -9);
    rail(w - 1, 0, w - 1, -9);
    rail(1, -9, w - 1, -9);
    rail(1, -4.5, w - 1, -4.5);
    for (let x = 8; x < w - 4; x += 8) rail(x, 0, x, -9);
    part(g, boxPts(w - 9, -5, 5, 5, 1, 121), { h: 212, s: 60, l: 50 }, 121, { depth: 0.4, thin: 0.35, thick: 0.8 });
    rail(6, 0, 9, -8);
    g.fillStyle = INK;
    line(g, 7.5, -8.5, 11, -7, { w: 1.6, seed: 122, taper: [0, 0], press: 0 });
    const deck = boxPts(0, 0, w, h, 0.8, 123, 0.1);
    tone(g, deck, pal.base, { depth: Math.min(1.2, h * 0.2) });
    g.save();
    path(g, deck);
    g.clip();
    g.fillStyle = css(paint);
    g.fillRect(0, h - 3, w, 3);
    g.restore();
    pen(g, deck, 124, 0.5, 1.3);
  });
}

// ---------------------------------------------------------------------------
// Layer 2: hub caps and pivots.

function drawHub(rc: RC, m: Rotor, d: DrawCtx) {
  const skin = rotorSkin(m, d);
  if (skin?.hub) return skin.hub(rc, m, d);
  const s = rc.s;
  const [hx, hy] = hub(m, d);
  if (m.swing > 0) {
    if (m.support === 'ceiling' && m.look !== 'log') {
      const ring = ovalPts(hx, hy, 2.6, 2.6, 7, 0.02, 12);
      s.fillStyle = INK;
      stroke(s, [...ring, ring[0]], { w: 1.8, seed: 7, taper: [0, 0], press: 0.1 });
      s.fillStyle = css(d.pal.base);
      stroke(s, [...ring, ring[0]], { w: 0.8, seed: 7, taper: [0, 0], press: 0.1 });
    }
    return;
  }
  if (m.look === 'cog') return cogHub(s, m, d.pal, hx, hy, rotorAngles(m, rc.frame, d.r.phase)[0]);
  const r = 5.5;
  const base = m.look === 'windmill' ? ({ h: d.style.woodHue, s: 40, l: 28 } as HSL) : d.pal.base;
  ball(s, hx, hy, r, base, 131);
  ball(s, hx, hy, 2.1, { h: 44, s: 70, l: 52 }, 132);
}

defineArt<'rotor'>({ type: 'rotor', layer: BACKDROP, draw: (rc, m, d) => drawSupport(rc, m, d) });
defineArt<'rotor'>({ type: 'rotor', layer: 0, draw: (rc, m, d) => drawArms(rc, m, d, rotorArms(m, rc.frame, d.r.phase, d.off)) });
defineArt<'rotor'>({
  type: 'rotor',
  layer: 1,
  draw: (rc, m, d) => rotorArms(m, rc.frame, d.r.phase, d.off).forEach((a, i) => drawPlatform(rc, m, d, a, i)),
});
defineArt<'rotor'>({ type: 'rotor', layer: 2, draw: (rc, m, d) => drawHub(rc, m, d) });
