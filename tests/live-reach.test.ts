import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { DECOR_KINDS } from '../src/gen/decor';
import { generateTheme } from '../src/gen/theme';
import { DECOR } from '../src/render/decor';
import type { Light, RC } from '../src/render/kit';
import { LIVE_REACH } from '../src/render/terrain';
import { THEME_IDS } from '../src/themes';
import { mockCtx } from './lib/canvas';

/** A context that draws nothing but hands out gradients, which glows fill with. */
function ctx(): CanvasRenderingContext2D {
  const c = mockCtx() as unknown as Record<string, unknown>;
  c.createRadialGradient = () => ({ addColorStop() {} });
  c.createLinearGradient = () => ({ addColorStop() {} });
  return c as unknown as CanvasRenderingContext2D;
}

describe('live decor culling', () => {
  // The terrain painter skips a live piece further than LIVE_REACH outside the view. A lamp just past that
  // must not light anything inside it, or its pool would blink out as the camera moves off it.
  it('keeps every live piece’s light inside LIVE_REACH of its spot', () => {
    const theme = generateTheme(1, THEME_IDS[0]);
    let checked = 0;
    for (const kind of DECOR_KINDS) {
      const def = DECOR[kind];
      if (!def.live) continue;
      for (const t of [0, 0.4, 1.3, 7.9]) {
        const lights: Light[] = [];
        const rc: RC = { s: ctx(), bg: ctx(), g: ctx(), lights, t, frame: Math.round(t * 60), gust: 1 };
        const d = { kind, x: 0, y: 0, tx: 0, ty: 0, seed: 12345, size: 1.3, span: 1, flip: false, color: def.color(theme, new Rng(7)) };
        def.live(rc, d, theme);
        for (const L of lights) expect(Math.hypot(L.x, L.y) + L.r, kind).toBeLessThanOrEqual(LIVE_REACH);
        checked += lights.length;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
