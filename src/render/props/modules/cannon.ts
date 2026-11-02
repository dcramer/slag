import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { cannonMuzzle, cannonTiming, type ModuleOf } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { ball, boxPts, glint, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light, METALS, type RC } from '../../kit';
import { type DrawCtx, defineArt } from '../common';
import { wheel } from './setpiece';
import { cannonSkin } from './skins';

/**
 * Set-piece guns, inked: the castle's boss-room cannon, the ship's gun, the jungle's cursed idol and the
 * volcano's magma spitter. The fuse/eye/maw telegraph follows cannonTiming (the sim's own schedule), so
 * the glow peaks exactly when the shot leaves. Still parts are baked once; the barrel turns with recoil,
 * and the tells are drawn live.
 */

type Cannon = ModuleOf<'cannon'>;

/** Frames of visible warning before each volley. */
const FUSE = 48;

/** The carriage, in a frame facing +x with the ground at y = 0. */
function carriage(woodHue: number, ship: boolean) {
  return sprite(`cn|carr|${woodHue | 0}|${ship}`, -26, -16, 34, 18, (g) => {
    const wood: HSL = { h: woodHue, s: 42, l: 36 };
    const body = poly(-20, 0, -20, -6, -8, -13, 4, -13, 6, -4, 4, 0);
    tone(g, body, wood, { depth: 1.4 });
    g.save();
    path(g, body);
    g.clip();
    for (let k = 1; k < 4; k++) tick(g, -20 + k * 2, -k * 3, 5, -k * 3 + 0.2, 0.5, k, css(wood, -18, 1, 6));
    g.restore();
    pen(g, body, 3, 0.55, 1.4);
    if (!ship)
      for (const [bx, by] of [
        [-17, -2.6],
        [-22, -2.6],
        [-19.5, -6.8],
      ])
        ball(g, bx, by, 2.6, METALS.obsidian.light, bx);
    else {
      // A coil of rope beside it.
      for (let r = 1.5; r < 5; r += 1.3) {
        const ring = ovalPts(-19, -2, r + 1, r * 0.5, r * 3, 0.05, 14);
        g.fillStyle = INK;
        stroke(g, [...ring, ring[0]], { w: 1.6, seed: r, taper: [0, 0], press: 0.1 });
        g.fillStyle = css({ h: 38, s: 35, l: 56 });
        stroke(g, [...ring, ring[0]], { w: 0.8, seed: r, taper: [0, 0], press: 0.1 });
      }
    }
  });
}

/** The barrel along +x, `L` long, with hoops, a muzzle ring and a cascabel knob. */
function barrel(L: number, pal: typeof METALS.steel, ship: boolean) {
  return sprite(`cn|barrel|${L.toFixed(1)}|${pal.base.h},${pal.base.l}|${ship}`, -19, -8, L + 22, 16, (g) => {
    const body = poly(-11, -5.5, L - 3, -4, L - 3, 4, -11, 5.5, -14.5, 3, -15, 0, -14.5, -3);
    tone(g, body, pal.base, { depth: 1.2 });
    g.save();
    path(g, body);
    g.clip();
    for (const bx of [-6, 2, L - 7]) {
      g.fillStyle = INK;
      line(g, bx, -6, bx, 6, { w: 2.6, seed: bx, taper: [0, 0], press: 0.1 });
      g.fillStyle = css(pal.base, -10);
      line(g, bx + 0.3, -6, bx + 0.3, 6, { w: 1.4, seed: bx + 1, taper: [0, 0], press: 0.1 });
    }
    glint(g, poly(-9, -3.4, 0, -3.1, L - 6, -2.6), css(pal.spec, -6), 0.9);
    g.restore();
    pen(g, body, 5, 0.55, 1.5);
    part(g, boxPts(L - 4, -5.5, 4.5, 11, 1.5, 6), pal.base, 6, { depth: 0.6, thin: 0.45, thick: 1.1 });
    g.fillStyle = INK;
    path(g, ovalPts(L + 0.4, 0, 1.3, 3.6, 7, 0.02, 12));
    g.fill();
    ball(g, -15, 0, 3, pal.base, 8);
    if (ship) {
      g.fillStyle = INK;
      line(g, -15, 0, -22, 8, { w: 1.6, seed: 9, taper: [0, 0.3], press: 0 });
      g.fillStyle = css({ h: 38, s: 35, l: 56 });
      line(g, -15, 0, -22, 8, { w: 0.8, seed: 9, taper: [0, 0.3], press: 0 });
    }
  });
}

/** The cursed idol's head, facing +x: carved stone, a headdress, eye sockets and a maw. Eyes glow live. */
function idol(stoneHue: number, uid: number) {
  return sprite(`cn|idol|${stoneHue | 0}|${uid % 5}`, -17, -40, 34, 42, (g) => {
    const stone: HSL = { h: stoneHue, s: 22, l: 44 };
    for (let k = -2; k <= 2; k++) {
      g.save();
      g.translate(k * 4.5, -25);
      g.rotate(k * 0.25);
      part(g, ovalPts(0, -6, 2.2, 6.5, k + 11, 0.05, 14), { h: [0, 40, 130, 190, 300][(k + 2 + uid) % 5], s: 75, l: 50 }, k + 11, {
        depth: 0.5,
        thin: 0.35,
        thick: 0.8,
      });
      tick(g, 0, -11, 0, -2, 0.4, k, 'rgba(0,0,0,0.35)');
      g.restore();
    }
    const head = boxPts(-12, -27, 24, 27, 6, 12, 0.3);
    tone(g, head, stone, { depth: 2 });
    g.save();
    path(g, head);
    g.clip();
    g.fillStyle = css(stone, -18, 1, 6);
    g.fillRect(-12, -21, 24, 2);
    tick(g, -10, -10, -4, -7, 0.7, 13, css(stone, -26));
    tick(g, -9, -5, -3, -3, 0.7, 14, css(stone, -26));
    g.restore();
    pen(g, head, 15, 0.6, 1.6);
    g.fillStyle = INK;
    path(g, boxPts(-3, -17, 5, 4, 1, 16));
    g.fill();
    path(g, boxPts(5, -17, 5, 4, 1, 17));
    g.fill();
    part(g, boxPts(9, -14, 4, 6, 1, 18), { ...stone, l: 38 }, 18, { depth: 0.4, thin: 0.35, thick: 0.8 });
    g.fillStyle = INK;
    path(g, boxPts(4, -7.5, 9, 4, 1.5, 19));
    g.fill();
    g.fillStyle = css({ h: 45, s: 15, l: 80 });
    for (let k = 0; k < 3; k++) g.fillRect(5 + k * 3, -7.5, 1.6, 1.4);
  });
}

/** The magma spitter's mound, facing +x: lumpy basalt with cracks (they glow live) and a dark maw. */
function mound() {
  return sprite('cn|mound', -17, -24, 34, 26, (g) => {
    const rock: HSL = { h: 260, s: 10, l: 19 };
    const pts: P[] = [{ x: -15, y: 0 }];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI;
      pts.push({ x: Math.cos(a) * 14.5 - 0.5, y: Math.sin(a) * (17 + Math.sin(i * 1.7) * 2) });
    }
    pts.push({ x: 14, y: 0 });
    part(g, pts, rock, 21, { depth: 2, thin: 0.6, thick: 1.6 });
    for (let k = 0; k < 4; k++) tick(g, -10 + k * 5, -6 - (k % 2) * 4, -8 + k * 5, -9 - (k % 2) * 4, 0.6, k, css(rock, 20));
  });
}

function drawCannon(rc: RC, m: Cannon, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const t = cannonTiming(m, rc.frame, d.r.phase);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const gy = (Math.floor(m.at[1] / TILE) + 1) * TILE + d.off[1];
  const dir = Math.cos(m.angle) >= 0 ? 1 : -1;
  const warn = t.until <= FUSE && rc.frame >= 30 ? 1 - t.until / FUSE : 0;
  const recoil = t.since < 14 ? (14 - t.since) * 0.35 : 0;
  const [mx, my] = cannonMuzzle(m, d.off[0], d.off[1]);
  const st = d.style;
  const wood: HSL = { h: st.woodHue, s: 42, l: 34 };

  const skin = cannonSkin(m, d);
  if (skin) skin(rc, m, d, { x, y, gy, dir, warn, recoil, mx, my });
  else if (m.look === 'castle' || m.look === 'ship') {
    const ship = m.look === 'ship';
    s.save();
    s.translate(x, gy);
    s.scale(dir, 1);
    stamp(s, carriage(st.woodHue, ship));
    s.restore();
    s.save();
    s.translate(x, y);
    s.rotate(m.angle);
    if (dir < 0) s.scale(1, -1);
    s.translate(-recoil, 0);
    stamp(s, barrel(m.length + 2, d.pal, ship));
    s.restore();
    if (ship)
      for (const k of [-12, 0]) wheel(s, x + dir * k, gy - 3.5, 3.5, 0, { hub: METALS.steel.base, rim: { ...wood, l: 30 }, spokes: 0, tyre: 0, wood: true });
    else
      wheel(s, x - dir, gy - 7, 7, Math.sin(t.since * 0.3) * (recoil * 0.05), {
        hub: METALS.steel.base,
        rim: { ...wood, l: 40 },
        spokes: 8,
        tyre: 1.4,
        wood: true,
      });
    // Fuse at the touch hole: the tell.
    if (warn > 0) {
      const fx = x - Math.cos(m.angle) * 10;
      const fy = y - 6;
      const fl: HSL = { h: 40, s: 100, l: 62 };
      s.fillStyle = 'rgb(255 214 90)';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + rc.t * 9;
        line(s, fx, fy, fx + Math.cos(a) * (1.6 + warn * 2.2), fy + Math.sin(a) * (1.6 + warn * 2.2), { w: 0.8, seed: i, taper: [0.1, 0.8], press: 0 });
      }
      glowDot(g, fx, fy, 4 + warn * 7, fl, 0.6 + warn * 0.4);
      light(rc, fx, fy, 30 + warn * 30, fl, 0.4 + warn * 0.6);
      if (d.o.emit && Math.random() < 0.3 + warn * 0.5) d.o.emit('spark', fx, fy, (Math.random() - 0.5) * 70, -40 - Math.random() * 50, fl);
    }
  } else if (m.look === 'totem') {
    const glowC: HSL = { h: st.glowHue, s: 95, l: 58 };
    const hx = x - dir * 4;
    const top = gy - 27;
    s.save();
    s.translate(hx, gy);
    s.scale(dir, 1);
    stamp(s, idol(st.hue, d.r.pp.uid));
    s.restore();
    // The tell: its eyes glow as it winds up.
    const k = 0.25 + warn * 0.75;
    for (const ex of [-0.5, 7.5]) {
      const px = hx + dir * ex;
      g.fillStyle = css(glowC, 15, k);
      g.fillRect(px - 2, top + 11, 4, 2.4);
      glowDot(g, px, top + 12, 5 + warn * 6, glowC, 0.4 * k + 0.2);
    }
    light(rc, hx + dir * 4, top + 12, 40 + warn * 30, glowC, 0.25 + warn * 0.6);
  } else {
    // Magma spitter: a lumpy basalt mound with a glowing maw.
    const hot: HSL = { h: st.glowHue, s: 100, l: 55 };
    const hx = x - dir * 4;
    s.save();
    s.translate(hx, gy);
    s.scale(dir, 1);
    stamp(s, mound());
    s.restore();
    const pulse = 0.3 + warn * 0.7 + Math.sin(rc.t * 5 + d.r.pp.uid) * 0.08;
    g.fillStyle = css(hot, 0, 0.6 * pulse);
    for (const [ax, ay, bx, by] of [
      [-10, -3, -5, -10],
      [-5, -10, -7, -14],
      [2, -2, 5, -9],
    ])
      line(g, hx + dir * ax, gy + ay, hx + dir * bx, gy + by, { w: 0.9, seed: ax, taper: [0.1, 0.1], press: 0 });
    const mwx = mx - Math.cos(m.angle) * 2;
    s.fillStyle = INK;
    path(s, ovalPts(mwx, my, 4.6, 3.8 + warn, 22, 0.08, 14));
    s.fill();
    g.fillStyle = css(hot, 10, 0.5 + warn * 0.5);
    path(g, ovalPts(mwx, my, 3 + warn, 2.4 + warn, 23, 0.08, 12));
    g.fill();
    glowDot(g, mx, my, 8 + warn * 10, hot, 0.5 + warn * 0.5);
    light(rc, mx, my, 50 + warn * 40, hot, 0.4 + warn * 0.7);
    if (d.o.emit && Math.random() < 0.05 + warn * 0.4) d.o.emit('ember', mx, my, dir * (10 + Math.random() * 30), -30 - Math.random() * 30, hot);
  }
  // Muzzle flash.
  if (t.since < 6) {
    const fc: HSL = m.look === 'totem' || skin ? { h: st.glowHue, s: 95, l: 60 } : { h: 38, s: 100, l: 62 };
    glowDot(g, mx, my, 16 - t.since * 2, fc, 0.95);
    light(rc, mx, my, 90, fc, 1 - t.since / 6);
  }
}

defineArt<'cannon'>({ type: 'cannon', layer: 2, draw: (rc, m, d) => drawCannon(rc, m, d) });
