import { css } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { dirOf, type ModuleOf, pistonHead, pistonState, type Resolved } from '../../../sim/props';
import { line } from '../../ink';
import { boxPts, INK, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import type { MetalPalette, RC } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';

type Piston = ModuleOf<'piston'>;

/**
 * Crusher, inked as a panini press (docs/PARODY.md, crusher): a heavy head on a rod, hazard bands across
 * it, and a ridged grill plate on the face that strikes, with grill marks burned into it. The head is
 * drawn on exactly the rect the sim crushes with; only the ridges, thin as pen lines, stand off the face.
 */

/**
 * Extra depth (px) a crate card draws the head with. The sim's head is half a tile deep, a sliver at card
 * size; the card's grows out from its face, so it never sinks into the body.
 */
export const PISTON_CARD_HEAD = 6;

/** The head, baked in a frame where it strikes toward +y: `w` across, `h` deep. */
function head(w: number, h: number, pal: MetalPalette) {
  return sprite(`ps|${w.toFixed(1)}|${h.toFixed(1)}|${pal.base.h},${pal.base.l}`, -w / 2 - 2, -h / 2 - 2, w + 4, h + 5, (g) => {
    const body = boxPts(-w / 2, -h / 2, w, h, 1.6, 3, 0.15);
    // A dark metal would sink the head into the dark it strikes from: it keeps some light.
    tone(g, body, { ...pal.base, l: Math.max(pal.base.l, 44) }, { depth: 1 });
    g.save();
    path(g, body);
    g.clip();
    // Hazard band across the back half.
    g.fillStyle = '#f2b705';
    g.fillRect(-w / 2, -h / 2 + 1.2, w, 2.6);
    g.fillStyle = INK;
    for (let x = -w / 2 - 3; x < w / 2 + 3; x += 3) {
      path(g, poly(x, -h / 2 + 3.8, x + 1.4, -h / 2 + 3.8, x + 2.8, -h / 2 + 1.2, x + 1.4, -h / 2 + 1.2));
      g.fill();
    }
    // The grill plate: dark iron with grill marks burned across it.
    g.fillStyle = '#2e2a2a';
    g.fillRect(-w / 2, h / 2 - 2.6, w, 2.6);
    g.fillStyle = '#5a4433';
    for (let x = -w / 2 + 1; x < w / 2; x += 2.6) line(g, x, h / 2 - 2.4, x + 1.1, h / 2 - 0.4, { w: 0.6, seed: x, taper: [0.2, 0.2], press: 0 });
    g.restore();
    pen(g, body, 5, 0.55, 1.4);
    tick(g, -w / 2 + 0.6, h / 2 - 2.7, w / 2 - 0.6, h / 2 - 2.7, 0.5, 6);
    // Ridges standing off the striking face.
    g.fillStyle = INK;
    for (let x = -w / 2 + 1.3; x < w / 2 - 0.6; x += 2.6) g.fillRect(x - 0.45, h / 2 - 0.2, 0.9, 1);
  });
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

defineArt<'piston'>({ type: 'piston', layer: 0, draw: (rc, m, d) => drawPistonShaft(rc, m, d.r, d.mi, d.off, d.pal, d.o) });
defineArt<'piston'>({ type: 'piston', layer: 2, draw: (rc, m, d) => drawPistonHead(rc, m, d.r, d.mi, d.off, d.pal, d.o) });
