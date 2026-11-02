import { css, type HSL } from '../../../core/color';
import { LOB_OFF, LOB_WARN, lobCycle, lobFlight, lobPoint, lobRadius, lobSegs, type ModuleOf } from '../../../sim/props';
import { blob, line } from '../../ink';
import { INK } from '../../ink-props';
import { circle, ellipse, glowDot, light, type RC } from '../../kit';
import { type DrawCtx, defineArt } from '../common';

/**
 * A lob (sim/props/modules/lob.ts): the volcano's magma serpent and its volcanic bombs, drawn from the sim's
 * own cycle and arc, so each segment is drawn on the very circle that kills. Both warn in the world before
 * anything flies: the serpent's lava boils and swells where it will leap and rings where it will dive;
 * a bomb's shadow grows on the spot it will land and a spark streaks high above it. Molten things glow;
 * the crust between the cracks doesn't. No face on the serpent: a blunt molten head, crust plates and a
 * tapering tail.
 */

type Lob = ModuleOf<'lob'>;

const LAVA: HSL = { h: 20, s: 100, l: 52 };
const HOT: HSL = { h: 44, s: 100, l: 66 };
const CRUST: HSL = { h: 12, s: 22, l: 14 };

/** Where the arc leaves and lands (px), with the prop's motion. */
function ends(m: Lob, d: DrawCtx) {
  return { a: lobPoint(m, 0, d.off[0], d.off[1]), b: lobPoint(m, 1, d.off[0], d.off[1]) };
}

/** Lava swelling and boiling at (x, y) as a warning, `k` 0..1 through it. */
function boil(rc: RC, x: number, y: number, k: number, r: number, seed: number) {
  const s = rc.s;
  const n = 3 + Math.round(k * 4);
  for (let i = 0; i < n; i++) {
    const p = (rc.frame * 0.05 + i / n + seed * 0.13) % 1;
    const bx = x + Math.sin(i * 2.3 + seed) * r * (0.6 + 0.5 * k);
    const by = y - p * r * (0.6 + k);
    const br = (1.2 + 1.8 * (1 - p)) * (0.6 + k * 0.6);
    s.fillStyle = INK;
    circle(s, bx, by, br + 0.6);
    s.fillStyle = css(i % 2 ? HOT : LAVA, 0);
    circle(s, bx, by, br);
  }
  // The swell: a mound of lava pushing up the surface.
  s.fillStyle = INK;
  ellipse(s, x, y, r * (0.8 + 0.6 * k) + 0.8, 1.6 + 2.4 * k + 0.8);
  s.fillStyle = css(LAVA, 6);
  ellipse(s, x, y, r * (0.8 + 0.6 * k), 1.6 + 2.4 * k);
  glowDot(rc.g, x, y - 2, r * 2.4, LAVA, 0.35 + 0.45 * k);
  light(rc, x, y - 4, 44 + 30 * k, LAVA, 0.4 + 0.5 * k);
}

/** A ring on the lava where the serpent will dive back in. */
function ring(rc: RC, x: number, y: number, k: number, r: number) {
  const s = rc.s;
  s.fillStyle = css(HOT, 0, 0.4 + 0.5 * k);
  const pts = 18;
  for (let i = 0; i < pts; i += 2) {
    const a0 = (i / pts) * Math.PI * 2 + rc.frame * 0.04;
    const a1 = ((i + 1) / pts) * Math.PI * 2 + rc.frame * 0.04;
    const rr = r * (1.4 - 0.4 * k);
    line(s, x + Math.cos(a0) * rr, y + Math.sin(a0) * rr * 0.35, x + Math.cos(a1) * rr, y + Math.sin(a1) * rr * 0.35, {
      w: 1.1,
      seed: i,
      taper: [0.2, 0.2],
      press: 0,
    });
  }
}

/** One molten segment: ink, crust plates, glowing seams between them. The head is blunt and blank. */
function segment(rc: RC, x: number, y: number, r: number, i: number, heading: number, head: boolean) {
  const s = rc.s;
  s.fillStyle = INK;
  blob(s, x, y, r + 1.1, 17 + i, 1, 0.08);
  s.fill();
  s.fillStyle = css(LAVA, -4);
  blob(s, x, y, r, 17 + i, 1, 0.08);
  s.fill();
  // Crust plates riding the back, cracks of lava between them.
  const nx = -Math.sin(heading);
  const ny = Math.cos(heading);
  for (let k = -1; k <= 1; k++) {
    const px = x - nx * r * 0.35 + Math.cos(heading) * k * r * 0.5;
    const py = y - ny * r * 0.35 + Math.sin(heading) * k * r * 0.5;
    s.fillStyle = css(CRUST, k * 3);
    blob(s, px, py, r * 0.42, 31 + i * 3 + k, 1, 0.25);
    s.fill();
  }
  if (head) {
    // The blunt nose: hottest, with the drip it trails.
    s.fillStyle = css(HOT, 4);
    blob(s, x + Math.cos(heading) * r * 0.45, y + Math.sin(heading) * r * 0.45, r * 0.38, 5, 1, 0.1);
    s.fill();
  }
  glowDot(rc.g, x, y, r * 2.6, LAVA, head ? 0.75 : 0.5);
}

function serpent(rc: RC, m: Lob, d: DrawCtx) {
  const c = lobCycle(m, rc.frame, d.r.phase);
  const { a, b } = ends(m, d);
  const r = m.radius;
  if (c.seg === LOB_WARN) {
    const k = c.t / Math.max(1, c.len);
    boil(rc, a[0], a[1], k, r * 1.4, 1);
    if (k > 0.5) ring(rc, b[0], b[1], (k - 0.5) * 2, r * 1.4);
    return;
  }
  if (c.seg === LOB_OFF) {
    // The splash where the tail went in settles.
    if (c.t < 20) ring(rc, b[0], b[1], 1 - c.t / 20, r * 1.6);
    return;
  }
  const segs = lobSegs(m, rc.frame, d.r.phase);
  // The tail draws first, so the head overlaps it; a lit drip falls off between segments.
  for (let n = segs.length - 1; n >= 0; n--) {
    const sg = segs[n];
    const [x, y] = lobPoint(m, sg.u, d.off[0], d.off[1]);
    const [x2, y2] = lobPoint(m, Math.min(1, sg.u + 0.02), d.off[0], d.off[1]);
    segment(rc, x, y, lobRadius(m, sg.i), sg.i, Math.atan2(y2 - y, x2 - x), sg.i === 0);
  }
  // Still pouring out of the lava where it leapt, and splashing where it dives.
  if (c.t < m.flight * 0.25 + (m.count - 1) * m.lag) boil(rc, a[0], a[1], 0.6, r * 1.2, 2);
  if (c.t > m.flight * 0.75) ring(rc, b[0], b[1], 0.8, r * 1.5);
  const head = segs[0];
  if (head) {
    const [x, y] = lobPoint(m, head.u, d.off[0], d.off[1]);
    light(rc, x, y, 70, LAVA, 0.9);
  }
}

/** The bomb's shadow on the ground it will land on: grows through the warning and the fall. */
function shadow(rc: RC, x: number, y: number, k: number, r: number) {
  rc.s.fillStyle = `rgba(20,8,6,${0.25 + 0.4 * k})`;
  ellipse(rc.s, x, y, r * (0.5 + 1.2 * k), 1.2 + 1.8 * k);
  // A tick of hot light at its middle in the last moments: the telegraph, flat and bright.
  if (k > 0.7) {
    rc.s.fillStyle = css(HOT, 0, (k - 0.7) * 2.6);
    ellipse(rc.s, x, y, r * 0.5 * k, 0.9);
  }
}

function bomb(rc: RC, m: Lob, d: DrawCtx) {
  const c = lobCycle(m, rc.frame, d.r.phase);
  const { a, b } = ends(m, d);
  const r = m.radius;
  const gy = b[1] + r;
  const fl = lobFlight(m);
  if (c.seg === LOB_WARN) {
    const k = c.t / Math.max(1, c.len);
    shadow(rc, b[0], gy, k * 0.6, r);
    // The spark high above where it comes from.
    const sx = a[0] + (b[0] - a[0]) * 0.08;
    const sy = Math.max(a[1], 6) + 4;
    rc.s.fillStyle = css(HOT, 8, 0.5 + 0.5 * k);
    circle(rc.s, sx, sy, 1 + 1.5 * k);
    glowDot(rc.g, sx, sy, 8 + 8 * k, LAVA, 0.5 * k);
    return;
  }
  if (c.seg === LOB_OFF) {
    // Embers and a scorch where it hit, fading.
    if (c.t < 36) {
      const k = 1 - c.t / 36;
      rc.s.fillStyle = `rgba(20,8,6,${0.5 * k})`;
      ellipse(rc.s, b[0], gy, r * 2.2, 2.2);
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI + (i / 5) * Math.PI;
        const dd = (1 - k) * r * 3.2;
        rc.s.fillStyle = css(i % 2 ? HOT : LAVA, 0, k);
        circle(rc.s, b[0] + Math.cos(ang) * dd, gy + Math.sin(ang) * dd * 0.6 - 2 * k, 1 + k);
      }
      glowDot(rc.g, b[0], gy - 3, r * 4, LAVA, 0.7 * k);
      light(rc, b[0], gy - 4, 90, LAVA, k);
    }
    return;
  }
  shadow(rc, b[0], gy, 0.6 + 0.4 * (c.t / fl), r);
  for (const sg of lobSegs(m, rc.frame, d.r.phase)) {
    const [x, y] = lobPoint(m, sg.u, d.off[0], d.off[1]);
    const [px, py] = lobPoint(m, Math.max(0, sg.u - 0.12), d.off[0], d.off[1]);
    // Its smoke trail, soft on the background.
    for (let i = 1; i <= 4; i++) {
      const t = i / 4;
      rc.bg.fillStyle = `rgba(70,58,54,${0.28 * (1 - t)})`;
      circle(rc.bg, x + (px - x) * t, y + (py - y) * t, r * (0.6 + t));
    }
    const rr = lobRadius(m, sg.i);
    rc.s.fillStyle = INK;
    blob(rc.s, x, y, rr + 1.1, 7, 1, 0.22);
    rc.s.fill();
    rc.s.fillStyle = css(CRUST, 4);
    blob(rc.s, x, y, rr, 7, 1, 0.22);
    rc.s.fill();
    // Glowing cracks across the rock.
    rc.s.fillStyle = css(HOT, 0);
    line(rc.s, x - rr * 0.6, y - rr * 0.2, x + rr * 0.1, y + rr * 0.15, { w: 1, seed: 3, taper: [0.2, 0.3], press: 0 });
    line(rc.s, x + rr * 0.1, y + rr * 0.15, x + rr * 0.5, y - rr * 0.45, { w: 0.9, seed: 4, taper: [0.2, 0.3], press: 0 });
    glowDot(rc.g, x, y, rr * 2.6, LAVA, 0.6);
    light(rc, x, y, 60, LAVA, 0.7);
  }
}

defineArt<'lob'>({
  type: 'lob',
  layer: 2,
  draw: (rc, m, d) => {
    if (!d.o.level) return;
    if (m.look === 'bomb') bomb(rc, m, d);
    else serpent(rc, m, d);
  },
});

