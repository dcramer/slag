import { describe, expect, it } from 'vitest';
import { generateLevel } from '../src/gen/level';
import { overview, raceFloor, worldToView } from '../src/game/view';
import { Camera } from '../src/render/camera';
import { frameReach, viewFrame } from '../src/render/frame';
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

  it('spare height splits evenly above and below the play view', () => {
    for (const [vw, vh] of [
      [1600, 1200],
      [1280, 1024],
      [1000, 1200],
      [390, 844],
    ]) {
      const f = viewFrame(vw, vh, NO_INSETS);
      expect(-f.y0).toBeGreaterThan(0);
      expect(-f.y0).toBeCloseTo(f.y1 - VIEW_H, 5);
      expect(f.top).toBeCloseTo((vh - f.height) / 2, 5);
    }
  });

  it('a status bar only centres the view in what is left of the window', () => {
    const f = viewFrame(1000, 1200, { left: 0, right: 0, top: 40 });
    expect(f.top - 40).toBeCloseTo(1200 - f.top - f.height, 5);
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

  it('a level shorter than the view sits centred in it', () => {
    const l = generateLevel(77, 'castle', { size: 'wide' });
    const ov = overview(l);
    const wh = l.h * TILE;
    expect(wh * ov.zoom).toBeLessThan(VIEW_H);
    const top = worldToView(ov, 0, 0).y;
    const bottom = worldToView(ov, 0, wh).y;
    expect(top).toBeGreaterThan(0);
    expect(top).toBeCloseTo(VIEW_H - bottom, 5);
  });

  it('wide() rests a short level centred, in every window', () => {
    for (const [vw, vh] of [
      [1536, 864],
      [1600, 1200],
      [1000, 1200],
      [2520, 1080],
    ]) {
      const c = new Camera();
      c.setFrame(viewFrame(vw, vh, NO_INSETS));
      c.setBounds(96 * TILE, 24 * TILE, 0.45);
      c.wide();
      c.update(1 / 60, false);
      expect(c.worldToView(0, 12 * TILE).y).toBeCloseTo(VIEW_H / 2, 5);
    }
  });

  it('zooming through the point a level starts to fit the window never jumps', () => {
    for (const ins of [NO_INSETS, { left: 0, right: 0, top: 40 }]) {
      const c = new Camera();
      c.setFrame(viewFrame(1600, 1200, ins));
      c.setBounds(96 * TILE, 60 * TILE, 0.3);
      c.snap({ cx: 0, cy: 1e6, zoom: 1.2 });
      c.update(1 / 60, false);
      let y = c.y;
      for (let zoom = 1.2; zoom > 0.3; zoom -= 0.002) {
        c.snap({ cx: 0, cy: 1e6, zoom });
        c.update(1 / 60, false);
        expect(Math.abs(c.y - y)).toBeLessThan(4);
        y = c.y;
      }
    }
  });

  it('the scenery covers everything the camera can show, at any window and zoom', () => {
    for (const size of ['classic', 'wide', 'tall'] as const) {
      const l = generateLevel(77, 'castle', { size });
      const ww = l.w * TILE;
      const wh = l.h * TILE;
      const floor = raceFloor(l);
      for (const [vw, vh, top] of [
        [1536, 864, 0],
        [1600, 1200, 0],
        [1000, 1200, 0],
        [2560, 1080, 0],
        [390, 844, 44],
      ]) {
        const f = viewFrame(vw, vh, { left: 0, right: 0, top });
        const reach = frameReach(f, ww, wh, floor);
        const c = new Camera();
        c.setFrame(f);
        c.setBounds(ww, wh, floor);
        for (const [cx, cy] of [
          [0, 0],
          [ww, wh],
          [0, wh],
          [ww / 2, wh / 2],
        ]) {
          for (let zoom = floor; zoom <= 1.45; zoom += 0.05) {
            c.snap({ cx, cy, zoom });
            c.update(1 / 60, false);
            const v = c.visible();
            expect(v.x, `${size} ${vw}x${vh} zoom ${zoom}`).toBeGreaterThanOrEqual(-reach.x - 1e-6);
            expect(v.x + v.w, `${size} ${vw}x${vh} zoom ${zoom}`).toBeLessThanOrEqual(ww + reach.x + 1e-6);
            expect(v.y, `${size} ${vw}x${vh} zoom ${zoom}`).toBeGreaterThanOrEqual(-reach.up - 1e-6);
            expect(v.y + v.h, `${size} ${vw}x${vh} zoom ${zoom}`).toBeLessThanOrEqual(wh + reach.down + 1e-6);
          }
        }
      }
    }
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
      expect(surroundLevel(l, 12, 8, 6).h).toBe(l.h + 14);
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

  it('runs what stands on the bottom row on down, and leaves the pits open', () => {
    for (const l of levels) {
      const [mx, top, bottom] = [6, 4, 10];
      const a = surroundLevel(l, mx, top, bottom);
      for (let x = 0; x < l.w; x++) {
        // Space floats: nothing there stands on anything (checked below).
        const solid = l.theme.id !== 'space' && l.tiles[(l.h - 1) * l.w + x] === T_SOLID;
        for (let y = l.h; y < l.h + bottom; y++) expect(a.tiles[(y + top) * a.w + x + mx], `${l.theme.id} column ${x} row ${y}`).toBe(solid ? T_SOLID : 0);
      }
    }
  });

  it('draws no ground past either side: leaving the level there is a drop', () => {
    for (const l of levels) {
      const [mx, top, bottom] = [6, 4, 10];
      const a = surroundLevel(l, mx, top, bottom);
      for (let y = 0; y < a.h; y++)
        for (let d = 0; d < mx; d++) {
          expect(a.tiles[y * a.w + d], `${l.theme.id} left column ${d - mx} row ${y - top}`).toBe(0);
          expect(a.tiles[y * a.w + mx + l.w + d], `${l.theme.id} right column ${l.w + d} row ${y - top}`).toBe(0);
        }
    }
  });

  /** Margins from a window the shape of the view up to an ultrawide's, at the race floor of a wide level. */
  const MARGINS = [
    [2, 2, 2],
    [6, 12, 12],
    [20, 8, 30],
    [48, 30, 30],
  ] as const;
  const RING = 2;

  it('never puts anything inside the level: only its own edge, under its own tiles', () => {
    const sizes = ['classic', 'wide', 'tall'] as const;
    for (const t of THEME_IDS) {
      for (const size of sizes) {
        for (const seed of [31, 0x5ee4]) {
          const l = generateLevel(seed, t, { size });
          for (const [mx, top, bottom] of MARGINS) {
            const a = surroundLevel(l, mx, top, bottom);
            for (let y = 0; y < l.h; y++) {
              for (let x = 0; x < l.w; x++) {
                if (a.tiles[(y + top) * a.w + x + mx] !== T_SOLID) continue;
                const ring = x < RING || x >= l.w - RING || y < RING || y >= l.h - RING;
                const where = `${t} ${size} seed ${seed} margins ${mx},${top},${bottom}: tile ${x},${y}`;
                expect(ring, `${where} is inside the ring`).toBe(true);
                expect(l.tiles[y * l.w + x], `${where} isn't the level's own`).toBe(T_SOLID);
              }
            }
          }
        }
      }
    }
  });

  describe('space', () => {
    const spaces = [7, 31, 404, 0x5ee4, 90210].flatMap((seed) => (['classic', 'wide', 'tall'] as const).map((size) => generateLevel(seed, 'space', { size })));

    it('has no ground: nothing runs up or down from the level, and nothing stands a column tall', () => {
      for (const l of spaces) {
        for (const [mx, top, bottom] of MARGINS) {
          const a = surroundLevel(l, mx, top, bottom);
          const solid = (x: number, y: number) => a.tiles[y * a.w + x] === T_SOLID;
          const where = `${l.profile?.size} seed ${l.seed} margins ${mx},${top},${bottom}`;
          for (let x = mx; x < mx + l.w; x++) {
            for (let y = 0; y < top; y++) expect(solid(x, y), `${where}: above the level at ${x - mx}`).toBe(false);
            for (let y = top + l.h; y < a.h; y++) expect(solid(x, y), `${where}: below the level at ${x - mx}`).toBe(false);
          }
          // Past the sides, the tallest run of solid down any column is a body's, never a wall's or a column's.
          for (let x = 0; x < a.w; x++) {
            if (x >= mx && x < mx + l.w) continue;
            let run = 0;
            for (let y = 0; y < a.h; y++) {
              run = solid(x, y) ? run + 1 : 0;
              expect(run, `${where}: column ${x - mx} solid down to row ${y - top}`).toBeLessThanOrEqual(5);
            }
          }
        }
      }
    });
  });
});

describe('the race camera keeps every live runner in view', () => {
  const windows = [
    [1536, 864],
    [2520, 1080],
    [1024, 768],
    [844, 390],
  ] as const;
  const shapes = [
    ['classic', 48, 27],
    ['wide', 96, 26],
    ['tall', 32, 60],
  ] as const;

  /** Fly a pack of runners and check the window after every frame, not just once it settles. */
  function flight(c: Camera, ww: number, wh: number, runners: { x: number; y: number; vx: number; vy: number }[], frames: number) {
    const f = c.frame;
    for (let i = 0; i < frames; i++) {
      for (const r of runners) {
        r.x = Math.max(8, Math.min(ww - 8, r.x + r.vx / 60));
        r.y = Math.max(8, Math.min(wh - 32, r.y + r.vy / 60));
      }
      c.frameAll(runners, 1.45, 120);
      c.update(1 / 60);
      for (const r of runners) {
        const v = c.worldToView(r.x, r.y);
        expect(v.x, `frame ${i}`).toBeGreaterThanOrEqual(f.x0);
        expect(v.x, `frame ${i}`).toBeLessThanOrEqual(f.x1);
        expect(v.y, `frame ${i}`).toBeGreaterThanOrEqual(f.y0);
        expect(v.y, `frame ${i}`).toBeLessThanOrEqual(f.y1);
      }
    }
  }

  function camera(w: number, h: number, vw: number, vh: number): Camera {
    const c = new Camera();
    c.setFrame(viewFrame(vw, vh, NO_INSETS));
    c.setBounds(w * TILE, h * TILE, Math.min(1, VIEW_W / (w * TILE), VIEW_H / (h * TILE)) * 0.92);
    return c;
  }

  for (const [name, w, h] of shapes) {
    for (const [vw, vh] of windows) {
      const ww = w * TILE;
      const wh = h * TILE;
      it(`${name} at ${vw}x${vh}: a pack that splits to all ends stays framed, down to the whole level`, () => {
        const c = camera(w, h, vw, vh);
        const mid = { x: ww / 2, y: wh / 2 };
        flight(
          c,
          ww,
          wh,
          [
            { ...mid, vx: -215, vy: -40 },
            { ...mid, vx: 215, vy: 60 },
            { ...mid, vx: 40, vy: -320 },
            { ...mid, vx: -40, vy: 300 },
          ],
          60 * 12,
        );
        const v = c.visible();
        expect(v.x).toBeLessThanOrEqual(8);
        expect(v.x + v.w).toBeGreaterThanOrEqual(ww - 8);
        expect(v.y).toBeLessThanOrEqual(8);
      });

      it(`${name} at ${vw}x${vh}: nobody outruns the camera, and the margin holds once settled`, () => {
        const c = camera(w, h, vw, vh);
        const r = [
          { x: 120, y: wh - 120, vx: 0, vy: 0 },
          { x: 150, y: wh - 120, vx: 660, vy: -400 },
        ];
        // Stop inside the level: at its very edge only the level's own margin is left.
        flight(c, ww, wh, r, Math.min(60 * 3, Math.floor(((ww - 300) / 660) * 60), Math.floor(((wh - 300) / 400) * 60)));
        r[1].vx = r[1].vy = 0;
        flight(c, ww, wh, r, 240);
        const f = c.frame;
        for (const p of r) {
          const q = c.worldToView(p.x, p.y);
          expect(q.x).toBeGreaterThanOrEqual(f.x0 + 10);
          expect(q.x).toBeLessThanOrEqual(f.x1 - 10);
          expect(q.y).toBeGreaterThanOrEqual(f.y0 + 10);
          expect(q.y).toBeLessThanOrEqual(f.y1 - 10);
        }
      });
    }
  }

  it('zooms back in slower than it goes out, so regrouping does not pump', () => {
    const c = new Camera();
    c.setFrame(viewFrame(1536, 864, NO_INSETS));
    c.setBounds(96 * TILE, 26 * TILE, 0.45);
    const apart = [
      { x: 100, y: 200 },
      { x: 96 * TILE - 100, y: 200 },
    ];
    for (let f = 0; f < 120; f++) {
      c.frameAll(apart, 1.45, 120);
      c.update(1 / 60);
    }
    const out = c.zoom;
    const together = [
      { x: 700, y: 200 },
      { x: 720, y: 200 },
    ];
    c.frameAll(together, 1.45, 120);
    c.update(1 / 60);
    expect(c.zoom - out).toBeLessThan(0.03);
  });
});
