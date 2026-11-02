import type { Cell, Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { TileRect } from '../../sim/level';
import type { Module, PlacedProp } from '../../sim/props';
import { type Grid, T_ONEWAY, T_SOLID } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { makeStyle, type Piece, type Site } from '../setpieces/place';
import { capFlood } from './flood';
import { berthMax, climb, digBerth, fitsWith, footing, structureCols, structureOf, trial } from './harbor-kit';
import type { Concept, Landmark } from './types';

/**
 * The harbor's shore landmarks (docs/SETPIECES.md, Harbor), each standing past its berth on the sea floor:
 *
 * - **The Tidal Pier** (grand): a boardwalk on trestles over a beach the tide comes in over, with a breaking
 *   wave running along the sand. The boardwalk is the static way, in sections at the seed's heights; the beach
 *   under it is the quick way while the tide's out.
 * - **The Container Terminal**: stacks of containers under a gantry crane. Through the open containers along
 *   the quay, or over the stacks; the crane's trolley carries a container across above them, and a box hung
 *   from the boom drops on whoever walks under it.
 * - **Lighthouse Rock**: a lighthouse on a rock, its door straight through at the bottom, its stair to a
 *   gallery at the top; the lamp sweeps a beam over the far side on a long dark.
 * - **Kraken Lagoon**: islets in a lagoon under a rope bridge strung between two sea stacks. Hop the islets
 *   between the tentacles that rise out of the water, or walk the bridge over them; through the sea caves in
 *   both stacks either way.
 */

const RAIL = (rng: Rng) => makeStyle(rng, ['steel', 'rust'], [205, 0, 28], { trim: 'stripes', woodHue: rng.range(20, 30) });

/** The near bank and far end every shore landmark has: berth dug, exit at ground level on its far side. */
function frame(at: TileRect): { G: number; sx: number; ex: number; L: number } {
  const s = structureOf(at);
  return { G: at.y + at.h, sx: s.x, ex: s.x + s.w - 1, L: s.w };
}

// ------------------------------------------------------------------------------------------------ tidal pier

/** Columns along a boardwalk where its trestles stand (every few columns from its start): the art draws them there. */
export function trestles(x0: number, x1: number): number[] {
  const out: number[] = [];
  for (let x = x0 + 1; x < x1; x += 4) out.push(x);
  return out;
}

function buildPier(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, sx, ex } = frame(at);
  const H = g.h;
  g.clear(sx, 0, ex, H - 1);
  // Landing stages at both ends, level with the quay; the beach between, two or three rows down.
  footing(g, sx, sx + 2, G);
  footing(g, ex - 2, ex, G);
  const F = Math.min(H - 3, G + rng.int(2, 3));
  const bx0 = sx + 3;
  const bx1 = ex - 3;
  footing(g, bx0, bx1, F);
  // The boardwalk, in sections at their own heights, a jump up from the landing stages; now and then planks are missing.
  const span = ex - sx - 1;
  const n = Math.max(2, Math.min(4, Math.round(span / 9) + rng.int(-1, 0)));
  const hi = Math.max(3, climb());
  let B = G - rng.int(3, Math.max(3, hi));
  let x = sx + 1;
  let low = B;
  const sections: number[] = [];
  for (let i = 0; i < n; i++) {
    const end = i === n - 1 ? ex - 1 : Math.min(ex - 2, sx + 1 + Math.round(((i + 1) * span) / n) + rng.int(-1, 1));
    const hole = i > 0 && rng.chance(0.35) ? 2 : 0;
    for (let c = x + hole; c <= end; c++) g.set(c, B, T_ONEWAY, true);
    sections.push(B);
    low = Math.min(low, B);
    x = end + 1;
    B = Math.max(G - hi, Math.min(G - 3, B + rng.pick([-2, -1, 0, 1, 2])));
  }
  digBerth(g, rng, at, parts);
  return {
    concept: 'tidal-pier',
    rect: { x: sx, y: low - 1, w: ex - sx + 1, h: H - low + 1 },
    // The beach and the air over it, and the boardwalk's headroom.
    air: [
      { x: bx0, y: low + 1, w: bx1 - bx0 + 1, h: F - low - 1 },
      { x: sx, y: low - 3, w: ex - sx + 1, h: 2 },
    ],
    anchors: { exit: [ex, G], deck: [sx, G], span: [sx, ex], beach: [bx0, bx1], floor: [F, low], walk: [sx + 1, ex - 1] },
    skin: 'planks',
  };
}

function* pierPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [bx0, bx1] = l.anchors.beach;
  const [F, low] = l.anchors.floor;
  const [sx, ex] = l.anchors.span;
  const prior: PlacedProp[] = [];
  // The tide over the beach: out most of the time, in for a while, never as high as the boardwalk.
  const tide = capFlood(
    s.level,
    {
      type: 'flood',
      look: 'water',
      at: [bx0, F],
      w: bx1 - bx0 + 1,
      low: 0,
      high: Math.max(1, F - low - 2),
      off: rng.int(260, 360),
      warn: rng.int(70, 90),
      rise: rng.int(110, 150),
      hold: rng.int(90, 140),
      fall: rng.int(110, 150),
    },
    [],
    s.cache,
  );
  // A wave breaking along the sand from one landing stage toward the other, shoving whoever's on the beach.
  const fromFar = rng.chance(0.6);
  const wave: Module = {
    type: 'geyser',
    look: 'water',
    at: [fromFar ? bx1 + 1 : bx0, F - 1],
    angle: fromFar ? Math.PI : 0,
    width: 2,
    length: bx1 - bx0 + 1,
    off: rng.int(170, 240),
    warn: 50,
    on: rng.int(50, 70),
    lethal: false,
    strength: rng.int(2600, 3400),
  };
  const pier: Module = { type: 'deco', kind: 'facade', at: [sx, l.rect.y - 2], w: ex - sx + 1, h: F - l.rect.y + 2, seed: rng.int(0, 1 << 20) };
  const piece: Piece = {
    name: rng.pick(['The Tide', 'High Water', 'The Big Splash', 'Spring Tide']),
    archetype: 'flamer',
    role: 'hazard',
    style: RAIL(rng),
    modules: [pier, ...(tide ? [tide] : []), wave],
    pathSafe: true,
  };
  trial(s, prior, piece);
  yield piece;
}

export const TIDAL_PIER: Concept = {
  id: 'tidal-pier',
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: fitsWith(17),
  ownsCrossing: true,
  family: ['wave', 'crane', 'dock forklift'],
  budget: 2,
  names: ['The Pier at {place}', '{place} Pleasure Pier', 'The Tidal Pier of {place}', '{place}: Mind the Tide'],
  box: (k, rng) => ({ w: berthMax() + structureCols(k.W, rng, 18, 22), h: climb() + 6 }),
  build: buildPier,
  pieces: pierPieces,
};

// ------------------------------------------------------------------------------------------ container terminal

/** Rows of a container's walls: an open one is a roof over two rows of air. */
const OPEN_H = 3;

function buildTerminal(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, sx, ex } = frame(at);
  const H = g.h;
  const r = climb();
  g.clear(sx, 0, ex, H - 1);
  footing(g, sx, ex, G);
  // Stacks of containers along the quay, an open one at the bottom of each (you walk through), closed ones on it.
  const stacks: { x0: number; x1: number; top: number }[] = [];
  let x = sx + 2 + rng.int(0, 1);
  let prev = G;
  while (x + 3 <= ex - 2) {
    const w = Math.min(ex - 2 - x + 1, rng.int(3, 5));
    if (w < 3) break;
    g.fill(x, G - OPEN_H, x + w - 1, G - OPEN_H, T_SOLID, true);
    let top = G - OPEN_H;
    const first = !stacks.length;
    const layers = first ? rng.int(0, 1) : rng.int(1, 3);
    for (let k = 0; k < layers; k++) {
      let ch = rng.int(2, 3);
      if (prev - (top - ch) > r) ch = 2;
      if (prev - (top - ch) > r || G - (top - ch) > (first ? r : 12) || top - ch < at.y + 7) break;
      g.fill(x, top - ch, x + w - 1, top - 1, T_SOLID, true);
      top -= ch;
    }
    stacks.push({ x0: x, x1: x + w - 1, top });
    prev = top;
    x += w + rng.int(1, 2);
  }
  const tallest = Math.min(...stacks.map((st) => st.top));
  // The boom of the gantry crane, five rows over the tallest stack: room to ride its trolley across.
  const K = Math.max(at.y + 1, tallest - 5);
  digBerth(g, rng, at, parts);
  return {
    concept: 'container-terminal',
    rect: { x: sx, y: K - 1, w: ex - sx + 1, h: H - K + 1 },
    air: [{ x: sx + 1, y: K, w: ex - sx - 1, h: tallest - K }],
    anchors: {
      exit: [ex, G],
      deck: [sx, G],
      span: [sx, ex],
      boom: [K, tallest],
      ...Object.fromEntries(stacks.map((st, i) => [`stack${i}`, [st.x0, st.x1] as [number, number]])),
      ...Object.fromEntries(stacks.map((st, i) => [`top${i}`, [st.top, 0] as [number, number]])),
    },
    skin: 'rustplate',
  };
}

function* terminalPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [sx, ex] = a.span;
  const [K] = a.boom;
  const G = a.deck[1];
  const prior: PlacedProp[] = [];
  const stacks: { x0: number; x1: number; top: number }[] = [];
  for (let i = 0; a[`stack${i}`]; i++) stacks.push({ x0: a[`stack${i}`][0], x1: a[`stack${i}`][1], top: a[`top${i}`][0] });
  // The crane behind it all: legs on the quay at both ends, the boom across the top.
  const crane: Piece = {
    name: rng.pick(['Gantry Crane', 'Big Lifter', 'The Ship-to-Shore']),
    archetype: 'platform',
    role: 'build',
    style: RAIL(rng),
    modules: [{ type: 'deco', kind: 'gantry', at: [sx, K - 1], w: ex - sx + 1, h: G - K + 1, seed: rng.int(0, 1 << 20) }],
    extra: [[sx + 1, K - 1]],
    pathSafe: true,
  };
  trial(s, prior, crane);
  yield crane;
  // A box hung from the boom over one end's stack, dropped on whoever walks under it; the trolley takes the rest.
  const dropEnd = rng.chance(0.5) ? stacks.length - 1 : 0;
  const drop = stacks.length > 2 || rng.chance(0.5) ? stacks[dropEnd] : null;
  if (drop) {
    const dx = drop.x0 + Math.floor((drop.x1 - drop.x0 - 1) / 2);
    const cand: Piece = {
      name: rng.pick(['Falling Freight', 'Fragile', 'Special Delivery', 'Cargo Drop']),
      archetype: 'dropper',
      role: 'hazard',
      style: RAIL(rng),
      modules: [
        {
          type: 'dropper',
          cells: [
            [dx, K + 1],
            [dx + 1, K + 1],
          ],
          angle: Math.PI / 2,
          reach: drop.top - K - 2,
          warn: rng.int(28, 38),
          rest: rng.int(60, 90),
          look: 'cargo',
        },
      ],
    };
    if (trial(s, prior, cand)) yield cand;
  }
  // The trolley: a container on the spreader, parked over one stack, run across to another and back.
  const span = stacks.filter((st) => st !== drop);
  if (span.length >= 1) {
    const w = 3;
    const x0 = span[0].x0;
    const x1 = Math.max(x0 + w, span[span.length - 1].x1 - w + 1);
    for (const range of [x1 - x0, Math.floor((x1 - x0) * 0.6)]) {
      if (range < 3) continue;
      const cand: Piece = {
        name: rng.pick(['Crane Trolley', 'Spreader', 'Container on a String']),
        archetype: 'platform',
        role: 'build',
        style: RAIL(rng),
        modules: [
          {
            type: 'body',
            cells: Array.from({ length: w }, (_, i) => [x0 + i, K + 2] as Cell),
            material: 'metal',
            conveyor: 0,
            breakFrames: 0,
            respawnFrames: 0,
          },
        ],
        motion: { type: 'rail', angle: 0, range, period: rng.int(240, 320), dwell: rng.int(60, 90) },
      };
      if (trial(s, prior, cand)) {
        yield cand;
        break;
      }
    }
  }
}

export const CONTAINER_TERMINAL: Concept = {
  id: 'container-terminal',
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: fitsWith(16),
  ownsCrossing: true,
  family: ['crane', 'dock forklift', 'harpoon'],
  budget: 2,
  names: ['The Container Terminal at {place}', '{place} Freight Yard', 'Berth Nine, {place}', '{place} Box Port'],
  box: (k, rng) => ({ w: berthMax() + structureCols(k.W, rng, 16, 21), h: 17 }),
  build: buildTerminal,
  pieces: terminalPieces,
};

// ----------------------------------------------------------------------------------------- lighthouse rock

/** Where the lighthouse's parts are. */
export interface Lighthouse {
  tx: number;
  tw: number;
  /** Row of each floor, base first (the rock is the base); the last is the gallery's. */
  floors: number[];
  /** The roof's row; the lantern stands on it. */
  roof: number;
}

function buildLighthouse(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, sx, ex, L } = frame(at);
  const H = g.h;
  g.clear(sx, 0, ex, H - 1);
  // The rock: level with the quay, shelving off toward the far end, with the odd boulder to hop.
  footing(g, sx, ex, G);
  for (let y = G + 3; y < H; y++) {
    const k = Math.min(Math.floor((y - G - 2) * 0.8), Math.floor(L / 4));
    if (k > 0) g.clear(ex - k + 1, y, ex, y);
  }
  const tw = rng.int(5, 6);
  const mid = sx + Math.floor((L - tw) / 2) + rng.int(-2, 2);
  const tx = Math.max(sx + 4, Math.min(ex - 3 - tw, mid));
  const t1 = tx + tw - 1;
  // Storeys up the tower, a jump each, as many as the sky leaves room for with the lantern on top.
  const S = Math.max(3, Math.min(rng.int(4, 5), climb()));
  let n = rng.int(2, 4);
  while (n > 1 && G - S * n - 4 < at.y + 4) n--;
  const floors = Array.from({ length: n + 1 }, (_, i) => G - S * i);
  const gallery = floors[n];
  const roof = gallery - 4;
  g.fill(tx, roof, t1, G - 1, T_SOLID, true);
  g.clear(tx + 1, roof + 1, t1 - 1, G - 1);
  // Landings up the inside, swapping sides like a turning stair; the top floor whole.
  for (let i = 1; i < n; i++) {
    const left = (i + (rng.chance(0.5) ? 1 : 0)) % 2 === 0;
    const [a, b] = left ? [tx + 1, t1 - 2] : [tx + 2, t1 - 1];
    for (let c = a; c <= b; c++) g.set(c, floors[i], T_ONEWAY, true);
  }
  for (let c = tx + 1; c <= t1 - 1; c++) g.set(c, gallery, T_ONEWAY, true);
  // Doors straight through at the bottom, and out onto the gallery round the top.
  g.clear(tx, G - 3, tx, G - 1);
  g.clear(t1, G - 3, t1, G - 1);
  g.clear(tx, gallery - 3, tx, gallery - 1);
  g.clear(t1, gallery - 3, t1, gallery - 1);
  for (const c of [tx - 2, tx - 1, t1 + 1, t1 + 2]) g.set(c, gallery, T_ONEWAY, true);
  // A boulder or two on the rock, clear of the doors.
  for (let i = rng.int(0, 2); i > 0; i--) {
    const bx = rng.chance(0.5) ? rng.int(sx + 3, tx - 3) : rng.int(t1 + 3, ex - 2);
    if (bx > sx + 2 && bx < ex - 1 && (bx < tx - 2 || bx > t1 + 2)) g.set(bx, G - 1, T_SOLID, true);
  }
  digBerth(g, rng, at, parts);
  const top = roof - 5;
  return {
    concept: 'lighthouse',
    rect: { x: sx, y: Math.max(0, top), w: L, h: H - Math.max(0, top) },
    air: [
      { x: tx - 2, y: Math.max(0, top), w: tw + 4, h: gallery - Math.max(0, top) },
      { x: tx + 1, y: roof + 1, w: tw - 2, h: G - roof - 1 },
    ],
    anchors: { exit: [ex, G], deck: [sx, G], span: [sx, ex], tower: [tx, tw], roof: [roof, gallery], storeys: [n, S] },
    skin: 'stone',
  };
}

function* lighthousePieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [tx, tw] = l.anchors.tower;
  const [roof] = l.anchors.roof;
  const prior: PlacedProp[] = [];
  const lx = tx + tw / 2;
  const ly = roof - 2;
  // The lantern room on the roof (its cell is the lamp's), and the lamp: a beam swept over one side on a long dark.
  const lantern: Module = { type: 'deco', kind: 'facade', at: [tx, roof - 4], w: tw, h: 4, seed: rng.int(0, 1 << 20) };
  const seaward = rng.chance(0.35);
  const cands: Piece[] = [];
  for (const tilt of [0.22, 0.14, 0.06])
    for (const sweep of [0.3, 0.2, 0.12])
      cands.push({
        name: rng.pick(['The Lamp', 'Keeper’s Light', 'Fresnel Fury', 'The Big Beam']),
        archetype: 'laser',
        role: 'hazard',
        style: makeStyle(rng, ['brass', 'gold'], [44], { glowHue: rng.range(40, 52) }),
        modules: [
          lantern,
          {
            type: 'laser',
            at: [lx, ly],
            angle: seaward ? Math.PI - tilt : tilt,
            charge: rng.int(50, 70),
            fire: rng.int(50, 80),
            off: rng.int(220, 320),
            sweep,
            sweepPeriod: rng.int(260, 380),
          },
        ],
      });
  for (const c of [...cands, ...cands.map((c) => ({ ...c, modules: c.modules.map((m) => (m.type === 'laser' ? { ...m, angle: Math.PI - m.angle } : m)) }))])
    if (trial(s, prior, c)) {
      yield c;
      return;
    }
  // No beam fits anywhere: the lantern still stands, dark.
  const dark: Piece = {
    name: 'The Lamp (Out)',
    archetype: 'platform',
    role: 'build',
    style: makeStyle(rng, ['brass'], [44]),
    modules: [lantern],
    extra: [[Math.floor(lx), ly]],
    pathSafe: true,
  };
  trial(s, prior, dark);
  yield dark;
}

export const LIGHTHOUSE: Concept = {
  id: 'lighthouse',
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: fitsWith(16),
  ownsCrossing: true,
  family: ['wave', 'tentacle', 'shore battery'],
  budget: 1,
  names: ['Lighthouse Rock, {place}', 'The {place} Light', 'The Keeper’s Rock at {place}', '{place} Point Light'],
  box: (k, rng) => ({ w: berthMax() + structureCols(k.W, rng, 16, 20), h: 26 }),
  build: buildLighthouse,
  pieces: lighthousePieces,
};

// --------------------------------------------------------------------------------------------- kraken lagoon

/** Columns of a sea stack (the rope bridge's ends), with a cave through its foot. */
const STACK = 3;

function buildLagoon(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, sx, ex } = frame(at);
  const H = g.h;
  const j = jumpProfile();
  g.clear(sx, 0, ex, H - 1);
  // Sea stacks at both ends on the rocks you land on, a cave through each foot.
  const n0 = sx + 1;
  const f0 = ex - STACK;
  footing(g, sx, n0 + STACK, G);
  footing(g, f0 - 1, ex, G);
  const B = Math.max(at.y + 3, G - rng.int(6, 9));
  // Rungs up the outer face of each, a short jump apart, from the rock to the top.
  const rs = Math.min(3, climb());
  for (const [x0, rx] of [
    [n0, sx],
    [f0, ex],
  ]) {
    g.fill(x0, B, x0 + STACK - 1, G - 4, T_SOLID, true);
    g.set(x0 + rng.int(0, STACK - 1), B - 1, T_SOLID, true);
    for (let y = G - 1 - rs; y > B; y -= rs) g.set(rx, y, T_ONEWAY, true);
  }
  // Islets between, lower than the rocks, a hop apart over open water.
  const ix0 = n0 + STACK + 1;
  const ix1 = f0 - 2;
  const gaps: [number, number][] = [];
  const hop = Math.max(2, Math.min(3, j.walkGap));
  for (let last = ix0 - 1; ; ) {
    const rem = ix1 - last;
    if (rem <= hop) {
      if (rem > 0) gaps.push([last + 1, ix1]);
      break;
    }
    let gap = Math.min(hop, rng.int(2, 3));
    let w = Math.min(rng.int(2, 4), rem - gap - 1);
    if (w < 1) {
      gap = 1;
      w = Math.max(1, rem - 2);
    }
    const x = last + 1 + gap;
    footing(g, x, x + w - 1, G + rng.int(1, Math.min(3, H - 4 - G)));
    gaps.push([last + 1, x - 1]);
    last = x + w - 1;
  }
  // The rope bridge between the stacks' tops, sagging through its middle third.
  const b0 = n0 + STACK;
  const b1 = f0 - 1;
  const third = Math.floor((b1 - b0 + 1) / 3);
  for (let c = b0; c <= b1; c++) g.set(c, c > b0 + third && c < b1 - third ? B + 1 : B, T_ONEWAY, true);
  digBerth(g, rng, at, parts);
  return {
    concept: 'kraken-lagoon',
    rect: { x: sx, y: B - 2, w: ex - sx + 1, h: H - B + 2 },
    air: [{ x: ix0, y: B + 2, w: ix1 - ix0 + 1, h: G - B - 2 }],
    anchors: {
      exit: [ex, G],
      deck: [sx, G],
      span: [sx, ex],
      bridge: [B, b1 - b0 + 1],
      ...Object.fromEntries(gaps.map((gp, i) => [`gap${i}`, gp])),
    },
    skin: 'stone',
  };
}

function* lagoonPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [B] = a.bridge;
  const prior: PlacedProp[] = [];
  const gaps: Vec[] = [];
  for (let i = 0; a[`gap${i}`]; i++) gaps.push(a[`gap${i}`]);
  // Tentacles out of the water gaps, each on its own beat, stopping short of the bridge.
  const want = Math.max(1, Math.min(gaps.length, rng.int(2, 4)));
  let placed = 0;
  for (const [x0, x1] of rng.shuffle(gaps.slice())) {
    if (placed >= want) break;
    const w = x1 - x0 + 1;
    const width = w >= 3 && rng.chance(0.5) ? 1.6 : 1.2;
    const cand: Piece = {
      name: rng.pick(['Tentacle', 'Something Below', 'The Arm', 'Eight of These']),
      archetype: 'flamer',
      role: 'hazard',
      style: makeStyle(rng, ['brass'], [rng.pick([340, 10, 280, 150])], { glowHue: rng.range(300, 340) }),
      modules: [
        {
          type: 'geyser',
          look: 'tentacle',
          at: [x0 + w / 2, s.h],
          angle: -Math.PI / 2,
          width,
          length: s.h - B - 2,
          off: rng.int(150, 260),
          warn: rng.int(50, 70),
          on: rng.int(55, 85),
          lethal: true,
          strength: 0,
        },
      ],
    };
    if (trial(s, prior, cand)) {
      yield cand;
      placed++;
    }
  }
}

export const KRAKEN_LAGOON: Concept = {
  id: 'kraken-lagoon',
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: fitsWith(17),
  ownsCrossing: true,
  family: ['tentacle', 'harpoon', 'wave'],
  budget: 2,
  names: ['Kraken Lagoon, {place}', 'The Lagoon at {place}', '{place}: Do Not Feed', 'The Deep End of {place}'],
  box: (k, rng) => ({ w: berthMax() + structureCols(k.W, rng, 17, 21), h: 13 }),
  build: buildLagoon,
  pieces: lagoonPieces,
};
