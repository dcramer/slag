/**
 * Level inspector (no browser).
 *
 *   pnpm level <seed> [--theme farm]     ASCII map, then what the level holds: its builder, set pieces asked and
 *                                        stood (recipe and role), recipes that found no spot or were turned down,
 *                                        boxes, the safe and near-a-hazard shares of its stand cells, its spawns and
 *                                        whether each reaches the others bare, and any promise of its builder's broken
 *   pnpm level --stats 200 [--theme farm] per-theme generation stats over N seeds (set pieces stood of those asked,
 *                                        boxes, safe share beside ms/level and fallbacks), recipes that missed a
 *                                        spot or a placement, then per size class / gravity class / route
 *   --json on either prints the numbers as one JSON object instead (the map as rows), for agents and the verifier.
 *   Force profile knobs on either: --size classic|wide|tall --route ltr|climb|descent|zigzag
 *                                  --density 0..1 --gravity 0.7 --hazards 0..4 --weather rain
 *                                  --concept <id>|plain (a stage concept of the theme's, gen/stage)
 *                                  --difficulty gentle|medium|hard
 *                                  --tide (a Rising Slag tower: game/modes.ts)
 *                                  --mode brawl (the level a mode asks for: game/modes.ts MODES)
 *
 * Legend: # solid  = one-way  S spawn  G goal  · reachable stand cell  P set-piece footprint
 *         B a bridge from the validator's solution (levels that need props)
 */
import { deriveSeed, parseSeed, Rng } from '../src/core/rng';
import { argReader } from './lib/server';
import { MODES } from '../src/game/modes';
import { SCULPTORS } from '../src/gen/level/sculptors';
import { BRIDGE_W, DIFFICULTIES, describeProfile, generateLevel, gravityClass, judge, lastGenInfo, type ProfileOverride } from '../src/gen/level';
import { inspectLevel, type LevelReport } from '../src/gen/level/inspect';
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
const json = flag('json');
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
if (flag('tide')) Object.assign(force, MODES.slag.profile);
const modeOpt = opt('mode');
if (modeOpt) {
  if (!(modeOpt in MODES)) throw new Error(`--mode ${modeOpt}: one of ${Object.keys(MODES).join(', ')}`);
  Object.assign(force, MODES[modeOpt as keyof typeof MODES].profile);
}

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
  /** Per recipe of each set: levels it was tried on, those it found a candidate spot on, those it stood on, and why candidates were turned down. */
  const recipes: Record<string, { theme: string; recipe: string; tried: number; spot: number; placed: number; refused: Record<string, number> }> = {};
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
    let asked = 0;
    let stood = 0;
    let safe = 0;
    let nearHazard = 0;
    let contractFaults = 0;
    const boxes: number[] = [];
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
      const r = inspectLevel(l, lastGenInfo);
      asked += r.setPieces.asked;
      stood += r.setPieces.placed.length;
      safe += r.measures.safe;
      nearHazard += r.measures.hazard;
      if (lastGenInfo.contractFaults) contractFaults++;
      if (r.boxes !== undefined) boxes.push(r.boxes);
      for (const t of lastGenInfo.placement?.tries ?? []) {
        const key = `${th}:${t.recipe}`;
        const rc = (recipes[key] ??= { theme: th, recipe: t.recipe, tried: 0, spot: 0, placed: 0, refused: {} });
        rc.tried++;
        if (t.offered) rc.spot++;
        if (t.placed) rc.placed++;
        for (const [why, c] of Object.entries(t.refused)) rc.refused[why] = (rc.refused[why] ?? 0) + c;
      }
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
      setPieces: `${(stood / n).toFixed(2)}/${(asked / n).toFixed(2)}`,
      boxes: boxes.length ? `${Math.min(...boxes)}/${(boxes.reduce((a, b) => a + b, 0) / boxes.length).toFixed(1)}` : '-',
      safe: `${((safe / n) * 100).toFixed(0)}%`,
      nearHazard: `${((nearHazard / n) * 100).toFixed(0)}%`,
      contractFaults,
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
  const byGroup = [...groups.entries()]
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
      }));
  const cpu = process.cpuUsage(cpu0);
  // Recipes that missed somewhere, worst first: no spot found, or spots found and nothing stood.
  const missed = Object.values(recipes)
    .filter((r) => r.placed < r.tried)
    .sort((a, b) => a.placed / a.tried - b.placed / b.tried || b.tried - a.tried)
    .map((r) => ({ ...r, refused: Object.entries(r.refused).map(([k, v]) => `${k}:${v}`).join(' ') }));
  const summary = {
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
  };
  if (json) console.log(JSON.stringify({ themes: rows, recipes: Object.values(recipes), groups: byGroup, total: summary }, null, 1));
  else {
    console.table(rows);
    if (missed.length) {
      console.log('recipes that missed (tried: levels it was tried on, spot: found a candidate, placed: stood one)');
      console.table(missed);
    }
    console.table(byGroup);
    console.log(summary);
  }
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
  const report = inspectLevel(l, info, { spawns: true });
  const head = {
    seed: seedArg,
    style: l.style,
    builder: report.builder,
    profile: describeProfile(l.profile!),
    weather: l.weather?.kind ?? 'clear',
    theme: l.theme.name,
    concept: info.concept ?? (info.conceptFallback ? 'plain (fell back)' : 'plain'),
    ...(l.landmark ? { landmark: l.landmark.rect } : {}),
    ...(l.rides ? { rides: l.rides.length } : {}),
    goalReachableWithoutProps: reach.goalReached,
    bridgesNeeded: info.bridges.length,
    attempts: info.attempts,
    ...(info.landmarkFaults ? { landmarkFaults: info.landmarkFaults } : {}),
    ...(info.contractFaults ? { contractFaults: info.contractFaults } : {}),
    ms: +ms.toFixed(1),
  };
  if (json) console.log(JSON.stringify({ ...head, ...report, map: out.trimEnd().split('\n') }, null, 1));
  else {
    console.log(out);
    console.log(head);
    console.log(holds(report));
  }
}

/** What the level holds, a line each. */
function holds(r: LevelReport): string {
  const sp = r.setPieces;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const m = r.measures;
  const lines = [
    `set pieces: ${sp.placed.length} of ${sp.asked} asked${sp.landmark ? ` (+${sp.landmark} of the landmark's)` : ''}: ${sp.placed.map((p) => `${p.recipe} (${p.role})`).join(', ') || 'none'}`,
    ...(sp.noSpot.length ? [`no spot: ${sp.noSpot.join(', ')}`] : []),
    ...(sp.refused.length
      ? [
          `turned down: ${sp.refused
            .map(
              (t) =>
                `${t.recipe} (${t.offered} spots: ${Object.entries(t.refused)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(', ')})`,
            )
            .join('; ')}`,
        ]
      : []),
    ...(r.boxes !== undefined ? [`boxes: ${r.boxes}`] : []),
    `stand cells: ${m.stands} on ${m.tiers} rows, ${pct(m.safe)} safe, ${pct(m.hazard)} near a hazard, ${pct(m.edgy)} by a drop`,
    `spawns, bare: ${(r.spawns ?? [])
      .map((c, _, all) => `(${c.tx},${c.ty}) ${all.length > 1 ? (c.others ? 'reaches the others' : 'cut off from the others') + ', ' : ''}${c.goal ? 'reaches' : 'not'} the goal`)
      .join('; ')}`,
    ...(r.faults.length ? [`breaks its builder's contract: ${r.faults.join('; ')}`] : []),
  ];
  return lines.join('\n');
}
