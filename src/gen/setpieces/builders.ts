import { dcos, dsin } from '../../core/dmath';
import type { Cell } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { Ammo, Archetype, CannonLook, GeyserLook, Material, Module, PropStyle, Role, RotorLook, RotorSupport, VehicleLook } from '../../sim/props';
import { best, type Piece, SAFE_TILES, type Site } from './place';

/**
 * Generic set-piece builders shared by the theme files. Each yields
 * candidate Pieces (absolute tile coords) best-first; `finalize` in
 * ./place.ts does the authoritative validation by simulation.
 */

type Range = readonly [number, number];
const roll = (rng: Rng, r: Range) => rng.range(r[0], r[1]);
const rollInt = (rng: Rng, r: Range) => rng.int(r[0], r[1]);
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

interface Common {
  name: string;
  style: PropStyle;
  archetype?: Archetype;
  role?: Role;
}

// ---------------------------------------------------------------------------
// Vehicles: patrol a run of flat ground.

export interface VehicleOpts extends Common {
  look: VehicleLook;
  /** Body width in tiles (number of 1-tile columns). */
  w: Range;
  /** Column heights (tiles), left to right, for a body `w` wide. */
  cols: (rng: Rng, w: number) => number[];
  speed: Range;
  pause: Range;
  span?: Range;
  hurt?: 'lead' | 'none';
  /** Chance the art faces left. */
  flip?: number;
}

export function* vehicles(rng: Rng, s: Site, o: VehicleOpts): Generator<Piece> {
  const w = rollInt(rng, o.w);
  const flip = rng.chance(o.flip ?? 0);
  const cols = o.cols(rng, w);
  if (flip) cols.reverse();
  const tall = Math.ceil(Math.max(...cols));
  const runs = s.groundRuns(tall + 3, w + 2).filter((r) => s.zoneDist(Math.floor((r.x0 + r.x1) / 2), r.y) > 2);
  for (const run of best(rng, runs, (r) => (s.runReachable(r) ? 3 : 0) + Math.min(1.5, (r.x1 - r.x0) / 10))) {
    const len = run.x1 - run.x0 + 1;
    const span = Math.min(len - w, rollInt(rng, o.span ?? [3, 9]));
    if (span < 2) continue;
    const x = run.x0 + rng.int(0, len - w - span);
    yield {
      name: o.name,
      archetype: o.archetype ?? 'crusher',
      role: o.role ?? 'hazard',
      style: o.style,
      modules: [
        {
          type: 'vehicle',
          look: o.look,
          at: [x, run.y + 1],
          cols,
          colW: 1,
          span,
          speed: roll(rng, o.speed),
          pause: rollInt(rng, o.pause),
          hurt: o.hurt ?? 'lead',
          flip,
          seed: rng.int(0, 1 << 20),
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Rotors: wheels (continuous) and pendulums.

interface RotorBase extends Common {
  look: RotorLook;
  support: RotorSupport;
  arm: Range;
  width: Range;
  thick?: number;
  period: Range;
  material: Material;
  /** Extra modules drawn with the rotor (absolute coords from the hub cell). */
  extra?: (hx: number, hy: number) => Module[];
}

export interface WheelOpts extends RotorBase {
  count: Range;
}

export function* wheels(rng: Rng, s: Site, o: WheelOpts): Generator<Piece> {
  const arm = roll(rng, o.arm);
  const width = Math.round(roll(rng, o.width));
  const R = arm + width / 2 + 1.2;
  const Ri = Math.ceil(R);
  const spots: Cell[] = [];
  for (let y = Ri; y < s.h - Ri; y++) {
    for (let x = Ri; x < s.w - Ri; x++) {
      if (s.zoneDist(x, y) <= SAFE_TILES + Ri) continue;
      let ok = true;
      for (let dy = -Ri; dy <= Ri && ok; dy++) for (let dx = -Ri; dx <= Ri && ok; dx++) if (dx * dx + dy * dy <= R * R && !s.free(x + dx, y + dy)) ok = false;
      if (ok) spots.push([x, y]);
    }
  }
  const low = (c: Cell) => Math.floor(c[1] + 0.5 + arm);
  const score = (c: Cell) =>
    (s.boardable(c[0], low(c), Math.ceil(width / 2) + 2, 4, 1) ? 3 : 0) +
    (o.support === 'tower' && s.groundBelow(c[0], c[1]) >= 0 && s.groundBelow(c[0], c[1]) - c[1] < 10 ? 1 : 0) +
    (s.overPit(c[0], low(c)) ? 0.5 : 0);
  for (const [x, y] of best(rng, spots, score)) {
    yield {
      name: o.name,
      archetype: o.archetype ?? 'platform',
      role: o.role ?? 'build',
      style: o.style,
      modules: [
        {
          type: 'rotor',
          look: o.look,
          support: o.support,
          mastX: x + 0.5,
          hub: [x + 0.5, y + 0.5],
          arm,
          count: rollInt(rng, o.count),
          angle0: rng.range(0, Math.PI * 2),
          period: rollInt(rng, o.period),
          swing: 0,
          dir: rng.sign(),
          width,
          thick: o.thick ?? 0.5,
          material: o.material,
          seed: rng.int(0, 1 << 20),
        },
        ...(o.extra?.(x, y) ?? []),
      ],
    };
  }
}

export interface PendulumOpts extends RotorBase {
  swing: Range;
}

export function* pendulums(rng: Rng, s: Site, o: PendulumOpts): Generator<Piece> {
  const arm = roll(rng, o.arm);
  const width = Math.round(roll(rng, o.width));
  const swing = roll(rng, o.swing);
  const reachX = arm * dsin(swing) + width / 2 + 1;
  const top = arm * dcos(swing) - 1.5;
  const spots: { x: number; y: number; mast: number; extra: Cell[] }[] = [];
  for (let y = 0; y < s.h - arm - 2; y++) {
    for (let x = 1; x < s.w - 1; x++) {
      const hx = x + 0.5;
      const hy = y + 0.5;
      if (s.zoneDist(x, Math.floor(hy + arm)) <= SAFE_TILES + Math.ceil(reachX)) continue;
      if (!s.freeRect(Math.floor(hx - reachX), Math.max(0, Math.floor(hy + top)), Math.floor(hx + reachX), Math.floor(hy + arm + 1.5))) continue;
      let mast = x;
      const extra: Cell[] = [];
      if (o.support === 'mast') {
        // A crane/hoist mast standing on the ground beside the swing.
        const side = rng.sign();
        mast = x - side * (Math.ceil(reachX) + 1);
        const g = s.groundBelow(mast, y);
        if (mast < 1 || mast >= s.w - 1 || g < 0 || g - y > 13 || g - y < 3) continue;
        let ok = true;
        for (let yy = y; yy < g && ok; yy++) {
          if (!s.free(mast, yy)) ok = false;
          extra.push([mast, yy]);
        }
        if (!ok) continue;
      }
      spots.push({ x, y, mast, extra });
    }
  }
  const score = (c: { x: number; y: number }) => {
    const lowY = Math.floor(c.y + 0.5 + arm);
    return (
      (s.boardable(c.x, lowY, Math.ceil(reachX), 4, 1) ? 3 : 0) +
      (s.overPit(c.x, lowY) ? 1.5 : 0) +
      (o.support === 'ceiling' && s.ceilingAbove(c.x, c.y, 6) >= 0 ? 1.5 : 0) +
      (o.support === 'ceiling' && c.y < 3 ? 0.7 : 0)
    );
  };
  for (const c of best(rng, spots, score)) {
    yield {
      name: o.name,
      archetype: o.archetype ?? 'platform',
      role: o.role ?? 'build',
      style: o.style,
      extra: c.extra,
      modules: [
        {
          type: 'rotor',
          look: o.look,
          support: o.support,
          mastX: c.mast + 0.5,
          hub: [c.x + 0.5, c.y + 0.5],
          arm,
          count: 1,
          angle0: DOWN,
          period: rollInt(rng, o.period),
          swing,
          dir: 1,
          width,
          thick: o.thick ?? 0.5,
          material: o.material,
          seed: rng.int(0, 1 << 20),
        },
        ...(o.extra?.(c.x, c.y) ?? []),
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Guns on ledges.

export interface CannonOpts extends Common {
  look: CannonLook;
  ammo: Ammo;
  speed: Range;
  interval: Range;
  burst: Range;
  elev: Range;
  length: number;
}

export function* cannons(rng: Rng, s: Site, o: CannonOpts): Generator<Piece> {
  const spots: { x: number; y: number; d: 1 | -1; hits: number }[] = [];
  const speed = roll(rng, o.speed);
  const elev = roll(rng, o.elev);
  const grav = o.ammo === 'cannonball' ? 520 : o.ammo === 'arrow' ? 260 : 0;
  for (let y = 2; y < s.h - 1; y++) {
    for (let x = 2; x < s.w - 2; x++) {
      for (const d of [1, -1] as const) {
        if (!(s.free(x, y) && s.free(x - d, y) && s.ground(x, y + 1) && s.ground(x - d, y + 1))) continue;
        if (!s.free(x, y - 1) || s.solid(x + d, y) || s.solid(x + d, y - 1) || s.solid(x + 2 * d, y - 1)) continue;
        // Count reachable cells the shot passes over: we want it to threaten the route.
        let px = (x + 0.5) * 16;
        let py = (y + 0.45) * 16;
        const vx = dcos(elev) * speed * d;
        let vy = -dsin(elev) * speed;
        let hits = 0;
        const seen = new Set<number>();
        for (let f = 0; f < 240; f++) {
          vy += grav / 60;
          px += vx / 60;
          py += vy / 60;
          const cx = Math.floor(px / 16);
          const cy = Math.floor(py / 16);
          if (cx < 0 || cx >= s.w || cy >= s.h || s.solid(cx, cy)) break;
          if (f > 6 && !seen.has(cy * s.w + cx) && (s.reachable(cx, cy) || s.reachable(cx, cy + 1))) {
            seen.add(cy * s.w + cx);
            hits++;
          }
        }
        if (hits > 0) spots.push({ x, y, d, hits });
      }
    }
  }
  for (const c of best(rng, spots, (c) => Math.min(4, c.hits / 2) + (s.reachable(c.x, c.y) ? 0 : 0.8))) {
    yield {
      name: o.name,
      archetype: o.archetype ?? 'launcher',
      role: o.role ?? 'hazard',
      style: o.style,
      extra: [[c.x - c.d, c.y]],
      modules: [
        {
          type: 'cannon',
          look: o.look,
          at: [c.x + 0.5, c.y + 0.45],
          angle: c.d > 0 ? -elev : Math.PI + elev,
          ammo: o.ammo,
          interval: rollInt(rng, o.interval),
          burst: rollInt(rng, o.burst),
          speed,
          length: o.length,
          seed: rng.int(0, 1 << 20),
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Geysers: up from the ground (on the route) or out of a pit, along the ground out of a wall, or down off a ceiling.

export interface GeyserOpts extends Common {
  look: GeyserLook;
  /** Aimed up (`where` picks ground or pit), sideways out of a wall along the ground (a wave, an avalanche), or down from a ceiling (a waterfall, a pour). */
  aim?: 'up' | 'side' | 'down';
  where: 'ground' | 'pit';
  length: Range;
  width: number;
  off: Range;
  warn: number;
  on: Range;
  lethal: boolean;
  strength?: number;
}

/** Where a geyser vents (`at`, in tiles) and which way, with a score for `best`. */
interface GeyserSpot {
  x: number;
  y: number;
  angle: number;
  score: number;
}

/**
 * Sideways: the foot of a wall, a stand cell with solid beside it, aimed away from the wall. The column
 * hugs the ground (its lower edge on the floor), so it sweeps whoever walks there. Down: under a ceiling
 * with room below, scored by how many stand cells the pour crosses.
 */
function aimedSpots(s: Site, aim: 'side' | 'down', len: number, width: number): GeyserSpot[] {
  const out: GeyserSpot[] = [];
  if (aim === 'side') {
    for (const r of s.groundRuns(Math.max(1, Math.ceil(width)), 3)) {
      for (const [x, dir, wall] of [
        [r.x0, 1, r.x0 - 1],
        [r.x1, -1, r.x1 + 1],
      ] as const) {
        if (wall < 0 || wall >= s.w || !s.solid(wall, r.y)) continue;
        const run = Math.min(len, r.x1 - r.x0 + 1);
        let on = 0;
        for (let i = 0; i < run; i++) if (s.reachable(x + dir * i, r.y)) on++;
        out.push({ x: dir > 0 ? x : x + 1, y: r.y + 1 - width / 2, angle: dir > 0 ? 0 : Math.PI, score: Math.min(3, on / 2) + Math.min(1, run / len) });
      }
    }
    return out;
  }
  for (let y = 1; y < s.h - 3; y++)
    for (let x = 1; x < s.w - 1; x++) {
      if (!s.solid(x, y - 1) || !s.free(x, y) || !s.free(x, y + 1)) continue;
      let on = 0;
      for (let yy = y; yy < Math.min(s.h, y + len) && !s.solid(x, yy); yy++) if (s.reachable(x, yy)) on++;
      if (!on) continue;
      out.push({ x: x + 0.5, y, angle: DOWN, score: Math.min(3, on * 1.5) + (s.zoneDist(x, y) > SAFE_TILES + 1 ? 0.5 : 0) });
    }
  return out;
}

export function* geysers(rng: Rng, s: Site, o: GeyserOpts): Generator<Piece> {
  const len = rollInt(rng, o.length);
  const spots: GeyserSpot[] = [];
  if (o.aim === 'side' || o.aim === 'down') spots.push(...aimedSpots(s, o.aim, len, o.width));
  else if (o.where === 'ground') {
    for (const r of s.groundRuns(Math.min(len, 4), 1))
      for (let x = r.x0; x <= r.x1; x++)
        spots.push({ x: x + 0.5, y: r.y + 1, angle: UP, score: (s.reachable(x, r.y) ? 2 : 0) + (x > r.x0 && x < r.x1 ? 0.5 : 0) });
  } else {
    for (let x = 1; x < s.w - 1; x++) {
      if (!s.overPit(x, 0) || !s.freeRect(x, s.h - 4, x, s.h - 1)) continue;
      let near = 0;
      for (let dx = -2; dx <= 2; dx++) for (let y = 0; y < s.h; y++) if (s.reachable(x + dx, y)) near++;
      spots.push({ x: x + 0.5, y: s.h, angle: UP, score: Math.min(3, near / 2) });
    }
  }
  for (const c of best(rng, spots, (c) => c.score)) {
    yield {
      name: o.name,
      archetype: o.archetype ?? (o.lethal ? 'flamer' : 'fan'),
      role: o.role ?? (o.lethal ? 'hazard' : 'utility'),
      style: o.style,
      modules: [
        {
          type: 'geyser',
          look: o.look,
          at: [c.x, c.y],
          angle: c.angle,
          width: o.width,
          length: len,
          off: rollInt(rng, o.off),
          warn: o.warn,
          on: rollInt(rng, o.on),
          lethal: o.lethal,
          strength: o.strength ?? 2600,
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Ground-standing machines: presses under a gantry, rooftop AC units, antenna pairs.

export function* presses(rng: Rng, s: Site, o: Common & { height: Range; width: Range; period: Range }): Generator<Piece> {
  const H = rollInt(rng, o.height);
  const W = rollInt(rng, o.width);
  const runs = s.groundRuns(H + 1, W + 2).filter((r) => s.zoneDist(Math.floor((r.x0 + r.x1) / 2), r.y) > SAFE_TILES);
  for (const run of best(rng, runs, (r) => (s.runReachable(r) ? 3 : 0))) {
    const x0 = run.x0 + rng.int(0, run.x1 - run.x0 + 1 - (W + 2));
    const by = run.y - H + 1;
    yield {
      name: o.name,
      archetype: 'crusher',
      role: 'hazard',
      style: o.style,
      crushOk: true,
      modules: [
        { type: 'deco', kind: 'press', at: [x0, by], w: W + 2, h: run.y + 1 - by, seed: rng.int(0, 1 << 20) },
        { type: 'piston', at: [x0 + 1 + W / 2, by + 0.5], angle: DOWN, reach: run.y - by - 0.5, width: W, period: rollInt(rng, o.period) },
      ],
    };
  }
}

export function* acUnits(rng: Rng, s: Site, o: Common & { length: Range; strength: Range }): Generator<Piece> {
  const rows = rng.chance(0.5) ? 1 : 2;
  const len = rollInt(rng, o.length);
  const runs = s.groundRuns(rows + 5, 2);
  const spots: { x: number; y: number }[] = [];
  for (const r of runs) for (let x = r.x0; x < r.x1; x++) spots.push({ x, y: r.y });
  for (const c of best(rng, spots, (c) => (s.reachable(c.x, c.y) || s.reachable(c.x + 1, c.y) ? 2 : 0) + (c.x > 0 && !s.ground(c.x - 1, c.y + 1) ? 0.5 : 0))) {
    const top = c.y - rows + 1;
    const cells: Cell[] = [];
    for (let y = top; y <= c.y; y++) for (let x = c.x; x <= c.x + 1; x++) cells.push([x, y]);
    const strength = roll(rng, o.strength);
    yield {
      name: o.name,
      archetype: 'fan',
      role: 'utility',
      style: o.style,
      // A 1–2 tile step on flat ground with ≥ 5 free rows above: always hop-able, never blocks the route.
      pathSafe: true,
      modules: [
        { type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
        { type: 'deco', kind: 'ac', at: [c.x, top], w: 2, h: rows, seed: rng.int(0, 1 << 20) },
        { type: 'fan', at: [c.x + 0.5, top + 0.5], angle: UP, length: len, strength },
        { type: 'fan', at: [c.x + 1.5, top + 0.5], angle: UP, length: len, strength },
      ],
    };
  }
}

export function* antennas(rng: Rng, s: Site, o: Common & { gap: Range; on: Range; off: Range }): Generator<Piece> {
  const D = rollInt(rng, o.gap);
  const runs = s.groundRuns(4, D + 1).filter((r) => s.zoneDist(Math.floor((r.x0 + r.x1) / 2), r.y) > SAFE_TILES);
  for (const run of best(rng, runs, (r) => (s.runReachable(r) ? 3 : 0))) {
    const x0 = run.x0 + rng.int(0, run.x1 - run.x0 - D);
    const top = run.y - 2;
    yield {
      name: o.name,
      archetype: 'tesla',
      role: 'hazard',
      style: o.style,
      modules: [
        { type: 'deco', kind: 'antenna', at: [x0, top], w: D + 1, h: 3, seed: rng.int(0, 1 << 20) },
        { type: 'tesla', a: [x0 + 0.5, top + 0.5], b: [x0 + D + 0.5, top + 0.5], on: rollInt(rng, o.on), off: rollInt(rng, o.off), warn: 36 },
      ],
    };
  }
}
