/**
 * Stage concepts (src/gen/stage) on a contact sheet: one landmark per row, at three phases of its movers.
 * With no concept registered for a theme, a test landmark stands in: a building raised on the level's own
 * ground with each landmark skin, and each backdrop shell behind it (`forceLandmark`).
 */
import { cycleFrames } from '../../src/sim/props';
import { type DecoKind, motionOffset, type PlacedProp, resolveProp } from '../../src/sim/props';
import type { TerrainKind } from '../../src/gen/theme';
import { CONCEPTS } from '../../src/gen/stage';
import { THEME_IDS, type ThemeId } from '../../src/themes';
import { open, opt, page, seed, sheet, snap, step, theme, type Scenarios, flag } from './ctx';

/**
 * Start a race on the loaded level and stand its runners on the great wheel's rim cars, spread round the rim: the cars
 * carry them from there. Car positions follow sim/props/modules/rotor.ts (even frames are the plain circle).
 */
async function boardRiders() {
  await page.evaluate(() => {
    const d = (window as any).slagDebug;
    d.quickStart(3);
    d.race([]);
  });
  await step(72);
  await page.evaluate(() => {
    const run = (window as any).slagDebug.match.run;
    if (run.frame & 1) (window as any).slagDebug.step(1);
    for (const r of run.resolved) {
      const m = r.mods.find((x: any) => x.type === 'rotor' && x.look === 'flywheel');
      if (!m) continue;
      const base = m.angle0 + m.dir * Math.PI * 2 * (run.frame / m.period + r.phase);
      run.runners.forEach((rn: any, i: number) => {
        const a = base + ((Math.round((i * m.count) / 3) + 1) * Math.PI * 2) / m.count;
        rn.body.x = m.hub[0] + Math.cos(a) * m.arm - rn.body.w / 2;
        rn.body.y = m.hub[1] + Math.sin(a) * m.arm - m.thick / 2 - rn.body.h - 0.5;
        rn.body.vx = rn.body.vy = 0;
      });
    }
  });
}

/** Frames between the three phases a landmark is shot at. */
const PHASES = [30, 120, 120];

/** Test landmarks for themes with no concept yet: every skin and every shell, each on a theme it suits. */
const TESTS: { theme: ThemeId; skin: TerrainKind; shell?: DecoKind }[] = [
  { theme: 'castle', skin: 'timber', shell: 'facade' },
  { theme: 'castle', skin: 'stone', shell: 'clockface' },
  { theme: 'factory', skin: 'metal', shell: 'flywheel' },
  { theme: 'harbor', skin: 'planks', shell: 'hull' },
  { theme: 'harbor', skin: 'rustplate', shell: 'gantry' },
  { theme: 'mine', skin: 'concrete', shell: 'headframe' },
  { theme: 'mine', skin: 'crystal' },
  { theme: 'rooftops', skin: 'brick', shell: 'billboard' },
  { theme: 'jungle', skin: 'carved' },
  { theme: 'volcano', skin: 'bone' },
  { theme: 'glacier', skin: 'iceblock' },
  { theme: 'space', skin: 'hull' },
];

/**
 * Raise a test landmark on the loaded level: a storeyed building on levelled ground (walls, floors with
 * stair holes, a door and windows), `Level.landmark` over it with `skin`, and `shell` behind it as a deco
 * set piece. Render-only checks use it (`landmarks`, `inkblast --skin`), so it writes the level in place.
 */
export async function forceLandmark(skin: string, shell?: string) {
  // tsx names functions through a helper that the page doesn't have.
  await page.evaluate('globalThis.__name = (f) => f');
  await page.evaluate(
    ([sk, sh]) => {
      const d = (window as any).slagDebug;
      const lv = d.match.level;
      const W = lv.w;
      const house = !sh || sh === 'facade' || sh === 'clockface' || sh === 'hull';
      const w = house ? 10 : 6;
      const h = house ? 9 : 7;
      const solid = (x: number, y: number) => lv.tiles[y * W + x] === 1;
      // Rows from `g` down to the first solid tile in a column: how deep its foundation has to go.
      const drop = (x: number, g: number) => {
        for (let y = g; y < Math.min(lv.h - 2, g + 4); y++) if (solid(x, y)) return y - g;
        return 99;
      };
      const guarded = (x: number) => lv.protectedRects.some((r: any) => x + w + 1 >= r.x && x - 1 <= r.x + r.w);
      // The site: ground that's nearly level under every column, open air above it, away from the pockets
      // and the bottom of the world, near the middle.
      let best: [number, number] | null = null;
      let bestCost = Infinity;
      for (let x = 10; x + w < W - 10; x++) {
        if (guarded(x)) continue;
        for (let g = h + 3; g < lv.h - 4; g++) {
          let cost = Math.abs(x + w / 2 - W / 2) * 0.2;
          for (let i = x; i < x + w && cost < bestCost; i++) cost += drop(i, g) * 6;
          for (let i = x - 1; i <= x + w && cost < bestCost; i++) for (let y = g - h - 1; y < g; y++) cost += solid(i, y) ? 20 : 0;
          if (cost < bestCost) {
            bestCost = cost;
            best = [x, g];
          }
        }
      }
      if (!best) throw new Error('no site for a test landmark');
      const [x0, g] = best;
      const y0 = g - h;
      const set = (x: number, y: number, v: number) => (lv.tiles[y * W + x] = v);
      // Level the ground under it: foundations down to wherever each column's ground was.
      for (let i = x0; i < x0 + w; i++) for (let y = g; y < g + Math.min(4, drop(i, g)); y++) set(i, y, 1);
      for (let y = y0; y < g; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const wall = x === x0 || x === x0 + w - 1;
          const k = y - y0;
          const floor = k % 4 === 0 && y < g - 1;
          const hole = (k / 4) % 2 ? x === x0 + 1 || x === x0 + 2 : x === x0 + w - 3 || x === x0 + w - 2;
          const door = x === x0 && y >= g - 2;
          const pane = x === x0 + w - 1 && k % 4 === 2;
          set(x, y, (wall && !door && !pane) || (floor && !(k > 0 && hole)) ? 1 : 0);
        }
      }
      lv.landmark = { concept: `test-${sk}`, rect: { x: x0, y: y0, w, h }, skin: sk };
      if (sh) {
        const bx = sh === 'facade' || sh === 'clockface' ? x0 : x0 - 4;
        const by = sh === 'facade' ? y0 - 5 : sh === 'clockface' ? y0 + 1 : Math.max(1, y0 - 9);
        const bw = sh === 'facade' || sh === 'clockface' ? w : w + 8;
        const bh = sh === 'clockface' ? 3 : g - by;
        const modules: any[] = [{ type: 'deco', kind: sh, at: [0, 0], w: bw, h: bh, seed: 7 }];
        if (sh === 'flywheel')
          modules.push({
            type: 'rotor',
            look: 'cog',
            support: 'none',
            mastX: 0,
            hub: [bw / 2, bh / 2],
            arm: Math.min(bw, bh) / 2 - 1.5,
            count: 6,
            angle0: 0,
            period: 900,
            swing: 0,
            dir: 1,
            width: 2,
            thick: 0.5,
            material: 'metal',
            seed: 3,
          });
        lv.setPieces.push({
          uid: 9000,
          owner: -1,
          tx: bx,
          ty: by,
          rot: 0,
          def: {
            key: `shell-${sh}`,
            name: 'Shell',
            maker: 'test',
            archetype: 'platform',
            role: 'build',
            style: { metal: 'steel', trim: 'none', hue: 200, glowHue: 40, woodHue: 28 },
            motion: { type: 'none' },
            modules,
            footprint: [[0, 0]],
          },
        });
      }
      lv.version++;
    },
    [skin, shell] as const,
  );
}

/**
 * A landmark with a lift (a rail that parks) is shot once parked at each of its stops instead of at
 * fixed phases: the steps that land in the middle of each stop, from the sim's own motion on the frame
 * the renderer moves props by outside a race. Null when the level has no lift.
 */
async function liftStops(): Promise<[number, number][] | null> {
  const { frame, pieces } = await page.evaluate(() => {
    const m = (window as any).slagDebug.match;
    return { frame: m.frame as number, pieces: JSON.parse(JSON.stringify(m.level.setPieces)) as PlacedProp[] };
  });
  const lift = pieces.find((p) => p.def.motion.type === 'rail' && p.def.motion.dwell);
  if (!lift) return null;
  const r = resolveProp(lift);
  const P = cycleFrames(r.mods, r.motion);
  const parks: { y: number; mid: number }[] = [];
  let run = 0;
  for (let f = frame + 1; f < frame + 2 * P; f++) {
    const y = motionOffset(r, f)[1];
    run = y === motionOffset(r, f - 1)[1] ? run + 1 : 0;
    // Halfway through a stop, once per floor.
    if (run === 20 && !parks.some((p) => p.y === y)) parks.push({ y, mid: f });
  }
  let at = frame;
  return parks.map((p, i) => {
    const n = p.mid - at;
    at = p.mid;
    return [i, n];
  });
}

export const shots: Scenarios = {
  /**
   * `pnpm shot landmarks [--theme T] [--concept id|skin|shell] [--count N] [--ride]`: N seeds of each concept (default 1), three
   * phases each. `--ride` races three runners and stands them on a great wheel's rim cars, to see what carries them.
   */
  async landmarks() {
    const only = opt('concept');
    const count = Number(opt('count', '1'));
    const ride = flag('ride');
    const themes = theme ? [theme as ThemeId] : THEME_IDS;
    const concepts = themes.flatMap((t) => CONCEPTS[t].filter((c) => !only || c.id === only).map((c) => ({ theme: t, id: c.id })));
    // A theme with no concepts yet gets the test landmarks, so the skins and shells are seen either way.
    const tests = TESTS.filter((x) => themes.includes(x.theme) && !CONCEPTS[x.theme].length && (!only || x.skin === only || x.shell === only));
    if (!concepts.length && !tests.length) {
      console.log(`no stage concepts or test landmarks${theme ? ` for ${theme}` : ''}${only ? ` named ${only}` : ''}`);
      return;
    }
    const files: string[] = [];
    await open(`seed=${seed}&ui=0`);
    const shoot = async (name: string) => {
      for (const [i, n] of (await liftStops()) ?? PHASES.entries()) {
        await step(n);
        files.push(await snap(`${name}-${i}`));
      }
    };
    for (const c of concepts) {
      for (let i = 0; i < count; i++) {
        const s = `${seed}${i}`;
        await page.evaluate(
          ([x, th, id]) => {
            const d = (window as any).slagDebug;
            d.match.forceProfile = { ...d.match.forceProfile, concept: id };
            d.loadLevel(x, th);
          },
          [s, c.theme, c.id] as const,
        );
        if (ride) await boardRiders();
        else await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
        await shoot(`landmark-${c.theme}-${c.id}-${s}`);
      }
    }
    for (const x of tests) {
      for (let i = 0; i < count; i++) {
        const s = `${seed}${i}`;
        await page.evaluate(
          ([sd, th]) => {
            const d = (window as any).slagDebug;
            d.match.forceProfile = { ...d.match.forceProfile, size: 'classic', concept: 'plain' };
            d.loadLevel(sd, th);
          },
          [s, x.theme] as const,
        );
        await page.evaluate(() => (window as any).slagDebug.match.join('kb1'));
        await forceLandmark(x.skin, x.shell);
        await shoot(`landmark-${x.theme}-${x.skin}${x.shell ? `-${x.shell}` : ''}-${s}`);
      }
    }
    await sheet('landmarks', files);
  },
};
