import { describe, expect, it } from 'vitest';
import { GRAVITY, generateLevel, gravityClass, lastGenInfo, rollProfile, withBridges } from '../src/gen/level';
import { Match } from '../src/game/match';
import { overview, viewToWorld, worldToView } from '../src/game/view';
import { TILE, VIEW_H, VIEW_W } from '../src/sim/constants';
import type { SizeClass } from '../src/sim/level';
import { jumpMetrics } from '../src/sim/physics';
import { analyzeReach } from '../src/sim/reach';
import { NO_INPUT } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';
import { expectSizedLevel } from './lib/level-checks';

const seedAt = (i: number) => (i * 2654435761 + 777) >>> 0;

describe('level profiles', () => {
  const profiles = THEME_IDS.flatMap((t) => Array.from({ length: 60 }, (_, i) => ({ t, p: rollProfile(seedAt(i), t) })));

  it('are deterministic per seed and theme', () => {
    for (const { t } of profiles.slice(0, 40)) expect(rollProfile(seedAt(3), t)).toEqual(rollProfile(seedAt(3), t));
  });

  it('vary: sizes, aspect, density, hazards, routes, gravity', () => {
    const count = <T>(f: (p: (typeof profiles)[number]['p']) => T) => {
      const m = new Map<T, number>();
      for (const { p } of profiles) m.set(f(p), (m.get(f(p)) ?? 0) + 1);
      return m;
    };
    const n = profiles.length;
    const sizes = count((p) => p.size);
    for (const s of ['classic', 'wide', 'tall'] as SizeClass[]) expect(sizes.get(s)! / n, s).toBeGreaterThan(0.12);
    // Aspect follows the size class.
    for (const { p } of profiles) {
      if (p.size === 'wide') expect(p.w / p.h).toBeGreaterThan(2);
      if (p.size === 'tall') expect(p.h).toBeGreaterThan(p.w);
      // Every size fits the pick/place overview at a readable zoom.
      expect(Math.min(VIEW_W / (p.w * TILE), VIEW_H / (p.h * TILE))).toBeGreaterThanOrEqual(0.44);
    }
    expect(new Set(profiles.map(({ p }) => p.w)).size).toBeGreaterThan(10);
    expect(new Set(profiles.map(({ p }) => p.h)).size).toBeGreaterThan(10);
    expect(profiles.filter(({ p }) => p.density < 0.3).length / n).toBeGreaterThan(0.15);
    expect(profiles.filter(({ p }) => p.density > 0.7).length / n).toBeGreaterThan(0.15);
    expect(count((p) => p.hazards).size).toBe(5);
    expect(count((p) => p.route).size).toBe(4);
    const g = count((p) => gravityClass(p.gravity));
    expect(g.get('normal')! / n).toBeGreaterThan(0.55);
    expect(g.get('low')! / n).toBeGreaterThan(0.05);
    expect(g.get('high')! / n).toBeGreaterThan(0.05);
  });

  it('keep theme shape language: farms, harbors and space sprawl, never tower', () => {
    for (const { t, p } of profiles) if (t === 'farm' || t === 'harbor' || t === 'space') expect(p.size).not.toBe('tall');
  });
});

describe('levels of every size class', () => {
  const cases = [
    ...THEME_IDS.filter((t) => t !== 'farm' && t !== 'harbor' && t !== 'space').map((t) => ({ t, size: 'tall' as SizeClass })),
    ...THEME_IDS.map((t) => ({ t, size: 'wide' as SizeClass })),
  ];
  it('generate valid, policy-solvable levels with zero fallbacks (real analyzeReach)', { timeout: 120_000 }, () => {
    for (const { t, size } of cases) expectSizedLevel(t, size, seedAt(40));
  });

  it('tall routes really climb (or descend) most of the height', { timeout: 120_000 }, () => {
    for (const t of ['castle', 'mine', 'jungle', 'factory', 'rooftops', 'volcano'] as const) {
      for (const route of ['climb', 'descent'] as const) {
        const l = generateLevel(seedAt(7), t, { size: 'tall', route });
        const dy = l.spawn.ty - l.goal.ty; // > 0: goal above spawn
        if (route === 'climb') expect(dy, `${t} climb`).toBeGreaterThan(l.h * 0.4);
        else expect(dy, `${t} descent`).toBeLessThan(-l.h * 0.4);
      }
    }
  });
});

describe('gravity world setting', () => {
  it('low gravity jumps higher and longer, high gravity lower and shorter', () => {
    const lo = jumpMetrics(GRAVITY.low);
    const mid = jumpMetrics(GRAVITY.normal);
    const hi = jumpMetrics(GRAVITY.high);
    expect(lo.jumpHeight).toBeGreaterThan(mid.jumpHeight * 1.25);
    expect(hi.jumpHeight).toBeLessThan(mid.jumpHeight * 0.85);
    expect(lo.jumpDistance).toBeGreaterThan(mid.jumpDistance);
    expect(hi.jumpDistance).toBeLessThan(mid.jumpDistance);
  });

  it('levels are generated and validated at their gravity, deterministically', { timeout: 120_000 }, () => {
    for (const cls of ['low', 'normal', 'high'] as const) {
      for (const t of ['farm', 'castle', 'rooftops'] as const) {
        const seed = seedAt(11);
        const a = generateLevel(seed, t, { gravity: GRAVITY[cls], size: 'classic' });
        const info = { ...lastGenInfo };
        const b = generateLevel(seed, t, { gravity: GRAVITY[cls], size: 'classic' });
        expect(Array.from(b.tiles)).toEqual(Array.from(a.tiles));
        expect(a.gravity).toBe(GRAVITY[cls]);
        expect(info.fallback, `${t} ${cls}`).toBe(false);
        expect(analyzeReach(info.bridges.length ? withBridges(a, info.bridges) : a).goalReached).toBe(true);
      }
    }
  });

  it('the gravity rule regenerates the lobby level at that gravity', () => {
    const m = new Match(4242);
    m.setRules({ ...m.rules, gravity: 'high' });
    expect(m.level.gravity).toBe(GRAVITY.high);
    m.setRules({ ...m.rules, gravity: 'low' });
    expect(m.level.gravity).toBe(GRAVITY.low);
  });
});

describe('world/view mapping', () => {
  it('classic levels map 1:1; any level fits the overview', () => {
    const classic = generateLevel(1, 'farm', { size: 'classic' });
    expect(overview(classic)).toEqual({ cx: VIEW_W / 2, cy: VIEW_H / 2, zoom: 1 });
    for (const size of ['wide', 'tall'] as const) {
      const l = generateLevel(seedAt(2), 'castle', { size });
      const v = overview(l);
      const a = worldToView(v, 0, 0);
      const b = worldToView(v, l.w * TILE, l.h * TILE);
      expect(a.x).toBeGreaterThanOrEqual(-1e-6);
      expect(a.y).toBeGreaterThanOrEqual(-1e-6);
      expect(b.x).toBeLessThanOrEqual(VIEW_W + 1e-6);
      expect(b.y).toBeLessThanOrEqual(VIEW_H + 1e-6);
      const w = viewToWorld(v, 123, 45);
      const back = worldToView(v, w.x, w.y);
      expect(back.x).toBeCloseTo(123);
      expect(back.y).toBeCloseTo(45);
    }
  });

  it('place-phase cursors live in world px (pointer mapped through the overview), clamped to the level', () => {
    const m = new Match(seedAt(5));
    m.newLevel(seedAt(5), 'castle');
    m.forceProfile = { size: 'tall' };
    m.newLevel(seedAt(5), 'castle');
    m.join('kb1');
    m.startMatch();
    m.players[0].cursor = { x: m.crate[0].rect.x + 4, y: m.crate[0].rect.y + 4 };
    for (let f = 0; f < 60 && m.phase === 'pick'; f++) m.step({ kb1: { ...NO_INPUT, confirmPressed: f === 15 } });
    expect(m.phase).toBe('place');
    const v = overview(m.level);
    // Point at the view centre: the cursor lands at the level centre.
    m.step({ kb1: { ...NO_INPUT, pointer: { x: VIEW_W / 2, y: VIEW_H / 2 } } });
    expect(m.players[0].cursor.x).toBeCloseTo(v.cx);
    expect(m.players[0].cursor.y).toBeCloseTo(v.cy);
    expect(m.cursorScreen(m.players[0]).x).toBeCloseTo(VIEW_W / 2);
    // Pointing outside the letterboxed level clamps to its edge.
    m.step({ kb1: { ...NO_INPUT, pointer: { x: 0, y: 0 } } });
    expect(m.players[0].cursor.x).toBe(0);
    m.step({ kb1: { ...NO_INPUT, pointer: { x: VIEW_W, y: VIEW_H } } });
    expect(m.players[0].cursor.x).toBe(m.level.w * TILE - 1);
    expect(m.players[0].cursor.y).toBe(m.level.h * TILE - 1);
  });
});
