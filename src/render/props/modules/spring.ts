import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import type { Module, ModuleOf, PropStyle } from '../../../sim/props';
import { inkSpring } from '../../ink-parts';
import { stroke } from '../../ink';
import { INK, path, poly } from '../../ink-props';
import { circle, glowDot, type RC } from '../../kit';
import { defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawSpring(rc: RC, m: M<'spring'>, off: Vec, st: PropStyle, o: PropDrawOpts, pup: boolean) {
  const since = o.state ? rc.frame - o.state.lastFire : 99;
  const pop = since < 10 ? Math.sin((since / 10) * Math.PI) : 0;
  const pad: HSL = { h: st.hue, s: 85, l: 55 };
  inkSpring(rc, [m.at[0] + off[0], m.at[1] + off[1]], m.angle, st.hue, pop, 11);
  if (pup) {
    // The Coil Pup: ears up on its top plate, and a tail that wags.
    const s = rc.s;
    const top = -1 - pop * 6 - 1.8;
    s.save();
    s.translate(m.at[0] + off[0], m.at[1] + off[1]);
    s.rotate(m.angle + Math.PI / 2);
    for (const ex of [-5.4, -2.2]) {
      const ear = poly(ex - 1.6, top - 1.6, ex + 0.2, top - 5.4, ex + 1.6, top - 1.6);
      s.fillStyle = css(pad, -22, 1, 6);
      path(s, ear);
      s.fill();
      s.fillStyle = INK;
      stroke(s, ear, { w: 0.7, seed: ex, taper: [0.1, 0.1], press: 0.2 });
    }
    const wag = Math.sin(rc.t * 14) * 0.6;
    const tail = poly(7.4, top - 0.4, 9 + wag, top - 2.6, 9.6 + wag * 1.8, top - 4.8);
    s.fillStyle = INK;
    stroke(s, tail, { w: 2.2, seed: 3, taper: [0, 0.6], press: 0 });
    s.fillStyle = css(pad, -10);
    stroke(s, tail, { w: 1.1, seed: 3, taper: [0, 0.7], press: 0 });
    s.fillStyle = INK;
    circle(s, -6.6, top + 0.2, 0.75);
    circle(s, -3.6, top - 0.6, 0.45);
    s.restore();
  }
  if (pop > 0) glowDot(rc.g, m.at[0] + off[0], m.at[1] + off[1], 14, pad, pop * 0.5);
}

defineArt<'spring'>({ type: 'spring', layer: 2, draw: (rc, m, d) => drawSpring(rc, m, d.off, d.style, d.o, d.r.pp.def.name.includes('Pup')) });
