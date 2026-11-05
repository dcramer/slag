import { type D, type KindArt, band, poly, tonedOval, Y } from '../kit';
import { pair } from '../faces';
import { line } from '../../ink';

/**
 * The rapping paper puppy (docs/characters/rapper.md): a chubby cut-out puppy side on, a tall thumb of a knit beanie
 * standing straight up off his head, a long floppy ear hanging behind it, a round nose on a snout low on his face, a
 * baggy tee and shorts on big trainers, and a cordless mic held out in front of him. The beanie and the tee are the
 * player's colour, the shorts a dark of it; the fur, the nose, the trainers, the mic and the card's edge down his
 * back are neutrals. A rendered kind draws from its frames (src/render/cast/sprites/rapper/); this is what shows
 * before they load, and on the hand-drawn sheets.
 */

const FUR = '#f1dfb8';
const FUR_SH = '#dcc08e';
const CARD = '#b8946a';
const NOSE = '#4a3428';
const MIC = '#5a5e66';
const SHOE: [string, string] = ['#9aa0a8', '#767c85'];

/** The ear: a long floppy flap of fur hanging from under the beanie's band behind his head, down past the chin. */
function ear(d: D) {
  tonedOval(d.s, -d.f * d.W * 0.38 + d.wob * 0.2, Y(d, 0.42), 1.4, 3.4, 12, FUR, FUR_SH, d.lk.ink, 0.35, 0.7 * d.k, 0.4);
}

export const art: KindArt = {
  size: [0.92, 1.08],
  // The beanie is the top half, a tall thumb standing straight up, its band only a little wider than his head; the
  // snout runs out front low on his face, and his tee is a round belly under it.
  outline:
    'M 0 -1 C 0.2 -1 0.28 -0.9 0.28 -0.66 L 0.31 -0.64 L 0.31 -0.56 C 0.36 -0.54 0.4 -0.5 0.42 -0.48 C 0.5 -0.47 0.54 -0.42 0.5 -0.39 C 0.44 -0.35 0.34 -0.35 0.26 -0.37 C 0.38 -0.32 0.44 -0.22 0.4 -0.12 C 0.38 -0.06 0.34 -0.02 0.3 0 L -0.28 0 C -0.34 -0.04 -0.38 -0.14 -0.36 -0.26 C -0.34 -0.36 -0.32 -0.44 -0.3 -0.56 L -0.31 -0.56 L -0.31 -0.64 L -0.28 -0.66 C -0.28 -0.9 -0.2 -1 0 -1 Z',
  lift: 2.6,
  feet: 'boot',
  boots: SHOE,
  arms: 'mitten',
  hands: 'glove',
  fill: 'player',
  faceX: 0.2,
  // The bouncy strut on the beat: a springy bob on each step, the head nodding with it.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.9, rot: Math.sin(g.ph * 2) * 0.04, pivot: 0.2, upright: 0.6 } : {}),
  paintFace: (d) => pair(d, 0.5, 0.09, 0.62),
  print: (d) => {
    // The fur face between the beanie's band and the tee's collar, the shorts a dark of the tee, the beanie's
    // band a shade of it, and the card's edge down his back.
    band(d, 0.36, 0.57, FUR);
    band(d, 0.56, 0.64, d.lk.playerShade);
    band(d, -0.1, 0.11, d.lk.playerDark);
    const x = -d.f * d.W * 0.5;
    poly(
      d.s,
      [
        { x, y: Y(d, 1.05) },
        { x: x + d.f * d.W * 0.07, y: Y(d, 1.05) },
        { x: x + d.f * d.W * 0.07, y: Y(d, -0.1) },
        { x, y: Y(d, -0.1) },
      ],
      CARD,
    );
  },
  front: (d) => ear(d),
  snout: (d) => {
    // The round nose on the end of the snout.
    tonedOval(d.s, d.f * d.W * 0.5, Y(d, 0.42), 1.2, 1, 9, NOSE, NOSE, d.lk.ink, 0.2, 0.5 * d.k, 0.3);
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
