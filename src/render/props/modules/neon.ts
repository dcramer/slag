import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type ModuleOf, NEON_ON, NEON_WARN, neonCycle } from '../../../sim/props';
import { blob, inkFor, line, type P, stroke } from '../../ink';
import { boxPts, part, sprite, stamp } from '../../ink-props';
import { glowDot, light, type RC, zap } from '../../kit';
import { type DrawCtx, defineArt } from '../common';

/**
 * Neon letters (sim/props/modules/neon.ts): each cell is a sheet-metal letter box, the body you stand on,
 * with a glass tube bent into a letter across its face. Dark, the tube is dull glass. In the warning it
 * flickers, and lit it burns its colour with a crackle running over the box's top: that's when it's live.
 * The light chases along the word one letter after another. The word is a city sign's, picked by the seed.
 */

type Neon = ModuleOf<'neon'>;

/** A stroke font on a unit box (x right, y down): just the letters the city's words use. Signs letter with it too. */
export const FONT: Record<string, number[][]> = {
  A: [
    [0, 1, 0.5, 0, 1, 1],
    [0.22, 0.6, 0.78, 0.6],
  ],
  B: [
    [0, 1, 0, 0, 0.7, 0, 0.9, 0.22, 0.7, 0.48, 0, 0.48],
    [0.7, 0.48, 1, 0.74, 0.75, 1, 0, 1],
  ],
  C: [[1, 0.1, 0.6, 0, 0.1, 0.2, 0, 0.5, 0.1, 0.8, 0.6, 1, 1, 0.9]],
  D: [[0, 0, 0, 1, 0.6, 1, 1, 0.65, 1, 0.35, 0.6, 0, 0, 0]],
  E: [
    [1, 0, 0, 0, 0, 1, 1, 1],
    [0, 0.5, 0.75, 0.5],
  ],
  F: [
    [1, 0, 0, 0, 0, 1],
    [0, 0.5, 0.75, 0.5],
  ],
  G: [[1, 0.1, 0.6, 0, 0.1, 0.2, 0, 0.5, 0.1, 0.8, 0.6, 1, 1, 0.85, 1, 0.55, 0.55, 0.55]],
  H: [
    [0, 0, 0, 1],
    [1, 0, 1, 1],
    [0, 0.5, 1, 0.5],
  ],
  I: [
    [0.5, 0, 0.5, 1],
    [0.15, 0, 0.85, 0],
    [0.15, 1, 0.85, 1],
  ],
  J: [[0.2, 0, 1, 0, 0.8, 0, 0.8, 0.8, 0.5, 1, 0.1, 0.85]],
  K: [
    [0, 0, 0, 1],
    [1, 0, 0, 0.55, 1, 1],
  ],
  L: [[0, 0, 0, 1, 1, 1]],
  Q: [
    [0.5, 0, 0.1, 0.18, 0, 0.5, 0.1, 0.82, 0.5, 1, 0.9, 0.82, 1, 0.5, 0.9, 0.18, 0.5, 0],
    [0.6, 0.7, 1.05, 1.05],
  ],
  '!': [
    [0.5, 0, 0.5, 0.7],
    [0.5, 0.92, 0.5, 1],
  ],
  M: [[0, 1, 0, 0, 0.5, 0.55, 1, 0, 1, 1]],
  N: [[0, 1, 0, 0, 1, 1, 1, 0]],
  O: [[0.5, 0, 0.1, 0.18, 0, 0.5, 0.1, 0.82, 0.5, 1, 0.9, 0.82, 1, 0.5, 0.9, 0.18, 0.5, 0]],
  P: [[0, 1, 0, 0, 0.75, 0, 1, 0.24, 0.75, 0.5, 0, 0.5]],
  R: [
    [0, 1, 0, 0, 0.75, 0, 1, 0.24, 0.75, 0.5, 0, 0.5],
    [0.45, 0.5, 1, 1],
  ],
  S: [[1, 0.12, 0.6, 0, 0.1, 0.12, 0.1, 0.4, 0.9, 0.6, 0.9, 0.88, 0.4, 1, 0, 0.88]],
  T: [
    [0, 0, 1, 0],
    [0.5, 0, 0.5, 1],
  ],
  U: [[0, 0, 0, 0.75, 0.3, 1, 0.7, 1, 1, 0.75, 1, 0]],
  V: [[0, 0, 0.5, 1, 1, 0]],
  W: [[0, 0, 0.22, 1, 0.5, 0.42, 0.78, 1, 1, 0]],
  X: [
    [0, 0, 1, 1],
    [1, 0, 0, 1],
  ],
  Y: [
    [0, 0, 0.5, 0.5, 1, 0],
    [0.5, 0.5, 0.5, 1],
  ],
  Z: [[0, 0, 1, 0, 0, 1, 1, 1]],
};

/** City signs by length: a word for any run of letters, the leftovers a star. */
const WORDS: Record<number, readonly string[]> = {
  3: ['BAR', 'EAT', 'INN', 'GAS', 'HOT', 'ART'],
  4: ['OPEN', 'CAFE', 'LIVE', 'JAZZ', 'TAXI', 'NEON', 'DELI', 'BARS'],
  5: ['HOTEL', 'DINER', 'PIZZA', 'MOTEL', 'SLOTS', 'OPEN!'],
  6: ['DONUTS', 'CASINO', 'BURGER', 'ARCADE', 'TICKET'],
  7: ['LIQUORS', 'THEATER', 'NOODLES', 'DANCING'],
};

/** A letter's strokes in the box at (x, y), `w` wide and `h` tall: polylines for the pen to follow. */
export function letterPts(ch: string, x: number, y: number, w: number, h: number): P[][] {
  return (FONT[ch] ?? FONT.O).map((s) => {
    const pts: P[] = [];
    for (let i = 0; i + 1 < s.length; i += 2) pts.push({ x: x + s[i] * w, y: y + s[i + 1] * h });
    return pts;
  });
}

/** The word a sign of `n` letters says, from its seed; a word too short is padded with stars. */
export function neonWord(n: number, seed: number): string {
  const list = WORDS[Math.min(7, Math.max(3, n))];
  const w = list[seed % list.length];
  return w.length >= n ? w.slice(0, n) : w.padEnd(n, '*');
}

const BOX: HSL = { h: 230, s: 10, l: 20 };
const glowOf = (d: DrawCtx): HSL => ({ h: d.style.glowHue, s: 100, l: 64 });

/** The letter box: dark sheet metal on the cell, rivets at its corners. Baked. */
function box(seed: number) {
  return sprite(`neon|box|${seed & 7}`, 0, 0, TILE, TILE, (g) => {
    const pts = boxPts(0.4, 0.6, TILE - 0.8, TILE - 0.6, 1.1, seed, 0.1);
    part(g, pts, BOX, seed, { depth: 0.6, thin: 0.4, thick: 0.9 });
    g.fillStyle = css(BOX, 22);
    for (const [x, y] of [
      [2.4, 2.6],
      [TILE - 2.4, 2.6],
      [2.4, TILE - 2.2],
      [TILE - 2.4, TILE - 2.2],
    ]) {
      blob(g, x, y, 0.45, x + y, 1, 0.1);
      g.fill();
    }
  });
}

/** A letter's strokes in the cell at (x, y): a 9×10 box in its middle. */
function strokes(ch: string, x: number, y: number): P[][] {
  if (ch === '*') {
    const out: P[][] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      out.push([
        { x: x + 8 - Math.cos(a) * 4, y: y + 8 - Math.sin(a) * 4 },
        { x: x + 8 + Math.cos(a) * 4, y: y + 8 + Math.sin(a) * 4 },
      ]);
    }
    return out;
  }
  return letterPts(ch, x + 3.5, y + 3, 9, 10);
}

function draw(rc: RC, m: Neon, d: DrawCtx) {
  const s = rc.s;
  const col = glowOf(d);
  const word = neonWord(m.cells.length, m.seed);
  const order = m.cells.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  order.forEach((c, i) => {
    const x = c[0] * TILE + d.off[0];
    const y = c[1] * TILE + d.off[1];
    stamp(s, box(m.seed + i), x, y);
    const cy = neonCycle(m, c, rc.frame, d.r.phase);
    // Lit: on, or flickering more and more on through the warning.
    const lit = cy.seg === NEON_ON || (cy.seg === NEON_WARN && hash2(Math.floor(rc.frame / 3), i, m.seed) < 0.15 + 0.7 * (cy.t / Math.max(1, cy.len)));
    const tube = strokes(word[i], x, y);
    for (const [k, pts] of tube.entries()) {
      if (pts.length < 2) continue;
      s.fillStyle = inkFor(col);
      stroke(s, pts, { w: 1.9, seed: i * 7 + k, taper: [0.02, 0.02], press: 0.05 });
      s.fillStyle = lit ? css(col, 6) : css(col, -38, 1, -40);
      stroke(s, pts, { w: 1.3, seed: i * 7 + k + 1, taper: [0.02, 0.02], press: 0.05 });
      if (lit) {
        s.fillStyle = 'rgba(255,250,245,0.9)';
        stroke(s, pts, { w: 0.45, seed: i * 7 + k + 2, taper: [0.1, 0.1], press: 0 });
      }
    }
    if (!lit) return;
    glowDot(rc.g, x + TILE / 2, y + TILE / 2, 13, col, cy.seg === NEON_ON ? 0.55 : 0.3);
    if (cy.seg !== NEON_ON) return;
    light(rc, x + TILE / 2, y + TILE / 2, 40, col, 0.6);
    // Live: a crackle running over the top of the box.
    if (Math.random() < 0.45) {
      const a = x + 2 + Math.random() * (TILE - 4);
      zap(rc.g, a, y - 0.5, a + (Math.random() - 0.5) * 8, y - 1.5 - Math.random() * 2, 1.6, 3, col, 0.6);
    }
  });
  // A thin feed cable along the backs of the boxes, to the first one.
  if (order.length > 1) {
    const a = order[0];
    const b = order[order.length - 1];
    s.fillStyle = inkFor(BOX);
    line(s, a[0] * TILE + d.off[0] + 2, a[1] * TILE + d.off[1] + TILE - 0.6, b[0] * TILE + d.off[0] + TILE - 2, b[1] * TILE + d.off[1] + TILE - 0.6, {
      w: 0.6,
      seed: m.seed,
      taper: [0, 0],
      press: 0,
    });
  }
}

defineArt<'neon'>({ type: 'neon', layer: 2, draw });
