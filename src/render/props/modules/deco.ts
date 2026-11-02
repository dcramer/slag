import { css, type HSL } from '../../../core/color';
import { frac } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import type { ModuleOf } from '../../../sim/props';
import { line } from '../../ink';
import { ball, boxPts, dot, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, circle, light, type MetalPalette, METALS, type RC } from '../../kit';
import { BACKDROP, type DrawCtx, defineArt } from '../common';
import { lattice } from './setpiece';
import { decoSkin } from '../skins';

/**
 * Scenery dressing for set pieces, inked: the press gantry and the antenna masts under tesla coils stand
 * behind the terrain. The press's warning lamp (a tell, synced to the piston), the pancake dent it leaves
 * in the floor, and rooftop AC housings (they skin a solid body you stand on) stay in front.
 */

type Deco = ModuleOf<'deco'>;

const palKey = (pal: MetalPalette) => `${pal.base.h},${pal.base.l}`;

/** Hazard bands across a rect, inside a clip the caller has set. */
function bands(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = '#f2b705';
  g.fillRect(x, y, w, h);
  g.fillStyle = INK;
  for (let k = x - h; k < x + w + h; k += 4) {
    path(g, poly(k, y + h, k + 2, y + h, k + 2 + h, y, k + h, y));
    g.fill();
  }
}

/** The press: two posts with hazard feet and a beam with the cylinder housing on top. Baked per size. */
function press(w: number, h: number, pal: MetalPalette) {
  return sprite(`dc|press|${w}|${h}|${palKey(pal)}`, -6, -16, w + 12, h + 18, (g) => {
    for (const px of [3, w - 13]) {
      const post = boxPts(px, 8, 10, h - 8, 0.8, px, 0.1);
      tone(g, post, pal.base, { depth: 1.6 });
      g.save();
      path(g, post);
      g.clip();
      g.fillStyle = css(pal.dark, -4);
      g.fillRect(px + 3.5, 8, 3, h - 8);
      bands(g, px, h - 12, 10, 8);
      g.restore();
      pen(g, post, px + 1, 0.55, 1.4);
      part(g, boxPts(px - 3, h - 3, 16, 3, 0.6, px + 2), METALS.steel.base, px + 2, { depth: 0.5, thin: 0.45, thick: 1 });
      for (const rx of [px - 1, px + 11]) dot(g, rx, h - 1.5, 0.55, rx, css(METALS.steel.light));
    }
    const cx = w / 2;
    // Hydraulic cylinder housing and its hose.
    part(g, boxPts(cx - 8, -12, 16, 14, 3.6, 3), METALS.steel.base, 3, { depth: 1.2, thin: 0.5, thick: 1.3 });
    const hose = [] as { x: number; y: number }[];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const u = 1 - t;
      hose.push({
        x: u * u * u * (cx + 8) + 3 * u * u * t * (cx + 16) + 3 * u * t * t * (w - 8) + t * t * t * (w - 8),
        y: u * u * u * -6 + 3 * u * u * t * -6 + 3 * u * t * t * -10,
      });
    }
    g.fillStyle = INK;
    for (let i = 1; i < hose.length; i++) line(g, hose[i - 1].x, hose[i - 1].y, hose[i].x, hose[i].y, { w: 1.8, seed: i, taper: [0, 0], press: 0 });
    const beam = boxPts(0, 0, w, 14, 1.6, 4, 0.15);
    tone(g, beam, pal.base, { depth: 1.6 });
    g.save();
    path(g, beam);
    g.clip();
    bands(g, 1, 10, w - 2, 3.5);
    g.restore();
    pen(g, beam, 5, 0.55, 1.5);
    for (let px = 4; px < w - 2; px += 6) dot(g, px, 3, 0.6, px, css(pal.light));
  });
}

function pressBack(rc: RC, m: Deco, d: DrawCtx) {
  stamp(rc.s, press(m.w, m.h, d.pal), m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

/** Warning lamp, synced to the piston: blinks before the slam, solid while slamming. */
function pressLamp(rc: RC, m: Deco, d: DrawCtx) {
  const p = d.r.mods.find((mm) => mm.type === 'piston');
  if (!p || p.type !== 'piston') return;
  const s = rc.s;
  const t = frac(rc.frame / p.period + d.r.phase);
  const slam = t < 0.12;
  const soon = t > 0.8;
  const on = slam || (soon && Math.floor(rc.frame / 5) % 2 === 0);
  const lx = m.at[0] + d.off[0] + 7;
  const ly = m.at[1] + d.off[1] - 3;
  part(s, boxPts(lx - 3, ly + 1, 6, 2.5, 0.5, 7), { h: 220, s: 8, l: 22 }, 7, { depth: 0.3, thin: 0.35, thick: 0.7 });
  ball(s, lx, ly, 2.4, on ? { h: 4, s: 100, l: 58 } : { h: 4, s: 60, l: 24 }, 8);
  if (on) {
    const red: HSL = { h: 4, s: 100, l: 55 };
    bulb(rc.g, lx, ly, 2.2, red, 1);
    light(rc, lx, ly, 44, red, 0.7);
  }
  // Pancake Press: what it's been pressing, in the floor under it.
  const pc = d.r.mods.find((mm) => mm.type === 'piston');
  if (pc && pc.type === 'piston') {
    const fx = pc.at[0] + d.off[0];
    const fy = m.at[1] + d.off[1] + m.h;
    stamp(s, pancake(pc.width), fx, fy);
  }
}

/** A pancake-shaped dent pressed into the floor, a pat of butter still on it. Flush with the floor. */
function pancake(w: number) {
  return sprite(`dc|pancake|${w | 0}`, -w / 2 - 2, -2, w + 4, 5, (g) => {
    const rx = Math.min(w * 0.42, 14);
    g.fillStyle = 'rgba(20,10,6,0.55)';
    path(g, ovalPts(0, 0.9, rx, 1.1, 3, 0.05, 18));
    g.fill();
    g.fillStyle = '#c98a3e';
    path(g, ovalPts(0, 0.5, rx - 1.4, 0.7, 4, 0.05, 18));
    g.fill();
    g.fillStyle = '#f6dc6a';
    g.fillRect(-1.2, -0.1, 2.4, 0.9);
  });
}

/** Rooftop AC housing: louvres, a top lip, a nameplate, rust streaks and the fan shrouds. Baked. */
function acBody(w: number, h: number, hue: number, seed: number) {
  return sprite(`dc|ac|${w}|${h}|${hue | 0}|${seed % 4}`, -3, -3, w + 12, h + 6, (g) => {
    const body: HSL = { h: hue, s: 8, l: 74 };
    // Refrigerant lines into the roof.
    g.fillStyle = INK;
    for (const [ax, ay, bx, by] of [
      [w - 2, h - 5, w + 4, h - 5],
      [w + 4, h - 5, w + 4, h],
    ])
      line(g, ax, ay, bx, by, { w: 2.4, seed: ax, taper: [0, 0], press: 0 });
    g.fillStyle = css(METALS.copper.base);
    for (const [ax, ay, bx, by] of [
      [w - 2, h - 5, w + 4, h - 5],
      [w + 4, h - 5, w + 4, h],
    ])
      line(g, ax, ay, bx, by, { w: 1.2, seed: ax + 1, taper: [0, 0], press: 0 });
    const shell = boxPts(-0.5, -0.5, w + 1, h + 1, 2.4, 3, 0.12);
    tone(g, shell, body, { depth: 1.6 });
    g.save();
    path(g, shell);
    g.clip();
    for (let yy = h - 4; yy > Math.max(13, h - 14); yy -= 2.4) tick(g, 2, yy, w - 2, yy, 0.7, yy, css(body, -32));
    g.fillStyle = css(body, 20);
    g.fillRect(0, 0, w, 1.4);
    part(g, boxPts(w - 9, h - 6, 6, 3, 0.4, 4), { h: 210, s: 40, l: 38 }, 4, { depth: 0.2, thin: 0.25, thick: 0.5 });
    for (let k = 0; k < 3; k++) {
      const rx = 3 + hash2(k, seed, 1) * (w - 6);
      tick(g, rx, 2, rx + 0.2, 4 + hash2(k, seed, 2) * (h - 6), 0.6, k, 'rgba(120,60,20,0.4)');
    }
    g.restore();
    pen(g, shell, 5, 0.6, 1.5);
    for (const fx of [8, 24]) {
      g.fillStyle = INK;
      path(g, ovalPts(fx, 8, 7.9, 7.9, fx, 0.02, 20));
      g.fill();
      g.fillStyle = css(body, -46);
      path(g, ovalPts(fx, 8, 7.2, 7.2, fx + 1, 0.02, 20));
      g.fill();
    }
  });
}

function acHousing(rc: RC, m: Deco, d: DrawCtx) {
  stamp(rc.s, acBody(m.w, m.h, d.style.hue, m.seed), m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

/** Antenna masts: lattice towers on guy wires, a dish on one, and aviation lights that blink (live). */
function masts(w: number, h: number) {
  return sprite(`dc|masts|${w}|${h}`, -12, 8, w + 24, h - 6, (g) => {
    const top = 13;
    for (const [i, mx] of [8, w - 8].entries()) {
      g.fillStyle = 'rgba(30,30,36,0.8)';
      line(g, mx, top + 4, mx - 9, h, { w: 0.5, seed: i, taper: [0, 0], press: 0 });
      line(g, mx, top + 4, mx + 9, h, { w: 0.5, seed: i + 1, taper: [0, 0], press: 0 });
      lattice(g, mx, top, h, 5, METALS.steel);
      part(g, boxPts(mx - 5, h - 3, 10, 3, 0.6, i + 3), METALS.steel.base, i + 3, { depth: 0.5, thin: 0.45, thick: 1 });
      if (i === 0) part(g, ovalPts(mx - 5, top + 12, 2, 4.5, 7, 0.03, 14), METALS.steel.light, 7, { depth: 0.6, thin: 0.4, thick: 0.9 });
    }
  });
}

function antennaMasts(rc: RC, m: Deco, d: DrawCtx) {
  const s = rc.s;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  stamp(s, masts(m.w, m.h), x, y);
  for (const [i, mx] of [x + 8, x + m.w - 8].entries()) {
    const on = Math.floor(rc.t * 1.5 + i * 0.5) % 2 === 0;
    s.fillStyle = INK;
    circle(s, mx + 3.5, y + 19, 1.8);
    s.fillStyle = on ? '#ff3a30' : '#601818';
    circle(s, mx + 3.5, y + 19, 1.2);
    if (on) bulb(rc.g, mx + 3.5, y + 19, 1.2, { h: 3, s: 100, l: 55 }, 0.9);
  }
}

defineArt<'deco'>({
  type: 'deco',
  layer: BACKDROP,
  draw: (rc, m, d) => {
    const skin = decoSkin(m, d);
    if (skin) skin(rc, m, d);
    else if (m.kind === 'press') pressBack(rc, m, d);
    else if (m.kind === 'antenna') antennaMasts(rc, m, d);
  },
});
defineArt<'deco'>({ type: 'deco', layer: 1, draw: (rc, m, d) => m.kind === 'ac' && acHousing(rc, m, d) });
defineArt<'deco'>({ type: 'deco', layer: 2, draw: (rc, m, d) => m.kind === 'press' && pressLamp(rc, m, d) });
