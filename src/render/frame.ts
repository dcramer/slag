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
  /** The usable corners of the window (clear of notches), in logical coordinates: where corner UI anchors. */
  safeX0: number;
  safeY0: number;
  safeX1: number;
  /** The play view's box in the window, in CSS px. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A window exactly the shape of the view, or anything that hasn't been laid out yet. */
export const VIEW_FRAME: ViewFrame = {
  x0: 0,
  y0: 0,
  x1: VIEW_W,
  y1: VIEW_H,
  w: VIEW_W,
  h: VIEW_H,
  safeX0: 0,
  safeY0: 0,
  safeX1: VIEW_W,
  left: 0,
  top: 0,
  width: VIEW_W,
  height: VIEW_H,
};

/** Lay the play view out centred in a `vw`×`vh` CSS px window, inside the insets (notches, status bars): spare height goes evenly above and below it. */
export function viewFrame(vw: number, vh: number, ins: { left: number; right: number; top: number }): ViewFrame {
  const aw = Math.max(2, vw - ins.left - ins.right);
  const ah = Math.max(2, vh - ins.top);
  const scale = Math.min(aw / VIEW_W, ah / VIEW_H);
  const width = VIEW_W * scale;
  const height = VIEW_H * scale;
  const left = ins.left + (aw - width) / 2;
  const top = ins.top + (ah - height) / 2;
  const x0 = 0 - left / scale;
  const y0 = 0 - top / scale;
  const w = vw / scale;
  const h = vh / scale;
  return {
    x0,
    y0,
    x1: x0 + w,
    y1: y0 + h,
    w,
    h,
    safeX0: x0 + ins.left / scale,
    safeY0: y0 + ins.top / scale,
    safeX1: x0 + w - ins.right / scale,
    left,
    top,
    width,
    height,
  };
}

/**
 * World px the frame shows past each edge of a `ww`×`wh` world at `zoom`, with
 * the world centred in the play view. The scenery has to reach this far.
 */
export function frameReach(f: ViewFrame, ww: number, wh: number, zoom: number): { x: number; up: number; down: number } {
  return {
    x: Math.max(0, Math.max(VIEW_W / 2 - f.x0, f.x1 - VIEW_W / 2) / zoom - ww / 2),
    up: Math.max(0, (VIEW_H / 2 - f.y0) / zoom - wh / 2),
    down: Math.max(0, (f.y1 - VIEW_H / 2) / zoom - wh / 2),
  };
}
