import type { Ball } from '../settings';
import type { Traced } from './trace';

/**
 * The spin ball, drawn the way the genre draws it rather than as a figure tucked and rolled: a round body
 * in the kind's own colour with quills swept back against the spin, one sneaker showing at the rim, and
 * motion marks trailing behind. Each frame turns it on by `360 / frames` degrees; the game inks it with
 * the same pen as everything else.
 */
export function ballFrames(b: Ball, names: string[], frames: number, facing: 'r' | 'l'): Traced[] {
  const role = (n: string) => {
    const i = names.indexOf(n);
    if (i < 0) throw new Error(`ball: no role "${n}"`);
    return i;
  };
  const dir = facing === 'r' ? 1 : -1;
  const cy = -b.at;
  const out: Traced[] = [];
  const q = (v: number) => Math.round(v * 16) / 16;
  for (let f = 0; f < frames; f++) {
    // A forward roll: clockwise facing right. Quills sweep back against it.
    const spin = dir * (f / frames) * Math.PI * 2;
    const ring: number[] = [];
    const n = b.quills;
    for (let k = 0; k < n; k++) {
      const a0 = spin + (k / n) * Math.PI * 2;
      const width = ((Math.PI * 2) / n) * 0.55;
      // Round body between quills.
      for (let j = 0; j <= 4; j++) {
        const a = a0 + (width * j) / 4 - Math.PI * 2 * (0.45 / n);
        ring.push(q(Math.cos(a) * b.r), q(cy + Math.sin(a) * b.r));
      }
      // The quill: out and swept back against the spin.
      const tip = a0 + width * 0.5 - dir * 0.55;
      ring.push(q(Math.cos(tip) * b.r * b.reach), q(cy + Math.sin(tip) * b.r * b.reach));
    }
    if (facing === 'l') {
      // Keep the ring clockwise on screen after the mirror's turn the other way.
      const back: number[] = [];
      for (let i = ring.length - 2; i >= 0; i -= 2) back.push(ring[i], ring[i + 1]);
      ring.splice(0, ring.length, ...back);
    }
    const disc = (x: number, y: number, rx: number, ry: number, rot: number) => {
      const r: number[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const px = Math.cos(a) * rx;
        const py = Math.sin(a) * ry;
        r.push(q(x + px * Math.cos(rot) - py * Math.sin(rot)), q(y + px * Math.sin(rot) + py * Math.cos(rot)));
      }
      return r;
    };
    // The belly's pale band, and one sneaker turning with the ball.
    const belly = spin + Math.PI * 0.75 * dir;
    const shoe = spin + Math.PI * 0.2 * dir;
    const parts = [
      { role: role(b.body), ring, depth: 2 },
      { role: role(b.belly), ring: disc(Math.cos(belly) * b.r * 0.42, cy + Math.sin(belly) * b.r * 0.42, b.r * 0.42, b.r * 0.3, belly), depth: 1 },
      { role: role(b.shoe), ring: disc(Math.cos(shoe) * b.r * 0.86, cy + Math.sin(shoe) * b.r * 0.86, b.r * 0.34, b.r * 0.22, shoe), depth: 0 },
    ];
    // Motion marks: arcs trailing behind, the longest nearest the ball.
    const marks: number[][] = [];
    for (let m = 0; m < 3; m++) {
      const r = b.r * (1.18 + m * 0.18);
      const span = 1.1 - m * 0.3;
      const mid = Math.PI + (m - 1) * 0.35;
      const arc: number[] = [];
      for (let i = 0; i <= 6; i++) {
        const a = mid - span / 2 + (span * i) / 6;
        arc.push(q(dir * Math.cos(a) * r), q(cy + Math.sin(a) * r));
      }
      marks.push(arc);
    }
    out.push({ sil: [ring], parts, eyes: [], marks });
  }
  return out;
}
