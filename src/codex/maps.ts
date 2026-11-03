import { decorFor } from '../gen/decor';
import { THEME_GRAVITY } from '../gen/level/profile';
import { WEATHER_WEIGHTS } from '../gen/level/weather';
import { type Recipe, SET_PIECE_RECIPES } from '../gen/setpieces';
import { CONCEPTS, conceptName, contractOf } from '../gen/stage';
import { generateTheme } from '../gen/theme';
import { THEME_IDS, THEME_LABELS, THEME_NOTES, type ThemeId } from '../themes';
import { type MapJob, SHOT_SEEDS } from './shots';

/**
 * The codex's maps: a section per theme, its look first, then its landmarks and the hazards no other theme
 * has. Everything comes from the registries (THEME_IDS, CONCEPTS, SET_PIECE_RECIPES), so a new theme,
 * concept or unique hazard shows up here with no edit; its words come from the entry itself (`codex` on a
 * concept or a recipe, THEME_NOTES), and tests/codex-maps.test.ts asks every one for them.
 */

export interface MapEntry {
  job: MapJob;
  title: string;
  note: string;
  /** Facts, for the close-up. */
  spec: string[];
  /** What it is and its ways through, or what it does. */
  quip: string | null;
}

export interface MapSection {
  id: string;
  theme: ThemeId;
  title: string;
  blurb: string;
  entries: MapEntry[];
}

const titleCase = (s: string) => s.replace(/(^|[\s-])(\p{Ll})/gu, (_m, a: string, b: string) => (a === '-' ? ' ' : a) + b.toUpperCase()).replace(/-/g, ' ');

/** Recipes no other theme has (`unique`): the theme's own hazards. */
export const ownHazards = (theme: ThemeId): Recipe[] => SET_PIECE_RECIPES[theme].filter((r) => r.unique);

/** A recipe as its card names it. */
export const hazardTitle = (r: Recipe): string => r.codex?.title ?? titleCase(r.name);

/** A sample place of the theme: the name its look rolls at `seed`, as a plain level of that seed is called. */
const placeOf = (theme: ThemeId, seed: number): string => generateTheme(seed, theme).name;

const list = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

function themeEntry(theme: ThemeId): MapEntry {
  const [place, ...more] = [SHOT_SEEDS[0], 11, 12].map((s) => placeOf(theme, s));
  const weather = WEATHER_WEIGHTS[theme].filter(([k, w]) => w > 0 && k !== 'clear').map(([k]) => k);
  const gravity = THEME_GRAVITY[theme];
  return {
    job: { kind: 'theme', theme, id: theme },
    title: place,
    note: `Or ${more[0]}. Or ${more[1]}.`,
    spec: [
      `${CONCEPTS[theme].length} landmarks · ${ownHazards(theme).length} hazards of its own · ${decorFor(theme).length} decor pieces`,
      weather.length ? `weather: ${list(weather)}` : 'no weather',
      ...(gravity ? [`gravity ×${gravity}`] : []),
    ],
    quip: null,
  };
}

function landmarkEntries(theme: ThemeId): MapEntry[] {
  const place = placeOf(theme, SHOT_SEEDS[0]);
  const recipes = new Map(SET_PIECE_RECIPES[theme].map((r) => [r.name, r]));
  return CONCEPTS[theme].map((c) => {
    const k = contractOf(c);
    const around = c.family.map((n) => {
      const r = recipes.get(n);
      return r ? hazardTitle(r) : titleCase(n);
    });
    return {
      job: { kind: 'landmark', theme, id: c.id },
      title: titleCase(c.id),
      note: conceptName(SHOT_SEEDS[0], c, place),
      spec: [
        `${k.scale} · ${c.sizes.length > 1 ? `${list(c.sizes)} levels` : `${c.sizes[0]} levels only`}`,
        ...(k.varies.length ? [`changes with the seed: ${k.varies.join('; ')}`] : []),
        ...(around.length ? [`around it: ${list(around)}`] : []),
      ],
      quip: c.codex?.about ?? null,
    };
  });
}

function hazardEntries(theme: ThemeId): MapEntry[] {
  return ownHazards(theme).map((r) => {
    const at = CONCEPTS[theme].filter((c) => c.family.includes(r.name)).map((c) => titleCase(c.id));
    return {
      job: { kind: 'hazard', theme, id: r.name },
      title: hazardTitle(r),
      note: r.codex?.note ?? '',
      spec: at.length ? [`landmarks with it: ${list(at)}`] : [],
      quip: r.codex?.about ?? null,
    };
  });
}

/** Every theme's section of the maps, in THEME_IDS order. */
export function mapSections(): MapSection[] {
  return THEME_IDS.map((theme) => ({
    id: `map-${theme}`,
    theme,
    title: THEME_LABELS[theme],
    blurb: THEME_NOTES[theme],
    entries: [themeEntry(theme), ...landmarkEntries(theme), ...hazardEntries(theme)],
  }));
}
