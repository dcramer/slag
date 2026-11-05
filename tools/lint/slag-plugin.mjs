/**
 * slag's own lint rules, loaded by oxlint (`jsPlugins` in .oxlintrc.json).
 *
 * `slag/no-copied-kit`: the per-theme files used to open with their own copies of the same helpers (a
 * landmark's crossing sizes, its ways and anchors, a skin's fog haze, a decor piece's knobs), and the copies
 * drifted: a fix had to land six to nine times, and some didn't. Each now has one home. This rule stops a
 * theme file defining one of them again at its top level; import it instead, and if your theme needs it to
 * behave differently, give the shared one a parameter (or your helper a name of its own that says how it
 * differs).
 */

const STAGE_KIT = 'src/gen/stage/kit.ts';

/** Helpers for landmark and set-piece generators (src/gen), by name: where each lives. */
const GEN = {
  SITE_MARGIN: STAGE_KIT,
  DOOR: STAGE_KIT,
  oneGap: `${STAGE_KIT} (sized from hardGapRange in src/gen/level/sculptors/common.ts)`,
  twoGap: `${STAGE_KIT} (sized from hardGapRange in src/gen/level/sculptors/common.ts)`,
  snugGap: STAGE_KIT,
  pondMax: `${STAGE_KIT} as oneGap`,
  moatMax: `${STAGE_KIT} as oneGap`,
  widestGap: `${STAGE_KIT} as oneGap`,
  berthMax: `${STAGE_KIT} as oneGap`,
  asksTwo: `${STAGE_KIT} (bankKit, with your theme's share as \`two\`)`,
  crossCols: `${STAGE_KIT} (bankKit)`,
  boxH: STAGE_KIT,
  bankCrossing: STAGE_KIT,
  ledges: STAGE_KIT,
  rungs: `${STAGE_KIT} as ledges (\`import { ledges as rungs }\`)`,
  passage: STAGE_KIT,
  stepWidths: STAGE_KIT,
  shell: STAGE_KIT,
  rects: STAGE_KIT,
  rectsOf: STAGE_KIT,
  ways: STAGE_KIT,
  waysOf: STAGE_KIT,
  record: STAGE_KIT,
  listOf: STAGE_KIT,
  listSig: STAGE_KIT,
  claimJungleSite: 'src/gen/level/sculptors/common.ts as claimFlatSite',
  claimVolcanoSite: 'src/gen/level/sculptors/common.ts as claimFlatSite',
  claimGlacierSite: 'src/gen/level/sculptors/common.ts as claimFlatSite',
  claimMineSite: 'src/gen/level/sculptors/common.ts as claimFlatSite',
  UP: 'src/core/geom.ts',
  DOWN: 'src/core/geom.ts',
};
/** Of those, the constants: banned however they're declared, not only as functions. */
const GEN_CONSTANTS = new Set(['SITE_MARGIN', 'DOOR', 'UP', 'DOWN']);
const GEN_HOMES = new Set([STAGE_KIT, 'src/gen/level/sculptors/common.ts', 'src/core/geom.ts']);

const SKINS = 'src/render/props/skins/common.ts';
/** A theme skin's shell helpers (props/skins/*, props/modules/deco-*). */
const SKIN = {
  hz: `${SKINS} as hazer, with your theme's HazeSpec`,
  hazer: `${SKINS}, with your theme's HazeSpec`,
  tonesOf: `${SKINS} as hazer, with your theme's HazeSpec`,
  flat: `${SKINS} (its depth and pen weights come from your HazeSpec)`,
  boxOf: SKINS,
};

const DECOR_KIT = 'src/render/decor-kit.ts';
/** A decor piece's knobs (render/decor*.ts). */
const DECOR = {
  k01: `${DECOR_KIT}: bits01(seed, n) for a knob read off the seed's bits, or \`const knob = hashKnobs(salt)\` for hashed ones. Keep the kind your theme was drawn with`,
  sd: `${DECOR_KIT} as low16`,
};

const isFn = (init) => !!init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression');

/** The table that applies to a file, by its path from the repo root, or null. */
function tableFor(path) {
  if (path.startsWith('src/gen/')) return GEN_HOMES.has(path) ? null : { names: GEN, constants: GEN_CONSTANTS };
  if (/^src\/render\/props\/skins\/[a-z-]+\.ts$/.test(path) || /^src\/render\/props\/modules\/deco-[a-z-]+\.ts$/.test(path))
    return path === SKINS ? null : { names: SKIN, constants: new Set() };
  if (/^src\/render\/decor(-[a-z]+)?\.ts$/.test(path)) return path === DECOR_KIT ? null : { names: DECOR, constants: new Set() };
  return null;
}

const noCopiedKit = {
  meta: {
    type: 'problem',
    docs: { description: 'Theme files import the shared landmark, skin and decor helpers instead of redefining them.' },
  },
  create(context) {
    const file = context.filename.replaceAll('\\', '/');
    const at = file.lastIndexOf('/src/');
    const table = at >= 0 ? tableFor(file.slice(at + 1)) : null;
    if (!table) return {};
    const report = (node, name) =>
      context.report({
        node,
        message:
          `\`${name}\` is shared: import it from ${table.names[name]}. ` +
          'Per-theme copies of these helpers drifted apart and every fix had to land in each one. ' +
          'If your theme needs it to differ, give the shared one a parameter, or name your helper for how it differs.',
      });
    /** A declaration at the top of the module (or exported there). */
    const check = (decl) => {
      if (!decl) return;
      if (decl.type === 'FunctionDeclaration' && decl.id && Object.hasOwn(table.names, decl.id.name)) report(decl.id, decl.id.name);
      if (decl.type === 'VariableDeclaration')
        for (const d of decl.declarations) {
          if (d.id.type !== 'Identifier' || !Object.hasOwn(table.names, d.id.name)) continue;
          if (table.constants.has(d.id.name) || isFn(d.init)) report(d.id, d.id.name);
        }
    };
    return {
      Program(program) {
        for (const stmt of program.body) check(stmt.type === 'ExportNamedDeclaration' ? stmt.declaration : stmt);
      },
    };
  },
};

export default {
  meta: { name: 'slag' },
  rules: { 'no-copied-kit': noCopiedKit },
};
