import type { KindArt } from '../kit';
import { band, mark, poly, Y } from '../kit';
import { pair } from '../faces';

/**
 * The bargain-bin hitman (docs/characters/hitman.md): a huge smooth bald head with a price sticker half peeled off the
 * back of it, on a boxy suit with broad square shoulders, the white shirt V and a crooked clip-on tie down it, and a
 * stapler held like a pistol low in his fist. The suit is the player's colour and the tie a light of it; the head, the
 * shirt, the gloves, shoes and stapler are neutrals. A rendered kind draws from its frames
 * (src/render/cast/sprites/hitman/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SKIN = '#efc8a6';
const SKIN_SH = '#d6a888';
const WHITE = '#f4f3ee';
const CODE = '#2a2a30';
const STEEL = '#b6bcc2';
const STEEL_SH = '#8c9298';

export const art: KindArt = {
  size: [0.92, 1.02],
  // The head is the top half, round and bald, set forward of the shoulders; the suit under it, its square shoulders
  // the widest line, straight down to the jacket's hem.
  outline:
    'M 0.16 -0.55 C 0.3 -0.58 0.33 -0.7 0.31 -0.8 C 0.29 -0.93 0.18 -1 0.04 -1 C -0.12 -1 -0.22 -0.92 -0.23 -0.78 C -0.24 -0.66 -0.19 -0.58 -0.1 -0.55 L -0.36 -0.53 C -0.46 -0.51 -0.48 -0.44 -0.47 -0.36 L -0.44 0 L 0.44 0 L 0.47 -0.36 C 0.48 -0.45 0.45 -0.51 0.36 -0.53 Z',
  lift: 3,
  feet: 'boot',
  boots: ['#2e3036', '#1e1f24'],
  arms: 'mitten',
  // The kind's own paint is a charcoal (PAINTS): his black leather gloves.
  hands: 'paint',
  fill: 'player',
  faceX: 0.14,
  // An unhurried, even walk: upright, hardly a bob.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.25 + g.run * 0.25), upright: 0.9 } : {}),
  paintFace: (d) => pair(d, 0.76, 0.08, 0.45),
  over: (d) => {
    const x = (u: number) => d.f * d.W * u;
    // The bald head, its jaw shade, and the price sticker on the back of the skull with its bars, one corner lifting.
    band(d, 0.555, 1.01, SKIN);
    band(d, 0.555, 0.6, SKIN_SH);
    poly(
      d.s,
      [
        { x: x(-0.2), y: Y(d, 0.9) },
        { x: x(-0.06), y: Y(d, 0.92) },
        { x: x(-0.05), y: Y(d, 0.83) },
        { x: x(-0.19), y: Y(d, 0.81) },
      ],
      WHITE,
    );
    for (const u of [-0.17, -0.13, -0.09])
      mark(
        d.s,
        CODE,
        [
          { x: x(u), y: Y(d, 0.895) },
          { x: x(u + 0.005), y: Y(d, 0.835) },
        ],
        0.35,
        d.sd,
        [0, 0],
      );
    // The white shirt V under the chin, and the clip-on tie, a light of the suit, hanging crooked down it.
    poly(
      d.s,
      [
        { x: x(-0.04), y: Y(d, 0.56) },
        { x: x(0.2), y: Y(d, 0.56) },
        { x: x(0.09), y: Y(d, 0.24) },
      ],
      WHITE,
    );
    poly(
      d.s,
      [
        { x: x(0.05), y: Y(d, 0.555) },
        { x: x(0.11), y: Y(d, 0.555) },
        { x: x(0.16), y: Y(d, 0.32) },
        { x: x(0.12), y: Y(d, 0.28) },
        { x: x(0.09), y: Y(d, 0.32) },
      ],
      d.lk.playerHi,
    );
  },
  tool: (d, hx, hy) => {
    // A stapler held like a pistol, low and out from his side, its nose pointing down and ahead.
    const at = (a: number, b: number) => ({ x: hx + d.f * a, y: hy + b });
    poly(d.s, [at(-0.9, -0.6), at(0.7, -1.1), at(2.6, 4), at(1, 4.5)], STEEL);
    poly(d.s, [at(0.2, 1.3), at(0.8, 1.1), at(2.1, 4.1), at(1.5, 4.3)], STEEL_SH);
  },
  parts: ['shard', 'shard', 'bolt'],
};
