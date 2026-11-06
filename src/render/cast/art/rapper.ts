import { type D, type KindArt, band, poly, tonedOval, Y } from '../kit';
import { pair } from '../faces';
import { line } from '../../ink';

/**
 * The rapping paper puppy (docs/characters/rapper.md): a dog's head side on, a long snout jutting far forward with a
 * big round nose on its tip and the jaw dropped open under it, a short floppy ear hanging down behind the head, a tall
 * thumb of a knit beanie standing straight up off it, a skinny body in a tee and shorts on big trainers, and a
 * cordless mic held out in front of him. The beanie and the tee are the player's colour, the shorts a dark of it; the
 * fur, the nose, the trainers, the mic and the card's edge down his back are neutrals. A rendered kind draws from its
 * frames (src/render/cast/sprites/rapper/); this is what shows before they load, and on the hand-drawn sheets.
 */

const FUR = '#f1dfb8';
const FUR_SH = '#dcc08e';
const CARD = '#b8946a';
const NOSE = '#4a3428';
const MOUTH = '#2a1f1a';
const MIC = '#5a5e66';
const SHOE: [string, string] = ['#9aa0a8', '#767c85'];

/** The ear: a short floppy flap of fur hanging straight down behind his head, under the beanie's band. */
function ear(d: D) {
  tonedOval(d.s, -d.f * d.W * 0.3 + d.wob * 0.2, Y(d, 0.5), 1.3, 2.6, 12, FUR, FUR_SH, d.lk.ink, 0.35, 0.7 * d.k, 0.4);
}

export const art: KindArt = {
  size: [0.92, 1.08],
  // The beanie is the top quarter, a thumb standing straight up; under its band a big head, and the snout runs far
  // out front with the open jaw under it; the tee is a narrow body below.
  outline:
    'M -0.02 -1 C 0.12 -1 0.18 -0.9 0.18 -0.74 L 0.22 -0.72 L 0.22 -0.66 C 0.26 -0.65 0.3 -0.63 0.32 -0.61 L 0.58 -0.61 C 0.64 -0.6 0.64 -0.51 0.58 -0.5 L 0.32 -0.5 L 0.34 -0.45 C 0.3 -0.4 0.2 -0.39 0.14 -0.41 C 0.22 -0.36 0.22 -0.24 0.18 -0.2 C 0.2 -0.12 0.2 -0.04 0.16 0 L -0.16 0 C -0.2 -0.1 -0.2 -0.3 -0.16 -0.4 L -0.12 -0.44 C -0.24 -0.47 -0.28 -0.56 -0.26 -0.66 L -0.26 -0.72 L -0.22 -0.74 C -0.22 -0.9 -0.16 -1 -0.02 -1 Z',
  lift: 2.6,
  feet: 'boot',
  boots: SHOE,
  arms: 'mitten',
  hands: 'glove',
  fill: 'player',
  faceX: 0.2,
  // The bouncy strut on the beat: a springy bob on each step, the head nodding with it.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.9, rot: Math.sin(g.ph * 2) * 0.04, pivot: 0.2, upright: 0.6 } : {}),
  paintFace: (d) => pair(d, 0.6, 0.07, 0.55),
  print: (d) => {
    // The fur head and snout between the beanie's band and the tee's collar, the shorts a dark of the tee, the
    // beanie's band a shade of it, the open mouth under the snout, and the card's edge down his back.
    band(d, 0.38, 0.67, FUR);
    band(d, 0.66, 0.74, d.lk.playerShade);
    band(d, -0.1, 0.11, d.lk.playerDark);
    const fx = (x: number) => d.f * d.W * x;
    poly(
      d.s,
      [
        { x: fx(0.31), y: Y(d, 0.51) },
        { x: fx(0.5), y: Y(d, 0.51) },
        { x: fx(0.33), y: Y(d, 0.45) },
      ],
      MOUTH,
    );
    const x = -d.f * d.W * 0.22;
    poly(
      d.s,
      [
        { x, y: Y(d, 0.74) },
        { x: x + d.f * d.W * 0.05, y: Y(d, 0.74) },
        { x: x + d.f * d.W * 0.05, y: Y(d, -0.1) },
        { x, y: Y(d, -0.1) },
      ],
      CARD,
    );
  },
  front: (d) => ear(d),
  snout: (d) => {
    // The big round nose on the tip of the long snout.
    tonedOval(d.s, d.f * d.W * 0.6, Y(d, 0.56), 1.3, 1.2, 9, NOSE, NOSE, d.lk.ink, 0.2, 0.5 * d.k, 0.3);
  },
  tool: (d, hx, hy) => {
    // The cordless mic held out in front of him, standing up from his fist.
    const tx = hx + d.f * 0.3;
    const ty = hy - 2.4;
    d.s.fillStyle = d.lk.ink;
    line(d.s, hx, hy + 0.8, tx, ty, { w: 1.6, seed: 3, taper: [0, 0], press: 0 });
    d.s.fillStyle = MIC;
    line(d.s, hx, hy + 0.8, tx, ty, { w: 0.8, seed: 3, taper: [0, 0], press: 0 });
    tonedOval(d.s, tx, ty - 0.6, 1.1, 1.1, 9, MIC, '#44474e', d.lk.ink, 0.3, 0.5 * d.k, 0.3);
  },
  parts: ['shard', 'shard'],
};
