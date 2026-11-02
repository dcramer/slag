import { clamp } from '../core/geom';
import type { ViewXform } from '../game/view';
import { VIEW_H, VIEW_W } from '../sim/constants';
import { VIEW_FRAME, type ViewFrame } from './frame';

/** View px every framed runner stays inside the window's edge: clear of the corner chips and footer. */
export const FRAME_MARGIN = 36;
/** Rate zoom eases back in at (per second), against 3.2 for everything else. */
const ZOOM_IN_RATE = 1.2;

/**
 * Smoothed 2D camera. Two things are handed to it and nothing else is assumed:
 * the world's size (`setBounds`, from the level) and the window (`setFrame`).
 *
 * The camera maps world px into logical view coordinates: its centre lands on
 * the middle of the VIEW_W×VIEW_H play view, at `zoom` view px per world px.
 * Framing decisions (`focus`, `wide`) are made against the play view, which
 * never changes shape, while what's visible is the whole frame around it.
 * On an axis where the frame is bigger than the world, the world rests centred
 * in the play view and the renderer shows what lies beyond it, either way.
 *
 * `frameAll` is the race rule: every live runner is on screen, always. Zoom
 * and position ease toward a nice framing, and after easing a hard step pulls
 * the view out just far enough if anyone would otherwise leave it, so nobody
 * can outrun the smoothing and readability never beats being seen.
 */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  private tx = 0;
  private ty = 0;
  private tz = 1;
  shake = 0;
  private sx = 0;
  private sy = 0;
  /** World size in px. */
  ww = 0;
  wh = 0;
  /** Lowest zoom `focus` may pick (the fit-whole-level zoom, or a readability floor). */
  minZoom = 1;
  frame: ViewFrame = VIEW_FRAME;
  /** Points `frameAll` must keep in view; re-supplied every frame. */
  private held: readonly { x: number; y: number }[] = [];

  setBounds(ww: number, wh: number, minZoom: number) {
    if (ww !== this.ww || wh !== this.wh) {
      this.ww = ww;
      this.wh = wh;
      this.x = this.tx = ww / 2;
      this.y = this.ty = wh / 2;
    }
    this.minZoom = minZoom;
  }

  setFrame(frame: ViewFrame) {
    this.frame = frame;
  }

  /** Keep every one of `points` in view, whatever it costs in zoom (down to minZoom). Call every frame. */
  frameAll(points: readonly { x: number; y: number }[], maxZoom = 1.4, pad = 110) {
    this.focus(points, maxZoom, pad);
    this.held = points;
  }

  /** Frame the given points (or the whole world if empty), capping zoom. */
  focus(points: readonly { x: number; y: number }[], maxZoom = 1.4, pad = 110) {
    this.held = [];
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
    this.held = [];
    this.tz = clamp(Math.min(VIEW_W / this.ww, VIEW_H / this.wh), this.minZoom, 1);
    this.tx = this.ww / 2;
    this.ty = this.wh / 2;
  }

  /** Jump straight to a deterministic mapping (pick/place overview): no smoothing, so ghosts sit under cursors. */
  snap(v: ViewXform) {
    this.held = [];
    this.x = this.tx = v.cx;
    this.y = this.ty = v.cy;
    this.zoom = this.tz = v.zoom;
  }

  /**
   * Keep the frame's `before`/`after` px either side of the view centre inside
   * `size` world px. If they don't fit, the world rests centred, as far as that
   * leaves neither end of it past the frame: the range closes to a point where
   * the world starts to fit, so zooming through there can't jump.
   */
  private clampAxis(v: number, before: number, after: number, size: number): number {
    const lo = before;
    const hi = size - after;
    return lo <= hi ? clamp(v, lo, hi) : clamp(size / 2, hi, lo);
  }

  private clampX(v: number, zoom = this.zoom): number {
    return this.clampAxis(v, (VIEW_W / 2 - this.frame.x0) / zoom, (this.frame.x1 - VIEW_W / 2) / zoom, this.ww);
  }

  private clampY(v: number, zoom = this.zoom): number {
    return this.clampAxis(v, (VIEW_H / 2 - this.frame.y0) / zoom, (this.frame.y1 - VIEW_H / 2) / zoom, this.wh);
  }

  /** Where a camera aimed at (x, y) at `zoom` would really sit: the limits `update` applies, for a pose worked out elsewhere. */
  fit(x: number, y: number, zoom: number): { x: number; y: number } {
    return { x: this.clampX(x, zoom), y: this.clampY(y, zoom) };
  }

  update(dt: number, smooth = true) {
    const k = smooth ? 1 - Math.exp(-dt * 3.2) : 1;
    // Out at full pace, back in gently: a pack that spreads and regroups shouldn't pump the view.
    const kz = smooth && this.tz > this.zoom ? 1 - Math.exp(-dt * ZOOM_IN_RATE) : k;
    this.zoom += (this.tz - this.zoom) * kz;
    this.x += (this.clampX(this.tx) - this.x) * k;
    this.y += (this.clampY(this.ty) - this.y) * k;
    this.contain();
    this.x = this.clampX(this.x);
    this.y = this.clampY(this.y);
    this.shake *= Math.exp(-dt * 7);
    if (this.shake < 0.05) this.shake = 0;
    this.sx = (Math.random() - 0.5) * this.shake;
    this.sy = (Math.random() - 0.5) * this.shake;
  }

  /** The hard rule behind `frameAll`: zoom out, then move, by exactly what keeps everyone in view this frame. */
  private contain() {
    if (this.held.length === 0) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of this.held) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    // View px from the view's centre out to each edge of the usable window, less the margin.
    const f = this.frame;
    const left = VIEW_W / 2 - f.safeX0 - FRAME_MARGIN;
    const right = f.safeX1 - VIEW_W / 2 - FRAME_MARGIN;
    const up = VIEW_H / 2 - f.safeY0 - FRAME_MARGIN;
    const down = f.y1 - VIEW_H / 2 - FRAME_MARGIN;
    const fit = Math.min((left + right) / Math.max(1, x1 - x0), (up + down) / Math.max(1, y1 - y0));
    if (this.zoom > fit) this.zoom = Math.max(fit, this.minZoom);
    const z = this.zoom;
    this.x = clamp(this.x, x1 - right / z, Math.max(x1 - right / z, x0 + left / z));
    this.y = clamp(this.y, y1 - down / z, Math.max(y1 - down / z, y0 + up / z));
  }

  /** Canvas transform mapping world → buffer pixels for a window-filling buffer `pw` px wide. */
  apply(ctx: CanvasRenderingContext2D, pw: number) {
    const f = this.frame;
    const px = pw / f.w;
    const k = px * this.zoom;
    ctx.setTransform(k, 0, 0, k, (VIEW_W / 2 - f.x0) * px - (this.x + this.sx) * k, (VIEW_H / 2 - f.y0) * px - (this.y + this.sy) * k);
  }

  /** World → view coords (0..VIEW_W × 0..VIEW_H inside the play view, beyond it in the frame), ignoring shake. */
  worldToView(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.x) * this.zoom + VIEW_W / 2, y: (y - this.y) * this.zoom + VIEW_H / 2 };
  }

  /** Visible world rect: the whole window (no shake). */
  visible(): { x: number; y: number; w: number; h: number } {
    const f = this.frame;
    return { x: this.x + (f.x0 - VIEW_W / 2) / this.zoom, y: this.y + (f.y0 - VIEW_H / 2) / this.zoom, w: f.w / this.zoom, h: f.h / this.zoom };
  }
}
