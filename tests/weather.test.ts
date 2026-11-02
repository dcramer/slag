import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { generateLevel, MAX_BRIDGES, withBridges } from '../src/gen/level';
import { MAX_SHARED, analyzeRoutes } from '../src/gen/level/routes';
import { footingHolds, gustHolds, rollKind, rollWeather, WEATHER_WEIGHTS } from '../src/gen/level/weather';
import { generateTheme } from '../src/gen/theme';
import { Predictor } from '../src/net/predict';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { LEVEL_H, LEVEL_W, PHYS, RUN_COUNTDOWN, TILE } from '../src/sim/constants';
import type { Level } from '../src/sim/level';
import { DEFAULT_SURFACE, wallKind } from '../src/sim/physics';
import { analyzeReach, LONGEST_MOVE } from '../src/sim/reach';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { CLEAR, GUST, gustAir, gustPush, gustWarning, WEATHER, type Weather, type WeatherKind } from '../src/sim/weather';
import { THEME_IDS, type ThemeId } from '../src/themes';

const FLOOR = LEVEL_H - 4;

function arena(weather?: Weather): Level {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    seed: 1,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles,
    spawn: { tx: 2, ty: FLOOR - 1 },
    goal: { tx: LEVEL_W - 3, ty: FLOOR - 1 },
    protectedRects: [],
    theme: generateTheme(1, 'farm'),
    style: 'test',
    version: 0,
    setPieces: [],
    weather,
  };
}

const WIND: Weather = { kind: 'wind', dir: 1, period: 500, first: 200 };
const firstPush = WIND.first + GUST.warn;
const input = (o: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...o });

/** A one-runner race on `level`, at tile `tx` on the floor, stepped up to race frame `f`. */
function raceAt(level: Level, tx: number, f = 0): RunWorld {
  const run = new RunWorld(level, [], [0]);
  run.runners[0].body.x = tx * TILE;
  run.frame = f;
  return run;
}

describe('gust clock', () => {
  it('is a pure function of the frame', () => {
    for (let f = 0; f < 2000; f++) {
      expect(gustPush(WIND, f)).toBe(gustPush({ ...WIND }, f));
      expect(gustWarning(WIND, f)).toBe(gustWarning({ ...WIND }, f));
    }
  });

  it('never blows in clear air, mist, rain or snow', () => {
    for (const kind of ['clear', 'mist', 'rain', 'snow'] as const) {
      for (let f = 0; f < 2000; f += 7) expect(gustPush({ ...CLEAR, kind }, f)).toBe(0);
    }
    expect(gustPush(undefined, 500)).toBe(0);
  });

  it('warns for the full warning time before every gust pushes', () => {
    let warned = 0;
    let gusts = 0;
    for (let f = 1; f < 5000; f++) {
      const w = gustWarning(WIND, f);
      if (w > 0) {
        warned++;
        expect(gustPush(WIND, f), `warning at ${f}`).toBe(0);
      } else if (gustWarning(WIND, f - 1) > 0) warned = 0;
      if (gustPush(WIND, f) > 0 && gustPush(WIND, f - 1) === 0) {
        gusts++;
        for (let k = 1; k <= GUST.warn; k++) expect(gustWarning(WIND, f - k), `${k} frames before the gust at ${f}`).toBeGreaterThan(0);
      }
    }
    expect(warned).toBe(0);
    expect(gusts).toBeGreaterThan(5);
  });

  it('starts well after the countdown', () => {
    expect(GUST.first[0]).toBeGreaterThan(RUN_COUNTDOWN);
    for (let f = 0; f <= RUN_COUNTDOWN; f++) expect(gustWarning({ ...WIND, first: GUST.first[0] }, f)).toBe(0);
  });

  it('leaves room between gusts for the longest move the solvability proof uses', () => {
    const calm = GUST.period[0] - (GUST.rise + GUST.hold + GUST.fall);
    expect(calm).toBeGreaterThan(LONGEST_MOVE);
    // Measured, not added up: count the still frames between two gusts of the shortest cycle.
    const w = { ...WIND, period: GUST.period[0] };
    let run = 0;
    let best = 0;
    for (let f = w.first + w.period; f < w.first + 2 * w.period + GUST.warn; f++) {
      run = gustPush(w, f) === 0 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    expect(best).toBeGreaterThan(LONGEST_MOVE);
  });

  it('stays slower than a walk, or a runner could not hold their ground', () => {
    expect(GUST.speed).toBeLessThan(PHYS.walkSpeed);
  });
});

describe('gusts in a race', () => {
  it('moves nobody through the warning, then pushes them downwind', () => {
    const run = raceAt(arena(WIND), 20, firstPush - GUST.warn);
    for (let i = 0; i < 4; i++) run.step([NO_INPUT]);
    const b = run.runners[0].body;
    const x0 = b.x;
    while (run.frame < firstPush) {
      run.step([NO_INPUT]);
      expect(b.x).toBe(x0);
    }
    for (let i = 0; i < 40; i++) run.step([NO_INPUT]);
    expect(b.x).toBeGreaterThan(x0 + 20);
    expect(b.vx).toBeCloseTo(GUST.speed, 3);
  });

  it('blows the other way on a level whose gusts head left', () => {
    const run = raceAt(arena({ ...WIND, dir: -1 }), 20, firstPush + GUST.rise);
    const x0 = run.runners[0].body.x;
    for (let i = 0; i < 40; i++) run.step([NO_INPUT]);
    expect(run.runners[0].body.x).toBeLessThan(x0 - 20);
  });

  it('lets a runner gain ground against the gust, and lets them hold a spot through all of it', () => {
    const into = raceAt(arena(WIND), 30, firstPush + GUST.rise);
    const b = into.runners[0].body;
    const x0 = b.x;
    for (let i = 0; i < 60; i++) into.step([input({ left: true })]);
    expect(b.x).toBeLessThan(x0 - 10);

    // Feathering the stick, the way a person stands on a ledge in a gale.
    const hold = raceAt(arena(WIND), 30, firstPush);
    const h = hold.runners[0].body;
    const home = h.x;
    let worst = 0;
    for (let i = 0; i < GUST.rise + GUST.hold + GUST.fall; i++) {
      hold.step([input({ left: h.x > home })]);
      worst = Math.max(worst, Math.abs(h.x - home));
    }
    expect(worst).toBeLessThan(TILE / 2);
  });

  it('carries projectiles with the air', () => {
    const bolt = { x: 400, y: 100, vx: 0, vy: 0, owner: -1, ammo: 'bolt' as const };
    const fly = (weather?: Weather) => {
      const run = raceAt(arena(weather), 20, firstPush + GUST.rise);
      run.spawnProjectile(bolt);
      for (let i = 0; i < 30; i++) run.step([NO_INPUT]);
      return run.projectiles[0];
    };
    const calm = fly();
    const blown = fly(WIND);
    expect(calm.x).toBe(bolt.x);
    expect(blown.x - bolt.x).toBeCloseTo(GUST.speed * 0.5, 3);
    expect(fly({ ...WIND, dir: -1 }).x - bolt.x).toBeCloseTo(-GUST.speed * 0.5, 3);
  });

  it('leaves projectiles alone during the warning', () => {
    const run = raceAt(arena(WIND), 20, WIND.first);
    run.spawnProjectile({ x: 400, y: 100, vx: 0, vy: 0, owner: -1, ammo: 'bolt' });
    for (let i = 0; i < GUST.warn - 1; i++) run.step([NO_INPUT]);
    expect(run.projectiles[0].x).toBe(400);
  });

  it('reports the air the sim blows with', () => {
    const lv = arena(WIND);
    expect(gustAir(lv, firstPush - 1)).toBe(0);
    expect(gustAir(lv, firstPush + GUST.rise + 5)).toBe(GUST.speed);
    expect(gustAir(arena({ ...WIND, dir: -1 }), firstPush + GUST.rise + 5)).toBe(-GUST.speed);
  });
});

describe('footing', () => {
  /** Px a runner slides after a flat-out run, and their speed at the end of the run. */
  function skid(weather?: Weather) {
    const run = raceAt(arena(weather), 4, RUN_COUNTDOWN);
    const b = run.runners[0].body;
    for (let i = 0; i < 90; i++) run.step([input({ right: true, run: true })]);
    const top = b.vx;
    const x = b.x;
    for (let i = 0; i < 90 && b.vx > 0; i++) run.step([NO_INPUT]);
    return { top, slide: b.x - x };
  }
  const RAIN: Weather = { ...CLEAR, kind: 'rain' };
  const SNOW: Weather = { ...CLEAR, kind: 'snow' };

  it('rain keeps your speed and takes your brakes', () => {
    const dry = skid();
    const wet = skid(RAIN);
    expect(wet.top).toBeCloseTo(dry.top, 3);
    expect(wet.slide).toBeGreaterThan(dry.slide * 1.8);
  });

  it('snow slows you down', () => {
    expect(skid(SNOW).top).toBeLessThan(skid().top * 0.9);
  });

  it('goes through the Surface every body already has', () => {
    const run = raceAt(arena(RAIN), 10, RUN_COUNTDOWN);
    run.step([NO_INPUT]);
    expect(run.runners[0].body.surface).toEqual(WEATHER.rain.surface);
    const dry = raceAt(arena(), 10, RUN_COUNTDOWN);
    dry.step([NO_INPUT]);
    expect(dry.runners[0].body.surface).toEqual(DEFAULT_SURFACE);
  });

  it('never takes a wall jump away', () => {
    for (const kind of ['rain', 'snow'] as const) expect(wallKind(WEATHER[kind].surface!)).toBe('normal');
  });

  it('is the ground the solvability ghost walks on', () => {
    // A step that takes a full jump. Footing this heavy isn't one we ship: it only shows the ghost feels what the runner feels.
    const lv = arena();
    for (let y = FLOOR - 3; y < FLOOR; y++) for (let x = 20; x < LEVEL_W; x++) lv.tiles[y * LEVEL_W + x] = 1;
    const step = { ...lv, goal: { tx: LEVEL_W - 3, ty: FLOOR - 4 } };
    expect(analyzeReach(step).goalReached).toBe(true);
    const shipped = WEATHER.snow.surface;
    WEATHER.snow.surface = { ...DEFAULT_SURFACE, jumpMult: 0.4, wall: 'slick' };
    try {
      expect(analyzeReach({ ...step, weather: SNOW }).goalReached).toBe(false);
    } finally {
      WEATHER.snow.surface = shipped;
    }
  });
});

/** Two ledges with a pit of `gap` tiles between them, floor all the way down: the goal is across it. */
function gapLevel(gap: number, solution?: { x: number; y: number }[]): Level {
  const lv = arena();
  const a = 18;
  for (let y = FLOOR; y < LEVEL_H; y++) for (let x = a; x < a + gap; x++) lv.tiles[y * LEVEL_W + x] = 0;
  return { ...lv, solution };
}

describe('mist', () => {
  it('has nothing in the sim to change', () => {
    expect(WEATHER.mist).toEqual({});
    const walk = (weather?: Weather) => {
      const run = raceAt(arena(weather), 5, RUN_COUNTDOWN);
      for (let i = 0; i < 400; i++) run.step([input({ right: i % 3 !== 0, run: true, jump: i % 40 < 12, jumpPressed: i % 40 === 0 })]);
      return run.runners[0].body;
    };
    expect(walk({ ...CLEAR, kind: 'mist' })).toEqual(walk());
  });
});

describe('solvability under weather', () => {
  /** Seeds that roll `kind` on `theme`. The kind roll is cheap, so tests don't generate levels hunting for one. */
  function seedsFor(kind: WeatherKind, theme: ThemeId, n: number): number[] {
    const out: number[] = [];
    for (let s = 1; out.length < n; s++) if (rollKind(s, theme) === kind) out.push(s);
    return out;
  }

  it('keeps every part a tailwind would otherwise replace', () => {
    // The widest gap the ghost clears in calm air, and the widest a tailwind adds.
    let calm = 4;
    while (analyzeReach(gapLevel(calm + 1)).goalReached) calm++;
    const gap = calm + 1;
    expect(analyzeReach(gapLevel(gap), true, undefined, [0, GUST.speed]).goalReached, 'a tailwind has to reach further for this test to mean anything').toBe(
      true,
    );
    const lv = gapLevel(gap, [{ x: 18 + 2, y: FLOOR }]);
    expect(gustHolds(lv, GUST.speed)).toBe(false);
    expect(gustHolds(lv, -GUST.speed)).toBe(true);
  });

  it('turns a tailwind that would do a part’s job into a headwind', () => {
    let calm = 4;
    while (analyzeReach(gapLevel(calm + 1)).goalReached) calm++;
    const lv = gapLevel(calm + 1, [{ x: 18 + 2, y: FLOOR }]);
    for (let seed = 1; seed < 400; seed++) {
      if (rollKind(seed, 'rooftops') !== 'wind') continue;
      const w = rollWeather(seed, { ...generateTheme(seed, 'rooftops'), ambient: 'dust' }, lv);
      expect(w).toMatchObject({ kind: 'wind', dir: -1 });
    }
  });

  it('leaves the terrain and the part count exactly as they were', () => {
    for (const seed of [11, 12]) {
      const plain = generateLevel(seed, 'farm', { weather: 'clear' });
      for (const weather of ['wind', 'rain', 'mist'] as const) {
        const l = generateLevel(seed, 'farm', { weather });
        expect(l.weather?.kind).toBe(weather);
        expect(l.tiles).toEqual(plain.tiles);
        expect(l.solution).toEqual(plain.solution);
      }
    }
  });

  it('rain and snow only land where the real controller still proves the solution', () => {
    for (const kind of ['rain', 'snow'] as const) {
      for (const seed of seedsFor(kind, kind === 'rain' ? 'jungle' : 'castle', 3)) {
        const l = generateLevel(seed, kind === 'rain' ? 'jungle' : 'castle');
        if (l.weather!.kind === 'clear') continue;
        expect(l.weather!.kind).toBe(kind);
        expect(analyzeReach(withBridges(l, l.solution ?? [])).goalReached, `seed ${seed}`).toBe(true);
        if (l.solution?.length) expect(analyzeReach(l).goalReached, `seed ${seed} bare`).toBe(false);
        expect(analyzeRoutes(l, l.solution).shared).toBeLessThanOrEqual(MAX_SHARED);
        expect(footingHolds(l, l.weather!)).toBe(true);
      }
    }
  });

  it('wind only lands where a gust does no part’s job', () => {
    for (const seed of seedsFor('wind', 'harbor', 4)) {
      const l = generateLevel(seed, 'harbor');
      if (l.theme.ambient === 'rain') continue;
      expect(l.weather!.kind).toBe('wind');
      expect(l.solution!.length).toBeLessThanOrEqual(MAX_BRIDGES);
      if (l.solution?.length) expect(analyzeReach(l, true, undefined, [0, l.weather!.dir * GUST.speed]).goalReached, `seed ${seed}`).toBe(false);
      // Calm air is still the proof: every gust ends, and the solution stands in the lull.
      expect(analyzeReach(withBridges(l, l.solution ?? [])).goalReached, `seed ${seed}`).toBe(true);
    }
  });

  it('is deterministic from the seed', () => {
    for (const theme of ['rooftops', 'harbor'] as const) {
      for (const seed of seedsFor('wind', theme, 2)) expect(generateLevel(seed, theme).weather).toEqual(generateLevel(seed, theme).weather);
    }
  });
});

describe('weather weights', () => {
  it('rolls each theme to its weights, and mostly clear', () => {
    const N = 6000;
    for (const theme of THEME_IDS) {
      const seen: Record<string, number> = {};
      for (let s = 0; s < N; s++) {
        const k = rollKind((s * 2654435761) >>> 0, theme);
        seen[k] = (seen[k] ?? 0) + 1;
      }
      const total = WEATHER_WEIGHTS[theme].reduce((a, [, w]) => a + w, 0);
      for (const [kind, w] of WEATHER_WEIGHTS[theme]) expect(Math.abs((seen[kind] ?? 0) / N - w / total), `${theme} ${kind}`).toBeLessThan(0.02);
      expect((seen.clear ?? 0) / N, theme).toBeGreaterThan(0.55);
    }
  });

  it('keeps rain and snow out of the sky over lava and underground', () => {
    for (const theme of ['volcano', 'mine', 'factory'] as const) {
      const kinds = WEATHER_WEIGHTS[theme].map(([k]) => k);
      expect(kinds).not.toContain('rain');
      expect(kinds).not.toContain('snow');
    }
    expect(WEATHER_WEIGHTS.mine.map(([k]) => k)).not.toContain('wind');
  });

  it('gives different themes different skies', () => {
    expect(new Set(THEME_IDS.map((t) => JSON.stringify(WEATHER_WEIGHTS[t]))).size).toBe(THEME_IDS.length);
  });
});

describe('weather across the wire', () => {
  function race(weather: WeatherKind): Match {
    const m = new Match(4242);
    m.forceProfile = { weather };
    m.newLevel(m.seed);
    m.join('a:kb1');
    m.join('b:kb1');
    m.startMatch();
    m.startRun();
    return m;
  }
  const inputs = (f: number): Record<string, InputFrame> => ({
    'a:kb1': input({ right: true, run: true, jump: f % 30 < 12, jumpPressed: f % 30 === 0 }),
    'b:kb1': input({ left: f % 90 < 45, right: f % 90 >= 45 }),
  });

  it('two matches with the same inputs agree, frame for frame, through gusts', () => {
    const a = race('wind');
    const b = race('wind');
    for (let f = 0; f < 700; f++) {
      a.step(inputs(f));
      b.step(inputs(f));
    }
    expect(a.level.weather?.kind).toBe('wind');
    expect(hashMatch(a)).toBe(hashMatch(b));
  }, 30_000);

  it('round-trips a race caught mid-gust and runs on identically', () => {
    const a = race('wind');
    const w = a.level.weather!;
    for (let f = 0; f < w.first + GUST.warn + 30; f++) a.step(inputs(f));
    expect(gustPush(w, a.run!.frame)).toBeGreaterThan(0);
    const snap = JSON.parse(JSON.stringify(snapshotMatch(a)));
    expect(snap.level.weather).toEqual(w);
    const b = new Match(1);
    restoreMatch(b, snap);
    expect(b.level.weather).toEqual(w);
    expect(hashMatch(b)).toBe(hashMatch(a));
    for (let f = 0; f < 240; f++) {
      a.step(inputs(f));
      b.step(inputs(f));
    }
    expect(hashMatch(b)).toBe(hashMatch(a));
  }, 30_000);

  it('round-trips footing, and a runner’s surface with it', () => {
    const a = race('snow');
    for (let f = 0; f < 200; f++) a.step(inputs(f));
    const b = new Match(1);
    restoreMatch(b, JSON.parse(JSON.stringify(snapshotMatch(a))));
    expect(b.run!.world.tileSurface).toEqual(WEATHER.snow.surface);
    for (let f = 0; f < 120; f++) {
      a.step(inputs(f));
      b.step(inputs(f));
    }
    expect(hashMatch(b)).toBe(hashMatch(a));
  }, 30_000);

  it('shows up in the hash, so peers who disagree find out', () => {
    const a = new Match(4242);
    const before = hashMatch(a);
    a.level.weather = { ...CLEAR, kind: 'mist' };
    expect(hashMatch(a)).not.toBe(before);
  });

  it('a predicted race walks on the same footing and gravity as the confirmed one', () => {
    const a = race('rain');
    a.level.gravity = 0.7;
    a.run!.world.gravity = 0.7;
    for (let f = 0; f < 150; f++) a.step(inputs(f));
    const copy = new Predictor().copy(a);
    for (let f = 150; f < 200; f++) {
      copy.step(inputs(f));
      a.step(inputs(f));
    }
    expect(JSON.stringify(snapshotMatch(copy).run)).toBe(JSON.stringify(snapshotMatch(a).run));
  }, 30_000);
});
