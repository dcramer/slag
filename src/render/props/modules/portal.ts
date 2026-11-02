import { css, type HSL } from '../../../core/color';
import { portalPads } from '../../../sim/props';
import { hash2 } from '../../../core/rng';
import { type P, sn, stroke } from '../../ink';
import { part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light } from '../../kit';
import { defineArt } from '../common';

/**
 * Plot holes (docs/PARODY.md, portal): two holes torn in the page. Each is a ragged ring of ruled
 * notebook paper round a deep colored void, one warm and one cool so you can tell the ends apart, with
 * a flap of page curled back off the tear. The paper and the void are baked; a three-armed swirl turns
 * inside the void, opposite ways in each. Nothing here is solid, so nothing is drawn under it.
 */

const RX = 5.6;
const RY = 7.6;

function voidPts(seed: number, k: number): P[] {
  const pts: P[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const j = (i % 2 ? -0.35 : 0.35) + (hash2(i, 4, seed) - 0.5) * 0.7;
    pts.push({ x: Math.cos(a) * (RX + j) * k, y: Math.sin(a) * (RY + j * 1.2) * k });
  }
  return pts;
}

function hole(i: number, hue: number) {
  return sprite(`pt|${i}|${hue | 0}`, -12, -13, 24, 26, (g) => {
    const seed = 11 + i * 7;
    const rim: P[] = [];
    const n = 34;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      // Torn: a ragged run of bites and slivers, now and then a long jagged tooth.
      const tear = 1.3 * sn(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6, seed) + (k % 2 ? -0.35 : 0.35) + (hash2(k, 1, seed) > 0.78 ? 1.4 : 0);
      rim.push({ x: Math.cos(a) * (RX + 3 + tear), y: Math.sin(a) * (RY + 3 + tear * 1.1) });
    }
    const paper: HSL = { h: 44, s: 38, l: 91 };
    tone(g, rim, paper, { depth: 0.9, shade: -16 });
    // Ruled lines on the page, the margin in red.
    g.save();
    path(g, rim);
    g.clip();
    for (let ly = -10; ly < 12; ly += 3.2) tick(g, -11, ly, 11, ly + 0.15, 0.4, ly + seed, 'rgba(80,130,200,0.6)');
    tick(g, i === 0 ? -6.6 : 6.6, -12, i === 0 ? -6.4 : 6.6, 12, 0.45, seed, 'rgba(210,70,70,0.7)');
    g.restore();
    pen(g, rim, seed, 0.45, 1.3, 4);
    // The void: deep, in the pad's color, its far wall a shade lighter.
    const hc: HSL = { h: hue, s: 80, l: 20 };
    const v = voidPts(seed, 1);
    g.fillStyle = css(hc, 14, 1, 10);
    path(g, v);
    g.fill();
    g.save();
    path(g, v);
    g.clip();
    g.fillStyle = css(hc, -8);
    path(
      g,
      v.map((q) => ({ x: q.x - 1.2, y: q.y - 1.6 })),
    );
    g.fill();
    g.restore();
    // The fibrous lip: a pale torn edge just inside, down the lit side, then ink.
    g.fillStyle = 'rgba(255,252,238,0.95)';
    stroke(g, [...v.slice(15), ...v.slice(0, 2)], { w: 0.9, seed, taper: [0.2, 0.3], press: 0.5 });
    pen(g, v, seed + 3, 0.5, 1.1, 3);
    // A flap of page curling back off the tear: its back is a shade darker.
    const sg = i === 0 ? 1 : -1;
    const flap = poly(sg * 5.4, -4.2, sg * 9.6, -6.6, sg * 9.2, -3.4, sg * 7.8, -0.4, sg * 5.6, 0.4);
    part(g, flap, { h: 42, s: 26, l: 80 }, seed + 5, { depth: 0.4, thin: 0.35, thick: 0.8 });
    tick(g, sg * 6.2, -3.4, sg * 8.6, -4.6, 0.3, seed + 6, 'rgba(80,130,200,0.5)');
  });
}

const arm: P[] = [];

/** One arm of the swirl, from the core out, `rot` turned. */
function swirlArm(g: CanvasRenderingContext2D, x: number, y: number, rot: number, dir: number, k: number) {
  arm.length = 0;
  for (let j = 0; j <= 9; j++) {
    const t = j / 9;
    const a = rot + dir * t * 3.2;
    arm.push({ x: x + Math.cos(a) * RX * 0.92 * t * k, y: y + Math.sin(a) * RY * 0.92 * t * k });
  }
  stroke(g, arm, { w: 1.7 * k, seed: 3, taper: [0.15, 0.7], press: 0 });
}

/**
 * Two plot holes joined by a faint dotted tether, so you can always read where a pad goes. Both flare
 * when someone goes through (state.lastFire).
 */
defineArt<'portal'>({
  type: 'portal',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const pads = portalPads(m, d.off);
    const hues = [d.style.glowHue, (d.style.glowHue + 180) % 360];
    const since = d.o.state ? rc.frame - d.o.state.lastFire : 999;
    const flare = since < 18 ? 1 - since / 18 : 0;
    const col0: HSL = { h: hues[0], s: 90, l: 62 };
    // Tether: which pad leads where.
    g.save();
    g.strokeStyle = css(col0, 10, d.o.showPath ? 0.55 : 0.12 + flare * 0.5);
    g.lineWidth = d.o.showPath ? 1.2 : 0.8;
    g.setLineDash([2, 4]);
    g.lineDashOffset = -rc.t * 12;
    g.beginPath();
    g.moveTo(pads[0][0], pads[0][1]);
    g.lineTo(pads[1][0], pads[1][1]);
    g.stroke();
    g.restore();
    pads.forEach(([x, y], i) => {
      const col: HSL = { h: hues[i], s: 92, l: 60 };
      stamp(s, hole(i, hues[i]), x, y);
      const dir = i === 0 ? 1 : -1;
      const rot = rc.t * 3.2 * dir;
      // The swirl, glowing in the void.
      g.fillStyle = css(col, 4, 0.8 + flare * 0.2);
      for (let k = 0; k < 3; k++) swirlArm(g, x, y, rot + (k * Math.PI * 2) / 3, dir, 1);
      g.fillStyle = css(col, 26, 0.75);
      for (let k = 0; k < 3; k++) swirlArm(g, x, y, rot + 0.5 + (k * Math.PI * 2) / 3, dir, 0.55);
      glowDot(g, x, y, 5 + flare * 12, col, 0.45 + flare * 0.5);
      light(rc, x, y, 34 + flare * 30, col, 0.45 + flare * 0.6);
      if (flare > 0.5 && d.o.emit) d.o.emit('spark', x, y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, col);
    });
  },
});
