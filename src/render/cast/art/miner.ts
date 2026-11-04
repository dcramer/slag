import type { KindArt } from '../kit';
import { line, poly, STEEL, STEEL_SH, toned, Y } from '../kit';
import { pair } from '../faces';

const WOOD = '#d9a272';
const GRAIN = '#b07a52';
const HAIR = '#4a3020';
const SHOE = '#8a8c92';
const SHOE_SH = '#6b6d73';
const HANDLE = '#8a5c34';

/**
 * The voxel miner, a wooden toy (docs/CHARACTERS.md → The voxel miner): a cube head as wide as the body on a
 * box torso, no curve anywhere, and a pickaxe. Hand-inked from his design for the hand-drawn sheets and the
 * frames before his rendered ones load (src/render/cast/sprites/); stiff-limbed, the toy rocking on each step.
 */
export const art: KindArt = {
  size: [1, 1],
  // The cube head, its corner chipped at the back, over the narrower box of the torso.
  outline: 'M -0.5 -0.94 L -0.44 -1 L 0.48 -1 L 0.5 -0.98 L 0.5 -0.54 L 0.3 -0.53 L 0.3 0 L -0.3 0 L -0.3 -0.53 L -0.5 -0.54 Z',
  lift: 2.8,
  feet: 'boot',
  boots: [SHOE, SHOE_SH],
  arms: 'mitten',
  hands: 'paint',
  fill: 'player',
  faceX: 0.14,
  // Stiff: no bend or lean, a hop and a rock on each step.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.6, rot: Math.sin(g.ph) * 0.05, pivot: 0, upright: 0.9 } : {}),
  paintFace: (d) => pair(d, 0.74, 0.13, 0.75),
  print: (d) => {
    // The bare-wood head with its side face in a darker grain, the hair's flat cap over the top and back,
    // and the trousers in a dark of the shirt.
    const x = (u: number) => d.f * d.W * u;
    const rect = (x0: number, x1: number, u0: number, u1: number, c: string) =>
      poly(
        d.s,
        [
          { x: x(x0), y: Y(d, u0) },
          { x: x(x1), y: Y(d, u0) },
          { x: x(x1), y: Y(d, u1) },
          { x: x(x0), y: Y(d, u1) },
        ],
        c,
      );
    rect(-0.56, 0.56, 1.02, 0.53, WOOD);
    rect(-0.56, -0.08, 1.02, 0.53, GRAIN);
    rect(-0.56, 0.56, 1.02, 0.88, HAIR);
    rect(-0.56, -0.24, 0.9, 0.64, HAIR);
    rect(-0.4, 0.4, 0.16, -0.05, d.lk.playerDark);
  },
  tool: (d, hx, hy) => {
    // A toy pickaxe: a long wooden handle up past the shoulder, a blocky grey head across its top.
    const a = -Math.PI / 2 + d.f * (d.m === 'run' ? 0.5 : 0.25);
    const tx = hx + Math.cos(a) * 7;
    const ty = hy + Math.sin(a) * 7;
    d.s.fillStyle = d.lk.ink;
    line(d.s, hx, hy + 1.5, tx, ty, { w: 2.2, seed: 3, taper: [0, 0], press: 0 });
    d.s.fillStyle = HANDLE;
    line(d.s, hx, hy + 1.5, tx, ty, { w: 1.1, seed: 3, taper: [0, 0], press: 0 });
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const at = (u: number, v: number) => ({ x: tx + ca * u - sa * v, y: ty + sa * u + ca * v });
    toned(d.s, [at(-0.4, -3.4), at(0.6, -2.6), at(0.9, 0), at(0.6, 3.6), at(-0.6, 2.8), at(-1, 0)], STEEL, STEEL_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.3);
  },
  parts: ['shard', 'shard', 'bolt'],
};
