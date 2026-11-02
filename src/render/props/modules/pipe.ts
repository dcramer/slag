import { css, type HSL } from '../../../core/color';
import { sq } from '../../../core/dmath';
import type { Vec } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import type { CharacterDef } from '../../../gen/character';
import { TILE } from '../../../sim/constants';
import { dirOf, isPipe, lonePipe, type ModuleOf, PIPE, pipeHalfWidth, pipePairs, type PipeLook, type PlacedProp, resolveProp } from '../../../sim/props';
import type { Runner, RunWorld } from '../../../sim/run';
import { type P, stroke } from '../../ink';
import { drawInkRunner } from '../../ink-character';
import { boxPts, dot, INK, ovalPts, part, path, pen, poly, sprite, stamp, tone } from '../../ink-props';
import { glowDot, light, type RC } from '../../kit';
import { defineArt, defineHeld } from '../common';

type Pipe = ModuleOf<'pipe'>;

/**
 * The warped pipe (docs/PARODY.md, pipe): the plumber's warp pipe, drawn our way. A round shaft a
 * quarter tile in from each side under a chunky lip the full two tiles across, exactly the solids the
 * sim stands you on. Both are cylinders in cel bands of the match's material: a lit band left of
 * center with a thin specular stroke in it, the body, a hard shade band on the right and a deeper one
 * at the edge. The lip throws a dark band of shadow onto the shaft under it. The mouth, seen a touch
 * from its own side, is a bevelled rim round a dark ellipse with a light inner lip on its far wall.
 * A plumber's job tag on the shaft carries the pair's number. A lone pipe's mouth is a dead black
 * hole; a linked one breathes a faint draft and a glint deep inside.
 *
 * Everything is drawn in the pipe's own frame (u across the mouth, v down the pipe from the mouth)
 * and turned into the world before it's toned, so the light stays up-left whichever way it faces.
 */

const W = PIPE.wide * TILE;
const LIP = PIPE.lip;
/** Half the shaft's width: the lip stands out PIPE.overhang past it on each side. */
const SHAFT = W / 2 - PIPE.overhang;

/** Each material's tones, darkest to brightest: every look gets the same bands in its own palette. */
interface Tones {
  deep: HSL;
  shade: HSL;
  base: HSL;
  lit: HSL;
  spec: HSL;
  /** A painted collar round the shaft (brass's darker ring, porcelain's blue pinstripe). */
  band?: HSL;
  /** Spots in another color (rust, copper through verdigris). */
  fleck?: HSL;
}

const LOOKS: Record<PipeLook, Tones> = {
  green: {
    deep: { h: 135, s: 75, l: 17 },
    shade: { h: 128, s: 70, l: 27 },
    base: { h: 118, s: 72, l: 38 },
    lit: { h: 104, s: 70, l: 55 },
    spec: { h: 90, s: 80, l: 86 },
  },
  brass: {
    deep: { h: 28, s: 60, l: 18 },
    shade: { h: 32, s: 58, l: 29 },
    base: { h: 40, s: 62, l: 43 },
    lit: { h: 46, s: 74, l: 60 },
    spec: { h: 52, s: 90, l: 88 },
    band: { h: 30, s: 55, l: 26 },
  },
  rust: {
    deep: { h: 10, s: 45, l: 14 },
    shade: { h: 14, s: 45, l: 23 },
    base: { h: 18, s: 48, l: 33 },
    lit: { h: 24, s: 52, l: 45 },
    spec: { h: 30, s: 50, l: 68 },
    fleck: { h: 28, s: 85, l: 46 },
  },
  porcelain: {
    deep: { h: 215, s: 14, l: 52 },
    shade: { h: 212, s: 14, l: 70 },
    base: { h: 210, s: 16, l: 86 },
    lit: { h: 200, s: 25, l: 95 },
    spec: { h: 0, s: 0, l: 100 },
    band: { h: 214, s: 70, l: 46 },
  },
  copper: {
    deep: { h: 176, s: 40, l: 18 },
    shade: { h: 172, s: 36, l: 30 },
    base: { h: 166, s: 36, l: 44 },
    lit: { h: 158, s: 40, l: 60 },
    spec: { h: 150, s: 50, l: 86 },
    fleck: { h: 22, s: 64, l: 48 },
  },
};

/** A frame turning pipe space (u across, v into the shaft) into offsets from the mouth. */
interface Frame {
  /** Across the mouth. */
  a: Vec;
  /** Out of the mouth. */
  d: Vec;
}

function frameOf(angle: number): Frame {
  const [dx, dy] = dirOf(angle);
  return { d: [dx, dy], a: [-dy, dx] };
}

const at = (f: Frame, u: number, v: number): P => ({ x: f.a[0] * u - f.d[0] * v, y: f.a[1] * u - f.d[1] * v });
const map = (f: Frame, pts: readonly P[]): P[] => pts.map((p) => at(f, p.x, p.y));

/**
 * Cel bands down a cylinder `hw` half-wide from v0 to v1: a reflected dark edge, the lit band left of
 * center, the body, then a hard shade and a deeper one at the right edge. Light is up-left in the
 * world, so "left" is whichever side of the pipe faces it.
 */
function bands(g: CanvasRenderingContext2D, f: Frame, t: Tones, hw: number, v0: number, v1: number, flip: boolean) {
  const k = flip ? -1 : 1;
  const band = (a: number, b: number, c: HSL) => {
    g.fillStyle = css(c);
    path(g, map(f, poly(a * hw * k, v0, b * hw * k, v0, b * hw * k, v1, a * hw * k, v1)));
    g.fill();
  };
  band(-1.1, -0.84, t.shade);
  band(-0.8, -0.22, t.lit);
  band(0.28, 1.1, t.shade);
  band(0.7, 1.1, t.deep);
  // The specular: one thin stroke down the lit band.
  g.fillStyle = css(t.spec, 0, 0.95);
  stroke(g, map(f, poly(-0.56 * hw * k, v0 + 1.2, -0.56 * hw * k, v1 - 1.2)), { w: Math.max(0.9, hw * 0.09), seed: 5, taper: [0.25, 0.35], press: 0.2 });
}

/** Which side of the pipe's frame faces the light (up-left): the bands put their lit side there. */
function litFlip(f: Frame): boolean {
  // The bands put the lit side at -u: flip them when -u faces away from up-left.
  return f.a[0] + f.a[1] < 0;
}

/**
 * One piece of the pipe's outline in pipe space, from depth v0 to v1: the sim's own curve
 * (pipeHalfWidth), so the rolled rim and the softened foot are drawn exactly where they're solid.
 * `dome` bows the mouth's face out a touch, within the floor's drift.
 */
function outline(v0: number, v1: number, len: number, dome: number): P[] {
  const right: P[] = [];
  const n = Math.max(8, Math.ceil((v1 - v0) / 0.5));
  for (let i = 0; i <= n; i++) {
    const v = v0 + ((v1 - v0) * i) / n;
    // The shaft's top tucks under the lip at full width; only the lip and the foot curve.
    right.push({ x: v < PIPE.lip && v0 >= PIPE.lip - 1 ? SHAFT : pipeHalfWidth(Math.min(v, len), len), y: v });
  }
  const top: P[] = [];
  if (dome > 0) {
    const hw = pipeHalfWidth(v0, len);
    for (let i = 1; i < 8; i++) {
      const u = -hw + (2 * hw * i) / 8;
      top.push({ x: u, y: v0 - dome * (1 - sq(u / hw)) });
    }
  }
  const left: P[] = [];
  for (let i = right.length - 1; i >= 0; i--) left.push({ x: -right[i].x, y: right[i].y });
  return [...top, ...right, ...left];
}

/** The pipe's still body, baked once per material, length and facing. Its origin is the mouth's center. */
function body(look: PipeLook, len: number, f: Frame) {
  const L = len * TILE;
  const c0 = at(f, -W / 2 - 3, -3);
  const c1 = at(f, W / 2 + 3, L + 3);
  const x0 = Math.min(c0.x, c1.x);
  const y0 = Math.min(c0.y, c1.y);
  const key = `pipe|${look}|${len}|${f.d[0]}|${f.d[1]}`;
  return sprite(key, x0, y0, Math.abs(c1.x - c0.x), Math.abs(c1.y - c0.y), (g) => {
    const t = LOOKS[look];
    const flip = litFlip(f);
    const seed = len * 7 + look.length;
    // The shaft, exactly its solid: a cylinder in bands.
    const shaft = map(f, outline(LIP - 0.5, L, L, 0));
    tone(g, shaft, t.base, { depth: 0.8, shade: -10 });
    g.save();
    path(g, shaft);
    g.clip();
    bands(g, f, t, SHAFT, LIP - 1, L + 1, flip);
    if (t.band) {
      g.fillStyle = css(t.band);
      path(g, map(f, poly(-W / 2, LIP + 6, W / 2, LIP + 6, W / 2, LIP + 7.6, -W / 2, LIP + 7.6)));
      g.fill();
    }
    if (t.fleck) {
      for (let i = 0; i < 3 + len * 2; i++) {
        const u = (hash2(i, 3, seed) - 0.5) * (SHAFT * 2 - 5);
        const v = LIP + 5 + hash2(i, 5, seed) * (L - LIP - 7);
        g.fillStyle = css(t.fleck, 0, 0.85);
        path(g, map(f, ovalPts(u, v, 1.4 + hash2(i, 7, seed) * 1.2, 1, seed + i, 0.25, 7)));
        g.fill();
      }
    }
    // The lip's shadow falls hard across the top of the shaft.
    g.fillStyle = css(t.deep, -4, 0.9);
    path(g, map(f, poly(-W / 2, LIP - 1, W / 2, LIP - 1, W / 2, LIP + 2.6, 0, LIP + 3.4, -W / 2, LIP + 2.6)));
    g.fill();
    g.restore();
    pen(g, shaft, seed, 0.45, 1.9, 5);
    // The lip: the full two tiles across, chunkier and a step brighter, banded the same way.
    const lip = map(f, outline(0, LIP, L, 0.4));
    tone(g, lip, t.base, { depth: 0.8, shade: -10 });
    g.save();
    path(g, lip);
    g.clip();
    bands(g, f, t, W / 2, -1, LIP + 1, flip);
    // Its underside edge in shade, so it reads as a collar standing proud of the shaft.
    g.fillStyle = css(t.shade);
    path(g, map(f, poly(-W / 2, LIP - 1.4, W / 2, LIP - 1.4, W / 2, LIP + 1, -W / 2, LIP + 1)));
    g.fill();
    g.restore();
    pen(g, lip, seed + 1, 0.5, 2, 5);
    // The mouth's rim, seen a touch from its own side: a bevelled ring round the opening.
    const rim = map(f, ovalPts(0, 3.4, W / 2 - 2, 2.7, seed + 2, 0.02, 20));
    part(g, rim, t.base, seed + 2, { depth: 0.6, shade: -12, thin: 0.3, thick: 0.9 });
  });
}

/** The opening: a dark ellipse inside the rim. Live, because a linked one breathes. */
function hole(f: Frame): P[] {
  return map(f, ovalPts(0, 3.6, W / 2 - 5, 1.7, 9, 0.02, 18));
}

/** The far wall's lip inside the opening, catching the light: a thin arc along its back half. */
function innerRim(f: Frame): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (1.12 + (i / 8) * 0.76);
    pts.push({ x: Math.cos(a) * (W / 2 - 5.6), y: 3.75 + Math.sin(a) * 1.25 });
  }
  return map(f, pts);
}

/** A plumber's job tag stuck on the shaft below the lip, upright whichever way the pipe faces, with the pair's number. */
function tag(s: CanvasRenderingContext2D, x: number, y: number, n: number, f: Frame, len: number) {
  const p = at(f, SHAFT - 5, Math.max(LIP + 5, (len * TILE) / 2 + 3));
  const tx = x + p.x;
  const ty = y + p.y;
  const card = boxPts(tx - 3.1, ty - 3.5, 6.2, 7, 0.8, n, 0.1);
  part(s, card, { h: 44, s: 40, l: 88 }, n + 3, { depth: 0.35, thin: 0.3, thick: 0.6 });
  dot(s, tx, ty - 2.4, 0.45, n);
  s.fillStyle = INK;
  s.font = 'bold 6px sans-serif';
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.fillText(String(n), tx, ty + 0.6);
}

/** Thin curls of air rising out of a linked mouth, on the layer that takes no ink. */
function draft(rc: RC, x: number, y: number, f: Frame, col: HSL) {
  const bg = rc.bg;
  bg.fillStyle = css(col, 30, 0.35);
  for (let k = 0; k < 2; k++) {
    const ph = (rc.t * 0.9 + k * 0.5) % 1;
    const pts: P[] = [];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6;
      const v = -2 - (ph * 10 + t * 9);
      const u = (k ? 4 : -4) + Math.sin(rc.t * 3 + t * 5 + k * 2) * 2;
      const q = at(f, u, v);
      pts.push({ x: x + q.x, y: y + q.y });
    }
    stroke(bg, pts, { w: 0.9 * (1 - ph), seed: k + 1, taper: [0.3, 0.5], press: 0 });
  }
}

/** Is this pipe's partner standing? Without the match's parts (cards, the codex) it shows unlinked. */
function linkedIn(pp: PlacedProp, placed: readonly PlacedProp[] | undefined): boolean {
  return pp.link !== undefined && !!placed?.some((p) => p.uid === pp.link && p.link === pp.uid);
}

defineArt<'pipe'>({
  type: 'pipe',
  layer: 1,
  draw(rc, m, d) {
    const s = rc.s;
    const f = frameOf(m.angle);
    const [x, y] = m.at;
    stamp(s, body(m.look, m.cells.length / PIPE.wide, f), x, y);
    const placed = d.o.placed;
    const linked = linkedIn(d.r.pp, placed);
    const t = LOOKS[m.look];
    const base = t.base;
    const h = hole(f).map((p) => ({ x: x + p.x, y: y + p.y }));
    s.fillStyle = linked ? css(t.deep, -8) : INK;
    path(s, h);
    s.fill();
    if (linked) {
      // The far wall's lip catching the light, a glint deep inside and a breath of air: something's down there.
      s.fillStyle = css(t.lit, 10, 0.9);
      stroke(
        s,
        innerRim(f).map((p) => ({ x: x + p.x, y: y + p.y })),
        { w: 0.7, seed: 4, taper: [0.3, 0.3], press: 0 },
      );
      const gl = at(f, -3, 3.9);
      s.fillStyle = 'rgba(255,255,240,0.8)';
      stroke(s, [h[11], { x: x + gl.x, y: y + gl.y }], { w: 0.55, seed: 2, taper: [0.3, 0.3], press: 0 });
      draft(rc, x, y, f, base);
      // It flares as someone goes in, and again at the far end as they come out.
      const since = d.o.state ? rc.frame - d.o.state.lastFire : 999;
      const out = d.o.grips?.find((g) => g.to === d.r.pp.uid && g.uid !== d.r.pp.uid);
      const flare = Math.max(since < 24 ? 1 - since / 24 : 0, out ? Math.max(0, 1 - (out.t - PIPE.in) / PIPE.out) : 0);
      glowDot(rc.g, x, y, 6 + flare * 10, t.lit, 0.18 + flare * 0.5);
      if (flare > 0) light(rc, x, y, 30, t.lit, flare * 0.6);
      const n = placed && pipePairs(placed).get(d.r.pp.uid);
      if (n) tag(s, x, y, n, f, m.cells.length / PIPE.wide);
    } else if (d.o.showPath && placed && !d.o.card) {
      // Placing a pipe while another waits: a dotted line shows the two will pair.
      const lone = lonePipe(placed);
      const other = lone && lone.uid !== d.r.pp.uid && isPipe(lone) ? lone : null;
      if (other) tether(rc, x, y, other, base);
    }
  },
});

function tether(rc: RC, x: number, y: number, other: PlacedProp, col: HSL) {
  const to = resolveProp(other).mods.find((q): q is Pipe => q.type === 'pipe')?.at;
  if (!to) return;
  const g = rc.g;
  g.save();
  g.strokeStyle = css(col, 30, 0.7);
  g.lineWidth = 1.2;
  g.setLineDash([2, 4]);
  g.lineDashOffset = -rc.t * 12;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(to[0], to[1]);
  g.stroke();
  g.restore();
}

/**
 * A runner on a trip: sliding down into the near mouth, then up out of the far one, cut off at
 * the mouth's plane so nothing shows through the pipe's walls.
 */
function drawPiped(rc: RC, run: RunWorld, r: Runner, c: CharacterDef): void {
  const g = r.attach.grip;
  if (!g) return;
  const going = g.to < 0;
  const rp = run.resolved.find((x) => x.pp.uid === (going ? g.uid : g.to));
  const m = rp?.mods.find((q): q is Pipe => q.type === 'pipe');
  if (!m) return;
  const k = going ? Math.min(1, g.t / PIPE.in) : Math.max(0, 1 - (g.t - PIPE.in) / PIPE.out);
  const [dx, dy] = dirOf(m.angle);
  const b = r.body;
  const sink = k * (dy ? b.h + 4 : b.w + 6);
  const cx = b.x + b.w / 2 - dx * sink;
  const cy = b.y + b.h / 2 - dy * sink;
  const s = rc.s;
  s.save();
  s.beginPath();
  const [mx, my] = m.at;
  const R = 40;
  s.moveTo(mx - dy * R, my + dx * R);
  s.lineTo(mx + dy * R, my - dx * R);
  s.lineTo(mx + dy * R + dx * R, my - dx * R + dy * R);
  s.lineTo(mx - dy * R + dx * R, my + dx * R + dy * R);
  s.closePath();
  s.clip();
  drawInkRunner(rc, c, cx, cy + b.h / 2, { facing: dx ? dx * (going ? -1 : 1) : b.facing, vx: 0, vy: 0, grounded: true, t: rc.t });
  s.restore();
}

defineHeld('pipe', drawPiped);
