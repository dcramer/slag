import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import type { Module, ModuleOf, PropStyle, Resolved } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { blockLoops, stampBlock } from '../../ink-blocks';
import { boxPts, path, pen, poly, sprite, stamp } from '../../ink-props';
import { glowDot, light, type MetalPalette, type RC } from '../../kit';
import { bbox, defineArt, type PropDrawOpts } from '../common';
import { housed } from '../machine';

type M<T extends Module['type']> = ModuleOf<T>;

const has = (set: Set<string>, x: number, y: number) => set.has(`${x},${y}`);

/**
 * Building blocks. The block itself is inked once and stamped (`ink-blocks.ts`); what's drawn here is
 * only what moves: belt treads and rollers, goo drips, a jelly's jiggle, a biscuit giving way, and the
 * glow in a gem.
 */
function drawBody(rc: RC, m: M<'body'>, st: PropStyle, pal: MetalPalette, off: Vec, r: Resolved, o: PropDrawOpts) {
  // A launcher, jet or emitter draws its whole cell as the machine (props/machine.ts).
  if (housed(r)) return;
  const s = rc.s;
  const g = rc.g;
  const t = rc.t;
  const f = rc.frame;
  if (m.material === 'crumble' && o.broken) {
    // Where it will come back: its own outline, as a dotted pencil line.
    s.fillStyle = 'rgba(255,240,215,0.32)';
    for (const loop of blockLoops(m.cells, m.material, st, pal)) {
      for (let i = 0; i < loop.length; i += 2) {
        const a = loop[i];
        const b = loop[(i + 1) % loop.length];
        line(s, a.x + off[0], a.y + off[1], b.x + off[0], b.y + off[1], { w: 0.9, seed: i, taper: [0.2, 0.2], press: 0 });
      }
    }
    return;
  }
  let shake = 0;
  let trig = 0;
  if (m.material === 'crumble') {
    trig = o.state && o.state.triggerFrame >= 0 ? (f - o.state.triggerFrame) / Math.max(1, m.breakFrames) : 0;
    shake = trig ? Math.sin(f * 2.7) * trig * 1.6 : 0;
    if (trig && o.emit && Math.random() < 0.3) {
      const c = m.cells[Math.floor(Math.random() * m.cells.length)];
      o.emit('debris', (c[0] + Math.random()) * TILE + off[0], (c[1] + 1) * TILE + off[1], (Math.random() - 0.5) * 20, 10, { h: 32, s: 45, l: 50 });
    }
  }
  const O: Vec = [off[0] + shake, off[1]];
  const jiggle = m.material === 'jelly' ? Math.sin(t * 6 + r.pp.uid) * 0.03 : 0;
  stampBlock(s, m.cells, O, m.material, st, pal, jiggle);
  const set = new Set(m.cells.map(([x, y]) => `${x},${y}`));

  switch (m.material) {
    case 'metal': {
      if (st.trim !== 'gems' && st.trim !== 'runes') break;
      const glowC: HSL = { h: st.glowHue, s: 95, l: 60 };
      const pulse = 0.7 + 0.3 * Math.sin(t * 3 + r.pp.uid);
      for (const [x, y] of m.cells) {
        const cx = (x + 0.5) * TILE + O[0];
        const cy = (y + 0.5) * TILE + O[1];
        if (st.trim === 'gems') {
          g.fillStyle = css(glowC, 10, 0.85 * pulse);
          g.beginPath();
          g.moveTo(cx, cy - 3);
          g.lineTo(cx + 2.5, cy);
          g.lineTo(cx, cy + 3);
          g.lineTo(cx - 2.5, cy);
          g.fill();
        } else {
          g.fillStyle = css(glowC, 10, 0.8 * pulse);
          const k = hash2(x, y, r.pp.uid);
          stroke(
            g,
            [
              { x: cx - 2.4, y: cy - 2.6 },
              { x: cx + (k > 0.5 ? 2 : 0), y: cy },
              { x: cx - 2.4, y: cy + 2.6 },
            ],
            { w: 1, seed: x + y, taper: [0.1, 0.1], press: 0 },
          );
        }
        glowDot(g, cx, cy, 7, glowC, 0.22 * pulse);
      }
      const c = bbox(m.cells, O);
      light(rc, c.x + c.w / 2, c.y + c.h / 2, 45, glowC, 0.4 * pulse);
      break;
    }
    case 'conveyor': {
      const dir = Math.sign(r.pp.rot >= 2 ? -m.conveyor : m.conveyor) || 1;
      const run = (f * Math.abs(m.conveyor)) / 60;
      const a = (f * m.conveyor) / 180;
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        if (!has(set, x, y - 1)) {
          // Treads on the belt, sliding the way it carries you.
          s.fillStyle = 'rgb(92 92 104)';
          for (let i = -1; i < 4; i++) {
            const bx = px + ((((i * 5 + dir * run) % 20) + 20) % 20) - 2;
            if (bx < px - 0.5 || bx > px + TILE - 1) continue;
            s.fillRect(bx, py + 0.8, 1.3, 3);
          }
          // Lit arrows on the skirt, so the way it runs reads from anywhere.
          g.fillStyle = 'rgba(255,190,60,0.9)';
          const ax = px + 8 + ((((dir * run * 0.5) % 8) + 8) % 8) - 4;
          line(g, ax - dir * 1.8, py + 5.9, ax + dir * 0.8, py + 7.4, { w: 1.1, seed: x, taper: [0, 0], press: 0 });
          line(g, ax + dir * 0.8, py + 7.4, ax - dir * 1.8, py + 8.9, { w: 1.1, seed: x + 1, taper: [0, 0], press: 0 });
        }
        // The roller turning in its socket.
        s.fillStyle = '#16151a';
        const rx = px + TILE / 2;
        const ry = py + TILE - 5.2;
        line(s, rx + Math.cos(a) * 2.4, ry + Math.sin(a) * 2.4, rx - Math.cos(a) * 2.4, ry - Math.sin(a) * 2.4, { w: 0.9, seed: x, taper: [0, 0], press: 0 });
        line(s, rx - Math.sin(a) * 2.4, ry + Math.cos(a) * 2.4, rx + Math.sin(a) * 2.4, ry - Math.cos(a) * 2.4, {
          w: 0.9,
          seed: x + 3,
          taper: [0, 0],
          press: 0,
        });
      }
      break;
    }
    case 'goo': {
      // Drips that gather, stretch and let go under every bottom edge: thin, so they're decoration.
      const base: HSL = { h: st.hue, s: 62, l: 42 };
      for (const [x, y] of m.cells) {
        if (has(set, x, y + 1)) continue;
        const dp = (t * 0.5 + hash2(x, y, 3)) % 1;
        const dx = (x + 0.25 + hash2(x, y, 9) * 0.5) * TILE + O[0];
        const dy = (y + 1) * TILE + O[1] - 0.6;
        const len = 1.5 + dp * 4.5;
        const pts: P[] = [
          { x: dx, y: dy },
          { x: dx, y: dy + len * 0.6 },
          { x: dx, y: dy + len },
        ];
        s.fillStyle = css(base, -34, 1, 8);
        stroke(s, pts, { w: 2.6, seed: x, taper: [0, 0.2], press: 0 });
        s.fillStyle = css(base, -6);
        stroke(s, pts, { w: 1.5, seed: x, taper: [0, 0.25], press: 0 });
      }
      break;
    }
    case 'crumble': {
      if (!trig) break;
      // Cracks run in from the edges as it gives.
      s.fillStyle = css({ h: 30, s: 50, l: 14 });
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        const pts: P[] = [{ x: px + 2 + hash2(x, y, 1) * 12, y: py }];
        const steps = Math.ceil(Math.min(1, trig * 1.4) * 5);
        for (let i = 1; i <= steps; i++) pts.push({ x: pts[i - 1].x + (hash2(x, y + i, 2) - 0.5) * 6, y: py + i * 3.2 });
        stroke(s, pts, { w: 1.1, seed: x * 7 + y, taper: [0.05, 0.6], press: 0.2 });
      }
      break;
    }
    default:
      break;
  }
}

/** One Four-Square cell: a square with a light bevel up-left, a dark one down-right and a hard shine, all in one colour. */
function tetraCell(hue: number, v: number) {
  return sprite(`tetra|${hue | 0}|${v}`, -1, -1, TILE + 2, TILE + 2, (g) => {
    const c: HSL = { h: hue, s: 78, l: 52 };
    const B = 3;
    const quad = (pts: number[], col: string) => {
      g.fillStyle = col;
      path(g, poly(...pts));
      g.fill();
    };
    quad([0, 0, TILE, 0, TILE - B, B, B, B], css(c, 22));
    quad([0, 0, B, B, B, TILE - B, 0, TILE], css(c, 12));
    quad([TILE, 0, TILE, TILE, TILE - B, TILE - B, TILE - B, B], css(c, -16));
    quad([0, TILE, B, TILE - B, TILE - B, TILE - B, TILE, TILE], css(c, -24));
    g.fillStyle = css(c);
    g.fillRect(B, B, TILE - B * 2, TILE - B * 2);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.fillRect(B + 1, B + 1, 2.2, 1.2);
    pen(g, boxPts(0.2, 0.2, TILE - 0.4, TILE - 0.4, 0.5, v + 3, 0.04), v + 3, 0.6, 1.2, 4);
  });
}

/** Four-Square: the falling-block puzzle's pieces, as separate bevelled squares, never one merged slab. */
function drawTetra(rc: RC, m: M<'body'>, off: Vec) {
  for (const [x, y] of m.cells) stamp(rc.s, tetraCell(m.hue ?? 200, (x * 3 + y) % 3), x * TILE + off[0], y * TILE + off[1]);
}

defineArt<'body'>({
  type: 'body',
  layer: 1,
  draw: (rc, m, d) => (m.look === 'tetra' && !housed(d.r) ? drawTetra(rc, m, d.off) : drawBody(rc, m, d.style, d.pal, d.off, d.r, d.o)),
});
