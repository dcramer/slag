import { TILE } from '../sim/constants';
import { type Level, T_ONEWAY } from '../sim/level';

/** World px a light reaches into solid ground: a lit rim on the surface, then rock in its own tone. */
const REACH = 20;
/** Mask px per tile: the cel pass cuts light into bands and the mask is drawn smoothed, so it needs no detail. */
const RES = 4;
/** Tiles past the world's edge the mask covers, as far as a light near the edge can reach into the surroundings. */
const MARGIN = 7;

/**
 * Light doesn't soak into rock. Without this a lamp hung under a thick ceiling paints a disc into the
 * solid ground, and the cel pass cuts that disc into big concentric bands across the wall: the mine's
 * lanterns drew targets on every ceiling. The mask holds solid ground by how far it is from any open
 * tile, in the ambient color: painted over the light map it puts deep ground back at ambient, so a
 * light catches the faces it can see and stops.
 *
 * It's written as pixels, not paths: a path of a few thousand rounded rects costs the GPU a stall of a
 * quarter second on a big level, and this is a few milliseconds of arithmetic.
 */
export class LightOccluder {
  private canvas: HTMLCanvasElement | null = null;
  private key = '';

  private ensure(level: Level, rgb: readonly [number, number, number]) {
    const key = `${level.seed}:${level.w}x${level.h}:${level.version}:${rgb.join(',')}`;
    if (key === this.key && this.canvas) return this.canvas;
    this.key = key;
    const tw = level.w + MARGIN * 2;
    const th = level.h + MARGIN * 2;
    const c = (this.canvas ??= document.createElement('canvas'));
    c.width = tw * RES;
    c.height = th * RES;
    // Past the edges, the edge tiles carry on: that's what the surroundings draw there.
    const open = (x: number, y: number) => {
      const t = level.tiles[Math.min(level.h - 1, Math.max(0, y - MARGIN)) * level.w + Math.min(level.w - 1, Math.max(0, x - MARGIN))];
      return t === 0 || t === T_ONEWAY;
    };
    const air = new Uint8Array(tw * th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) air[y * tw + x] = open(x, y) ? 1 : 0;
    const img = new ImageData(c.width, c.height);
    const px = img.data;
    const reach = Math.ceil(REACH / TILE) + 1;
    for (let y = 0; y < c.height; y++) {
      const ty = Math.floor(y / RES);
      const wy = ((y + 0.5) / RES) * TILE;
      for (let x = 0; x < c.width; x++) {
        const tx = Math.floor(x / RES);
        if (air[ty * tw + tx]) continue;
        const wx = ((x + 0.5) / RES) * TILE;
        // Distance from this point to the nearest open tile.
        let d = REACH;
        for (let oy = Math.max(0, ty - reach); oy <= Math.min(th - 1, ty + reach); oy++) {
          for (let ox = Math.max(0, tx - reach); ox <= Math.min(tw - 1, tx + reach); ox++) {
            if (!air[oy * tw + ox]) continue;
            const dx = Math.max(ox * TILE - wx, 0, wx - (ox + 1) * TILE);
            const dy = Math.max(oy * TILE - wy, 0, wy - (oy + 1) * TILE);
            d = Math.min(d, Math.hypot(dx, dy));
          }
        }
        const i = (y * c.width + x) * 4;
        px[i] = rgb[0];
        px[i + 1] = rgb[1];
        px[i + 2] = rgb[2];
        px[i + 3] = Math.round(255 * Math.pow(d / REACH, 1.3));
      }
    }
    c.getContext('2d')!.putImageData(img, 0, 0);
    return c;
  }

  /** Over the light map, already in world transform: deep solid ground goes back to the ambient `rgb`. */
  draw(l: CanvasRenderingContext2D, level: Level, rgb: readonly [number, number, number]) {
    const m = MARGIN * TILE;
    l.imageSmoothingEnabled = true;
    l.drawImage(this.ensure(level, rgb), -m, -m, (level.w + MARGIN * 2) * TILE, (level.h + MARGIN * 2) * TILE);
  }
}
