import { band, type D, type KindArt, oval, poly, tonedOval, Y } from '../kit';
import { pair } from '../faces';

/**
 * The limbless hero (docs/characters/limbless.md): a small round body in the player's colour under a big head
 * with a huge nose out front and a spiky tuft standing up, and nothing joining it to its white gloves and big
 * shoes, which float clear of it with background all round. The shoes are a light tone of the player's colour,
 * the far one a size bigger; the neckerchief a neutral linen. A rendered kind draws from its frames
 * (src/render/cast/sprites/limbless/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SKIN = '#f2c9a0';
const SKIN_SH = '#d9a77e';
const HAIR = '#8a5a34';
const LINEN = '#e4ddd0';
const GLOVE = '#f2efe6';
const GLOVE_SH = '#cfc6b8';

/** The gap between the body and each floating piece, world px: the read, so it is never closed. */
const GAP = 1.6;

/** A shoe floating under the body: stepping on its own on the walk, kicked out on the run, dangling in the air. */
function shoe(d: D, side: number) {
  const f = d.f;
  let x = side * d.W * 0.24;
  let y = -1.7;
  if (d.m === 'walk' || d.m === 'run') {
    const sw = Math.sin(d.ph) * side;
    x += f * sw * (d.m === 'run' ? 2.8 : 1.8);
    y -= Math.max(0, Math.cos(d.ph) * side) * (d.m === 'run' ? 1.8 : 1.1);
  } else if (d.m === 'up' || d.m === 'wall') y -= 1;
  else if (d.m === 'fall') y += 0.4;
  // The far shoe a size too big: the knock-off's joke.
  const big = side === -f ? 1.15 : 1;
  tonedOval(d.s, x + f * 0.8, y, 2.7 * big, 1.7 * big, 10, d.lk.playerHi, d.lk.player, d.lk.ink, 0.4, 0.7 * d.k, 0.5);
}

/** A glove floating beside the body, never on it: where the kit's hand would be, pushed out past the gap. */
function glove(d: D, side: number) {
  const f = d.f;
  const sh = Y(d, 0.3);
  let x = side * (d.W * 0.34 + GAP + 1.9);
  let y = sh;
  if (d.m === 'walk') x += f * Math.sin(d.ph) * side * 1.4;
  else if (d.m === 'run') {
    const sw = Math.sin(d.ph) * side;
    x += f * sw * 2.2;
    y -= Math.max(0, sw) * 1.6;
  } else if (d.m === 'up' || d.m === 'cheer') y = Y(d, 0.78) + (d.m === 'cheer' ? Math.sin(d.t * 13 + side) * 0.6 : 0);
  else if (d.m === 'fall') y = Y(d, 0.6) + Math.cos(d.t * 27 + side) * 0.6;
  else y += Math.sin(d.t * 2.2 + side) * 0.3;
  tonedOval(d.s, x, y, 1.95, 1.75, 9, GLOVE, GLOVE_SH, d.lk.ink, 0.6 * d.k, 1 * d.k, 0.6);
}

export const art: KindArt = {
  size: [0.9, 0.92],
  // A small round body, a pinch for the neck, a round head with the huge nose out front and a tuft of three
  // spikes standing up off the crown.
  outline:
    'M 0 0 C 0.22 0 0.28 -0.12 0.26 -0.24 C 0.24 -0.31 0.18 -0.35 0.13 -0.37 C 0.24 -0.38 0.34 -0.36 0.44 -0.4 C 0.56 -0.44 0.58 -0.58 0.47 -0.63 C 0.39 -0.66 0.3 -0.62 0.26 -0.64 C 0.26 -0.71 0.22 -0.76 0.15 -0.79 L 0.24 -0.97 L 0.05 -0.84 L 0.0 -1 L -0.08 -0.84 L -0.22 -0.93 L -0.2 -0.76 C -0.31 -0.7 -0.33 -0.5 -0.2 -0.41 C -0.17 -0.39 -0.2 -0.36 -0.23 -0.31 C -0.3 -0.16 -0.22 0 0 0 Z',
  // High above the floor: the shoes float under him with a gap, nothing joins them.
  lift: 5.2,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  faceX: 0.08,
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.6, upright: 0.6 } : {}),
  paintFace: (d) => pair(d, 0.66, 0.1, 0.75),
  back: (d) => {
    shoe(d, -d.f);
    shoe(d, d.f);
    glove(d, -d.f);
  },
  print: (d) => {
    // The head and nose in skin above the neck, a shade under the nose, the tuft in hair over the crown, and the
    // neckerchief between head and body.
    band(d, 0.39, 0.8, SKIN);
    poly(d.s, oval(d.f * d.W * 0.36, Y(d, 0.42), d.W * 0.2, d.H * 0.035, 12), SKIN_SH);
    band(d, 0.78, 1.1, HAIR);
    band(d, 0.33, 0.41, LINEN);
  },
  snout: (d) => {
    // The near glove last, over everything: it floats in front of the body's side, clear of it.
    d.s.save();
    d.s.translate(-d.f * d.W * 0.08, 0);
    glove(d, d.f);
    d.s.restore();
  },
  parts: ['shard', 'shard'],
};
