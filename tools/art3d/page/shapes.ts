import type { Clip, Settings } from '../settings';
import { chomperFrame } from './chomper';
import type { Traced } from './trace';

/**
 * Limbless kinds (README → Non-humanoid kinds): no model and no rig, so each is drawn by a generator of
 * its own, the way page/ball.ts draws the spin ball: shapes in the roster's colours, the motion as frames,
 * marks for speed. A generator draws one frame of a clip at `u` (0 to 1 through it) for a facing, in the
 * same traced form a model's render comes out in, so the game can't tell the two apart.
 */
export type Generator = (s: Settings, clip: string, c: Clip, u: number, i: number, facing: 'r' | 'l', role: (name: string) => number) => Traced;

const GENERATORS: Record<string, Generator> = { chomper: chomperFrame };

export function shaped(s: Settings, only?: string[]) {
  const gen = GENERATORS[s.shape!.by];
  if (!gen) throw new Error(`no shape generator "${s.shape!.by}": add one to GENERATORS in tools/art3d/page/shapes.ts`);
  const names = Object.keys(s.roles);
  const role = (n: string) => {
    const i = names.indexOf(n);
    if (i < 0) throw new Error(`${s.shape!.by}: no role "${n}" in sprite.json`);
    return i;
  };
  const clips: Record<string, { r: Traced[]; l: Traced[] }> = {};
  for (const [name, c] of Object.entries(s.clips)) {
    if (only && !only.includes(name)) continue;
    const div = c.loop ? c.frames : Math.max(1, c.frames - 1);
    const frames = (facing: 'r' | 'l') => Array.from({ length: c.frames }, (_, i) => gen(s, name, c, i / div, i, facing, role));
    clips[name] = { r: frames('r'), l: frames('l') };
  }
  return { clips, roles: names };
}
