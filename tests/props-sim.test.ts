import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { ARCHETYPE_WEIGHTS, generateProp } from '../src/gen/props';
import { canPlace, footprintCells, type PlacedProp, resolveProp } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

describe('prop runtime', () => {
  it('every archetype, every rotation, simulates without blowing up', () => {
    // Attachments need suitable exposed faces (e.g. long ceiling undersides); try a few levels.
    const levels = [5, 6, 7, 8, 9, 10].map((s) => generateLevel(s));
    for (const [k] of ARCHETYPE_WEIGHTS) {
      if (k === 'bomb') continue;
      for (let rot = 0; rot < 4; rot++) {
        const def = generateProp(new Rng(rot + k.length * 7), k, 'x');
        let placed: PlacedProp | null = null;
        let level = levels[0];
        for (const lv of levels) {
          for (let ty = 2; ty < lv.h - 2 && !placed; ty++)
            for (let tx = 6; tx < lv.w - 6 && !placed; tx++) if (canPlace(lv, [], def, rot, tx, ty)) placed = { uid: 1, def, owner: 1, tx, ty, rot };
          if (placed) {
            level = lv;
            break;
          }
        }
        expect(placed, `${k} rot ${rot}`).not.toBeNull();
        const r = resolveProp(placed!);
        expect(r.mods.length).toBe(def.modules.length);
        // Body cells land inside the footprint.
        const fp = new Set(footprintCells(placed!).map(([x, y]) => `${x},${y}`));
        for (const m of r.mods) if (m.type === 'body') for (const [x, y] of m.cells) expect(fp.has(`${x},${y}`)).toBe(true);
        const run = new RunWorld(level, [placed!], [0, 1]);
        for (let f = 0; f < 600; f++) run.step([NO_INPUT, NO_INPUT]);
        for (const p of run.projectiles) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('a tracking crossbow aimed at a runner kills them and credits the owner', () => {
    const level = generateLevel(5);
    // Find a launcher def that tracks.
    let def = null;
    for (let i = 0; i < 500 && !def; i++) {
      const d = generateProp(new Rng(i), 'launcher', 'x');
      const m = d.modules.find((m) => m.type === 'launcher');
      if (m && m.type === 'launcher' && m.aim === 'track' && m.style === 'crossbow') def = d;
    }
    expect(def).not.toBeNull();
    // Place it on the spawn row, a few tiles right of spawn, facing left.
    const ty = level.spawn.ty - 1;
    let tx = level.spawn.tx + 6;
    while (!canPlace(level, [], def!, 2, tx, ty) && tx < level.w - 2) tx++;
    const run = new RunWorld(level, [{ uid: 1, def: def!, owner: 3, tx, ty, rot: 2 }], [0]);
    for (let f = 0; f < 60 * 10 && run.runners[0].alive; f++) run.step([NO_INPUT]);
    expect(run.runners[0].alive).toBe(false);
    expect(run.runners[0].killer).toBe(3);
  });
});
