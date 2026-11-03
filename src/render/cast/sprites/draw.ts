import { css, type HSL } from '../../../core/color';
import { inkFor, type P, sn, stroke } from '../../ink';
import { contour, inked, path, toned } from '../../ink-figure';
import { drawFace, type FaceMood } from './face';
import type { Ring, SpriteSet, VFrame } from './types';

/**
 * Draws one traced frame with the cast's own hand (docs/ART.md → World art: ink, `ink-figure.ts`): the
 * silhouette on the body's ink mass with three lifting pen strokes, every part a flat shape on its own
 * mass, thin toward the light and heavy away from it, with a hard sliver of its shade left along the
 * side away from the light (`toned`), then one hard shadow shape over the whole figure, and the cast's
 * face (face.ts) on the traced eyes. The outlines boil on threes like every hand-drawn runner's.
 */

/** How one role is painted on one character. */
export interface Paint {
  fill: string;
  shade: string;
  ink: string;
}

/** A part's pen: its mass toward the light and away from it, and the width of its shade sliver, in world px. */
const PART_THIN = 0.3;
const PART_THICK = 0.72;
const SLIVER = 0.5;
/** A flat kind's pens (lit side, shadow side), world px: the silhouette's, and a part's where two colours meet. */
const FLAT_SIL = [0.3, 0.6];
const FLAT_PART = [0.12, 0.32];
/** An interior line's pen, in world px: lighter than the parts' contours round it. */
const LINE_W = 0.38;
/**
 * A flat kind's interior lines, in one ink: in the ink of the colour they lie on, a line counted on the
 * costume crossed a face in the player's colour.
 */
const LINE_INK = '#2a1f1a';
/** The whole figure's hard shadow: the silhouette less itself pulled up-left (the hand-drawn body's numbers). */
const SHADOW_DX = 2.1;
const SHADOW_DY = 1.9;

export function hexHsl(hex: string): HSL {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

/** A role's paint from its colour: the flat fill, the same colour in shade, and a dark of it for the pen. */
export function paintOf(c: HSL): Paint {
  return { fill: css(c), shade: css(c, -14, 1, 4), ink: inkFor(c) };
}

/** A ring's points in world px (y down), decoded from its base64 int16 eighths. */
export function ringPoints(r: Ring): P[] {
  const bin = atob(r);
  const out: P[] = [];
  for (let i = 0; i + 3 < bin.length; i += 4) {
    const x = ((bin.charCodeAt(i + 1) << 24) | (bin.charCodeAt(i) << 16)) >> 16;
    const y = ((bin.charCodeAt(i + 3) << 24) | (bin.charCodeAt(i + 2) << 16)) >> 16;
    out.push({ x: x / 8, y: y / 8 });
  }
  return out;
}

/** Decoded once per ring, and a buffer per ring for the boiled copy: drawing allocates nothing. */
const decoded = new Map<Ring, P[]>();
const scratch = new Map<Ring, P[]>();

function pointsOf(r: Ring): P[] {
  let p = decoded.get(r);
  if (!p) {
    p = ringPoints(r);
    decoded.set(r, p);
  }
  return p;
}

/** The ring as drawn this tick: each point nudged by a slow boil on threes, into a buffer it owns. */
function boiled(r: Ring, boil: number, seed: number): P[] {
  const src = pointsOf(r);
  let out = scratch.get(r);
  if (!out) {
    out = src.map((q) => ({ x: q.x, y: q.y }));
    scratch.set(r, out);
  }
  for (let i = 0; i < src.length; i++) {
    out[i].x = src[i].x + sn(i * 0.45, boil * 3.1, seed) * 0.16;
    out[i].y = src[i].y + sn(i * 0.45 + 9, boil * 3.1, seed) * 0.16;
  }
  return out;
}

/**
 * One frame with its feet at the origin. `paints` per role, `body` the silhouette's fill and ink, `k`
 * the character's pen weight, `t` seconds for the boil.
 */
export function drawFrame(
  s: CanvasRenderingContext2D,
  f: VFrame,
  paints: readonly Paint[],
  body: Paint,
  shadow: string,
  k: number,
  seed: number,
  t: number,
  face?: { kit: NonNullable<SpriteSet['face']>; mood: FaceMood; facing: number },
  /** The option each accessory slot shows (the first, if not given). */
  pick?: readonly number[],
  /** A kind traced from a flat illustration (`SpriteSet.flat`). */
  flat = false,
) {
  const boil = Math.floor(t * 8) % 3;
  for (const r of f.sil) {
    // Filled with its own ink, not the costume: the parts boil and round apart from the silhouette, and
    // filled in the player's colour the gaps between them showed it round every boot, tool and tail.
    if (flat) inked(s, boiled(r, boil, seed), body.ink, body.ink, FLAT_SIL[0] * k, FLAT_SIL[1] * k);
    else contour(s, boiled(r, boil, seed), body.fill, body.ink, k, seed);
  }
  for (const part of f.parts) {
    const [role, r] = part;
    if (part.length === 4 && (pick?.[part[2]] ?? 0) !== part[3]) continue;
    const p = paints[role];
    if (flat) inked(s, boiled(r, boil, seed + role), p.fill, p.ink, FLAT_PART[0], FLAT_PART[1] * k);
    else toned(s, boiled(r, boil, seed + role), p.fill, p.shade, p.ink, PART_THIN, PART_THICK * k, SLIVER);
  }
  if (f.lines)
    f.lines.forEach(([role, r], i) => {
      s.fillStyle = flat ? LINE_INK : paints[role].ink;
      stroke(s, boiled(r, boil, seed + 40 + i), { w: LINE_W * k, seed: seed + 40 + i, taper: [0.3, 0.45], press: 0.3 });
    });
  for (const r of f.sil) {
    const pts = boiled(r, boil, seed);
    s.save();
    path(s, pts);
    s.clip();
    path(s, pts);
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      if (i) s.lineTo(q.x - SHADOW_DX, q.y - SHADOW_DY);
      else s.moveTo(q.x - SHADOW_DX, q.y - SHADOW_DY);
    }
    s.closePath();
    s.globalCompositeOperation = 'multiply';
    s.fillStyle = shadow;
    s.fill('evenodd');
    s.restore();
  }
  // Motion marks, in the body's ink, trailing what moves fast.
  if (f.marks) {
    s.fillStyle = body.ink;
    f.marks.forEach((r, i) => stroke(s, pointsOf(r), { w: 0.8 - i * 0.12, seed: seed + i, taper: [0.15, 0.6], press: 0.2 }));
  }
  if (face && f.eyes) drawFace(s, face.kit, f.eyes, face.mood, face.facing, t, seed, f.head);
}
