/**
 * Level inspector (no browser).
 *
 *   npm run level -- <seed> [--theme farm]     ASCII map + stats
 *   npm run level -- --stats 200 [--theme farm] per-theme generation stats over N seeds
 *
 * Legend: # solid  = one-way  S spawn  G goal  · reachable stand cell  P set-piece footprint
 *         B a bridge from the validator's solution (levels that need props)
 */
import { parseSeed } from '../src/core/rng';
import { BRIDGE_W, generateLevel, lastGenInfo } from '../src/gen/level';
import { T_ONEWAY, T_SOLID } from '../src/sim/level';
import { footprintCells } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';
import { THEME_IDS, type ThemeId } from '../src/themes';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const themeOpt = opt('theme') as ThemeId | undefined;

if (args.includes('--stats')) {
  const n = Number(opt('stats') ?? 100);
  const themes = themeOpt ? [themeOpt] : THEME_IDS;
  const rows: Record<string, unknown>[] = [];
  const total = { n: 0, ms: 0, bridged: 0, fallbacks: 0, attempts: 0 };
  for (const th of themes) {
    const styles: Record<string, number> = {};
    let ms = 0;
    let maxMs = 0;
    let one = 0;
    let two = 0;
    let fallbacks = 0;
    let attempts = 0;
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      const l = generateLevel((i * 2654435761) >>> 0, th);
      const dt = performance.now() - t0;
      ms += dt;
      maxMs = Math.max(maxMs, dt);
      const sub = l.style.split(':')[1] ?? l.style;
      styles[sub] = (styles[sub] ?? 0) + 1;
      if (lastGenInfo.fallback) fallbacks++;
      if (lastGenInfo.bridges.length === 1) one++;
      if (lastGenInfo.bridges.length === 2) two++;
      attempts += lastGenInfo.attempts;
    }
    total.n += n;
    total.ms += ms;
    total.bridged += one + two;
    total.fallbacks += fallbacks;
    total.attempts += attempts;
    rows.push({
      theme: th,
      msPerLevel: +(ms / n).toFixed(1),
      maxMs: +maxMs.toFixed(0),
      needBridges: `${(((one + two) / n) * 100).toFixed(0)}%`,
      oneBridge: one,
      twoBridges: two,
      fallbacks,
      attempts: +(attempts / n).toFixed(2),
      styles: Object.entries(styles)
        .map(([k, v]) => `${k}:${v}`)
        .join(' '),
    });
  }
  console.table(rows);
  console.log({
    levels: total.n,
    msPerLevel: +(total.ms / total.n).toFixed(1),
    needBridges: `${((total.bridged / total.n) * 100).toFixed(0)}%`,
    fallbacks: total.fallbacks,
    attempts: +(total.attempts / total.n).toFixed(2),
  });
} else {
  const seedArg = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) ?? 'demo';
  const t0 = performance.now();
  const l = generateLevel(parseSeed(seedArg), themeOpt);
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
    theme: l.theme.name,
    setPieces: l.setPieces.map((p) => p.def.name),
    goalReachableWithoutProps: reach.goalReached,
    bridgesNeeded: info.bridges.length,
    attempts: info.attempts,
    ms: +ms.toFixed(1),
  });
}
