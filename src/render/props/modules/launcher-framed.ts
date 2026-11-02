import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { BALLISTA_TOWER, CANNON_CARRIAGE, GUMBALL, type LauncherStyle, TOTEM } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, stamp, tick, tone } from '../../ink-props';
import { flame, glowDot, light } from '../../kit';
import { iron } from '../machine';
import { drawGlider, roundSprite, stampRound } from '../projectiles';
import { HANGAR_BOX, hangarLoft } from './hangar-art';
import type { Live, Look } from './launcher';
import { cartWheel } from './launcher-house';

/**
 * The launchers that take two tiles (sim/props/launcher-frames.ts): a hangar and its runway, a ship's gun on
 * its carriage, a ballista on its tower, a vending machine, a tiki post and a gumball machine. Their pieces
 * are drawn round the middle of their frame, facing right as at rot 0, and turned with the part; every
 * outline that looks solid is one of the rects the sim stands them as, read from the same numbers.
 */

/** Frame px (top-left origin, as the sim's rects are drawn up) to the art's px round the middle, for a 32×16 frame. */
const WX = (x: number) => x - 16;
const WY = (y: number) => y - 8;
/** The same for a 16×32 frame. */
const TX = (x: number) => x - 8;
const TY = (y: number) => y - 16;

type R4 = readonly [number, number, number, number];
/** A rect of the sim's (frame px) as art px, through one of the maps above. */
const wide = (r: R4): R4 => [WX(r[0]), WY(r[1]), r[2], r[3]];
const tall = (r: R4): R4 => [TX(r[0]), TY(r[1]), r[2], r[3]];

/** Pull of a bow: 1 drawn back and loaded, 0 just loosed. */
const pull = (l: Live) => (l.reload < 1 ? l.reload : 1);

function loaded(s: CanvasRenderingContext2D, l: Live, x: number, k = 1, spin = 0) {
  const sp = roundSprite(l.m.ammo);
  if (sp) stampRound(s, sp, x, 0, spin, false, k);
}

const wood = (h: HSL, l: number): HSL => ({ ...h, l });

export const FRAMED: Pick<Record<LauncherStyle, Look>, 'hangar' | 'cannon' | 'ballista' | 'thrower' | 'totem' | 'gumball'> = {
  // Budget Airline: a quonset hangar and the runway its paper planes roll out along (hangar-art.ts).
  hangar: {
    frame: { pivot: [WX(12), WY(9)] },
    mount: [HANGAR_BOX, (g, k) => hangarLoft(g, k.hue, k.pal, k.seed)],
    over(l) {
      if (!l.ready) return;
      // The next flight waits in the door, nose out.
      const s = l.rc.s;
      s.save();
      s.translate(l.x, l.y + 1.6);
      s.scale(0.4, 0.4);
      drawGlider(s, 0, 0, 0, l.st.hue, l.rc.t, false, 0, Math.cos(l.angle) < 0 ? -1 : 1, 7);
      s.restore();
    },
  },
  // Pirate Cannon: a ship's gun on its stepped carriage and trucks, a treasure map lashed to the barrel.
  cannon: {
    frame: { pivot: [WX(17), WY(5)], cam: [WX(8), WY(2.4)] },
    house: [
      [-17, -2, 34, 11],
      (g, k) => {
        const wd = wood(k.wood, 36);
        const [bx, by, bw] = wide(CANNON_CARRIAGE.bed);
        // The axle-trees, and a truck under each end.
        part(g, boxPts(bx, by, bw, 2.8, 0.8, k.seed, 0.12), wd, k.seed, { depth: 0.7, thin: 0.5, thick: 1.4 });
        tick(g, bx + 1, by + 1.9, bx + bw - 1, by + 2, 0.45, k.seed + 1, css(wd, -18, 1, 6));
        for (const x of [bx + 4.4, bx + bw - 4.6]) cartWheel(g, x, 5.3, 2.6, wd, k.pal, k.seed + x);
      },
    ],
    mount: [
      [-14, -1.5, 13, 6],
      (g, k) => {
        const wd = wood(k.wood, 40);
        const [x, y, w, h] = wide(CANNON_CARRIAGE.step);
        // The carriage's back step, a coil of rope hung on it.
        part(g, boxPts(x, y, w, h + 0.4, 0.8, k.seed + 2, 0.1), wd, k.seed + 2, { depth: 0.6, thin: 0.5, thick: 1.3 });
        tick(g, x + 0.8, y + 1.4, x + w - 0.8, y + 1.5, 0.4, k.seed + 3, css(wd, -18, 1, 6));
        for (const r of [1.3, 0.7]) {
          g.fillStyle = css({ h: 38, s: 35, l: 58 });
          stroke(g, ovalPts(x + 3.6, y + 1.6, r, r * 0.55, r * 9, 0.05, 12).concat([{ x: x + 3.6 + r, y: y + 1.6 }]), {
            w: 0.55,
            seed: r * 9,
            taper: [0, 0],
            press: 0,
          });
        }
      },
    ],
    barrel: [
      [-10.5, -6.5, 25, 13],
      (g, k) => {
        const body = poly(-4.6, -3.9, 10.8, -3, 10.8, 3, -4.6, 3.9, -6.8, 2.7, -7.6, 0, -6.8, -2.7);
        part(g, body, k.pal.base, k.seed, { depth: 1, thin: 0.5, thick: 1.3 });
        g.save();
        path(g, body);
        g.clip();
        for (const x of [-2.4, 6.6]) {
          g.fillStyle = css(k.pal.dark, 6);
          line(g, x, -5, x, 5, { w: 1.4, seed: k.seed + x, taper: [0.02, 0.02], press: 0.1 });
        }
        glint(g, poly(-4.4, -3.1, 3, -2.8, 9.6, -2.4), css(k.pal.spec, -6), 0.7);
        g.restore();
        // The muzzle swell and its bore.
        part(g, boxPts(10.4, -3.9, 2.9, 7.8, 0.8, k.seed + 2), k.pal.base, k.seed + 2, { depth: 0.5, thin: 0.4, thick: 1 });
        g.fillStyle = INK;
        path(g, poly(12.6, -2.3, 13.4, -2.3, 13.4, 2.3, 12.6, 2.3));
        g.fill();
        ball(g, -8.6, 0, 1.5, k.pal.base, k.seed + 3);
        // A rolled treasure map lashed along the top of the barrel, its red X showing.
        part(g, boxPts(1.2, -5.6, 6.2, 2.5, 0.5, k.seed + 5, 0.1), { h: 42, s: 45, l: 80 }, k.seed + 5, { depth: 0.3, thin: 0.3, thick: 0.7 });
        for (const x of [1.2, 7.4])
          part(g, ovalPts(x, -4.35, 0.75, 1.35, k.seed + x, 0.02, 10), { h: 40, s: 40, l: 68 }, k.seed + x + 1, { depth: 0.2, thin: 0.25, thick: 0.5 });
        tick(g, 3.6, -5, 4.8, -3.5, 0.4, 7, '#c0182a');
        tick(g, 4.8, -5, 3.6, -3.5, 0.4, 8, '#c0182a');
        for (const x of [2.2, 6.2]) {
          tick(g, x, -5.8, x + 0.4, 4, 0.7, 9 + x);
          tick(g, x, -5.7, x + 0.4, 3.9, 0.35, 10 + x, css({ h: 38, s: 35, l: 58 }));
        }
      },
    ],
    // The cheek the barrel rests between, in front of its lower half, and the iron cap over the trunnion.
    front: [
      [-4.5, -5, 15, 9],
      (g, k) => {
        const wd = wood(k.wood, 44);
        const [x, y, w, h] = wide(CANNON_CARRIAGE.cheek);
        const cheek = poly(x, y + h, x, y + 1.2, x + 1.2, y, x + w - 1.4, y, x + w, y + 1.6, x + w, y + h);
        part(g, cheek, wd, k.seed + 6, { depth: 0.8, thin: 0.5, thick: 1.4 });
        g.fillStyle = css(wd, -18, 1, 6);
        line(g, x + 1, y + h - 1.6, x + w - 1, y + h - 1.5, { w: 0.45, seed: k.seed + 7, taper: [0.1, 0.1], press: 0.1 });
        for (const bx of [x + 2, x + w - 2]) dot(g, bx, y + h - 3, 0.5, k.seed + bx, css(iron(k.pal, 50), 18));
        const [px, py] = [WX(17), WY(5)];
        part(g, ovalPts(px, py, 2, 1.5, k.seed + 8, 0.03, 14), iron(k.pal, 42), k.seed + 8, { depth: 0.3, thin: 0.35, thick: 0.8 });
        dot(g, px, py, 0.6, k.seed + 9, css(k.pal.spec, -10));
      },
    ],
    recoil: 0.6,
  },
  // Tower Defense: a ballista turning on top of a tiny tower, price tag still on.
  ballista: {
    frame: { pivot: [TX(7), TY(10)], cam: [TX(12.5), TY(8.4)] },
    house: [
      [-9, -4, 18, 21],
      (g, k) => {
        const st: HSL = { h: k.st.hue, s: 9, l: 54 };
        const [x, y, w, h] = tall(BALLISTA_TOWER);
        const x1 = x + w;
        const y1 = y + h;
        // The tower: coursed walls and merlons notched out of its top, flush with the rect it stands as.
        const m = (w - 0.4) / 5;
        const pts = poly(
          x,
          y1,
          x1,
          y1,
          x1,
          y,
          x1 - m,
          y,
          x1 - m,
          y + 1.8,
          x1 - 2 * m,
          y + 1.8,
          x1 - 2 * m,
          y,
          x + 2 * m,
          y,
          x + 2 * m,
          y + 1.8,
          x + m,
          y + 1.8,
          x + m,
          y,
          x,
          y,
        );
        tone(g, pts, st, { depth: 1.3 });
        g.save();
        path(g, pts);
        g.clip();
        g.fillStyle = INK;
        line(g, x - 1, y + 3.4, x1 + 1, y + 3.4, { w: 0.7, seed: 3, taper: [0.05, 0.05], press: 0.3 });
        const mortar = css(st, -24, 1, 4);
        for (let row = 0; row < 4; row++) {
          const yy = y + 6.8 + row * 3.3;
          tick(g, x, yy, x1, yy + 0.2, 0.45, yy * 9, mortar);
          for (let xx = x + 2.4 + (row % 2) * 2.4; xx < x1; xx += 4.8) tick(g, xx, yy - 3.1, xx, yy - 0.2, 0.42, xx * 7 + yy, mortar);
        }
        // An arrow loop, dark, under the ledge.
        g.fillStyle = INK;
        path(g, boxPts(-0.6, y + 5.2, 1.2, 4.4, 0.5, k.seed + 2));
        g.fill();
        g.restore();
        pen(g, pts, k.seed + 1, 0.55, 1.6);
        // The price tag, on a string from a merlon.
        tick(g, x1 - m / 2, y + 0.4, x1 - 2.4, y + 4.6, 0.35, 12, '#e9dfc8');
        g.save();
        g.translate(x1 - 2.6, y + 6.4);
        g.rotate(0.28);
        part(g, poly(-1.6, -1.8, 1.6, -1.8, 1.6, 1.9, -1.6, 1.9, -2.4, 0), { h: 46, s: 70, l: 84 }, 13, { depth: 0.3, thin: 0.3, thick: 0.6 });
        dot(g, -1.3, 0, 0.35, 14);
        g.fillStyle = '#7a1f12';
        g.font = 'bold 2.2px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('$5', 0.3, 0.1);
        g.restore();
      },
    ],
    // The swivel post the ballista turns on.
    mount: [
      [-4.5, -8.5, 7, 7.5],
      (g, k) => {
        const [px, py] = [TX(7), TY(10)];
        part(g, poly(px - 1.6, TY(14.2), px + 1.6, TY(14.2), px + 1.1, py, px - 1.1, py), iron(k.pal, 40), k.seed + 3, { depth: 0.4, thin: 0.4, thick: 0.9 });
      },
    ],
    barrel: [
      [-8, -10.5, 19, 21],
      (g, k) => {
        const wd = wood(k.wood, 44);
        // Bow arms: ink under, wood over.
        const arm: P[] = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          arm.push({ x: 3.4 + Math.sin(t * Math.PI) * 4.4, y: -9.2 + t * 18.4 });
        }
        g.fillStyle = INK;
        stroke(g, arm, { w: 2.8, seed: k.seed, taper: [0.15, 0.15], press: 0.1 });
        g.fillStyle = css(wd, 4);
        stroke(g, arm, { w: 1.5, seed: k.seed, taper: [0.2, 0.2], press: 0.1 });
        part(g, boxPts(-6.4, -1.5, 15, 3, 0.8, k.seed + 1), wd, k.seed + 1, { depth: 0.5, thin: 0.45, thick: 1 });
        part(g, boxPts(6, -2.2, 2.4, 4.4, 0.5, k.seed + 2), k.pal.base, k.seed + 2, { depth: 0.4, thin: 0.35, thick: 0.8 });
        dot(g, 0, 0, 1.1, k.seed + 3, css(k.pal.light));
      },
    ],
    recoil: 0.5,
    aimed(s, l) {
      const nock = -1 - pull(l) * 4.5;
      s.fillStyle = 'rgba(240,232,214,0.95)';
      line(s, 3.6, -9.1, nock, 0, { w: 0.5, seed: 1, taper: [0, 0], press: 0 });
      line(s, nock, 0, 3.6, 9.1, { w: 0.5, seed: 2, taper: [0, 0], press: 0 });
      if (l.reload > 0.35) {
        s.save();
        s.translate(nock + 11.5, 0);
        stamp(s, roundSprite('bolt')!);
        s.restore();
      }
    },
  },
  // Shuriken Vendor: a vending machine, a lit header over its window of stars, a coin slot, a tray.
  thrower: {
    frame: { pivot: [TX(8), TY(21)], cam: [TX(3.6), TY(-5.6)] },
    mount: [
      [-9, -17, 18, 34],
      (g, k) => {
        const paint: HSL = { h: k.st.hue, s: 60, l: 46 };
        for (const x of [-6.6, 3.4])
          part(g, boxPts(x, 13.6, 3.2, 2.3, 0.5, k.seed + x), { h: 220, s: 8, l: 24 }, k.seed + x, { depth: 0.3, thin: 0.4, thick: 0.9 });
        const body = boxPts(-7.5, -14.2, 15, 28.2, 1.6, k.seed);
        part(g, body, paint, k.seed, { depth: 1.3, thin: 0.55, thick: 1.6 });
        g.save();
        path(g, body);
        g.clip();
        g.fillStyle = css(paint, -14, 1, 4);
        path(g, poly(-8, 9.2, 8, 9.2, 8, 14.5, -8, 14.5));
        g.fill();
        g.fillStyle = css(paint, 16);
        line(g, -6.6, -12.4, -6.6, 8, { w: 0.7, seed: k.seed + 11, taper: [0.2, 0.3], press: 0.1 });
        g.restore();
        const sign = boxPts(-7.6, -15.8, 15.2, 3.6, 1.2, k.seed + 7);
        part(g, sign, { h: 48, s: 90, l: 66 }, k.seed + 7, { depth: 0.4, thin: 0.45, thick: 1.1 });
        for (const x of [-5, -2, 1, 4]) tick(g, x, -14, x + 1.3, -14, 0.6, x, css({ h: 4, s: 70, l: 46 }));
        // The window: rows of stars on their spirals.
        const win = boxPts(-6.1, -10.8, 8.6, 12.2, 0.6, k.seed + 1);
        tone(g, win, { h: 195, s: 35, l: 80 }, { depth: 0.6 });
        g.save();
        path(g, win);
        g.clip();
        for (let row = 0; row < 3; row++) {
          const y = -8.2 + row * 3.9;
          g.fillStyle = css({ h: 195, s: 20, l: 62 });
          line(g, -6, y + 1.9, 2.4, y + 1.9, { w: 0.4, seed: row, taper: [0, 0], press: 0 });
          for (const x of [-3.7, -0.1]) {
            const pts: P[] = [];
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2 + 0.3 + row;
              const r = i % 2 ? 0.5 : 1.4;
              pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
            }
            g.fillStyle = '#5d6370';
            path(g, pts);
            g.fill();
          }
        }
        g.fillStyle = 'rgba(255,255,255,0.7)';
        line(g, -5.4, 0.4, 1.4, -9.8, { w: 0.6, seed: 2, taper: [0.2, 0.2], press: 0 });
        g.restore();
        pen(g, win, k.seed + 2, 0.4, 0.9);
        // Coin slot and buttons.
        part(g, boxPts(3.3, -10.6, 3, 5, 0.4, k.seed + 3), { h: 212, s: 9, l: 70 }, k.seed + 3, { depth: 0.3, thin: 0.3, thick: 0.6 });
        tick(g, 4.8, -9.8, 4.8, -7, 0.55, 4);
        for (const y of [-3.4, -1.4, 0.6]) dot(g, 4.8, y, 0.6, k.seed + y, '#ffd84a');
        // The tray the stars drop into, dark under its flap.
        g.fillStyle = INK;
        path(g, boxPts(-5.8, 2.8, 11.6, 4.6, 0.7, k.seed + 5));
        g.fill();
        part(g, boxPts(-5.4, 2.6, 10.8, 1.3, 0.4, k.seed + 6), { h: 212, s: 9, l: 62 }, k.seed + 6, { depth: 0.2, thin: 0.3, thick: 0.6 });
      },
    ],
    barrel: [[3, -2.5, 8, 5], (g, k) => part(g, boxPts(4.2, -1.6, 5.4, 3.2, 0.6, k.seed + 6), k.pal.dark, k.seed + 6, { depth: 0.4, thin: 0.35, thick: 0.8 })],
    aimed(s, l) {
      if (l.ready) loaded(s, l, 10.6, 0.7, l.rc.t * 4);
    },
  },
  // Heartburn Idol: a tiki post with a chili cut into it and a fire cup on top. Its grooves glow as it reloads.
  totem: {
    frame: { pivot: [TX(8), TY(4)], cam: [TX(-1.6), TY(2)] },
    mount: [
      [-9, -14.5, 18, 31],
      (g, k) => {
        const wd = wood(k.wood, 42);
        const [px, py, pw] = tall(TOTEM.post);
        const [fx, fy, fw, fh] = tall(TOTEM.foot);
        // The post: carved wood, flared at the foot.
        const post = poly(fx, fy + fh, fx + fw, fy + fh, fx + fw, fy + 0.8, px + pw, fy - 0.6, px + pw, py, px, py, px, fy - 0.6, fx, fy + 0.8);
        part(g, post, wd, k.seed, { depth: 1.2, thin: 0.55, thick: 1.6 });
        g.save();
        path(g, post);
        g.clip();
        // Carved bands: a groove with a lit lip under each.
        for (const y of [py + 3, py + 15.5]) {
          g.fillStyle = INK;
          line(g, px - 1, y, px + pw + 1, y + 0.1, { w: 0.8, seed: k.seed + y, taper: [0.05, 0.05], press: 0.3 });
          g.fillStyle = css(wd, 14);
          line(g, px - 1, y + 0.7, px + pw + 1, y + 0.8, { w: 0.45, seed: k.seed + y + 1, taper: [0.05, 0.05], press: 0.1 });
        }
        // Flutes carved down the post under the lower band, and the grain.
        for (const x of [-3.6, 0, 3.6]) tick(g, x, py + 17, x, fy - 0.4, 0.5, x * 5 + 3, css(wd, -22, 1, 6));
        for (let i = 0; i < 4; i++) {
          const x = px + 1 + hash2(i, 1, k.seed) * (pw - 2);
          tick(g, x, py + 4.4 + i * 2.4, x + 0.2, py + 6 + i * 2.4, 0.35, i, css(wd, -16, 1, 6));
        }
        g.restore();
        // The chili, cut in and painted: hanging stem-up on a slant, so it reads as a pepper.
        g.save();
        g.translate(0.6, py + 9.2);
        g.rotate(-1.15);
        const chili = poly(-3.4, 0.3, -1.6, -0.6, 0.9, -1.2, 3, -1.3, 3.5, 0.1, 2.9, 1, 0.6, 1, -1.9, 0.9);
        part(g, chili, { h: 3, s: 80, l: 46 }, k.seed + 3, { depth: 0.3, thin: 0.35, thick: 0.8 });
        part(g, poly(3.1, -1.4, 4.3, -1, 4.3, 0.9, 3.1, 1.1), { h: 105, s: 55, l: 38 }, k.seed + 4, { depth: 0.2, thin: 0.3, thick: 0.6 });
        g.fillStyle = css({ h: 105, s: 55, l: 32 });
        line(g, 4.3, 0, 5.6, -0.7, { w: 0.6, seed: 4, taper: [0, 0.4], press: 0 });
        g.restore();
        // The fire cup: a bronze bowl with a rolled rim, coals in it.
        const [rx, ry, rw, rh] = tall(TOTEM.rim);
        const [bx, by, bw, bh] = tall(TOTEM.bowl);
        const cup = poly(rx, ry, rx + rw, ry, rx + rw, ry + rh, bx + bw, by + 0.4, bx + bw - 0.6, by + bh, bx + 0.6, by + bh, bx, by + 0.4, rx, ry + rh);
        part(g, cup, { h: 30, s: 50, l: 40 }, k.seed + 5, { depth: 0.8, thin: 0.5, thick: 1.4 });
        g.fillStyle = css({ h: 30, s: 50, l: 58 });
        line(g, rx + 0.8, ry + 0.9, rx + rw - 1.2, ry + 0.9, { w: 0.6, seed: k.seed + 6, taper: [0.2, 0.3], press: 0.1 });
        g.fillStyle = INK;
        path(g, ovalPts(0, ry - 0.1, rw / 2 - 1, 0.9, k.seed + 7, 0.04, 16));
        g.fill();
        for (const x of [-3.4, -0.6, 2.4]) dot(g, x, ry - 0.3, 0.8, k.seed + x, '#ff6a1f');
      },
    ],
    over(l) {
      const g = l.rc.g;
      const hot: HSL = { h: 4, s: 100, l: 55 };
      const k = 0.25 + l.reload * 0.75;
      const [px, py, pw] = tall(TOTEM.post);
      // Heat building in the carving: the grooves glow, and the cup flares.
      g.fillStyle = css(hot, 15, k * 0.8);
      for (const y of [py + 3, py + 15.5]) {
        const a = l.p(px + 1.2, y);
        const b = l.p(px + pw - 1.2, y);
        line(g, a.x, a.y, b.x, b.y, { w: 0.5, seed: y, taper: [0.2, 0.2], press: 0 });
      }
      const top = l.p(0, tall(TOTEM.rim)[1] - 0.4);
      flame(g, top.x, top.y, 2.6 + l.reload, 2.8 + l.reload * 3.4, { h: 28, s: 100, l: 58 }, l.rc.t);
      const ox = l.x + Math.cos(l.angle) * 10.5;
      const oy = l.y + Math.sin(l.angle) * 10.5;
      const orb = 0.8 + l.reload * 2.2 + Math.sin(l.rc.t * 12) * 0.25;
      glowDot(g, ox, oy, orb * 4, hot, 0.8 * l.reload);
      ball(l.rc.s, ox, oy, orb, { h: 6, s: 90, l: 52 }, 3);
      light(l.rc, ox, oy, 50, hot, 0.3 + l.reload * 0.5);
    },
  },
  // Dodgeball Coach: a gumball machine, globe on its stand, a whistle on a lanyard round its neck.
  gumball: {
    frame: { pivot: [TX(8), TY(21)], cam: [TX(1.6), TY(-4.2)] },
    mount: [
      [-9, -17, 18, 34],
      (g, k) => {
        const paint: HSL = { h: k.st.hue, s: 70, l: 46 };
        // The cast stand: a foot, a body with the chute and a coin dial, a collar under the globe.
        const [fx, fy, fw, fh] = tall(GUMBALL.foot);
        part(g, boxPts(fx, fy, fw, fh, 1, k.seed, 0.1), { ...paint, l: 38 }, k.seed, { depth: 0.6, thin: 0.5, thick: 1.4, shade: -14 });
        const [bx, by, bw, bh] = tall(GUMBALL.body);
        const body = boxPts(bx, by, bw, bh + 0.6, 1.2, k.seed + 1, 0.12);
        part(g, body, paint, k.seed + 1, { depth: 1, thin: 0.55, thick: 1.5, shade: -18 });
        g.fillStyle = css(paint, 20);
        line(g, bx + 1.2, by + 1.6, bx + 1.2, by + bh - 1.4, { w: 0.7, seed: k.seed + 2, taper: [0.2, 0.3], press: 0.1 });
        // The chute's mouth, where the balls come out.
        g.fillStyle = INK;
        path(g, ovalPts(0.6, 5, 2.4, 1.9, k.seed + 3, 0.03, 14));
        g.fill();
        part(g, poly(-2, 3.2, 3.2, 3.2, 3.2, 4.2, -2, 4.2), { h: 212, s: 9, l: 70 }, k.seed + 4, { depth: 0.2, thin: 0.3, thick: 0.6 });
        // The coin dial.
        ball(g, 0, 10, 1.6, { h: 212, s: 9, l: 70 }, k.seed + 5);
        tick(g, -0.9, 10, 0.9, 10, 0.45, 2);
        const [nx, ny, nw, nh] = tall(GUMBALL.neck);
        part(g, boxPts(nx, ny, nw, nh + 0.4, 0.6, k.seed + 6), iron(k.pal, 46), k.seed + 6, { depth: 0.4, thin: 0.4, thick: 1 });
        // The globe: glass full of balls, a hard glint, the cap on top.
        const [cx, cy, r] = GUMBALL.globe;
        const globe = ovalPts(TX(cx), TY(cy), r, r, k.seed + 7, 0.015, 28);
        tone(g, globe, { h: 200, s: 25, l: 88 }, { depth: 0.7, shade: -10 });
        g.save();
        path(g, globe);
        g.clip();
        const cols = [3, 45, 200, 3, 120, 280, 45, 3, 200, 120, 3];
        for (let i = 0; i < cols.length; i++) {
          const row = Math.floor(i / 4);
          const bxx = -4.6 + (i % 4) * 3 + (row % 2) * 1.5;
          const byy = TY(cy) + 4.6 - row * 2.8;
          ball(g, bxx, byy, 1.35, { h: cols[i], s: 72, l: 52 }, i + 20);
        }
        g.restore();
        glint(g, poly(TX(cx) - 5, TY(cy) - 1, TX(cx) - 4, TY(cy) - 4.2, TX(cx) - 1.6, TY(cy) - 5.8), 'rgba(255,255,255,0.95)', 0.8);
        pen(g, globe, k.seed + 8, 0.45, 1.1);
        const [kx, ky, kw, kh] = tall(GUMBALL.cap);
        part(g, boxPts(kx, ky, kw, kh + 0.4, 0.5, k.seed + 9), paint, k.seed + 9, { depth: 0.3, thin: 0.35, thick: 0.7 });
      },
    ],
    barrel: [
      [2.5, -2.5, 8, 5],
      (g, k) => part(g, boxPts(3.6, -1.8, 5.4, 3.6, 0.6, k.seed + 3), k.pal.dark, k.seed + 3, { depth: 0.4, thin: 0.35, thick: 0.8 }),
    ],
    // Lanyard round the neck, whistle hanging off it beside the body.
    front: [
      [-6, -0.5, 14, 8],
      (g, k) => {
        const cord = poly(-3.4, 0.6, -0.6, 1.8, 2.4, 1.4, 5.4, 2.8, 6, 3.8);
        g.fillStyle = INK;
        stroke(g, cord, { w: 1.1, seed: 7, taper: [0, 0], press: 0 });
        g.fillStyle = '#2f7de0';
        stroke(g, cord, { w: 0.55, seed: 7, taper: [0, 0], press: 0 });
        part(g, boxPts(5, 3.6, 2.5, 1.9, 0.8, k.seed + 8), { h: 210, s: 8, l: 82 }, k.seed + 8, { depth: 0.3, thin: 0.3, thick: 0.7 });
        dot(g, 6.9, 4.5, 0.4, 9);
      },
    ],
    aimed(s, l) {
      if (l.ready) loaded(s, l, 9.6, 0.6);
    },
  },
};
