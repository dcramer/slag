import { css } from '../core/color';
import { Rng } from '../core/rng';
import { TILE } from '../sim/constants';
import { type Level, type TileRect, T_SOLID, levelKey } from '../sim/level';
import { FLOATS, type ThemeId } from '../themes';
import type { RC } from './kit';
import { TerrainPainter } from './terrain';

/**
 * The land around the level. Past the world's edge the sim has a solid wall
 * and the camera may still show plenty: the sides of a tower in the pick
 * overview, the margins of an ultrawide. So the world doesn't end in a line:
 * it stands in a landscape of its own material, painted by the same terrain
 * painter so caps, decor and lighting match across the seam, rising at the
 * edge where the sim's wall is and falling away into haze behind it.
 *
 * Below the world it's simpler: whatever stands on the bottom row just runs on
 * down, and the pool carries on with it. Those columns are only ever seen
 * through the liquid (`drawSunken`), so there's still one unbroken surface at
 * the kill line and nothing down there looks like somewhere to land. Where the
 * ground floats (`FLOATS`: space), nothing runs on up or down at all.
 *
 * None of it is drawn inside the level, past the ring at its edge: the play
 * area shows the level's own ground and nothing else.
 *
 * This is scenery. It's built from the level's tiles but never fed back; the
 * sim still sees only the level.
 */

/** Tiles of real level copied around the edge so the seam joins (hidden under the level itself). */
const RING = 2;
/** World px over which scenery fades into the theme's haze. */
const HAZE_REACH = 460;
/** World px over which glowing veins die out past the seam. */
const GLOW_REACH = 150;

/** Sculpts one side's columns. `d` counts columns outward from the edge, from 1. */
interface SideCtx {
  rng: Rng;
  /** Row of the ground that side stands on. */
  ground: number;
  /** Columns on this side. */
  cols: number;
  /** World rows of the side, top to bottom (the top one may be above the level). */
  rows: [number, number];
  /** Solid from `top` (a world row, may be above the level) down to the bottom, in column `d`. */
  fill(d: number, top: number): void;
  /** Cut or set one tile in column `d`. */
  set(d: number, y: number, solid: boolean): void;
  /** Smooth noise in [-1, 1] along the side. */
  wave(d: number): number;
}

/** Rolling land: crests near the edge, where the sim's wall is, then falls away. */
function ridge(c: SideCtx, rise: number, rough: number, jag = 0): void {
  for (let d = 1; d <= c.cols; d++) {
    const crest = Math.min(1, d / 3) * Math.max(0.28, 1 - d / Math.max(16, c.cols * 0.9));
    const teeth = jag && d % 2 ? c.rng.int(0, jag) : 0;
    c.fill(d, Math.round(c.ground - rise * crest - rough * c.wave(d) - teeth));
  }
}

/**
 * A low step or two at the seam; returns the first column past it. A block
 * standing right at the edge drew a straight wall down the whole side of the
 * map: set back by a step, its face reads as a building in the landscape.
 */
function plinth(c: SideCtx): number {
  const n = Math.min(c.cols, c.rng.int(2, 3));
  for (let d = 1; d <= n; d++) c.fill(d, c.ground - (d - 1) - c.rng.int(0, 1));
  return n + 1;
}

/** Blocks: buildings, walls and plant, each a flat-topped run of columns, set back from the seam by a plinth. */
function blocks(c: SideCtx, width: [number, number], height: [number, number], then?: (d0: number, d1: number, top: number) => void): void {
  for (let d = plinth(c); d <= c.cols;) {
    const w = c.rng.int(width[0], width[1]);
    const fade = Math.max(0.35, 1 - d / Math.max(20, c.cols));
    const top = c.ground - Math.round(c.rng.int(height[0], height[1]) * fade);
    for (let i = d; i < d + w && i <= c.cols; i++) c.fill(i, top);
    then?.(d, Math.min(c.cols, d + w - 1), top);
    d += w;
  }
}

/** Every theme's way of carrying on past the edge of the map. */
const SIDES: Record<ThemeId, (c: SideCtx) => void> = {
  farm: (c) => ridge(c, 8, 2),
  jungle: (c) => ridge(c, 11, 3),
  volcano: (c) => ridge(c, 13, 3, 2),
  mine: (c) => {
    // Inside the mountain: rock in every direction, honeycombed with old workings.
    for (let d = 1; d <= c.cols; d++) c.fill(d, -1e4);
    const area = c.cols * (c.rows[1] - c.rows[0]);
    for (let i = Math.round(area / 90); i > 0; i--) {
      const cx = c.rng.int(4, Math.max(4, c.cols));
      const cy = c.rng.int(c.rows[0], c.rows[1]);
      const rx = c.rng.int(3, 8);
      const ry = c.rng.int(2, 3);
      for (let y = -ry; y <= ry; y++) {
        const span = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 1)));
        for (let d = cx - span; d <= cx + span; d++) if (d >= 2) c.set(d, cy + y, false);
      }
    }
  },
  castle: (c) =>
    blocks(c, [5, 9], [8, 13], (a, b, top) => {
      for (let d = a; d <= b; d += 2) c.set(d, top - 1, true); // Merlons.
    }),
  factory: (c) => blocks(c, [4, 8], [7, 13]),
  rooftops: (c) =>
    blocks(c, [5, 9], [4, 12], (a, b, top) => {
      // A facade of windows, the same 1×1 holes the level's buildings have.
      for (let y = top + 2; y < c.ground + 6; y += 2) for (let d = a + 1; d < b; d += 2) c.set(d, y, false);
    }),
  // Moraine slopes climbing to a jagged crest.
  glacier: (c) => ridge(c, 12, 3, 1),
  // No ground out there, and nothing standing on it: bodies adrift like the level's own, and debris between.
  space: (c) => {
    const [r0, r1] = c.rows;
    // Bodies: a flat top to land on (by the look of it) over a keel that narrows as it goes down.
    for (let i = Math.max(1, Math.round(c.cols / 12)); i > 0; i--) {
      const w = c.rng.int(3, 6);
      const d = c.rng.int(2, Math.max(2, c.cols - w));
      const y = c.rng.int(r0 + 3, Math.max(r0 + 3, r1 - 5));
      const keel = c.rng.int(1, 2);
      for (let j = 0; j <= keel; j++) for (let k = j; k < w - j; k++) c.set(d + k, y + j, true);
    }
    // Debris: a tile or two, here and there.
    for (let i = Math.round((c.cols * (r1 - r0)) / 110); i > 0; i--) {
      const d = c.rng.int(2, Math.max(2, c.cols));
      const y = c.rng.int(r0 + 2, Math.max(r0 + 2, r1 - 3));
      c.set(d, y, true);
      if (c.rng.chance(0.5)) c.set(d + 1, y, true);
    }
  },
  harbor: (c) => {
    // Quay, a dock shed on it, more quay, then open water.
    const quay = Math.min(c.cols, c.rng.int(2, 3));
    const shed = Math.min(c.cols, quay + c.rng.int(4, 6));
    for (let d = 1; d <= c.cols; d++) {
      if (d > quay && d <= shed) c.fill(d, c.ground - 7);
      else if (d <= shed + 2) c.fill(d, c.ground);
    }
  },
};

/**
 * The surroundings of `level` as a level of their own: `mx` extra columns each
 * side, `top` extra rows above, `bottom` below, the real level left out but for
 * a ring at its edge. World tile (x, y) is scenery tile (x + mx, y + top).
 */
export function surroundLevel(level: Level, mx: number, top: number, bottom = 0): Level {
  const { w, h } = level;
  const W = w + mx * 2;
  const H = h + top + bottom;
  const tiles = new Uint8Array(W * H);
  const put = (x: number, y: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x] = T_SOLID;
  };
  const solidAt = (x: number, y: number) => level.tiles[y * w + x] === T_SOLID;
  const rng = new Rng(level.seed ^ 0x517d);
  const lowest = Math.max(level.spawn.ty, level.goal.ty) + 1;
  // Towers stand on the ground; a horizontal level's sides carry on from its pockets.
  const tall = level.profile?.size === 'tall';
  const sides = [
    { edge: (d: number) => mx - d, ground: tall ? lowest : level.spawn.ty + 1, col: 0 },
    { edge: (d: number) => mx + w - 1 + d, ground: tall ? lowest : level.goal.ty + 1, col: w - 1 },
  ];
  for (const side of sides) {
    const lat = Array.from({ length: Math.ceil(mx / 6) + 3 }, () => rng.range(-1, 1));
    const wave = (d: number) => {
      const f = d / 6;
      const i = Math.floor(f);
      const t = f - i;
      const u = t * t * (3 - 2 * t);
      return lat[i] * (1 - u) + lat[i + 1] * u;
    };
    const ctx: SideCtx = {
      rng,
      ground: side.ground,
      cols: mx,
      rows: [-top, h - 1],
      wave,
      // Out of `1..cols`, a column isn't this side's: past the far edge, or inside the level itself.
      fill: (d, row) => {
        if (d < 1 || d > mx) return;
        for (let y = Math.max(0, row + top); y < H; y++) put(side.edge(d), y);
      },
      set: (d, y, solid) => {
        const Y = y + top;
        if (d < 1 || d > mx || Y < 0 || Y >= H) return;
        tiles[Y * W + side.edge(d)] = solid ? T_SOLID : 0;
      },
    };
    SIDES[level.theme.id](ctx);
    // Whatever reaches the world's edge carries on a little, so nothing ends in a cut.
    for (let y = 0; y < h; y++) {
      if (!solidAt(side.col, y)) continue;
      const reach = Math.min(mx, rng.int(2, 4));
      for (let d = 1; d <= reach; d++) put(side.edge(d), y + top);
    }
  }
  if (!FLOATS.has(level.theme.id)) {
    // Ceilings carry on upward (a mine's rock, a canopy), then break up.
    for (let x = 0; x < w; x++) {
      if (!solidAt(x, 0)) continue;
      const reach = level.theme.id === 'mine' ? top : Math.min(top, rng.int(2, 5));
      for (let y = 1; y <= reach; y++) put(x + mx, top - y);
    }
    // What stands on the bottom row runs on down.
    for (let x = 0; x < w; x++) {
      if (!solidAt(x, h - 1)) continue;
      for (let y = h; y < h + bottom; y++) put(x + mx, y + top);
    }
  }
  // The ring: real tiles under the level's own edge, so neighbours join.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= RING && x < w - RING && y >= RING && (bottom === 0 || y < h - RING)) continue;
      if (solidAt(x, y)) put(x + mx, y + top);
    }
  }
  return {
    ...level,
    w: W,
    h: H,
    tiles,
    seed: level.seed ^ 0x51de,
    version: 0,
    spawn: { tx: -99, ty: -99 },
    goal: { tx: -99, ty: -99 },
    protectedRects: [],
    setPieces: [],
    // The level's own ground is indexed by its own size; out here it's all plain.
    ground: undefined,
  };
}

/** Bakes and draws the surroundings. Only as much as the window can ever show of them. */
export class Surround {
  private painter = new TerrainPainter();
  private land: Level | null = null;
  private key = '';
  private mx = 0;
  private top = 0;
  private bottom = 0;
  /** Everywhere but the level's middle (`draw`), and the land it was made for. */
  private hole: Path2D | null = null;
  private holeFor: Level | null = null;

  /** World px of scenery on each side. */
  get margin(): number {
    return this.mx * TILE;
  }

  /** `reach`: how far past the world the frame reaches at its most zoomed out, in world px (`frameReach`). */
  ensure(level: Level, reach: { x: number; up: number; down: number }, kb: number, budgetMs = Infinity, focus?: { x: number; y: number }) {
    const mx = Math.ceil(reach.x / TILE) + 2;
    const top = Math.ceil(reach.up / TILE) + 2;
    const bottom = Math.ceil(reach.down / TILE) + 2;
    const key = `${levelKey(level)}:${level.theme.seed}:${mx}:${top}:${bottom}`;
    if (key !== this.key) {
      this.key = key;
      this.mx = mx;
      this.top = top;
      this.bottom = bottom;
      this.land = surroundLevel(level, mx, top, bottom);
    }
    const land = this.land!;
    const inner = { x: mx + RING, y: top + RING, w: level.w - RING * 2, h: level.h - RING };
    const at = focus && { x: focus.x / TILE + mx, y: focus.y / TILE + top };
    if (this.painter.ensure(land, kb, inner, budgetMs, at)) for (const r of this.painter.baked) this.haze(level, land, r);
  }

  /** True while the surroundings are still being inked a chunk at a time. */
  get baking(): boolean {
    return this.painter.baking;
  }

  /** Atmospheric depth: scenery recedes from the seam into the theme's haze (a mine into the dark). */
  private haze(level: Level, land: Level, r: TileRect) {
    const bake = this.painter.bake;
    if (!bake) return;
    const th = level.theme;
    const g = bake.getContext('2d')!;
    const k = bake.width / (land.w * TILE);
    // Only what was just inked: the rest is hazed already, and haze twice is a different color.
    // The same pixel rect a partial bake clears, so chunk seams line up.
    const clip = (c: CanvasRenderingContext2D) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      const px0 = Math.floor(r.x * TILE * k);
      const py0 = Math.floor(r.y * TILE * k);
      c.beginPath();
      c.rect(px0, py0, Math.min(bake.width, Math.ceil((r.x + r.w) * TILE * k)) - px0, Math.min(bake.height, Math.ceil((r.y + r.h) * TILE * k)) - py0);
      c.clip();
    };
    const mine = th.id === 'mine';
    const tint = mine ? th.terrain.outline : th.fog;
    const left = this.mx * TILE;
    const right = (this.mx + level.w) * TILE;
    g.save();
    clip(g);
    g.setTransform(k, 0, 0, k, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    for (const [seam, dir] of [
      [left, -1],
      [right, 1],
    ] as const) {
      const gr = g.createLinearGradient(seam, 0, seam + dir * HAZE_REACH, 0);
      gr.addColorStop(0, css(tint, 0, 0.1));
      gr.addColorStop(0.2, css(tint, 0, 0.32));
      gr.addColorStop(1, css(tint, 0, mine ? 0.62 : 0.82));
      g.fillStyle = gr;
      if (dir < 0) g.fillRect(0, 0, seam, land.h * TILE);
      else g.fillRect(seam, 0, land.w * TILE - seam, land.h * TILE);
    }
    g.restore();
    // Veins are light, so tinting the rock doesn't touch them: they have to go out on their own,
    // and quickly, or their texture reads as a pattern across a big expanse.
    const glow = this.painter.glowBake?.getContext('2d');
    if (!glow) return;
    glow.save();
    clip(glow);
    glow.setTransform(k, 0, 0, k, 0, 0);
    glow.globalCompositeOperation = 'destination-out';
    for (const [seam, dir] of [
      [left, -1],
      [right, 1],
    ] as const) {
      const gr = glow.createLinearGradient(seam, 0, seam + dir * GLOW_REACH, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0.2)');
      gr.addColorStop(1, 'rgba(0,0,0,1)');
      glow.fillStyle = gr;
      if (dir < 0) glow.fillRect(0, 0, seam, land.h * TILE);
      else glow.fillRect(seam, 0, land.w * TILE - seam, land.h * TILE);
    }
    glow.restore();
  }

  /**
   * The rows from the level's bottom edge on down, for the pool to show through
   * itself. In world space; the caller clips to the liquid. It's the bake `draw`
   * already made, so this costs one blit and nothing at load.
   */
  drawSunken(s: CanvasRenderingContext2D, level: Level) {
    const bake = this.painter.bake;
    const land = this.land;
    if (!bake || !land) return;
    const k = bake.height / (land.h * TILE);
    const sy = (this.top + level.h - RING) * TILE * k;
    s.drawImage(bake, 0, sy, bake.width, bake.height - sy, -this.mx * TILE, (level.h - RING) * TILE, land.w * TILE, (RING + this.bottom) * TILE);
  }

  /**
   * Cut the pool out where the scenery past either side stands in it. The pool
   * goes behind terrain, and scenery is terrain too, but it paints on the
   * background, under the pool's layer, so the pool has to make way. Above the
   * surface only (`dry`, from `Backdrop.drawLiquid`): under it, everything is
   * seen through the pool, so scenery goes under at the same line as the level's
   * own ground. Outside the world only, where the level's own terrain cuts
   * nothing. World space; call on both the albedo and the glow layer.
   */
  cutPool(c: CanvasRenderingContext2D, level: Level, rows: number, dry: Path2D) {
    const bake = this.painter.bake;
    const land = this.land;
    if (!bake || !land) return;
    const k = bake.height / (land.h * TILE);
    const r0 = Math.max(-this.top, level.h - rows);
    const n = level.h - r0;
    const sy = (this.top + r0) * TILE * k;
    const sw = this.mx * TILE * k;
    c.save();
    c.clip(dry);
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = 1;
    c.drawImage(bake, 0, sy, sw, n * TILE * k, -this.mx * TILE, r0 * TILE, this.mx * TILE, n * TILE);
    c.drawImage(bake, bake.width - sw, sy, sw, n * TILE * k, level.w * TILE, r0 * TILE, this.mx * TILE, n * TILE);
    c.restore();
  }

  /** In world space, before the level's own terrain. */
  draw(rc: RC) {
    const land = this.land;
    if (!land) return;
    const x = -this.mx * TILE;
    const y = -this.top * TILE;
    // The level's own terrain covers the ring, and inside it the play area is the level's alone: cut
    // a hole there, so whatever a bake might hold in the middle can't show up among the real ground.
    if (this.holeFor !== land) {
      this.holeFor = land;
      this.hole = new Path2D();
      this.hole.rect(-1e5, -1e5, 2e5, 2e5);
      const lw = land.w - this.mx * 2;
      const lh = land.h - this.top - this.bottom;
      this.hole.rect(RING * TILE, RING * TILE, (lw - RING * 2) * TILE, (lh - RING * 2) * TILE);
    }
    for (const c of [rc.s, rc.g]) {
      c.save();
      c.clip(this.hole!, 'evenodd');
      c.translate(x, y);
    }
    this.painter.draw(rc);
    this.painter.drawLive(rc, land, []);
    rc.s.restore();
    rc.g.restore();
  }
}
