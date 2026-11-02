import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { launcherAngle, type LauncherStyle, type ModuleOf, type PropStyle } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, glowDot, light, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, type DrawCtx } from '../common';
import { iron } from '../machine';
import { drawGlider, rang, roundSprite, stampRound } from '../projectiles';
import { baseplate, bean, cartWheel, hub, legs, pedestal, skull, stand, wheel } from './launcher-house';

/**
 * Launchers, inked: each style is a parody of a genre staple (docs/PARODY.md, Launchers). A style is three
 * baked pieces: the `mount` (still, round the block's center), the `barrel` (drawn along +x and turned to
 * the aim, mirrored when it aims left so its lit side stays up), and a `front` that sits over the barrel's
 * root. Only the loaded round, the glow and the eyes are drawn live.
 */

type Launcher = ModuleOf<'launcher'>;
type Box = readonly [number, number, number, number];

interface Bk {
  pal: MetalPalette;
  st: PropStyle;
  wood: HSL;
  hue: HSL;
  glow: HSL;
  /** Which way it faces, for mounts that care (a cap worn backwards). */
  dir: 1 | -1;
  seed: number;
}

interface Live {
  rc: RC;
  m: Launcher;
  x: number;
  y: number;
  angle: number;
  /** 0..1 how loaded it is. */
  reload: number;
  ready: boolean;
  pal: MetalPalette;
  st: PropStyle;
  glow: HSL;
  /** -1 while the barrel is mirrored. */
  flip: number;
}

interface Look {
  /** What it stands on, under the mount: wheels, legs, a stand (launcher-house.ts). */
  house?: readonly [Box, (g: CanvasRenderingContext2D, k: Bk) => void];
  mount?: readonly [Box, (g: CanvasRenderingContext2D, k: Bk) => void];
  barrel?: readonly [Box, (g: CanvasRenderingContext2D, k: Bk) => void];
  front?: readonly [Box, (g: CanvasRenderingContext2D, k: Bk) => void];
  /** The mount art depends on facing. */
  faced?: boolean;
  /** Barrel recoils along its length. */
  recoil?: number;
  /** Live, in the barrel's frame (after the mirror). */
  aimed?(s: CanvasRenderingContext2D, l: Live): void;
  /** Live, in world space, after everything else. */
  over?(l: Live): void;
}

const STEEL: HSL = { h: 212, s: 9, l: 70 };

/** A stone tone from the part's hue: grey with a cast. */
const stone = (k: Bk, l = 58): HSL => ({ h: k.st.hue, s: 9, l });

/** A thin flat band across a shape, inside its clip: hoops, stripes, straps. */
function band(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, col: string, seed: number) {
  g.fillStyle = col;
  line(g, x, y0, x, y1, { w, seed, taper: [0.02, 0.02], press: 0.1 });
}

/** A loaded round sitting in the barrel frame at (x, 0). */
function loaded(s: CanvasRenderingContext2D, l: Live, x: number, k = 1, spin = 0) {
  const sp = roundSprite(l.m.ammo);
  if (sp) stampRound(s, sp, x, 0, spin, false, k);
}

/** Pull of a bow: 1 drawn back and loaded, 0 just loosed. */
const pull = (l: Live) => (l.reload < 1 ? l.reload : 1);

function bowString(s: CanvasRenderingContext2D, tipX: number, tipY: number, nock: number) {
  s.fillStyle = 'rgba(240,232,214,0.95)';
  line(s, tipX, -tipY, nock, 0, { w: 0.5, seed: 1, taper: [0, 0], press: 0 });
  line(s, nock, 0, tipX, tipY, { w: 0.5, seed: 2, taper: [0, 0], press: 0 });
}

const LOOKS: Record<LauncherStyle, Look> = {
  // Arrow Trap: a round-headed stone shrine on a plinth, a slot turning in a drum on its face, and a
  // bandaged knee scratched into the stone.
  crossbow: {
    mount: [
      [-9.5, -9.5, 19, 19],
      (g, k) => {
        const st = stone(k);
        part(g, boxPts(-8, 5, 16, 3, 0.8, k.seed + 1), { ...st, l: st.l - 8 }, k.seed + 1, { depth: 0.6, thin: 0.5, thick: 1.4 });
        const shrine: P[] = [
          { x: 6.9, y: 5.2 },
          { x: -6.9, y: 5.2 },
        ];
        for (let i = 0; i <= 14; i++) {
          const a = Math.PI + (i / 14) * Math.PI;
          shrine.push({ x: Math.cos(a) * 6.9, y: -1.1 + Math.sin(a) * 6.9 });
        }
        tone(g, shrine, st, { depth: 1.2, shade: -15 });
        g.save();
        path(g, shrine);
        g.clip();
        // A chiselled rim round the head: lit on its upper left, in shade on its lower right.
        const rim: P[] = [];
        for (let i = 0; i <= 14; i++) {
          const a = Math.PI + (i / 14) * Math.PI;
          rim.push({ x: Math.cos(a) * 5.4, y: -1.1 + Math.sin(a) * 5.4 });
        }
        g.fillStyle = css(st, 14);
        stroke(g, rim.slice(0, 8), { w: 0.8, seed: k.seed + 2, taper: [0.2, 0.3], press: 0.2 });
        g.fillStyle = css(st, -24, 1, 4);
        stroke(g, rim.slice(7), { w: 0.8, seed: k.seed + 3, taper: [0.3, 0.2], press: 0.2 });
        for (let i = 0; i < 5; i++) {
          const x = -5 + hash2(i, 1, k.seed) * 10;
          const y = -5 + hash2(i, 2, k.seed) * 9;
          if (Math.hypot(x, y) < 5.4) continue;
          tick(g, x, y, x + 1.3, y + 0.7, 0.45, i, css(st, -22, 1, 4));
        }
        g.restore();
        pen(g, shrine, k.seed + 4, 0.55, 1.7);
        // Where the slot turns: a drum cut into the face, sunk into shadow at its top and lit at its lip.
        g.fillStyle = INK;
        path(g, ovalPts(0, 0, 4.3, 4.3, k.seed + 3, 0.03, 20));
        g.fill();
        g.fillStyle = css(st, 10);
        path(g, ovalPts(0.3, 0.35, 3.6, 3.6, k.seed + 4, 0.03, 20));
        g.fill();
        g.fillStyle = css(st, -16, 1, 4);
        path(g, ovalPts(-0.15, -0.2, 3.3, 3.3, k.seed + 5, 0.03, 20));
        g.fill();
        // Scratched on the plinth's corner: a leg, bent at a bandaged knee.
        const sc = css(st, -34, 1, 6);
        tick(g, -6.6, 1.6, -5, 3.2, 0.5, 7, sc);
        tick(g, -5, 3.2, -5.6, 4.8, 0.5, 8, sc);
        tick(g, -5.6, 4.8, -6.5, 4.9, 0.45, 9, sc);
        g.fillStyle = '#f1e8d2';
        line(g, -5.8, 2.6, -4.4, 3.7, { w: 1.1, seed: 10, taper: [0.05, 0.05], press: 0 });
        tick(g, -5.45, 2.75, -4.75, 3.55, 0.35, 11, '#c0182a');
      },
    ],
    barrel: [
      [-3, -4, 11, 8],
      (g, k) => {
        const st = stone(k, 58);
        // The slot, cut from the middle out through the face: a lit lip above it, a dark one below.
        g.fillStyle = INK;
        path(g, poly(-1.6, -1.2, 6.9, -1.5, 6.9, 1.5, -1.6, 1.2));
        g.fill();
        tick(g, -1, -2.1, 6.4, -2.3, 0.5, 6, css(st, 20));
        tick(g, -1, 2.2, 6.4, 2.4, 0.5, 7, css(st, -24));
      },
    ],
    recoil: 0,
    aimed(s, l) {
      if (!l.ready) return;
      // A bolt waits in the slot, its head out.
      s.fillStyle = '#9a7a52';
      s.fillRect(0, -0.35, 5, 0.7);
      s.fillStyle = '#d5dae2';
      path(s, poly(4.4, -1.3, 7.6, 0, 4.4, 1.3, 5, 0));
      s.fill();
      s.fillStyle = INK;
      stroke(s, poly(4.4, -1.3, 7.6, 0, 4.4, 1.3), { w: 0.5, seed: 1, taper: [0.1, 0.1], press: 0 });
    },
  },
  // Tower Defense: a ballista on a tiny tower, price tag still on.
  ballista: {
    mount: [
      [-9.5, -9.5, 19, 19],
      (g, k) => {
        const st = stone(k, 54);
        // A tiny tower: battered walls, a corbelled ledge, and merlons notched out of its top.
        const pts = poly(
          -7.9,
          8,
          7.9,
          8,
          6.4,
          -3,
          7.4,
          -3.6,
          7.4,
          -8,
          4.6,
          -8,
          4.6,
          -6.2,
          1.5,
          -6.2,
          1.5,
          -8,
          -1.5,
          -8,
          -1.5,
          -6.2,
          -4.6,
          -6.2,
          -4.6,
          -8,
          -7.4,
          -8,
          -7.4,
          -3.6,
          -6.4,
          -3,
        );
        tone(g, pts, st, { depth: 1.3 });
        g.save();
        path(g, pts);
        g.clip();
        g.fillStyle = INK;
        line(g, -8.4, -3.3, 8.4, -3.3, { w: 0.7, seed: 3, taper: [0.05, 0.05], press: 0.3 });
        const mortar = css(st, -24, 1, 4);
        for (const [y, off] of [
          [0, 0],
          [3.3, 2.4],
          [6.6, 0],
        ] as const) {
          tick(g, -8, y, 8, y + 0.2, 0.45, y * 9, mortar);
          for (let x = -5.4 + off; x < 8; x += 4.8) tick(g, x, y - 3.1, x, y - 0.2, 0.42, x * 7 + y, mortar);
        }
        // An arrow loop, dark, under the ledge.
        g.fillStyle = INK;
        path(g, boxPts(-0.6, 1, 1.2, 4, 0.5, k.seed + 2));
        g.fill();
        g.restore();
        pen(g, pts, k.seed + 1, 0.55, 1.6);
        // The price tag, on a string from a merlon.
        tick(g, 6, -6.2, 5.6, -2.2, 0.35, 12, '#e9dfc8');
        g.save();
        g.translate(5.6, -0.4);
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
    barrel: [
      [-8, -10.5, 19, 21],
      (g, k) => {
        const wd = { ...k.wood, l: 44 };
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
      const p = pull(l);
      const nock = -1 - p * 4.5;
      bowString(s, 3.6, 9.1, nock);
      if (l.reload > 0.35) {
        s.save();
        s.translate(nock + 11.5, 0);
        stamp(s, roundSprite('bolt')!);
        s.restore();
      }
    },
  },
  // Pirate Cannon: a ship's gun on its stepped carriage and two cart wheels, an eyepatch on the muzzle.
  cannon: {
    mount: [
      [-9.5, -4, 19, 13],
      (g, k) => {
        const wd = { ...k.wood, l: 36 };
        const cheek = poly(-7.6, 5.6, -7, 1.8, -4.4, 1.8, -3.8, -1.4, 3.8, -1.4, 4.4, 1.8, 7, 1.8, 7.6, 5.6);
        part(g, cheek, wd, k.seed, { depth: 0.9, thin: 0.5, thick: 1.4 });
        tick(g, -6.6, 3.8, 6.6, 3.9, 0.5, 2, css(wd, -18, 1, 6));
        tick(g, -3.2, 0.4, 3.2, 0.5, 0.45, 3, css(wd, -18, 1, 6));
        // A coil of rope hung on its cheek, and a ball ready by the wheel.
        for (const [x, r] of [
          [5.4, 1.2],
          [5.4, 0.6],
        ] as const) {
          g.fillStyle = css({ h: 38, s: 35, l: 56 });
          stroke(g, ovalPts(x, 3.6, r, r * 0.6, x * r, 0.05, 12).concat([{ x: x + r, y: 3.6 }]), { w: 0.55, seed: r * 9, taper: [0, 0], press: 0 });
        }
        for (const x of [-4.4, 4.4]) cartWheel(g, x, 5.6, 2.4, wd, k.pal, k.seed + x);
      },
    ],
    // The trunnion strap the barrel turns under.
    front: [[-2.5, -2.5, 5, 5], (g, k) => dot(g, 0, 0, 1.3, k.seed + 9, css(k.pal.spec, -10))],
    barrel: [
      [-9.5, -6, 23, 12],
      (g, k) => {
        const body = poly(-4.2, -4.3, 9.6, -3.3, 9.6, 3.3, -4.2, 4.3, -6.3, 3, -7, 0, -6.3, -3);
        part(g, body, k.pal.base, k.seed, { depth: 1, thin: 0.5, thick: 1.3 });
        g.save();
        path(g, body);
        g.clip();
        for (const x of [-1, 5]) band(g, x, -5, 5, 1.4, css(k.pal.dark, 6), k.seed + x);
        glint(g, poly(-4, -3, 2, -2.7, 8, -2.3), css(k.pal.spec, -6), 0.7);
        g.restore();
        part(g, boxPts(9, -4.1, 2.8, 8.2, 0.8, k.seed + 2), k.pal.base, k.seed + 2, { depth: 0.5, thin: 0.4, thick: 1 });
        g.fillStyle = INK;
        path(g, poly(11.4, -2.4, 12.2, -2.4, 12.2, 2.4, 11.4, 2.4));
        g.fill();
        ball(g, -8, 0, 1.5, k.pal.base, k.seed + 3);
        // The eyepatch: a strap round the barrel and a patch where the eye would be.
        g.fillStyle = INK;
        stroke(g, poly(5.7, -4.6, 7.1, 0, 8.4, 4.4), { w: 0.75, seed: 4, taper: [0, 0], press: 0.2 });
        g.fillStyle = '#16100d';
        blob(g, 7.3, -1.4, 1.7, 5, 1.15, 0.1);
        g.fill();
        tick(g, 6.6, -2.4, 7.6, -2.7, 0.35, 6, 'rgba(255,255,255,0.55)');
      },
    ],
    recoil: 0.6,
  },
  // Heartburn Idol: it clutches its belly, and what comes up is chili-red.
  totem: {
    mount: [
      [-9.5, -9.5, 19, 19],
      (g, k) => {
        const wd = { ...k.wood, l: 42 };
        // A carved tiki head: a jagged crown of feathers cut into its top, a heavy jaw.
        const head = poly(
          -7.6,
          7.8,
          7.6,
          7.8,
          7.8,
          2,
          7.2,
          -4.4,
          7.8,
          -6.6,
          5.4,
          -5.6,
          4,
          -8.2,
          1.6,
          -6,
          0,
          -8.4,
          -1.6,
          -6,
          -4,
          -8.2,
          -5.4,
          -5.6,
          -7.8,
          -6.6,
          -7.2,
          -4.4,
          -7.8,
          2,
        );
        part(g, head, wd, k.seed, { depth: 1.3, thin: 0.55, thick: 1.6 });
        g.save();
        path(g, head);
        g.clip();
        g.fillStyle = css(wd, 10);
        g.fillRect(-7.2, -6, 14.4, 2.1);
        g.fillStyle = INK;
        line(g, -6.8, -3.8, 6.8, -3.7, { w: 0.8, seed: 2, taper: [0.05, 0.05], press: 0.3 });
        g.restore();
        for (const x of [-3, 3]) {
          g.fillStyle = INK;
          blob(g, x, -1.6, 1.8, k.seed + x, 0.62, 0.1);
          g.fill();
        }
        // A grimace with teeth.
        g.fillStyle = INK;
        path(g, boxPts(-3.8, 0.9, 7.6, 2.5, 0.8, k.seed + 4));
        g.fill();
        g.fillStyle = '#efe2c4';
        for (const x of [-2.6, -0.8, 1, 2.6]) g.fillRect(x - 0.6, 1.25, 1.1, 0.9);
        // Arms wrapped round the belly.
        for (const sg of [-1, 1]) {
          const arm = poly(sg * 7.2, 2.4, sg * 6, 5.4, sg * 3.2, 6.6, sg * 0.8, 6.2);
          g.fillStyle = INK;
          stroke(g, arm, { w: 3, seed: 5 + sg, taper: [0.05, 0.1], press: 0.1 });
          g.fillStyle = css(wd, 16, 1, -8);
          stroke(g, arm, { w: 1.6, seed: 5 + sg, taper: [0.05, 0.2], press: 0.1 });
        }
        for (const sg of [-1, 1]) {
          g.fillStyle = INK;
          blob(g, sg * 1.3, 6.1, 1.55, 11 + sg, 0.85, 0.1);
          g.fill();
          g.fillStyle = css(wd, 16, 1, -8);
          blob(g, sg * 1.3 - 0.2, 5.9, 1.05, 13 + sg, 0.85, 0.1);
          g.fill();
        }
        // A bead of sweat.
        g.fillStyle = '#bfe6ff';
        blob(g, 5.6, -5.4, 0.8, 9, 1.4, 0.1);
        g.fill();
        g.fillStyle = INK;
        stroke(g, poly(5.6, -6.8, 6.4, -5.4, 5.6, -4.3, 4.8, -5.4, 5.6, -6.8), { w: 0.35, seed: 10, taper: [0, 0], press: 0 });
      },
    ],
    over(l) {
      const g = l.rc.g;
      const hot: HSL = { h: 4, s: 100, l: 55 };
      const k = 0.25 + l.reload * 0.75;
      g.fillStyle = css(hot, 15, k);
      for (const x of [-3, 3]) {
        g.beginPath();
        g.ellipse(l.x + x, l.y - 1.6, 1.2, 0.7, 0, 0, Math.PI * 2);
        g.fill();
      }
      const ox = l.x + Math.cos(l.angle) * 10.5;
      const oy = l.y + Math.sin(l.angle) * 10.5;
      const orb = 0.8 + l.reload * 2.2 + Math.sin(l.rc.t * 12) * 0.25;
      glowDot(g, ox, oy, orb * 4, hot, 0.8 * l.reload);
      ball(l.rc.s, ox, oy, orb, { h: 6, s: 90, l: 52 }, 3);
      light(l.rc, ox, oy, 50, hot, 0.3 + l.reload * 0.5);
    },
  },
  // Sorry Turret: worried about all of this.
  turret: {
    // A tripod: the dome is its whole body.
    mount: [
      [-9.5, 0, 19, 9.5],
      (g, k) => {
        legs(g, 0, 3.6, [-7, 7.9, 7, 7.9, 1.4, 8.1], { h: k.st.hue, s: 10, l: 62 }, k.seed);
        hub(g, 0, 4.2, 1.8, k.pal, k.seed + 3);
      },
    ],
    barrel: [
      [1, -4.5, 12, 9],
      (g, k) => {
        for (const y of [-2.8, 0.7]) part(g, boxPts(3, y, 8.6, 2.1, 0.7, k.seed + y), k.pal.base, k.seed + y, { depth: 0.5, thin: 0.35, thick: 0.85 });
        part(g, boxPts(2.2, -3.8, 2.6, 7.6, 0.6, k.seed + 3), { ...k.pal.base, l: k.pal.base.l - 8 }, k.seed + 3, { depth: 0.4, thin: 0.35, thick: 0.8 });
      },
    ],
    front: [
      [-8, -8, 16, 14],
      (g, k) => {
        const dome = ovalPts(0, -0.6, 6.2, 5.8, k.seed + 4, 0.02);
        part(g, dome, { h: k.st.hue, s: 22, l: 78 }, k.seed + 4, { depth: 1.1, thin: 0.5, thick: 1.3 });
        // Eyes are drawn live; the brows go up in the middle, the mouth wobbles.
        for (const sg of [-1, 1]) {
          g.fillStyle = '#fbf8f0';
          blob(g, sg * 2.4, -1.3, 1.55, k.seed + sg, 1.05, 0.05);
          g.fill();
          g.fillStyle = INK;
          stroke(g, ovalPts(sg * 2.4, -1.3, 1.6, 1.68, 3, 0, 10).concat([{ x: sg * 2.4 + 1.6, y: -1.3 }]), { w: 0.4, seed: 4, taper: [0, 0], press: 0.2 });
          line(g, sg * 4.1, -3.4, sg * 1.2, -4.6, { w: 0.75, seed: 5 + sg, taper: [0.2, 0.2], press: 0.1 });
        }
        g.fillStyle = INK;
        stroke(g, poly(-2, 2.5, -1, 1.9, 0, 2.5, 1, 1.9, 2, 2.5), { w: 0.55, seed: 9, taper: [0.2, 0.2], press: 0 });
      },
    ],
    recoil: 0.4,
    over(l) {
      const s = l.rc.s;
      const lx = Math.cos(l.angle) * 0.55;
      const ly = Math.sin(l.angle) * 0.55;
      s.fillStyle = INK;
      for (const sg of [-1, 1]) circle(s, l.x + sg * 2.4 + lx, l.y - 1.3 + ly, 0.75);
      glowDot(l.rc.g, l.x, l.y - 6.2, 2.5, l.glow, 0.4 + l.reload * 0.5);
    },
  },
  // Shuriken Vendor: a vending machine on two feet, a lit header over its window, a coin slot.
  thrower: {
    mount: [
      [-8.5, -9.5, 17, 18],
      (g, k) => {
        const paint: HSL = { h: k.st.hue, s: 60, l: 46 };
        for (const x of [-5.6, 3.4])
          part(g, boxPts(x, 6, 2.2, 1.9, 0.5, k.seed + x), { h: 220, s: 8, l: 24 }, k.seed + x, { depth: 0.3, thin: 0.4, thick: 0.9 });
        const body = boxPts(-6.6, -6.4, 13.2, 12.9, 1.4, k.seed);
        part(g, body, paint, k.seed, { depth: 1.3, thin: 0.55, thick: 1.6 });
        const sign = boxPts(-7.4, -8.4, 14.8, 2.8, 1.2, k.seed + 7);
        part(g, sign, { h: 48, s: 90, l: 66 }, k.seed + 7, { depth: 0.4, thin: 0.45, thick: 1.1 });
        for (const x of [-4.6, -1.6, 1.4, 4.4]) tick(g, x, -7.4, x + 1.2, -7.4, 0.55, x, css({ h: 4, s: 70, l: 46 }));
        const win = boxPts(-5.4, -5, 7.4, 7.4, 0.6, k.seed + 1);
        tone(g, win, { h: 195, s: 35, l: 80 }, { depth: 0.6 });
        g.save();
        path(g, win);
        g.clip();
        for (const [x, y] of [
          [-3.4, -3],
          [0.2, -3],
          [-3.4, 0.6],
          [0.2, 0.6],
        ]) {
          const pts: P[] = [];
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.3;
            const r = i % 2 ? 0.5 : 1.5;
            pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
          }
          g.fillStyle = '#5d6370';
          path(g, pts);
          g.fill();
        }
        g.fillStyle = 'rgba(255,255,255,0.7)';
        line(g, -4.6, 2, 1.4, -4.6, { w: 0.6, seed: 2, taper: [0.2, 0.2], press: 0 });
        g.restore();
        pen(g, win, k.seed + 2, 0.4, 0.9);
        // Coin slot and buttons.
        part(g, boxPts(3, -5, 2.6, 4, 0.4, k.seed + 3), STEEL, k.seed + 3, { depth: 0.3, thin: 0.3, thick: 0.6 });
        tick(g, 4.3, -4.2, 4.3, -1.8, 0.55, 4);
        for (const y of [0.6, 2.4]) dot(g, 4.3, y, 0.6, k.seed + y, '#ffd84a');
        g.fillStyle = INK;
        path(g, boxPts(-5.4, 3.4, 7.4, 2, 0.5, k.seed + 5));
        g.fill();
      },
    ],
    barrel: [[3, -2.5, 8, 5], (g, k) => part(g, boxPts(4.2, -1.6, 5.4, 3.2, 0.6, k.seed + 6), k.pal.dark, k.seed + 6, { depth: 0.4, thin: 0.35, thick: 0.8 })],
    aimed(s, l) {
      if (l.ready) loaded(s, l, 10.6, 0.7, l.rc.t * 4);
    },
  },
  // Grudge Launcher: a bullet blaster. A black drum turns on a pedestal with a skull on its chest, and
  // the grudge missile's nose peeks out of its mouth when it's loaded.
  rocket: {
    mount: [[-8.5, 0, 17, 9], (g, k) => pedestal(g, k.seed)],
    // The skull sits on the drum's pivot, so it stays upright whichever way the drum turns.
    front: [[-3, -3, 6, 6], (g, k) => skull(g, 0, 0, k.seed + 7)],
    barrel: [
      [-7.5, -7, 18, 14],
      (g, k) => {
        const black: HSL = { h: 220, s: 10, l: 20 };
        const drum = poly(-3.4, -4.6, 6.2, -4.6, 6.2, 4.6, -3.4, 4.6, -5.4, 3.6, -6.2, 0, -5.4, -3.6);
        part(g, drum, black, k.seed, { depth: 1, thin: 0.55, thick: 1.5, shade: -8 });
        g.save();
        path(g, drum);
        g.clip();
        g.fillStyle = css(black, 26);
        line(g, -4, -3.2, 5.6, -3.4, { w: 0.9, seed: k.seed + 1, taper: [0.2, 0.3], press: 0.1 });
        g.restore();
        // The muzzle: a fat lit rim and a dark mouth.
        const rim = boxPts(5.4, -5.6, 2.8, 11.2, 1.2, k.seed + 2);
        part(g, rim, { ...black, l: 30 }, k.seed + 2, { depth: 0.5, thin: 0.5, thick: 1.3, shade: -10 });
        g.fillStyle = INK;
        path(g, ovalPts(8, 0, 0.9, 3.8, k.seed + 3, 0.02, 14));
        g.fill();
        // Bolts down the back, where the barrel meets its breech.
        for (const y of [-2.6, 0, 2.6]) dot(g, -3.4, y, 0.55, k.seed + y, css(black, 40));
      },
    ],
    recoil: 0.5,
    aimed(s, l) {
      if (!l.ready) return;
      s.save();
      s.beginPath();
      s.rect(7.6, -6, 6, 12);
      s.clip();
      s.translate(2.2 + (l.reload - 0.4) * 2, 0);
      stamp(s, roundSprite('seeker')!);
      s.restore();
    },
  },
  // Return Policy: a launcher in a backwards cap.
  glaive: {
    // A round little body on two stubby feet; the cap sits on its crown.
    house: [[-9.5, -9.5, 19, 19], (g, k) => bean(g, { ...k.hue, l: 44 }, k.seed)],
    faced: true,
    mount: [
      [-11, -9, 22, 17],
      (g, k) => {
        const d = k.dir;
        const cap: P[] = [];
        for (let i = 0; i <= 10; i++) {
          const a = Math.PI + (i / 10) * Math.PI;
          cap.push({ x: Math.cos(a) * 5.6, y: -4 + Math.sin(a) * 3.8 });
        }
        const brim = poly(-d * 4.4, -4.6, -d * 10.2, -4.6, -d * 10.4, -3.5, -d * 4.4, -3.2);
        part(g, brim, { ...k.hue, l: 36 }, k.seed, { depth: 0.3, thin: 0.35, thick: 0.8 });
        part(g, cap, k.hue, k.seed + 1, { depth: 0.9, thin: 0.45, thick: 1.2 });
        tick(g, 0, -7.7, d * 1.2, -4.2, 0.4, 2, css(k.hue, -18));
        dot(g, 0, -7.8, 0.55, 3);
        // The snapback strap faces front, as it would.
        g.fillStyle = INK;
        path(g, poly(d * 2.6, -4.1, d * 4.4, -4.1, d * 4, -5.6, d * 2.9, -5.6));
        g.fill();
      },
    ],
    // Half-lidded eyes and a flat mouth, over the throwing arm: unbothered.
    front: [
      [-5, -3, 10, 8],
      (g, k) => {
        const d = k.dir;
        for (const sg of [-1, 1]) {
          g.fillStyle = INK;
          blob(g, sg * 2.5, -0.3, 1.95, k.seed + sg + 4, 0.92, 0.05);
          g.fill();
          g.fillStyle = '#fbf8f0';
          blob(g, sg * 2.5, -0.3, 1.5, k.seed + sg, 0.9, 0.05);
          g.fill();
          g.fillStyle = css(k.wood, 4);
          g.fillRect(sg * 2.5 - 1.7, -2.2, 3.4, 1.8);
          g.fillStyle = INK;
          line(g, sg * 2.5 - 1.8, -0.45, sg * 2.5 + 1.8, -0.45, { w: 0.7, seed: 5 + sg, taper: [0.1, 0.1], press: 0 });
          circle(g, sg * 2.5 + d * 0.5, 0.3, 0.6);
        }
        tick(g, -1.8, 3.6, 1.8, 3.4, 0.7, 7);
      },
    ],
    barrel: [
      [-1.5, -2.5, 11, 5],
      (g, k) => {
        part(g, boxPts(0, -1.3, 8, 2.6, 1, k.seed + 8), { ...k.wood, l: 50 }, k.seed + 8, { depth: 0.4, thin: 0.35, thick: 0.85 });
        dot(g, 0.8, 0, 0.7, k.seed + 9, css(k.pal.light));
      },
    ],
    aimed(s, l) {
      if (!l.ready) return;
      s.save();
      s.translate(8.4, -0.4);
      s.rotate(l.rc.t * 2);
      s.scale(0.85, 0.85);
      stamp(s, sprite('ammo|rang', -6.5, -4, 13, 8.5, rang));
      s.restore();
    },
  },
  // Dodgeball Coach: a gumball machine with a whistle on a lanyard.
  gumball: {
    // The machine's cast stand: a waist under the globe, flaring to a foot.
    house: [[-9.5, -1, 19, 10], (g, k) => stand(g, { h: k.st.hue, s: 70, l: 46 }, k.seed)],
    mount: [
      [-3, 0, 6, 6],
      (g, k) => {
        ball(g, 0, 2.9, 1.7, STEEL, k.seed + 1);
        tick(g, -0.9, 2.9, 0.9, 2.9, 0.45, 2);
      },
    ],
    barrel: [
      [2.5, -2.5, 8, 5],
      (g, k) => part(g, boxPts(3.6, -1.8, 5.4, 3.6, 0.6, k.seed + 3), k.pal.dark, k.seed + 3, { depth: 0.4, thin: 0.35, thick: 0.8 }),
    ],
    front: [
      [-7, -10, 15, 17],
      (g, k) => {
        const globe = ovalPts(0, -3.4, 5.3, 5.1, k.seed + 4, 0.02);
        tone(g, globe, { h: 200, s: 25, l: 88 }, { depth: 0.7, shade: -10 });
        g.save();
        path(g, globe);
        g.clip();
        const cols = [3, 3, 45, 3, 200, 3, 120];
        for (let i = 0; i < 7; i++) {
          const bx = -3.3 + (i % 4) * 2.2 + (Math.floor(i / 4) % 2) * 1.1;
          const by = 0.2 - Math.floor(i / 4) * 2.2;
          ball(g, bx, by, 1.15, { h: cols[i], s: 72, l: 52 }, i + 20);
        }
        g.restore();
        glint(g, poly(-3.8, -4.2, -3, -6.4, -1.2, -7.6), 'rgba(255,255,255,0.95)', 0.8);
        pen(g, globe, k.seed + 5, 0.45, 1.1);
        part(g, boxPts(-2, -9.4, 4, 1.6, 0.5, k.seed + 6), { h: k.st.hue, s: 70, l: 46 }, k.seed + 6, { depth: 0.3, thin: 0.35, thick: 0.7 });
        // Lanyard round the neck, whistle hanging off it.
        const cord = poly(-4.6, 0.6, -1, 1.6, 2.6, 1.4, 4.4, 3, 4.8, 4.4);
        g.fillStyle = INK;
        stroke(g, cord, { w: 1.1, seed: 7, taper: [0, 0], press: 0 });
        g.fillStyle = '#2f7de0';
        stroke(g, cord, { w: 0.55, seed: 7, taper: [0, 0], press: 0 });
        part(g, boxPts(3.4, 4.2, 3.6, 2.1, 0.9, k.seed + 8), { h: 210, s: 8, l: 82 }, k.seed + 8, { depth: 0.3, thin: 0.3, thick: 0.7 });
        dot(g, 6.4, 5.2, 0.45, 9);
      },
    ],
    aimed(s, l) {
      if (l.ready) loaded(s, l, 9.6, 0.6);
    },
  },
  // Banana Mortar: a stubby green pipe on a bipod and a baseplate; the shell is a bunch.
  mortar: {
    house: [
      [-9.5, -1, 19, 10],
      (g, k) => {
        baseplate(g, k.pal, k.seed);
        legs(g, 0, 1, [-5.4, 5.4, 5, 5.4], iron(k.pal, 46), k.seed + 2);
      },
    ],
    barrel: [
      [-5, -6.5, 16, 13],
      (g, k) => {
        const green: HSL = { h: 128, s: 58, l: 40 };
        const tube = boxPts(-3.6, -3.7, 10.4, 7.4, 1.4, k.seed + 1);
        part(g, tube, green, k.seed + 1, { depth: 0.9, thin: 0.5, thick: 1.3, shade: -16 });
        g.save();
        path(g, tube);
        g.clip();
        g.fillStyle = css(green, 24);
        line(g, -3, -2.2, 6.4, -2.2, { w: 1, seed: k.seed + 2, taper: [0.1, 0.3], press: 0.1 });
        g.restore();
        // The pipe's lip: wider than the tube, lit, its mouth dark.
        const lip = boxPts(5.8, -5.2, 3.6, 10.4, 1.2, k.seed + 3);
        part(g, lip, { ...green, l: 46 }, k.seed + 3, { depth: 0.6, thin: 0.5, thick: 1.3, shade: -16 });
        g.fillStyle = css(green, 28);
        line(g, 6.6, -4.4, 6.6, 3, { w: 0.8, seed: k.seed + 4, taper: [0.2, 0.3], press: 0.1 });
        g.fillStyle = INK;
        path(g, ovalPts(9.4, 0, 0.8, 4, k.seed + 5, 0.02, 14));
        g.fill();
        dot(g, 0, 0, 1.2, k.seed + 6, css(k.pal.spec, -10));
      },
    ],
    recoil: 0.5,
    aimed(s, l) {
      if (l.ready) loaded(s, l, 10.6, 0.65, -0.4);
    },
  },
  // Sneeze Cannon: a goo tank on a little cart, a big nose on the muzzle.
  gooper: {
    house: [
      [-9.5, 2, 19, 7],
      (g, k) => {
        g.fillStyle = INK;
        line(g, -5, 6, 4, 6, { w: 1.6, seed: k.seed, taper: [0, 0], press: 0 });
        for (const x of [-5, 3.6]) wheel(g, x, 6.1, 1.9, k.pal, k.seed + x);
      },
    ],
    barrel: [
      [2, -4.5, 13.5, 10],
      (g, k) => {
        part(g, boxPts(2.6, -1.8, 5, 3.6, 0.6, k.seed), k.pal.base, k.seed, { depth: 0.4, thin: 0.35, thick: 0.85 });
        g.translate(-1.6, 0);
        const nose = poly(8, -2.4, 9.6, -3.2, 11.2, -1.6, 12.6, 1.2, 13, 2.8, 11.6, 3.6, 9.6, 3.2, 8.2, 2.4);
        part(g, nose, { h: 10, s: 55, l: 68 }, k.seed + 1, { depth: 0.8, thin: 0.45, thick: 1.1 });
        g.fillStyle = INK;
        blob(g, 11.2, 2.8, 0.85, 4, 0.55, 0.1);
        g.fill();
        tick(g, 9.4, 1.2, 9.6, 2.9, 0.5, 5, css({ h: 10, s: 55, l: 40 }));
        glint(g, poly(9.2, -1.8, 10.8, -1.2, 11.8, 0.6), 'rgba(255,240,235,0.95)', 0.6);
        g.translate(1.6, 0);
      },
    ],
    front: [
      [-8.5, -8, 16, 16],
      (g, k) => {
        const tank = ovalPts(-1, 0, 6, 6, k.seed + 2, 0.02);
        tone(g, tank, { h: 98, s: 58, l: 46 }, { depth: 1 });
        g.save();
        path(g, tank);
        g.clip();
        g.fillStyle = css({ h: 98, s: 58, l: 64 });
        for (const [x, y, r] of [
          [-3, 2.4, 0.9],
          [0.6, 3.4, 0.6],
          [1.6, 0.4, 0.5],
        ])
          circle(g, x, y, r);
        g.restore();
        glint(g, poly(-5, -1.6, -4.2, -3.6, -2.4, -5), 'rgba(240,255,220,0.9)', 0.8);
        pen(g, tank, k.seed + 3, 0.5, 1.3);
        part(g, boxPts(-7.4, -1, 12.8, 2.1, 0.6, k.seed + 4), k.pal.base, k.seed + 4, { depth: 0.4, thin: 0.35, thick: 0.85 });
      },
    ],
    aimed(s, l) {
      if (!l.ready) return;
      // A drip waiting at the nostril.
      const k = l.reload - 0.4;
      s.fillStyle = css({ h: 98, s: 62, l: 50 });
      blob(s, 9.6, 3.6 + k * 1.6, 0.6 + k * 0.5, 3, 1.3, 0.1);
      s.fill();
    },
  },
  // Slushie Gun: a cup, with the straw for a barrel.
  cryo: {
    mount: [
      [-7.5, -9, 15, 17.5],
      (g, k) => {
        const cup = poly(-5.4, -2.6, 5.4, -2.6, 4, 7.5, -4, 7.5);
        tone(g, cup, { h: 40, s: 25, l: 92 }, { depth: 0.9, shade: -14 });
        g.save();
        path(g, cup);
        g.clip();
        g.fillStyle = css({ h: (k.st.hue + 200) % 360, s: 75, l: 52 });
        for (let x = -8; x < 8; x += 3.2) {
          path(g, poly(x, 8, x + 1.4, 8, x + 4.8, -3, x + 3.4, -3));
          g.fill();
        }
        g.restore();
        pen(g, cup, k.seed, 0.5, 1.2);
        const lid: P[] = [];
        for (let i = 0; i <= 10; i++) {
          const a = Math.PI + (i / 10) * Math.PI;
          lid.push({ x: Math.cos(a) * 5.6, y: -2.8 + Math.sin(a) * 4.8 });
        }
        part(g, lid, { h: 192, s: 75, l: 72 }, k.seed + 1, { depth: 0.8, thin: 0.45, thick: 1.1 });
        g.fillStyle = '#ffffff';
        for (const [x, y] of [
          [-2.6, -4.6],
          [1.2, -5.8],
          [2.8, -3.8],
          [-0.6, -3.4],
        ])
          circle(g, x, y, 0.45);
        part(g, boxPts(-6.2, -3.4, 12.4, 1.5, 0.6, k.seed + 2), { h: 200, s: 15, l: 88 }, k.seed + 2, { depth: 0.3, thin: 0.35, thick: 0.8 });
      },
    ],
    barrel: [
      [-2, -2, 15.5, 4],
      (g, k) => {
        const straw = boxPts(-1, -0.95, 12.6, 1.9, 0.9, k.seed + 3);
        g.fillStyle = '#fbf6ee';
        path(g, straw);
        g.fill();
        g.save();
        path(g, straw);
        g.clip();
        g.fillStyle = '#e23b3b';
        for (let x = -1; x < 12; x += 2.2) {
          path(g, poly(x, 1.2, x + 0.9, 1.2, x + 1.9, -1.2, x + 1, -1.2));
          g.fill();
        }
        g.restore();
        pen(g, straw, k.seed + 4, 0.35, 0.75);
        for (const x of [7.8, 8.6, 9.4]) tick(g, x, -0.9, x, 0.9, 0.3, x);
      },
    ],
    aimed(s, l) {
      if (!l.ready) return;
      s.fillStyle = css({ h: 192, s: 75, l: 72 });
      blob(s, 12, 0, 0.6 + (l.reload - 0.4) * 1.2, 2, 1, 0.12);
      s.fill();
    },
  },
  // Trick-Shot Lens: a prism on a stand. Its shots drag a replay's dotted line.
  prism: {
    // A camera tripod under it.
    mount: [
      [-9.5, 1, 19, 8.5],
      (g, k) => {
        legs(g, 0, 2.6, [-6.4, 7.9, 6.4, 7.9, 0.8, 8.1], { h: k.st.hue, s: 12, l: 40 }, k.seed);
        hub(g, 0, 2.8, 1.6, k.pal, k.seed + 3);
      },
    ],
    barrel: [
      [-6.5, -7.5, 15, 15],
      (g, k) => {
        const tip = { x: 7, y: 0 };
        const a = { x: -4.6, y: -6 };
        const b = { x: -4.6, y: 6 };
        const c = { x: -1.6, y: 0 };
        const facet = (pts: P[], dl: number) => {
          g.fillStyle = css(k.glow, dl, 1, -25);
          path(g, pts);
          g.fill();
        };
        facet([tip, a, c], 24);
        facet([tip, c, b], -10);
        facet([a, c, b], 6);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        line(g, -3.4, -3.8, 3.6, -1.2, { w: 0.5, seed: 1, taper: [0.2, 0.3], press: 0 });
        tick(g, c.x, c.y, tip.x, tip.y, 0.35, 2, css(k.glow, -40, 0.6));
        tick(g, a.x, a.y, c.x, c.y, 0.35, 3, css(k.glow, -40, 0.6));
        tick(g, b.x, b.y, c.x, c.y, 0.35, 4, css(k.glow, -40, 0.6));
        pen(g, [tip, b, a], k.seed + 1, 0.5, 1.2);
      },
    ],
    over(l) {
      glowDot(l.rc.g, l.x + Math.cos(l.angle) * 2, l.y + Math.sin(l.angle) * 2, 3 + l.reload * 4, l.glow, 0.3 + l.reload * 0.4);
      light(l.rc, l.x, l.y, 35, l.glow, 0.35);
    },
  },
  // Budget Airline: a little departures shed with a windsock.
  hangar: {
    mount: [
      [-9, -11, 21, 19.5],
      (g, k) => {
        const wd = { ...k.wood, l: 44 };
        part(g, boxPts(-6.8, -2.6, 13.6, 10, 0.8, k.seed), wd, k.seed, { depth: 0.9, thin: 0.5, thick: 1.2 });
        g.fillStyle = css(k.hue, 0);
        g.fillRect(-6.6, -1.2, 13.2, 1.4);
        g.fillStyle = INK;
        path(g, boxPts(-2.8, 1.4, 5.6, 6, 0.6, k.seed + 1));
        g.fill();
        part(g, poly(-7.8, -2.2, 0, -7.6, 7.8, -2.2), { ...k.hue, l: 40 }, k.seed + 2, { depth: 0.7, thin: 0.45, thick: 1.1 });
        // Windsock on a pole: hung slack, it's a cheap one.
        tick(g, 5.4, -4, 5.4, -10.2, 0.6, 3);
        const sock = poly(5.4, -10.4, 5.4, -8.2, 8.6, -6.6, 9.4, -7.6);
        part(g, sock, { h: 22, s: 90, l: 56 }, k.seed + 4, { depth: 0.2, thin: 0.3, thick: 0.6 });
        g.fillStyle = '#fbf6ee';
        path(g, poly(6.6, -9.8, 7.4, -9.3, 7.2, -7.6, 6.4, -8));
        g.fill();
      },
    ],
    over(l) {
      if (!l.ready) return;
      const s = l.rc.s;
      s.save();
      s.translate(l.x, l.y - 9.4);
      s.scale(0.36, 0.36);
      drawGlider(s, 0, 0, 0, l.st.hue, l.rc.t, false, 0, Math.cos(l.angle) < 0 ? -1 : 1, 7);
      s.restore();
    },
  },
};

function bk(d: DrawCtx, dir: 1 | -1): Bk {
  const st = d.style;
  return {
    pal: d.pal,
    st,
    wood: { h: st.woodHue, s: 45, l: 40 },
    hue: { h: st.hue, s: 70, l: 48 },
    glow: { h: st.glowHue, s: 95, l: 60 },
    dir,
    seed: ((st.hue * 7 + st.woodHue) | 0) % 997,
  };
}

function piece(name: string, m: Launcher, k: Bk, faced: boolean, [box, draw]: readonly [Box, (g: CanvasRenderingContext2D, k: Bk) => void]) {
  const st = k.st;
  const key = `L|${m.style}|${name}|${st.metal}|${st.hue | 0}|${st.woodHue | 0}|${st.glowHue | 0}|${faced ? k.dir : 0}`;
  return sprite(key, box[0], box[1], box[2], box[3], (g) => draw(g, k));
}

function drawLauncher(rc: RC, m: Launcher, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const o = d.o;
  const r = d.r;
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const angle = m.aim === 'track' ? (o.state?.aim.get(d.mi) ?? m.angle) : launcherAngle(m, rc.frame, r.phase);
  const since = o.state ? rc.frame - o.state.lastFire : 999;
  const reload = Math.min(1, since / Math.max(1, m.interval * 0.6));
  const look = LOOKS[m.style];
  const dir: 1 | -1 = Math.cos(m.angle) < 0 ? -1 : 1;
  const k = bk(d, dir);
  const flip = Math.cos(angle) < 0 ? -1 : 1;
  const live: Live = { rc, m, x, y, angle, reload, ready: reload > 0.4, pal: d.pal, st: d.style, glow: k.glow, flip };

  const sight = o.state && beamOf(o, r, d.mi);
  if (sight) {
    // Targeting laser sight.
    const a = sight.angle ?? angle;
    g.fillStyle = 'rgba(255,40,40,0.35)';
    line(g, x + Math.cos(a) * 8, y + Math.sin(a) * 8, x + Math.cos(a) * sight.len, y + Math.sin(a) * sight.len, { w: 0.7, seed: 1, taper: [0, 0], press: 0 });
    glowDot(g, x + Math.cos(a) * sight.len, y + Math.sin(a) * sight.len, 4, { h: 0, s: 100, l: 55 }, 0.8);
  }

  if (look.house) stamp(s, piece('h', m, k, false, look.house), x, y);
  if (look.mount) stamp(s, piece('m', m, k, !!look.faced, look.mount), x, y);
  if (look.barrel || look.aimed) {
    const recoil = since < 8 ? (8 - since) * (look.recoil ?? 0.3) : 0;
    s.save();
    s.translate(x, y);
    s.rotate(angle);
    if (flip < 0) s.scale(1, -1);
    s.translate(-recoil, 0);
    if (look.barrel) stamp(s, piece('b', m, k, false, look.barrel));
    look.aimed?.(s, live);
    s.restore();
  }
  if (look.front) stamp(s, piece('f', m, k, !!look.faced, look.front), x, y);
  look.over?.(live);
  if (m.aim === 'track') drawTrackerEye(rc, x, y, angle);
  if (since < 5) {
    const mx = x + Math.cos(angle) * 13;
    const my = y + Math.sin(angle) * 13;
    const fc: HSL = m.style === 'totem' ? { h: 6, s: 100, l: 58 } : m.style === 'turret' ? k.glow : { h: 40, s: 100, l: 65 };
    glowDot(g, mx, my, 14 - since * 2, fc, 0.9);
    light(rc, mx, my, 80, fc, 1 - since / 5);
  }
}

/**
 * Tracking sensor: a swivelling red eye on a stalk above the mount that looks where the launcher aims.
 * Every tracker has one, so tracking reads at a glance whatever the style.
 */
function drawTrackerEye(rc: RC, x: number, y: number, angle: number): void {
  const s = rc.s;
  const ex = x - 4;
  const ey = y - 8.4;
  stamp(
    s,
    sprite('L|eye', -5, -5, 10, 11, (g) => {
      tick(g, 0, 2.4, 0.4, 5.6, 1.6, 1);
      g.fillStyle = INK;
      blob(g, 0.15, 0.2, 3.95, 2, 1, 0.03);
      g.fill();
      g.fillStyle = '#f4efe2';
      blob(g, 0, 0, 3.2, 3, 1, 0.03);
      g.fill();
      g.fillStyle = '#d9d0bd';
      path(g, poly(-2.2, 2.2, 2.6, 1.6, 3, -0.4, 1.8, 2.6, -0.6, 3.1));
      g.fill();
    }),
    ex,
    ey,
  );
  const px = ex + Math.cos(angle) * 1.4;
  const py = ey + Math.sin(angle) * 1.4;
  const red: HSL = { h: 0, s: 100, l: 55 };
  s.fillStyle = '#d0141f';
  circle(s, px, py, 1.75);
  s.fillStyle = INK;
  circle(s, px, py, 0.85);
  s.fillStyle = '#fff';
  s.fillRect(px - 1, py - 1.1, 0.6, 0.6);
  glowDot(rc.g, px, py, 5, red, 0.55 + Math.sin(rc.t * 6) * 0.15);
}

defineArt<'launcher'>({ type: 'launcher', layer: 2, draw: drawLauncher });
