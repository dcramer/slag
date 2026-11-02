import { css, type HSL } from '../../../core/color';
import { frac, type Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { dirOf, type ModuleOf, pistonHead, pistonState, type Resolved } from '../../../sim/props';
import { line, stroke } from '../../ink';
import { boxPts, dot, INK, ovalPts, part, path, pen, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';
import { bolt, type Face, faceOf, flange, flat, housed, iron, lbox, lp, ltick, tf, within } from '../machine';

type Piston = ModuleOf<'piston'>;

/**
 * Crusher, inked as a panini press (docs/PARODY.md, crusher): a hydraulic housing, a heavy head on a rod
 * with a bolted boss where they meet, and a ridged grill plate on the face that strikes, with grill marks
 * burned into it. The head is drawn on exactly the rect the sim crushes with; only the ridges, thin as pen
 * lines, stand off the face. Its tell is the housing's lamp and a shudder through the last of the rest.
 */

/**
 * Extra depth (px) a crate card draws the head with. The sim's head is half a tile deep, a sliver at card
 * size; the card's grows out from its face, so it never sinks into the body.
 */
export const PISTON_CARD_HEAD = 6;

/** The head, baked in a frame where it strikes toward +y: `w` across, `h` deep. */
function head(w: number, h: number, pal: MetalPalette) {
  return sprite(`ps|${w.toFixed(1)}|${h.toFixed(1)}|${pal.base.h},${pal.base.l}`, -w / 2 - 2, -h / 2 - 2, w + 4, h + 5, (g) => {
    const body = boxPts(-w / 2, -h / 2, w, h, 2.2, 3, 0.15);
    // A dark metal would sink the head into the dark it strikes from: it keeps some light.
    const metal = iron(pal, 44);
    tone(g, body, metal, { depth: 1.1, shade: -18 });
    g.save();
    path(g, body);
    g.clip();
    // A raised boss where the rod meets it, bolted either side.
    const bw = Math.min(w - 4, 7);
    g.fillStyle = css(metal, 12);
    path(g, boxPts(-bw / 2, -h / 2 - 1, bw, h * 0.5 + 1, 1.2, 4));
    g.fill();
    g.fillStyle = css(metal, -24, 1, 6);
    line(g, -bw / 2, -h / 2, -bw / 2 + 0.2, h * 0.02, { w: 0.6, seed: 5, taper: [0.1, 0.3], press: 0.1 });
    line(g, bw / 2, -h / 2, bw / 2 - 0.2, h * 0.02, { w: 0.6, seed: 6, taper: [0.1, 0.3], press: 0.1 });
    // The grill plate: dark iron with grill marks burned across it.
    g.fillStyle = '#2e2a2a';
    g.fillRect(-w / 2 - 1, h / 2 - 2.8, w + 2, 3);
    g.fillStyle = '#6a4a32';
    for (let x = -w / 2 + 1; x < w / 2; x += 2.6) line(g, x, h / 2 - 2.6, x + 1.1, h / 2 - 0.4, { w: 0.6, seed: x, taper: [0.2, 0.2], press: 0 });
    g.restore();
    pen(g, body, 5, 0.55, 1.5);
    for (const sx of [-1, 1]) if (w > 9) dot(g, sx * (w / 2 - 2.2), -h / 2 + 2, 0.75, 7 + sx, css(pal.light));
    tick(g, -w / 2 + 0.6, h / 2 - 2.9, w / 2 - 0.6, h / 2 - 2.9, 0.55, 6);
    // Ridges standing off the striking face.
    g.fillStyle = INK;
    for (let x = -w / 2 + 1.3; x < w / 2 - 0.6; x += 2.6) g.fillRect(x - 0.45, h / 2 - 0.2, 0.9, 1);
  });
}

/**
 * The housing, a whole strip of cells: a hydraulic block bolted down at the back, ribbed at each cell, a
 * collar where the rod leaves at the front, and a caged warning lamp that lights as it winds up.
 */
function housing(k: Face, n: number, pal: MetalPalette) {
  const W = n * TILE;
  const R = W / 2 + 4;
  return sprite(`ps|house|${k}|${n}|${pal.base.h},${pal.base.l}`, -R, -R, R * 2, R * 2, (g) => {
    const metal = iron(pal, 40);
    const back = lbox(k, -W / 2, -8, W, 16, 2.6, 1);
    tone(g, back, { h: pal.dark.h, s: Math.min(30, pal.dark.s), l: 20 }, { depth: 0.8, shade: -7 });
    flange(g, k, -W / 2, W / 2, 4.4, pal, 2);
    for (let i = 1; i < n; i++) bolt(g, k, -W / 2 + i * TILE, 6.2, 0.95, pal, 3 + i);
    const body = lbox(k, -W / 2 + 0.3, -6.2, W - 0.6, 10.8, 2.6, 4, 0.25);
    tone(g, body, metal, { depth: 1.3, shade: -17 });
    within(g, body, () => {
      for (let i = 0; i <= n; i++) {
        const x = -W / 2 + i * TILE;
        if (i > 0 && i < n) {
          ltick(g, k, x - 0.5, -7, x - 0.5, 5, 1.5, 5 + i, css(metal, -22, 1, 4), [0, 0]);
          ltick(g, k, x + 0.4, -7, x + 0.4, 5, 0.6, 6 + i, css(metal, 16), [0, 0]);
        }
      }
      ltick(g, k, -W / 2 + 2, -5, -W / 2 + 4.5, -5.2, 0.9, 7, css(pal.spec, -8), [0.2, 0.3]);
    });
    pen(g, body, 8, 0.55, 1.5);
    // A hydraulic hose looped off each end: thin, so it hangs past the block as decoration.
    for (const sg of [-1, 1]) {
      const e = sg * (W / 2);
      const hose = lp(k, e - sg * 1.4, 5.4, e + sg * 1.6, 4.6, e + sg * 2.5, 1.2, e + sg * 1.9, -2.6, e - sg * 0.6, -4.6);
      g.fillStyle = INK;
      stroke(g, hose, { w: 1.7, seed: 12 + sg, taper: [0, 0], press: 0.1 });
      g.fillStyle = '#3b3633';
      stroke(g, hose, { w: 0.85, seed: 13 + sg, taper: [0, 0], press: 0.1 });
    }
    // The collar the rod leaves through.
    part(g, lbox(k, -4.6, -8.3, 9.2, 3, 1, 9), css2(metal), 9, { depth: 0.5, thin: 0.45, thick: 1.2 });
    flat(g, lbox(k, -2.6, -8.4, 5.2, 1.2, 0.4, 10), '#15110f');
    // The lamp's cage; the lens in it is drawn live.
    const c = tf(k, 0, LAMP_Y);
    g.fillStyle = INK;
    path(g, ovalPts(c.x, c.y, 2.9, 2.9, 11, 0.02, 16));
    g.fill();
    g.fillStyle = css(metal, 18);
    path(g, ovalPts(c.x - 0.1, c.y - 0.1, 2.2, 2.2, 12, 0.02, 16));
    g.fill();
  });
}

const css2 = (c: HSL): HSL => ({ ...c, l: Math.max(28, c.l - 10) });

/** Where the warning lamp sits in the housing's local frame. */
const LAMP_Y = -0.6;

/** 0..1 how near the next slam is, over the last stretch of the rest: what the lamp and the shudder show. */
function windup(m: Piston, f: number, phase: number): number {
  const t = frac(f / m.period + phase - (m.lag ?? 0));
  return t > 0.78 ? (t - 0.78) / 0.22 : 0;
}

function drawPistonShaft(rc: RC, m: Piston, r: Resolved, mi: number, off: Vec, pal: MetalPalette, o: PropDrawOpts) {
  const st = pistonState(m, rc.frame, r.phase);
  const hd = pistonHead(m, st.ext, off, beamOf(o, r, mi)?.len);
  const [dx, dy] = dirOf(m.angle);
  const s = rc.s;
  const fx = m.at[0] + off[0] + dx * TILE * 0.5;
  const fy = m.at[1] + off[1] + dy * TILE * 0.5;
  const hx = hd.x + hd.w / 2 - (dx * hd.w) / 2;
  const hy = hd.y + hd.h / 2 - (dy * hd.h) / 2;
  s.fillStyle = INK;
  line(s, fx, fy, hx, hy, { w: 4.6, seed: 1, taper: [0, 0], press: 0 });
  s.fillStyle = '#b9c0cb';
  line(s, fx, fy, hx, hy, { w: 2.8, seed: 2, taper: [0, 0], press: 0 });
  s.fillStyle = 'rgba(255,255,255,0.75)';
  line(s, fx - dy * 0.6, fy - dx * 0.6, hx - dy * 0.6, hy - dx * 0.6, { w: 0.6, seed: 3, taper: [0.05, 0.3], press: 0 });
  // A collar where the rod leaves the body.
  s.fillStyle = INK;
  line(s, fx - dy * 3.4, fy - dx * 3.4, fx + dy * 3.4, fy + dx * 3.4, { w: 2.4, seed: 4, taper: [0.1, 0.1], press: 0 });
  s.fillStyle = css(pal.base);
  line(s, fx - dy * 2.8, fy - dx * 2.8, fx + dy * 2.8, fy + dx * 2.8, { w: 1.2, seed: 5, taper: [0.1, 0.1], press: 0 });
}

function drawPistonHead(rc: RC, m: Piston, r: Resolved, mi: number, off: Vec, pal: MetalPalette, o: PropDrawOpts) {
  const st = pistonState(m, rc.frame, r.phase);
  const hd = pistonHead(m, st.ext, off, beamOf(o, r, mi)?.len);
  const s = rc.s;
  const [dx, dy] = dirOf(m.angle);
  let cx = hd.x + hd.w / 2;
  let cy = hd.y + hd.h / 2;
  const across = dx !== 0 ? hd.h : hd.w;
  const deep = (dx !== 0 ? hd.w : hd.h) + (o.card ? PISTON_CARD_HEAD : 0);
  if (o.card) {
    cx += (dx * PISTON_CARD_HEAD) / 2;
    cy += (dy * PISTON_CARD_HEAD) / 2;
  }
  // It shudders across its stroke as it winds up: a tell that never moves its striking face.
  const wind = windup(m, rc.frame, r.phase);
  if (wind > 0) {
    const sh = Math.sin(rc.frame * 2.9) * 0.5 * wind;
    cx += dy !== 0 ? sh : 0;
    cy += dx !== 0 ? sh : 0;
  }
  if (st.slamming) {
    // Speed lines behind a head that's coming down.
    s.fillStyle = 'rgba(255,255,255,0.7)';
    for (const k of [-0.32, 0, 0.32]) {
      const ax = cx - dy * across * k - dx * (deep / 2 + 2);
      const ay = cy - dx * across * k - dy * (deep / 2 + 2);
      line(s, ax, ay, ax - dx * 9, ay - dy * 9, { w: 0.9, seed: k * 9 + 3, taper: [0.1, 0.8], press: 0 });
    }
  }
  s.save();
  s.translate(cx, cy);
  // The bake strikes toward +y.
  s.rotate(Math.atan2(dy, dx) - Math.PI / 2);
  stamp(s, head(across, deep, pal));
  s.restore();
}

/** A crate part's housing, and its lamp: dim at rest, blinking through the wind-up, burning through the slam. */
function drawPistonHousing(rc: RC, m: Piston, r: Resolved, off: Vec, pal: MetalPalette) {
  if (!housed(r)) return;
  const [dx, dy] = dirOf(m.angle);
  const k = faceOf(dx, dy);
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  stamp(rc.s, housing(k, Math.max(1, Math.round(m.width / TILE)), pal), x, y);
  const wind = windup(m, rc.frame, r.phase);
  const on = pistonState(m, rc.frame, r.phase).slamming || (wind > 0 && Math.floor(rc.frame / Math.max(2, 7 - wind * 5)) % 2 === 0);
  const c = tf(k, 0, LAMP_Y);
  rc.s.fillStyle = on ? '#ff3b26' : '#5c1a14';
  rc.s.beginPath();
  rc.s.ellipse(x + c.x, y + c.y, 1.75, 1.75, 0, 0, Math.PI * 2);
  rc.s.fill();
  rc.s.fillStyle = on ? 'rgba(255,230,210,0.95)' : 'rgba(255,190,170,0.35)';
  rc.s.fillRect(x + c.x - 1, y + c.y - 1.05, 0.8, 0.7);
  if (on) {
    const red: HSL = { h: 6, s: 100, l: 58 };
    glowDot(rc.g, x + c.x, y + c.y, 7, red, 0.9);
    light(rc, x + c.x, y + c.y, 40, red, 0.7);
  }
}

defineArt<'piston'>({ type: 'piston', layer: 1, draw: (rc, m, d) => drawPistonHousing(rc, m, d.r, d.off, d.pal) });
defineArt<'piston'>({ type: 'piston', layer: 0, draw: (rc, m, d) => drawPistonShaft(rc, m, d.r, d.mi, d.off, d.pal, d.o) });
defineArt<'piston'>({ type: 'piston', layer: 2, draw: (rc, m, d) => drawPistonHead(rc, m, d.r, d.mi, d.off, d.pal, d.o) });
