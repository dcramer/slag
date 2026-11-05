import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { PlacedProp } from '../../sim/props';
import { type Grid, T_EMPTY, T_ONEWAY } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { makeStyle, type Piece, type Site } from '../setpieces/place';
import { berthMax, climb, digBerth, fitsWith, footing, structureCols, structureOf, trial } from './harbor-kit';
import { defineConcept } from './contract';
import type { Landmark } from './types';

/**
 * Galleon at Berth (docs/SETPIECES.md, Harbor): a whole ship moored past the berth, run deck by deck. It is
 * grand: on a classic level the berth and the ship take two thirds of the width, on a wide one the ship
 * alone can run forty columns.
 *
 * Its main deck is level with the quay, so you cross the berth onto it. From there, three ways to the far
 * end: along the main deck (over the bitts, under whatever the castles fire down it), down a hatch into the
 * gun deck and along under everything, or up into the rigging, yard to yard. A castle stands at each end, the
 * forecastle low and the quarterdeck high (its great cabin a room you go through, or a block you climb), and
 * which end is the bow is the seed's. So are the ship's length, its masts and their yards, the gun deck's
 * height, where the hatches open, whether the stern carries a poop deck, and which guns it mounts: a stern
 * chaser lobbing balls down the deck, a harpoon gun on the forecastle, or both.
 *
 * Nothing floats: the hull runs down to the sea floor, raked toward the keel, and the masts (drawn behind) carry
 * their yards a jump apart, each resting on the one below or on the deck.
 */

/** Rows the main deck's bitts stand: a hop, so the deck is the way over and not a wall. */
const BITTS = 1;

/** Where the ship's parts are, for the pieces and the tests. */
export interface Galleon {
  G: number;
  sx: number;
  ex: number;
  /** The bow is at the near (spawn) end. */
  bowNear: boolean;
  /** Gun deck air rows G+1..G+gd, its floor at G+gd+1; interior columns gx0..gx1. */
  gd: number;
  gx0: number;
  gx1: number;
  /** The two hatches' left columns (each 2 wide). */
  hatches: [number, number];
  /** Castles: columns and the row their top stands on (stand row = top - 1). */
  near: { x0: number; x1: number; top: number; cabin: boolean };
  far: { x0: number; x1: number; top: number; cabin: boolean };
  masts: number[];
  /** Top yard row per mast. */
  yards: number[];
}

/** The great cabin's air: three rows under the quarterdeck. */
const CABIN = 3;

function buildGalleon(g: Grid, rng: Rng, at: { x: number; y: number; w: number; h: number }, parts: number): Landmark {
  const G = at.y + at.h;
  const s = structureOf(at);
  const sx = s.x;
  const ex = s.x + s.w - 1;
  const L = s.w;
  const H = g.h;
  // Yards a comfortable jump apart.
  const r = Math.max(3, Math.min(4, climb()));
  const bowNear = rng.chance(0.5);
  g.clear(sx, 0, ex, H - 1);
  // The hull, main deck to sea floor.
  footing(g, sx, ex, G);
  // The gun deck under the main deck: three or four rows, never more than a jump out of its hatches.
  const gd = Math.max(2, Math.min(rng.int(3, 4), H - 3 - G, jumpProfile().rise - 2));
  const gx0 = sx + 3;
  const gx1 = ex - 3;
  g.clear(gx0, G + 1, gx1, G + gd);
  // Raked toward the keel, the bow harder than the stern; the middle runs to the sea floor.
  const keel = G + gd + 2;
  for (let y = keel; y < H; y++) {
    const j = y - keel + 1;
    const bow = Math.min(Math.floor(j * 1.4), Math.floor(L / 3));
    const stern = Math.min(Math.floor(j * 0.6), Math.floor(L / 4));
    const [a, b] = bowNear ? [bow, stern] : [stern, bow];
    if (a > 0) g.clear(sx, y, sx + a - 1, y);
    if (b > 0) g.clear(ex - b + 1, y, ex, y);
  }

  // Castles: the forecastle two rows over the deck, the quarterdeck four (its great cabin three rows of air),
  // perhaps a poop deck two more over its outer half. A strip of deck at the near end stays level with the quay.
  const fw = Math.min(rng.int(3, 5), Math.floor(L / 5));
  const qw = Math.min(rng.int(5, 8), Math.floor(L / 3));
  const [nw, fwid] = bowNear ? [fw, qw] : [qw, fw];
  const near = { x0: sx + 3, x1: sx + 2 + nw, top: G - (bowNear ? 2 : CABIN + 1), cabin: false };
  const far = { x0: ex - fwid + 1, x1: ex, top: G - (bowNear ? CABIN + 1 : 2), cabin: false };
  const quarter = bowNear ? far : near;
  const fore = bowNear ? near : far;
  g.fill(fore.x0, fore.top, fore.x1, G - 1, 1, true);
  g.fill(quarter.x0, quarter.top, quarter.x1, G - 1, 1, true);
  quarter.cabin = qw >= 6 && rng.chance(0.65);
  if (quarter.cabin) {
    // The great cabin: a door on the waist side; at the near end a door on the quay side too, so you walk
    // through it, and at the far end a hatch in its roof by the stern windows, so you climb out of it.
    g.clear(quarter.x0, G - CABIN, quarter.x1, G - 1);
    if (bowNear) {
      g.fill(quarter.x1, quarter.top, quarter.x1, G - 1, 1, true);
      const hx = quarter.x0 + 2;
      g.clear(hx - 1, quarter.top, hx, quarter.top);
      g.set(hx, G - 2, T_ONEWAY, true);
    }
  }
  if (rng.chance(0.5) && qw >= 6) {
    // The poop deck over the stern half of the quarterdeck.
    const half = Math.ceil(qw / 2);
    const [a, b] = bowNear ? [quarter.x1 - half + 1, quarter.x1] : [quarter.x0, quarter.x0 + half - 1];
    g.fill(a, quarter.top - 2, b, quarter.top - 1, 1, true);
  }

  // The waist, between the castles: hatches down to the gun deck near both ends, a rung under each.
  const wa = near.x1 + 1;
  const wb = far.x0 - 1;
  const ha = Math.max(gx0, wa + rng.int(0, 1));
  const hb = Math.min(gx1 - 1, wb - 1 - rng.int(0, 1));
  for (const hx of [ha, hb]) {
    g.clear(hx, G, hx + 1, G);
    g.set(hx + (hx === ha ? 1 : 0), G + Math.ceil(gd / 2), T_ONEWAY, true);
  }

  // Masts in the waist, evenly with a little play, each carrying yards a comfortable jump apart.
  const waist = wb - wa + 1;
  const n = Math.max(1, Math.min(3, Math.floor((waist - 2) / 6) + (rng.chance(0.3) ? -1 : 0)));
  const masts: number[] = [];
  const yards: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = wa + Math.round(((i + 0.5) * waist) / n) + rng.int(-1, 1);
    const mx = Math.max(wa + 2, Math.min(wb - 2, c));
    if (masts.some((m) => Math.abs(m - mx) < 4)) continue;
    masts.push(mx);
    const half = Math.max(2, Math.min(4, Math.floor(waist / (2 * n)) + rng.int(-1, 0)));
    let top = G;
    for (let k = 1, w = half; k <= 3 && w >= 1; k++, w--) {
      // The lowest yard a jump over the castles' tops, the rest a jump apart over it.
      const y = G - 1 - k * r;
      if (y < at.y + 2) break;
      for (let x = Math.max(wa, mx - w); x <= Math.min(wb, mx + w); x++) if (g.get(x, y) === T_EMPTY) g.set(x, y, T_ONEWAY, true);
      top = y;
    }
    yards.push(top);
    // A ratline step up to the lower yard from the deck, at its end away from the hatches.
    const step = mx + (mx < (wa + wb) / 2 ? -half - 1 : half + 1);
    if (top < G && step > wa && step < wb && Math.abs(step - ha - 0.5) > 1.5 && Math.abs(step - hb - 0.5) > 1.5)
      g.set(step, G - 1 - Math.ceil(r / 2), T_ONEWAY, true);
    // The bitts at the mast's foot.
    if (rng.chance(0.6) && mx !== ha && mx !== ha + 1 && mx !== hb && mx !== hb + 1) g.fill(mx, G - BITTS, mx, G - 1, 1, true);
  }

  digBerth(g, rng, at, parts);
  const plan: Galleon = { G, sx, ex, bowNear, gd, gx0, gx1, hatches: [ha, hb], near, far, masts, yards };
  const top = Math.min(...yards, near.top - 2, far.top - 2);
  return {
    concept: 'galleon',
    rect: { x: sx, y: Math.max(0, top - 2), w: L, h: H - Math.max(0, top - 2) },
    air: [
      // The waist over the deck and the gun deck stay clear of lanes, filler and decor.
      { x: wa, y: top, w: Math.max(1, waist), h: G - top },
      { x: gx0, y: G + 1, w: gx1 - gx0 + 1, h: gd },
    ],
    anchors: {
      exit: [ex, G],
      deck: [sx, G],
      span: [sx, ex],
      gun: [G + gd, gd],
      hatches: plan.hatches,
      near: [near.x0, near.x1],
      nearTop: [near.top, near.cabin ? 1 : 0],
      far: [far.x0, far.x1],
      farTop: [far.top, far.cabin ? 1 : 0],
      bow: [bowNear ? 1 : 0, 0],
      ...Object.fromEntries(masts.map((m, i) => [`mast${i}`, [m, yards[i]] as Vec])),
    },
    skin: 'planks',
  };
}

const TIMBER = (rng: Rng) => makeStyle(rng, ['brass', 'steel'], [20, 0], { woodHue: rng.range(18, 28) });

function* galleonPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [sx, ex] = a.span;
  const G = a.deck[1];
  const prior: PlacedProp[] = [];
  const bowNear = a.bow[0] === 1;
  // The ship's backdrop: masts, furled sails, the stern's windows and lanterns, the gun deck's ribs and guns.
  // A shell claims no cells, so it holds the crow's nest's peak with it.
  const masts = Object.keys(a).filter((k) => k.startsWith('mast'));
  const peak = masts.length ? a[masts[0]] : [Math.floor((sx + ex) / 2), G - 6];
  const shellTop = Math.max(0, l.rect.y - 4);
  const hull: Piece = {
    name: rng.pick(['The Galleon', 'Ship of the Line', 'The Leaky Lady', 'The Flagship']),
    archetype: 'platform',
    role: 'build',
    style: TIMBER(rng),
    modules: [{ type: 'deco', kind: 'hull', at: [sx, shellTop], w: ex - sx + 1, h: s.h - shellTop, seed: rng.int(0, 1 << 20) }],
    extra: [[peak[0], Math.max(0, peak[1] - 2)]],
    pathSafe: true,
  };
  trial(s, prior, hull);
  yield hull;
  // Its guns, the seed's choice: a stern chaser lobbing balls down the deck from the quarterdeck, a harpoon gun
  // on the forecastle firing flat along it, or both. Each goes in only where it fits.
  const [qx0, qx1] = bowNear ? a.far : a.near;
  const [fx0, fx1] = bowNear ? a.near : a.far;
  const qTop = (bowNear ? a.farTop : a.nearTop)[0];
  const fTop = (bowNear ? a.nearTop : a.farTop)[0];
  const guns = rng.pick([['chaser'], ['harpoon'], ['chaser', 'harpoon'], ['chaser', 'harpoon']]);
  for (const gun of guns) {
    const harpoon = gun === 'harpoon';
    const [x0, x1, top] = harpoon ? [fx0, fx1, fTop] : [qx0, qx1, qTop];
    // Aim down the ship: from the castle toward the other end.
    const d: 1 | -1 = (harpoon ? bowNear : !bowNear) ? 1 : -1;
    const y = top - 1;
    const cands: Piece[] = [];
    for (const x of d > 0 ? [x1 - 1, x1 - 2, x1] : [x0 + 1, x0 + 2, x0])
      for (const elev of harpoon ? [0.06, 0.12, 0] : [0.18, 0.1, 0.28])
        cands.push({
          name: harpoon ? rng.pick(['Harpoon Gun', 'Whaler', 'The Long Reach']) : rng.pick(['Stern Chaser', 'Long Nine', 'Deck Gun']),
          archetype: 'launcher',
          role: 'hazard',
          style: TIMBER(rng),
          extra: [[x - d, y]],
          modules: [
            {
              type: 'cannon',
              look: harpoon ? 'harpoon' : 'ship',
              at: [x + 0.5, y + 0.45],
              angle: d > 0 ? -elev : Math.PI + elev,
              ammo: harpoon ? 'arrow' : 'cannonball',
              interval: harpoon ? rng.int(130, 190) : rng.int(160, 230),
              burst: 1,
              speed: harpoon ? rng.int(260, 330) : rng.int(230, 300),
              length: harpoon ? 1.4 : 1.25,
              seed: rng.int(0, 1 << 20),
            },
          ],
        });
    for (const c of cands)
      if (trial(s, prior, c)) {
        yield c;
        break;
      }
  }
}

export const GALLEON = defineConcept({
  id: 'galleon',
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: fitsWith(16),
  ownsCrossing: true,
  family: ['harpoon', 'shore battery', 'whirlpool'],
  budget: 2,
  names: ['The Galleon at {place}', 'The Flagship of {place}', '{place}: All Hands', 'The Ship in {place} Harbour'],
  codex: { about: 'A whole ship at berth with her guns run out. Along the main deck, down a hatch through the gun deck, or up the rigging yard to yard.' },
  box: (k, rng) => ({ w: berthMax() + structureCols(k.W, rng, 18, 22), h: 3 * Math.max(3, Math.min(4, climb())) + 4 }),
  build: buildGalleon,
  pieces: galleonPieces,
  scale: 'grand',
  varies: [
    'which end is the bow',
    'length',
    'masts and their yards',
    'gun deck height',
    'where the hatches open',
    'great cabin or solid quarterdeck',
    'poop deck',
    'its guns: stern chaser, harpoon gun or both',
  ],
});
