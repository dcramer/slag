import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { BALLISTA_TOWER, CANNON_CARRIAGE, GUMBALL, type LauncherStyle, TOTEM } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, stamp, tick, tone } from '../../ink-props';
import { glowDot, light } from '../../kit';
import { iron } from '../machine';
import { drawGlider, roundSprite, stampRound } from '../projectiles';
import { HANGAR_BOX, hangarLoft } from './hangar-art';
import type { Bk, Live, Look } from './launcher';
import { cartWheel } from './launcher-house';
import { inkTongue } from './flame';

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

const BRONZE: HSL = { h: 40, s: 48, l: 34 };

/** The Heartburn Idol's drums, top to bottom (art px, 16×32 frame round its middle): each a band of carving. */
const TIKI_DRUMS = [
  [-6.6, -2.6],
  [-2.6, 3.4],
  [3.4, 7.4],
  [7.4, 10.6],
] as const;
/** The grooves between the drums, which glow as it reloads. */
const TIKI_GROOVES = [-2.6, 3.4, 7.4];

/**
 * One carved drum: its sides swell past the groove above and below it (within the post's rect plus the
 * edge drift), so the stack reads as turned and carved, not a box.
 */
function drumPts(y0: number, y1: number, seed: number): P[] {
  const side: P[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    side.push({ x: 5.9 + Math.sin(t * Math.PI) * 1.05 + (hash2(i, 3, seed) - 0.5) * 0.12, y: y0 + (y1 - y0) * t });
  }
  const pts: P[] = side.map((p) => ({ x: -p.x, y: p.y }));
  for (let i = side.length - 1; i >= 0; i--) pts.push(side[i]);
  return pts;
}

/** A cut in the wood: a dark line with a lit lip just under it, which is what makes it read as relief. */
function cut(g: CanvasRenderingContext2D, pts: P[], wd: HSL, seed: number, w = 0.65) {
  g.fillStyle = css(wd, 18);
  stroke(
    g,
    pts.map((p) => ({ x: p.x + 0.35, y: p.y + 0.6 })),
    { w: w * 0.7, seed: seed + 1, taper: [0.2, 0.2], press: 0.1 },
  );
  g.fillStyle = css(wd, -30, 1, 4);
  stroke(g, pts, { w, seed, taper: [0.2, 0.2], press: 0.3 });
}

/**
 * The Heartburn Idol, baked: a flared plinth, four carved drums (chevrons, a chili in relief, painted
 * diamonds, flutes) under a bronze collar, and a hammered bronze brazier with ring handles and coals in
 * its mouth. Every edge that looks solid is one of TOTEM's rects, give or take the edge drift. No face.
 */
function tikiPost(g: CanvasRenderingContext2D, k: Bk) {
  const wd = wood(k.wood, 39);
  const dark = wood(k.wood, 26);
  // The foot: a plinth, and the post flaring out into it.
  const base = poly(-7.5, 16, 7.5, 16, 7.5, 13.7, 7, 13, 6.9, 12.3, 6.4, 11.3, 5.9, 10.6, -5.9, 10.6, -6.4, 11.3, -6.9, 12.3, -7, 13, -7.5, 13.7);
  part(g, base, dark, k.seed + 20, { depth: 0.8, thin: 0.5, thick: 1.6, shade: -12 });
  g.save();
  path(g, base);
  g.clip();
  cut(g, poly(-7.4, 13.1, 7.4, 13.1), dark, k.seed + 21, 0.6);
  g.fillStyle = css(dark, -12, 1, 4);
  path(g, poly(3.6, 10, 8, 10, 8, 16.5, 4.6, 16.5));
  g.fill();
  for (let i = 0; i < 3; i++) tick(g, -5.6 + i * 4.4, 14.6, -4.2 + i * 4.4, 14.9, 0.35, i + k.seed, css(dark, -20, 1, 4));
  g.restore();

  TIKI_DRUMS.forEach(([y0, y1], di) => {
    const pts = drumPts(y0, y1, k.seed + di);
    part(g, pts, wd, k.seed + di * 7, { depth: 0.6, thin: 0.5, thick: 1.5, shade: -10 });
    g.save();
    path(g, pts);
    g.clip();
    // Round it: a hand-cut shade down the far side, a lit stripe on the near one.
    g.fillStyle = css(wd, -13, 1, 4);
    path(g, poly(3.3, y0 - 1, 8, y0 - 1, 8, y1 + 1, 2.7, y1 + 1));
    g.fill();
    g.fillStyle = css(wd, 12);
    path(g, poly(-4.8, y0 + 0.5, -3.7, y0 + 0.5, -3.9, y1 - 0.5, -5, y1 - 0.5));
    g.fill();
    const my = (y0 + y1) / 2;
    if (di === 0) {
      // Chevrons, and the brazier's hard shadow across the top.
      const zz: P[] = [];
      for (let i = 0; i <= 8; i++) zz.push({ x: -5.8 + i * 1.45, y: my + (i % 2 ? -1.2 : 0.9) });
      cut(g, zz, wd, k.seed + 30, 0.7);
      g.fillStyle = css(wd, -26, 1, 4);
      path(g, poly(-8, y0 - 1, 8, y0 - 1, 8, y0 + 0.9, -2, y0 + 1.2, -8, y0 + 0.5));
      g.fill();
    } else if (di === 1) {
      // The chili, cut in proud and painted: its shadow sunk into the wood under it.
      const chili = poly(-4.6, -1.2, -2, -2.2, 1.2, -1.9, 3.8, -0.6, 5.2, 1.2, 5.4, 2.3, 3.9, 1.6, 1.6, 1.2, -1.2, 1.4, -3.6, 1.3, -4.9, 0.3);
      g.save();
      g.translate(-0.2, my - 0.1);
      g.fillStyle = css(wd, -30, 1, 4);
      path(
        g,
        chili.map((p) => ({ x: p.x + 0.7, y: p.y + 0.8 })),
      );
      g.fill();
      part(g, chili, { h: 3, s: 82, l: 47 }, k.seed + 31, { depth: 0.5, thin: 0.35, thick: 0.8 });
      glint(g, poly(-3, -1.5, -0.4, -1.7, 2, -1), 'rgba(255,225,215,0.85)', 0.5);
      part(g, poly(-5.6, -1.6, -4.3, -2.3, -3.8, 0.8, -5.2, 0.7), { h: 105, s: 55, l: 38 }, k.seed + 32, { depth: 0.3, thin: 0.3, thick: 0.6 });
      g.fillStyle = INK;
      stroke(g, poly(-5.2, -0.6, -6, -1.4, -6.3, -2.6), { w: 0.9, seed: 2, taper: [0, 0.3], press: 0 });
      g.restore();
    } else if (di === 2) {
      // Diamonds, cut in and painted in the part's colour.
      for (const x of [-3.7, 0, 3.7]) {
        const dm = poly(x, my - 1.7, x + 1.6, my, x, my + 1.7, x - 1.6, my);
        g.fillStyle = css(wd, -30, 1, 4);
        path(g, dm);
        g.fill();
        g.fillStyle = css({ h: k.st.hue, s: 55, l: 46 });
        path(g, poly(x - 0.1, my - 0.9, x + 0.8, my + 0.1, x - 0.1, my + 1, x - 0.9, my));
        g.fill();
        tick(g, x + 0.4, my + 1.3, x + 1.5, my + 0.2, 0.35, x + 9, css(wd, 20));
      }
    } else {
      // Flutes.
      for (const x of [-4.2, -2.1, 0, 2.1, 4.2]) cut(g, poly(x, y0 + 0.9, x + 0.05, y1 - 0.7), wd, k.seed + 40 + x, 0.55);
    }
    for (let i = 0; i < 2; i++) {
      const x = -4 + hash2(i, di, k.seed) * 8;
      tick(g, x, y0 + 0.8, x + 0.2, y0 + 1.9, 0.3, i + di * 3, css(wd, -18, 1, 6));
    }
    g.restore();
  });

  // The collar the brazier sits in: a bronze band, studded.
  const collar = boxPts(-6.6, -8.2, 13.2, 1.9, 0.5, k.seed + 50, 0.1);
  part(g, collar, { ...BRONZE, l: 28 }, k.seed + 50, { depth: 0.4, thin: 0.4, thick: 1.1 });
  for (const x of [-4.4, 0, 4.4]) dot(g, x, -7.2, 0.45, x + 51, css(BRONZE, 30));

  // The brazier: a hammered bowl under a rolled rim, ring handles, coals in its mouth.
  const bowl = poly(-7, -10.6, 7, -10.6, 6.7, -9.3, 5.7, -8, -5.7, -8, -6.7, -9.3);
  part(g, bowl, BRONZE, k.seed + 60, { depth: 0.6, thin: 0.45, thick: 1.4, shade: -14 });
  g.save();
  path(g, bowl);
  g.clip();
  for (const [x, y] of [
    [-4.2, -9.4],
    [-1, -9],
    [2.4, -9.5],
    [5, -9.1],
  ]) {
    g.fillStyle = css(BRONZE, -16, 1, 4);
    path(g, ovalPts(x + 0.2, y + 0.2, 0.9, 0.6, x * 3, 0.05, 8));
    g.fill();
    g.fillStyle = css(BRONZE, 14);
    path(g, ovalPts(x - 0.2, y - 0.15, 0.6, 0.35, x * 3 + 1, 0.05, 8));
    g.fill();
  }
  g.restore();
  for (const sx of [-1, 1]) {
    const ring = ovalPts(sx * 8.4, -9.2, 1, 1.3, sx + 70, 0.03, 10);
    g.fillStyle = INK;
    stroke(g, [...ring, ring[0]], { w: 0.76, seed: sx + 71, taper: [0, 0], press: 0.1 });
    g.fillStyle = css(BRONZE, 10);
    stroke(g, [...ring, ring[0]], { w: 0.4, seed: sx + 72, taper: [0, 0], press: 0 });
  }
  const rim = boxPts(-8, -13, 16, 2.5, 1.1, k.seed + 61, 0.12);
  part(g, rim, { ...BRONZE, l: 44 }, k.seed + 61, { depth: 0.5, thin: 0.45, thick: 1.3, shade: -16 });
  g.fillStyle = css(BRONZE, 30);
  line(g, -6.6, -12.3, 5.4, -12.4, { w: 0.55, seed: k.seed + 62, taper: [0.2, 0.4], press: 0.1 });
  for (const x of [-5.6, 0, 5.6]) dot(g, x, -11.4, 0.4, x + 63, css(BRONZE, 34));
  // The mouth, dark, coals heaped in it.
  g.fillStyle = INK;
  path(g, ovalPts(0, -13, 6.3, 1.1, k.seed + 64, 0.04, 16));
  g.fill();
  for (const [x, c] of [
    [-3.8, '#b8230f'],
    [-1.4, '#ff6a1f'],
    [1.2, '#b8230f'],
    [3.6, '#ff6a1f'],
  ] as const) {
    g.fillStyle = c;
    path(g, ovalPts(x, -13.3, 1.3, 0.75, x * 5, 0.1, 8));
    g.fill();
  }
}

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
        line(g, x - 1, y + 3.4, x1 + 1, y + 3.4, { w: 0.49, seed: 3, taper: [0.05, 0.05], press: 0.3 });
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
  // Heartburn Idol: a carved tiki-torch post, stacked drums of relief on a flared foot, a bronze brazier on
  // top with a fire in it. Its grooves glow and the fire climbs as it reloads; the next chili cooks in the flame.
  totem: {
    frame: { pivot: [TX(8), TY(4)], cam: [TX(-1.6), TY(2)] },
    mount: [[-10, -14.5, 20, 31], (g, k) => tikiPost(g, k)],
    over(l) {
      const g = l.rc.g;
      const s = l.rc.s;
      const hot: HSL = { h: 14, s: 100, l: 55 };
      const k = 0.2 + l.reload * 0.8;
      // Heat building in the carving: every groove between the drums glows, hotter as it nears a shot.
      g.fillStyle = css(hot, 12, k * 0.85);
      for (const y of TIKI_GROOVES) {
        const a = l.p(-5.2, y);
        const b = l.p(5.2, y);
        line(g, a.x, a.y, b.x, b.y, { w: 0.55 + l.reload * 0.35, seed: y, taper: [0.25, 0.25], press: 0 });
      }
      // The fire: an inked flame out of the brazier's mouth, leaning up whichever way the post is turned.
      const top = l.p(0, tall(TOTEM.rim)[1] + 0.2);
      const q = l.p(0, tall(TOTEM.rim)[1] - 1);
      let dx = q.x - top.x;
      let dy = q.y - top.y - 1;
      const n = Math.hypot(dx, dy) || 1;
      dx /= n;
      dy /= n;
      glowDot(g, top.x + dx * 5, top.y + dy * 5, 7 + l.reload * 4, hot, 0.3 + l.reload * 0.3);
      inkTongue(s, top.x, top.y, dx, dy, 6 + l.reload * 6, 4.6 + l.reload * 1.2, l.rc.t, 1);
      // The next chili, cooking in the flame and pointing where it'll fly.
      if (l.reload > 0.15) {
        const sp = roundSprite(l.m.ammo);
        if (sp) {
          const kk = 0.35 + l.reload * 0.45;
          s.save();
          s.translate(l.x + Math.cos(l.angle) * 3, l.y + Math.sin(l.angle) * 3 - 1);
          s.rotate(l.angle);
          if (l.flip < 0) s.scale(1, -1);
          s.scale(kk, kk);
          stamp(s, sp);
          s.restore();
        }
      }
      light(l.rc, top.x + dx * 6, top.y + dy * 6, 46, hot, 0.35 + l.reload * 0.45);
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
        stroke(g, cord, { w: 0.88, seed: 7, taper: [0, 0], press: 0 });
        g.fillStyle = '#2f7de0';
        stroke(g, cord, { w: 0.39, seed: 7, taper: [0, 0], press: 0 });
        part(g, boxPts(5, 3.6, 2.5, 1.9, 0.8, k.seed + 8), { h: 210, s: 8, l: 82 }, k.seed + 8, { depth: 0.3, thin: 0.3, thick: 0.7 });
        dot(g, 6.9, 4.5, 0.4, 9);
      },
    ],
    aimed(s, l) {
      if (l.ready) loaded(s, l, 9.6, 0.6);
    },
  },
};
