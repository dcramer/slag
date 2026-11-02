import type { HSL } from '../../core/color';
import type { ThemeId } from '../../themes';

/**
 * The look of a level: pure data, generated deterministically from (seed, ThemeId)
 * and consumed by src/render/{background,skylines,terrain,decor}.ts.
 */

export type Mood = 'day' | 'golden' | 'dusk' | 'night' | 'overcast' | 'smog' | 'infernal' | 'underground' | 'rain' | 'mist';

/** Parallax silhouette styles. Each has a baker in src/render/skylines.ts. */
export type SkylineKind =
  | 'mountains'
  | 'spires'
  | 'mesas'
  | 'city'
  | 'forest'
  | 'islands'
  | 'crystals'
  // farm
  | 'hills'
  | 'farmstead'
  | 'fields'
  // factory
  | 'industry'
  | 'refinery'
  // castle
  | 'castle'
  | 'ramparts'
  // jungle
  | 'karst'
  | 'canopy'
  // volcano
  | 'volcano'
  | 'crags'
  // harbor
  | 'sea'
  | 'ships'
  | 'docks'
  // mine
  | 'cave'
  | 'mineshaft'
  // rooftops
  | 'skyscrapers'
  | 'rooftops'
  // glacier
  | 'aurora'
  | 'peaks'
  | 'icefall'
  // space
  | 'planet'
  | 'orbital'
  | 'debris';

/** Terrain materials. Each is drawn by a painter in src/render/ink-material.ts. */
export type TerrainKind =
  | 'rock'
  | 'brick'
  | 'metal'
  | 'crystal'
  | 'organic'
  | 'sand'
  | 'dirt'
  | 'stone'
  | 'planks'
  | 'concrete'
  | 'basalt'
  | 'cobble'
  | 'cave'
  | 'strata'
  | 'loam'
  | 'rustplate'
  | 'ice'
  | 'regolith'
  | 'hull';
export type CapKind = 'grass' | 'moss' | 'snow' | 'rust' | 'crystal' | 'none' | 'ledge' | 'trim' | 'ash' | 'beam' | 'gravel';
export type LiquidKind = 'slag' | 'acid' | 'void' | 'water' | 'tar' | 'sea' | 'swamp' | 'lava' | 'street';
export type Ambient = 'embers' | 'fireflies' | 'snow' | 'spores' | 'dust' | 'bubbles' | 'rain' | 'ash' | 'leaves' | 'pollen';
export type DecorKind =
  | 'crystal'
  | 'mushroom'
  | 'lantern'
  | 'vine'
  | 'bones'
  | 'torch'
  | 'flower'
  | 'pipe'
  // farm
  | 'fence'
  | 'haybale'
  | 'wheat'
  | 'pumpkin'
  | 'sunflower'
  // factory
  | 'vent'
  | 'barrel'
  | 'crate'
  | 'beacon'
  | 'chain'
  | 'cable'
  | 'cagelamp'
  // castle
  | 'banner'
  | 'skull'
  // jungle
  | 'fern'
  | 'bigleaf'
  | 'roots'
  // volcano
  | 'fumarole'
  | 'obsidian'
  // harbor
  | 'rope'
  | 'bollard'
  | 'lamppost'
  | 'gull'
  | 'net'
  // mine
  | 'support'
  | 'minecart'
  | 'pickaxe'
  // rooftops
  | 'antenna'
  | 'acunit'
  | 'neon'
  | 'dish'
  // glacier
  | 'cairn'
  | 'pennant'
  | 'icicles'
  // space
  | 'lander';
export type Celestial = 'sun' | 'moon' | 'planet' | 'eclipse' | 'none';
export type CloudStyle = 'puffy' | 'wispy' | 'smog' | 'ash' | 'storm';
export type PlatformKind = 'wood' | 'grate' | 'bamboo' | 'stone';

export interface SkyLayer {
  kind: SkylineKind;
  /** Horizon height as a fraction of the view (0 = top). */
  base: number;
  amp: number;
  freqs: number[];
  phases: number[];
  /** Silhouette body color (already hazed toward the fog for its depth). */
  color: HSL;
  /** Secondary color for lit faces, roofs, sails, crops… */
  detail: HSL;
  /** Emissive color for windows, lava, neon, lanterns. */
  glow: HSL;
  /** 0..1 how often windows/lamps are lit. */
  lit: number;
  /** Parallax factor (0 = fixed to the screen, 1 = moves with the world). */
  depth: number;
  /** 0..1 atmospheric haze applied on top of the layer. */
  haze: number;
  seed: number;
}

export interface TerrainLook {
  kind: TerrainKind;
  base: HSL;
  dark: HSL;
  light: HSL;
  cap: CapKind;
  capColor: HSL;
  vein: HSL;
  veins: boolean;
  /** Outline / silhouette color around the playable terrain. */
  outline: HSL;
  /** Optional second material for deep tiles (e.g. topsoil over rock, planks over a stone quay). */
  sub: { kind: TerrainKind; base: HSL; dark: HSL; light: HSL; depth: number } | null;
  /** 0..1 how strongly the CC0 detail texture shows through. */
  detail: number;
  /** One-way (jump-through) platform style. */
  platform: { kind: PlatformKind; color: HSL };
  /** Tones of the level's own ice (Level.ground), for themes that lay it: drawn as the 'ice' material. */
  ice?: { base: HSL; dark: HSL; light: HSL };
}

export interface Theme {
  /** Which theme this look was generated for. */
  id: ThemeId;
  name: string;
  seed: number;
  mood: Mood;
  night: boolean;
  skyTop: HSL;
  skyMid: HSL;
  skyBottom: HSL;
  fog: HSL;
  /** Glow band hugging the horizon (sunset, city light, lava). */
  horizon: { color: HSL; strength: number; y: number };
  celestial: { kind: Celestial; x: number; y: number; r: number; color: HSL; glow: HSL };
  stars: number;
  layers: SkyLayer[];
  clouds: number;
  cloudStyle: CloudStyle;
  cloudColor: HSL;
  rays: boolean;
  terrain: TerrainLook;
  liquid: { kind: LiquidKind; color: HSL; glow: HSL; emissive: boolean };
  ambient: Ambient;
  /** Ambient light multiplier (0.35 = moody, 0.95 = bright midday). */
  ambientLight: number;
  ambientTint: HSL;
  decor: DecorKind[];
  /** Chance per eligible surface tile to grow a decor item. */
  decorDensity: number;
  /** Warm practical-light color (lamps, torches, windows). */
  lamp: HSL;
  accent: HSL;
  /** Final color grade. */
  grade: { tint: [number, number, number]; lift: [number, number, number]; exposure: number };
}
