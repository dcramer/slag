import { VIEW_H, VIEW_W } from '../sim/constants';

/**
 * The window, in logical view coordinates. The play view is always
 * VIEW_W×VIEW_H logical px, scaled to fit as large as the window allows: its
 * aspect and scale don't depend on the window, so nobody sees more or less of
 * a level by resizing. The canvases fill the whole window around it, and the
 * frame says how far the logical coordinates reach in each direction (x0 < 0
 * and x1 > VIEW_W on an ultrawide, y0 < 0 and y1 > VIEW_H on a 4:3). Every
 * layer draws in logical coordinates and only has to fill the frame.
 */
export interface ViewFrame {
  /** Logical coordinates of the window's edges. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Logical size of the window. */
  w: number;
  h: number;
  /** The play view's box in the window, in CSS px. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A window exactly the shape of the view, or anything that hasn't been laid out yet. */
export const VIEW_FRAME: ViewFrame = { x0: 0, y0: 0, x1: VIEW_W, y1: VIEW_H, w: VIEW_W, h: VIEW_H, left: 0, top: 0, width: VIEW_W, height: VIEW_H };

/**
 * Share of spare height that goes above the play view: the sky can take it,
 * while below the level there's only the pool.
 */
const SKY_SHARE = 0.65;

/** Lay the play view out in a `vw`×`vh` CSS px window, inside the insets (notches, status bars). */
export function viewFrame(vw: number, vh: number, ins: { left: number; right: number; top: number }): ViewFrame {
  const aw = Math.max(2, vw - ins.left - ins.right);
  const ah = Math.max(2, vh - ins.top);
  const scale = Math.min(aw / VIEW_W, ah / VIEW_H);
  const width = VIEW_W * scale;
  const height = VIEW_H * scale;
  const left = ins.left + (aw - width) / 2;
  const top = ins.top + (ah - height) * SKY_SHARE;
  const x0 = -left / scale;
  const y0 = -top / scale;
  const w = vw / scale;
  const h = vh / scale;
  return { x0, y0, x1: x0 + w, y1: y0 + h, w, h, left, top, width, height };
}
