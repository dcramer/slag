import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { COAT_PX, dirOf, type ModuleOf } from '../../../sim/props';
import { blob, line, type P, sn, stroke } from '../../ink';
import { boxPts, glint, pen, sprite, stamp, tick, tone } from '../../ink-props';
import type { RC } from '../../kit';
import { defineArt } from '../common';
import { drawSpikeCells } from '../spike-looks';

type Coat = ModuleOf<'coat'>;

/**
 * Coats on a face, inked (docs/PARODY.md, icecoat and slimecoat). Each straight run of coated faces is one
 * hand-cut shape, baked once and stamped: ice is a glassy sheet with a Zamboni's tread lines on its shine,
 * turning round at one end, and icicles under a ceiling; slime is a lumpy green coat that drips, and one
 * bubble on it swells and pops. Both are drawn in a run's own frame: x along the face, y out of it
 * negative, so the same drawing serves floors, walls and ceilings.
 */

/** Drawn thickness: the sim's coat and half a px of lip. */
const T = COAT_PX + 0.5;
const ICE: HSL = { h: 196, s: 70, l: 82 };
const ICE_INK = '#1d4a63';
const SLIME: HSL = { h: 102, s: 72, l: 44 };
const SLIME_INK = '#183509';
/** A spike strip's rail: gunmetal, since it has no host block of its own to take a metal from. */
const STRIP_RAIL: HSL = { h: 222, s: 12, l: 20 };
/** How much thicker a crate card draws a coat. */
const CARD_THICK = 1.7;

/** A straight run of coated faces: where it starts on the host's face, which way it runs and which way is out. */
interface Run {
  ox: number;
  oy: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  /** Length in px. */
  len: number;
  /** World-keyed seed: the first cell's. */
  seed: number;
}

/** Group a coat's cells into straight runs along its face. */
function runsOf(m: Coat): Run[] {
  const [nx, ny] = dirOf(m.angle);
  const along = nx === 0;
  const cells = [...m.cells].sort((a, b) => (along ? a[1] - b[1] || a[0] - b[0] : a[0] - b[0] || a[1] - b[1]));
  const out: Run[] = [];
  let cur: Run | null = null;
  let last: readonly [number, number] | null = null;
  for (const c of cells) {
    const next = last && (along ? c[1] === last[1] && c[0] === last[0] + 1 : c[0] === last[0] && c[1] === last[1] + 1);
    if (cur && next) cur.len += TILE;
    else {
      cur = {
        ox: (c[0] + (nx > 0 ? 1 : 0)) * TILE,
        oy: (c[1] + (ny > 0 ? 1 : 0)) * TILE,
        ux: along ? 1 : 0,
        uy: along ? 0 : 1,
        nx,
        ny,
        len: TILE,
        seed: Math.floor(hash2(c[0], c[1], 0xc0a7) * 9973),
      };
      out.push(cur);
    }
    last = c;
  }
  return out;
}

/** Into a run's frame: x along it, y out of the face negative. A card draws the coat thicker, or it's a line on its blocks. */
function enter(s: CanvasRenderingContext2D, r: Run, card: boolean) {
  s.save();
  s.transform(r.ux, r.uy, -r.nx, -r.ny, r.ox, r.oy);
  if (card) s.scale(1, CARD_THICK);
}

/** Spikes protruding from each host face: a gunmetal rail, or what the look says they're made of. */
function drawSpikeStrip(rc: RC, m: Coat) {
  drawSpikeCells(rc.s, m.cells, m.angle, m.look, STRIP_RAIL);
}

/** One run of ice: the sheet, its shine, the resurfacer's two tread lines and the turn it made at the end. */
function iceRun(len: number, seed: number, drips: boolean) {
  return sprite(`ct|ice|${len}|${seed % 7}|${drips}`, -1.5, -T - 1.5, len + 3, T + (drips ? 9 : 3.5), (g) => {
    // In this frame +y is into the face, so a ceiling's icicles hang along -y... they're drawn from the
    // outer edge only when the face looks down, which the caller says with `drips`.
    const body = boxPts(0, -T, len, T + 0.5, 1.2, seed, 0.12);
    tone(g, body, ICE, { depth: 0.6, shade: -14 });
    g.save();
    g.beginPath();
    for (let i = 0; i < body.length; i++) (i ? g.lineTo : g.moveTo).call(g, body[i].x, body[i].y);
    g.closePath();
    g.clip();
    // The shine along the outer edge, lifted at each tile so it's drawn and not ruled.
    g.fillStyle = css(ICE, 14);
    for (let x = 0; x < len; x += TILE) {
      const a = x + 1.2 + hash2(x, 1, seed) * 2;
      const b = Math.min(len - 1, x + TILE - 1 - hash2(x, 2, seed) * 2.5);
      line(g, a, -T + 0.7, b, -T + 0.7, { w: 0.9, seed: seed + x, taper: [0.2, 0.3], press: 0.3 });
    }
    // Zamboni treads: two lines down the sheet, and the U-turn where it came about.
    const y0 = -T + 1.55;
    const y1 = -T + 2.75;
    const turn = len - 3;
    g.fillStyle = css(ICE, -22, 0.9);
    const lane: P[] = [];
    for (let x = 2; x <= turn; x += 2) lane.push({ x, y: y0 });
    for (let k = 0; k <= 6; k++) {
      const a = -Math.PI / 2 + (k / 6) * Math.PI;
      lane.push({ x: turn + Math.cos(a) * 0.6, y: (y0 + y1) / 2 + Math.sin(a) * 0.6 });
    }
    for (let x = turn; x >= 3.5; x -= 2) lane.push({ x, y: y1 });
    stroke(g, lane, { w: 0.42, seed: seed + 3, taper: [0.25, 0.25], press: 0.2 });
    g.restore();
    pen(g, body, seed, 0.3, 0.75, 3, ICE_INK);
    if (drips)
      for (let x = 3; x < len - 2; x += 6) {
        const ix = x + hash2(x, 5, seed) * 3;
        const h = 2.4 + hash2(x, 6, seed) * 3.2;
        const icicle = [
          { x: ix - 1.3, y: 0.2 },
          { x: ix + 1.3, y: 0.2 },
          { x: ix + 0.1, y: h },
        ];
        tone(g, icicle, ICE, { depth: 0.3, shade: -12 });
        pen(g, icicle, seed + x, 0.2, 0.45, 2, ICE_INK);
      }
  });
}

function drawIce(rc: RC, m: Coat, card: boolean) {
  const s = rc.s;
  for (const r of runsOf(m)) {
    enter(s, r, card);
    // A ceiling's icicles hang into the frame's +y... which is the host. Hang them off the outer edge instead.
    const drips = r.ny > 0;
    if (drips) {
      s.translate(0, -T);
      s.scale(1, -1);
      s.translate(0, -T);
    }
    stamp(s, iceRun(r.len, r.seed, drips));
    // A hard glint that slides along the sheet now and then, so ice reads on a dark level.
    const sweep = (rc.t * 0.35 + r.seed * 0.013) % 1;
    if (sweep < 0.4) {
      const x = 2 + (sweep / 0.4) * (r.len - 4);
      const k = Math.sin((sweep / 0.4) * Math.PI) * 1.8;
      s.fillStyle = 'rgba(255,255,255,0.95)';
      line(s, x - k, -T + 1, x + k, -T + 1, { w: 0.6, seed: 1, taper: [0.3, 0.3], press: 0 });
      line(s, x, -T + 1 - k, x, -T + 1 + k, { w: 0.6, seed: 2, taper: [0.3, 0.3], press: 0 });
    }
    s.restore();
  }
}

/** One run of slime: a lumpy coat, two tones, a wet highlight and a few trapped bubbles. */
function slimeRun(len: number, seed: number) {
  return sprite(`ct|slime|${len}|${seed % 7}`, -2, -T - 3, len + 4, T + 4, (g) => {
    const body: P[] = [
      { x: len + 0.4, y: 0.4 },
      { x: -0.4, y: 0.4 },
    ];
    // Up the near end, along the lumpy top, down the far end.
    for (let k = 0; k <= 3; k++) body.push({ x: -0.4 - Math.sin((k / 3) * Math.PI * 0.5) * 0.6, y: 0.4 - (k / 3) * (T + 0.4) });
    for (let x = 1; x < len; x += 1.5) body.push({ x, y: -T - 0.3 - Math.max(0, sn(x * 0.32, 1.7, seed)) * 1.2 });
    for (let k = 3; k >= 0; k--) body.push({ x: len + 0.4 + Math.sin((k / 3) * Math.PI * 0.5) * 0.6, y: 0.4 - (k / 3) * (T + 0.4) });
    tone(g, body, SLIME, { depth: 0.9, shade: -18 });
    for (let x = 3; x < len - 2; x += 5) {
      if (hash2(x, 6, seed) < 0.55) continue;
      const bx = x + hash2(x, 7, seed) * 3;
      g.fillStyle = css(SLIME, 22, 0.9);
      blob(g, bx, -T * (0.3 + hash2(x, 8, seed) * 0.35), 0.35 + hash2(x, 9, seed) * 0.5, seed + x, 1, 0.1);
      g.fill();
    }
    glint(
      g,
      [
        { x: 2, y: -T + 0.4 },
        { x: Math.min(len - 2, 9), y: -T + 0.1 },
      ],
      'rgba(235,255,210,0.85)',
      0.6,
      seed,
    );
    pen(g, body, seed, 0.35, 0.9, 3, SLIME_INK);
  });
}

/** The gag: a single bubble on the coat swells, wobbles, and pops in a spray. */
function bubble(s: CanvasRenderingContext2D, r: Run, t: number) {
  const p = (t / 3.4 + r.seed * 0.031) % 1;
  const x = 4 + hash2(r.seed, 9, 1) * Math.max(0, r.len - 8);
  const y = -T - 0.4;
  if (p < 0.78) {
    const k = p / 0.78;
    const R = 0.6 + 2.2 * k * k;
    const wob = Math.sin(t * 9) * 0.08 * R;
    s.fillStyle = SLIME_INK;
    blob(s, x, y - R * 0.75, R + 0.45, r.seed, 1 - wob * 0.1, 0.03);
    s.fill();
    s.fillStyle = css(SLIME, 16);
    blob(s, x, y - R * 0.75, R, r.seed + 1, 1 + wob * 0.1, 0.03);
    s.fill();
    s.fillStyle = 'rgba(245,255,230,0.95)';
    blob(s, x - R * 0.35, y - R * 1.15, Math.max(0.25, R * 0.22), r.seed + 2, 1, 0);
    s.fill();
  } else if (p < 0.9) {
    // Pop: a ring of flecks thrown out, and the skin's last ticks.
    const k = (p - 0.78) / 0.12;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI * (0.1 + (i / 5) * 0.8);
      const d = 1.4 + k * 3.2;
      tick(s, x + Math.cos(a) * d, y - 1.8 + Math.sin(a) * d, x + Math.cos(a) * (d + 1.1), y - 1.8 + Math.sin(a) * (d + 1.1), 0.45, i, SLIME_INK);
      if (i % 2 === 0) {
        s.fillStyle = css(SLIME, 10);
        blob(s, x + Math.cos(a) * (d + 2), y - 1.8 + Math.sin(a) * (d + 2) + k * k * 2, 0.5, i, 1, 0);
        s.fill();
      }
    }
  }
}

function drawSlime(rc: RC, m: Coat, card: boolean) {
  const s = rc.s;
  const runs = runsOf(m);
  // One bubble per coat, on the run its first cell picked.
  const pick = runs.length ? Math.floor(hash2(runs[0].seed, 3, 7) * runs.length) : -1;
  runs.forEach((r, i) => {
    enter(s, r, card);
    stamp(s, slimeRun(r.len, r.seed));
    // Drips sag off a coat on a wall or under a ceiling.
    if (r.ny >= 0) {
      for (let x = 5; x < r.len - 2; x += TILE) {
        const p = (rc.t * 0.45 + (r.seed + x) * 0.037) % 1;
        // In a wall's frame "down" is +x; under a ceiling it's out of the face.
        const ceiling = r.ny > 0;
        const ox = ceiling ? x + hash2(x, 8, r.seed) * 6 : x + 4;
        const oy = ceiling ? -T - 0.2 : -T * 0.5;
        const [vx, vy] = ceiling ? [0, -1] : [1, 0];
        const sag = 1.2 + p * 2.6;
        const drop: P[] = [
          { x: ox, y: oy },
          { x: ox + vx * sag * 0.5, y: oy + vy * sag * 0.5 },
          { x: ox + vx * sag, y: oy + vy * sag },
        ];
        s.fillStyle = SLIME_INK;
        stroke(s, drop, { w: 2.1, seed: x, taper: [0.75, 0.2], press: 0 });
        s.fillStyle = css(SLIME, 4);
        stroke(s, drop, { w: 1.2, seed: x + 1, taper: [0.75, 0.25], press: 0 });
        if (p > 0.85) {
          const fall = 3 + (p - 0.85) * 40;
          s.fillStyle = css(SLIME, 4);
          blob(s, ox + vx * fall, oy + vy * fall, 0.6, x + 2, 1, 0);
          s.fill();
        }
      }
    }
    if (i === pick) bubble(s, r, rc.t);
    s.restore();
  });
}

defineArt<'coat'>({
  type: 'coat',
  layer: 2,
  draw: (rc, m, d) => (m.kind === 'spikes' ? drawSpikeStrip(rc, m) : m.kind === 'ice' ? drawIce(rc, m, !!d.o.card) : drawSlime(rc, m, !!d.o.card)),
});
