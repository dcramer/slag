import { css, type HSL } from '../../../core/color';
import { type ModuleOf, SENTRY_MUZZLE, sentryAim, sentryMode } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { boxPts, dot, glint, INK, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { glowDot, light, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, type DrawCtx } from '../common';
import { iron } from '../machine';

/**
 * The sentry gun (docs/PARODY.md, sentry): a squat tripod with a boxy head and twin barrels, a machine
 * with nothing like a face. Its one sensor is a lamp on top of the head, dark while it sweeps, red once it
 * has someone, amber while it cools. The tripod and the head are baked; the head turns live to the sim's
 * aim, mirrored when it aims left so its lit side stays up, and kicks back when it fires. While it is
 * locked, a dotted laser sight runs out of the muzzle exactly as far as its `beamOf` reaches.
 */

type Sentry = ModuleOf<'sentry'>;

const OLIVE: HSL = { h: 78, s: 24, l: 40 };
const RED: HSL = { h: 0, s: 100, l: 58 };
const AMBER: HSL = { h: 36, s: 100, l: 58 };
const FLASH: HSL = { h: 46, s: 100, l: 70 };
/** The lamp's lens in the head's frame. */
const LENS: readonly [number, number] = [-1.2, -4.6];
/** Barrel centers across the head (head frame y). */
const BARRELS = [-1.75, 1.05];
const BARREL_END = SENTRY_MUZZLE + 0.4;

const keyOf = (d: DrawCtx) => `${d.style.metal}|${d.style.hue | 0}`;

/** One splayed leg: a heavy ink stroke under a lit one, a flat foot pad at the end. */
function leg(g: CanvasRenderingContext2D, hx: number, hy: number, fx: number, fy: number, col: HSL, seed: number) {
  const pts: P[] = [
    { x: hx, y: hy },
    { x: (hx + fx) / 2, y: (hy + fy) / 2 - 0.3 },
    { x: fx, y: fy },
  ];
  g.fillStyle = INK;
  stroke(g, pts, { w: 2.6, seed, taper: [0, 0], press: 0.1 });
  g.fillStyle = css(col, fx < hx ? 16 : 2);
  stroke(g, pts, { w: 1.7, seed: seed + 1, taper: [0, 0], press: 0.1 });
  part(g, boxPts(fx - 2, fy - 0.9, 4, 1.5, 0.5, seed + 2), { ...col, l: col.l - 10 }, seed + 2, { depth: 0.3, thin: 0.35, thick: 0.7 });
}

/** The still half: a hard ground shadow, three chunky gunmetal legs, the yoke the head turns on, and the ammo box. */
function base(g: CanvasRenderingContext2D, pal: MetalPalette, hue: number) {
  const metal = iron(pal, 42);
  const gun: HSL = { h: pal.dark.h, s: Math.min(14, pal.dark.s), l: 34 };
  g.fillStyle = 'rgba(16,10,8,0.45)';
  path(g, poly(-7.8, 8, 7.8, 8, 6.8, 7.1, -6.8, 7.1));
  g.fill();
  leg(g, 0.3, 2.6, 1.2, 7.4, { ...gun, l: gun.l - 8 }, 21);
  leg(g, -0.8, 2.4, -6.6, 7.4, gun, 11);
  leg(g, 0.8, 2.4, 6.6, 7.4, gun, 16);
  // The yoke: a squat drum under the head.
  part(g, boxPts(-2.6, 1.6, 5.2, 2.2, 0.8, 31), { ...metal, l: metal.l - 8 }, 31, { depth: 0.5, thin: 0.45, thick: 1.1 });
  dot(g, 0, 2.7, 0.55, 33, css(pal.light));
  // The ammo box on the left of the yoke, a belt feeding up into the head.
  const box = boxPts(-7.6, 2, 4.2, 3.4, 0.6, 41);
  part(g, box, { ...OLIVE, h: OLIVE.h + (hue % 20) - 10 }, 41, { depth: 0.7, thin: 0.45, thick: 1.2 });
  tick(g, -7, 3.1, -4, 3.1, 0.45, 42, css(OLIVE, -22, 1, 4));
  g.fillStyle = css(OLIVE, 26);
  path(g, boxPts(-6.4, 3.7, 1.8, 0.9, 0.2, 43));
  g.fill();
  g.fillStyle = css({ h: 42, s: 70, l: 52 });
  stroke(g, poly(-4.4, 2.2, -3.4, 0.8, -2.4, 0), { w: 1.1, seed: 44, taper: [0, 0], press: 0 });
  g.fillStyle = INK;
  for (const [x, y] of [
    [-4.3, 1.9],
    [-3.4, 0.9],
  ])
    tick(g, x - 0.5, y - 0.3, x + 0.5, y + 0.3, 0.35, 45 + x);
}

/** The head along +x, lit side up: a boxy housing, a sloped front plate, twin barrels, and the lamp's hood. */
function head(g: CanvasRenderingContext2D, pal: MetalPalette) {
  const metal = iron(pal, 44);
  const dark: HSL = { ...metal, l: Math.max(22, metal.l - 22) };
  for (const [i, y] of BARRELS.entries()) {
    const b = boxPts(3, y - 0.85, BARREL_END - 3, 1.7, 0.4, 51 + i);
    part(g, b, dark, 51 + i, { depth: 0.35, thin: 0.35, thick: 0.85 });
    g.fillStyle = INK;
    path(g, boxPts(BARREL_END - 1.2, y - 1.05, 1.2, 2.1, 0.3, 53 + i));
    g.fill();
    g.fillStyle = css(metal, 18);
    line(g, 4.2, y - 0.45, BARREL_END - 1.8, y - 0.45, { w: 0.35, seed: 55 + i, taper: [0.2, 0.3], press: 0 });
  }
  // A collar where the barrels leave the housing.
  part(g, boxPts(2.4, -3.1, 2.2, 5.6, 0.5, 57), dark, 57, { depth: 0.4, thin: 0.4, thick: 0.9 });
  // The housing, with its front cut back at a slope.
  const body = poly(-5.6, -3.4, 1.4, -3.4, 3.2, -1.6, 3.2, 2.4, -5.6, 2.4);
  part(g, body, metal, 61, { depth: 0.9, thin: 0.5, thick: 1.4 });
  g.fillStyle = css(metal, -20, 1, 4);
  line(g, -3.4, -2.6, -3.4, 1.8, { w: 0.4, seed: 62, taper: [0.2, 0.2], press: 0.2 });
  glint(g, poly(-5, -2.8, -1.6, -2.95, 0.8, -2.9), css(pal.light, 10), 0.5);
  for (const x of [-4.6, -2.2]) dot(g, x, 1.4, 0.42, 63 + x, css(pal.light));
  // The lamp's hood on top, open to the front.
  part(g, boxPts(-3, -5.6, 3.6, 2.4, 0.6, 65), dark, 65, { depth: 0.4, thin: 0.4, thick: 0.9 });
}

/** The muzzle flash: hard cel shapes, a pale core in a molten star. */
function flash(s: CanvasRenderingContext2D, x: number, y: number, size: number) {
  s.fillStyle = css({ h: 32, s: 100, l: 56 });
  path(s, poly(x, y - 2.2 * size, x + 2.8 * size, y - 0.6 * size, x + 5.2 * size, y, x + 2.8 * size, y + 0.6 * size, x, y + 2.2 * size, x + 1, y));
  s.fill();
  s.fillStyle = '#fff3c4';
  path(s, poly(x, y - 1 * size, x + 2.6 * size, y, x, y + 1 * size, x + 0.6, y));
  s.fill();
}

function drawSentry(rc: RC, m: Sentry, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const st = d.o.state;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const sight = st ? beamOf(d.o, d.r, d.mi) : undefined;
  // The beam was cast this frame from the aim the sim holds: drawing the head there keeps head and sight as one line.
  const angle = sight?.angle ?? sentryAim(st, d.mi, m);
  const { mode, since } = st ? sentryMode(st, d.mi) : { mode: d.o.card ? ('lock' as const) : ('wait' as const), since: rc.frame };
  const shot = st ? rc.frame - st.lastFire : 999;
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const flip = c < 0 ? -1 : 1;
  const k = keyOf(d);

  const spun = Math.min(1, (rc.frame - since) / Math.max(1, m.spin));
  if (mode === 'lock' && sight) {
    // The laser sight: dashes from the muzzle out to where the beam stops, firming up as it spins up.
    const a = 0.3 + 0.55 * spun;
    g.fillStyle = `rgba(255,46,36,${a})`;
    for (let t = BARREL_END + 1; t < sight.len; t += 5) {
      const t1 = Math.min(sight.len, t + 2.6);
      line(g, x + c * t, y + sn * t, x + c * t1, y + sn * t1, { w: 0.8, seed: 1, taper: [0, 0], press: 0 });
    }
    glowDot(g, x + c * sight.len, y + sn * sight.len, 3.5, RED, 0.5 + 0.4 * spun);
  }

  stamp(
    s,
    sprite(`S|base|${k}`, -8.5, -1, 17, 9.5, (bg) => base(bg, d.pal, d.style.hue)),
    x,
    y,
  );

  const kick = shot < 6 ? (6 - shot) * 0.32 : 0;
  s.save();
  s.translate(x, y);
  s.rotate(angle);
  if (flip < 0) s.scale(1, -1);
  s.translate(-kick, 0);
  stamp(
    s,
    sprite(`S|head|${k}`, -7, -6.6, BARREL_END + 8, 10, (hg) => head(hg, d.pal)),
  );
  if (mode === 'lock') {
    // Spinning up: a lit rib jumps round the collar.
    s.fillStyle = css(iron(d.pal, 44), 30);
    const rib = ((rc.frame >> 1) % 3) - 1;
    for (const by of BARRELS) line(s, 3.2, by + rib * 0.5, 4.3, by + rib * 0.5, { w: 0.4, seed: 7, taper: [0, 0], press: 0 });
  }
  // The lamp's lens.
  const lamp = mode === 'lock' ? RED : mode === 'cool' ? AMBER : null;
  s.fillStyle = lamp ? css(lamp, 14) : css({ h: 0, s: 18, l: 20 });
  path(s, boxPts(LENS[0] - 0.4, LENS[1] - 0.7, 2.6, 1.6, 0.4, 3));
  s.fill();
  if (shot < 3) for (const by of BARRELS) flash(s, BARREL_END, by, shot === 0 ? 1 : 0.7);
  s.restore();

  const lx = x + c * LENS[0] - sn * LENS[1] * flip;
  const ly = y + sn * LENS[0] + c * LENS[1] * flip;
  if (lamp) {
    const pulse = mode === 'lock' ? 0.75 + 0.25 * Math.sin(rc.t * 18) : 0.45;
    glowDot(g, lx + c * 1.2, ly + sn * 1.2, 4, lamp, pulse);
    light(rc, lx, ly, 26, lamp, pulse * 0.5);
  }
  if (shot < 4) {
    const mx = x + c * (BARREL_END + 1);
    const my = y + sn * (BARREL_END + 1);
    glowDot(g, mx, my, 9 - shot * 2, FLASH, 0.85);
    light(rc, mx, my, 60, FLASH, 1 - shot / 4);
  } else if (mode === 'cool' && rc.frame - since < 40) {
    // Hot barrels: the tips glow off as it cools.
    const heat = 1 - (rc.frame - since) / 40;
    glowDot(g, x + c * BARREL_END, y + sn * BARREL_END, 3, AMBER, 0.5 * heat);
  }
}

defineArt<'sentry'>({ type: 'sentry', layer: 2, draw: drawSentry });
