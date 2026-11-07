import type { Kind } from '../../gen/character';
import type { P } from '../ink';
import { brows, eye, mouthMark, sideEye, tallEyes, toonEyes } from './faces';
import { art as miner } from './art/miner';
import { art as ape } from './art/ape';
import { art as merc } from './art/merc';
import { art as king } from './art/king';
import { art as dino } from './art/dino';
import { art as robot } from './art/robot';
import { art as sneak } from './art/sneak';
import { art as cuptoon } from './art/cuptoon';
import { art as horse } from './art/horse';
import { art as rapper } from './art/rapper';
import { art as limbless } from './art/limbless';
import { art as worm } from './art/worm';
import { art as dragon } from './art/dragon';
import { art as hopper } from './art/hopper';
import { art as warrior } from './art/warrior';
import { art as slayer } from './art/slayer';
import { art as raider } from './art/raider';
import { art as fighter } from './art/fighter';
import { art as stinger } from './art/stinger';
import { art as mage } from './art/mage';
import { art as creeper } from './art/creeper';
import { art as tophat } from './art/tophat';
import { art as pyramid } from './art/pyramid';
import { art as invader } from './art/invader';
import { art as vampire } from './art/vampire';
import { art as assistant } from './art/assistant';
import { art as sim } from './art/sim';
import { art as succubus } from './art/succubus';
import { art as archer } from './art/archer';
import { art as slime } from './art/slime';
import { art as bear } from './art/bear';
import { art as mech } from './art/mech';
import { art as genie } from './art/genie';
import { art as mushroom } from './art/mushroom';
import { art as boxer } from './art/boxer';
import { art as junior } from './art/junior';
import { art as bomber } from './art/bomber';
import { art as skeleton } from './art/skeleton';
import { art as android } from './art/android';
import { art as climber } from './art/climber';
import { art as hitman } from './art/hitman';
import { band, type D, type KindArt, line, mark, ORANGE, ORANGE_SH, oval, poly, spot, STEEL, STEEL_SH, toned, tonedOval, Y } from './kit';

/**
 * The cast, one hand-designed character per kind (docs/CHARACTERS.md): homages to famous game
 * characters in our own designs. A homage reads from its
 * silhouette and the three or four traits people actually know it by (the plumber's cap, nose and
 * mustache; the speedster's swept spikes and red sneakers), in its own iconic palette, with the player's
 * color on a ring at its feet. Never the real character's exact design, and never its real name: the
 * sound-alike names are data (`KIND_NAMES`).
 *
 * Outlines are authored facing right in body units (x across -0.5..0.5 of the width, y up to -1); hooks
 * put a part on the front with `d.f`. Gaits are animation only: everyone's physics are the same.
 */

const S = Math.sin;
const abs = Math.abs;
const SKIN = '#efc9a4';
const SKIN_SH = '#cf9f7c';
const PEACH = '#f0c99c';
const BONE = '#efe6d2';
const BONE_SH = '#c8bba0';
const BROWN = '#6b4a35';
const BROWN_SH = '#4d3426';
// The electric mouse's tin tail, the frames' grey.
const ZAP_TIN = '#a9afb7';
const BLUE = '#3f62b4';
const BLUE_SH = '#2e4a8c';
const RED = '#c9473f';
const RED_SH = '#9c3530';
const GOLD = '#e8c24a';
const KHAKI = '#8c7a58';
/** The engineer's steel hard hat. */
const HAT = '#c9c5bc';
const HAT_SH = '#a19d94';
const KHAKI_SH = '#6c5c40';

/** A beak or bill out of the front of a head at (x, y). */
function beak(d: D, x: number, y: number, len: number, h: number, open = 0) {
  toned(
    d.s,
    [
      { x: x - d.f * 0.6, y: y - h },
      { x: x + d.f * len, y: y + 0.1 },
      { x: x - d.f * 0.6, y: y + h + open },
    ],
    ORANGE,
    ORANGE_SH,
    d.lk.ink,
    0.35,
    0.7 * d.k,
    0.4,
  );
}

/** A level band of cloth across the body from u0 to u1 in two tones (lit, and a shade along its foot), cut by the outline. */
function tone(d: D, u0: number, u1: number, fill: string, shade: string) {
  const lo = Math.min(Y(d, u0), d.by + 0.4);
  const hi = Y(d, u1);
  const band = (a: number, b: number, c: string) =>
    poly(
      d.s,
      [
        { x: -d.W * 0.62, y: a },
        { x: d.W * 0.62, y: a },
        { x: d.W * 0.62, y: b },
        { x: -d.W * 0.62, y: b },
      ],
      c,
    );
  band(hi, lo, fill);
  band(lo - (lo - hi) * 0.22, lo, shade);
}

export const KINDS: Record<Kind, KindArt> = {
  // The mustached plumber: red cap with a round white badge, a big round nose, a thick mustache, blue
  // overalls with two gold buttons, white gloves, brown shoes. Big-headed and stout. Runs jaunty.
  plumber: {
    size: [0.94, 1.02],
    outline:
      'M -0.02 -0.98 C 0.24 -1 0.4 -0.86 0.4 -0.7 C 0.5 -0.7 0.6 -0.64 0.58 -0.56 C 0.56 -0.5 0.46 -0.48 0.4 -0.48 C 0.46 -0.4 0.5 -0.3 0.48 -0.18 C 0.46 -0.04 0.34 0 0.2 0 L -0.28 0 C -0.42 0 -0.5 -0.1 -0.48 -0.24 C -0.46 -0.4 -0.38 -0.48 -0.34 -0.52 C -0.42 -0.6 -0.42 -0.76 -0.36 -0.86 C -0.28 -0.96 -0.16 -0.98 -0.02 -0.98 Z',
    lift: 2.8,
    feet: 'boot',
    boots: [BROWN, BROWN_SH],
    arms: 'mitten',
    hands: 'glove',
    fill: 'paint',
    ring: true,
    faceX: 0.12,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 1.1, bend: 0.06, upright: 0.9 } : {}),
    paintFace: (d) => toonEyes(d, 0.74, 0.09, 1.05, '#3c6fd0'),
    print: (d) => {
      // Skin for the face, hair at the back of the head, blue overalls up to two straps and gold buttons.
      spot(d.s, d.f * d.W * 0.1, Y(d, 0.7), d.W * 0.4, d.H * 0.18, d.sd, SKIN, 0.05);
      spot(d.s, -d.f * d.W * 0.34, Y(d, 0.68), d.W * 0.14, d.H * 0.12, d.sd + 1, BROWN_SH, 0.2);
      tone(d, -0.2, 0.36, BLUE, BLUE_SH);
      for (const sd of [-1, 1]) {
        mark(
          d.s,
          BLUE,
          [
            { x: sd * d.W * 0.2, y: Y(d, 0.34) },
            { x: sd * d.W * 0.18, y: Y(d, 0.52) },
          ],
          2,
          sd,
          [0, 0],
        );
        poly(d.s, oval(sd * d.W * 0.18, Y(d, 0.36), 0.75, 0.75, 7), GOLD);
      }
    },
    front: (d) => {
      // The cap: a dome over the head, its bill out front, a round white badge with our own mark.
      const x = d.bx(0.9);
      const brim = Y(d, 0.8);
      toned(
        d.s,
        [
          { x: x - d.W * 0.46, y: brim + 0.6 },
          { x: x - d.W * 0.38, y: d.top - 1.4 },
          { x: x + d.f * d.W * 0.06, y: d.top - 2.8 },
          { x: x + d.W * 0.38, y: d.top - 1.2 },
          { x: x + d.W * 0.46, y: brim + 0.6 },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.4,
        0.8 * d.k,
        0.6,
      );
      toned(
        d.s,
        [
          { x: x + d.f * d.W * 0.18, y: brim - 0.6 },
          { x: x + d.f * d.W * 0.7, y: brim + 0.2 },
          { x: x + d.f * d.W * 0.64, y: brim + 1.3 },
          { x: x + d.f * d.W * 0.16, y: brim + 0.9 },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.3,
        0.7 * d.k,
        0.4,
      );
      const bx = x + d.f * 0.8;
      const by = Y(d, 0.93);
      tonedOval(d.s, bx, by, 1.7, 1.6, 10, '#fbf6ee', '#d8d0c2', d.lk.ink, 0.25, 0.5, 0.4);
      // Our mark on the badge: a little wrench, not a letter.
      mark(
        d.s,
        d.lk.paint,
        [
          { x: bx - 0.8, y: by + 0.7 },
          { x: bx + 0.6, y: by - 0.6 },
        ],
        0.7,
        1,
        [0, 0],
      );
      poly(d.s, oval(bx + 0.7, by - 0.7, 0.45, 0.45, 6), d.lk.paint);
    },
    snout: (d) => {
      // The big round nose and the thick mustache under it.
      const x = d.f * d.W * 0.34;
      const y = Y(d, 0.56);
      const m: P[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (i / 10);
        m.push({ x: x - d.f * 0.6 + Math.cos(a) * 3.6, y: y + 0.9 + Math.sin(a) * 1.8 - (i % 2) * 0.6 });
      }
      poly(d.s, m, BROWN_SH);
      tonedOval(d.s, x, y - 0.7, 2.2, 1.9, 12, SKIN, SKIN_SH, d.lk.ink, 0.35, 0.7 * d.k, 0.5);
    },
    parts: ['coin', 'coin', 'shard'],
  },

  // The blue speedster: cobalt, spikes swept back off a big head, a peach muzzle and belly, joined eyes
  // with green irises, a cocky grin, red sneakers with a white strap. Runs leaning hard; spins in the air.
  hedgehog: {
    size: [0.96, 1.04],
    outline:
      'M 0.1 -1 C 0.32 -1 0.46 -0.88 0.46 -0.72 C 0.56 -0.7 0.6 -0.64 0.56 -0.6 C 0.52 -0.56 0.44 -0.56 0.4 -0.54 C 0.36 -0.48 0.3 -0.46 0.24 -0.44 C 0.3 -0.34 0.3 -0.14 0.22 -0.04 C 0.16 0 0.04 0 -0.04 -0.02 C -0.14 -0.06 -0.18 -0.2 -0.16 -0.34 C -0.24 -0.36 -0.36 -0.38 -0.56 -0.44 C -0.4 -0.5 -0.32 -0.54 -0.26 -0.58 C -0.42 -0.64 -0.56 -0.72 -0.7 -0.82 C -0.5 -0.8 -0.36 -0.8 -0.26 -0.78 C -0.38 -0.88 -0.5 -0.98 -0.58 -1.06 C -0.4 -1.02 -0.2 -1.02 0.1 -1 Z',
    lift: 3.6,
    feet: 'sneaker',
    boots: [RED, RED_SH],
    arms: 'mitten',
    hands: 'glove',
    fill: 'paint',
    ring: true,
    faceX: 0.16,
    gait: (g) => {
      if (!g.grounded && g.vy < 120) return { rot: (g.t * 16) % (Math.PI * 2), pivot: 0.5, sx: 0.92, sy: 0.92 };
      return g.moving ? { hop: abs(S(g.ph)) * 0.6, bend: 0.08 + g.run * 0.08, upright: 1 } : {};
    },
    paintFace: (d) => {
      toonEyes(d, 0.74, 0.09, 1.2, '#3a9a46', true);
      // The grin, up on one side.
      const y = Y(d, 0.54);
      const x = d.f * d.W * 0.12;
      if (d.m === 'fall') poly(d.s, oval(x, y, 0.8, 1, 8), d.lk.eye);
      else
        mark(
          d.s,
          d.lk.eye,
          [
            { x: x - d.f * 1.2, y: y + 0.2 },
            { x, y: y + 0.7 },
            { x: x + d.f * 1.6, y: y - 0.6 },
          ],
          0.8,
          d.sd,
          [0.15, 0.3],
        );
    },
    print: (d) => {
      // The peach muzzle and belly.
      spot(d.s, d.f * d.W * 0.26, Y(d, 0.56), d.W * 0.24, d.H * 0.1, d.sd, PEACH, 0.08);
      spot(d.s, d.f * d.W * 0.06, Y(d, 0.24), d.W * 0.17, d.H * 0.16, d.sd + 1, PEACH, 0.08);
    },
    snout: (d) => poly(d.s, oval(d.f * d.W * 0.42, Y(d, 0.6), 0.75, 0.6, 7), d.lk.eye),
    back: (d) => {
      // The tin toy's wind-up key out of his hip: a stem, and a figure-eight bow standing clear behind him.
      const y = Y(d, 0.26);
      const x = -d.f * d.W * 0.56;
      mark(
        d.s,
        d.lk.ink,
        [
          { x: x + d.f * 1.2, y },
          { x: -d.f * d.W * 0.1, y },
        ],
        1.3,
        1,
        [0, 0],
      );
      for (const dy of [-1.35, 1.35]) {
        tonedOval(d.s, x, y + dy, 1.45, 1.35, 10, '#9a9d9f', '#7b7f82', d.lk.ink, 0.35, 0.7 * d.k, 0.5);
        poly(d.s, oval(x, y + dy, 0.45, 0.45, 6), d.lk.ink);
      }
    },
    parts: ['shard', 'shard', 'coin'],
  },

  // The green-tunic elf: a long green cap flopping back, pointed ears, a blond fringe, a tunic flared at
  // the hem with a brown belt, a shield and a sword hilt on the back. Strides out.
  elf: {
    size: [0.84, 1],
    outline:
      'M 0.04 -0.86 C 0.24 -0.88 0.36 -0.78 0.36 -0.64 C 0.36 -0.56 0.32 -0.5 0.24 -0.48 C 0.3 -0.4 0.34 -0.3 0.36 -0.2 L 0.46 -0.04 L 0.3 0 L -0.32 0 L -0.46 -0.04 L -0.34 -0.2 C -0.32 -0.3 -0.3 -0.4 -0.24 -0.48 C -0.32 -0.52 -0.36 -0.6 -0.34 -0.68 C -0.32 -0.8 -0.18 -0.86 0.04 -0.86 Z',
    lift: 2.8,
    feet: 'boot',
    boots: [BROWN, BROWN_SH],
    arms: 'mitten',
    hands: 'leather',
    fill: 'paint',
    ring: true,
    faceX: 0.1,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 0.8, bend: 0.06, upright: 0.8 } : {}),
    paintFace: (d) => toonEyes(d, 0.66, 0.11, 0.95, '#3c74c8'),
    print: (d) => {
      spot(d.s, d.f * d.W * 0.06, Y(d, 0.66), d.W * 0.36, d.H * 0.16, d.sd, SKIN, 0.05);
      tone(d, 0.26, 0.32, BROWN, BROWN_SH);
      poly(d.s, oval(d.f * d.W * 0.06, Y(d, 0.29), 0.9, 0.7, 6), GOLD);
    },
    back: (d) => {
      // A kite shield and a sword hilt on the back.
      const x = -d.f * d.W * 0.4;
      const y = Y(d, 0.44);
      toned(
        d.s,
        [
          { x: x - 2.4, y: y - 3 },
          { x: x + 2.4, y: y - 3 },
          { x: x + 2.2, y: y + 1 },
          { x, y: y + 3.6 },
          { x: x - 2.2, y: y + 1 },
        ],
        '#3b5fa8',
        '#2b4680',
        d.lk.ink,
        0.4,
        0.8 * d.k,
        0.5,
      );
      mark(
        d.s,
        '#c9ccd2',
        [
          { x: x - 1.8, y: y - 2.5 },
          { x: x + 1.8, y: y - 2.5 },
        ],
        0.7,
        1,
        [0, 0],
      );
      mark(
        d.s,
        d.lk.ink,
        [
          { x: x + d.f * 1.6, y: Y(d, 0.58) },
          { x: x + d.f * 3.4, y: Y(d, 0.86) },
        ],
        1.6,
        2,
        [0, 0],
      );
      mark(
        d.s,
        '#5a7fc0',
        [
          { x: x + d.f * 1.6, y: Y(d, 0.58) },
          { x: x + d.f * 3.4, y: Y(d, 0.86) },
        ],
        0.8,
        2,
        [0, 0],
      );
    },
    front: (d) => {
      // The long cap: a cone off the crown, its tip flopping back and swinging as he goes.
      const x = d.bx(0.95);
      const sway = d.wob * 0.5 + (d.m === 'run' ? S(d.ph * 2) * 0.8 : 0);
      toned(
        d.s,
        [
          { x: x + d.f * d.W * 0.36, y: Y(d, 0.76) },
          { x: x + d.f * d.W * 0.2, y: d.top - 2.2 },
          { x: x - d.f * d.W * 0.2, y: d.top - 1.6 },
          { x: x - d.f * (d.W * 0.62 + 2), y: Y(d, 0.6) + sway },
          { x: x - d.f * d.W * 0.36, y: Y(d, 0.72) },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.4,
        0.8 * d.k,
        0.6,
      );
      // A blond fringe under the cap, and a pointed ear.
      for (let i = 0; i < 3; i++)
        mark(
          d.s,
          '#e6c25a',
          [
            { x: x + d.f * (d.W * (0.32 - i * 0.12)), y: Y(d, 0.78) },
            { x: x + d.f * (d.W * (0.26 - i * 0.12)), y: Y(d, 0.66) },
          ],
          1.1,
          i,
          [0.1, 0.6],
        );
      toned(
        d.s,
        [
          { x: x - d.f * d.W * 0.12, y: Y(d, 0.68) },
          { x: x - d.f * (d.W * 0.12 + 3.4), y: Y(d, 0.76) },
          { x: x - d.f * d.W * 0.1, y: Y(d, 0.6) },
        ],
        SKIN,
        SKIN_SH,
        d.lk.ink,
        0.3,
        0.6 * d.k,
        0.4,
      );
    },
    parts: ['shard', 'shard'],
  },

  // The orange bounty hunter: a round helmet with a green visor, huge round shoulder pads, an arm cannon
  // held out front. Strides heavily; raises the cannon in the air.
  hunter: {
    size: [0.98, 1.02],
    outline:
      'M 0 -1 C 0.2 -1 0.3 -0.9 0.3 -0.78 C 0.48 -0.8 0.6 -0.7 0.58 -0.56 C 0.56 -0.44 0.44 -0.4 0.32 -0.42 C 0.3 -0.34 0.26 -0.28 0.28 -0.2 C 0.34 -0.12 0.36 -0.04 0.34 0 L -0.34 0 C -0.36 -0.04 -0.34 -0.12 -0.28 -0.2 C -0.26 -0.28 -0.3 -0.34 -0.32 -0.42 C -0.44 -0.4 -0.56 -0.44 -0.58 -0.56 C -0.6 -0.7 -0.48 -0.8 -0.3 -0.78 C -0.3 -0.9 -0.2 -1 0 -1 Z',
    lift: 2.8,
    feet: 'boot',
    arms: 'none',
    fill: 'paint',
    ring: true,
    shine: true,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 0.7, sy: 1 - abs(S(g.ph)) * 0.03, bend: 0.04, upright: 0.8 } : {}),
    paintFace: (d) => {
      // The visor: green glass across the helmet's front, a hard glint on it.
      const y = Y(d, 0.86);
      const x0 = -d.W * 0.12 * d.f;
      const x1 = d.f * d.W * 0.3;
      poly(
        d.s,
        [
          { x: x0, y: y - 1.5 },
          { x: x1, y: y - 1.2 },
          { x: x1 + d.f * 0.4, y: y + 1.2 },
          { x: x0, y: y + 1.6 },
        ],
        '#2f7a3c',
      );
      mark(
        d.s,
        '#9fe08a',
        [
          { x: x0 + d.f * 0.8, y: y - 0.6 },
          { x: x1 - d.f * 0.6, y: y - 0.7 },
        ],
        0.6,
        1,
        [0.2, 0.2],
      );
    },
    print: (d) => {
      // Red shoulder spheres, a dark waist, green lights on the chest.
      for (const sd of [-1, 1]) tonedOval(d.s, sd * d.W * 0.42, Y(d, 0.6), 2.6, 2.4, 12, RED, RED_SH, d.lk.ink, 0.1, 0.2, 0.6);
      tone(d, 0.26, 0.34, '#4a4a52', '#33333a');
      poly(d.s, oval(d.f * d.W * 0.08, Y(d, 0.5), 0.6, 0.6, 6), '#7fd06a');
    },
    front: (d) => {
      // The arm cannon, held out front, pointed up on a jump.
      const up = d.m === 'up' ? -0.5 : d.m === 'fall' ? 0.3 : 0;
      const x = d.f * d.W * 0.3;
      const y = Y(d, 0.46);
      const a = up;
      const len = 6.4;
      const tx = x + d.f * Math.cos(a) * len;
      const ty = y + Math.sin(a) * len;
      const nx = -Math.sin(a) * 1.8;
      const ny = Math.cos(a) * 1.8;
      toned(
        d.s,
        [
          { x: x - nx, y: y - ny },
          { x: tx - nx * 0.8, y: ty - ny * 0.8 },
          { x: tx + nx * 0.8, y: ty + ny * 0.8 },
          { x: x + nx, y: y + ny },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.35,
        0.7 * d.k,
        0.5,
      );
      tonedOval(d.s, tx, ty, 1.1, 1.5, 8, '#3a3a40', '#26262a', d.lk.ink, 0.3, 0.5, 0.3);
      mark(
        d.s,
        '#7fd06a',
        [
          { x: (x + tx) / 2 - nx * 0.6, y: (y + ty) / 2 - ny * 0.6 },
          { x: (x + tx) / 2 + nx * 0.6, y: (y + ty) / 2 + ny * 0.6 },
        ],
        0.6,
        2,
        [0, 0],
      );
    },
    parts: ['shard', 'shard', 'bolt'],
  },

  // The electric mouse: chubby, its fur the player's colour, two long ears with black tips standing in a V,
  // big red cheeks, a lightning-bolt tail of grey tin. Scampers; ears and tail sway.
  zapmouse: {
    size: [0.9, 0.84],
    outline:
      'M 0.02 -0.94 C 0.3 -0.96 0.46 -0.78 0.46 -0.58 C 0.5 -0.4 0.48 -0.18 0.38 -0.06 C 0.3 0.02 -0.3 0.02 -0.38 -0.06 C -0.48 -0.18 -0.5 -0.4 -0.46 -0.58 C -0.46 -0.78 -0.26 -0.96 0.02 -0.94 Z',
    lift: 2.2,
    feet: 'paw',
    arms: 'mitten',
    hands: 'body',
    fill: 'player',
    faceX: 0.08,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph * 1.4)) * 1, rot: S(g.ph * 1.4) * 0.04, pivot: 0, bend: 0.05 } : {}),
    paintFace: (d) => {
      const y = Y(d, 0.66);
      for (const sd of [-1, 1]) {
        const x = sd * d.W * 0.16 + d.f * 0.6;
        eye(d, x, y, 1);
        poly(d.s, oval(x + sd * 1.6, y + 2.6, 1.5, 1.3, 10), '#e0473b');
      }
      brows(d, [-d.W * 0.16 + d.f * 0.6, d.W * 0.16 + d.f * 0.6], y, 1);
      mouthMark(d, d.f * 0.6, y + 2.6, 1.6, 'smile');
    },
    // The power cord knotted round its middle as a belt.
    print: (d) => band(d, 0.34, 0.41, '#7a5236'),
    back: (d) => {
      // The lightning-bolt tail, cut from grey tin, riveted on at the root.
      const sw = d.wob * 0.4;
      const x = -d.f * d.W * 0.44;
      const y = Y(d, 0.3);
      const pts: P[] = [
        { x, y },
        { x: x - d.f * 2.2, y: y - 2.4 + sw * 0.2 },
        { x: x - d.f * 1.2, y: y - 3.2 },
        { x: x - d.f * 4, y: y - 6.6 + sw * 0.4 },
        { x: x - d.f * 2.6, y: y - 7.2 },
        { x: x - d.f * 6.4, y: y - 11.4 + sw },
        { x: x - d.f * 3.4, y: y - 8.8 },
        { x: x - d.f * 4.4, y: y - 8.2 },
        { x: x - d.f * 1.4, y: y - 4.6 },
        { x: x - d.f * 2.2, y: y - 4.2 },
        { x: x + d.f * 0.6, y: y - 1.4 },
      ];
      toned(d.s, pts, ZAP_TIN, STEEL, d.lk.ink, 0.35, 0.7 * d.k, 0.5);
      poly(d.s, oval(x - d.f * 0.9, y - 1.3, 0.55, 0.55, 6), STEEL_SH);
    },
    front: (d) => {
      // Long ears, black at the tips, splayed and swaying.
      for (const sd of [-1, 1]) {
        const x0 = d.bx(1) + sd * d.W * 0.2;
        const sway = sd * 0.12 + d.wob * 0.03;
        const tx = x0 + sd * 2.6 + Math.sin(sway) * 4;
        const ty = d.top - 6.4;
        toned(
          d.s,
          [
            { x: x0 - 1.6, y: d.top + 2 },
            { x: tx, y: ty },
            { x: x0 + 1.6, y: d.top + 2 },
          ],
          d.lk.player,
          d.lk.playerShade,
          d.lk.ink,
          0.35,
          0.7 * d.k,
          0.5,
        );
        poly(
          d.s,
          [
            { x: tx + (x0 - 1.6 - tx) * 0.32, y: ty + (d.top + 2 - ty) * 0.32 },
            { x: tx, y: ty },
            { x: tx + (x0 + 1.6 - tx) * 0.32, y: ty + (d.top + 2 - ty) * 0.32 },
          ],
          '#2a1f1a',
        );
      }
    },
    parts: ['shard', 'shard'],
  },

  // The impostor bean: a bean on two stubby legs, a wide visor, a backpack. Shuffles. Its body is the
  // player's color, as the original's crew comes in every color anyway.
  impostor: {
    size: [0.9, 0.98],
    outline:
      'M 0.04 -1 C 0.3 -1 0.42 -0.84 0.42 -0.6 L 0.42 -0.18 C 0.42 -0.06 0.36 0 0.26 0 L 0.12 0 C 0.12 -0.08 0.08 -0.1 0.02 -0.1 C -0.04 -0.1 -0.08 -0.08 -0.08 0 L -0.24 0 C -0.34 0 -0.4 -0.06 -0.4 -0.18 L -0.4 -0.6 C -0.4 -0.84 -0.24 -1 0.04 -1 Z',
    lift: 2.3,
    feet: 'none',
    arms: 'none',
    gait: (g) => (g.moving ? { rot: S(g.ph * 1.5) * 0.07, hop: abs(S(g.ph * 1.5)) * 0.5, pivot: 0, bend: 0.03 } : {}),
    paintFace: (d) => {
      // The visor: a wide capsule of pale grey glass standing proud of the front, darker below, a hard glint.
      const y = Y(d, 0.7);
      const x0 = -d.W * 0.06;
      const x1 = d.W * 0.56;
      const cap: P[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI;
        cap.push({ x: d.f * (x1 - 2 + Math.cos(a) * 2), y: y + Math.sin(a) * 2 });
      }
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI / 2 + (i / 10) * Math.PI;
        cap.push({ x: d.f * (x0 + 2 + Math.cos(a) * 2), y: y + Math.sin(a) * 2 });
      }
      toned(d.s, cap, '#c4ccd2', '#7c8893', d.lk.ink, 0.4, 0.8 * d.k, 0.6);
      mark(
        d.s,
        '#ffffff',
        [
          { x: d.f * (x0 + 2.4), y: y - 0.9 },
          { x: d.f * (x1 - 2.4), y: y - 0.9 },
        ],
        0.7,
        1,
        [0.2, 0.3],
      );
    },
    back: (d) => {
      const x = -d.f * d.W * 0.42;
      toned(
        d.s,
        [
          { x, y: Y(d, 0.66) },
          { x: x - d.f * 2.8, y: Y(d, 0.64) },
          { x: x - d.f * 3, y: Y(d, 0.2) },
          { x, y: Y(d, 0.18) },
        ],
        d.lk.fillShade,
        d.lk.playerDark,
        d.lk.ink,
        0.35,
        0.7 * d.k,
        0.5,
      );
    },
    parts: ['shard', 'shard'],
  },

  // The jellyfish-brain floater: a translucent green dome over three red nuclei, a pale rim, four ivory
  // fangs hooked under it. Hovers, bobbing, and chomps.
  jelly: {
    size: [1.1, 0.92],
    outline:
      'M 0 -1 C 0.34 -1 0.52 -0.76 0.52 -0.5 C 0.52 -0.36 0.46 -0.3 0.4 -0.28 C 0.3 -0.3 0.24 -0.26 0.16 -0.28 C 0.06 -0.3 -0.06 -0.3 -0.16 -0.28 C -0.24 -0.26 -0.3 -0.3 -0.4 -0.28 C -0.46 -0.3 -0.52 -0.36 -0.52 -0.5 C -0.52 -0.76 -0.34 -1 0 -1 Z',
    lift: 1.2,
    feet: 'none',
    arms: 'none',
    fill: 'paint',
    glass: 0.62,
    ring: true,
    shine: true,
    gait: (g) => {
      const b = S(g.t * 3 + g.seed);
      return { hop: 1.6 + b * 0.9 + (g.moving ? abs(S(g.ph)) * 0.6 : 0), sx: 1 + b * 0.04, sy: 1 - b * 0.04, upright: 0.4, k: S(g.t * (g.moving ? 9 : 4)) };
    },
    paintFace: () => {},
    print: (d) => {
      // Three red nuclei seen through the membrane, and a pale band inside the hem.
      for (const [u, x, r] of [
        [0.68, -0.16, 2.4],
        [0.7, 0.16, 2.2],
        [0.5, 0, 2],
      ] as const)
        tonedOval(d.s, d.f * d.W * x, Y(d, u), r, r * 0.9, 10, RED, RED_SH, d.lk.ink, 0.25, 0.5, 0.5);
      tone(d, 0.28, 0.36, '#d8f2c8', '#b6dca4');
    },
    back: (d) => {
      const chomp = (d.gait.k ?? 0) * 0.25;
      for (const [x, sd] of [
        [-0.3, -1],
        [-0.1, -1],
        [0.1, 1],
        [0.3, 1],
      ] as const) {
        const x0 = d.W * x;
        const y0 = Y(d, 0.3);
        const a = Math.PI / 2 + sd * (0.25 + chomp);
        const tip = { x: x0 + Math.cos(a) * 4.8, y: y0 + Math.sin(a) * 4.8 };
        toned(
          d.s,
          [
            { x: x0 - 1, y: y0 },
            { x: (x0 + tip.x) / 2 - sd * 0.9, y: (y0 + tip.y) / 2 },
            tip,
            { x: (x0 + tip.x) / 2 + sd * 0.2, y: (y0 + tip.y) / 2 },
            { x: x0 + 1, y: y0 },
          ],
          BONE,
          BONE_SH,
          d.lk.ink,
          0.3,
          0.6 * d.k,
          0.3,
        );
      }
    },
    parts: ['shard', 'shard'],
  },

  // The goose up to no good: white, an orange beak and feet, an S of a neck. On the run it's the honk
  // pose: neck thrust out flat, wings flung up.
  goose: {
    size: [1.16, 1.06],
    outline:
      'M -0.56 -0.36 C -0.44 -0.32 -0.34 -0.34 -0.22 -0.38 C -0.02 -0.44 0.08 -0.44 0.12 -0.52 C 0.14 -0.64 0.06 -0.76 0.1 -0.88 C 0.12 -0.98 0.26 -1.02 0.3 -0.94 C 0.32 -0.9 0.28 -0.86 0.24 -0.84 C 0.2 -0.74 0.24 -0.62 0.3 -0.5 C 0.46 -0.4 0.5 -0.22 0.38 -0.1 C 0.26 0 -0.1 0 -0.3 -0.06 C -0.46 -0.14 -0.52 -0.24 -0.56 -0.36 Z',
    poses: {
      run: 'M -0.56 -0.36 C -0.44 -0.32 -0.34 -0.34 -0.22 -0.4 C -0.04 -0.48 0.14 -0.56 0.3 -0.6 C 0.42 -0.64 0.5 -0.7 0.6 -0.68 C 0.68 -0.66 0.68 -0.56 0.6 -0.54 C 0.5 -0.52 0.42 -0.5 0.36 -0.44 C 0.46 -0.36 0.48 -0.2 0.38 -0.1 C 0.26 0 -0.1 0 -0.3 -0.06 C -0.46 -0.14 -0.52 -0.24 -0.56 -0.36 Z',
    },
    lift: 2.4,
    feet: 'web',
    arms: 'none',
    fill: 'paint',
    ring: true,
    gait: (g) => (g.moving ? { rot: S(g.ph) * 0.08, pivot: 0, upright: 0.4 } : { rot: S(g.t * 1.4) * 0.02, pivot: 0 }),
    paintFace: (d) => {
      const [hx, hu] = d.pose === 'run' ? [0.6, 0.62] : [0.2, 0.93];
      sideEye(d, hu, d.f * d.W * hx, 0.6);
    },
    back: (d) => {
      // Wings: folded at rest, flung up behind on the run, the jump and the honk.
      const out = d.pose !== 'rest' || d.m === 'cheer' ? 1 : 0;
      const flap = out ? S(d.t * 22) * 0.2 : 0;
      for (const sd of [-1, 1]) {
        const x0 = -d.f * d.W * 0.1 + sd * 0.8;
        const y0 = Y(d, 0.42);
        const a = -Math.PI / 2 - d.f * (1.15 - out * 0.85 + flap) * (sd > 0 ? 1 : 0.8);
        const len = out ? 7 : 6;
        const tip = { x: x0 + Math.cos(a) * len, y: y0 + Math.sin(a) * (out ? len : 2.4) };
        toned(
          d.s,
          [{ x: x0 + d.f * 2, y: y0 + 0.4 }, { x: (x0 + tip.x) / 2, y: Math.min(y0, tip.y) - 1 }, tip, { x: x0 - d.f * 2, y: y0 + 1.4 }],
          '#eae5dc',
          '#bdb5a8',
          d.lk.ink,
          0.35,
          0.7 * d.k,
          0.4,
        );
      }
    },
    snout: (d) => {
      const [hx, hu] = d.pose === 'run' ? [0.66, 0.6] : [0.28, 0.91];
      beak(d, d.f * d.W * hx, Y(d, hu), 3.2, 0.75, d.m === 'cheer' || d.m === 'fall' || d.pose === 'run' ? 1.3 : 0);
    },
    parts: ['shard', 'shard'],
  },

  // The team shooter's engineer: tall, broad and square, his head small for his body under a steel hard hat with
  // a rim all round (never a cap's bill out front: that's the plumber), dark welding goggles down over his eyes, a
  // square jaw, a work shirt in the player's colour over khakis, a little gun turret hanging from his back hand
  // and one huge wrench held low in the front one. Trudges, heavy-stepped. His rendered frames draw instead once
  // loaded.
  engineer: {
    size: [1.06, 1.08],
    // Square shoulders on a slab of a torso, a small head on a thick neck, the jaw jutting forward.
    outline:
      'M -0.1 -0.94 C 0.06 -0.96 0.2 -0.92 0.22 -0.84 L 0.28 -0.76 L 0.27 -0.62 L 0.44 -0.58 C 0.5 -0.56 0.5 -0.51 0.5 -0.46 L 0.46 -0.06 C 0.46 -0.02 0.42 0 0.38 0 L -0.38 0 C -0.42 0 -0.46 -0.02 -0.46 -0.06 L -0.5 -0.46 C -0.5 -0.52 -0.47 -0.56 -0.42 -0.58 L -0.2 -0.62 L -0.22 -0.84 C -0.22 -0.92 -0.18 -0.94 -0.1 -0.94 Z',
    lift: 3.4,
    feet: 'boot',
    boots: [BROWN, BROWN_SH],
    arms: 'mitten',
    hands: 'leather',
    fill: 'player',
    faceX: 0.06,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 0.5, sy: 1 - abs(S(g.ph)) * 0.05, upright: 0.7 } : {}),
    paintFace: (d) => {
      // Welding goggles down over his eyes, so no eye shows: a dark lens in a grey rim each, on a strap.
      const y = Y(d, 0.79);
      mark(
        d.s,
        '#3a4246',
        [
          { x: -d.W * 0.24, y },
          { x: d.W * 0.24, y },
        ],
        0.7,
        3,
        [0, 0],
      );
      for (const sd of [-1, 1]) {
        const gx = sd * d.W * 0.1 + d.f * 0.6;
        tonedOval(d.s, gx, y, 1.1, 1.05, 10, STEEL, STEEL_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.4);
        poly(d.s, oval(gx, y, 0.62, 0.6, 8), '#2b3338');
        poly(d.s, oval(gx + d.f * 0.2, y - 0.22, 0.18, 0.18, 6), '#ffffff');
      }
      mouthMark(d, d.f * 1.2, Y(d, 0.66), 2.2, 'flat');
    },
    print: (d) => {
      // The face and square jaw in skin, khaki trousers and a belt under the shirt.
      spot(d.s, d.f * d.W * 0.05, Y(d, 0.73), d.W * 0.25, d.H * 0.15, d.sd, SKIN, 0.05);
      tone(d, -0.2, 0.26, KHAKI, KHAKI_SH);
      tone(d, 0.25, 0.29, BROWN, BROWN_SH);
    },
    back: (d) => {
      // The little turret, hanging by its handle beside his back knee, clear of the legs: a round body in a dark
      // of the shirt, a long barrel pointing back, three thin legs under it.
      const cx = -d.f * (d.W * 0.44 + 2.6);
      const cy = Y(d, 0.06) + 0.6;
      d.s.fillStyle = d.lk.ink;
      for (const lx of [-1.6, 0, 1.6]) line(d.s, cx + lx * 0.5, cy + 1, cx + lx, cy + 3.4, { w: 0.9, seed: 8, taper: [0, 0], press: 0 });
      d.s.fillStyle = STEEL;
      for (const lx of [-1.6, 0, 1.6]) line(d.s, cx + lx * 0.5, cy + 1, cx + lx, cy + 3.2, { w: 0.4, seed: 8, taper: [0, 0], press: 0 });
      toned(
        d.s,
        [
          { x: cx, y: cy - 0.6 },
          { x: cx - d.f * 5, y: cy - 0.6 },
          { x: cx - d.f * 5, y: cy + 0.6 },
          { x: cx, y: cy + 0.6 },
        ],
        STEEL,
        STEEL_SH,
        d.lk.ink,
        0.3,
        0.6 * d.k,
        0.3,
      );
      tonedOval(d.s, cx, cy, 2, 1.8, 12, d.lk.playerDark, d.lk.playerShade, d.lk.ink, 0.3, 0.7 * d.k, 0.4);
      d.s.fillStyle = d.lk.ink;
      line(d.s, cx, cy - 1.8, cx, cy - 3.4, { w: 0.6, seed: 4, taper: [0, 0], press: 0 });
    },
    front: (d) => {
      // The steel hard hat, neutral: a tall dome over a rim that sticks out evenly all round it, front and back
      // alike. In a tone of the shirt it matched the costume as a cap does, and read as the plumber's.
      const x = d.bx(0.95) + d.f * d.W * 0.02;
      const rim = Y(d, 0.86);
      toned(
        d.s,
        [
          { x: x - d.W * 0.3, y: rim },
          { x: x - d.W * 0.28, y: d.top - 2.4 },
          { x: x - d.W * 0.12, y: d.top - 4 },
          { x: x + d.W * 0.12, y: d.top - 4 },
          { x: x + d.W * 0.28, y: d.top - 2.4 },
          { x: x + d.W * 0.3, y: rim },
        ],
        HAT,
        HAT_SH,
        d.lk.ink,
        0.4,
        0.8 * d.k,
        0.6,
      );
      toned(
        d.s,
        [
          { x: x - d.W * 0.46, y: rim - 0.3 },
          { x: x + d.W * 0.46, y: rim - 0.3 },
          { x: x + d.W * 0.44, y: rim + 0.9 },
          { x: x - d.W * 0.44, y: rim + 0.9 },
        ],
        HAT,
        HAT_SH,
        d.lk.ink,
        0.3,
        0.7 * d.k,
        0.4,
      );
    },
    tool: (d, hx, hy) => {
      // One huge wrench, held low and slanting forward and down, its open jaw out in front of his knees.
      const a = d.pose === 'run' ? 0.35 : d.pose === 'air' ? 1.3 : 0.75;
      const ca = d.f * Math.cos(a);
      const sa = Math.sin(a);
      const tx = hx + ca * 5.8;
      const ty = hy + sa * 5.8;
      d.s.fillStyle = d.lk.ink;
      line(d.s, hx, hy, tx, ty, { w: 2.4, seed: 2, taper: [0, 0], press: 0 });
      d.s.fillStyle = STEEL;
      line(d.s, hx, hy, tx, ty, { w: 1.2, seed: 2, taper: [0, 0], press: 0 });
      const at = (u: number, v: number) => ({ x: tx + ca * u - sa * v * d.f, y: ty + sa * u + ca * v * d.f });
      toned(
        d.s,
        [at(-0.6, -2.4), at(2.4, -2.8), at(2.6, -1.1), at(0.9, -0.9), at(0.9, 0.9), at(2.6, 1.1), at(2.4, 2.8), at(-0.6, 2.4)],
        STEEL,
        STEEL_SH,
        d.lk.ink,
        0.3,
        0.6 * d.k,
        0.3,
      );
    },
    parts: ['gear', 'bolt', 'spring', 'shard'],
  },

  // A round puffball on big feet, stubby arms, tall eyes. Toddles; puffs up round in the air.
  puffball: {
    size: [0.96, 0.9],
    outline: 'M 0.02 -1 C 0.32 -1 0.5 -0.78 0.5 -0.5 C 0.5 -0.22 0.32 0 0.02 0 C -0.3 0 -0.5 -0.22 -0.5 -0.5 C -0.5 -0.78 -0.28 -1 0.02 -1 Z',
    lift: 2.6,
    feet: 'boot',
    arms: 'mitten',
    hands: 'body',
    gait: (g) => {
      if (!g.grounded && g.vy < 0) return { sx: 1.14, sy: 1.08 };
      return g.moving ? { hop: abs(S(g.ph * 1.4)) * 0.8, rot: S(g.ph * 1.4) * 0.05, pivot: 0 } : {};
    },
    paintFace: (d) => tallEyes(d, 0.6, 0.11),
    parts: ['shard', 'shard'],
  },
  // The round dot-eater: a yellow circle with a wedge of a mouth cut into its front and one small eye
  // above it, hopping. Ours: a scalloped bite out of the back of the circle, and a checked napkin tucked
  // into the lower lip. Its rendered frames (tools/art3d) chomp; this draws only while they load.
  chomper: {
    size: [1.18, 1.1],
    outline:
      'M 0.030 -0.500 L 0.413 -0.218 L 0.372 -0.166 L 0.326 -0.121 L 0.274 -0.082 L 0.217 -0.050 L 0.157 -0.025 L 0.094 -0.009 L 0.029 -0.001 L -0.036 -0.001 L -0.100 -0.010 L -0.163 -0.027 L -0.223 -0.053 L -0.280 -0.085 L -0.331 -0.125 L -0.377 -0.171 L -0.416 -0.223 L -0.449 -0.280 L -0.474 -0.340 L -0.490 -0.403 L -0.499 -0.467 L -0.499 -0.533 L -0.490 -0.597 L -0.390 -0.632 L -0.350 -0.672 L -0.333 -0.721 L -0.304 -0.765 L -0.258 -0.792 L -0.228 -0.838 L -0.177 -0.855 L -0.128 -0.870 L -0.084 -0.909 L -0.036 -0.999 L 0.029 -0.999 L 0.094 -0.991 L 0.157 -0.975 L 0.217 -0.950 L 0.274 -0.918 L 0.326 -0.879 L 0.372 -0.834 L 0.413 -0.782 Z',
    lift: 0.4,
    feet: 'none',
    arms: 'none',
    fill: 'paint',
    ring: true,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 1.6, sx: 1 + abs(S(g.ph)) * 0.03 } : {}),
    paintFace: (d) => {
      const x = d.f * d.W * 0.16;
      eye(d, x, Y(d, 0.78), 1.15);
      brows(d, [x], Y(d, 0.78), 1.15);
    },
    front: (d) => {
      // The napkin, tucked into the lower lip and hanging over the front, checked in red.
      const x0 = d.f * d.W * 0.12;
      const x1 = d.f * d.W * 0.36;
      const y0 = Y(d, 0.42);
      const y1 = Y(d, 0.29);
      const nap = [
        { x: x0, y: y0 },
        { x: x1, y: y1 },
        { x: x1 + d.f * 0.4, y: y1 + 2.6 },
        { x: (x0 + x1) / 2 + d.f * 0.6, y: y0 + 5.2 },
        { x: x0 - d.f * 0.2, y: y0 + 2.6 },
      ];
      toned(d.s, nap, '#fbf6ee', '#e2d8c6', d.lk.ink, 0.3, 0.6 * d.k, 0.4);
      for (const [u, v] of [
        [0.25, 0.35],
        [0.7, 0.3],
        [0.5, 0.65],
      ] as const)
        poly(d.s, oval(x0 + (x1 - x0) * u + d.f * 0.3, y0 + (y1 - y0) * u + v * 4.4, 0.6, 0.6, 4), RED);
    },
    parts: ['shard', 'shard'],
  },
  miner,
  ape,
  merc,
  king,
  dino,
  robot,
  sneak,
  cuptoon,
  horse,
  rapper,
  limbless,
  worm,
  dragon,
  hopper,
  warrior,
  slayer,
  raider,
  fighter,
  stinger,
  mage,
  creeper,
  tophat,
  pyramid,
  invader,
  vampire,
  assistant,
  sim,
  succubus,
  archer,
  slime,
  bear,
  mech,
  genie,
  mushroom,
  boxer,
  junior,
  bomber,
  skeleton,
  android,
  climber,
  hitman,
};
