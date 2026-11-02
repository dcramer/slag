import { describe, expect, it } from 'vitest';
import { overlaps, type Rect, rectCircle } from '../src/core/geom';
import { Rng } from '../src/core/rng';
import { generateLevel, isAcceptable } from '../src/gen/level';
import { SAFE_TILES, SET_PIECE_RECIPES, SET_PIECE_UID, SET_PIECES } from '../src/gen/setpieces';
import { RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import { isProtected, type Level, tileAt } from '../src/sim/level';
import { type Contrib, footprintCells, type Hazard, moduleSim, newPropState, resolveProp } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { THEME_IDS } from '../src/themes';
import { sample, SLOW } from './lib/tier';

const SEEDS = Array.from({ length: sample(2, 8) }, (_, i) => (i * 2654435761 + 12345) >>> 0);

function zones(level: Level): Rect[] {
  return [level.spawn, level.goal].map((c) => ({
    x: (c.tx - SAFE_TILES) * TILE,
    y: (c.ty - SAFE_TILES) * TILE,
    w: (SAFE_TILES * 2 + 1) * TILE,
    h: (SAFE_TILES * 2 + 1) * TILE,
  }));
}

function hits(h: Hazard, z: Rect): boolean {
  if (h.kind === 'rect') return overlaps(h.r, z);
  if (h.kind === 'circle') return rectCircle(z, h.x, h.y, h.r);
  for (let i = 0; i <= 20; i++) if (rectCircle(z, h.x1 + ((h.x2 - h.x1) * i) / 20, h.y1 + ((h.y2 - h.y1) * i) / 20, h.r)) return true;
  return false;
}

const levels = THEME_IDS.flatMap((theme) => SEEDS.map((seed) => ({ theme, seed, level: generateLevel(seed, theme) })));

describe('set pieces', () => {
  it('are deterministic', () => {
    for (const theme of THEME_IDS) {
      const a = generateLevel(SEEDS[1], theme);
      const b = generateLevel(SEEDS[1], theme);
      expect(JSON.stringify(a.setPieces)).toBe(JSON.stringify(b.setPieces));
    }
  });

  it('every theme places 1–3 pieces, and every recipe shows up', () => {
    for (const theme of THEME_IDS) {
      const mine = levels.filter((l) => l.theme === theme);
      for (const l of mine) expect(l.level.setPieces.length).toBeLessThanOrEqual(3);
      if (!SLOW) continue; // The rest are shares across a theme's levels: two levels can't show them.
      const withPieces = mine.filter((l) => l.level.setPieces.length > 0).length;
      expect(withPieces, theme).toBeGreaterThanOrEqual(mine.length * 0.8);
      const seen = new Set(mine.flatMap((l) => l.level.setPieces.map((p) => p.def.key.split(':')[2])));
      expect(seen.size, theme).toBeGreaterThanOrEqual(2);
    }
  });

  it.runIf(SLOW)('every recipe can be placed somewhere', () => {
    for (const theme of THEME_IDS) {
      const seen = new Set<string>();
      // Re-roll the placer on the same terrains (cheap) rather than generating more levels.
      const terrains = levels.filter((l) => l.theme === theme).map((l) => ({ ...l.level, setPieces: [] }));
      for (let k = 0; k < 6 && seen.size < SET_PIECE_RECIPES[theme].length; k++)
        for (const t of terrains) for (const p of SET_PIECES[theme](new Rng(k * 7919 + t.seed), t)) seen.add(p.def.key.split(':')[2]);
      for (const r of SET_PIECE_RECIPES[theme]) expect(seen.has(r.name), `${theme}/${r.name}`).toBe(true);
    }
  });

  it('obey placement rules: uids, owner, free unprotected cells, no overlap; level stays acceptable', () => {
    for (const { theme, seed, level } of levels) {
      expect(isAcceptable(level), `${theme} ${seed}`).toBe(true);
      const taken = new Set<number>();
      level.setPieces.forEach((p, i) => {
        expect(p.uid).toBe(SET_PIECE_UID + i);
        expect(p.owner).toBe(-1);
        for (const [x, y] of footprintCells(p)) {
          expect(x >= 0 && y >= 0 && x < level.w && y < level.h).toBe(true);
          expect(tileAt(level, x, y), `${theme} ${seed} ${p.def.name} on a tile`).toBe(0);
          expect(isProtected(level, x, y)).toBe(false);
          expect(taken.has(y * level.w + x), 'overlap').toBe(false);
          taken.add(y * level.w + x);
        }
      });
    }
  });

  it('keep every hazard and moving solid away from spawn and goal', () => {
    for (const { theme, seed, level } of levels) {
      const zs = zones(level);
      for (const pp of level.setPieces) {
        const r = resolveProp(pp);
        const state = newPropState();
        const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
        for (let f = RUN_COUNTDOWN; f < RUN_COUNTDOWN + 900; f += 2) {
          out.solids.length = 0;
          out.hazards.length = 0;
          r.mods.forEach((m, mi) => moduleSim(m.type).build?.(m, { level, frame: f, r, off: [0, 0], prev: [0, 0], state, mi, live: true }, out));
          for (const h of out.hazards) for (const z of zs) expect(hits(h, z), `${theme} ${seed} ${pp.def.name} hazard @${f}`).toBe(false);
          for (const s of out.solids) if (s.dx || s.dy) for (const z of zs) expect(overlaps(s, z), `${theme} ${seed} ${pp.def.name} solid`).toBe(false);
        }
      }
      // Projectiles, through the real sim.
      if (level.setPieces.some((p) => p.def.modules.some((m) => m.type === 'cannon'))) {
        const run = new RunWorld(level, [], []);
        for (let f = 0; f < 700; f++) {
          run.step([]);
          for (const p of run.projectiles) for (const z of zs) expect(rectCircle(z, p.x, p.y, 4), `${theme} ${seed} projectile`).toBe(false);
        }
      }
    }
  });

  it('hazards leave safe windows (no piece is lethal every frame)', () => {
    for (const { level } of levels) {
      for (const pp of level.setPieces) {
        const r = resolveProp(pp);
        const state = newPropState();
        let quiet = 0;
        let any = false;
        for (let f = RUN_COUNTDOWN; f < RUN_COUNTDOWN + 900; f++) {
          const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
          r.mods.forEach((m, mi) => moduleSim(m.type).build?.(m, { level, frame: f, r, off: [0, 0], prev: [0, 0], state, mi, live: true }, out));
          if (out.hazards.length) any = true;
          else quiet++;
        }
        if (any) expect(quiet, pp.def.name).toBeGreaterThan(60);
      }
    }
  });
});
