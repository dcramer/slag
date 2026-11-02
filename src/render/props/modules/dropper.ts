import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_SOLID, tileAt } from '../../../sim/level';
import {
  DROP_FALL,
  DROP_REST,
  DROP_WARN,
  dirOf,
  type DropperLook,
  type DropperPose,
  dropperPose,
  dropperRect,
  dropperTravel,
  type ModuleOf,
} from '../../../sim/props';
import { blob, inkFor, line, type P, shadeOf, stroke } from '../../ink';
import { boxPts, dot, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light, type RC } from '../../kit';
import { beamOf, type DrawCtx, defineArt } from '../common';
import { bevel } from '../machine';
import { horn } from '../spike-looks';

/**
 * Proximity crusher: a heavy carved stone block, or for a set piece a big icicle, the throne hall's
 * chandelier or a gatehouse's portcullis (`look`). Idle it hangs over its lane (faint chevrons show the
 * lane it watches); spotting someone, the arrow rune cut in its face glows red, grit trickles off it and
 * it shakes for the whole telegraph; then it slams with speed streaks. Drawn from the same pose the sim
 * builds its solid from. It's an object, never a character: no face (docs/ART.md, Objects, not characters).
 */

/**
 * The block, baked: a dressed stone with chiselled bevels round a raised face, so it reads as a carved
 * mass and not a tile; a rim of stone teeth, a chipped corner, cracks, and a sunk panel in the middle
 * that the rune is cut into live (it points the way the block slams).
 */
function block(w: number, h: number, stone: HSL) {
  return sprite(`dr|${w}|${h}|${stone.h | 0}`, -2, -2, w + 4, h + 4, (g) => {
    const body = boxPts(0, 0, w, h, 2.6, 5, 0.2);
    tone(g, body, stone, { depth: 1, shade: -14 });
    const k = Math.min(w, h) / TILE;
    const b = 2.7 * k;
    const cx = w / 2;
    const cy = h / 2;
    const pw = 4.6 * k;
    g.save();
    path(g, body);
    g.clip();
    const ink = inkFor(stone);
    bevel(g, 0, 0, w, h, b, stone, ink);
    // A rim of stone teeth round the face: the crushing block's spiked edge, cut inside its own
    // outline so the hitbox stays the block. Each tooth is lit on the side facing the light.
    const teeth = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, lit: number) => {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(2, Math.round(len / (4.2 * k)));
      const ux = (bx - ax) / n;
      const uy = (by - ay) / n;
      for (let i = 0; i < n; i++) {
        const x0 = ax + ux * i;
        const y0 = ay + uy * i;
        const tip = { x: x0 + ux / 2 + nx * b * 0.9, y: y0 + uy / 2 + ny * b * 0.9 };
        const mid = { x: x0 + ux / 2, y: y0 + uy / 2 };
        g.fillStyle = css(stone, lit + 8);
        path(g, [{ x: x0, y: y0 }, tip, mid]);
        g.fill();
        g.fillStyle = css(stone, lit - 14, 1, 4);
        path(g, [mid, tip, { x: x0 + ux, y: y0 + uy }]);
        g.fill();
        g.fillStyle = ink;
        stroke(g, [{ x: x0, y: y0 }, tip, { x: x0 + ux, y: y0 + uy }], { w: 0.4 * k + 0.15, seed: i + nx * 3 + ny * 7, taper: [0.1, 0.1], press: 0.2 });
      }
    };
    teeth(b, b, w - b, b, 0, -1, 10);
    teeth(w - b, h - b, b, h - b, 0, 1, -14);
    teeth(b, h - b, b, b, -1, 0, 4);
    teeth(w - b, b, w - b, h - b, 1, 0, -8);
    // A chipped corner, top right.
    g.fillStyle = css(stone, -26, 1, 6);
    path(g, poly(w - 4.2 * k, -1, w + 1, -1, w + 1, 3.6 * k, w - 1.4 * k, 1.4 * k));
    g.fill();
    for (let i = 0; i < 4; i++) {
      const tx = b + 1 + hash2(i, 1, w) * (w - b * 2 - 2);
      const ty = b + 1 + hash2(i, 2, h) * (h - b * 2 - 2);
      if (Math.abs(tx - cx) < pw + 1.5 && Math.abs(ty - cy) < pw + 1.5) continue;
      tick(g, tx, ty, tx + 1.4, ty + 0.7, 0.45, i, css(stone, -22, 1, 4));
    }
    // Cracks: a forked one in from the lower left, a short one off the chipped corner.
    g.fillStyle = css(stone, -34, 1, 6);
    const fork = { x: b + 2.4 * k, y: h - b - 2.4 * k };
    stroke(g, [{ x: b * 0.5, y: h - b * 1.3 }, fork, { x: b + 3.8 * k, y: h - b - 2.8 * k }], { w: 0.5 * k + 0.2, seed: 21, taper: [0.1, 0.6], press: 0.2 });
    stroke(g, [fork, { x: b + 2 * k, y: h - b - 4.2 * k }], { w: 0.35 * k + 0.15, seed: 22, taper: [0.1, 0.7], press: 0.2 });
    stroke(g, poly(w - 2.4 * k, 2.2 * k, w - 3.8 * k, 3.8 * k, w - 3.9 * k, 5.2 * k), { w: 0.4 * k + 0.15, seed: 23, taper: [0.1, 0.7], press: 0.2 });
    g.restore();
    pen(g, body, 5, 0.6, 1.7, 3, ink);
    // The sunk panel: in shade under its top and left walls, lit along its lower right lip.
    const panel = boxPts(cx - pw, cy - pw, pw * 2, pw * 2, 1.1 * k, 9, 0.12);
    g.fillStyle = css(stone, -24, 1, 4);
    path(g, panel);
    g.fill();
    g.save();
    path(g, panel);
    g.clip();
    g.fillStyle = css(stone, -7);
    path(g, boxPts(cx - pw + 1.1 * k, cy - pw + 1.1 * k, pw * 2, pw * 2, 1.1 * k, 9, 0.12));
    g.fill();
    g.restore();
    g.fillStyle = css(stone, 20);
    stroke(g, poly(cx - pw + 0.8, cy + pw, cx + pw, cy + pw, cx + pw, cy - pw + 0.8), { w: 0.45 * k + 0.2, seed: 11, taper: [0.3, 0.3], press: 0.2 });
    g.fillStyle = ink;
    stroke(g, poly(cx - pw, cy + pw - 0.6, cx - pw, cy - pw, cx + pw - 0.6, cy - pw), { w: 0.5 * k + 0.25, seed: 12, taper: [0.2, 0.2], press: 0.3 });
  });
}

/** The rune cut in the panel: a chevron pointing the way it slams. A dark groove at rest, red-hot when it's coming. */
function rune(s: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number, k: number, hot: HSL | null, stone: HSL) {
  const r = 2.8 * k;
  const at = (a: number, b: number): P => ({ x: cx + dx * a + dy * b, y: cy + dy * a + dx * b });
  const pts = [at(-r * 0.45, -r), at(r * 0.65, 0), at(-r * 0.45, r)];
  // The groove's lit lower lip, then the cut, then what glows in it.
  s.fillStyle = css(stone, 18);
  stroke(
    s,
    pts.map((p) => ({ x: p.x + 0.4 * k, y: p.y + 0.45 * k })),
    { w: 1 * k, seed: 3, taper: [0.1, 0.1], press: 0 },
  );
  s.fillStyle = css(stone, -34, 1, 6);
  stroke(s, pts, { w: 1.25 * k, seed: 4, taper: [0.1, 0.1], press: 0 });
  if (hot) {
    s.fillStyle = css(hot, 12);
    stroke(s, pts, { w: 0.7 * k, seed: 6, taper: [0.15, 0.15], press: 0 });
  }
}

/** Into the slam frame: origin at the head's centre, local +y the way it slams. Returns the frame's turn. */
function slamFrame(s: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number): number {
  const a = Math.atan2(dy, dx) - Math.PI / 2;
  s.save();
  s.translate(cx, cy);
  s.rotate(a);
  return a;
}

/** Everything a look draws from: the pose, the head's rect where it is now (x, y, w, h) and its centre. */
interface Head {
  rc: RC;
  m: ModuleOf<'dropper'>;
  d: DrawCtx;
  p: DropperPose;
  dx: number;
  dy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  warn: boolean;
  coming: boolean;
}

const ICE = { lit: 'hsl(192 76% 93%)', mid: 'hsl(196 64% 80%)', dark: 'hsl(204 52% 64%)', ink: '#163e57' };
const DEEP: HSL = { h: 208, s: 50, l: 46 };

const fillPts = (g: CanvasRenderingContext2D, pts: readonly P[], col: string) => {
  g.fillStyle = col;
  path(g, pts);
  g.fill();
};

/**
 * A big icicle, baked in the slam frame (W across, H along, its point toward +y). The whole head is solid,
 * so all of it is ice: a deep-toned frozen mass under a crust of snow at the root, and icicles cut over it
 * in flat light tones, the great one down the middle reaching the slamming face. `lit`: local -x faces
 * the light.
 */
function iceHead(W: number, H: number, lit: boolean) {
  return sprite(`dr|ice|${W}|${H}|${lit}`, -W / 2 - 2, -H / 2 - 2, W + 4, H + 4, (g) => {
    const x0 = -W / 2;
    const y0 = -H / 2;
    const body = boxPts(x0, y0, W, H, 2.6, 3, 0.12);
    tone(g, body, DEEP, { depth: 0.9, shade: -12 });
    const root = Math.min(6, H * 0.26);
    const wide = W >= 28;
    // [across, half width, how far short of the face], each as a share of the head; the great one last.
    const icicles = wide
      ? [
          [-0.43, 0.07, 0.4],
          [0.43, 0.07, 0.34],
          [-0.26, 0.14, 0.12],
          [0.26, 0.14, 0.08],
          [0, 0.26, 0],
        ]
      : [
          [-0.34, 0.13, 0.32],
          [0.34, 0.13, 0.24],
          [0, 0.36, 0],
        ];
    icicles.forEach(([u, hw, short], i) => {
      const cx = u * W;
      const hwPx = hw * W;
      const tip = { x: cx + (i % 2 ? 0.4 : -0.4), y: H / 2 - 0.4 - short * H };
      // The spine runs +y, so `neg` is the +x flank and `pos` the -x one.
      const h = horn({ x: cx, y: y0 + root * 0.6 }, { x: cx, y: (y0 + tip.y) / 2 }, tip, hwPx, 1.1, 10);
      fillPts(g, h.all, ICE.mid);
      fillPts(g, lit ? h.pos : h.neg, ICE.lit);
      // The shaded third, down the flank away from the light.
      const n = h.all.length;
      const far = lit ? h.all.slice(0, (n >> 1) + 1) : h.all.slice(n >> 1);
      fillPts(g, [...far, { x: cx + (lit ? 1 : -1) * hwPx * 0.25, y: y0 + root * 0.6 }], ICE.dark);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      const side = lit ? -1 : 1;
      stroke(
        g,
        [
          { x: cx + side * hwPx * 0.5, y: y0 + root + 1 },
          { x: cx + side * hwPx * 0.18, y: y0 + root + (tip.y - y0 - root) * 0.62 },
        ],
        { w: Math.max(0.6, hwPx * 0.22), seed: i, taper: [0.2, 0.6], press: 0 },
      );
      pen(g, h.all, i * 5 + 1, 0.45, 1.3, 3, ICE.ink);
    });
    // The crust it froze from, along the back.
    const crust: P[] = [
      { x: x0 - 0.2, y: y0 - 0.2 },
      { x: x0 + W + 0.2, y: y0 - 0.2 },
    ];
    for (let x = W; x >= 0; x -= 2.5) crust.push({ x: x0 + x, y: y0 + root * (0.55 + 0.45 * Math.abs(Math.sin(x * 0.7 + 1))) });
    part(g, crust, { h: 200, s: 40, l: 94 }, 7, { depth: 0.5, shade: -10, thin: 0.4, thick: 0.9, ink: ICE.ink });
    pen(g, body, 5, 0.5, 1.4, 3, ICE.ink);
  });
}

/** Icicle: a crack opens across its root as it lets go, a hard glint runs down it now and then, ice chips off it. */
function drawIcicle(o: Head) {
  const { rc, m, d, p, dx, dy, w, h, warn, coming } = o;
  const s = rc.s;
  const W = dy !== 0 ? w : h;
  const H = dy !== 0 ? h : w;
  const a = slamFrame(s, o.cx, o.cy, dx, dy);
  stamp(s, iceHead(W, H, shadeOf(-Math.cos(a), -Math.sin(a)) < 0.5));
  if (coming) {
    const k = warn ? Math.min(1, (p.t + 4) / Math.max(1, m.warn)) : 1;
    const ry = -H / 2 + Math.min(6, H * 0.26) + 0.8;
    s.fillStyle = '#f4fbff';
    stroke(
      s,
      [
        { x: -W * 0.46 * k, y: ry + 0.5 },
        { x: -W * 0.16 * k, y: ry - 0.6 },
        { x: W * 0.12 * k, y: ry + 0.6 },
        { x: W * 0.44 * k, y: ry - 0.3 },
      ],
      { w: 1, seed: 3, taper: [0.15, 0.15], press: 0.2 },
    );
    s.fillStyle = ICE.ink;
    stroke(
      s,
      [
        { x: -W * 0.46 * k, y: ry + 1.2 },
        { x: -W * 0.16 * k, y: ry + 0.1 },
        { x: W * 0.12 * k, y: ry + 1.3 },
        { x: W * 0.44 * k, y: ry + 0.4 },
      ],
      { w: 0.6, seed: 4, taper: [0.15, 0.15], press: 0.2 },
    );
  }
  const sweep = (rc.t * 0.4 + d.r.pp.uid * 0.17) % 1;
  if (sweep < 0.3) {
    const gy = -H / 2 + 7 + (sweep / 0.3) * (H - 10);
    const k = Math.sin((sweep / 0.3) * Math.PI) * 1.6;
    s.fillStyle = '#ffffff';
    line(s, -k, gy, k, gy, { w: 0.6, seed: 1, taper: [0.4, 0.4], press: 0 });
    line(s, 0, gy - k, 0, gy + k, { w: 0.6, seed: 2, taper: [0.4, 0.4], press: 0 });
  }
  s.restore();
  if (warn && d.o.emit && Math.random() < 0.4)
    d.o.emit('debris', o.x + 2 + Math.random() * (w - 4), o.y + h * (dy > 0 ? 1 : 0.5), (Math.random() - 0.5) * 20, 10, DEEP);
}

const IRON: HSL = { h: 28, s: 12, l: 24 };
const WAX: HSL = { h: 44, s: 52, l: 86 };
const IRON_INK = inkFor(IRON);
const FLAME: HSL = { h: 36, s: 100, l: 60 };

/** Candle positions across a chandelier W wide (local x). */
function candles(W: number): number[] {
  const n = Math.max(2, Math.round(W / 7));
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(-W / 2 + (W * (i + 0.5)) / n);
  return out;
}

/**
 * The throne hall's chandelier, baked in the slam frame (W across, H along; it falls toward +y): a heavy
 * wrought-iron hoop, candles on scrolled arms above it and iron finials under it, which are the face that
 * comes down on you. The flames are drawn live.
 */
function chandelierHead(W: number, H: number) {
  return sprite(`dr|chand|${W}|${H}`, -W / 2 - 2, -H / 2 - 2, W + 4, H + 4, (g) => {
    const x0 = -W / 2;
    const y0 = -H / 2;
    const bandTop = y0 + H * 0.42;
    const bandH = Math.max(4, H * 0.24);
    const cupY = y0 + H * 0.3;
    // Arms: scrolls up from the hoop to each cup, and the crown ring the chain takes.
    g.fillStyle = inkFor(IRON);
    for (const cx of candles(W))
      stroke(
        g,
        [
          { x: cx * 0.3, y: bandTop + 1 },
          { x: cx * 0.6, y: bandTop - 2.2 },
          { x: cx * 0.95, y: cupY + 2.2 },
          { x: cx, y: cupY + 1 },
        ],
        { w: 1.3, seed: cx, taper: [0.1, 0.1], press: 0.2 },
      );
    stroke(
      g,
      [
        { x: 0, y: bandTop + 1 },
        { x: 0, y: y0 + 0.6 },
      ],
      { w: 1.6, seed: 2, taper: [0.05, 0.05], press: 0.2 },
    );
    // Finials under the hoop.
    const nf = Math.max(3, Math.round(W / 5));
    for (let i = 0; i < nf; i++) {
      const fx = x0 + (W * (i + 0.5)) / nf;
      const mid = i === nf >> 1;
      const tipY = H / 2 - (mid ? 0.2 : 0.8 + (i % 2) * 1.4);
      const hw = mid ? 2 : 1.4;
      const fin = poly(fx - hw, bandTop + bandH - 0.5, fx + hw, bandTop + bandH - 0.5, fx + 0.3, tipY, fx - 0.3, tipY);
      part(g, fin, IRON, i + 3, { depth: 0.4, shade: -8, thin: 0.35, thick: 0.8 });
      g.fillStyle = css(IRON, 30);
      blob(g, fx, bandTop + bandH + (tipY - bandTop - bandH) * 0.35, hw * 0.75, i, 1, 0.1);
      g.fill();
    }
    // The hoop: an iron band, lit along its upper lip, studded.
    const band = boxPts(x0 + 0.4, bandTop, W - 0.8, bandH, 1.6, 9, 0.2);
    part(g, band, IRON, 9, { depth: 1, shade: -10, thin: 0.6, thick: 1.4 });
    g.fillStyle = css(IRON, 26);
    line(g, x0 + 1.6, bandTop + 0.9, -x0 - 1.6, bandTop + 0.9, { w: 0.6, seed: 4, taper: [0.2, 0.2], press: 0.3 });
    for (let x = x0 + 3; x < -x0 - 2; x += 4.5) dot(g, x, bandTop + bandH * 0.58, 0.65, x | 0, css(IRON, 40), inkFor(IRON));
    // Candles in their cups, wax run down one side.
    for (const cx of candles(W)) {
      const top = y0 + 3.2;
      part(g, boxPts(cx - 1.3, top, 2.6, cupY - top, 0.6, cx | 0, 0.1), WAX, cx + 1, { depth: 0.5, shade: -16, thin: 0.3, thick: 0.7 });
      g.fillStyle = css(WAX, 8);
      line(g, cx + 0.9, top + 0.3, cx + 1, top + 2.6, { w: 0.8, seed: cx, taper: [0.1, 0.6], press: 0 });
      const cup = poly(cx - 2.4, cupY - 0.6, cx + 2.4, cupY - 0.6, cx + 1.4, cupY + 1.4, cx - 1.4, cupY + 1.4);
      part(g, cup, IRON, cx + 2, { depth: 0.4, shade: -8, thin: 0.35, thick: 0.8 });
      tick(g, cx, top - 0.1, cx, top - 1.1, 0.4, cx | 0, inkFor(WAX));
    }
  });
}

/** A candle flame: a flat teardrop in two hot tones, leaning. */
function candleFlame(s: CanvasRenderingContext2D, x: number, y: number, lean: number, size: number, seed: number) {
  s.fillStyle = '#ff9a1f';
  path(s, [
    { x: x - 1.1 * size, y },
    { x: x - 0.9 * size, y: y - 1.4 * size },
    { x: x + lean, y: y - 3.2 * size },
    { x: x + 0.9 * size, y: y - 1.4 * size },
    { x: x + 1.1 * size, y },
    { x, y: y + 0.7 * size },
  ]);
  s.fill();
  s.fillStyle = '#fff1b8';
  blob(s, x + lean * 0.3, y - 0.7 * size, 0.6 * size, seed, 1.3, 0.1);
  s.fill();
}

/** The chain, link by link, from the crown (local y0) back up to y1 (< y0). */
function chain(s: CanvasRenderingContext2D, y0: number, y1: number, rattle: number) {
  for (let y = y0, i = 0; y > y1; y -= 2.6, i++) {
    const jx = rattle ? Math.sin(y * 0.9 + rattle) * 0.6 : 0;
    s.fillStyle = IRON_INK;
    if (i % 2) line(s, jx, y, jx, y - 2.8, { w: 1.1, seed: i, taper: [0.1, 0.1], press: 0 });
    else {
      blob(s, jx, y - 1.3, 1.25, i, 1.5, 0.05);
      s.fill();
      s.fillStyle = css(IRON, 12);
      blob(s, jx, y - 1.3, 0.5, i + 1, 1.8, 0.05);
      s.fill();
    }
  }
}

/** Px from (x, y) back against the slam until the first solid tile or the world's edge: where the chain is fixed. */
function anchorDist(level: Level | null, x: number, y: number, dx: number, dy: number): number {
  if (!level) return TILE * 2;
  for (let d = 0; ; d += TILE / 2) {
    const tx = Math.floor((x - dx * d) / TILE);
    const ty = Math.floor((y - dy * d) / TILE);
    if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h || tileAt(level, tx, ty) === T_SOLID) return d;
  }
}

/** Chandelier: hung on its chain from what's above, which snaps when it drops and reels it back up; the flames gutter as it shakes loose and stream back as it falls. */
function drawChandelier(o: Head) {
  const { rc, d, p, dx, dy, w, h, warn, coming } = o;
  const s = rc.s;
  const W = dy !== 0 ? w : h;
  const H = dy !== 0 ? h : w;
  // From the head's back edge at home, against the slam, to the first solid: the chain's fixed end.
  const home = dropperRect(o.m, d.off[0], d.off[1]);
  const back = anchorDist(d.o.level, home.x + home.w / 2 - dx * (W / 2 + 0.5), home.y + home.h / 2 - dy * (H / 2 + 0.5), dx, dy);
  const a = slamFrame(s, o.cx, o.cy, dx, dy);
  const fall = p.state === DROP_FALL;
  if (fall || p.state === DROP_REST) {
    // Snapped: the chain hangs from its anchor to where the crown was, and a stub rides down with it.
    chain(s, -H / 2 - p.d, -H / 2 - back - p.d, 0);
    chain(s, -H / 2 + 1, -H / 2 - 4, 0);
  } else chain(s, -H / 2 + 1, -H / 2 - back - p.d, warn ? rc.frame * 0.9 : 0);
  stamp(s, chandelierHead(W, H));
  const lean = fall ? 0 : warn ? Math.sin(rc.frame * 1.3) * 1.4 : Math.sin(rc.t * 3 + d.r.pp.uid) * 0.3;
  const size = fall ? 1.5 : warn ? 1.15 : 1;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  for (const fx of candles(W)) {
    const fy = -H / 2 + 2.9;
    candleFlame(s, fx, fy, lean, size, fx | 0);
    glowDot(rc.g, o.cx + ca * fx - sa * (fy - 1.5), o.cy + sa * fx + ca * (fy - 1.5), 6, FLAME, 0.5);
  }
  s.restore();
  light(rc, o.cx - dx * (W / 2), o.cy - dy * (H / 2), 60, FLAME, coming ? 0.9 : 0.6);
  if (warn && d.o.emit && Math.random() < 0.3) d.o.emit('spark', o.cx + (Math.random() - 0.5) * W, o.cy - dy * (H / 2), (Math.random() - 0.5) * 20, 20, FLAME);
}

const GRILLE: HSL = { h: 222, s: 9, l: 34 };

/**
 * A portcullis grille in the head's rect, its spiked foot on the slamming face: bars down, cross-bars
 * riveted over them, in iron inked a dark of itself. Baked in the slam frame (W across, H along).
 */
function grille(W: number, H: number) {
  return sprite(`dr|grille|${W}|${H}`, -W / 2 - 2, -H / 2 - 2, W + 4, H + 5, (g) => {
    const ink = inkFor(GRILLE);
    const n = Math.max(2, Math.round(W / 5.5));
    const xs = Array.from({ length: n }, (_, i) => -W / 2 + (W * (i + 0.5)) / n);
    const rows = Math.max(2, Math.round(H / 7));
    const bar = (ax: number, ay: number, bx: number, by: number, w: number, seed: number, l: number) => {
      g.fillStyle = ink;
      line(g, ax, ay, bx, by, { w: w + 0.7, seed, taper: [0.02, 0.02], press: 0 });
      g.fillStyle = css(GRILLE, l);
      line(g, ax, ay, bx, by, { w, seed: seed + 1, taper: [0.02, 0.02], press: 0 });
    };
    for (const [i, x] of xs.entries()) {
      bar(x, -H / 2 + 0.4, x, H / 2 - 2.2, 1.5, i, i % 2 ? 0 : 6);
      // The point at its foot: what comes down on you.
      part(g, poly(x - 1.4, H / 2 - 2.6, x + 1.4, H / 2 - 2.6, x, H / 2 + 0.2), GRILLE, i + 7, { depth: 0.3, shade: -10, thin: 0.25, thick: 0.6 });
    }
    for (let r = 0; r < rows; r++) {
      const y = -H / 2 + 2.2 + ((H - 6) * r) / Math.max(1, rows - 1);
      bar(-W / 2 + 0.6, y, W / 2 - 0.6, y, 1.3, 20 + r, r ? -4 : 4);
      for (const x of xs) dot(g, x, y, 0.55, (x * 7 + r) | 0, css(GRILLE, 22), ink);
    }
  });
}

/**
 * Portcullis: the iron grille of a gate, hung in a slot in the vault. It rattles in its grooves before
 * it comes down, slams on its points and winds back up; the rods it hangs by show over it on the way.
 */
function drawPortcullis(o: Head) {
  const { rc, d, p, dx, dy, w, h, warn } = o;
  const s = rc.s;
  const W = dy !== 0 ? w : h;
  const H = dy !== 0 ? h : w;
  slamFrame(s, o.cx, o.cy, dx, dy);
  // The rods it hangs by, out of the slot it came down from.
  if (p.d > 0.5) for (const x of [-W / 2 + 2.2, W / 2 - 2.2]) tick(s, x, -H / 2 + 0.5, x, -H / 2 - p.d, 1.1, x | 0, inkFor(GRILLE));
  const rattle = warn ? Math.sin(rc.frame * 2.1) * 0.6 : 0;
  stamp(s, grille(W, H), rattle, 0);
  s.restore();
  if (warn && d.o.emit && Math.random() < 0.35)
    d.o.emit('debris', o.cx + (Math.random() - 0.5) * W, o.cy - dy * (H / 2), (Math.random() - 0.5) * 10, 8, GRILLE);
}

const LOOKS: Record<DropperLook, (o: Head) => void> = { icicle: drawIcicle, chandelier: drawChandelier, portcullis: drawPortcullis };

defineArt<'dropper'>({
  type: 'dropper',
  layer: 1,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const p = dropperPose(d.o.state, d.mi, rc.frame);
    const [dx, dy] = dirOf(m.angle);
    const base = dropperRect(m, d.off[0], d.off[1]);
    const warn = p.state === DROP_WARN;
    const shake = warn ? (hash2(rc.frame, d.mi, d.r.pp.uid) - 0.5) * 2.4 : 0;
    const x = base.x + dx * p.d + shake;
    const y = base.y + dy * p.d;
    const { w, h } = base;
    const stone: HSL = { h: d.style.hue, s: 10, l: 46 };
    const coming = warn || p.state === DROP_FALL;
    const hot: HSL = coming ? { h: 0, s: 100, l: 58 } : { h: 50, s: 90, l: 62 };
    // Lane chevrons (where it will land).
    if (p.state !== DROP_FALL && p.state !== DROP_REST) {
      const travel = beamOf(d.o, d.r, d.mi)?.len ?? dropperTravel(d.o.level, m);
      g.strokeStyle = css(hot, 0, warn ? 0.5 : 0.12);
      g.lineWidth = 1;
      for (let k = TILE * 0.8; k < travel; k += TILE) {
        const cx = base.x + base.w / 2 + dx * (k + (dx > 0 ? base.w / 2 : dx < 0 ? -base.w / 2 : 0));
        const cy = base.y + base.h / 2 + dy * (k + (dy > 0 ? base.h / 2 : dy < 0 ? -base.h / 2 : 0));
        g.beginPath();
        g.moveTo(cx - dy * 4 - dx * 2, cy - dx * 4 - dy * 2);
        g.lineTo(cx + dx * 2, cy + dy * 2);
        g.lineTo(cx + dy * 4 - dx * 2, cy + dx * 4 - dy * 2);
        g.stroke();
      }
    }
    if (p.state === DROP_FALL) {
      s.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 1; i < 4; i++) {
        const lx = x + (w * i) / 4;
        const ly = y + (h * i) / 4;
        if (dy !== 0) line(s, lx, y - dy * 4, lx, y - dy * 14, { w: 1, seed: i, taper: [0.1, 0.8], press: 0 });
        else line(s, x - dx * 4, ly, x - dx * 14, ly, { w: 1, seed: i, taper: [0.1, 0.8], press: 0 });
      }
    }
    const cx = x + w / 2;
    const cy = y + h / 2;
    if (m.look) {
      LOOKS[m.look]({ rc, m, d, p, dx, dy, x, y, w, h, cx, cy, warn, coming });
      return;
    }
    stamp(s, block(w, h, stone), x, y);
    // Studs on the slamming face: that's the side that hurts.
    const n = Math.max(2, Math.round((dy !== 0 ? w : h) / 6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const fx = dy !== 0 ? x + w * t : dx > 0 ? x + w - 1.6 : x + 1.6;
      const fy = dy !== 0 ? (dy > 0 ? y + h - 1.6 : y + 1.6) : y + h * t;
      dot(s, fx, fy, 1.05, i, css(d.pal.light), inkFor(stone));
    }
    const k = Math.min(w, h) / TILE;
    rune(s, cx, cy, dx, dy, k, coming ? hot : null, stone);
    if (coming) {
      glowDot(g, cx, cy, 9 * k, hot, 0.4);
      light(rc, cx, cy, 40, hot, 0.5);
    }
    // Grit shaken loose off its underside while it shudders: the creak you can see.
    if (warn && d.o.emit && Math.random() < 0.4) d.o.emit('debris', x + 2 + Math.random() * (w - 4), y + h, (Math.random() - 0.5) * 20, 10, stone);
  },
});
