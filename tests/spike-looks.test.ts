import { describe, expect, it } from 'vitest';
import { EDGE_DRIFT } from '../src/render/ink';
import { drawSpikeLook, SPIKE_FRAME } from '../src/render/props/spike-looks';
import type { SpikeLook } from '../src/sim/props';

/**
 * Fair play for spike looks (docs/ART.md): whatever a look draws past its mount on the face stays inside
 * the sim's hazard strip to within EDGE_DRIFT, and its points reach far enough out that the strip's edge
 * is where they are.
 */

const LOOKS: SpikeLook[] = ['glass', 'thorn', 'crystal', 'icicle', 'pitchfork'];
/** The mount (sill, stem, rock, crust, haft) lies along the face and may run the cell's full width. */
const MOUNT = SPIKE_FRAME.face + 3;

/** A context that records every point a path goes through, and fails on any shape it can't account for. */
function points(): { g: CanvasRenderingContext2D; pts: [number, number][] } {
  const pts: [number, number][] = [];
  const g: unknown = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'moveTo' || key === 'lineTo') return (x: number, y: number) => pts.push([x, y]);
        if (
          ['arc', 'ellipse', 'rect', 'fillRect', 'quadraticCurveTo', 'bezierCurveTo', 'translate', 'rotate', 'scale', 'transform', 'setTransform'].includes(
            String(key),
          )
        )
          return () => {
            throw new Error(`spike looks draw with plain paths in the strip's frame (got ${String(key)})`);
          };
        return () => {};
      },
      set: () => true,
    },
  );
  return { g: g as CanvasRenderingContext2D, pts };
}

describe('spike looks', () => {
  it('keep everything sharp inside the hazard strip, and reach its far edge', () => {
    const tip = SPIKE_FRAME.face + SPIKE_FRAME.reach;
    for (const look of LOOKS)
      for (const upLit of [true, false])
        for (let v = 0; v < 4; v++) {
          const { g, pts } = points();
          drawSpikeLook(g, look, upLit, v);
          const at = `${look} lit=${upLit} v${v}`;
          expect(pts.length, at).toBeGreaterThan(20);
          let far = -Infinity;
          for (const [x, y] of pts) {
            far = Math.max(far, x);
            expect(x, at).toBeLessThanOrEqual(tip + EDGE_DRIFT);
            if (x > MOUNT) expect(Math.abs(y), `${at} at x=${x.toFixed(2)}`).toBeLessThanOrEqual(SPIKE_FRAME.half + EDGE_DRIFT);
          }
          expect(far, at).toBeGreaterThan(tip - 1.5);
        }
  });
});
