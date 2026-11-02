import type { Rng } from '../../../core/rng';
import { finish, Grid, hintGap } from '../kit';
import type { Sculptor } from '../types';
import { easyGap, easyRise, H, hardGap, rollChallenges, W } from './common';

type RoofStyle = 'downtown' | 'tenements' | 'skyline';

interface Building {
  x: number;
  w: number;
  /** Roof row (top solid row). */
  roof: number;
}

/**
 * Rooftops: a run of buildings of varied heights separated by alleys that
 * drop to the street (the kill pit). Roofs carry parapets, setbacks,
 * cornices, water towers on legs with a ladder rung, chimneys, AC units,
 * antennas, billboards and one-way skylights; taller neighbors get zigzag
 * fire-escape landings on the alley wall so the climb stays honest. A wide
 * alley is the bridge challenge.
 */
export const rooftops: Sculptor = ({ rng, attempt }) => {
  const style = rng.weighted<RoofStyle>([
    ['downtown', 3],
    ['tenements', 3],
    ['skyline', 2],
  ]);
  const g = new Grid();
  const rise = easyRise();
  const challenges = rollChallenges(rng, 0.55, 0.3, attempt);

  // Plan buildings left → right until the map is full.
  const bs: Building[] = [];
  const gaps: { a: number; b: number; hard: boolean }[] = [];
  const sRoof = rng.int(14, 20);
  bs.push({ x: 0, w: rng.int(6, 9), roof: sRoof });
  let hardLeft = challenges;
  const minW = style === 'tenements' ? 4 : 5;
  const maxW = style === 'skyline' ? 12 : style === 'tenements' ? 8 : 10;
  for (;;) {
    const prev = bs[bs.length - 1];
    const end = prev.x + prev.w;
    const remaining = W - end;
    const hard = hardLeft > 0 && rng.chance(0.5 + (remaining < 24 ? 0.5 : 0));
    const gap = hard ? hardGap(rng) : easyGap(rng, style === 'tenements' ? 1 : 2);
    const w = rng.int(minW, maxW);
    let roof = Math.max(8, Math.min(22, prev.roof + rng.int(-5, 5)));
    if (end + gap + w + 7 > W || remaining - gap - w < 6) {
      // Final building holds the goal and runs to the right edge.
      const fx = end + gap;
      if (W - fx < 5) {
        // Not enough room: widen the previous building instead.
        prev.w = W - prev.x;
        break;
      }
      if (hard) hardLeft--;
      if (hard || gap >= 2) gaps.push({ a: end, b: fx - 1, hard });
      bs.push({ x: fx, w: W - fx, roof: hard ? prev.roof + rng.int(-1, 1) : roof });
      break;
    }
    if (hard) {
      roof = prev.roof + rng.int(-1, 1);
      hardLeft--;
    }
    gaps.push({ a: end, b: end + gap - 1, hard });
    bs.push({ x: end + gap, w, roof });
  }

  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    g.fill(b.x, b.roof, b.x + b.w - 1, H - 1);
    // Windows: a regular grid of 1×1 holes reads as a facade.
    if (b.w >= 5) for (let y = b.roof + 3; y < H - 1; y += 3) for (let x = b.x + 1 + (i % 2); x < b.x + b.w - 1; x += 2) g.set(x, y, 0, true);
  }
  for (const gp of gaps) if (gp.hard) hintGap(g, gp.a, gp.b, Math.max(roofAt(bs, gp.a - 1), roofAt(bs, gp.b + 1)));

  // Fire escapes where the next roof is too high to jump to.
  for (let i = 1; i < bs.length; i++) {
    const a = bs[i - 1];
    const b = bs[i];
    if (a.roof - b.roof <= rise - 1) continue;
    let y = a.roof - rise;
    let left = true;
    while (y > b.roof) {
      if (left) g.plank(b.x - 2, b.x - 1, y);
      else g.plank(b.x - 3, b.x - 2, y);
      y -= rise;
      left = !left;
    }
  }

  // Rooftop clutter on interior buildings (not the spawn/goal roofs' pockets).
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    const a = Math.max(b.x, i === 0 ? 6 : b.x);
    const z = Math.min(b.x + b.w - 1, i === bs.length - 1 ? W - 7 : b.x + b.w - 1);
    if (z - a < 1) continue;
    decorate(g, rng, a, z, b.roof, style);
  }

  return finish(g, { row: sRoof - 1 }, { row: bs[bs.length - 1].roof - 1 }, `rooftops:${style}`);
};

function roofAt(bs: Building[], x: number): number {
  for (const b of bs) if (x >= b.x && x < b.x + b.w) return b.roof;
  return H;
}

function decorate(g: Grid, rng: Rng, a: number, z: number, roof: number, style: RoofStyle): void {
  const w = z - a + 1;
  const y = roof - 1;
  // Parapet lips on the roof edges.
  if (rng.chance(0.6)) {
    g.set(a, y, 1);
    g.set(z, y, 1);
  }
  const pick = rng.weighted<string>([
    ['tower', style === 'tenements' ? 3 : 2],
    ['setback', style === 'skyline' ? 3 : 1],
    ['chimneys', style === 'tenements' ? 3 : 1],
    ['ac', 2],
    ['antenna', 1],
    ['billboard', style === 'downtown' ? 2 : 1],
    ['skylight', 2],
  ]);
  const rise = easyRise();
  switch (pick) {
    case 'tower': {
      if (w < 6) return;
      const tx = a + rng.int(1, w - 5);
      // Legs, tank, cone roof; a ladder rung on the left leg.
      g.fill(tx, y - 1, tx, y);
      g.fill(tx + 3, y - 1, tx + 3, y);
      g.fill(tx, y - 4, tx + 3, y - 2);
      g.fill(tx + 1, y - 5, tx + 2, y - 5);
      g.plank(tx - 2, tx - 1, y - 1);
      return;
    }
    case 'setback': {
      if (w < 7) return;
      const h = rng.int(2, rise);
      g.fill(a + 2, y - h + 1, z - 2, y);
      for (let x = a + 3; x < z - 2; x += 2) g.set(x, y - h + 2, 0, true);
      if (rng.chance(0.5)) g.set(a + 3 + rng.int(0, w - 7), y - h, 1); // spire stub
      return;
    }
    case 'chimneys': {
      for (let x = a + 1; x < z; x += rng.int(3, 5)) g.fill(x, y - rng.int(0, 1), x, y);
      return;
    }
    case 'ac': {
      if (w < 4) return;
      const x = a + rng.int(1, w - 3);
      g.fill(x, y, x + 1, y);
      if (rng.chance(0.5)) g.set(x, y - 1, 2);
      return;
    }
    case 'antenna': {
      const x = a + rng.int(0, w - 1);
      g.fill(x, y - 2, x, y);
      g.plank(x - 1, x + 1, y - 2);
      return;
    }
    case 'billboard': {
      if (w < 6) return;
      const x = a + rng.int(1, w - 5);
      const top = y - rise - rng.int(0, 1);
      g.fill(x, top, x + 3, top + 1);
      g.plank(x - 1, x + 4, top - 1);
      return;
    }
    case 'skylight': {
      if (w < 5) return;
      const x = a + rng.int(1, w - 4);
      g.clear(x, roof, x + 2, roof + 2);
      g.fill(x, roof, x + 2, roof, 2, true);
      return;
    }
  }
}
