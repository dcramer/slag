import type { HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import type { Module, ModuleOf, PropStyle } from '../../../sim/props';
import { inkSpring } from '../../ink-parts';
import { boxPts, dot, part, path, tick } from '../../ink-props';
import { glowDot, type RC } from '../../kit';
import { defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

const TICKING: HSL = { h: 40, s: 30, l: 90 };

/** The Bedspring's top: a scrap of striped mattress ticking over the plate, tufted with one button. */
function ticking(s: CanvasRenderingContext2D, top: number) {
  const pad = boxPts(-7.6, top - 4.4, 15.2, 3.8, 1.4, 7, 0.3);
  part(s, pad, TICKING, 7, { depth: 0.5, thin: 0.4, thick: 1, shade: -14 });
  s.save();
  path(s, pad);
  s.clip();
  for (let x = -7; x < 8; x += 2.4) tick(s, x, top - 4.6, x - 0.3, top - 0.4, 0.55, x * 3, '#3d64a8');
  s.restore();
  // The button pulls the ticking in: two creases into it.
  tick(s, -2.2, top - 3.4, -0.5, top - 2.6, 0.35, 8, 'rgba(18,11,8,0.6)');
  tick(s, 2.2, top - 3.4, 0.5, top - 2.6, 0.35, 9, 'rgba(18,11,8,0.6)');
  dot(s, 0, top - 2.5, 0.65, 10, '#e8e2d4');
}

function drawSpring(rc: RC, m: M<'spring'>, off: Vec, st: PropStyle, o: PropDrawOpts, bed: boolean) {
  const since = o.state ? rc.frame - o.state.lastFire : 99;
  const pop = since < 10 ? Math.sin((since / 10) * Math.PI) : 0;
  const pad: HSL = { h: st.hue, s: 85, l: 55 };
  inkSpring(rc, [m.at[0] + off[0], m.at[1] + off[1]], m.angle, st.hue, pop, 11);
  if (bed) {
    const s = rc.s;
    s.save();
    s.translate(m.at[0] + off[0], m.at[1] + off[1]);
    s.rotate(m.angle + Math.PI / 2);
    ticking(s, -1 - pop * 6);
    s.restore();
  }
  if (pop > 0) glowDot(rc.g, m.at[0] + off[0], m.at[1] + off[1], 14, pad, pop * 0.5);
}

defineArt<'spring'>({ type: 'spring', layer: 2, draw: (rc, m, d) => drawSpring(rc, m, d.off, d.style, d.o, d.r.pp.def.name.includes('Bedspring')) });
