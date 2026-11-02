import { css, type HSL } from '../../../core/color';
import { frac } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import type { ModuleOf } from '../../../sim/props';
import { circle, glowDot, hazardStripes, light, METALS, metalFill, type RC, rivet, rrect } from '../../kit';
import { BACKDROP, type DrawCtx, defineArt } from '../common';
import { lattice } from './setpiece';

/**
 * Scenery dressing for set pieces: the press gantry and the antenna masts
 * under tesla coils stand behind the terrain. The press's warning lamp (a
 * tell, synced to the piston) and rooftop AC housings (they skin a solid
 * body you stand on) stay in front.
 */

type Deco = ModuleOf<'deco'>;

function pressPosts(rc: RC, m: Deco, d: DrawCtx) {
  const s = rc.s;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const pal = d.pal;
  for (const px of [x + 3, x + m.w - 13]) {
    s.fillStyle = 'rgba(0,0,0,0.3)';
    s.fillRect(px + 2, y + 8, 10, m.h - 8);
    s.fillStyle = metalFill(s, pal, px, y, 10, m.h, Math.PI / 2);
    s.fillRect(px, y + 8, 10, m.h - 8);
    s.fillStyle = css(pal.dark, -6);
    s.fillRect(px + 3.5, y + 8, 3, m.h - 8);
    s.fillStyle = css(pal.light, 0, 0.5);
    s.fillRect(px + 0.5, y + 8, 1, m.h - 8);
    hazardStripes(s, px, y + m.h - 12, 10, 8, 0.85);
    s.fillStyle = metalFill(s, METALS.steel, px - 3, y + m.h - 3, 16, 3);
    s.fillRect(px - 3, y + m.h - 3, 16, 3);
    rivet(s, px - 1, y + m.h - 1.5, METALS.steel, 0.8);
    rivet(s, px + 11, y + m.h - 1.5, METALS.steel, 0.8);
  }
}

function pressBeam(rc: RC, m: Deco, d: DrawCtx) {
  const s = rc.s;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const pal = d.pal;
  const cx = x + m.w / 2;
  // Hydraulic cylinder housing on top of the beam.
  s.fillStyle = metalFill(s, METALS.steel, cx - 9, y - 12, 18, 14);
  rrect(s, cx - 8, y - 12, 16, 14, [4, 4, 0, 0]);
  s.fill();
  s.strokeStyle = css(METALS.steel.dark, -8);
  s.lineWidth = 0.9;
  s.stroke();
  s.strokeStyle = '#26282e';
  s.lineWidth = 1.6;
  s.beginPath();
  s.moveTo(cx + 8, y - 6);
  s.bezierCurveTo(cx + 16, y - 6, x + m.w - 8, y - 10, x + m.w - 8, y);
  s.stroke();
  // Beam.
  s.fillStyle = 'rgba(0,0,0,0.3)';
  s.fillRect(x + 2, y + 2, m.w, 14);
  s.fillStyle = metalFill(s, pal, x, y, m.w, 14);
  rrect(s, x, y, m.w, 14, 2);
  s.fill();
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 1;
  s.stroke();
  hazardStripes(s, x + 1, y + 10, m.w - 2, 3.5, 0.9);
  for (let px = x + 4; px < x + m.w - 2; px += 6) rivet(s, px, y + 3, pal, 0.9);
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
  s.fillStyle = '#2a2a30';
  s.fillRect(lx - 3, ly + 1, 6, 2.5);
  s.fillStyle = on ? '#ff5040' : '#5a1a16';
  circle(s, lx, ly, 2.4);
  if (on) {
    const red: HSL = { h: 4, s: 100, l: 55 };
    glowDot(rc.g, lx, ly, 12, red, 0.9);
    light(rc, lx, ly, 60, red, 0.8);
  }
}

function acHousing(rc: RC, m: Deco, d: DrawCtx) {
  const s = rc.s;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const body: HSL = { h: d.style.hue, s: 8, l: 74 };
  // Refrigerant lines into the roof.
  s.strokeStyle = css(METALS.copper.base);
  s.lineWidth = 1.6;
  s.beginPath();
  s.moveTo(x + m.w - 2, y + m.h - 5);
  s.lineTo(x + m.w + 4, y + m.h - 5);
  s.lineTo(x + m.w + 4, y + m.h);
  s.stroke();
  s.fillStyle = 'rgba(0,0,0,0.3)';
  s.fillRect(x + 2, y + 2, m.w, m.h);
  const gr = s.createLinearGradient(0, y, 0, y + m.h);
  gr.addColorStop(0, css(body, 14));
  gr.addColorStop(1, css(body, -12));
  s.fillStyle = gr;
  rrect(s, x - 0.5, y - 0.5, m.w + 1, m.h + 1, 2.5);
  s.fill();
  s.strokeStyle = css(body, -40);
  s.lineWidth = 1;
  s.stroke();
  // Louvres along the bottom, a top lip, a nameplate and rust drips.
  s.fillStyle = css(body, -30, 0.8);
  for (let yy = y + m.h - 4; yy > y + Math.max(13, m.h - 14); yy -= 2.4) s.fillRect(x + 2, yy, m.w - 4, 1);
  s.fillStyle = css(body, 22);
  s.fillRect(x, y, m.w, 1.5);
  s.fillStyle = css({ h: 210, s: 40, l: 35 });
  s.fillRect(x + m.w - 9, y + m.h - 6, 6, 3);
  s.strokeStyle = 'rgba(120,60,20,0.35)';
  s.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const rx = x + 3 + hash2(k, m.seed, 1) * (m.w - 6);
    s.beginPath();
    s.moveTo(rx, y + 2);
    s.lineTo(rx, y + 4 + hash2(k, m.seed, 2) * (m.h - 6));
    s.stroke();
  }
  // Fan shrouds (the fan modules draw blades on top).
  s.fillStyle = css(body, -45);
  for (const fx of [x + 8, x + 24]) circle(s, fx, y + 8, 7.4);
  s.strokeStyle = css(body, 10);
  s.lineWidth = 0.8;
  for (const fx of [x + 8, x + 24]) {
    s.beginPath();
    s.arc(fx, y + 8, 7.4, 0, Math.PI * 2);
    s.stroke();
  }
}

function antennaMasts(rc: RC, m: Deco, d: DrawCtx) {
  const s = rc.s;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const gy = y + m.h;
  const tops = [x + 8, x + m.w - 8];
  for (const [i, mx] of tops.entries()) {
    const top = y + 13;
    // Guy wires.
    s.strokeStyle = 'rgba(30,30,36,0.7)';
    s.lineWidth = 0.6;
    s.beginPath();
    s.moveTo(mx, top + 4);
    s.lineTo(mx - 9, gy);
    s.moveTo(mx, top + 4);
    s.lineTo(mx + 9, gy);
    s.stroke();
    lattice(s, mx, top, gy, 5, METALS.steel);
    s.fillStyle = metalFill(s, METALS.steel, mx - 5, gy - 3, 10, 3);
    s.fillRect(mx - 5, gy - 3, 10, 3);
    if (i === 0) {
      // A little dish.
      s.fillStyle = css(METALS.steel.light);
      s.beginPath();
      s.ellipse(mx - 5, top + 12, 2, 4.5, -0.4, 0, Math.PI * 2);
      s.fill();
      s.strokeStyle = css(METALS.steel.dark);
      s.lineWidth = 0.6;
      s.stroke();
    }
    // Aviation light.
    const on = Math.floor(rc.t * 1.5 + i * 0.5) % 2 === 0;
    s.fillStyle = on ? '#ff3a30' : '#601818';
    circle(s, mx + 3.5, top + 6, 1.2);
    if (on) glowDot(rc.g, mx + 3.5, top + 6, 6, { h: 3, s: 100, l: 55 }, 0.8);
  }
}

defineArt<'deco'>({
  type: 'deco',
  layer: BACKDROP,
  draw: (rc, m, d) => {
    if (m.kind === 'press') {
      pressPosts(rc, m, d);
      pressBeam(rc, m, d);
    } else if (m.kind === 'antenna') antennaMasts(rc, m, d);
  },
});
defineArt<'deco'>({ type: 'deco', layer: 1, draw: (rc, m, d) => m.kind === 'ac' && acHousing(rc, m, d) });
defineArt<'deco'>({ type: 'deco', layer: 2, draw: (rc, m, d) => m.kind === 'press' && pressLamp(rc, m, d) });
