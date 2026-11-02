import { TILE } from '../sim/constants';
import { type Level, T_ONEWAY } from '../sim/level';

/** World px a light reaches into solid ground: a lit rim on the surface, then rock in its own tone. */
const REACH = 20;
/** Mask resolution, px per world px: the cel pass cuts light into bands, so a soft mask needs no detail. */
const RES = 0.5;
/** Tiles past the world's edge the mask covers, as far as a light near the edge can reach into the surroundings. */
const MARGIN = 7;

/**
 * Light doesn't soak into rock. Without this a lamp hung under a thick ceiling paints a disc into the
 * solid ground, and the cel pass cuts that disc into big concentric bands across the wall: the mine's
 * lanterns drew targets on every ceiling. The mask holds solid tiles deeper than `REACH` from any open
 * tile, in the ambient color: painted over the light map it puts those back at ambient, so a light
 * catches the faces it can see and stops.
 */
export class LightOccluder {
  private canvas: HTMLCanvasElement | null = null;
  private key = '';

  private ensure(level: Level, ambient: string) {
    const key = `${level.seed}:${level.w}x${level.h}:${level.version}:${ambient}`;
    if (key === this.key && this.canvas) return this.canvas;
    this.key = key;
    const cw = (level.w + MARGIN * 2) * TILE;
    const ch = (level.h + MARGIN * 2) * TILE;
    const c = (this.canvas ??= document.createElement('canvas'));
    c.width = Math.ceil(cw * RES);
    c.height = Math.ceil(ch * RES);
    const g = c.getContext('2d')!;
    g.setTransform(RES, 0, 0, RES, MARGIN * TILE * RES, MARGIN * TILE * RES);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(-MARGIN * TILE, -MARGIN * TILE, cw, ch);
    // Past the edges, the edge tiles carry on: that's what the surroundings draw there.
    const solid = (x: number, y: number) => {
      const t = level.tiles[Math.min(level.h - 1, Math.max(0, y)) * level.w + Math.min(level.w - 1, Math.max(0, x))];
      return t !== 0 && t !== T_ONEWAY;
    };
    g.fillStyle = ambient;
    for (let y = -MARGIN; y < level.h + MARGIN; y++)
      for (let x = -MARGIN; x < level.w + MARGIN; x++) if (solid(x, y)) g.fillRect(x * TILE, y * TILE, TILE, TILE);
    // Cut away a soft band inside every face: three steps, outermost faintest, which the bands turn into a rim.
    g.globalCompositeOperation = 'destination-out';
    for (const [grow, a] of [
      [REACH, 0.45],
      [REACH * 0.66, 0.55],
      [REACH * 0.33, 0.8],
    ] as const) {
      g.globalAlpha = a;
      g.beginPath();
      for (let y = -MARGIN; y < level.h + MARGIN; y++) {
        for (let x = -MARGIN; x < level.w + MARGIN; x++) {
          if (!solid(x, y)) g.roundRect(x * TILE - grow, y * TILE - grow, TILE + grow * 2, TILE + grow * 2, grow);
        }
      }
      g.fill();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  /** Over the light map, already in world transform: deep solid ground goes back to `ambient`. */
  draw(l: CanvasRenderingContext2D, level: Level, ambient: string) {
    const m = MARGIN * TILE;
    l.drawImage(this.ensure(level, ambient), -m, -m, (level.w + MARGIN * 2) * TILE, (level.h + MARGIN * 2) * TILE);
  }
}
