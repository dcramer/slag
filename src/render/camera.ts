import { clamp } from '../core/geom';
import { VIEW_H, VIEW_W } from '../sim/constants';

/** Smoothed 2D camera over the fixed-size world. Zoom >= 1, always keeps the view inside the world. */
export class Camera {
  x = VIEW_W / 2;
  y = VIEW_H / 2;
  zoom = 1;
  private tx = VIEW_W / 2;
  private ty = VIEW_H / 2;
  private tz = 1;
  shake = 0;
  private sx = 0;
  private sy = 0;

  /** Frame the given points (or the whole world if empty), capping zoom. */
  focus(points: { x: number; y: number }[], maxZoom = 1.4, pad = 110) {
    if (points.length === 0) {
      this.tx = VIEW_W / 2;
      this.ty = VIEW_H / 2;
      this.tz = 1;
      return;
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of points) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    const w = x1 - x0 + pad * 2;
    const h = y1 - y0 + pad * 2;
    this.tz = clamp(Math.min(VIEW_W / w, VIEW_H / h), 1, maxZoom);
    this.tx = (x0 + x1) / 2;
    this.ty = (y0 + y1) / 2;
  }

  wide() {
    this.focus([]);
  }

  update(dt: number) {
    const k = 1 - Math.exp(-dt * 3.2);
    this.zoom += (this.tz - this.zoom) * k;
    const hw = VIEW_W / (2 * this.zoom);
    const hh = VIEW_H / (2 * this.zoom);
    const tx = clamp(this.tx, hw, VIEW_W - hw);
    const ty = clamp(this.ty, hh, VIEW_H - hh);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.x = clamp(this.x, hw, VIEW_W - hw);
    this.y = clamp(this.y, hh, VIEW_H - hh);
    this.shake *= Math.exp(-dt * 7);
    if (this.shake < 0.05) this.shake = 0;
    this.sx = (Math.random() - 0.5) * this.shake;
    this.sy = (Math.random() - 0.5) * this.shake;
  }

  /** Canvas transform mapping world → buffer pixels for a buffer `pw` px wide. */
  apply(ctx: CanvasRenderingContext2D, pw: number) {
    const k = (pw / VIEW_W) * this.zoom;
    ctx.setTransform(k, 0, 0, k, pw / 2 - (this.x + this.sx) * k, (pw * VIEW_H) / VIEW_W / 2 - (this.y + this.sy) * k);
  }

  /** World → normalized screen (0..1). */
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.x) * this.zoom / VIEW_W + 0.5, y: (y - this.y) * this.zoom / VIEW_H + 0.5 };
  }
}
