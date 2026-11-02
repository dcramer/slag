import { css, type HSL } from '../../../core/color';
import type { Rect } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import type { CannonLook, DecoKind, ModuleOf, RotorArm, RotorLook } from '../../../sim/props';
import type { ThemeId } from '../../../themes';
import { blob, line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, glowDot, light, METALS, type RC } from '../../kit';
import type { DrawCtx } from '../common';
import { ceilingAbovePx, groundBelowPx, lattice } from './setpiece';

/**
 * Theme skins for set pieces. The sim gives the glacier and space their pieces through looks other themes
 * own (a chairlift is a `gondola`, a docking arm a `crane`); these give them their own art, chosen by the
 * level's theme (docs/PARODY.md, Set pieces). Each is inked with the shared pen and drawn on the exact
 * shapes the sim moves, so what you see is what you stand on.
 */

type Rotor = ModuleOf<'rotor'>;
type Cannon = ModuleOf<'cannon'>;

export const themeOf = (d: DrawCtx): ThemeId | undefined => d.o.level?.theme.id;

/** A tube drawn with the pen: an ink ribbon under a colored one, and a lit stripe along its top. */
function tube(s: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, col: HSL, seed: number) {
  s.fillStyle = INK;
  line(s, ax, ay, bx, by, { w: w + 1.4, seed, taper: [0, 0], press: 0.05 });
  s.fillStyle = css(col);
  line(s, ax, ay, bx, by, { w, seed: seed + 1, taper: [0, 0], press: 0.05 });
  const d = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (by - ay) / d;
  const ny = -(bx - ax) / d;
  const k = ny > 0 ? -1 : 1;
  s.fillStyle = css(col, 22);
  line(s, ax + nx * k * w * 0.25, ay + ny * k * w * 0.25, bx + nx * k * w * 0.25, by + ny * k * w * 0.25, {
    w: w * 0.22,
    seed: seed + 2,
    taper: [0.1, 0.1],
    press: 0,
  });
}

/** A rect platform inked with the pen, exactly on the rect the sim builds. */
function slab(s: CanvasRenderingContext2D, p: Rect, base: HSL, seed: number) {
  const pts = boxPts(p.x, p.y, p.w, p.h, 1.6, seed, 0.12);
  tone(s, pts, base, { depth: Math.min(1.4, p.h * 0.2) });
  return pts;
}

export interface RotorSkin {
  /** Scenery behind the terrain (BACKDROP). */
  support?(rc: RC, m: Rotor, d: DrawCtx): void;
  /** What hangs a platform from the hub, per arm. */
  link?(rc: RC, m: Rotor, d: DrawCtx, a: RotorArm, p: Rect): void;
  /** In place of a wheel's cog. */
  wheel?(rc: RC, m: Rotor, d: DrawCtx, arms: readonly RotorArm[], hx: number, hy: number): void;
  platform?(rc: RC, m: Rotor, d: DrawCtx, a: RotorArm, p: Rect, i: number): void;
  /** Drawn over the look's own platform. */
  over?(rc: RC, m: Rotor, d: DrawCtx, a: RotorArm, p: Rect, i: number): void;
  hub?(rc: RC, m: Rotor, d: DrawCtx): void;
}

const STEEL: HSL = { h: 212, s: 8, l: 66 };
const ICE: HSL = { h: 196, s: 60, l: 80 };
const WHITE: HSL = { h: 210, s: 10, l: 88 };

/** Bunny Hill Chairlift: a lift tower with a bullwheel, a bench chair, a footrest, and a lift pass. */
const chairlift: RotorSkin = {
  support(rc, m, d) {
    const s = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const mx = m.mastX + d.off[0];
    const gy = groundBelowPx(d.o.level, mx, hy);
    const side = Math.sign(hx - mx) || 1;
    tube(s, mx, gy, mx, hy - 6, 3, STEEL, 3);
    tube(s, mx - side * 5, hy - 5, hx + side * 3, hy - 5, 2, STEEL, 5);
    // Padding wrapped round the foot of the tower, the way a ski slope does it.
    part(s, boxPts(mx - 3.4, gy - 14, 6.8, 12, 2, 7), { h: 210, s: 70, l: 46 }, 7, { depth: 0.8, thin: 0.5, thick: 1.1 });
    tick(s, mx - 3, gy - 10, mx + 3, gy - 10, 0.6, 8, '#f2f2f2');
    tick(s, mx - 3, gy - 6.5, mx + 3, gy - 6.5, 0.6, 9, '#f2f2f2');
  },
  link(rc, m, d, a, p) {
    const s = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const paint: HSL = { h: d.style.hue, s: 65, l: 48 };
    // Hanger bar down to the backrest's top rail; the backrest is thin rails, behind the rider.
    tube(s, hx, hy, a.x, p.y - 10, 1.4, STEEL, 11);
    tube(s, p.x + 2, p.y - 9, p.x + p.w - 2, p.y - 9, 1.2, paint, 12);
    for (let x = p.x + 2; x <= p.x + p.w - 1.9; x += Math.max(6, (p.w - 4) / Math.round((p.w - 4) / 9))) tube(s, x, p.y - 9, x, p.y, 0.6, paint, 13 + x);
    // Footrest, hung off the seat's ends.
    s.fillStyle = INK;
    line(s, p.x + 3, p.y + p.h, p.x + 5, p.y + p.h + 5, { w: 0.6, seed: 14, taper: [0, 0], press: 0 });
    line(s, p.x + p.w - 3, p.y + p.h, p.x + p.w - 5, p.y + p.h + 5, { w: 0.6, seed: 15, taper: [0, 0], press: 0 });
    tube(s, p.x + 4, p.y + p.h + 5, p.x + p.w - 4, p.y + p.h + 5, 0.8, STEEL, 16);
  },
  platform(rc, _m, d, _a, p) {
    const s = rc.s;
    const paint: HSL = { h: d.style.hue, s: 65, l: 48 };
    const pts = slab(s, p, paint, 21);
    s.save();
    path(s, pts);
    s.clip();
    for (let x = p.x + 6; x < p.x + p.w - 2; x += 6) tick(s, x, p.y + 0.6, x, p.y + p.h - 0.6, 0.45, x, css(paint, -22));
    s.restore();
    pen(s, pts, 22, 0.5, 1.2);
    // The lift pass, on a loop of string off the end of the top rail.
    const tx = p.x + p.w - 3.5;
    const ty = p.y - 5.5;
    s.fillStyle = 'rgba(240,236,226,0.95)';
    line(s, p.x + p.w - 2.4, p.y - 9, tx, ty - 1.6, { w: 0.35, seed: 23, taper: [0, 0], press: 0 });
    part(s, boxPts(tx - 1.8, ty - 1.6, 3.6, 3.2, 0.3, 24), { h: 50, s: 20, l: 94 }, 24, { depth: 0.2, thin: 0.25, thick: 0.5 });
    s.fillStyle = css({ h: d.style.hue + 140, s: 70, l: 46 });
    s.fillRect(tx - 1.5, ty - 1.3, 3, 0.8);
    s.fillStyle = INK;
    for (let k = 0; k < 5; k++) s.fillRect(tx - 1.3 + k * 0.6, ty, k % 2 ? 0.2 : 0.35, 1.1);
  },
  hub(rc, m, d) {
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    ball(rc.s, hx, hy, 3.2, STEEL, 25);
    dot(rc.s, hx, hy, 0.9, 26);
  },
};

/** Icicle of Damocles: a slab of ice hanging from one hair-thin thread. */
const damocles: RotorSkin = {
  support(rc, m, d) {
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const cy = ceilingAbovePx(d.o.level, hx, hy);
    const s = rc.s;
    s.fillStyle = 'rgba(232,236,244,0.9)';
    line(s, hx, cy, hx, hy, { w: 0.3, seed: 31, taper: [0, 0], press: 0 });
    if (cy > 0) {
      s.fillStyle = css(ICE, -10);
      path(s, poly(hx - 2, cy, hx + 2, cy, hx, cy + 2.4));
      s.fill();
    }
  },
  link(rc, m, d, a, p) {
    const s = rc.s;
    s.fillStyle = 'rgba(232,236,244,0.9)';
    line(s, m.hub[0] + d.off[0], m.hub[1] + d.off[1], a.x, p.y, { w: 0.3, seed: 32, taper: [0, 0], press: 0 });
  },
  platform(rc, _m, _d, a, p, i) {
    const s = rc.s;
    const seed = 41 + i;
    // A few short icicles under it: thin, so nothing there looks like floor.
    s.fillStyle = css(ICE, 6);
    for (let k = 0; k < 4; k++) {
      const ix = p.x + 3 + hash2(k, seed, 1) * (p.w - 6);
      const len = 2 + hash2(k, seed, 2) * 2.6;
      path(s, poly(ix - 1, p.y + p.h - 0.4, ix + 1, p.y + p.h - 0.4, ix + 0.2, p.y + p.h + len));
      s.fill();
    }
    const pts = slab(s, p, ICE, seed);
    s.save();
    path(s, pts);
    s.clip();
    glint(s, poly(p.x + 2, p.y + 1.6, p.x + p.w * 0.4, p.y + 1.2, p.x + p.w * 0.55, p.y + 1.4), 'rgba(255,255,255,0.95)', 0.8);
    for (let k = 0; k < 3; k++) {
      const cx = p.x + 4 + hash2(k, seed, 3) * (p.w - 8);
      tick(s, cx, p.y + 1, cx + 2, p.y + p.h - 1, 0.4, k, css(ICE, -26));
    }
    s.restore();
    pen(s, pts, seed + 5, 0.45, 1.1, 3, '#16364d');
    s.fillStyle = INK;
    circle(s, a.x, p.y, 0.6);
  },
  hub(rc, m, d) {
    rc.s.fillStyle = 'rgba(232,236,244,0.95)';
    circle(rc.s, m.hub[0] + d.off[0], m.hub[1] + d.off[1], 0.7);
  },
};

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
      glowDot(rc.g, mx, top - 4, 8, { h: 5, s: 100, l: 55 }, 0.9);
      light(rc, mx, top - 4, 36, { h: 5, s: 100, l: 55 }, 0.5);
    }
  },
  link(rc, m, d, a, p) {
    const s = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    s.fillStyle = INK;
    line(s, hx, hy, a.x, p.y - 4, { w: 0.9, seed: 81, taper: [0, 0], press: 0 });
    for (const ex of [p.x + 3, p.x + p.w - 3]) line(s, a.x, p.y - 4, ex, p.y, { w: 0.7, seed: ex, taper: [0, 0], press: 0 });
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

export const ROTOR_SKINS: Partial<Record<ThemeId, Partial<Record<RotorLook, RotorSkin>>>> = {
  glacier: { gondola: chairlift, slab: damocles },
  space: { cog: spinner, crane: dockArm },
};

export function rotorSkin(m: Rotor, d: DrawCtx): RotorSkin | undefined {
  const t = themeOf(d);
  return t ? ROTOR_SKINS[t]?.[m.look] : undefined;
}

/** What a cannon skin gets: the sim's pose and timing for this frame. */
export interface CannonPose {
  x: number;
  y: number;
  /** Ground under the carriage. */
  gy: number;
  dir: 1 | -1;
  /** 0..1 through the warning before a shot. */
  warn: number;
  recoil: number;
  /** Muzzle, where the shot leaves. */
  mx: number;
  my: number;
}

/** Brain Freeze Cannon: an ice barrel on a sled with ski runners, a snowball pile behind, frost building at the mouth as the tell. */
function iceCannon(rc: RC, m: Cannon, d: DrawCtx, q: CannonPose) {
  const s = rc.s;
  const wood: HSL = { h: d.style.woodHue, s: 40, l: 36 };
  s.save();
  s.translate(q.x, q.gy);
  s.scale(q.dir, 1);
  for (const [bx, by] of [
    [-17, -2.8],
    [-22.4, -2.8],
    [-19.7, -7.4],
  ])
    ball(s, bx, by, 2.8, { h: 205, s: 20, l: 92 }, bx);
  // Ski runners, curling up at the front.
  const runner = poly(-20, -1, 2, -1, 6, -2.4, 7.4, -5);
  s.fillStyle = INK;
  stroke(s, runner, { w: 2.4, seed: 101, taper: [0, 0.2], press: 0 });
  s.fillStyle = css(STEEL, 10);
  stroke(s, runner, { w: 1.1, seed: 101, taper: [0, 0.3], press: 0 });
  part(s, poly(-18, -2.4, -16, -8, -6, -13, 3, -13, 5, -4, 3, -2.4), wood, 102, { depth: 0.9, thin: 0.5, thick: 1.2 });
  for (const x of [-12, -2]) tick(s, x, -2.4, x + 1, -11, 0.5, x, css(wood, -16));
  s.restore();
  s.save();
  s.translate(q.x, q.y);
  s.rotate(m.angle);
  if (Math.cos(m.angle) < 0) s.scale(1, -1);
  s.translate(-q.recoil, 0);
  const L = m.length + 2;
  const body = poly(-11, -5.5, L - 3, -4, L - 3, 4, -11, 5.5, -14.5, 3, -15, 0, -14.5, -3);
  tone(s, body, ICE, { depth: 1.2 });
  s.save();
  path(s, body);
  s.clip();
  // Facets and a band of rime.
  for (let k = 0; k < 4; k++) tick(s, -9 + k * (L / 4), -5.5, -6 + k * (L / 4), 5.5, 0.45, k, css(ICE, -24));
  s.fillStyle = '#f6fbff';
  for (const bx of [-5, L - 9]) {
    const rim: P[] = [];
    for (let k = 0; k <= 8; k++) rim.push({ x: bx + Math.sin(k * 1.9) * 0.7, y: -6 + k * 1.5 });
    stroke(s, rim, { w: 2, seed: bx, taper: [0, 0], press: 0.2 });
  }
  glint(s, poly(-9, -3.6, 0, -3.4, L - 6, -2.8), 'rgba(255,255,255,0.95)', 0.9);
  s.restore();
  pen(s, body, 103, 0.55, 1.4, 3, '#173c55');
  part(s, boxPts(L - 4, -5.5, 4.5, 11, 1.5, 104), ICE, 104, { depth: 0.5, thin: 0.45, thick: 1.1, ink: '#173c55' });
  s.fillStyle = '#0d2233';
  path(s, poly(L, -3.4, L + 0.6, -3.4, L + 0.6, 3.4, L, 3.4));
  s.fill();
  s.fillStyle = css(ICE, 8);
  for (const ix of [-8, -2, 4]) {
    path(s, poly(ix - 1, 5.2, ix + 1, 5.2, ix, 8 + (ix & 1)));
    s.fill();
  }
  s.restore();
  if (q.warn > 0) {
    // The tell: frost crystals growing at the mouth.
    const g = rc.g;
    const ice: HSL = { h: 195, s: 100, l: 75 };
    glowDot(g, q.mx, q.my, 4 + q.warn * 9, ice, 0.4 + q.warn * 0.5);
    g.fillStyle = 'rgba(235,250,255,0.95)';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rc.t * 0.6;
      line(g, q.mx, q.my, q.mx + Math.cos(a) * (2 + q.warn * 4), q.my + Math.sin(a) * (2 + q.warn * 4), { w: 0.6, seed: k, taper: [0.1, 0.6], press: 0 });
    }
    light(rc, q.mx, q.my, 30 + q.warn * 30, ice, 0.3 + q.warn * 0.6);
  }
}

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
  if (on) glowDot(g, q.x - 2.4, q.y - 0.4, 5, { h: 2, s: 100, l: 55 }, 0.8);
  if (q.warn > 0) {
    glowDot(g, q.mx, q.my, 4 + q.warn * 10, glow, 0.4 + q.warn * 0.5);
    light(rc, q.mx, q.my, 30 + q.warn * 40, glow, 0.3 + q.warn * 0.6);
  }
}

export const CANNON_SKINS: Partial<Record<ThemeId, Partial<Record<CannonLook, (rc: RC, m: Cannon, d: DrawCtx, q: CannonPose) => void>>>> = {
  glacier: { castle: iceCannon },
  space: { castle: voidTurret },
};

export function cannonSkin(m: Cannon, d: DrawCtx) {
  const t = themeOf(d);
  return t ? CANNON_SKINS[t]?.[m.look] : undefined;
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
    stroke(g, cable, { w: 1.6, seed: 201, taper: [0, 0], press: 0.1 });
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
      line(g, dx - out * 0.8, dy - 6.4, dx - out * 7.5, dy, { w: 0.55, seed: 211 + i, taper: [0, 0], press: 0 });
      line(g, dx - out * 0.8, dy + 6.4, dx - out * 7.5, dy, { w: 0.55, seed: 212 + i, taper: [0, 0], press: 0 });
      ball(g, dx - out * 7.8, dy, 1.25, METALS.steel.base, 213 + i);
      // A deck plate under each truss, bolted to the floor.
      part(g, boxPts(mx - 6.5, deck - 3, 13, 3.2, 0.6, 214 + i), METALS.steel.base, 214 + i, { depth: 0.5, thin: 0.45, thick: 1 });
      for (const rx of [mx - 5, mx + 5]) dot(g, rx, deck - 1.4, 0.5, rx, css(METALS.steel.light));
    }
  });
}

function commArray(rc: RC, m: ModuleOf<'deco'>, d: DrawCtx) {
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
    if (on) glowDot(rc.g, lx, y + 19.5, 6, col, 0.8);
  }
}

/** Scenery dressing a theme draws its own way, by deco kind. */
export const DECO_SKINS: Partial<Record<ThemeId, Partial<Record<DecoKind, (rc: RC, m: ModuleOf<'deco'>, d: DrawCtx) => void>>>> = {
  space: { antenna: commArray },
};

export function decoSkin(m: ModuleOf<'deco'>, d: DrawCtx) {
  const t = themeOf(d);
  return t ? DECO_SKINS[t]?.[m.kind] : undefined;
}
