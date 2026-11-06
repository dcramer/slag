import { band, type D, inked, type KindArt, oval, poly, Y } from '../kit';
import { pair } from '../faces';

/**
 * The lady of the house (docs/characters/sim.md): a chunky little woman with a round black bob, in a bell of a dress
 * in the player's colour, and over her head, with a clear gap of background under it, the green diamond, a wide
 * double point hanging a little crooked and bobbing a beat behind her. The gap is the read, so the diamond is never
 * drawn touching her. A rendered kind draws from its frames (src/render/cast/sprites/sim/); this is what shows before
 * they load, and on the hand-drawn sheets.
 */

const SKIN = '#efc4a0';
const HAIR = '#2a2430';
const GEM = '#43c24a';
const GEM_LIT = '#a2e880';
const GEM_INK = '#1f6a30';
const TAPE = '#9a9c98';

/** World px of background between the top of her bob and the diamond's lower point. */
const GAP = 2.4;

/** The diamond, over her head: lagging behind on the run, lifting on the fall, its tilt the twist. */
function diamond(d: D) {
  const f = d.f;
  const h = 6.4;
  const w = 4.8;
  let x = d.bx(1) + f * d.W * 0.02;
  let y = d.top - GAP - h / 2 + Math.sin(d.t * 2.6) * 0.35;
  if (d.m === 'run' || d.m === 'walk') x -= f * (d.m === 'run' ? 1.2 : 0.5);
  else if (d.m === 'fall') y -= 0.8;
  const tilt = -f * 0.08;
  const at = (u: number, v: number) => ({ x: x + u * Math.cos(tilt) - v * Math.sin(tilt), y: y + u * Math.sin(tilt) + v * Math.cos(tilt) });
  const [T, R, B, L, C] = [at(0, -h / 2), at(w / 2, 0), at(0, h / 2), at(-w / 2, 0), at(0, 0)];
  inked(d.s, [T, R, B, L], GEM, GEM_INK, 0.5 * d.k, 0.8 * d.k);
  // The lit facet toward the light, and the strip of tape over its crack.
  poly(d.s, [T, C, L], GEM_LIT);
  if (d.detail) poly(d.s, [at(0.2, -1.6), at(1.6, -1.1), at(1.3, -0.5), at(-0.1, -1.0)], TAPE);
}

export const art: KindArt = {
  size: [0.92, 1],
  // A bell of a dress flaring from a narrow waist, small shoulders, and a big round bob wider than them, flat at the jaw.
  outline:
    'M -0.48 0 L 0.47 0 C 0.4 -0.16 0.27 -0.36 0.19 -0.46 C 0.25 -0.5 0.26 -0.55 0.2 -0.6 L 0.34 -0.6 C 0.48 -0.68 0.47 -0.9 0.3 -0.97 C 0.15 -1.03 -0.15 -1.03 -0.3 -0.97 C -0.47 -0.9 -0.48 -0.68 -0.34 -0.6 L -0.2 -0.6 C -0.26 -0.55 -0.25 -0.5 -0.19 -0.46 C -0.27 -0.36 -0.4 -0.16 -0.48 0 Z',
  lift: 2.4,
  feet: 'boot',
  boots: ['#3a3440', '#26222c'],
  arms: 'mitten',
  fill: 'player',
  faceX: 0.1,
  // A brisk, ordinary walk with a hitch: one shoe has lost its heel.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.4 + (Math.sin(g.ph) > 0 ? 0.25 : 0), upright: 0.7 } : {}),
  paintFace: (d) => pair(d, 0.76, 0.1, 0.55, 'smile'),
  print: (d) => {
    // The bob over the head, and her face in skin under its fringe, turned toward where she faces.
    band(d, 0.6, 1.1, HAIR);
    poly(d.s, oval(d.f * d.W * 0.1, Y(d, 0.74), d.W * 0.24, d.H * 0.13, 14), SKIN);
    poly(d.s, oval(d.f * d.W * 0.02, Y(d, 0.6), d.W * 0.09, d.H * 0.03, 8), SKIN);
  },
  front: diamond,
  parts: ['shard', 'shard'],
};
