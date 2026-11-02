import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { magnetCycle, type ModuleOf } from '../../../sim/props';
import { inkFor, line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { bulb, circle, light, type MetalPalette, type RC } from '../../kit';
import { type DrawCtx, defineArt } from '../common';
import { housed } from '../machine';

/** Where the core floats in a housed magnet: between the horseshoe's poles, where the field is. */
const CORE_Y = -2.4;
const CORE_R = 3.4;

/**
 * The core: a black hole in a jar (pull) or a hot pushy orb (push). Black Hole Lite wears a diet soda's
 * silver band across it.
 */
function orb(pull: boolean, lite: boolean) {
  return sprite(`mg|core|${pull}|${lite}`, -5, -5, 10, 10, (g) => {
    const base: HSL = pull ? { h: 268, s: 34, l: 30 } : { h: 24, s: 62, l: 52 };
    const R = CORE_R;
    ball(g, 0, 0, R, base, 3);
    g.save();
    path(g, ovalPts(0, 0, R, R, 3, 0.02, 20));
    g.clip();
    if (pull) {
      // The event horizon: a lit swirl winding in to a dark heart.
      const sw: P[] = [];
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI * 2.6 + 0.6;
        const r = R * 0.82 - (i / 18) * R * 0.62;
        sw.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.75 });
      }
      g.fillStyle = css(base, 30);
      stroke(g, sw, { w: 0.6, seed: 4, taper: [0.1, 0.6], press: 0.1 });
      g.fillStyle = inkFor(base);
      path(g, ovalPts(0.2, 0.2, 1, 0.9, 5, 0.05, 10));
      g.fill();
    } else {
      // Push: rays cut out from the middle.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        tick(g, Math.cos(a) * 1.2, Math.sin(a) * 1.2, Math.cos(a) * 2.8, Math.sin(a) * 2.8, 0.55, i, css(base, 26));
      }
    }
    if (lite) {
      // The diet label: a silver band with the word on it, wrapped round the jar.
      const silver: HSL = { h: 215, s: 12, l: 86 };
      g.fillStyle = css(silver);
      path(g, poly(-R - 0.5, -1.1, R + 0.5, -1.4, R + 0.5, 1.2, -R - 0.5, 1.5));
      g.fill();
      tick(g, -R, -1.2, R, -1.5, 0.3, 5, css(silver, -36));
      tick(g, -R, 1.4, R, 1.1, 0.3, 6, css(silver, -36));
      g.fillStyle = css({ h: 356, s: 62, l: 46 });
      g.font = 'bold 1.9px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('LITE', 0, 0);
    }
    g.restore();
  });
}

/**
 * The housing, the whole cell: a cartoon horseshoe magnet standing on its bend with its poles up, the core
 * floating in the gap between them. Thick painted arms, bright steel pole pieces with a dark seam where
 * they're pressed into the paint, a hard shine down the lit arm, and a plate in the part's metal bolted
 * across the bend. A repulsor's is painted the other pole's blue.
 */
function horseshoe(pull: boolean, pal: MetalPalette) {
  return sprite(`mg|shoe|${pull}|${pal.base.h},${pal.base.l}`, -10, -10, 20, 20, (g) => {
    const paint: HSL = pull ? { h: 356, s: 58, l: 46 } : { h: 212, s: 50, l: 46 };
    const steel: HSL = { h: 210, s: 8, l: 80 };
    const R = 7.6;
    const r = 3.6;
    const cy = 1.4;
    const top = -7.6;
    const shoe: P[] = [{ x: -R, y: top }];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI - (i / 14) * Math.PI;
      shoe.push({ x: Math.cos(a) * R, y: cy + Math.sin(a) * (7.6 - cy) });
    }
    shoe.push({ x: R, y: top }, { x: r, y: top });
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      shoe.push({ x: Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    shoe.push({ x: -r, y: top });
    part(g, shoe, paint, 5, { depth: 1.1, shade: -18, thin: 0.55, thick: 1.4 });
    g.save();
    path(g, shoe);
    g.clip();
    // The shine down the lit arm and round into the bend.
    const shine: P[] = [{ x: -R + 1.5, y: top + 4 }];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI - (i / 8) * (Math.PI * 0.42);
      shine.push({ x: Math.cos(a) * (R - 1.5), y: cy + Math.sin(a) * (R - 1.5) * 0.8 });
    }
    g.fillStyle = css(paint, 24);
    stroke(g, shine, { w: 0.8, seed: 6, taper: [0.25, 0.5], press: 0.1 });
    // The steel pole pieces, and the seam where each meets the paint.
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -R - 0.5 : r - 0.2;
      const x1 = sx < 0 ? -r + 0.2 : R + 0.5;
      part(g, poly(x0, top - 0.5, x1, top - 0.5, x1, top + 3.4, x0, top + 3.4), steel, 7 + sx, { depth: 0.5, shade: -20, thin: 0.3, thick: 0.6 });
      tick(g, x0 + 0.4, top + 3.5, x1 - 0.4, top + 3.5, 0.55, 9 + sx, css(paint, -30));
    }
    g.restore();
    // A ground face scored across each pole.
    g.fillStyle = css(steel, -34);
    for (const sx of [-1, 1]) {
      const xm = (sx * (R + r)) / 2;
      line(g, xm - 1.5, top + 0.9, xm + 1.5, top + 0.9, { w: 0.3, seed: 12 + sx, taper: [0.2, 0.3], press: 0.2 });
    }
    // The plate bolted across the bend.
    part(g, boxPts(-3.4, cy + r + 0.3, 6.8, 2.1, 0.6, 14, 0.15), pal.base, 14, { depth: 0.4, thin: 0.35, thick: 0.8 });
    for (const x of [-2.2, 2.2]) dot(g, x, cy + r + 1.35, 0.45, 15 + x, css(pal.light), inkFor(pal.base));
  });
}

/**
 * The harbor's whirlpool (look `whirlpool`): a waterspout twisting up out of the sea to the core of the pull
 * and a little past it. Off, the water just turns; charging, the sea churns and a thin spout climbs, the
 * field's edge drawing round; on, the spout is up and spinning, spray streaming in along the ring.
 */
function waterspout(rc: RC, m: ModuleOf<'magnet'>, d: DrawCtx) {
  const s = rc.s;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const sea = (d.o.level?.h ?? 27) * TILE - 11;
  const c = magnetCycle(m, rc.frame, d.r.phase);
  const on = c.seg === 2;
  const k = c.seg === 1 ? c.t / c.len : on ? 1 : 0;
  const water: HSL = { h: 198, s: 46, l: 62 };
  // The churn on the surface.
  for (let i = 0; i < 3; i++) {
    const u = (rc.t * (0.3 + k) + i / 3) % 1;
    s.strokeStyle = `rgba(235,248,255,${(0.25 + k * 0.5) * (1 - u)})`;
    s.lineWidth = 1;
    s.beginPath();
    s.ellipse(x, sea, 4 + u * (8 + k * 14), 1 + u * 2, 0, 0, Math.PI * 2);
    s.stroke();
  }
  if (k > 0) {
    // The spout: bands twisting round a column narrowing upward, up to just over the core.
    const top = y - 6 - (on ? 6 : 0);
    const h = Math.max(4, (sea - top) * (on ? 1 : k));
    const n = Math.max(6, Math.round(h / 4));
    const spin = rc.t * (on ? 9 : 4);
    for (let i = 0; i < n; i++) {
      const v = i / n;
      const yy = sea - v * h;
      const r = (1 - v * 0.55) * (4 + k * 5);
      const ph = spin + v * 6;
      s.fillStyle = inkFor(water);
      line(s, x - r - 0.6, yy, x + r + 0.6, yy - 2.5, { w: 2.4, seed: i, taper: [0.2, 0.2], press: 0 });
      s.fillStyle = css(water, Math.sin(ph) * 12 + 4);
      line(s, x - r, yy, x + r, yy - 2.5, { w: 1.6, seed: i, taper: [0.2, 0.2], press: 0 });
    }
    // The field's edge, at the radius the sim pulls from, closing round as it charges.
    s.strokeStyle = css(water, 20, on ? 0.5 : 0.2 + k * 0.4);
    s.lineWidth = on ? 1.1 : 0.8;
    s.setLineDash(on ? [] : [3, 4]);
    s.beginPath();
    s.arc(x, y, m.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    s.stroke();
    s.setLineDash([]);
  }
  if (!on) return;
  // Spray drawn in along the ring toward the core.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rc.t * 2;
    const u = 1 - ((rc.t * 0.8 + i * 0.29) % 1);
    const r = 5 + u * (m.radius - 5);
    s.fillStyle = `rgba(235,248,255,${0.8 * Math.sin(u * Math.PI)})`;
    circle(s, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.1);
  }
}

/**
 * Gravity well / repulsor. The field edge is drawn as a ring at the exact radius the sim uses; motes stream
 * inward (pull) or outward (push) while it's on. Pulsing fields show a dim dotted ring while off and a filling
 * ring while charging.
 */
defineArt<'magnet'>({
  type: 'magnet',
  layer: 3,
  draw(rc, m, d) {
    if (m.look === 'whirlpool') return waterspout(rc, m, d);
    const s = rc.s;
    const g = rc.g;
    const x = m.at[0] + d.off[0];
    const y = m.at[1] + d.off[1];
    const c = magnetCycle(m, rc.frame, d.r.phase);
    const pull = m.polarity > 0;
    const col: HSL = pull ? { h: 275, s: 90, l: 62 } : { h: 28, s: 100, l: 60 };
    const on = c.seg === 2;
    const charge = c.seg === 1 ? c.t / c.len : on ? 1 : 0;
    const home = housed(d.r);
    // Without its horseshoe the core sits in the middle of the cell.
    const cy = y + (home ? CORE_Y : 0);
    if (home) stamp(s, horseshoe(pull, d.pal), x, y);
    stamp(s, orb(pull, d.r.pp.def.name.includes('Lite')), x, cy);
    // A magnet isn't hot: charging lights a flat core in the orb that grows, and it hums once it's on.
    if (charge > 0) bulb(g, x, cy, 0.8 + charge * 1.1 + (on ? Math.sin(rc.t * 9) * 0.25 : 0), col, 0.35 + charge * 0.55);
    // Field edge, at the radius the sim uses. A repulsor's is floor tape with its distance on it.
    g.save();
    g.strokeStyle = css(col, 5, on ? 0.45 : 0.12 + charge * 0.4);
    g.lineWidth = on ? 1.2 : 0.8;
    if (!pull) g.setLineDash([5, 3]);
    else if (!on) g.setLineDash([2, 4]);
    g.beginPath();
    g.arc(x, y, m.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (c.seg === 1 ? charge : 1));
    g.stroke();
    if (!pull) {
      g.fillStyle = css(col, 15, on ? 0.75 : 0.3 + charge * 0.4);
      g.font = 'bold 5px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('6 FT', x, y - m.radius - 4);
    }
    g.restore();
    if (!on) return;
    // Streaming motes: 14 spokes, each mote travels in (pull) or out (push) once a second.
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
      let u = (rc.t * 0.9 + i * 0.37) % 1;
      if (pull) u = 1 - u;
      const r = 6 + u * (m.radius - 6);
      const fade = Math.sin(u * Math.PI);
      g.fillStyle = css(col, 20, 0.7 * fade);
      circle(g, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.1);
    }
    light(rc, x, y, m.radius * 1.1, col, 0.35);
  },
});
