import { css } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { blob, type P, stroke } from '../../ink';
import { inkLoop } from '../../ink-parts';
import { INK, path } from '../../ink-props';
import type { MetalPalette, RC } from '../../kit';
import { whoosh } from '../ink-motion';

/**
 * A circular saw blade, cut live so its light holds still while it spins: hooked teeth on a honed bright
 * rim, a darker blued body with expansion slots, an arbor nut, and motion lines trailing round it. The
 * outline is turned into a reused buffer each frame, so a spinning blade allocates nothing.
 */

const teethCache = new Map<string, P[]>();

/** The blade's outline at rest: a long back rising to a hooked tip, a short drop into a round gullet. */
function teeth(R: number, n: number, seed: number): P[] {
  const key = `${R.toFixed(2)}:${n}:${seed}`;
  let pts = teethCache.get(key);
  if (pts) return pts;
  pts = [];
  const step = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const a = i * step;
    const tip = R * (1 + 0.04 * (hash2(i, 1, seed) - 0.5));
    const root = R * 0.78;
    const at = (u: number, r: number) => pts!.push({ x: Math.cos(a + step * u) * r, y: Math.sin(a + step * u) * r });
    at(0, root);
    at(0.18, root + (tip - root) * 0.25);
    at(0.5, root + (tip - root) * 0.7);
    at(0.78, tip);
    at(0.8, root + (tip - root) * 0.55);
    at(0.88, root * 0.97);
  }
  if (teethCache.size > 64) teethCache.clear();
  teethCache.set(key, pts);
  return pts;
}

const buf: P[] = [];
const ring: P[] = [];

function turned(src: readonly P[], x: number, y: number, rot: number, k = 1): P[] {
  const c = Math.cos(rot) * k;
  const s = Math.sin(rot) * k;
  for (let i = 0; i < src.length; i++) {
    const q = buf[i] ?? (buf[i] = { x: 0, y: 0 });
    q.x = x + src[i].x * c - src[i].y * s;
    q.y = y + src[i].x * s + src[i].y * c;
  }
  buf.length = src.length;
  return buf;
}

function circlePts(x: number, y: number, r: number, n: number): P[] {
  for (let i = 0; i < n; i++) {
    const q = ring[i] ?? (ring[i] = { x: 0, y: 0 });
    const a = (i / n) * Math.PI * 2;
    q.x = x + Math.cos(a) * r;
    q.y = y + Math.sin(a) * r;
  }
  ring.length = n;
  return ring;
}

export function sawBlade(rc: RC, x: number, y: number, R: number, rot: number, pal: MetalPalette, seed: number, stripes: boolean, spin: number) {
  const s = rc.s;
  const n = Math.max(10, Math.round(R * 1.15));
  const pts = turned(teeth(R, n, seed), x, y, rot);
  // The honed rim: bright steel with a hard shadow down the lower right that stays put.
  s.fillStyle = '#7e8696';
  path(s, pts);
  s.fill();
  s.save();
  s.clip();
  s.fillStyle = '#e3e8ef';
  s.translate(-R * 0.1, -R * 0.12);
  path(s, pts);
  s.fill();
  s.restore();
  // The blued body inside the rim, two tones of its own.
  const body = circlePts(x, y, R * 0.74, 22);
  s.fillStyle = css(pal.dark, 10, 1, 6);
  path(s, body);
  s.fill();
  s.save();
  s.clip();
  s.fillStyle = css(pal.base, -6, 1, 10);
  s.beginPath();
  s.arc(x - R * 0.14, y - R * 0.16, R * 0.74, 0, Math.PI * 2);
  s.fill();
  // Expansion slots, turning: a short cut in from the rim ending in a round hole.
  s.fillStyle = INK;
  for (let i = 0; i < 4; i++) {
    const a = rot + (i / 4) * Math.PI * 2 + 0.4;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const w = Math.max(0.5, R * 0.05);
    s.beginPath();
    s.moveTo(x + c * R * 0.75 - sn * w, y + sn * R * 0.75 + c * w);
    s.lineTo(x + c * R * 0.5 - sn * w, y + sn * R * 0.5 + c * w);
    s.lineTo(x + c * R * 0.5 + sn * w, y + sn * R * 0.5 - c * w);
    s.lineTo(x + c * R * 0.75 + sn * w, y + sn * R * 0.75 - c * w);
    s.fill();
    blob(s, x + c * R * 0.49, y + sn * R * 0.49, Math.max(0.7, R * 0.08), i + seed, 1, 0.1);
    s.fill();
  }
  if (stripes) {
    // Hazard paint round the body.
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * Math.PI * 2;
      s.fillStyle = i % 2 ? '#1b1a18' : 'rgb(246 196 38)';
      s.beginPath();
      s.arc(x, y, R * 0.66, a, a + Math.PI / 4);
      s.arc(x, y, R * 0.56, a + Math.PI / 4, a, true);
      s.fill();
    }
  }
  s.restore();
  // The arbor: a washer and a nut.
  s.fillStyle = INK;
  blob(s, x + 0.2, y + 0.25, R * 0.27, seed + 4, 1, 0.05);
  s.fill();
  s.fillStyle = css(pal.light, -8);
  blob(s, x, y, R * 0.22, seed + 5, 1, 0.05);
  s.fill();
  s.fillStyle = css(pal.base, -16);
  const nut = turned(circlePts(0, 0, R * 0.13, 6), x + R * 0.03, y + R * 0.04, rot);
  path(s, nut);
  s.fill();
  // Ink: heavy away from the light, a thinner line round the body.
  const out = turned(teeth(R, n, seed), x, y, rot);
  s.fillStyle = INK;
  inkLoop(s, out, x, y, seed, 0.6, 1.6, 4);
  s.fillStyle = css(pal.dark, -30, 0.9);
  stroke(s, circlePts(x, y, R * 0.75, 22).concat(ring[0]), { w: 0.6, seed: seed + 9, taper: [0.2, 0.2], press: 0.4 });
  // Motion lines trailing the spin, fixed around the blade.
  if (spin) {
    const back = Math.sign(spin);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.09 + ((rc.frame >> 2) % 3) * 0.7;
      whoosh(s, x, y, R + 2.2, a, back * 1.1, k === 1 ? 1 : 1.25, k === 1 ? INK : 'rgba(250,250,255,0.92)', seed + k);
    }
  }
}
