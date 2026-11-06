/**
 * Hash every sculpt the level shapes can make over a fixed sweep (theme × size × route × concept × attempt × seed),
 * one line per theme and size, for comparing a refactor of the builders or kits against its parent commit: identical
 * hashes mean identical levels, so every tuned number holds. `pnpm tsx tools/sculpt-hash.ts [seeds]`.
 */
import { createHash } from 'node:crypto';
import { deriveSeed, Rng } from '../src/core/rng';
import { setLevelDifficulty } from '../src/gen/level/difficulty';
import { setProbeGravity } from '../src/gen/level/probe';
import { rollProfile } from '../src/gen/level/profile';
import { MODES } from '../src/game/modes';
import { SCULPTORS } from '../src/gen/level/sculptors';
import { CONCEPTS, fits } from '../src/gen/stage';
import { generateTheme } from '../src/gen/theme';
import type { RouteShape, SizeClass } from '../src/sim/level';
import { THEME_IDS } from '../src/themes';

const SEEDS = Number(process.argv[2] ?? 6);
const SIZES: SizeClass[] = ['classic', 'wide', 'tall'];
const ROUTES: RouteShape[] = ['ltr', 'climb', 'descent', 'zigzag'];
const ATTEMPTS = [0, 1, 4, 6, 20, 23];

for (const themeId of THEME_IDS) {
  for (const size of SIZES) {
    const h = createHash('sha256');
    let n = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const theme = generateTheme(seed, themeId);
      for (const route of ROUTES)
        for (const tide of [false, true]) {
          const profile = rollProfile(seed, themeId, { size, route, ...(tide ? MODES.slag.profile : {}) });
          if (profile.size !== size || profile.route !== route) continue;
          setProbeGravity(profile.gravity);
          setLevelDifficulty(profile.difficulty);
          const challenge = new Rng(deriveSeed(seed, `challenge:${themeId}`)).next();
          for (const concept of [undefined, ...CONCEPTS[themeId].filter((c) => fits(c, profile))])
            for (const attempt of ATTEMPTS) {
              const rng = new Rng(deriveSeed(seed, `level:${attempt}`));
              const s = SCULPTORS[themeId]({ rng, themeId, theme, attempt, profile, challenge, ...(concept ? { concept } : {}) });
              // A sculpt that couldn't raise its landmark, or lay out its chain, is rejected whatever else it built.
              if ((concept && !s.landmark) || s.style.endsWith(':broken')) {
                h.update('unclaimed');
                n++;
                continue;
              }
              h.update(
                JSON.stringify([
                  Array.from(s.tiles),
                  s.ground ? Array.from(s.ground) : null,
                  s.spawn,
                  s.goal,
                  s.protectedRects,
                  s.style,
                  s.bridgeHints,
                  s.wantsProps,
                  s.crossings,
                  s.carve,
                  s.landmark,
                  rng.next(),
                ]),
              );
              n++;
            }
        }
    }
    console.log(`${themeId.padEnd(9)} ${size.padEnd(8)} ${String(n).padStart(5)} ${h.digest('hex').slice(0, 16)}`);
  }
}
