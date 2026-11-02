import type { HSL } from '../../core/color';
import type { Body } from '../../sim/physics';
import type { RunnerStatus } from '../../sim/props';
import type { GameEvent } from '../../sim/types';
import type { Fx } from '../fx';
import { circle, ellipse, glowDot, type RC } from '../kit';

/**
 * Status overlays drawn over a runner: an ice block while frozen (it thins
 * as it thaws), goo drips while slowed, a black face after a backfire.
 * Read-only view of sim status.
 */
export function drawRunnerStatus(rc: RC, b: Body, st: RunnerStatus, soot = 0): void {
  const s = rc.s;
  const g = rc.g;
  if (soot > 0) {
    const a = Math.min(1, soot / 30);
    s.fillStyle = `rgba(18,11,8,${0.85 * a})`;
    s.beginPath();
    s.roundRect(b.x - 1.5, b.y - 2, b.w + 3, b.h + 2, 3.5);
    s.fill();
    s.fillStyle = `rgba(246,234,216,${a})`;
    circle(s, b.x + b.w / 2 + b.facing - 2.2, b.y + 4.5, 1.2);
    circle(s, b.x + b.w / 2 + b.facing + 2.2, b.y + 4.5, 1.2);
  }
  if (st.frozen > 0) {
    const k = Math.min(1, st.frozen / 20);
    s.fillStyle = `rgba(185,230,255,${0.35 + 0.3 * k})`;
    s.strokeStyle = `rgba(240,250,255,${0.6 + 0.3 * k})`;
    s.lineWidth = 1;
    s.beginPath();
    s.roundRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 2);
    s.fill();
    s.stroke();
    s.fillStyle = 'rgba(255,255,255,0.7)';
    s.fillRect(b.x - 0.5, b.y - 0.5, 1.5, 5);
    s.fillRect(b.x - 0.5, b.y - 0.5, 4, 1.2);
    glowDot(g, b.x + b.w / 2, b.y + b.h / 2, 12, { h: 195, s: 90, l: 70 }, 0.2 * k);
  }
  if (st.slowed > 0) {
    const goo: HSL = { h: 105, s: 75, l: 45 };
    const a = Math.min(1, st.slowed / 20);
    s.fillStyle = `hsla(${goo.h},${goo.s}%,${goo.l}%,${0.85 * a})`;
    for (let i = 0; i < 3; i++) {
      const u = (rc.t * 0.9 + i * 0.33) % 1;
      ellipse(s, b.x + 2 + i * 3, b.y + b.h - 2 + u * 4, 1.1, 1.2 + u * 1.5);
    }
    circle(s, b.x + b.w / 2, b.y + 2, 2.2 * a);
  }
}

const GOLD: HSL = { h: 45, s: 100, l: 65 };
const AMBER: HSL = { h: 36, s: 100, l: 59 };

type PropEvent = Extract<GameEvent, { type: 'prop' }>;

/** Effects for generic prop events (pipes, bumps, slams, splats, EMPs...), keyed by event kind. */
const PROP_FX: Record<string, (fx: Fx, e: PropEvent, shake: (k: number) => void) => void> = {
  'pipe-out'(fx, e) {
    // A puff of dust where you come out.
    if (e.x2 !== undefined && e.y2 !== undefined) fx.burst('dust', e.x2, e.y2, 8, 60, [{ h: 40, s: 10, l: 80 }], 1, 0.4);
  },
  bump(fx, e, shake) {
    fx.add('ring', e.x, e.y, 0, 0, GOLD, 16, 0.25);
    fx.burst('spark', e.x, e.y, 8, 160, [GOLD], 1, 0.3);
    shake(2);
  },
  thud(fx, e, shake) {
    fx.burst('dust', e.x, e.y, 16, 110, [{ h: 30, s: 15, l: 70 }], 1.6, 0.6);
    fx.burst('debris', e.x, e.y, 6, 90, [{ h: 30, s: 15, l: 45 }], 1.2, 0.8);
    shake(5);
  },
  bounce(fx, e) {
    fx.burst('spark', e.x, e.y, 4, 80, [{ h: 330, s: 80, l: 75 }], 0.8, 0.2);
  },
  'splat-goo'(fx, e) {
    fx.burst('splash', e.x, e.y, 10, 90, [{ h: 105, s: 75, l: 45 }], 1.2, 0.5, 60);
  },
  'splat-frost'(fx, e) {
    fx.burst('spark', e.x, e.y, 10, 90, [{ h: 195, s: 90, l: 75 }], 1, 0.4);
  },
  'keg-in'(fx, e) {
    fx.add('ring', e.x, e.y, 0, 0, AMBER, 12, 0.2);
  },
  'keg-lit'(fx, e) {
    fx.burst('spark', e.x, e.y, 6, 90, [AMBER], 1, 0.3);
  },
  'keg-fire'(fx, e, shake) {
    const dx = (e.x2 ?? e.x) - e.x;
    const dy = (e.y2 ?? e.y) - e.y;
    const mx = e.x + dx * 0.4;
    const my = e.y + dy * 0.4;
    fx.add('ring', mx, my, 0, 0, AMBER, 20, 0.28);
    fx.add('flash', mx, my, 0, 0, AMBER, 13, 0.12);
    fx.burst('spark', mx, my, 12, 200, [AMBER, GOLD], 1.1, 0.35);
    fx.burst('smoke', mx, my, 7, 60, [{ h: 0, s: 0, l: 60 }], 2.4, 0.9);
    shake(3);
  },
  'keg-backfire'(fx, e, shake) {
    fx.add('flash', e.x, e.y, 0, 0, AMBER, 16, 0.14);
    fx.burst('smoke', e.x, e.y, 18, 90, [{ h: 0, s: 0, l: 14 }], 3.2, 1.1);
    fx.burst('debris', e.x, e.y, 8, 140, [{ h: 28, s: 45, l: 30 }], 1.3, 0.7);
    shake(5);
  },
  'rope-snap'(fx, e, shake) {
    fx.burst('debris', e.x, e.y, 8, 110, [{ h: 14, s: 58, l: 38 }], 1.5, 0.8);
    fx.burst('spark', e.x, e.y, 5, 80, [{ h: 4, s: 92, l: 60 }], 1, 0.3);
    shake(1.5);
  },
  web(fx, e) {
    fx.burst('dust', e.x, e.y, 4, 30, [{ h: 0, s: 0, l: 92 }], 0.8, 0.4);
  },
  emp(fx, e, shake) {
    fx.add('ring', e.x, e.y, 0, 0, { h: 200, s: 100, l: 65 }, (e.r ?? 40) * 1.4, 0.5);
    fx.add('flash', e.x, e.y, 0, 0, { h: 200, s: 100, l: 65 }, e.r ?? 40, 0.3);
    fx.burst(
      'spark',
      e.x,
      e.y,
      30,
      260,
      [
        { h: 200, s: 100, l: 70 },
        { h: 0, s: 0, l: 95 },
      ],
      1.2,
      0.5,
    );
    shake(6);
  },
  drill(fx, e, shake) {
    const x2 = e.x2 ?? e.x;
    const y2 = e.y2 ?? e.y;
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      fx.burst(
        'debris',
        e.x + (x2 - e.x) * u,
        e.y + (y2 - e.y) * u,
        4,
        120,
        [
          { h: 30, s: 25, l: 45 },
          { h: 30, s: 20, l: 30 },
        ],
        1.4,
        1,
      );
      fx.burst('dust', e.x + (x2 - e.x) * u, e.y + (y2 - e.y) * u, 3, 50, [{ h: 30, s: 15, l: 70 }], 1.6, 0.8);
    }
    shake(8);
  },
};

export function propEventFx(fx: Fx, e: PropEvent, shake: (k: number) => void): void {
  PROP_FX[e.kind]?.(fx, e, shake);
}
