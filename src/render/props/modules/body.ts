import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import type { Module, ModuleOf, PropStyle, Resolved } from '../../../sim/props';
import { beltTurn } from '../../../sim/props/modules/body';
import { blob, line, type P, stroke } from '../../ink';
import { blockLoops, stampBlock } from '../../ink-blocks';
import { boxPts, path, pen, poly, sprite, stamp } from '../../ink-props';
import { drawBelts } from '../../ink-surface';
import { light, type MetalPalette, type RC } from '../../kit';
import { bbox, defineArt, type PropDrawOpts } from '../common';
import { housed } from '../machine';

type M<T extends Module['type']> = ModuleOf<T>;

const has = (set: Set<string>, x: number, y: number) => set.has(`${x},${y}`);

/** Each jelly's last hit: the frame and how hard, so the wobble rings down over the frames after it. */
const hits = new Map<number, { f: number; a: number }>();

/**
 * How far a jelly is pressed down this frame, px: a runner coming down onto a top (or just bouncing off
 * it) squashes it in proportion to their speed, and it rings down over the next frames. Read from sim
 * state and sim frames only, and never past `EDGE_DRIFT`, so it can't lie about the top.
 */
function jellySquash(m: M<'body'>, uid: number, O: Vec, f: number, o: PropDrawOpts): number {
  let hit = 0;
  for (const p of o.runners ?? []) {
    const vy = Math.abs(p.vy ?? 0);
    if (vy < 60) continue;
    for (const [x, y] of m.cells) {
      if (m.cells.some(([cx, cy]) => cx === x && cy === y - 1)) continue;
      const top = y * TILE + O[1];
      const d = top - p.y;
      const left = x * TILE + O[0];
      if (d < -1 || d > 8 || p.x < left - 5 || p.x > left + TILE + 5) continue;
      hit = Math.max(hit, (1 - Math.max(0, d) / 8) * Math.min(1, vy / 380) * 1.25);
    }
  }
  let h = hits.get(uid);
  const ring = h ? h.a * Math.exp(-(f - h.f) / 9) : 0;
  if (hit > ring + 0.05 || (h && f < h.f)) {
    if (hits.size > 64) hits.clear();
    h = { f, a: hit };
    hits.set(uid, h);
  }
  const idle = 0.3 * Math.sin(f * 0.08 + uid);
  if (!h || f - h.f > 60) return idle;
  const k = f - h.f;
  return Math.max(-0.5, Math.min(1.25, idle + h.a * Math.exp(-k / 9) * Math.cos(k * 0.6)));
}

/** Thin strands from a goo top to the feet of a runner a few px above it. On the unlit layer: they're hairs. */
function gooStrings(bg: CanvasRenderingContext2D, m: M<'body'>, set: Set<string>, O: Vec, runners: NonNullable<PropDrawOpts['runners']>, base: HSL) {
  for (const p of runners) {
    for (const [x, y] of m.cells) {
      if (has(set, x, y - 1)) continue;
      const top = y * TILE + O[1];
      const d = top - p.y;
      const left = x * TILE + O[0];
      if (d < 0.8 || d > 9 || p.x < left || p.x > left + TILE) continue;
      const w = 0.9 * (1 - d / 10);
      for (const side of [-1, 1]) {
        const ax = p.x + side * 2.6;
        const bx = p.x + side * 1.4;
        bg.fillStyle = css(base, -30, 1, 8);
        stroke(
          bg,
          [
            { x: ax, y: top + 0.4 },
            { x: (ax + bx) / 2 + side * 0.3, y: top - d * 0.5 },
            { x: bx, y: p.y - 0.3 },
          ],
          { w: w + 0.5, seed: x + side, taper: [0.05, 0.05], press: 0 },
        );
        bg.fillStyle = css(base, 6);
        stroke(
          bg,
          [
            { x: ax, y: top + 0.4 },
            { x: (ax + bx) / 2 + side * 0.3, y: top - d * 0.5 },
            { x: bx, y: p.y - 0.3 },
          ],
          { w, seed: x + side + 3, taper: [0.1, 0.1], press: 0 },
        );
      }
      break;
    }
  }
}

/**
 * Building blocks. The block itself is inked once and stamped (`ink-blocks.ts`); what's drawn here is
 * only what moves: belt cleats and drum spokes, goo drips and strings, a jelly's squash, a biscuit giving
 * way, and the glow in a gem. Belts, drips and the squash run on sim frames, never a clock.
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
  // The sim's own belt: its speed clockwise round the block, on the face the part was turned to (sim/props/modules/body.ts).
  const speed = m.conveyor;
  const turn = m.material === 'conveyor' ? beltTurn(r.pp) : 0;
  const squash = m.material === 'jelly' ? jellySquash(m, r.pp.uid, O, f, o) : 0;
  const bake = stampBlock(s, m.cells, O, m.material, st, pal, squash, speed < 0 ? -1 : 1, turn);
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
      }
      const c = bbox(m.cells, O);
      light(rc, c.x + c.w / 2, c.y + c.h / 2, 26, glowC, 0.3 * pulse);
      break;
    }
    case 'conveyor':
      if (bake.belts) drawBelts(s, bake.belts, bake.loops, O[0], O[1], f, speed, pal, st.hue, turn);
      break;
    case 'goo': {
      // Drips that gather, stretch and let go under every bottom edge: thin, so they're decoration.
      const base: HSL = { h: st.hue, s: 62, l: 42 };
      for (const [x, y] of m.cells) {
        if (has(set, x, y + 1)) continue;
        const dp = (f / 150 + hash2(x, y, 3)) % 1;
        const dx = (x + 0.25 + hash2(x, y, 9) * 0.3) * TILE + O[0];
        const dy = (y + 1) * TILE + O[1] - 0.6;
        // Swells for most of its life, then a bead lets go and falls.
        const len = 1.5 + Math.min(dp, 0.8) * 6;
        const pts: P[] = [
          { x: dx, y: dy },
          { x: dx, y: dy + len * 0.6 },
          { x: dx, y: dy + len },
        ];
        s.fillStyle = css(base, -34, 1, 8);
        stroke(s, pts, { w: 2.6, seed: x, taper: [0, 0.2], press: 0 });
        s.fillStyle = css(base, 12, 1, -6);
        stroke(s, pts, { w: 1.5, seed: x, taper: [0, 0.25], press: 0 });
        if (dp > 0.8) {
          const by = dy + len + 1 + (dp - 0.8) * (dp - 0.8) * 900;
          s.fillStyle = css(base, -34, 1, 8);
          blob(s, dx, by, 1.05, x, 1.2, 0.1);
          s.fill();
          s.fillStyle = css(base, 12, 1, -6);
          blob(s, dx - 0.2, by - 0.2, 0.55, x, 1.2, 0.1);
          s.fill();
        }
      }
      // Strings of it stretch up to the feet of anyone just stepping off: that's what sticky looks like.
      if (o.runners) gooStrings(rc.bg, m, set, O, o.runners, base);
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
