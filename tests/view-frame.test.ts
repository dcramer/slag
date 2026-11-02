import { describe, expect, it } from 'vitest';
import { generateLevel } from '../src/gen/level';
import { overview, restY, worldToView } from '../src/game/view';
import { Camera } from '../src/render/camera';
import { viewFrame } from '../src/render/frame';
import { surroundLevel } from '../src/render/surround';
import { TILE, VIEW_H, VIEW_W } from '../src/sim/constants';
import { T_SOLID } from '../src/sim/level';
import { THEME_IDS } from '../src/themes';

const NO_INSETS = { left: 0, right: 0, top: 0 };

describe('view frame', () => {
  it('a window the shape of the view is the view', () => {
    const f = viewFrame(1536, 864, NO_INSETS);
    expect([f.x0, f.y0, f.x1, f.y1]).toEqual([0, 0, VIEW_W, VIEW_H]);
  });

  for (const [name, vw, vh] of [
    ['21:9', 2520, 1080],
    ['32:9', 3840, 1080],
    ['4:3', 1024, 768],
    ['phone landscape', 844, 390],
    ['phone portrait', 390, 844],
  ] as const) {
    it(`${name}: the play view keeps its aspect and fits, and the frame is the whole window`, () => {
      const f = viewFrame(vw, vh, NO_INSETS);
      expect(f.width / f.height).toBeCloseTo(VIEW_W / VIEW_H, 5);
      expect(Math.min(vw / VIEW_W, vh / VIEW_H)).toBeCloseTo(f.width / VIEW_W, 5);
      expect(f.x0).toBeLessThanOrEqual(0);
      expect(f.y0).toBeLessThanOrEqual(0);
      expect(f.x1).toBeGreaterThanOrEqual(VIEW_W - 1e-9);
      expect(f.y1).toBeGreaterThanOrEqual(VIEW_H - 1e-9);
      expect(f.w / f.h).toBeCloseTo(vw / vh, 5);
      // Logical → CSS: the frame's corners land on the window's.
      const css = (x: number, y: number) => [f.left + (x * f.width) / VIEW_W, f.top + (y * f.height) / VIEW_H];
      expect(css(f.x0, f.y0)[0]).toBeCloseTo(0, 5);
      expect(css(f.x1, f.y1)[0]).toBeCloseTo(vw, 5);
      expect(css(f.x1, f.y1)[1]).toBeCloseTo(vh, 5);
    });
  }

  it('spare height goes mostly to the sky', () => {
    const f = viewFrame(1024, 768, NO_INSETS);
    expect(-f.y0).toBeGreaterThan((f.y1 - VIEW_H) * 2);
  });

  it('the play view stays out of a notch, and the frame still covers it', () => {
    const f = viewFrame(844, 390, { left: 47, right: 47, top: 0 });
    expect(f.left).toBeGreaterThanOrEqual(47);
    expect(f.left + f.width).toBeLessThanOrEqual(844 - 47 + 1e-9);
    expect(f.safeX0).toBeGreaterThan(f.x0);
    expect(f.safeX1).toBeLessThan(f.x1);
  });
});

describe('camera in a frame', () => {
  it('shows a classic level exactly as before when the window is the view', () => {
    const c = new Camera();
    c.setFrame(viewFrame(1536, 864, NO_INSETS));
    c.setBounds(VIEW_W, VIEW_H, 1);
    c.wide();
    c.update(1 / 60, false);
    expect(c.visible()).toEqual({ x: 0, y: 0, w: VIEW_W, h: VIEW_H });
  });

  it('on an ultrawide the play view is unchanged and the visible rect reaches past the world', () => {
    const f = viewFrame(2520, 1080, NO_INSETS);
    const c = new Camera();
    c.setFrame(f);
    c.setBounds(VIEW_W, VIEW_H, 1);
    c.wide();
    c.update(1 / 60, false);
    expect(c.worldToView(0, 0).x).toBeCloseTo(0);
    expect(c.worldToView(VIEW_W, VIEW_H).x).toBeCloseTo(VIEW_W);
    const v = c.visible();
    expect(v.x).toBeCloseTo(f.x0);
    expect(v.w).toBeCloseTo(f.w);
  });

  it('never shows past a big world on an axis it can fill, at any aspect', () => {
    for (const [vw, vh] of [
      [2520, 1080],
      [1024, 768],
      [844, 390],
    ]) {
      const c = new Camera();
      c.setFrame(viewFrame(vw, vh, NO_INSETS));
      c.setBounds(96 * TILE, 60 * TILE, 1);
      c.snap({ cx: 0, cy: 1e6, zoom: 1 });
      c.update(1 / 60, false);
      const v = c.visible();
      expect(v.x).toBeCloseTo(0, 5);
      expect(v.y + v.h).toBeCloseTo(60 * TILE, 5);
    }
  });

  it('agrees with the deterministic overview pointers map through, at any window', () => {
    for (const size of ['classic', 'wide', 'tall'] as const) {
      const l = generateLevel(77, 'castle', { size });
      const ov = overview(l);
      for (const [vw, vh] of [
        [1536, 864],
        [2520, 1080],
        [1024, 768],
      ]) {
        const c = new Camera();
        c.setFrame(viewFrame(vw, vh, NO_INSETS));
        c.setBounds(l.w * TILE, l.h * TILE, ov.zoom);
        c.snap(ov);
        c.update(1 / 60, false);
        const a = c.worldToView(40, 80);
        const b = worldToView(ov, 40, 80);
        expect(a.x).toBeCloseTo(b.x, 5);
        expect(a.y).toBeCloseTo(b.y, 5);
      }
    }
  });

  it('a level shorter than the view stands on the bottom of it, sky above', () => {
    const wh = 24 * TILE;
    const y = worldToView({ cx: 0, cy: restY(wh, 0.5), zoom: 0.5 }, 0, wh).y;
    expect(y).toBeCloseTo(VIEW_H);
  });
});

describe('the land around a level', () => {
  const levels = THEME_IDS.flatMap((t) => (['classic', 'wide'] as const).map((size) => generateLevel(31, t, { size })));

  it('fills every theme, leaves the level untouched and is deterministic', () => {
    for (const l of levels) {
      const before = l.tiles.slice();
      const a = surroundLevel(l, 12, 8);
      expect(a.w).toBe(l.w + 24);
      expect(a.h).toBe(l.h + 8);
      expect(a.tiles.length).toBe(a.w * a.h);
      expect(a.tiles.some((t) => t === T_SOLID)).toBe(true);
      expect(Array.from(l.tiles)).toEqual(Array.from(before));
      expect(Array.from(surroundLevel(l, 12, 8).tiles)).toEqual(Array.from(a.tiles));
    }
  });

  it('leaves the middle of the level out: it only costs what the window can see', () => {
    const l = levels[0];
    const a = surroundLevel(l, 6, 4);
    for (let y = 6; y < l.h; y++) for (let x = 8; x < l.w - 2; x++) expect(a.tiles[(y + 4) * a.w + x + 6]).toBe(0);
  });

  it('carries solid terrain that reaches the edge on past it, so nothing ends in a cut', () => {
    for (const l of levels) {
      const a = surroundLevel(l, 6, 0);
      for (let y = 0; y < l.h; y++) {
        if (l.tiles[y * l.w] === T_SOLID) expect(a.tiles[y * a.w + 5], `${l.theme.id} left row ${y}`).toBe(T_SOLID);
        if (l.tiles[y * l.w + l.w - 1] === T_SOLID) expect(a.tiles[y * a.w + 6 + l.w], `${l.theme.id} right row ${y}`).toBe(T_SOLID);
      }
    }
  });
});
