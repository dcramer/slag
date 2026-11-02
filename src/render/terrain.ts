import { css } from '../core/color';
import { Rng } from '../core/rng';
import { TILE } from '../sim/constants';
import { type Level, levelKey, T_ONEWAY, tileAt, type TileRect } from '../sim/level';
import { coatTerrain } from './weather';
import { DECOR, type Decor } from './decor';
import { capLoops, inkIce, inkIceTops } from './ink-ground';
import { inkFence, inkHay } from './ink-parts';
import {
  type Area,
  dirtyTiles,
  drawTufts,
  INK_CAPS,
  inkCap,
  inkContours,
  inkEdges,
  inkHatch,
  inkMaterial,
  inkPlatforms,
  inkUnder,
  inkVeins,
  makeTufts,
  type Tuft,
} from './ink-terrain';
import type { RC } from './kit';

export { flame } from './kit';

/**
 * Terrain, baked once and redrawn only where it changes: an ink drawing of the level (`ink-terrain.ts`),
 * with static decor, and the emissive veins that go with it. Animated bits (tufts, live decor) are
 * drawn per frame on top.
 */

/** Tiles a side of one chunk of a progressive bake: a few milliseconds of ink on the busiest materials. */
const CHUNK = 8;

export class TerrainPainter {
  private bakeKey = '';
  bake: HTMLCanvasElement | null = null;
  /** Emissive veins, when the material has them. */
  glowBake: HTMLCanvasElement | null = null;
  private decorKey = '';
  private decor: Decor[] = [];
  private live: Decor[] = [];
  /** World size in px of the baked level. */
  private ww = 0;
  private wh = 0;
  /** Debug: bake whole levels, to compare a partial redraw against the truth (`pnpm shot inkblast`). */
  fullBakes = false;
  private tufts: Tuft[] = [];
  private inkLayers: (HTMLCanvasElement | undefined)[] = [];
  private flip = 0;
  /** The tiles the ink bake last drew, and which level and look they belong to: all a partial redraw needs. */
  private inkTiles: Uint8Array | null = null;
  private inkKey = '';

  /** Tile rects still to ink on a progressive bake, nearest the camera first. */
  private queue: TileRect[] = [];
  private levelId = '';
  /** Tile rects inked by the last `ensure`, for callers that finish them off (the surroundings' haze). */
  baked: TileRect[] = [];
  /** True while a progressive bake is still under way. */
  get baking(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Bake `level` if anything changed; true if any of it was drawn. `skip` leaves decor out of a tile
   * rect (the surroundings' hole where the real level goes).
   *
   * A new level used to be inked in one go, which stalled the page for up to a second on a big one. With
   * a `budgetMs` it's inked a chunk at a time instead, nearest `focus` (tile coords) first, each frame
   * spending about that much: the shapes go down flat at once and the pen goes over them in a few
   * frames. Every chunk is a partial redraw, which is pixel-exact against a whole bake (`pnpm shot
   * inkblast`), so the finished picture is the same either way.
   */
  ensure(level: Level, kb: number, skip?: TileRect, budgetMs = Infinity, focus?: { x: number; y: number }): boolean {
    this.baked = [];
    const th = level.theme;
    const dk = `${levelKey(level)}:${th.seed}:${th.id}`;
    if (dk !== this.decorKey) {
      this.decorKey = dk;
      this.makeDecor(level, skip);
      this.bakeKey = '';
    }
    // levelKey: a same-seed regen under other rules is another level, so it gets a full bake, never a patch.
    const look = `${th.seed}:${th.id}:${th.name}:${kb.toFixed(2)}:${levelKey(level)}`;
    const bk = `${look}:${level.version}`;
    if (bk === this.bakeKey) return this.pump(level, kb, budgetMs);
    this.bakeKey = bk;
    // The same level with some tiles gone: redraw what changed. A bomb must not cost a whole bake.
    if (this.bake && look === this.inkKey && this.inkTiles && !this.fullBakes) {
      const dirty = dirtyTiles(this.inkTiles, level.tiles, level.w, level.h);
      this.inkTiles = level.tiles.slice();
      if (dirty && this.queue.length) this.queue.unshift(dirty);
      else if (dirty) {
        this.bakeInk(this.bake.getContext('2d')!, level, kb, this.solidOf(level), dirty);
        this.baked.push(dirty);
      }
      return this.pump(level, kb, budgetMs) || !!dirty;
    }
    this.inkKey = look;
    this.inkTiles = level.tiles.slice();
    // The same level at a new resolution (a resize) has nothing new to show: bake it whole, as before.
    const fresh = dk !== this.levelId;
    this.levelId = dk;
    if (!fresh || budgetMs === Infinity) {
      this.queue = [];
      this.bakeTerrain(level, kb);
      this.baked.push({ x: 0, y: 0, w: level.w, h: level.h });
      return true;
    }
    this.startProgressive(level, kb, focus ?? { x: level.w / 2, y: level.h / 2 });
    this.pump(level, kb, budgetMs);
    return true;
  }

  /** Size the canvas, lay the level down as flat shapes, and queue its chunks for the pen. */
  private startProgressive(level: Level, kb: number, focus: { x: number; y: number }) {
    this.ww = level.w * TILE;
    this.wh = level.h * TILE;
    const c = (this.bake ??= document.createElement('canvas'));
    c.width = Math.ceil(this.ww * kb);
    c.height = Math.ceil(this.wh * kb);
    const g = c.getContext('2d')!;
    g.setTransform(kb, 0, 0, kb, 0, 0);
    g.clearRect(0, 0, this.ww, this.wh);
    const solid = this.solidOf(level);
    g.fillStyle = css(level.theme.terrain.base);
    for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) if (solid(x, y)) g.fillRect(x * TILE, y * TILE, TILE, TILE);
    if (this.glowBake) this.glowBake.getContext('2d')!.clearRect(0, 0, this.glowBake.width, this.glowBake.height);
    this.tufts = [];
    const q: TileRect[] = [];
    for (let y = 0; y < level.h; y += CHUNK)
      for (let x = 0; x < level.w; x += CHUNK) q.push({ x, y, w: Math.min(CHUNK, level.w - x), h: Math.min(CHUNK, level.h - y) });
    const d = (r: TileRect) => Math.hypot(r.x + r.w / 2 - focus.x, r.y + r.h / 2 - focus.y);
    this.queue = q.sort((a, b) => d(a) - d(b));
  }

  /** Ink queued chunks until `budgetMs` is spent (at least one); true if any were. */
  private pump(level: Level, kb: number, budgetMs: number): boolean {
    if (!this.queue.length || !this.bake || budgetMs <= 0) return false;
    const t0 = performance.now();
    const g = this.bake.getContext('2d')!;
    const solid = this.solidOf(level);
    do {
      const r = this.queue.shift()!;
      this.bakeInk(g, level, kb, solid, r);
      this.baked.push(r);
    } while (this.queue.length && performance.now() - t0 < budgetMs);
    return true;
  }

  private bakeTerrain(level: Level, kb: number) {
    this.ww = level.w * TILE;
    this.wh = level.h * TILE;
    const c = (this.bake ??= document.createElement('canvas'));
    c.width = Math.ceil(this.ww * kb);
    c.height = Math.ceil(this.wh * kb);
    this.bakeInk(c.getContext('2d')!, level, kb, this.solidOf(level));
  }

  private solidOf(level: Level) {
    return (x: number, y: number) => tileAt(level, x, y) !== 0 && tileAt(level, x, y) !== T_ONEWAY && y < level.h;
  }

  /**
   * The terrain as an ink drawing (`ink-terrain.ts`), whole or just `tiles`. One path for both: the
   * clip and the layer sit on whole pixels, and nothing is resampled, so a partial redraw is pixel-exact.
   */
  private bakeInk(g: CanvasRenderingContext2D, level: Level, kb: number, solid: (x: number, y: number) => boolean, tiles?: TileRect) {
    const th = level.theme;
    const seed = th.seed ^ 0x1a4c;
    const { mask, loops } = inkContours(level, seed, solid, tiles);
    const W = g.canvas.width;
    const H = g.canvas.height;
    const px0 = tiles ? Math.floor(tiles.x * TILE * kb) : 0;
    const py0 = tiles ? Math.floor(tiles.y * TILE * kb) : 0;
    const px1 = tiles ? Math.min(W, Math.ceil((tiles.x + tiles.w) * TILE * kb)) : W;
    const py1 = tiles ? Math.min(H, Math.ceil((tiles.y + tiles.h) * TILE * kb)) : H;
    const area: Area = { x0: px0 / kb, y0: py0 / kb, x1: px1 / kb, y1: py1 / kb };
    // Paint on a layer and cut it once: thousands of small fills under a clip this complex take seconds.
    // Two layers, taken in turn and only ever grown: resizing or clearing a canvas the GPU still has a
    // draw queued from stalls the page until that draw is done, and chunk after chunk that's seconds.
    const lw = px1 - px0;
    const lh = py1 - py0;
    this.flip = 1 - this.flip;
    const layer = (this.inkLayers[this.flip] ??= document.createElement('canvas'));
    if (layer.width < lw || layer.height < lh) {
      layer.width = Math.max(layer.width, lw);
      layer.height = Math.max(layer.height, lh);
    }
    const lg = layer.getContext('2d')!;
    // A reused canvas keeps whatever state the painters left it in: they get a fresh one every time.
    lg.save();
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, lw, lh);
    lg.setTransform(kb, 0, 0, kb, -px0, -py0);
    inkMaterial(lg, level, th, seed, solid, area);
    inkIce(lg, level, th, seed, solid, area);
    inkHatch(lg, loops, th, seed, area);
    lg.globalCompositeOperation = 'destination-in';
    lg.fillStyle = '#000';
    // An empty path cuts nothing at all, so a stretch of open air (a chunk of sky) would keep its fill.
    if (loops.length) lg.fill(mask);
    else {
      lg.setTransform(1, 0, 0, 1, 0, 0);
      lg.clearRect(0, 0, lw, lh);
    }
    lg.restore();
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.beginPath();
    g.rect(px0, py0, px1 - px0, py1 - py0);
    g.clip();
    g.clearRect(px0, py0, px1 - px0, py1 - py0);
    g.drawImage(layer, 0, 0, lw, lh, px0, py0, lw, lh);
    g.setTransform(kb, 0, 0, kb, 0, 0);
    inkEdges(g, loops, th, seed, area);
    inkCap(g, capLoops(level, loops), th.terrain, seed, area);
    inkUnder(g, loops, th.terrain, seed, area);
    inkIceTops(g, level, th, seed, loops, area);
    inkPlatforms(g, level, th, seed, solid, area);
    // A partial trace only knows the ground around it: keep every tuft past that and replace the rest.
    const fresh = INK_CAPS[th.terrain.cap].tufts ? makeTufts(loops, seed, this.decor) : [];
    this.tufts = tiles
      ? [
          ...this.tufts.filter((t) => t.x < area.x0 || t.x > area.x1 || t.y < area.y0 || t.y > area.y1),
          ...fresh.filter((t) => t.x >= area.x0 && t.x <= area.x1 && t.y >= area.y0 && t.y <= area.y1),
        ]
      : fresh;
    for (const d of this.decor) {
      if (!tileAt(level, d.tx, d.ty)) continue;
      const def = DECOR[d.kind];
      if (!def.bake || d.x + 96 < area.x0 || d.x - 96 > area.x1 || d.y + 96 < area.y0 || d.y - 96 > area.y1) continue;
      g.save();
      if (d.kind === 'haybale') inkHay(g, d);
      else if (d.kind === 'fence') inkFence(g, d);
      else def.bake(g, d, th);
      g.restore();
    }
    coatTerrain(g, level, area);
    g.restore();
    this.bakeVeins(level, kb, solid, mask, area, px0, py0, px1 - px0, py1 - py0);
  }

  /** The emissive half of an ink bake: veins, cut to the same shape as the terrain. */
  private bakeVeins(
    level: Level,
    kb: number,
    solid: (x: number, y: number) => boolean,
    mask: Path2D,
    area: Area,
    px: number,
    py: number,
    pw: number,
    ph: number,
  ) {
    const th = level.theme;
    if (!th.terrain.veins) {
      this.glowBake = null;
      return;
    }
    const gc = (this.glowBake ??= document.createElement('canvas'));
    if (gc.width !== this.bake!.width || gc.height !== this.bake!.height) {
      gc.width = this.bake!.width;
      gc.height = this.bake!.height;
    }
    const gg = gc.getContext('2d')!;
    gg.save();
    gg.setTransform(1, 0, 0, 1, 0, 0);
    gg.beginPath();
    gg.rect(px, py, pw, ph);
    gg.clip();
    gg.clearRect(px, py, pw, ph);
    gg.setTransform(kb, 0, 0, kb, 0, 0);
    inkVeins(gg, level, th, th.seed ^ 0x1a4c, solid, area);
    gg.globalCompositeOperation = 'destination-in';
    gg.fillStyle = '#000';
    gg.fill(mask);
    gg.restore();
  }

  private makeDecor(level: Level, skip?: TileRect) {
    const th = level.theme;
    const rng = new Rng(level.seed ^ 0xdec0);
    this.decor = [];
    const solid = (x: number, y: number) => tileAt(level, x, y) !== 0 && tileAt(level, x, y) !== T_ONEWAY;
    const air = (x: number, y: number) => tileAt(level, x, y) === 0 && x >= 0 && x < level.w;
    const near = (tx: number, ty: number, p: { tx: number; ty: number }) => Math.abs(tx - p.tx) <= 1 && ty >= p.ty && ty <= p.ty + 2;
    const tops = th.decor.filter((k) => DECOR[k].place === 'top');
    const unders = th.decor.filter((k) => DECOR[k].place === 'under');
    const pick = (list: typeof th.decor) => {
      let total = 0;
      for (const k of list) total += DECOR[k].weight;
      let r = rng.next() * total;
      for (const k of list) {
        r -= DECOR[k].weight;
        if (r < 0) return k;
      }
      return list[list.length - 1];
    };
    const taken = new Set<number>();
    for (let ty = 1; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (!solid(tx, ty)) continue;
        if (skip && tx >= skip.x && tx < skip.x + skip.w && ty >= skip.y && ty < skip.y + skip.h) continue;
        const top = air(tx, ty - 1);
        const under = ty < level.h - 1 && air(tx, ty + 1);
        const roll = rng.next();
        const spot = near(tx, ty - 1, level.spawn) || near(tx, ty - 1, level.goal);
        if (top && tops.length && roll < th.decorDensity && !spot && !taken.has(ty * level.w + tx)) {
          const kind = pick(tops);
          const def = DECOR[kind];
          let ok = true;
          for (let k = 1; k <= def.clear; k++) if (!air(tx, ty - k)) ok = false;
          if (ok) {
            let span = 1;
            if (kind === 'fence') {
              while (span < 4 && solid(tx + span, ty) && air(tx + span, ty - 1) && !taken.has(ty * level.w + tx + span)) span++;
              if (span < 2) ok = false;
            }
            if (ok) {
              for (let k = 0; k < span; k++) taken.add(ty * level.w + tx + k);
              this.decor.push({
                kind,
                x: kind === 'fence' ? tx * TILE + 1 : tx * TILE + rng.range(4, 12),
                y: ty * TILE,
                tx,
                ty,
                seed: rng.int(0, 1e9),
                size: rng.range(0.85, 1.25),
                span,
                color: def.color(th, rng),
                flip: rng.chance(0.5),
              });
            }
          }
        }
        if (under && unders.length && rng.chance(th.decorDensity * 0.9)) {
          const kind = pick(unders);
          const def = DECOR[kind];
          let ok = true;
          for (let k = 1; k <= def.clear; k++) if (!air(tx, ty + k)) ok = false;
          if (ok)
            this.decor.push({
              kind,
              x: tx * TILE + rng.range(3, 13),
              y: (ty + 1) * TILE,
              tx,
              ty,
              seed: rng.int(0, 1e9),
              size: rng.range(0.85, 1.3),
              span: 1,
              color: def.color(th, rng),
              flip: rng.chance(0.5),
            });
        }
      }
    }
    this.live = this.decor.filter((d) => DECOR[d.kind].live);
  }

  draw(rc: RC) {
    if (!this.bake) return;
    rc.s.drawImage(this.bake, 0, 0, this.ww, this.wh);
    // Terrain occludes background emissives (skyline windows, lava glow) drawn earlier.
    rc.g.globalCompositeOperation = 'destination-out';
    rc.g.drawImage(this.bake, 0, 0, this.ww, this.wh);
    rc.g.globalCompositeOperation = 'lighter';
    if (this.glowBake) {
      rc.g.globalAlpha = 0.5 + Math.sin(rc.t * 1.7) * 0.15;
      rc.g.drawImage(this.glowBake, 0, 0, this.ww, this.wh);
      rc.g.globalAlpha = 1;
    }
  }

  /** Per-frame: swaying grass (parted by players), decor with animated/emissive bits. */
  drawLive(rc: RC, level: Level, pushers: { x: number; y: number }[]) {
    drawTufts(rc, rc.s, this.tufts, level, level.theme.terrain.capColor, pushers);
    const th = level.theme;
    for (const d of this.live) {
      if (!tileAt(level, d.tx, d.ty)) continue;
      rc.s.save();
      DECOR[d.kind].live!(rc, d, th);
      rc.s.restore();
    }
  }
}
