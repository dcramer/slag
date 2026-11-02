import type { Rng } from '../../../core/rng';
import { finish, Grid, hintGap, noise2D, POCKET, smoothCA, T_EMPTY, T_ONEWAY, T_SOLID } from '../kit';
import { jumpProfile } from '../probe';
import type { SculptCtx, Shape } from '../types';
import { easyGap, easyRise, hardGap, type Knobs, knobs, rollChallenges, undercut } from './common';

/** Columns a storey's second connector occupies. */
const ALT_W = 4;

/**
 * Tall (vertical) levels: a stack of storeys joined by connectors, with each
 * theme supplying its own shape language through a `TallKit`:
 *
 *   castle    tower floors of stone, stair flights, crenellated battlements
 *   factory   multi-storey steel floors, stair stringers, ladders, machines
 *   mine      solid rock, carved tunnels per level, rung shafts, timber
 *   jungle    giant edge trunks, branch decks, vine ladders, canopy crown
 *   rooftops  stacked roofs with window facades, fire-escape landings
 *   volcano   a cone of jagged rock ledges over lava, rock-step ramps
 *   glacier   rock shelves up an icefall, rock-step flights, ice in the beds
 *
 * Route shapes (profile.route):
 *   zigzag   full-width storeys, connectors alternating ends (switchbacks)
 *   climb    partial storeys, connectors anywhere: more vertical, more air
 *   descent  spawn on the top storey, drop holes down to a ground floor
 *            with a pit in front of the goal
 *
 * Spawn is always on the left, goal on the right. Storeys are spaced more
 * than a jump apart (measured: jumpProfile().rise), so connectors matter, and
 * every pair of storeys has two of them, far apart, so the climb is a choice
 * (levels are mostly open). The bridge challenge is a moat every route has to
 * cross: on the goal storey, and on the spawn storey when a level asks for two
 * parts; a descent has one wider pit in front of the goal.
 */

export interface Storey {
  /** Stand row (floor at row + 1). */
  row: number;
  /** Column where the route arrives on / leaves this storey. */
  arrive: number;
  leave: number;
  /** Deck extent (inclusive). */
  x0: number;
  x1: number;
}

export interface Link {
  /** Index of the lower / upper storey (in row order, not route order). */
  lower: Storey;
  upper: Storey;
  /** Left column of the connector. */
  x: number;
  w: number;
  /** +1: stairs rise to the right; -1: to the left. */
  dir: 1 | -1;
}

export interface TallKit {
  style: string;
  /** Columns at each edge owned by a shell (tower walls, trunks); decks and links stay inside. */
  margin: number;
  /** Columns a connector occupies. */
  linkW: (rise: number, gap: number) => number;
  /** Before decks: fill/carve masses (mine rock). */
  base?(g: Grid, rng: Rng, k: Knobs): void;
  /** Build the floor of a storey (stand row s.row) over [x0, x1]. `ground` = the bottom storey (fill to the bottom). */
  deck(g: Grid, rng: Rng, s: Storey, x0: number, x1: number, ground: boolean, k: Knobs): void;
  /** Build a connector. */
  link(g: Grid, rng: Rng, l: Link, k: Knobs): void;
  /** After everything: decor that must not block the route. */
  dress?(g: Grid, rng: Rng, storeys: Storey[], links: Link[], k: Knobs): void;
  /** Shell around everything (edge walls/trunks), applied before the pockets. */
  shell?(g: Grid, rng: Rng, storeys: Storey[], k: Knobs): void;
}

/** Plan and build a tall level with a theme kit. */
function sculptTall(ctx: SculptCtx, kit: TallKit): Shape {
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const g = new Grid(W, H);
  const j = jumpProfile();
  const rise = easyRise();
  const route = k.route === 'ltr' ? 'zigzag' : k.route;
  const descent = route === 'descent';
  const lo = kit.margin;
  const hi = W - 1 - kit.margin;
  // A descent's connectors are holes in the floor, however wide the kit's stairs are.
  const lw = descent ? ALT_W : kit.linkW(rise, j.gap);

  // --- storey rows, bottom first.
  const bottom = H - rng.int(4, 6);
  const top = rng.int(5, 7);
  // Storeys sit more than a (wall-assisted) climb apart, so connectors matter; dense = tighter.
  const sMin = j.rise + 1;
  const sMax = j.rise + 2 + Math.round((1 - k.density) * 2);
  let n = Math.max(2, Math.floor((bottom - top) / ((sMin + sMax) / 2)) + 1);
  if (route === 'zigzag' && n % 2 === 0) n--;
  if (descent && n % 2 === 0) n--;
  n = Math.max(route === 'climb' ? 2 : 3, n);
  const span = (bottom - top) / (n - 1);
  const rows: number[] = [];
  for (let i = 0; i < n; i++) rows.push(i === 0 ? bottom : i === n - 1 ? top : Math.round(bottom - span * i + rng.int(-1, 1)));
  for (let i = 1; i < n; i++) rows[i] = Math.min(rows[i], rows[i - 1] - sMin);
  if (rows[n - 1] < 4) return finish(g, { row: bottom }, { row: bottom }, `${kit.style}:broken`);

  // --- the ask. Every route crosses the goal storey, so a moat in front of the goal can't be walked
  // around, and a second one guards the spawn storey (a descent's goal storey is the ground, the one
  // storey you can't drop past, so it just gets a wider pit). Moats, not broken ladders: walls climb
  // and storeys sit two plain jumps apart, so a missing connector is free or takes two bridges.
  const challenges = rollChallenges(attempt, k);
  const goalMoat = challenges ? hardGap(rng, descent ? challenges : 1) : 0;
  let spawnMoat = challenges === 2 && !descent ? hardGap(rng) : 0;
  const goalMoatX = W - POCKET - 1 - goalMoat;
  // Falling a storey carries you far: a descent's last holes stay that far from the moat's far bank.
  const fallClear = descent ? goalMoatX + goalMoat - j.gapAt(-6) - 6 : W;
  const goalEnd = challenges ? Math.min(goalMoatX - 3, fallClear) : hi;
  const spawnStart = () => (spawnMoat ? POCKET + 2 + spawnMoat + 2 : lo + 1);
  if (n === 2 && goalEnd - spawnStart() + 1 < ALT_W) spawnMoat = 0;
  // Connectors of the first and last pair of storeys stay on the route's side of their moats.
  const low = (i: number) => (i === 0 ? spawnStart() : lo + 1);
  const high = (i: number) => (i === n - 2 ? goalEnd : hi);
  if (high(0) - low(0) + 1 < ALT_W) spawnMoat = 0;

  // --- connector columns, in route order (route index 0 = spawn storey). A pair with no room for
  // the kit's connector makes do with a ladder.
  const order = descent ? rows.map((_, i) => n - 1 - i) : rows.map((_, i) => i); // route index → row index
  const linkX: number[] = [];
  const linkW: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = low(i);
    const b = high(i);
    const w = b - a + 1 >= lw ? lw : ALT_W;
    linkW.push(w);
    if (route === 'climb') {
      let x = a;
      for (let tries = 0; tries < 30; tries++) {
        x = rng.int(Math.min(a + 3, b - w + 1), Math.max(a, b - w - 3));
        if (i === 0 || Math.abs(x - linkX[i - 1]) >= Math.min(10, (hi - lo) / 3)) break;
      }
      linkX.push(x);
    } else linkX.push(i % 2 === 0 ? b - w + 1 - rng.int(0, 1) : a + rng.int(0, 1));
  }
  const storeys: Storey[] = rows.map((row) => ({ row, arrive: 0, leave: 0, x0: lo, x1: hi }));
  for (let i = 0; i < n; i++) {
    const s = storeys[order[i]];
    s.arrive = i === 0 ? 2 : linkX[i - 1] + (linkW[i - 1] >> 1);
    s.leave = i === n - 1 ? W - 3 : linkX[i] + (linkW[i] >> 1);
    // Storeys run wall to wall: the level's side walls are wall-jumpable, so a storey that stopped
    // short would leave a free climb up the edge (and a free drop past any moat). Sparse levels open
    // holes in them instead (easy gaps).
    s.x0 = 0;
    s.x1 = W - 1;
  }
  // Spawn and goal storeys run to the level edges (pockets).
  storeys[order[0]].x0 = 0;
  storeys[order[n - 1]].x1 = W - 1;

  kit.base?.(g, rng, k);
  storeys.forEach((s, ri) => kit.deck(g, rng, s, s.x0, s.x1, ri === 0, k));

  // --- links (route order). Stairs rise toward where the route goes on the upper storey,
  // so its stairwell (the hole over the lower steps) is behind you.
  const links: Link[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = storeys[order[i]];
    const b = storeys[order[i + 1]];
    const [lower, upper] = a.row > b.row ? [a, b] : [b, a];
    const mid = linkX[i] + (linkW[i] >> 1);
    const onward = upper === b ? b.leave : a.arrive;
    const dir: 1 | -1 = onward >= mid ? 1 : -1;
    const l: Link = { lower, upper, x: linkX[i], w: linkW[i], dir };
    links.push(l);
    if (descent) dropHole(g, l);
    else if (linkW[i] < lw) rungShaft(g, l, rise);
    else kit.link(g, rng, l, k);
    // Mostly open: a second way between every pair of storeys, as far from the first as the storey
    // allows. A ladder or a drop hole, whatever the kit's main connector is. The pockets only limit
    // the storeys they stand on.
    const a0 = Math.max(low(i), i === 0 ? POCKET + 1 : lo + 1);
    const b0 = Math.min(high(i), i === n - 2 ? W - POCKET - 2 : hi - 1);
    const left = a0 + rng.int(0, 1);
    const right = b0 - ALT_W + 1 - rng.int(0, 1);
    const fits = (x: number) => x >= a0 && x + ALT_W - 1 <= b0 && (x + ALT_W + 1 < l.x || x > l.x + l.w);
    const x = (mid > W / 2 ? [left, right] : [right, left]).find(fits);
    if (x !== undefined) {
      const alt: Link = { ...l, x, w: ALT_W };
      links.push(alt);
      if (descent) dropHole(g, alt);
      else rungShaft(g, alt, rise);
    }
  }

  // --- the moats, then easy gaps in other storeys between arrival and departure.
  g.wantsProps = challenges > 0;
  const cut = (s: Storey, x0: number, w: number) => {
    const x1 = x0 + w - 1;
    if (s === storeys[0]) {
      g.clear(x0, s.row - 3, x1, H - 1);
      undercut(g, x1 + 1, 2, s.row);
    } else {
      // Open right down to the storey below (in rock that means carving it), with the far bank cut
      // back under a lip: walls climb, so a plain shaft wall would walk you out of any moat.
      const below = rows[rows.indexOf(s.row) - 1];
      g.clear(x0, s.row + 1, x1, below);
      g.clear(x1 + 1, s.row + 3, Math.min(W - 1, x1 + 2), below);
    }
    hintGap(g, x0, x1, s.row + 1);
  };
  const used = new Set<number>();
  if (goalMoat) {
    cut(storeys[order[n - 1]], goalMoatX, goalMoat);
    used.add(order[n - 1]);
  }
  if (spawnMoat) {
    cut(storeys[order[0]], POCKET + 2, spawnMoat);
    used.add(order[0]);
  }
  const cands = order.map((ri) => ({ ri }));
  rng.shuffle(cands);
  let easy = Math.round(rng.range(0, 1.5) + 2 * (1 - k.density));
  for (const { ri } of cands) {
    if (easy <= 0) break;
    if (used.has(ri)) continue;
    const s = storeys[ri];
    const w = easyGap(rng, 2);
    // Between where the route arrives and leaves, clear of this storey's connectors and the pockets.
    const p = Math.min(s.arrive, s.leave);
    const q = Math.max(s.arrive, s.leave);
    let a = Math.max(p + 3, 7);
    // Dropping through a gap past the goal moat would skip it.
    let b = Math.min(q - 3, W - 8, descent && goalMoat ? goalMoatX - 3 : W);
    for (const l of links) {
      if (l.lower !== s && l.upper !== s) continue;
      const c = l.x + (l.w >> 1);
      if (Math.abs(c - p) <= l.w) a = Math.max(a, l.x + l.w + 3);
      if (Math.abs(c - q) <= l.w) b = Math.min(b, l.x - 4);
    }
    if (b - a + 1 < w + 2) continue;
    const x0 = rng.int(a, b - w + 1);
    const x1 = x0 + w - 1;
    // Keep gaps clear of links (their walls/steps would be a way across).
    if (links.some((l) => (l.lower === s || l.upper === s) && x1 + 3 >= l.x && x0 - 3 <= l.x + l.w - 1)) continue;
    used.add(ri);
    if (ri === 0) g.clear(x0, s.row - 3, x1, H - 1);
    else g.clear(x0, s.row + 1, x1, s.row + 3);
    easy--;
  }

  kit.dress?.(g, rng, storeys, links, k);
  kit.shell?.(g, rng, storeys, k);
  const sp = storeys[order[0]];
  const gl = storeys[order[n - 1]];
  return finish(g, { row: sp.row, depth: order[0] === 0 ? undefined : 2 }, { row: gl.row, depth: order[n - 1] === 0 ? undefined : 2 }, `${kit.style}:${route}`);
}

/** Descent connector: a hole in the upper storey's floor (drop through to the storey below). */
function dropHole(g: Grid, l: Link): void {
  const w = Math.max(3, Math.min(l.w, 4));
  const x = l.x + ((l.w - w) >> 1);
  // A clear shaft from the upper floor down to the landing (in rock themes it's carved).
  g.clear(x, l.upper.row + 1, x + w - 1, l.lower.row);
  g.clear(x - 1, l.lower.row - 3, x + w, l.lower.row);
}

// ---------------------------------------------------------------------------
// Shared connector builders.

/** Columns a stair flight needs for the tallest storey spacing (2 per step plus a landing). */
function stairW(rise: number): number {
  return 2 * Math.ceil((jumpProfile().rise + 7) / rise) + 2;
}

/**
 * Stair flight: 2-wide solid steps `rise` apart, climbing from the lower
 * storey to the upper one in direction l.dir, with the upper floor cleared
 * above the lower steps (a stairwell).
 */
function stairFlight(g: Grid, l: Link, rise: number, v: number = T_SOLID, thick = 1): void {
  const D = l.lower.row - l.upper.row;
  const m = Math.ceil(D / rise);
  const start = l.dir > 0 ? l.x : l.x + l.w - 2;
  for (let s = 1; s <= m; s++) {
    const top = l.lower.row - Math.min(D, s * rise) + 1; // top solid row of this step
    const cx = start + l.dir * 2 * (s - 1);
    // Stairwell: headroom over every step but the last (a jump's worth plus a margin).
    if (s < m) g.clear(cx - 1, top - rise - 2, cx + 2, top - 1);
    // Floating steps (a stringer), so you can walk under the flight from either side.
    const bot = Math.min(l.lower.row - 1, top + (s === 1 ? 0 : thick - 1));
    if (v === T_SOLID) g.fill(cx, top, cx + 1, bot, T_SOLID, true);
    else {
      g.clear(cx, top, cx + 1, top);
      g.plank(cx, cx + 1, top);
    }
  }
  // Landing beyond the flight joins the upper deck.
  const lx = start + l.dir * 2 * m;
  g.fill(Math.min(lx, lx + l.dir), l.upper.row + 1, Math.max(lx, lx + l.dir), l.upper.row + 1, v === T_SOLID ? T_SOLID : T_ONEWAY, true);
}

/**
 * Ladder shaft: a clear shaft `l.w` wide from the lower storey up through the
 * upper floor, with staggered one-way rungs every `rise` rows; the upper
 * floor over the shaft becomes one-way (jump up through it).
 */
function rungShaft(g: Grid, l: Link, rise: number, rungW = 2): void {
  const x0 = l.x;
  const x1 = l.x + l.w - 1;
  g.clear(x0, l.upper.row + 1, x1, l.lower.row);
  g.clear(x0, l.upper.row - 3, x1, l.upper.row);
  for (let x = x0; x <= x1; x++) g.set(x, l.upper.row + 1, T_ONEWAY, true);
  let left = l.dir > 0;
  for (let y = l.lower.row + 1 - rise; y > l.upper.row + 1; y -= rise) {
    const a = left ? x0 : x1 - rungW + 1;
    g.plank(a, a + rungW - 1, y);
    left = !left;
  }
}

// ---------------------------------------------------------------------------
// Theme kits.

/** Stone tower floors (2 thick), stair flights, crenellated battlements, arrow-slit tower walls. */
const CASTLE: TallKit = {
  style: 'castle',
  margin: 2,
  linkW: (rise) => stairW(rise),
  deck(g, _rng, s, x0, x1, ground) {
    g.fill(x0, s.row + 1, x1, ground ? g.h - 1 : s.row + 2, T_SOLID, true);
  },
  link(g, _rng, l) {
    return stairFlight(g, l, easyRise(), T_SOLID, 2);
  },
  dress(g, rng, storeys, links) {
    // Banners (one-way) under floors.
    for (const s of storeys.slice(1)) {
      if (rng.chance(0.6)) {
        const x = rng.int(s.x0 + 3, Math.max(s.x0 + 3, s.x1 - 5));
        if (!links.some((l) => x + 2 >= l.x - 1 && x <= l.x + l.w)) g.plank(x, x + 2, s.row + 4);
      }
    }
  },
  shell(g, rng, storeys) {
    // Tower walls up both edges with arrow slits; they stop at the top storey.
    const top = storeys[storeys.length - 1].row;
    for (const x of [0, 1, g.w - 2, g.w - 1]) for (let y = top + 1; y < g.h; y++) if (g.empty(x, y)) g.set(x, y, T_SOLID);
    for (let y = top + 4; y < g.h - 4; y += rng.int(4, 6)) {
      g.set(0, y, T_EMPTY, true);
      g.set(g.w - 1, y + 2, T_EMPTY, true);
    }
  },
};

/** Steel floors, stair stringers (one-way) or ladders, crates and ducts. */
const FACTORY: TallKit = {
  style: 'factory',
  margin: 1,
  linkW: (rise) => stairW(rise),
  deck(g, rng, s, x0, x1, ground, k) {
    if (ground) g.fill(x0, s.row + 1, x1, g.h - 1, T_SOLID, true);
    else if (k.density < 0.35 && rng.chance(0.5)) g.plank(x0, x1, s.row + 1);
    else g.fill(x0, s.row + 1, x1, s.row + 1, T_SOLID, true);
  },
  link(g, rng, l) {
    if (rng.chance(0.5)) return stairFlight(g, l, easyRise(), T_ONEWAY);
    const w = 5;
    return rungShaft(g, { ...l, x: l.dir > 0 ? l.x : l.x + l.w - w, w }, easyRise());
  },
  dress(g, rng, storeys, links, k) {
    // Crates (1–2 tall, hoppable) and hanging ducts under floors.
    for (const s of storeys) {
      for (let i = Math.round(rng.range(0, 2) * (0.5 + k.density)); i > 0; i--) {
        const x = rng.int(s.x0 + 2, Math.max(s.x0 + 2, s.x1 - 3));
        if (links.some((l) => x + 2 >= l.x - 1 && x <= l.x + l.w) || Math.abs(x - s.arrive) < 3 || Math.abs(x - s.leave) < 3) continue;
        if (!g.empty(x, s.row) || !g.empty(x + 1, s.row) || g.empty(x, s.row + 1) || g.empty(x + 1, s.row + 1)) continue;
        g.fill(x, s.row - rng.int(0, 1), x + 1, s.row);
      }
      if (rng.chance(0.4 + 0.4 * k.density) && s !== storeys[0]) {
        const x = rng.int(s.x0 + 2, Math.max(s.x0 + 2, s.x1 - 2));
        if (g.get(x, s.row + 1) === T_SOLID && g.empty(x, s.row + 2) && g.empty(x, s.row + 5)) g.set(x, s.row + 2, T_SOLID);
      }
    }
  },
  shell(g, _rng, storeys) {
    // Ceiling over the top floor if there's room.
    const top = storeys[storeys.length - 1].row;
    if (top >= 6) g.fill(0, 0, g.w - 1, 0);
  },
};

/** Solid rock: noise caverns, a tunnel carved per level, rung shafts between them, timber cap beams. */
const MINE: TallKit = {
  style: 'mine',
  margin: 1,
  linkW: () => 5,
  base(g, rng, k) {
    const W = g.w;
    const H = g.h;
    g.fill(0, 0, W - 1, H - 1);
    const n = noise2D(rng, W, H, rng.int(5, 8), 2);
    const thr = 0.3 + (0.5 - k.density) * 0.3;
    const m = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = y < 2 || y > H - 3 || n[y * W + x] < thr || rng.chance(0.06) ? 1 : 0;
    const sm = smoothCA(W, H, m, 3, 5, 4, 1);
    for (let i = 0; i < W * H; i++) if (!sm[i]) g.t[i] = 0;
  },
  deck(g, rng, s, x0, x1, ground) {
    // Tunnel: clear headroom above a solid floor, ceiling roughened.
    const clear = rng.int(4, 5);
    for (let x = x0; x <= x1; x++) {
      const c = clear + (rng.chance(0.25) ? 1 : 0);
      g.clear(x, s.row - c + 1, x, s.row);
      g.set(x, s.row + 1, T_SOLID, true);
      if (ground) g.fill(x, s.row + 2, x, g.h - 1, T_SOLID, true);
      else g.set(x, s.row + 2, T_SOLID, true);
    }
  },
  link(g, _rng, l) {
    rungShaft(g, l, easyRise());
    g.plank(l.x - 1, l.x + l.w, l.upper.row - 3); // head frame
  },
  dress(g, rng, storeys) {
    for (const s of storeys) {
      for (let x = s.x0 + rng.int(3, 6); x < s.x1 - 3; x += rng.int(6, 9)) {
        let cy = s.row - 1;
        while (cy > 0 && g.empty(x, cy)) cy--;
        if (s.row - cy < 5 || !g.empty(x - 1, cy + 1) || !g.empty(x + 1, cy + 1)) continue;
        g.plank(x - 1, x + 1, cy + 1);
      }
    }
  },
};

/** Giant edge trunks, mossy branch decks, vine ladders, a canopy crown over the top. */
const JUNGLE: TallKit = {
  style: 'jungle',
  margin: 3,
  linkW: () => 4,
  deck(g, rng, s, x0, x1, ground) {
    if (ground) {
      g.fill(x0, s.row + 1, x1, g.h - 1, T_SOLID, true);
      return;
    }
    // Branch: solid knots with one-way leafy stretches.
    for (let x = x0; x <= x1;) {
      const len = rng.int(3, 7);
      const solid = rng.chance(0.55);
      for (let i = 0; i < len && x <= x1; i++, x++) g.set(x, s.row + 1, solid ? T_SOLID : T_ONEWAY, true);
    }
    // Dangling moss under solid parts.
    for (let x = x0 + 1; x < x1; x += rng.int(3, 6)) if (g.get(x, s.row + 1) === T_SOLID && g.empty(x, s.row + 4)) g.set(x, s.row + 2, T_SOLID);
  },
  link(g, _rng, l) {
    return rungShaft(g, l, easyRise(), 2);
  },
  dress(g, rng, storeys) {
    // Canopy crown above the top storey.
    const top = storeys[storeys.length - 1].row;
    const depth = Math.max(0, top - 5);
    if (depth >= 2) {
      const W = g.w;
      const m = new Uint8Array(W * g.h);
      for (let y = 0; y <= depth; y++) for (let x = 0; x < W; x++) m[y * W + x] = rng.chance(y < 2 ? 0.9 : 0.7 - (y / depth) * 0.5) ? 1 : 0;
      const sm = smoothCA(W, g.h, m, 3, 5, 4, 0);
      for (let y = 0; y <= depth; y++) for (let x = 0; x < W; x++) if (sm[y * W + x] && g.empty(x, y + 4)) g.set(x, y, T_SOLID);
    }
  },
  shell(g, rng) {
    // Edge trunks (3 wide) full height; pockets are carved into their hollows later.
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < 3; x++) if (g.empty(x, y)) g.set(x, y, T_SOLID);
      for (let x = g.w - 3; x < g.w; x++) if (g.empty(x, y)) g.set(x, y, T_SOLID);
    }
    // Bark knots.
    for (let i = rng.int(2, 5); i > 0; i--) {
      const y = rng.int(4, g.h - 6);
      const left = rng.chance(0.5);
      const x = left ? 3 : g.w - 4;
      if (g.empty(x, y) && g.empty(x, y + 1) && g.empty(x, y - 1) && g.empty(left ? x + 1 : x - 1, y)) g.set(x, y, T_SOLID);
    }
  },
};

/** Stacked roofs with window facades hanging below, fire-escape ladders, rooftop clutter. */
const ROOFTOPS: TallKit = {
  style: 'rooftops',
  margin: 1,
  linkW: () => 4,
  deck(g, rng, s, x0, x1, ground) {
    const depth = ground ? g.h - 1 - s.row : rng.int(2, 3);
    g.fill(x0, s.row + 1, x1, s.row + depth, T_SOLID, true);
    // Facade windows.
    for (let y = s.row + 3; y < s.row + depth; y += 2) for (let x = x0 + 1; x < x1; x += 2) g.set(x, y, T_EMPTY, true);
    if (!ground && rng.chance(0.6)) {
      g.set(x0, s.row, T_SOLID);
      g.set(x1, s.row, T_SOLID);
    }
  },
  link(g, _rng, l) {
    // Fire escape: one-way landings zigzagging up the shaft.
    return rungShaft(g, l, easyRise(), 2);
  },
  dress(g, rng, storeys, links, k) {
    for (const s of storeys) {
      if (k.density < 0.3 && rng.chance(0.5)) continue;
      const x = rng.int(s.x0 + 2, Math.max(s.x0 + 2, s.x1 - 5));
      if (links.some((l) => x + 4 >= l.x - 1 && x <= l.x + l.w) || Math.abs(x - s.arrive) < 3 || Math.abs(x + 3 - s.leave) < 3) continue;
      if (rng.chance(0.5)) {
        // AC unit you can hop.
        if (g.empty(x, s.row) && g.empty(x + 1, s.row)) g.fill(x, s.row, x + 1, s.row);
      } else if (g.empty(x, s.row - 4) && g.empty(x + 3, s.row - 4)) {
        // Antenna mast with a one-way crossbar.
        g.fill(x + 1, s.row - 2, x + 1, s.row);
        g.plank(x, x + 2, s.row - 2);
      }
    }
  },
};

/** Jagged rock ledges over a lava floor, rock-step ramps, floating stones and spires. */
const VOLCANO: TallKit = {
  style: 'volcano',
  margin: 1,
  linkW: (rise) => stairW(rise),
  deck(g, rng, s, x0, x1, ground) {
    for (let x = x0; x <= x1; x++) {
      const t = ground ? g.h - 1 : s.row + 1 + rng.int(1, 2) + (rng.chance(0.2) ? 1 : 0);
      g.fill(x, s.row + 1, x, t, T_SOLID, true);
    }
  },
  link(g, _rng, l) {
    return stairFlight(g, l, easyRise(), T_SOLID, 2);
  },
  dress(g, rng, storeys, links) {
    for (const s of storeys.slice(1)) {
      // Needle spires on ledge ends (off the route).
      for (const x of [s.x0, s.x1]) {
        if (x <= 1 || x >= g.w - 2 || links.some((l) => Math.abs(l.x - x) < l.w + 2)) continue;
        if (Math.abs(x - s.arrive) < 3 || Math.abs(x - s.leave) < 3) continue;
        if (g.empty(x, s.row - 3) && rng.chance(0.5)) g.fill(x, s.row - rng.int(0, 1), x, s.row);
      }
    }
  },
};

/** Shelves of rock stacked up an icefall, rock-step flights between them; the ice is laid later (glacier.ts `glaze`). */
const GLACIER: TallKit = {
  style: 'glacier',
  margin: 1,
  linkW: (rise) => stairW(rise),
  deck(g, rng, s, x0, x1, ground) {
    for (let x = x0; x <= x1; x++) g.fill(x, s.row + 1, x, ground ? g.h - 1 : s.row + 2 + (rng.chance(0.15) ? 1 : 0), T_SOLID, true);
  },
  link(g, _rng, l) {
    return stairFlight(g, l, easyRise(), T_SOLID, 1);
  },
};

export const glacierTall = (ctx: SculptCtx): Shape => sculptTall(ctx, GLACIER);
export const castleTall = (ctx: SculptCtx): Shape => sculptTall(ctx, CASTLE);
export const factoryTall = (ctx: SculptCtx): Shape => sculptTall(ctx, FACTORY);
export const mineTall = (ctx: SculptCtx): Shape => sculptTall(ctx, MINE);
export const jungleTall = (ctx: SculptCtx): Shape => sculptTall(ctx, JUNGLE);
export const rooftopsTall = (ctx: SculptCtx): Shape => sculptTall(ctx, ROOFTOPS);
export const volcanoTall = (ctx: SculptCtx): Shape => sculptTall(ctx, VOLCANO);
