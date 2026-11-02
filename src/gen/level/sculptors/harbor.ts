import type { Rng } from '../../../core/rng';
import { finish, Grid, hintGap } from '../kit';
import type { Sculptor } from '../types';
import { easyGap, easyRise, H, hardGap, rollChallenges, W } from './common';

type HarborStyle = 'docks' | 'galleon' | 'marina';
type Kind = 'pier' | 'ship' | 'boat' | 'buoys';

/**
 * Harbor: open water at the bottom of the whole map. Stone quays at both
 * ends (bollards, crate stacks), and in between a
 * chain of floating/standing elements separated by water gaps: one-way plank
 * piers on solid posts, a ship hull silhouette (tapered hull, raised
 * forecastle and quarterdeck, masts with one-way yards, diagonal rigging
 * ratlines and a crow's nest), small boats, and buoy hops.
 */
export const harbor: Sculptor = ({ rng, attempt }) => {
  const style = rng.weighted<HarborStyle>([
    ['docks', 3],
    ['galleon', 4],
    ['marina', 2],
  ]);
  const g = new Grid();
  const q = rng.int(17, 20); // quay top row
  const challenges = rollChallenges(rng, 0.4, 0.25, attempt);
  const kinds: Kind[] =
    style === 'galleon'
      ? ['ship']
      : style === 'docks'
        ? rng.shuffle<Kind>(['pier', rng.pick<Kind>(['boat', 'pier'])])
        : rng.shuffle<Kind>(['boat', 'buoys', 'boat']);
  const widths = kinds.map((k) => (k === 'ship' ? rng.int(20, 24) : k === 'pier' ? rng.int(7, 11) : k === 'boat' ? rng.int(6, 8) : rng.int(5, 8)));

  // Lay out: quay | gap | element | gap | ... | quay, fitting the gaps into the slack.
  const nGaps = kinds.length + 1;
  const hardIdx = new Set<number>();
  while (hardIdx.size < Math.min(challenges, nGaps)) hardIdx.add(rng.int(0, nGaps - 1));
  const gaps = Array.from({ length: nGaps }, (_, i) => (hardIdx.has(i) ? hardGap(rng) : easyGap(rng, 2)));
  const inner = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const slack = W - inner;
  if (slack < 12) {
    // Shrink easy gaps / drop the last element until it fits.
    while (kinds.length > 1 && W - (widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0)) < 12) {
      kinds.pop();
      widths.pop();
      gaps.pop();
    }
  }
  const used = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const quayL = Math.max(6, Math.floor((W - used) * rng.range(0.4, 0.6)));
  const quayR = W - used - quayL;
  if (quayR < 6) return finish(g, { row: q - 1 }, { row: q - 1 }, 'harbor:broken'); // validator rejects; next attempt

  const gR = q + rng.int(-2, 1);
  quay(g, rng, 0, quayL - 1, q, 'left');
  quay(g, rng, W - quayR, W - 1, gR, 'right');
  let x = quayL;
  let prevDeck = q;
  for (let i = 0; i < kinds.length; i++) {
    const gap = gaps[i];
    const x0 = x + gap;
    const deck = elementDeck(rng, kinds[i], q);
    if (hardIdx.has(i)) hintGap(g, x, x0 - 1, Math.max(prevDeck, deck));
    const top = stamp(g, rng, kinds[i], x0, widths[i], deck);
    prevDeck = top;
    x = x0 + widths[i];
  }
  if (hardIdx.has(kinds.length)) hintGap(g, x, W - quayR - 1, Math.max(prevDeck, gR));

  return finish(g, { row: q - 1 }, { row: gR - 1 }, `harbor:${style}`);
};

function elementDeck(rng: Rng, kind: Kind, q: number): number {
  switch (kind) {
    case 'ship':
      return q + rng.int(-2, 0);
    case 'pier':
      return q + rng.int(0, 1);
    case 'boat':
      return q + rng.int(1, 2);
    case 'buoys':
      return q + rng.int(1, 3);
  }
}

/** Stamp an element at [x, x+w-1] with deck row `d`; returns the row at its right edge. */
function stamp(g: Grid, rng: Rng, kind: Kind, x: number, w: number, d: number): number {
  const r = x + w - 1;
  switch (kind) {
    case 'pier': {
      g.plank(x, r, d);
      for (let px = x; px <= r; px += rng.int(3, 4)) g.fill(px, d + 1, px, H - 1);
      g.fill(r, d + 1, r, H - 1);
      if (rng.chance(0.6)) g.fill(r, d - 1, r, d - 1); // bollard at the end
      if (rng.chance(0.5)) g.fill(x + 2, d - 2, x + 3, d - 1); // crate
      return d;
    }
    case 'boat': {
      hull(g, x, r, d, 3);
      g.set(x, d - 1, 1);
      g.set(r, d - 1, 1);
      const cab = x + rng.int(2, Math.max(2, w - 5));
      g.fill(cab, d - 2, cab + 2, d - 1); // wheelhouse
      g.plank(cab - 1, cab + 3, d - 3);
      return d;
    }
    case 'buoys': {
      let bx = x;
      let by = d;
      while (bx + 1 <= r) {
        g.plank(bx, bx + 1, by);
        g.set(bx, by + 1, 1);
        bx += 2 + easyGap(rng, 1);
        by = d + rng.int(-1, 1);
      }
      return by;
    }
    case 'ship':
      return ship(g, rng, x, r, d);
  }
}

/** Tapered hull: deck row d, `depth` rows below, each narrower; the bow (right) rakes harder. */
function hull(g: Grid, a: number, b: number, d: number, depth: number): void {
  for (let i = 0; i < depth; i++) g.fill(a + i, d + i, b - Math.round(i * 1.6), d + i);
}

function ship(g: Grid, rng: Rng, a: number, b: number, d: number): number {
  hull(g, a, b, d, rng.int(4, 5));
  // Quarterdeck (stern, left) with a cabin window; forecastle (bow, right).
  const qd = rng.int(2, 3);
  const qw = rng.int(4, 5);
  g.fill(a, d - qd, a + qw - 1, d - 1);
  g.clear(a + 1, d - qd + 1, a + 1, d - qd + 1);
  g.set(a, d - qd - 1, 1); // taffrail
  const fw = rng.int(3, 4);
  g.fill(b - fw + 1, d - 2, b, d - 1);
  g.fill(b + 1, d - 2, b + 2, d - 2); // bowsprit
  g.set(b - fw + 1, d - 3, 1);
  // Mainmast: ratlines (diagonal one-way steps) up to a wide lower yard, a
  // narrower topsail yard, and the masthead poking one tile above it.
  const rise = easyRise();
  const m = Math.min(b - fw - 6, a + qw + 7 + rng.int(0, 2));
  const ly = d - 1 - rise;
  const uy = ly - rise;
  g.fill(m, uy - 1, m, d - 1);
  for (let i = 0; i < rise; i++) g.plank(m - 8 + i, m - 8 + i, d - 1 - i);
  g.plank(m - 5, m + 5, ly);
  g.plank(m - 2, m + 2, uy);
  g.set(m, uy - 2, 2); // pennant
  if (rng.chance(0.6)) {
    // Mizzen stub on the quarterdeck with its own little yard.
    const z = a + 2;
    g.fill(z, d - qd - 3, z, d - qd - 1);
    g.plank(z - 1, z + 1, d - qd - 3);
  }
  return d - 2;
}

/** Stone quay from x0..x1 at row q, with harbor clutter. */
function quay(g: Grid, rng: Rng, x0: number, x1: number, q: number, side: 'left' | 'right'): void {
  g.fill(x0, q, x1, H - 1);
  // Sea wall step down to the water edge.
  const edge = side === 'left' ? x1 : x0;
  g.set(edge, q, 2, true);
  for (let y = q + 1; y < H; y += 3) g.set(edge, y, 0, true);
  const inner = side === 'left' ? [x0 + 5, x1 - 1] : [x0 + 1, x1 - 5];
  if (inner[1] - inner[0] < 1) return;
  const pick = rng.int(0, 2);
  if (pick === 0) {
    const bx = rng.int(inner[0], inner[1]);
    g.set(bx, q - 1, 1); // bollard
  } else if (pick === 1 && inner[1] - inner[0] >= 2) {
    const cx = rng.int(inner[0], inner[1] - 1);
    g.fill(cx, q - 2, cx + 1, q - 1); // crate
    if (rng.chance(0.5)) g.set(cx + rng.int(0, 1), q - 3, 1);
  }
}
