import { clamp } from '../core/geom';
import type { ViewXform } from '../game/view';
import { VIEW_H, VIEW_W } from '../sim/constants';

/**
 * Smoothed 2D camera over a world of any size (`setBounds`). The view is
 * always VIEW_W×VIEW_H logical px. Zoom may drop below 1 to show more of a
 * big level; whenever the visible span is wider/taller than the world on an
 * axis, the camera centres the world on that axis (letterbox) instead of
 * showing past one edge.
 */
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
  /** World size in px. */
  ww = VIEW_W;
  wh = VIEW_H;
  /** Lowest zoom `focus` may pick (the fit-whole-level zoom, or a readability floor). */
  minZoom = 1;

  setBounds(ww: number, wh: number, minZoom: number) {
    if (ww !== this.ww || wh !== this.wh) {
      this.ww = ww;
      this.wh = wh;
      this.x = this.tx = ww / 2;
      this.y = this.ty = wh / 2;
    }
    this.minZoom = minZoom;
  }

  /** Frame the given points (or the whole world if empty), capping zoom. */
  focus(points: { x: number; y: number }[], maxZoom = 1.4, pad = 110) {
    if (points.length === 0) {
      this.wide();
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
    this.tz = clamp(Math.min(VIEW_W / w, VIEW_H / h), this.minZoom, Math.max(this.minZoom, maxZoom));
    this.tx = (x0 + x1) / 2;
    this.ty = (y0 + y1) / 2;
  }

  /** Show the whole world (down to minZoom). */
  wide() {
    this.tx = this.ww / 2;
    this.ty = this.wh / 2;
    this.tz = clamp(Math.min(VIEW_W / this.ww, VIEW_H / this.wh), this.minZoom, 1);
  }

  /** Jump straight to a deterministic mapping (pick/place overview): no smoothing, so ghosts sit under cursors. */
  snap(v: ViewXform) {
    this.x = this.tx = v.cx;
    this.y = this.ty = v.cy;
    this.zoom = this.tz = v.zoom;
  }

  private clampAxis(v: number, half: number, size: number): number {
    return half * 2 >= size ? size / 2 : clamp(v, half, size - half);
  }

  update(dt: number, smooth = true) {
    const k = smooth ? 1 - Math.exp(-dt * 3.2) : 1;
    this.zoom += (this.tz - this.zoom) * k;
    const hw = VIEW_W / (2 * this.zoom);
    const hh = VIEW_H / (2 * this.zoom);
    const tx = this.clampAxis(this.tx, hw, this.ww);
    const ty = this.clampAxis(this.ty, hh, this.wh);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.x = this.clampAxis(this.x, hw, this.ww);
    this.y = this.clampAxis(this.y, hh, this.wh);
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

  /** World → view coords (0..VIEW_W × 0..VIEW_H), ignoring shake. */
  worldToView(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.x) * this.zoom + VIEW_W / 2, y: (y - this.y) * this.zoom + VIEW_H / 2 };
  }

  /** World → normalized screen (0..1). */
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: ((x - this.x) * this.zoom) / VIEW_W + 0.5, y: ((y - this.y) * this.zoom) / VIEW_H + 0.5 };
  }

  /** Visible world rect (no shake). */
  visible(): { x: number; y: number; w: number; h: number } {
    const w = VIEW_W / this.zoom;
    const h = VIEW_H / this.zoom;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }
}
