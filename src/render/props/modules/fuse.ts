import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { FUSE_BLAST, fuseState, type ModuleOf } from '../../../sim/props';
import { line } from '../../ink';
import { boxPts, part, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light } from '../../kit';
import { defineArt } from '../common';

type Fuse = ModuleOf<'fuse'>;

const STENCIL = 'rgba(178,32,28,0.92)';
const SPARK: HSL = { h: 40, s: 100, l: 62 };
const HOT: HSL = { h: 12, s: 100, l: 58 };

/**
 * The crate, still: planks between a heavy frame, a lit fuse stencilled on the side, and FRAGILE
 * crossed out with VERY written over it. Drawn in a cell's own px.
 */
function crate(wood: number, v: number) {
  return sprite(`fuse|${wood | 0}|${v}`, -1, -1, TILE + 2, TILE + 2, (g) => {
    const W: HSL = { h: wood, s: 48, l: 46 };
    const body = boxPts(0.3, 0.3, TILE - 0.6, TILE - 0.6, 0.9, v, 0.1);
    tone(g, body, W, { depth: 0.8, shade: -18 });
    g.save();
    g.beginPath();
    for (let i = 0; i < body.length; i++) (i ? g.lineTo : g.moveTo).call(g, body[i].x, body[i].y);
    g.closePath();
    g.clip();
    // Plank seams, and the frame's diagonal brace drawn darker.
    for (const y of [5.4, 10.7]) tick(g, 1.5, y, TILE - 1.5, y + 0.2, 0.45, y, css(W, -24));
    g.fillStyle = css(W, -14);
    line(g, 2.4, TILE - 2.6, TILE - 2.4, 2.6, { w: 1.9, seed: v + 2, taper: [0.05, 0.05], press: 0.2 });
    // The stencil: a round charge with a lit wick, in red paint.
    g.fillStyle = STENCIL;
    g.beginPath();
    g.arc(TILE / 2 - 0.6, TILE / 2 + 1.2, 2.9, 0, Math.PI * 2);
    g.fill();
    line(g, TILE / 2 + 1.4, TILE / 2 - 1, TILE / 2 + 3.6, TILE / 2 - 3.6, { w: 0.8, seed: v + 3, taper: [0.1, 0.3], press: 0.2 });
    for (const [dx, dy] of [
      [0, -1.6],
      [1.4, -0.4],
      [-1.2, -0.7],
    ])
      tick(g, TILE / 2 + 3.9, TILE / 2 - 3.9, TILE / 2 + 3.9 + dx, TILE / 2 - 3.9 + dy, 0.45, dx * 9, STENCIL);
    // FRAGILE, crossed out, VERY written over it in another hand.
    g.font = 'bold 2.6px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(30,20,14,0.72)';
    g.fillText('FRAGILE', TILE / 2, 2.6);
    tick(g, 2.6, 2.7, TILE - 2.6, 2.4, 0.4, 5, 'rgba(30,20,14,0.85)');
    g.fillStyle = STENCIL;
    g.font = 'italic bold 2.4px sans-serif';
    g.fillText('VERY', TILE / 2 - 1.6, 4.5);
    g.restore();
    // Frame boards round the edge.
    const frame = poly(0.3, 0.3, TILE - 0.3, 0.3, TILE - 0.3, TILE - 0.3, 0.3, TILE - 0.3);
    pen(g, frame, v + 4, 0.7, 1.4, 4);
    part(g, boxPts(0.4, 0.4, TILE - 0.8, 1.6, 0.4, v + 5, 0.05), { h: wood, s: 40, l: 36 }, v + 5, { depth: 0.2, shade: -8, thin: 0.25, thick: 0.6 });
    part(g, boxPts(0.4, TILE - 2, TILE - 0.8, 1.6, 0.4, v + 6, 0.05), { h: wood, s: 40, l: 36 }, v + 6, { depth: 0.2, shade: -8, thin: 0.25, thick: 0.6 });
  });
}

/** The count, painted big and fresh on the side as it goes: 3, 2, 1. */
function count(s: CanvasRenderingContext2D, x: number, y: number, n: number, k: number) {
  s.save();
  s.translate(x, y);
  s.scale(1 + k * 0.25, 1 + k * 0.25);
  s.font = 'bold 11px monospace';
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.fillStyle = '#1a0f0a';
  s.fillText(String(n), 0.6, 1);
  s.fillStyle = css(SPARK, 22);
  s.fillText(String(n), 0, 0.4);
  s.restore();
}

/**
 * Fuse Crate (docs/PARODY.md, fuse): a slatted crate with a lit-fuse stencil. Lit, it shakes harder as
 * it goes and a big 3, 2, 1 is painted over the stencil with a spark fizzing on top; then the blast
 * (the run's explosion event) and a scorch where it stood, its outline pencilled in until it's back.
 */
defineArt<'fuse'>({
  type: 'fuse',
  layer: 1,
  draw(rc, m: Fuse, d) {
    const s = rc.s;
    const st = d.o.level ? fuseState(m, d.o.state, d.mi, rc.frame) : ({ mode: 'idle' } as const);
    const [ox, oy] = d.off;
    if (st.mode === 'gone') {
      for (const [cx, cy] of m.cells) {
        const x = cx * TILE + ox;
        const y = cy * TILE + oy;
        // Scorch on what it stood on, and its outline in pencil where it will be back.
        rc.bg.fillStyle = 'rgba(20,14,10,0.5)';
        rc.bg.beginPath();
        rc.bg.ellipse(x + TILE / 2, y + TILE, 9, 2, 0, 0, Math.PI * 2);
        rc.bg.fill();
        rc.bg.fillStyle = 'rgba(255,240,215,0.35)';
        for (let k = 0; k < 4; k++) line(rc.bg, x + 2 + k * 3.5, y + 1.5, x + 3.8 + k * 3.5, y + 1.5, { w: 0.8, seed: k, taper: [0.2, 0.2], press: 0 });
        for (let k = 0; k < 4; k++)
          line(rc.bg, x + 2 + k * 3.5, y + TILE - 1.5, x + 3.8 + k * 3.5, y + TILE - 1.5, { w: 0.8, seed: k + 4, taper: [0.2, 0.2], press: 0 });
      }
      if (st.since < FUSE_BLAST * 2) {
        const [cx, cy] = m.cells[0];
        glowDot(rc.g, (cx + 0.5) * TILE + ox, (cy + 0.5) * TILE + oy, m.radius * TILE, HOT, 1 - st.since / (FUSE_BLAST * 2));
      }
      return;
    }
    const lit = st.mode === 'lit';
    const through = lit ? 1 - st.left / m.count : 0;
    const shake = lit ? 0.3 + through * 1.2 : 0;
    const jx = lit ? (rc.frame & 1 ? shake : -shake) : 0;
    const jy = lit ? (rc.frame & 2 ? shake * 0.6 : -shake * 0.6) : 0;
    for (const [cx, cy] of m.cells) {
      const x = cx * TILE + ox + jx;
      const y = cy * TILE + oy + jy;
      stamp(s, crate(d.style.woodHue, (cx * 3 + cy) % 3), x, y);
      if (!lit) continue;
      const n = Math.max(1, Math.ceil(st.left / 60));
      const k = 1 - ((st.left - 1) % 60) / 60;
      count(s, x + TILE / 2, y + TILE / 2 + 0.5, n, k < 0.2 ? 1 - k * 5 : 0);
      // The spark on top, fizzing.
      const fx = x + TILE / 2 + 3.5;
      const fy = y - 1;
      glowDot(rc.g, fx, fy, 4 + Math.sin(rc.t * 40) * 1.2 + through * 3, SPARK, 0.9);
      light(rc, fx, fy, 22 + through * 18, SPARK, 0.5 + through * 0.4);
      if (rc.frame % 3 === 0) d.o.emit?.('spark', fx, fy, (Math.random() - 0.5) * 50, -30 - Math.random() * 40, SPARK);
    }
  },
});
