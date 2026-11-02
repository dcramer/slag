import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import type { CharacterDef } from '../../../gen/character';
import { TILE } from '../../../sim/constants';
import { dirOf, isPipe, lonePipe, type ModuleOf, PIPE, pipePairs, type PipeLook, type PlacedProp, resolveProp } from '../../../sim/props';
import type { Runner, RunWorld } from '../../../sim/run';
import { type P, stroke } from '../../ink';
import { drawInkRunner } from '../../ink-character';
import { boxPts, dot, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light, type RC } from '../../kit';
import { defineArt, defineHeld } from '../common';

type Pipe = ModuleOf<'pipe'>;

/**
 * The warped pipe (docs/PARODY.md, pipe): the plumber's warp pipe, drawn our way. A chunky shaft
 * with a wider lip, seen a touch from the mouth's side so its bevelled rim and opening read. Three
 * flat tones of the match's material: the lit stripe, the body and the shade, and the lip's rim a
 * step brighter. A plumber's job tag hangs off the lip with the pair's number on it. A lone pipe's
 * mouth is a dead black hole; a linked one breathes a faint draft and a glint deep inside.
 *
 * Everything is drawn in the pipe's own frame (u across the mouth, v down the shaft from the mouth)
 * and turned into the world before it's toned, so the light stays up-left whichever way it faces.
 */

const W = PIPE.wide * TILE;
/** Depth of the lip down the shaft (px). */
const LIP = 9;
/** The shaft sits this much inside the lip on each side: within the art's hitbox slack. */
const NECK = 1;

const LOOKS: Record<PipeLook, { base: HSL; band?: HSL; fleck?: HSL }> = {
  green: { base: { h: 122, s: 58, l: 40 } },
  brass: { base: { h: 38, s: 58, l: 45 }, band: { h: 28, s: 50, l: 30 } },
  rust: { base: { h: 16, s: 46, l: 34 }, fleck: { h: 26, s: 80, l: 46 } },
  porcelain: { base: { h: 210, s: 14, l: 88 }, band: { h: 214, s: 70, l: 46 } },
  copper: { base: { h: 168, s: 34, l: 47 }, fleck: { h: 22, s: 62, l: 50 } },
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

/** The pipe's still body, baked once per material, length and facing. Its origin is the mouth's center. */
function body(look: PipeLook, len: number, f: Frame) {
  const L = len * TILE;
  const c0 = at(f, -W / 2 - 3, -3);
  const c1 = at(f, W / 2 + 3, L + 3);
  const x0 = Math.min(c0.x, c1.x);
  const y0 = Math.min(c0.y, c1.y);
  const key = `pipe|${look}|${len}|${f.d[0]}|${f.d[1]}`;
  return sprite(key, x0, y0, Math.abs(c1.x - c0.x), Math.abs(c1.y - c0.y), (g) => {
    const { base, band, fleck } = LOOKS[look];
    const seed = len * 7 + (look.length % 5);
    // The shaft: three flat tones, lit stripe toward the mouth's left, shade to the right.
    const shaft = map(f, boxPts(-W / 2 + NECK, LIP - 1, W - NECK * 2, L - LIP + 1, 1.2, seed, 0.15));
    tone(g, shaft, base, { depth: 1.2, shade: -14 });
    g.save();
    path(g, shaft);
    g.clip();
    rounded(g, f, base, LIP - 1, L, 0);
    if (band) {
      // A painted band round the shaft: brass gets a darker collar, porcelain its blue pinstripe.
      g.fillStyle = css(band);
      path(g, map(f, poly(-W / 2, LIP + 5, W / 2, LIP + 5, W / 2, LIP + 7, -W / 2, LIP + 7)));
      g.fill();
    }
    if (fleck) {
      // Rust spots, or copper showing through the verdigris.
      for (let i = 0; i < 3 + len; i++) {
        const u = (hash2(i, 3, seed) - 0.5) * (W - 8);
        const v = LIP + 3 + hash2(i, 5, seed) * (L - LIP - 5);
        g.fillStyle = css(fleck, 0, 0.85);
        path(g, map(f, ovalPts(u, v, 1.6 + hash2(i, 7, seed), 1.1, seed + i, 0.2, 7)));
        g.fill();
      }
    }
    g.restore();
    pen(g, shaft, seed, 0.6, 1.5, 4);
    // The lip: the full width, a step brighter, with its own lit stripe and a hard shade under it.
    const lip = map(f, boxPts(-W / 2, 0, W, LIP, 2.2, seed + 1, 0.15));
    tone(g, lip, base, { depth: 1, shade: -10 });
    g.save();
    path(g, lip);
    g.clip();
    rounded(g, f, base, 0, LIP, 4);
    g.fillStyle = css(base, -16, 1, 4);
    path(g, map(f, poly(-W / 2, LIP - 1.6, W / 2, LIP - 1.6, W / 2, LIP, -W / 2, LIP)));
    g.fill();
    g.restore();
    pen(g, lip, seed + 1, 0.6, 1.6, 4);
    // The bevelled rim round the opening, seen a touch from the mouth's side.
    const rim = map(f, ovalPts(0, 3.4, W / 2 - 2.2, 2.6, seed + 2, 0.03, 18));
    part(g, rim, { ...base, l: Math.min(92, base.l + 14) }, seed + 2, { depth: 0.5, shade: -20, thin: 0.35, thick: 0.8 });
    // Rivets where the lip meets the shaft.
    for (const u of [-W / 2 + 3.2, W / 2 - 3.2]) {
      const p = at(f, u, LIP + 2.4);
      dot(g, p.x, p.y, 0.7, u, css(base, 30));
    }
  });
}

/**
 * Stripes down a length of pipe (`v0`..`v1`) that make it round: a wide lit band toward the light with a
 * bright line in it, and two steps of shade on the far side. `lift` brightens the lip a little.
 */
function rounded(g: CanvasRenderingContext2D, f: Frame, base: HSL, v0: number, v1: number, lift: number) {
  const band = (u0: number, u1: number, dl: number, ds = 0) => {
    g.fillStyle = css(base, dl + lift, 1, ds);
    path(g, map(f, poly(u0, v0, u1, v0, u1, v1, u0, v1)));
    g.fill();
  };
  band(-W / 2, -W / 2 + 2.5, -8, 2);
  band(-W / 2 + 3, -W / 2 + 10, 16);
  band(-W / 2 + 5, -W / 2 + 6.6, 34, -10);
  band(W / 2 - 10, W / 2, -12, 4);
  band(W / 2 - 4.5, W / 2, -24, 6);
}

/** The opening: a dark hole inside the rim. Live, because a linked one breathes. */
function hole(f: Frame): P[] {
  return map(f, ovalPts(0, 3.6, W / 2 - 5, 1.5, 9, 0.02, 16));
}

/** A plumber's job tag tied to the lip, with the pair's number. */
function tag(s: CanvasRenderingContext2D, x: number, y: number, n: number, f: Frame) {
  const p = at(f, W / 2 - 5, LIP + 2);
  const tx = x + p.x;
  const ty = y + p.y;
  tick(s, tx, ty, tx + 2.2, ty + 3.4, 0.35, 4, INK);
  const card = boxPts(tx - 0.6, ty + 3, 6.2, 7, 0.8, n, 0.1);
  part(s, card, { h: 44, s: 40, l: 88 }, n + 3, { depth: 0.35, thin: 0.3, thick: 0.6 });
  s.fillStyle = INK;
  s.font = 'bold 6px sans-serif';
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.fillText(String(n), tx + 2.5, ty + 6.8);
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
    const { base } = LOOKS[m.look];
    const h = hole(f).map((p) => ({ x: x + p.x, y: y + p.y }));
    s.fillStyle = linked ? css(base, -34, 1, -10) : INK;
    path(s, h);
    s.fill();
    const since = d.o.state ? rc.frame - d.o.state.lastFire : 999;
    if (linked) {
      // A glint deep inside and a breath of air: something's down there.
      const gl = at(f, -4, 3.6);
      s.fillStyle = 'rgba(255,255,240,0.8)';
      stroke(s, [h[9], { x: x + gl.x, y: y + gl.y }], { w: 0.6, seed: 2, taper: [0.3, 0.3], press: 0 });
      draft(rc, x, y, f, base);
      const flare = since < 24 ? 1 - since / 24 : 0;
      glowDot(rc.g, x, y, 6 + flare * 10, { ...base, l: 70 }, 0.18 + flare * 0.5);
      if (flare > 0) light(rc, x, y, 30, { ...base, l: 70 }, flare * 0.6);
      const n = placed && pipePairs(placed).get(d.r.pp.uid);
      if (n) tag(s, x, y, n, f);
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
