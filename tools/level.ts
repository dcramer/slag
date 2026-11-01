/**
 * Level inspector (no browser).
 *
 *   npm run level -- <seed>          ASCII map + stats
 *   npm run level -- --stats 200     generation stats over N seeds
 *
 * Legend: # solid  = one-way  S spawn  G goal  · reachable stand cell  P set-piece footprint
 */
import { parseSeed } from '../src/core/rng';
import { generateLevel } from '../src/gen/level';
import { T_ONEWAY, T_SOLID } from '../src/sim/level';
import { footprintCells } from '../src/sim/props';
import { analyzeReach } from '../src/sim/reach';

const args = process.argv.slice(2);
const si = args.indexOf('--stats');
if (si >= 0) {
  const n = Number(args[si + 1] ?? 100);
  const t0 = performance.now();
  const styles: Record<string, number> = {};
  const themes: Record<string, number> = {};
  let solvable = 0;
  for (let i = 0; i < n; i++) {
    const l = generateLevel((i * 2654435761) >>> 0);
    styles[l.style] = (styles[l.style] ?? 0) + 1;
    themes[l.theme.name.split(' ').pop()!] = (themes[l.theme.name.split(' ').pop()!] ?? 0) + 1;
    if (analyzeReach(l).goalReached) solvable++;
  }
  console.log({ levels: n, msPerLevel: +((performance.now() - t0) / n).toFixed(1), solvableWithoutProps: `${((solvable / n) * 100).toFixed(0)}%`, styles });
} else {
  const seedArg = args[0] ?? 'demo';
  const t0 = performance.now();
  const l = generateLevel(parseSeed(seedArg));
  const ms = performance.now() - t0;
  const reach = analyzeReach(l, false);
  const pieces = new Set(l.setPieces.flatMap((p) => footprintCells(p).map(([x, y]) => y * l.w + x)));
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
    ms: +ms.toFixed(1),
  });
}
