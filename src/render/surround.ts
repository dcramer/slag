import { Rng } from '../core/rng';
import { TILE } from '../sim/constants';
import { type Level, T_SOLID, levelKey } from '../sim/level';
import { FLOATS } from '../themes';
import type { RC } from './kit';
import { TerrainPainter } from './terrain';

/**
 * The land around the level. The camera may show plenty past the world's
 * edge: the sides of a tower in the pick overview, the margins of an
 * ultrawide. Past the left and right edges there's nothing to stand on (the
 * sim's sides are open air, and leaving is death), so nothing is drawn there:
 * the level's ground ends in its own face at the edge, and the sky and the
 * pool carry on past it. Out there it reads as a drop, never as more ground.
 *
 * Above and below the world it carries on. A ceiling on the top row runs on
 * up a little (a mine's rock all the way). Whatever stands on the bottom row
 * runs on down, and the pool carries on with it. Those columns are only ever
 * seen through the liquid (`drawSunken`), so there's still one unbroken
 * surface at the kill line and nothing down there looks like somewhere to
 * land. Where the ground floats (`FLOATS`: space), nothing runs on up or down.
 *
 * None of it is drawn inside the level, past the ring at its edge: the play
 * area shows the level's own ground and nothing else.
 *
 * This is scenery. It's built from the level's tiles but never fed back; the
 * sim still sees only the level.
 */

/** Tiles of real level copied around the edge so the seam joins (hidden under the level itself). */
const RING = 2;

/**
 * The surroundings of `level` as a level of their own: `mx` extra columns each
 * side (left empty), `top` extra rows above, `bottom` below, the real level left
 * out but for a ring at its edge. World tile (x, y) is scenery tile (x + mx, y + top).
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
    this.painter.ensure(land, kb, inner, budgetMs, at);
  }

  /** True while the surroundings are still being inked a chunk at a time. */
  get baking(): boolean {
    return this.painter.baking;
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
