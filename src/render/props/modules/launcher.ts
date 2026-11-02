import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { footprintCells, launcherAngle, type LauncherStyle, type ModuleOf, type PropStyle, type Resolved } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, type Sprite, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, glowDot, light, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, type DrawCtx } from '../common';
import { iron } from '../machine';
import { rang, roundSprite, stampRound } from '../projectiles';
import { FRAMED } from './launcher-framed';
import { baseplate, hub, legs, pedestal, roundel, trapBox, wheel } from './launcher-house';

/**
 * Launchers, inked: each style is a parody of a genre staple (docs/PARODY.md, Launchers). A style is three
 * baked pieces: the `mount` (still, round the block's center), the `barrel` (drawn along +x and turned to
 * the aim, mirrored when it aims left so its lit side stays up), and a `front` that sits over the barrel's
 * root. Only the loaded round, the glow and the tracker's sensor are drawn live. Every look is a machine
 * or a carving, never a character: no faces, feet or hats (docs/ART.md, Objects, not characters).
 */

type Launcher = ModuleOf<'launcher'>;
type Box = readonly [number, number, number, number];

export interface Bk {
  pal: MetalPalette;
  st: PropStyle;
  wood: HSL;
  hue: HSL;
  glow: HSL;
  /** Which way it faces, for mounts that care. */
  dir: 1 | -1;
  seed: number;
}

export interface Live {
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
  /** A point of the look's own frame (px round its middle, or round the pivot for a one-tile look) in world px. */
  p(x: number, y: number): P;
}

export interface Look {
  /**
   * A look that takes more than one tile (sim/props/launcher-frames.ts): its pieces are drawn round the
   * middle of its cells, facing right as at rot 0, and turned with the part. `pivot` is where the barrel
   * turns and shots leave from, and `cam` where a tracker's sensor stands, both in those px.
   */
  frame?: { pivot: readonly [number, number]; cam?: readonly [number, number] };
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

/** A loaded round sitting in the barrel frame at (x, 0). */
function loaded(s: CanvasRenderingContext2D, l: Live, x: number, k = 1, spin = 0) {
  const sp = roundSprite(l.m.ammo);
  if (sp) stampRound(s, sp, x, 0, spin, false, k);
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
  // Sorry Turret: a dented dome with a sensor visor, and a sticky note slapped on it.
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
        const shell: HSL = { h: k.st.hue, s: 22, l: 78 };
        const dome = ovalPts(0, -0.6, 6.2, 5.8, k.seed + 4, 0.02);
        part(g, dome, shell, k.seed + 4, { depth: 1.1, thin: 0.5, thick: 1.3 });
        g.save();
        path(g, dome);
        g.clip();
        // A seam round the dome, and a dent.
        g.fillStyle = css(shell, -24, 1, 6);
        line(g, -6.4, 1.6, 6.4, 1.4, { w: 0.55, seed: k.seed + 5, taper: [0.05, 0.05], press: 0.2 });
        tick(g, -4.2, -3.2, -3, -2.2, 0.5, k.seed + 6, css(shell, -20, 1, 6));
        g.restore();
        // The sensor: one dark visor slot across the dome, a hard glint along its glass, and a small lens
        // at its far end that lights live. A strip of optics, not an eye.
        const visor = boxPts(-4.8, -2.9, 9.4, 2.7, 1.2, k.seed + 7, 0.1);
        part(g, visor, { h: 215, s: 25, l: 16 }, k.seed + 7, { depth: 0.3, thin: 0.4, thick: 0.9, shade: -6 });
        tick(g, -3.8, -2.3, 0.6, -2.4, 0.4, k.seed + 8, 'rgba(255,255,255,0.55)');
        g.fillStyle = css(STEEL, -6);
        path(g, ovalPts(3, -1.55, 1.05, 1.05, k.seed + 9, 0.02, 12));
        g.fill();
        // A sticky note, slapped on crooked, scribbled on.
        g.save();
        g.translate(-3.6, 2.6);
        g.rotate(-0.3);
        part(g, boxPts(-1.6, -1.5, 3.2, 3, 0.3, k.seed + 10, 0.1), { h: 52, s: 90, l: 70 }, k.seed + 10, { depth: 0.2, thin: 0.25, thick: 0.55 });
        for (const y of [-0.6, 0.3]) tick(g, -1, y, 1, y + 0.1, 0.25, k.seed + y, 'rgba(18,11,8,0.6)');
        g.restore();
      },
    ],
    recoil: 0.4,
    over(l) {
      // The lens lights as it reloads.
      const lx = l.x + 3;
      const ly = l.y - 1.55;
      l.rc.s.fillStyle = css(l.glow, 0, 0.35 + l.reload * 0.6);
      circle(l.rc.s, lx, ly, 0.65);
      glowDot(l.rc.g, lx, ly, 2.5 + l.reload * 2, l.glow, 0.3 + l.reload * 0.5);
    },
  },
  // Grudge Launcher: a bullet blaster. A black drum turns on a pedestal with a crosshair roundel on its
  // pivot and a chalk tally of hits on its side; the grudge missile's nose peeks out of its muzzle when
  // it's loaded.
  rocket: {
    mount: [[-8.5, 0, 17, 9], (g, k) => pedestal(g, k.seed)],
    // The roundel sits on the drum's pivot, so it stays upright whichever way the drum turns.
    front: [[-3, -3, 6, 6], (g, k) => roundel(g, 0, 0, k.seed + 7)],
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
        // A chalk tally of hits: four strokes and the one across them.
        for (const x of [2.9, 3.5, 4.1, 4.7]) tick(g, x, -2.6, x - 0.1, -0.5, 0.3, x * 7, 'rgba(240,236,226,0.85)');
        tick(g, 2.5, -0.9, 5.1, -2.3, 0.3, 9, 'rgba(240,236,226,0.85)');
        g.restore();
        // The muzzle: a fat lit rim and a dark bore.
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
  // Return Policy: a clay-pigeon trap. A sprung throwing arm on a squat box, a receipt curling out of its side.
  glaive: {
    house: [[-9.5, -1, 19, 10], (g, k) => trapBox(g, { ...k.hue, l: 44 }, k.pal, k.seed)],
    barrel: [
      [-2.5, -3, 12.5, 6],
      (g, k) => {
        // The arm: a steel bar with a clip at its end that holds the boomerang.
        part(g, boxPts(-1, -1, 8.4, 2, 0.8, k.seed + 8), k.pal.base, k.seed + 8, { depth: 0.4, thin: 0.35, thick: 0.85 });
        part(g, poly(6.6, -2.2, 8.6, -2.2, 8.6, 2.2, 6.6, 2.2, 7.4, 0), iron(k.pal, 40), k.seed + 9, { depth: 0.3, thin: 0.3, thick: 0.7 });
      },
    ],
    // The mainspring the arm whips round on, in its drum over the arm's root.
    front: [
      [-3.5, -3.5, 7, 7],
      (g, k) => {
        ball(g, 0, 0, 2.6, iron(k.pal, 46), k.seed + 10);
        const coil: P[] = [];
        for (let i = 0; i <= 16; i++) {
          const a = (i / 16) * Math.PI * 3.2;
          const r = 0.4 + (i / 16) * 1.6;
          coil.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }
        g.fillStyle = INK;
        stroke(g, coil, { w: 0.35, seed: k.seed + 11, taper: [0.1, 0.1], press: 0 });
      },
    ],
    recoil: 0.3,
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
  // Sneeze Cannon: a goo tank on a little cart, the muzzle poking out of a tissue box.
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
      [2, -8, 13.5, 13],
      (g, k) => {
        part(g, boxPts(2.6, -1.8, 5, 3.6, 0.6, k.seed), k.pal.base, k.seed, { depth: 0.4, thin: 0.35, thick: 0.85 });
        // The tissue box, the muzzle through it, and one tissue standing up out of its slot.
        const tissue = poly(8.4, -2.8, 7.8, -4.6, 8.8, -5.6, 9.4, -7.2, 10.6, -6, 11.4, -6.8, 11.6, -4.8, 10.8, -2.8);
        part(g, tissue, { h: 200, s: 20, l: 96 }, k.seed + 2, { depth: 0.3, thin: 0.3, thick: 0.65, shade: -10 });
        const box = boxPts(6.6, -3.2, 5.8, 6.4, 0.6, k.seed + 1, 0.12);
        part(g, box, { h: 330, s: 45, l: 74 }, k.seed + 1, { depth: 0.6, thin: 0.4, thick: 1 });
        g.save();
        path(g, box);
        g.clip();
        g.fillStyle = css({ h: 200, s: 50, l: 62 });
        for (const [x, y] of [
          [7.8, 1.6],
          [10.4, -1.4],
          [11.6, 2.2],
        ])
          circle(g, x, y, 0.75);
        g.restore();
        tick(g, 8.4, -3.1, 10.8, -3.1, 0.5, k.seed + 3);
        part(g, boxPts(12, -1.5, 1.6, 3, 0.4, k.seed + 4), k.pal.base, k.seed + 4, { depth: 0.3, thin: 0.3, thick: 0.7 });
        g.fillStyle = INK;
        path(g, ovalPts(13.5, 0, 0.5, 1.1, k.seed + 5, 0.02, 10));
        g.fill();
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
      // A drip waiting at the muzzle.
      const k = l.reload - 0.4;
      s.fillStyle = css({ h: 98, s: 62, l: 50 });
      blob(s, 13.6, 1.4 + k * 1.4, 0.55 + k * 0.5, 3, 1.3, 0.1);
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
  ...FRAMED,
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

/** A framed look's turn: a quarter turn turns it, a half turn mirrors it (it stands upright, as Xform.U does). */
function turn(rot: number, x: number, y: number): P {
  switch (rot & 3) {
    case 1:
      return { x: -y, y: x };
    case 2:
      return { x: -x, y };
    case 3:
      return { x: y, y: -x };
    default:
      return { x, y };
  }
}

/** The same turn on a canvas, so a baked piece drawn facing right lands the way the part faces. */
function turnCanvas(s: CanvasRenderingContext2D, rot: number) {
  if ((rot & 3) === 1) s.rotate(Math.PI / 2);
  else if ((rot & 3) === 2) s.scale(-1, 1);
  else if ((rot & 3) === 3) s.rotate(-Math.PI / 2);
}

/** The middle of a part's cells (world px, before motion). */
function middleOf(r: Resolved): Vec {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of footprintCells(r.pp)) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  return [((x0 + x1) / 2) * TILE, ((y0 + y1) / 2) * TILE];
}

/**
 * Where the art turns a launcher's barrel and draws its muzzle from (world px, before motion): a framed
 * look's pivot, turned with the part round the middle of its cells, or the launcher's own point. The sim
 * fires from `at`, and the two have to agree (tests/launcher-frames.test.ts).
 */
export function launcherPivot(r: Resolved, m: Launcher): Vec {
  const fr = LOOKS[m.style].frame;
  if (!fr) return m.at;
  const [cx, cy] = middleOf(r);
  const q = turn(r.pp.rot, fr.pivot[0], fr.pivot[1]);
  return [cx + q.x, cy + q.y];
}

function drawLauncher(rc: RC, m: Launcher, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const o = d.o;
  const r = d.r;
  const look = LOOKS[m.style];
  const fr = look.frame;
  const rot = r.pp.rot & 3;
  const [px, py] = launcherPivot(r, m);
  const x = px + d.off[0];
  const y = py + d.off[1];
  const mid = fr ? middleOf(r) : null;
  const cx = mid ? mid[0] + d.off[0] : x;
  const cy = mid ? mid[1] + d.off[1] : y;
  const at = (lx: number, ly: number): P => {
    if (!fr) return { x: x + lx, y: y + ly };
    const q = turn(rot, lx, ly);
    return { x: cx + q.x, y: cy + q.y };
  };
  /** A body piece: round the pivot for a one-tile look, round the middle of its cells and turned with the part for a framed one. */
  const body = (sp: Sprite) => {
    if (!fr) return stamp(s, sp, x, y);
    s.save();
    s.translate(cx, cy);
    turnCanvas(s, rot);
    stamp(s, sp);
    s.restore();
  };
  const angle = m.aim === 'track' ? (o.state?.aim.get(d.mi) ?? m.angle) : launcherAngle(m, rc.frame, r.phase);
  const since = o.state ? rc.frame - o.state.lastFire : 999;
  const reload = Math.min(1, since / Math.max(1, m.interval * 0.6));
  const dir: 1 | -1 = Math.cos(m.angle) < 0 ? -1 : 1;
  const k = bk(d, dir);
  const flip = Math.cos(angle) < 0 ? -1 : 1;
  const live: Live = { rc, m, x, y, angle, reload, ready: reload > 0.4, pal: d.pal, st: d.style, glow: k.glow, flip, p: at };

  const sight = o.state && beamOf(o, r, d.mi);
  if (sight) {
    // Targeting laser sight.
    const a = sight.angle ?? angle;
    g.fillStyle = 'rgba(255,40,40,0.35)';
    line(g, x + Math.cos(a) * 8, y + Math.sin(a) * 8, x + Math.cos(a) * sight.len, y + Math.sin(a) * sight.len, { w: 0.7, seed: 1, taper: [0, 0], press: 0 });
    glowDot(g, x + Math.cos(a) * sight.len, y + Math.sin(a) * sight.len, 4, { h: 0, s: 100, l: 55 }, 0.8);
  }

  if (look.house) body(piece('h', m, k, false, look.house));
  if (look.mount) body(piece('m', m, k, !!look.faced, look.mount));
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
  if (look.front) body(piece('f', m, k, !!look.faced, look.front));
  look.over?.(live);
  if (m.aim === 'track') {
    const cam = fr?.cam ? at(fr.cam[0], fr.cam[1]) : { x: x - 4, y: y - 8.4 };
    drawTrackerCam(rc, cam.x, cam.y, angle);
  }
  if (since < 5) {
    const mx = x + Math.cos(angle) * 13;
    const my = y + Math.sin(angle) * 13;
    const fc: HSL = m.style === 'totem' ? { h: 6, s: 100, l: 58 } : m.style === 'turret' ? k.glow : { h: 40, s: 100, l: 65 };
    glowDot(g, mx, my, 14 - since * 2, fc, 0.9);
    light(rc, mx, my, 80, fc, 1 - since / 5);
  }
}

/**
 * Tracking sensor: a little security camera on a stalk above the mount (at cx, cy), turned live to where the launcher
 * aims, its red lens lit. Every tracker has one, so tracking reads at a glance whatever the style.
 */
function drawTrackerCam(rc: RC, cx: number, cy: number, angle: number): void {
  const s = rc.s;
  stamp(
    s,
    sprite('L|stalk', -2, -2, 4, 9, (g) => {
      tick(g, 0, 0.8, 0.4, 5.6, 1.6, 1);
      ball(g, 0, 0.4, 1.2, { h: 220, s: 8, l: 34 }, 2);
    }),
    cx,
    cy,
  );
  s.save();
  s.translate(cx, cy);
  s.rotate(angle);
  if (Math.cos(angle) < 0) s.scale(1, -1);
  stamp(
    s,
    sprite('L|cam', -3.8, -3, 8.6, 6, (g) => {
      part(g, boxPts(-3, -2, 5.6, 3.8, 0.8, 3), { h: 220, s: 8, l: 34 }, 3, { depth: 0.5, thin: 0.4, thick: 0.9 });
      part(g, boxPts(2.2, -1.5, 1.8, 2.9, 0.4, 4), { h: 220, s: 8, l: 22 }, 4, { depth: 0.3, thin: 0.35, thick: 0.7 });
      g.fillStyle = 'rgba(255,255,255,0.45)';
      line(g, -2.4, -1.3, 1.4, -1.4, { w: 0.45, seed: 5, taper: [0.2, 0.3], press: 0 });
    }),
  );
  s.restore();
  const lx = cx + Math.cos(angle) * 4.1;
  const ly = cy + Math.sin(angle) * 4.1;
  const red: HSL = { h: 0, s: 100, l: 55 };
  s.fillStyle = '#d0141f';
  circle(s, lx, ly, 0.85);
  s.fillStyle = '#ffb0a8';
  s.fillRect(lx - 0.5, ly - 0.55, 0.4, 0.4);
  glowDot(rc.g, lx, ly, 4.5, red, 0.55 + Math.sin(rc.t * 6) * 0.15);
}

defineArt<'launcher'>({ type: 'launcher', layer: 2, draw: drawLauncher });
