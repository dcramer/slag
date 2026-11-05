/**
 * Writes .oxlintrc.json, the one place lint rules are declared. Oxlint applies overrides in order and a later
 * override's options for a rule replace an earlier one's rather than add to them, so a file in two zones (all of
 * src/, and the deterministic part of it) kept only the last zone's list. The hand-written file pasted shared
 * lists into each zone to make up for it, and the copies drifted. Here each list is written once, and a zone's
 * list for a rule includes every earlier zone's that matches any of the same files, so overlapping zones only
 * ever add restrictions.
 *
 *   pnpm lint:config            write .oxlintrc.json
 *   pnpm lint:config --check    fail if it's out of date (run by `pnpm lint`)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';
import { parseArgs } from 'node:util';
import { DETERMINISTIC } from './deterministic';

const OUT = '.oxlintrc.json';

type Entry = Record<string, unknown> & { message: string };
interface Lists {
  imports?: { paths?: Entry[]; patterns?: Entry[] };
  properties?: Entry[];
  globals?: Entry[];
}
interface Zone extends Lists {
  /** Why the zone exists. For whoever edits this file: JSON has nowhere to keep it. */
  why: string;
  files: string[];
  plugins?: string[];
  rules?: Record<string, unknown>;
}

// --- Messages, each written once ---

const FRAMEWORK = 'src/ is framework-free so the game stays portable. Put React in app/ and have it call plain functions exported from src/.';
const FRAMEWORK_NEXT = 'src/ is framework-free so the game stays portable. Put Next.js code in app/ and have it call plain functions exported from src/.';
const SENTRY =
  "src/ must run under any host, so the game can't depend on Sentry. Call reportError, reportEvent, reportLog, reportMetric, addBreadcrumb, setTag or setContext from src/telemetry.ts (docs/TELEMETRY.md); the SDK is imported only by the host (instrumentation*.ts, app/sentry-*.ts).";
const NAV =
  'Hard navigation reloads the page and tears the game down, and a packaged build may have no URLs at all. Move between screens with the Nav a screen is given (src/router.ts: nav.go(HOME), nav.go(lobby(code))); the router is the one place that touches location and history.';
const HEADLESS_DOM =
  'Deterministic code runs headless (tests, tools, a level worker) and must replay the same on every peer, so it has no DOM. Read it in render/ or ui/ and pass the value in, or keep the state in the sim.';
const WALL_CLOCK = 'Deterministic code: no wall clock. Count sim frames instead.';
const TIMERS = 'Deterministic code is stepped by the caller at a fixed 60 Hz, so timers break it. Count frames in sim state instead.';
const RAF = 'Deterministic code is stepped by the caller at a fixed 60 Hz, so it cannot schedule itself. Do the work inside a step.';
const LOCALE = (what: string) =>
  `${what} compares and formats by the browser's locale and ICU data, which differ between engines, versions and players, so peers would disagree. Compare with < and >, or format with plain string ops.`;
const SKIPPED =
  'A conditional test is how a speed tier comes back: it hides an assertion from `pnpm check` and nothing says so. Give the test one fixed seed count; if it needs many seeds to mean anything, move it to tests/stats/ (`pnpm test:stats`).';

// --- Lists ---

const FRAMEWORK_IMPORTS: Lists['imports'] = {
  paths: [
    { name: 'react', message: FRAMEWORK },
    { name: 'react-dom', message: FRAMEWORK },
    { name: 'next', message: FRAMEWORK_NEXT },
  ],
  patterns: [
    { group: ['next/*'], message: FRAMEWORK_NEXT },
    { group: ['@sentry/*'], message: SENTRY },
  ],
};

const NAVIGATION: Entry[] = [
  ...['assign', 'replace', 'reload', 'href'].map((property) => ({ object: 'location', property, message: NAV })),
  { object: 'window', property: 'location', message: NAV },
  { object: 'document', property: 'location', message: NAV },
  { object: 'history', property: 'pushState', message: NAV },
  { object: 'history', property: 'replaceState', message: NAV },
  { object: 'window', property: 'history', message: NAV },
];

/** Math functions dmath.ts ports, and those it doesn't yet. */
const PORTED = { sin: 'dsin', cos: 'dcos', atan: 'datan', atan2: 'datan2', hypot: 'dhypot', exp: 'dexp', log: 'dlog', pow: 'dpow' };
const UNPORTED = ['tan', 'asin', 'acos', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'expm1', 'log1p', 'log2', 'log10', 'cbrt'];

const DETERMINISTIC_PROPERTIES: Entry[] = [
  { object: 'Math', property: 'random', message: 'Deterministic code: use Rng from src/core/rng.ts (deriveSeed for sub-streams).' },
  ...Object.entries(PORTED).map(([f, d]) => ({
    object: 'Math',
    property: f,
    message: `Math.${f} differs across browsers and desyncs lockstep. Use ${d} from src/core/dmath.ts.`,
  })),
  ...UNPORTED.map((f) => ({
    object: 'Math',
    property: f,
    message: `Math.${f} differs across browsers and desyncs lockstep. src/core/dmath.ts has no port yet: add one there (fdlibm, exact operations only), or express it with dsin/dcos/datan2/dexp/dlog.`,
  })),
  { object: 'Date', property: 'now', message: WALL_CLOCK },
  { object: 'performance', property: 'now', message: WALL_CLOCK },
  ...['localeCompare', 'toLocaleString', 'toLocaleUpperCase', 'toLocaleLowerCase'].map((property) => ({ property, message: LOCALE(property) })),
  ...['Collator', 'NumberFormat', 'DateTimeFormat', 'Segmenter', 'PluralRules'].map((property) => ({
    object: 'Intl',
    property,
    message: LOCALE(`Intl.${property}`),
  })),
];

const DETERMINISTIC_GLOBALS: Entry[] = [
  ...['window', 'document', 'localStorage', 'sessionStorage', 'navigator'].map((name) => ({ name, message: HEADLESS_DOM })),
  { name: 'performance', message: WALL_CLOCK },
  { name: 'requestAnimationFrame', message: RAF },
  { name: 'setTimeout', message: TIMERS },
  { name: 'setInterval', message: TIMERS },
];

// --- Zones, in order: a later zone's lists include an earlier overlapping zone's ---

const ZONES: Zone[] = [
  {
    why: 'The Next shell.',
    files: ['app/**/*.tsx', 'app/**/*.ts'],
    plugins: ['typescript', 'react', 'nextjs'],
    rules: { 'react/react-in-jsx-scope': 'off', 'nextjs/no-page-custom-font': 'off' },
  },
  {
    why: 'The game: framework-free, and it moves between screens through the router.',
    files: ['src/**/*.ts'],
    imports: FRAMEWORK_IMPORTS,
    properties: NAVIGATION,
  },
  {
    why: 'Online play must run outside Next, against a hosted API.',
    files: ['src/net/**/*.ts'],
    imports: {
      patterns: [
        {
          group: ['**/app', '**/app/**'],
          message:
            "src/net can't depend on the Next app: it has to work against a hosted API from any build. Shared wire types belong in src/net/signal-protocol.ts.",
        },
      ],
    },
  },
  {
    why: 'Headless layers: no presentation, input, audio, bots or telemetry.',
    files: ['src/sim/**/*.ts', 'src/gen/**/*.ts', 'src/game/**/*.ts', 'src/core/**/*.ts', 'src/themes.ts'],
    imports: {
      patterns: [
        {
          group: ['**/render', '**/render/*', '**/input', '**/input/*', '**/audio', '**/audio/*', '**/ui/*', '**/debug', '**/game-client'],
          message:
            'sim/, gen/, game/ and core/ run headless and deterministically, so they cannot depend on presentation, input or audio. Push a GameEvent or expose state for render/ and audio/ to read; inputs arrive as InputFrame.',
        },
        {
          group: ['**/brain', '**/brain/*'],
          message:
            'A brain is an input device (docs/DESIGN.md → AI players): it runs on one machine and its InputFrames are all the match ever sees of it, so sim/, gen/ and game/ never call into src/brain. Read what a bot needs from the match in src/brain/view.ts instead.',
        },
        {
          group: ['**/telemetry'],
          message:
            'sim/, gen/ and game/ stay pure so runs replay deterministically. Report from outside the sim instead, for example in src/game-client.ts; to surface something only the sim knows, expose a read-only diagnostic the way planMisses and lastGenInfo do.',
        },
      ],
    },
  },
  {
    why: 'Deterministic code: the same on every peer and every engine.',
    files: DETERMINISTIC,
    properties: DETERMINISTIC_PROPERTIES,
    globals: DETERMINISTIC_GLOBALS,
  },
  {
    why: 'Bots run headless and replay from their seed.',
    files: ['src/brain/**/*.ts'],
    imports: {
      patterns: [
        {
          group: [
            '**/render',
            '**/render/*',
            '**/input',
            '**/input/*',
            '**/audio',
            '**/audio/*',
            '**/ui/*',
            '**/debug',
            '**/game-client',
            '**/net',
            '**/net/*',
          ],
          message:
            'Brains run headless (tests, trials, a Worker one day) and only produce InputFrames. Read the match through src/brain/view.ts and hand inputs back through BotSeats.frames; game-client.ts carries them to the network.',
        },
      ],
    },
    properties: [
      {
        object: 'Math',
        property: 'random',
        message: 'A built-in brain replays from its seed, so a headless trial of bots is repeatable. Use the Rng its BrainDef.make gets (src/core/rng.ts).',
      },
    ],
  },
  {
    why: 'Every test runs on every check.',
    files: ['tests/**/*.ts'],
    plugins: ['typescript', 'unicorn', 'oxc', 'import', 'vitest'],
    // A focused test silently skips every other test in its file, and `pnpm check` still goes green.
    rules: { 'vitest/no-focused-tests': 'error' },
    properties: ['it', 'test', 'describe'].flatMap((object) => ['skip', 'skipIf', 'runIf'].map((property) => ({ object, property, message: SKIPPED }))),
  },
];

/** Exceptions, after every zone: whole rules a file is let off, with the reason. */
const EXEMPT: { why: string; files: string[]; rules: Record<string, 'off'> }[] = [
  { why: 'The router is the one module that navigates; everything else asks it.', files: ['src/router.ts'], rules: { 'no-restricted-properties': 'off' } },
];

const BASE = {
  $schema: './node_modules/oxlint/configuration_schema.json',
  plugins: ['typescript', 'unicorn', 'oxc', 'import'],
  // slag's own rules: each one's message says why it exists and what to do instead.
  jsPlugins: ['./tools/lint/slag-plugin.mjs'],
  options: { typeAware: true, reportUnusedDisableDirectives: 'warn' },
  categories: { correctness: 'error', suspicious: 'warn', perf: 'warn' },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'typescript/no-floating-promises': 'error',
    'typescript/no-misused-promises': 'error',
    'typescript/await-thenable': 'error',
    'typescript/consistent-type-imports': ['warn', { fixStyle: 'inline-type-imports' }],
    'typescript/no-deprecated': 'warn',
    'typescript/no-explicit-any': 'off',
    'typescript/no-unsafe-type-assertion': 'off',
    // tsgolint false positives; its --fix removed assertions tsc needs (PropDef | null narrowing).
    // Still broken in oxlint-tsgolint 7.0.2005: `pnpm format` would break tsc in tests/props-sim.test.ts.
    'typescript/no-unnecessary-type-assertion': 'off',
    'typescript/unbound-method': 'off',
    'typescript/consistent-return': 'off',
    'unicorn/no-array-for-each': 'off',
    'unicorn/no-new-array': 'off',
    'no-shadow': 'off',
    'import/no-unassigned-import': 'off',
    // A cycle makes load order matter (a module's exports are undefined while the other half loads) and ties
    // layers together. Type-only imports load nothing, so they don't count.
    'import/no-cycle': ['error', { ignoreTypes: true }],
    // A bare sort() compares as strings: [10, 9, 1] sorts to [1, 10, 9]. Strings may sort bare.
    'typescript/require-array-sort-compare': ['error', { ignoreStringArrays: true }],
    'no-await-in-loop': 'off',
    'unicorn/consistent-function-scoping': 'off',
    'no-underscore-dangle': 'off',
    'unicorn/prefer-add-event-listener': 'off',
    'react/react-in-jsx-scope': 'off',
    'unicorn/no-array-sort': 'off',
    'unicorn/no-array-fill-with-reference-type': 'off',
    'oxc/no-map-spread': 'off',
    'slag/no-copied-kit': 'error',
    // A new member of a union (a module type, a phase, an event) must be decided wherever the union is switched on:
    // handled, or passed over on purpose by a `default:`.
    'typescript/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true }],
  },
  ignorePatterns: ['.next/**', '.claude/**', 'shots/**', 'node_modules/**', 'next-env.d.ts', 'src/render/cast/sprites/*/frames.ts'],
};

// --- Build ---

const keyOf = (e: Entry): string => JSON.stringify({ ...e, message: undefined });

/** Later entries replace earlier ones with the same key, so a zone can reword a shared entry for its files. */
function merge(lists: (Entry[] | undefined)[]): Entry[] | undefined {
  const out = new Map<string, Entry>();
  for (const l of lists) for (const e of l ?? []) out.set(keyOf(e), e);
  return out.size ? [...out.values()] : undefined;
}

function build(files: readonly string[]): object {
  const matches = (globs: string[]) => new Set(files.filter((f) => globs.some((g) => matchesGlob(f, g))));
  const members = ZONES.map((z) => matches(z.files));
  const overrides: object[] = [];
  ZONES.forEach((z, i) => {
    const earlier = ZONES.slice(0, i).filter((_, j) => [...members[j]].some((f) => members[i].has(f)));
    const chain = [...earlier, z];
    const rules: Record<string, unknown> = { ...z.rules };
    if (z.imports) {
      const paths = merge(chain.map((c) => c.imports?.paths));
      const patterns = merge(chain.map((c) => c.imports?.patterns));
      rules['no-restricted-imports'] = ['error', { ...(paths && { paths }), ...(patterns && { patterns }) }];
    }
    if (z.properties) rules['no-restricted-properties'] = ['error', ...merge(chain.map((c) => c.properties))!];
    if (z.globals) rules['no-restricted-globals'] = ['error', ...merge(chain.map((c) => c.globals))!];
    overrides.push({ files: z.files, ...(z.plugins && { plugins: z.plugins }), rules });
  });
  for (const x of EXEMPT) overrides.push({ files: x.files, rules: x.rules });
  return { ...BASE, overrides };
}

function render(config: object): string {
  const header = '// Generated by tools/lint/config.ts: edit that file, then run `pnpm lint:config`.\n';
  return header + JSON.stringify(config, null, 2) + '\n';
}

const { values } = parseArgs({ options: { check: { type: 'boolean' } }, strict: true });
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const text = render(build(tracked));
if (values.check) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    // missing counts as out of date
  }
  if (current !== text) {
    console.error(`${OUT} is generated from tools/lint/config.ts and is out of date. Edit tools/lint/config.ts (not ${OUT}), then run \`pnpm lint:config\`.`);
    process.exit(1);
  }
} else writeFileSync(OUT, text);
