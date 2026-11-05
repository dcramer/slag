/**
 * Level inspector (no browser).
 *
 *   npm run level -- <seed> [--theme farm]     ASCII map + stats (incl. the level profile)
 *   npm run level -- --stats 200 [--theme farm] per-theme generation stats over N seeds,
 *                                               then per size class / gravity class / route
 *   Force profile knobs on either: --size classic|wide|tall --route ltr|climb|descent|zigzag
 *                                  --density 0..1 --gravity 0.7 --hazards 0..4 --weather rain
 *                                  --concept <id>|plain (a stage concept of the theme's, gen/stage)
 *                                  --difficulty gentle|medium|hard
 *                                  --tide (a Rising Slag tower: game/modes.ts)
 *
 * Legend: # solid  = one-way  S spawn  G goal  · reachable stand cell  P set-piece footprint
 *         B a bridge from the validator's solution (levels that need props)
 */
import { deriveSeed, parseSeed, Rng } from '../src/core/rng';
import { argReader } from './lib/server';
import { SCULPTORS } from '../src/gen/level/sculptors';
import { BRIDGE_W, DIFFICULTIES, describeProfile, generateLevel, gravityClass, judge, lastGenInfo, type ProfileOverride } from '../src/gen/level';
import { MAX_SHARED } from '../src/gen/level/routes';
import type { RouteShape, SizeClass } from '../src/sim/level';
import { T_ONEWAY, T_SOLID } from '../src/sim/level';
import { footprintCells } from '../src/sim/props';
import type { WeatherKind } from '../src/sim/weather';
import { analyzeReach } from '../src/sim/reach';
import { THEME_IDS, type ThemeId } from '../src/themes';

const args = process.argv.slice(2);
const { opt, flag } = argReader(args);
const themeOpt = opt('theme') as ThemeId | undefined;
const force: ProfileOverride = {};
if (opt('size')) force.size = opt('size') as SizeClass;
if (opt('route')) force.route = opt('route') as RouteShape;
if (opt('density')) force.density = Number(opt('density'));
if (opt('gravity')) force.gravity = Number(opt('gravity'));
if (opt('hazards')) force.hazards = Number(opt('hazards'));
if (opt('weather')) force.weather = opt('weather') as WeatherKind;
if (opt('concept')) force.concept = opt('concept');
const difficulty = DIFFICULTIES.find((d) => d === opt('difficulty'));
if (difficulty) force.difficulty = difficulty;
if (flag('tide')) force.tide = true;

/** Share of levels whose solution takes 0, 1, 2 and 3 parts. */
function partShares(parts: number[], n: number): Record<string, string> {
  return Object.fromEntries(parts.map((c, i) => [`parts${i}`, `${((c / n) * 100).toFixed(0)}%`]));
}

interface Agg {
  n: number;
  ms: number;
  maxMs: number;
  bridged: number;
  fallbacks: number;
  attempts: number;
  pieces: number;
  solid: number;
}
const groups = new Map<string, Agg>();
function addTo(key: string, ms: number, bridged: boolean, fallback: boolean, attempts: number, pieces: number, solid: number) {
  const a = groups.get(key) ?? { n: 0, ms: 0, maxMs: 0, bridged: 0, fallbacks: 0, attempts: 0, pieces: 0, solid: 0 };
  a.n++;
  a.ms += ms;
  a.maxMs = Math.max(a.maxMs, ms);
  if (bridged) a.bridged++;
  if (fallback) a.fallbacks++;
  a.attempts += attempts;
  a.pieces += pieces;
  a.solid += solid;
  groups.set(key, a);
}

if (flag('stats')) {
  const n = Number(opt('stats') ?? 100);
  const themes = themeOpt ? [themeOpt] : THEME_IDS;
  const rows: Record<string, unknown>[] = [];
  const total = { n: 0, ms: 0, bridged: 0, fallbacks: 0, attempts: 0, closed: 0, openAsSculpted: 0, conceptFallbacks: 0, parts: [0, 0, 0, 0] };
  const weather: Record<string, number> = {};
  const times: number[] = [];
  // CPU time is steadier than wall time on a shared machine; both are reported.
  const cpu0 = process.cpuUsage();
  for (const th of themes) {
    const styles: Record<string, number> = {};
    let ms = 0;
    let maxMs = 0;
    const parts = [0, 0, 0, 0];
    let fallbacks = 0;
    let attempts = 0;
    let closed = 0;
    let openAsSculpted = 0;
    const concepts: Record<string, number> = {};
    let conceptFallbacks = 0;
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      const l = generateLevel((i * 2654435761) >>> 0, th, force);
      const dt = performance.now() - t0;
      const p = l.profile!;
      const sky = l.weather?.kind ?? 'clear';
      weather[sky] = (weather[sky] ?? 0) + 1;
      const solid = l.tiles.reduce((a, t) => a + (t ? 1 : 0), 0) / l.tiles.length;
      const info = lastGenInfo;
      for (const key of [
        `difficulty:${p.difficulty}`,
        `size:${p.size}`,
        `gravity:${gravityClass(p.gravity)}`,
        `route:${p.route}`,
        `hazards:${l.setPieces.length}`,
      ])
        addTo(key, dt, info.bridges.length > 0, info.fallback, info.attempts, l.setPieces.length, solid);
      ms += dt;
      times.push(dt);
      maxMs = Math.max(maxMs, dt);
      const sub = l.style.split(':')[1] ?? l.style;
      styles[sub] = (styles[sub] ?? 0) + 1;
      if (lastGenInfo.fallback) fallbacks++;
      parts[lastGenInfo.bridges.length]++;
      attempts += lastGenInfo.attempts;
      closed += lastGenInfo.rejects.closed;
      if (lastGenInfo.sculpted <= MAX_SHARED) openAsSculpted++;
      const c = lastGenInfo.concept ?? 'plain';
      concepts[c] = (concepts[c] ?? 0) + 1;
      if (lastGenInfo.conceptFallback) conceptFallbacks++;
    }
    total.conceptFallbacks += conceptFallbacks;
    total.n += n;
    total.ms += ms;
    total.bridged += n - parts[0];
    parts.forEach((c, i) => (total.parts[i] += c));
    total.fallbacks += fallbacks;
    total.attempts += attempts;
    total.closed += closed;
    total.openAsSculpted += openAsSculpted;
    rows.push({
      theme: th,
      msPerLevel: +(ms / n).toFixed(1),
      maxMs: +maxMs.toFixed(0),
      needParts: `${(((n - parts[0]) / n) * 100).toFixed(0)}%`,
      ...partShares(parts, n),
      fallbacks,
      attempts: +(attempts / n).toFixed(2),
      openAsSculpted: `${((openAsSculpted / n) * 100).toFixed(0)}%`,
      closedRejects: closed,
      styles: Object.entries(styles)
        .map(([k, v]) => `${k}:${v}`)
        .join(' '),
      // Stage concepts (gen/stage): levels per concept, and how many rolled one but fell back to plain.
      concepts: Object.entries(concepts)
        .map(([k, v]) => `${k}:${v}`)
        .join(' '),
      conceptFallbacks,
    });
  }
  console.table(rows);
  console.table(
    [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, a]) => ({
        group: k,
        levels: a.n,
        msPerLevel: +(a.ms / a.n).toFixed(1),
        maxMs: +a.maxMs.toFixed(0),
        needBridges: `${((a.bridged / a.n) * 100).toFixed(0)}%`,
        fallbacks: a.fallbacks,
        attempts: +(a.attempts / a.n).toFixed(2),
        setPieces: +(a.pieces / a.n).toFixed(2),
        solidShare: +(a.solid / a.n).toFixed(2),
      })),
  );
  const cpu = process.cpuUsage(cpu0);
  console.log({
    levels: total.n,
    msPerLevel: +(total.ms / total.n).toFixed(1),
    cpuMsPerLevel: +((cpu.user + cpu.system) / 1000 / total.n).toFixed(1),
    p95Ms: +times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)].toFixed(0),
    needParts: `${((total.bridged / total.n) * 100).toFixed(1)}%`,
    ...partShares(total.parts, total.n),
    weather: Object.entries(weather)
      .map(([k, v]) => `${k} ${((v / total.n) * 100).toFixed(0)}%`)
      .join(', '),
    fallbacks: total.fallbacks,
    attempts: +(total.attempts / total.n).toFixed(2),
    // Mostly-open rule: levels already open as sculpted, and candidates still too narrow after lanes.
    openAsSculpted: `${((total.openAsSculpted / total.n) * 100).toFixed(0)}%`,
    closedRejects: `${total.closed} of ${total.attempts} candidates (${((total.closed / total.attempts) * 100).toFixed(1)}%)`,
    conceptFallbacks: total.conceptFallbacks,
  });
} else {
  const seedArg = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'demo';
  const t0 = performance.now();
  const seedNum = /^\d+$/.test(seedArg) ? Number(seedArg) >>> 0 : parseSeed(seedArg);
  let l = generateLevel(seedNum, themeOpt, force);
  const rawAttempt = opt('raw');
  if (rawAttempt !== undefined) {
    // Debug a sculptor: show attempt N's raw shape (before validation) instead of the accepted level.
    const themeId = l.theme.id;
    const rng = new Rng(deriveSeed(seedNum, `level:${rawAttempt}`));
    const challenge = new Rng(deriveSeed(seedNum, `challenge:${themeId}`)).next();
    const shape = SCULPTORS[themeId]({ rng, themeId, theme: l.theme, attempt: Number(rawAttempt), profile: l.profile!, challenge });
    l = { ...l, tiles: shape.tiles, spawn: shape.spawn, goal: shape.goal, protectedRects: shape.protectedRects, style: shape.style, setPieces: [] };
    console.log('raw attempt', rawAttempt, 'judge:', judge(l, shape.bridgeHints));
  }
  const ms = performance.now() - t0;
  const info = lastGenInfo;
  const reach = analyzeReach(l, false);
  const pieces = new Set(l.setPieces.flatMap((p) => footprintCells(p).map(([x, y]) => y * l.w + x)));
  const bridges = new Set(info.bridges.flatMap((b) => Array.from({ length: BRIDGE_W }, (_, i) => b.y * l.w + b.x + i)));
  let out = '';
  for (let y = 0; y < l.h; y++) {
    for (let x = 0; x < l.w; x++) {
      const k = y * l.w + x;
      const t = l.tiles[k];
      out +=
        l.spawn.tx === x && l.spawn.ty === y
          ? 'S'
          : l.goal.tx === x && l.goal.ty === y
            ? 'G'
            : bridges.has(k)
              ? 'B'
              : pieces.has(k)
                ? 'P'
                : t === T_SOLID
                  ? '#'
                  : t === T_ONEWAY
                    ? '='
                    : reach.reachable.has(k)
                      ? '·'
                      : ' ';
    }
    out += '\n';
  }
  console.log(out);
  console.log({
    seed: seedArg,
    style: l.style,
    profile: describeProfile(l.profile!),
    weather: l.weather?.kind ?? 'clear',
    theme: l.theme.name,
    concept: info.concept ?? (info.conceptFallback ? 'plain (fell back)' : 'plain'),
    ...(l.landmark ? { landmark: l.landmark.rect } : {}),
    ...(l.rides ? { rides: l.rides.length } : {}),
    setPieces: l.setPieces.map((p) => p.def.name),
    goalReachableWithoutProps: reach.goalReached,
    bridgesNeeded: info.bridges.length,
    attempts: info.attempts,
    ...(info.landmarkFaults ? { landmarkFaults: info.landmarkFaults } : {}),
    ms: +ms.toFixed(1),
  });
}
