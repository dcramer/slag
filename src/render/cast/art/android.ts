import { mouthMark } from '../faces';
import { band, type D, inked, type KindArt, mark, oval, poly, toned, WOOD_SH, Y } from '../kit';

/**
 * The blindfolded android (docs/characters/android.md): a chunky little swordswoman, a round white bob with a
 * straight fringe over a black satin sleep mask with pale sleepy eyes printed on it, a short dress flaring at the
 * hem over thigh-high boots, all in the player's colour, a giant letter opener held low in front of her pointing
 * forward and down, and a dented cardboard box hung on a string from a stick over her shoulder for a drone. A
 * rendered kind draws from its frames (src/render/cast/sprites/android/); this is what shows before they load,
 * and on the hand-drawn sheets.
 */

const HAIR = '#efebe2';
const HAIR_SH = '#bdb8c0';
const SKIN = '#f2d6c0';
const MASK = '#25202a';
const PRINT = '#bdb7c4';
const BLADE = '#c4c7ce';
const BLADE_SH = '#8e9298';
const BOX = '#b98c5c';
const BOX_SH = '#8a6440';

/** The mask's middle, as a fraction of the body's height. */
const MASK_U = 0.76;

/** The pale shut eyes printed on the mask, which act anyway: a slant on the run, an O on a fall, arcs on a cheer. */
function face(d: D) {
  const y = Y(d, MASK_U);
  for (const sd of [-1, 1]) {
    const x = d.f * (d.W * 0.16 + sd * d.W * 0.12);
    const r = 0.75;
    if (d.m === 'fall') {
      poly(d.s, oval(x, y, r * 0.8, r * 0.85, 10), PRINT);
      poly(d.s, oval(x, y, r * 0.4, r * 0.45, 8), MASK);
      continue;
    }
    const pts =
      d.m === 'run' || d.m === 'wall'
        ? [
            { x: x - d.f * r, y: y - r * 0.3 },
            { x: x + d.f * r, y: y + r * 0.2 },
          ]
        : Array.from({ length: 7 }, (_, j) => {
            const a = Math.PI * (d.m === 'cheer' ? 1.1 + (j / 6) * 0.8 : 0.1 + (j / 6) * 0.8);
            return { x: x + Math.cos(a) * r, y: y + (d.m === 'cheer' ? 0.3 : -0.2) * r + Math.sin(a) * r * 0.55 };
          });
    mark(d.s, PRINT, pts, 0.45, sd + 3, [0.2, 0.2]);
  }
  mouthMark(d, d.f * d.W * 0.2, Y(d, 0.63), 1.2, 'flat');
}

/** The letter opener: a long flat blade from her fist, forward and down, its round-ended tip near the floor. */
function opener(d: D, hx: number, hy: number) {
  const a = d.pose === 'air' ? 0.75 : 0.55;
  const ca = Math.cos(a) * d.f;
  const sa = Math.sin(a);
  const len = 9;
  const at = (u: number, v: number) => ({ x: hx + ca * u - sa * v * d.f, y: hy + sa * u + Math.cos(a) * v });
  toned(d.s, [at(1, -0.8), at(len - 1, -0.8), at(len, 0), at(len - 1, 0.8), at(1, 0.8)], BLADE, BLADE_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.5);
  // The curly handle behind the fist.
  inked(d.s, [at(-2.2, -0.5), at(1, -0.5), at(1, 0.5), at(-2.2, 0.5)], BLADE_SH, d.lk.ink, 0.3 * d.k, 0.5 * d.k);
  mark(d.s, d.lk.ink, [at(1, -1.4), at(1, 1.4)], 0.55, 2, [0.2, 0.2]);
}

/** The drone: a stick up from behind her shoulder, a string, and a dented cardboard box hung clear of her. */
function drone(d: D) {
  const f = d.f;
  const base = { x: d.bx(0.5) - f * d.W * 0.1, y: Y(d, 0.42) };
  const tip = { x: d.bx(0.9) + f * d.W * 0.5, y: Y(d, 0.92) };
  mark(d.s, WOOD_SH, [base, tip], 0.6, 5, [0.1, 0.3]);
  const sway = d.wob * 0.4 + Math.sin(d.t * 2.4) * 0.2;
  const bx = tip.x + sway;
  const by = Y(d, 0.6);
  mark(d.s, d.lk.ink, [tip, { x: bx, y: by - 1.6 }], 0.25, 6, [0, 0]);
  const s = 1.7;
  toned(
    d.s,
    [
      { x: bx - s, y: by - s },
      { x: bx + s * 0.4, y: by - s },
      // The dent caved into the front top corner.
      { x: bx + s * 0.6, y: by - s * 0.4 },
      { x: bx + s, y: by - s * 0.5 },
      { x: bx + s, y: by + s },
      { x: bx - s, y: by + s },
    ],
    BOX,
    BOX_SH,
    d.lk.ink,
    0.3,
    0.6 * d.k,
    0.4,
  );
  if (d.detail) poly(d.s, oval(bx - s * 0.2, by - s * 0.75, s * 0.6, s * 0.18, 6), '#9a9c98');
}

export const art: KindArt = {
  size: [0.88, 1],
  // A round bob wider than her shoulders with straight sides down to the jaw, a slim neck and body, and a short
  // skirt flaring at the hem.
  outline:
    'M 0.04 -1 C 0.3 -1 0.46 -0.88 0.46 -0.68 L 0.44 -0.56 C 0.3 -0.55 0.2 -0.54 0.14 -0.5 C 0.2 -0.44 0.22 -0.34 0.22 -0.26 C 0.34 -0.16 0.46 -0.06 0.5 0 L -0.48 0 C -0.44 -0.08 -0.32 -0.18 -0.22 -0.26 C -0.22 -0.34 -0.2 -0.44 -0.14 -0.5 C -0.22 -0.54 -0.34 -0.55 -0.42 -0.56 L -0.44 -0.7 C -0.42 -0.9 -0.24 -1 0.04 -1 Z',
  lift: 3,
  feet: 'boot',
  arms: 'mitten',
  fill: 'player',
  faceX: 0.12,
  // A light, poised step.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.4, upright: 0.8 } : {}),
  paintFace: face,
  print: (d) => {
    // The bob over the head, her face in skin under the fringe toward where she faces, the mask across the eyes
    // and its band round the bob, and the dark hem.
    band(d, 0.55, 1.1, HAIR);
    band(d, 0.55, 0.58, HAIR_SH);
    poly(d.s, oval(d.f * d.W * 0.2, Y(d, 0.68), d.W * 0.24, d.H * 0.14, 14), SKIN);
    band(d, MASK_U - 0.035, MASK_U + 0.035, MASK);
    poly(d.s, oval(d.f * d.W * 0.18, Y(d, MASK_U), d.W * 0.3, d.H * 0.065, 14), MASK);
    band(d, -0.1, 0.06, d.lk.playerDark);
  },
  back: drone,
  tool: opener,
  parts: ['shard', 'shard'],
};
