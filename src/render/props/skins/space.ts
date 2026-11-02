import { css, type HSL } from '../../../core/color';
import { blob, line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, circle, glowDot, light, METALS, type RC } from '../../kit';
import type { DrawCtx } from '../common';
import { groundBelowPx, lattice } from '../modules/setpiece';
import { type Cannon, type CannonPose, type Deco, type RotorSkin, slab, STEEL, type ThemeSkins, tube, WHITE } from './common';

/**
 * Space skins. The sim gives space its pieces through looks other themes own (a centrifuge is a `cog`,
 * a docking arm a `crane`, a turret a `castle` cannon, the comm array an `antenna`); these give them
 * its own art (docs/PARODY.md, Set pieces), drawn on the exact shapes the sim moves.
 */

/** Salad Spinner Centrifuge: a slotted green basket on the hub, a pump knob in the middle, lettuce stuck to one paddle. */
const spinner: RotorSkin = {
  wheel(rc, m, _d, arms, hx, hy) {
    const s = rc.s;
    for (const a of arms) tube(s, hx, hy, a.x, a.y, 2.2, STEEL, 51);
    const base = arms[0] ? Math.atan2(arms[0].y - hy, arms[0].x - hx) : 0;
    const R = Math.min(m.arm * 0.5, 30);
    // A clear outer bowl, a pale plastic basket inside it with long slits, turning.
    const bowl = ovalPts(hx, hy, R, R, 52, 0.01, 40);
    tone(s, bowl, { h: 195, s: 30, l: 84 }, { depth: R * 0.06 });
    const basket: HSL = { h: 150, s: 30, l: 72 };
    tone(s, ovalPts(hx, hy, R * 0.82, R * 0.82, 57, 0.01, 36), basket, { depth: R * 0.05 });
    s.fillStyle = css(basket, -34);
    for (let i = 0; i < 12; i++) {
      const a = base + (i / 12) * Math.PI * 2;
      line(s, hx + Math.cos(a) * R * 0.34, hy + Math.sin(a) * R * 0.34, hx + Math.cos(a) * R * 0.74, hy + Math.sin(a) * R * 0.74, {
        w: Math.max(0.9, R * 0.07),
        seed: i,
        taper: [0.15, 0.15],
        press: 0,
      });
    }
    glint(s, poly(hx - R * 0.8, hy - R * 0.2, hx - R * 0.62, hy - R * 0.62, hx - R * 0.22, hy - R * 0.84), 'rgba(255,255,255,0.9)', Math.max(0.8, R * 0.06));
    const rim = bowl;
    pen(s, rim, 53, 0.6, 1.6);
    part(s, ovalPts(hx, hy, R * 0.22, R * 0.22, 55, 0.02, 16), WHITE, 55, { depth: 0.6, thin: 0.45, thick: 1 });
    ball(s, hx, hy, Math.max(2.2, R * 0.12), { h: 0, s: 0, l: 92 }, 56);
  },
  over(rc, _m, _d, _a, p, i) {
    if (i !== 0) return;
    // Lettuce, stuck to the underside of a paddle.
    const s = rc.s;
    const leaf: P[] = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const r = (k % 2 ? 2.4 : 3.2) * (1 + 0.15 * Math.sin(k * 2.7));
      leaf.push({ x: p.x + p.w * 0.35 + Math.cos(a) * r * 1.3, y: p.y + p.h + 1.4 + Math.sin(a) * r * 0.75 });
    }
    part(s, leaf, { h: 96, s: 60, l: 52 }, 61, { depth: 0.5, thin: 0.35, thick: 0.8 });
    tick(s, p.x + p.w * 0.35 - 2.6, p.y + p.h + 1.2, p.x + p.w * 0.35 + 2.8, p.y + p.h + 1.8, 0.4, 62, css({ h: 96, s: 50, l: 78 }));
  },
};

/** Docking Arm: a white truss mast, a jointed robot arm out to the tether, and a docking plate to ride. */
const dockArm: RotorSkin = {
  support(rc, m, d) {
    const s = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const mx = m.mastX + d.off[0];
    const gy = groundBelowPx(d.o.level, mx, hy);
    const side = Math.sign(hx - mx) || 1;
    const top = hy - 12;
    for (const ox of [-4, 4]) tube(s, mx + ox, gy, mx + ox, top, 1.4, WHITE, 71 + ox);
    s.fillStyle = css(WHITE, -24);
    for (let y = gy - 2; y > top + 6; y -= 8) {
      line(s, mx - 4, y, mx + 4, y - 4, { w: 0.7, seed: y, taper: [0, 0], press: 0 });
      line(s, mx + 4, y - 4, mx - 4, y - 8, { w: 0.7, seed: y + 1, taper: [0, 0], press: 0 });
    }
    // The arm: shoulder at the mast top, an elbow raised, the wrist over the hub.
    const ex = (mx + hx) / 2;
    const ey = Math.min(top, hy) - 12;
    tube(s, mx, top, ex, ey, 4.2, WHITE, 73);
    tube(s, ex, ey, hx, hy - 2, 3.4, WHITE, 74);
    for (const [jx, jy, r] of [
      [mx, top, 3.4],
      [ex, ey, 3],
      [hx, hy - 2, 2.6],
    ] as const)
      ball(s, jx, jy, r, { h: 210, s: 12, l: 70 }, jx);
    tick(s, mx + side * 4, top - 1, ex - side * 3, ey + 2.4, 0.9, 75, '#e8a21c');
    const blink = Math.sin(rc.t * 3 + d.r.pp.uid) > 0.4;
    s.fillStyle = blink ? '#ff4030' : '#702020';
    circle(s, mx, top - 4, 1.4);
    if (blink) {
      bulb(rc.g, mx, top - 4, 1.4, { h: 5, s: 100, l: 55 }, 1);
      light(rc, mx, top - 4, 36, { h: 5, s: 100, l: 55 }, 0.5);
    }
  },
  link(rc, m, d, a, p) {
    const s = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    s.fillStyle = INK;
    line(s, hx, hy, a.x, p.y - 4, { w: 0.82, seed: 81, taper: [0, 0], press: 0 });
    for (const ex of [p.x + 3, p.x + p.w - 3]) line(s, a.x, p.y - 4, ex, p.y, { w: 0.49, seed: ex, taper: [0, 0], press: 0 });
    ball(s, a.x, p.y - 4.2, 1.6, { h: 210, s: 12, l: 60 }, 82);
  },
  platform(rc, _m, d, _a, p, i) {
    const s = rc.s;
    const pts = slab(s, p, { ...d.pal.base, l: Math.max(48, d.pal.base.l) }, 91 + i);
    s.save();
    path(s, pts);
    s.clip();
    s.fillStyle = '#f2b705';
    s.fillRect(p.x, p.y, p.w, Math.min(2.2, p.h * 0.4));
    s.fillStyle = INK;
    for (let x = p.x - 2; x < p.x + p.w; x += 3) {
      path(s, poly(x, p.y + 2.2, x + 1.3, p.y + 2.2, x + 2.6, p.y, x + 1.3, p.y));
      s.fill();
    }
    for (const cx of [p.x + p.w * 0.3, p.x + p.w * 0.7]) {
      blob(s, cx, p.y + p.h * 0.62, Math.min(1.6, p.h * 0.28), cx, 1, 0.05);
      s.fill();
    }
    s.restore();
    pen(s, pts, 92 + i, 0.5, 1.2);
  },
};
/** Warranty-Void Turret: a pedestal with the sticker still on, a dome, twin rails, and a red LED that blinks faster before it fires. */
function voidTurret(rc: RC, m: Cannon, d: DrawCtx, q: CannonPose) {
  const s = rc.s;
  const g = rc.g;
  const body: HSL = { h: 214, s: 10, l: 80 };
  const ped = poly(q.x - 9, q.gy, q.x - 6, q.y + 3, q.x + 6, q.y + 3, q.x + 9, q.gy);
  part(s, ped, body, 111, { depth: 1.2, thin: 0.5, thick: 1.3 });
  tick(s, q.x - 7.6, q.gy - 3, q.x + 7.6, q.gy - 3, 0.6, 112, css(body, -26));
  // The sticker.
  const sy = (q.gy + q.y + 3) / 2;
  part(s, ovalPts(q.x, sy, 4.6, 2.4, 113, 0.02, 16), { h: 210, s: 6, l: 90 }, 113, { depth: 0.2, thin: 0.3, thick: 0.55 });
  s.fillStyle = '#b3171f';
  s.font = 'bold 1.25px sans-serif';
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.fillText('VOID IF', q.x, sy - 0.65);
  s.fillText('REMOVED', q.x, sy + 0.75);
  s.save();
  s.translate(q.x, q.y);
  s.rotate(m.angle);
  if (Math.cos(m.angle) < 0) s.scale(1, -1);
  s.translate(-q.recoil, 0);
  const L = m.length + 2;
  for (const ry of [-2.6, 1.2]) part(s, boxPts(-1, ry, L + 1, 1.6, 0.6, 114 + ry), STEEL, 114 + ry, { depth: 0.4, thin: 0.35, thick: 0.85 });
  part(s, boxPts(L - 3, -3.6, 3.4, 6.4, 0.8, 116), { h: 214, s: 10, l: 40 }, 116, { depth: 0.4, thin: 0.4, thick: 0.9 });
  s.restore();
  const dome: P[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    dome.push({ x: q.x + Math.cos(a) * 6.6, y: q.y + 3 + Math.sin(a) * 6.4 });
  }
  part(s, dome, body, 117, { depth: 1, thin: 0.5, thick: 1.2 });
  const glow: HSL = { h: d.style.glowHue, s: 100, l: 62 };
  const on = q.warn > 0 ? Math.sin(rc.t * (8 + q.warn * 30)) > 0 : Math.sin(rc.t * 2) > 0.6;
  s.fillStyle = on ? '#ff3b30' : '#6a1d1a';
  circle(s, q.x - 2.4, q.y - 0.4, 1);
  if (on) bulb(g, q.x - 2.4, q.y - 0.4, 1, { h: 2, s: 100, l: 55 }, 1);
  if (q.warn > 0) {
    glowDot(g, q.mx, q.my, 4 + q.warn * 10, glow, 0.4 + q.warn * 0.5);
    light(rc, q.mx, q.my, 30 + q.warn * 40, glow, 0.3 + q.warn * 0.6);
  }
}
/**
 * Comm Array: two white station trusses on a deck, each with a dish turned to the other (they're talking,
 * and the arc is the conversation), a solar wing on the outside, a sagging data cable between, and the
 * station's red and green nav lights. Baked per size; the lights blink live.
 */
function commTrusses(w: number, h: number) {
  return sprite(`sk|comm|${w}|${h}`, -16, 6, w + 32, h - 4, (g) => {
    const top = 13;
    const paint: HSL = { h: 210, s: 8, l: 86 };
    const band: HSL = { h: 14, s: 82, l: 52 };
    const deck = h;
    // The data cable, sagging from truss to truss behind them.
    const cable: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      cable.push({ x: 8 + (w - 16) * t, y: top + 26 + Math.sin(t * Math.PI) * 5 });
    }
    g.fillStyle = INK;
    stroke(g, cable, { w: 1.2, seed: 201, taper: [0, 0], press: 0.1 });
    g.fillStyle = css({ h: 40, s: 70, l: 52 });
    stroke(g, cable, { w: 0.6, seed: 202, taper: [0, 0], press: 0 });
    for (const [i, mx] of [8, w - 8].entries()) {
      const out = i === 0 ? -1 : 1;
      lattice(g, mx, top, h, 5, METALS.steel, paint);
      // An orange band round the truss, the way station hardware is marked.
      part(g, boxPts(mx - 3.6, top + 6, 7.2, 2.6, 0.5, 203 + i), band, 203 + i, { depth: 0.3, thin: 0.35, thick: 0.8 });
      // The solar wing, out on a strut: a dark panel cut into cells.
      tick(g, mx + out * 2.5, top + 11, mx + out * 7, top + 11, 1.4, 205 + i);
      const px = out > 0 ? mx + 6.5 : mx - 15.5;
      const panel = boxPts(px, top + 7.5, 9, 7, 0.5, 206 + i, 0.1);
      part(g, panel, { h: 222, s: 55, l: 30 }, 206 + i, { depth: 0.5, thin: 0.4, thick: 0.9 });
      g.save();
      path(g, panel);
      g.clip();
      for (let cx = px + 3; cx < px + 9; cx += 3) tick(g, cx, top + 7.5, cx, top + 14.5, 0.4, cx, 'rgba(150,190,255,0.7)');
      tick(g, px, top + 11, px + 9, top + 11, 0.4, 208 + i, 'rgba(150,190,255,0.7)');
      glint(g, poly(px + 0.8, top + 8.6, px + 2.6, top + 8.4), 'rgba(220,235,255,0.9)', 0.5);
      g.restore();
      // The dish, turned to the other truss: a bowl on a yoke with a feed horn at its focus.
      const dx = mx - out * 4.5;
      const dy = top + 19;
      // The mount, a wedge off the truss, then the dish seen three-quarter on: a rim and the dark bowl in it.
      part(g, poly(mx, dy - 2.4, dx + out * 0.6, dy - 1, dx + out * 0.6, dy + 1, mx, dy + 2.4), METALS.steel.base, 209 + i, {
        depth: 0.3,
        thin: 0.35,
        thick: 0.8,
      });
      part(g, ovalPts(dx, dy, 2.9, 7.4, 210 + i, 0.03, 18), paint, 210 + i, { depth: 0.5, thin: 0.45, thick: 1.15 });
      g.fillStyle = css(paint, -34);
      path(g, ovalPts(dx - out * 0.55, dy + 0.3, 1.8, 6, 211 + i, 0.03, 16));
      g.fill();
      g.fillStyle = INK;
      line(g, dx - out * 0.8, dy - 6.4, dx - out * 7.5, dy, { w: 0.39, seed: 211 + i, taper: [0, 0], press: 0 });
      line(g, dx - out * 0.8, dy + 6.4, dx - out * 7.5, dy, { w: 0.39, seed: 212 + i, taper: [0, 0], press: 0 });
      ball(g, dx - out * 7.8, dy, 1.25, METALS.steel.base, 213 + i);
      // A deck plate under each truss, bolted to the floor.
      part(g, boxPts(mx - 6.5, deck - 3, 13, 3.2, 0.6, 214 + i), METALS.steel.base, 214 + i, { depth: 0.5, thin: 0.45, thick: 1 });
      for (const rx of [mx - 5, mx + 5]) dot(g, rx, deck - 1.4, 0.5, rx, css(METALS.steel.light));
    }
  });
}

function commArray(rc: RC, m: Deco, d: DrawCtx) {
  const s = rc.s;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  stamp(s, commTrusses(m.w, m.h), x, y);
  // Nav lights on the solar wings' tips: red to port, green to starboard.
  for (const [i, lx] of [x - 7.5, x + m.w + 7.5].entries()) {
    const on = Math.floor(rc.t * 1.2 + i * 0.5) % 2 === 0;
    const col: HSL = i === 0 ? { h: 2, s: 100, l: 55 } : { h: 130, s: 90, l: 50 };
    s.fillStyle = INK;
    circle(s, lx, y + 19.5, 1.6);
    s.fillStyle = css(col, on ? 8 : -30);
    circle(s, lx, y + 19.5, 1.05);
    if (on) bulb(rc.g, lx, y + 19.5, 1.05, col, 1);
  }
}

export const SPACE: ThemeSkins = {
  rotor: { cog: spinner, crane: dockArm },
  cannon: { castle: voidTurret },
  deco: { antenna: commArray },
};
