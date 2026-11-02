import type { HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import type { Module, ModuleOf, PropStyle } from '../../../sim/props';
import { inkSpring } from '../../ink-parts';
import { glowDot, type RC } from '../../kit';
import { defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawSpring(rc: RC, m: M<'spring'>, off: Vec, st: PropStyle, o: PropDrawOpts) {
  const since = o.state ? rc.frame - o.state.lastFire : 99;
  const pop = since < 10 ? Math.sin((since / 10) * Math.PI) : 0;
  const pad: HSL = { h: st.hue, s: 85, l: 55 };
  inkSpring(rc, [m.at[0] + off[0], m.at[1] + off[1]], m.angle, st.hue, pop, 11);
  if (pop > 0) glowDot(rc.g, m.at[0] + off[0], m.at[1] + off[1], 14, pad, pop * 0.5);
}

defineArt<'spring'>({ type: 'spring', layer: 2, draw: (rc, m, d) => drawSpring(rc, m, d.off, d.style, d.o) });
