import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import type { Module, ModuleOf, PropStyle } from '../../../sim/props';
import { hand } from '../../ink';
import { inkSpring } from '../../ink-parts';
import { glowDot, METALS, metalFill, type RC, rrect } from '../../kit';
import { defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawSpring(rc: RC, m: M<'spring'>, off: Vec, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const since = o.state ? rc.frame - o.state.lastFire : 99;
  const pop = since < 10 ? Math.sin((since / 10) * Math.PI) : 0;
  if (hand.on) {
    inkSpring(rc, [m.at[0] + off[0], m.at[1] + off[1]], m.angle, st.hue, pop, 11);
    return;
  }
  s.save();
  s.translate(m.at[0] + off[0], m.at[1] + off[1]);
  s.rotate(m.angle + Math.PI / 2); // local "up" = -y
  s.fillStyle = metalFill(s, METALS.steel, -7, 5, 14, 3);
  rrect(s, -7, 5, 14, 3, 1);
  s.fill();
  const top = -1 - pop * 6;
  s.strokeStyle = '#3c414c';
  s.lineWidth = 2.2;
  s.beginPath();
  for (let i = 0; i <= 6; i++) s.lineTo(i % 2 ? 4.5 : -4.5, 5 - (i / 6) * (5 - top));
  s.stroke();
  s.strokeStyle = '#d9dee6';
  s.lineWidth = 1;
  s.stroke();
  const pad: HSL = { h: st.hue, s: 85, l: 55 };
  const gr = s.createLinearGradient(0, top - 3, 0, top);
  gr.addColorStop(0, css(pad, 20));
  gr.addColorStop(1, css(pad, -15));
  s.fillStyle = gr;
  rrect(s, -7.5, top - 3.5, 15, 3.5, 1.7);
  s.fill();
  s.restore();
  if (pop > 0) glowDot(rc.g, m.at[0] + off[0], m.at[1] + off[1], 14, pad, pop * 0.5);
}

defineArt<'spring'>({ type: 'spring', layer: 2, draw: (rc, m, d) => drawSpring(rc, m, d.off, d.style, d.o) });
