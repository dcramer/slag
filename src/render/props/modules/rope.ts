import { clamp } from '../../../core/geom';
import { css, type HSL, mixHsl } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { openSky, ropeStrain } from '../../../sim/props';
import { blob, line, stroke } from '../../ink';
import { boxPts, dot, glint, INK, part, pen, poly, sprite, stamp, tone } from '../../ink-props';
import { glowDot, light } from '../../kit';
import { defineArt, gripOf } from '../common';
import { arcPts, capsulePts, place } from '../ink-motion';

/**
 * The Sausage Vine: the jungle swing vine, as a string of butcher's links on an S-hook. Each link is a
 * plump, pinched casing in two tones with a wet shine, tied off with twine; they're baked once and
 * stamped along the rope, so the rope can bend and sway for free. Idle it sways a touch; held it goes taut
 * to the rider and the rest trails behind. Strain cooks the links (paler and thinner, then seared, then
 * glowing) until it snaps, and a snapped rope grows back link by link.
 */

const LINK = 9;
const RAW: HSL = { h: 11, s: 56, l: 43 };
const SEARED: HSL = { h: 14, s: 78, l: 30 };
const HOT: HSL = { h: 8, s: 95, l: 52 };
const TWINE: HSL = { h: 40, s: 40, l: 80 };
/** Heat steps a link is baked at. */
const COOK = 4;

/** One link, hanging along +y from its middle, `LINK` long. */
function link(cook: number) {
  return sprite(`rope|link|${cook}`, -4.5, -6.5, 9, 13, (g) => {
    const u = cook / COOK;
    const c = u < 0.6 ? mixHsl(RAW, SEARED, u / 0.6) : mixHsl(SEARED, HOT, (u - 0.6) / 0.4);
    const pts = place(capsulePts(LINK + 1.2, 2.6, 0.55, 0.55), 0, -(LINK + 0.6) / 2, Math.PI / 2);
    tone(g, pts, c, { depth: 1.15, shade: -18 });
    // Casing flecks: a few pale spots of fat.
    g.fillStyle = css(c, 20, 0.9, -15);
    for (let i = 0; i < 3; i++) {
      blob(g, -0.9 + hash2(i, 1, 7) * 2, -2.8 + i * 2.6, 0.34, i, 1, 0.2);
      g.fill();
    }
    // Grill marks once it's cooking.
    if (u > 0.3) {
      g.fillStyle = css(SEARED, -18, 0.85);
      for (const y of [-1.8, 1.2]) line(g, -1.8, y - 0.7, 1.4, y + 0.7, { w: 0.7, seed: y, taper: [0.2, 0.3], press: 0.1 });
    }
    glint(g, poly(-1.2, -3.2, -1.5, -0.6, -1.3, 2), 'rgba(255,236,226,0.9)', 0.7, 4);
    pen(g, pts, 11 + cook, 0.45, 1.3, 3);
  });
}

/** The twine tie between two links: a wrap, and a loose end sticking out. */
function knot() {
  return sprite('rope|knot', -3, -2, 6, 4.5, (g) => {
    const band = boxPts(-1.1, -0.6, 2.2, 1.2, 0.5, 3, 0.1);
    part(g, band, { ...TWINE, l: 68 }, 3, { depth: 0.25, thin: 0.25, thick: 0.5 });
    g.fillStyle = INK;
    stroke(g, poly(1.4, 0.2, 2.3, 1.4, 2.4, 2.4), { w: 0.6, seed: 2, taper: [0.1, 0.5], press: 0 });
    g.fillStyle = css(TWINE);
    stroke(g, poly(1.4, 0.2, 2.3, 1.4, 2.4, 2.3), { w: 0.3, seed: 2, taper: [0.1, 0.5], press: 0 });
  });
}

/** The butcher's S-hook it hangs from, on a screwed plate under a ceiling or on twine from the sky. */
function hook(sky: boolean) {
  return sprite(`rope|hook|${sky}`, -6, -2, 12, 10, (g) => {
    if (!sky) {
      const plate = boxPts(-4.6, -1.2, 9.2, 2.6, 0.7, 5, 0.15);
      part(g, plate, { h: 220, s: 8, l: 52 }, 5, { depth: 0.5, thin: 0.35, thick: 0.9 });
      for (const x of [-3.1, 3.1]) dot(g, x, 0.1, 0.55, x, '#e4e7ee');
    }
    // An S: a top curl over the plate, a bottom curl the first link hangs in.
    const s1 = arcPts(0.9, 2.4, 1.3, Math.PI * 2.05, Math.PI * 1.1, 8);
    const s2 = arcPts(-0.2, 5.1, 1.5, -Math.PI * 0.55, Math.PI * 0.9, 9);
    const sPath = [...s1, ...s2];
    g.fillStyle = INK;
    stroke(g, sPath, { w: 1.9, seed: 6, taper: [0.15, 0.25], press: 0.1 });
    g.fillStyle = '#c4c8d2';
    stroke(g, sPath, { w: 0.75, seed: 6, taper: [0.2, 0.3], press: 0.1 });
  });
}

defineArt<'rope'>({
  type: 'rope',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const ax = m.at[0] + d.off[0];
    const ay = m.at[1] + d.off[1];
    const grip = gripOf(d);
    const sway = grip ? 0 : Math.sin(rc.t * 1.4 + d.r.phase * 6.28) * 1.8;
    const n = Math.max(2, Math.round(m.length / LINK));
    const left = d.o.broken && d.o.state ? d.o.state.brokenUntil - rc.frame : 0;
    const shown = left > 0 ? clamp(Math.ceil(n * (1 - left / m.regrow)), 1, n) : n;
    const heat = grip ? ropeStrain(m.strain, grip.t) : 0;
    const k = grip ? Math.min(1, grip.len / m.length) : 1;
    const px = (u: number): number => {
      if (!grip) return ax + sway * u * u;
      if (u <= k) return ax + grip.x * (u / k);
      return ax + grip.x - grip.s * 0.03 * (((u - k) * m.length) / 8);
    };
    // The first link hangs in the hook's curl, a few px under the anchor; the drop fades out down the rope.
    const drop = (u: number) => 5.5 * Math.max(0, 1 - u / k);
    const py = (u: number): number => {
      if (!grip) return ay + drop(u) + (m.length - 2) * u;
      if (u <= k) return ay + drop(u) + grip.y * (u / k);
      return ay + grip.y + (u - k) * m.length;
    };
    const sky = !!d.o.level && openSky(d.o.level, d.o.placed ?? [], Math.floor(ax / TILE), Math.floor(ay / TILE));
    if (sky) {
      s.fillStyle = INK;
      line(s, ax, ay + 1, ax, 0, { w: 1.24, seed: 3, taper: [0, 0], press: 0 });
      s.fillStyle = css(TWINE);
      line(s, ax, ay + 1, ax, 0, { w: 0.7, seed: 3, taper: [0, 0], press: 0 });
    }
    // Strain thins the links, and cooks them hotter the longer it lasts.
    const cook = Math.min(COOK, Math.round(heat * COOK));
    const lk = link(cook);
    const thin = 1 - heat * 0.32;
    const kn = knot();
    for (let i = 0; i < shown; i++) {
      const x0 = px(i / n);
      const y0 = py(i / n);
      const x1 = px((i + 1) / n);
      const y1 = py((i + 1) / n);
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      s.save();
      s.translate((x0 + x1) / 2, (y0 + y1) / 2);
      // Each twist kinks the string a little, alternating, so it hangs like links and not a rod.
      s.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2 + (i % 2 ? 0.09 : -0.09) * (1 - heat));
      s.scale(thin, len / LINK);
      stamp(s, lk);
      s.restore();
    }
    for (let i = 1; i < shown; i++) stamp(s, kn, px(i / n), py(i / n));
    stamp(s, hook(sky), ax, ay + 1.2);
    if (heat > 0) {
      const x = px(k * 0.5);
      const y = py(k * 0.5);
      glowDot(g, x, y, 10 + heat * 8, HOT, 0.15 + heat * 0.5);
      light(rc, x, y, 26, HOT, heat * 0.7);
    }
  },
});
