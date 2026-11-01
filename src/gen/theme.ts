import { hsl3, type HSL } from '../core/color';
import { deriveSeed, Rng } from '../core/rng';
import { placeName } from './names';

export type SkylineKind = 'mountains' | 'spires' | 'mesas' | 'city' | 'forest' | 'islands' | 'crystals';
export type TerrainKind = 'rock' | 'brick' | 'metal' | 'crystal' | 'organic' | 'sand';
export type CapKind = 'grass' | 'moss' | 'snow' | 'rust' | 'crystal' | 'none';
export type LiquidKind = 'slag' | 'acid' | 'void' | 'water' | 'tar';
export type Ambient = 'embers' | 'fireflies' | 'snow' | 'spores' | 'dust' | 'bubbles';
export type DecorKind = 'crystal' | 'mushroom' | 'lantern' | 'vine' | 'bones' | 'torch' | 'flower' | 'pipe';
export type Celestial = 'sun' | 'moon' | 'planet' | 'eclipse' | 'none';

export interface SkyLayer {
  kind: SkylineKind;
  base: number;
  amp: number;
  freqs: number[];
  phases: number[];
  color: HSL;
  depth: number;
  seed: number;
}

export interface Theme {
  name: string;
  seed: number;
  night: boolean;
  skyTop: HSL;
  skyMid: HSL;
  skyBottom: HSL;
  fog: HSL;
  celestial: { kind: Celestial; x: number; y: number; r: number; color: HSL; glow: HSL };
  layers: SkyLayer[];
  clouds: number;
  rays: boolean;
  terrain: { kind: TerrainKind; base: HSL; dark: HSL; light: HSL; cap: CapKind; capColor: HSL; vein: HSL; veins: boolean };
  liquid: { kind: LiquidKind; color: HSL; glow: HSL; emissive: boolean };
  ambient: Ambient;
  /** Ambient light multiplier (0.35 = moody, 0.95 = bright midday). */
  ambientLight: number;
  ambientTint: HSL;
  decor: DecorKind[];
  accent: HSL;
  /** Final color grade. */
  grade: { tint: [number, number, number]; lift: [number, number, number]; exposure: number };
}

const LIQUID: Record<LiquidKind, { color: HSL; glow: HSL; emissive: boolean }> = {
  slag: { color: hsl3(18, 95, 45), glow: hsl3(32, 100, 60), emissive: true },
  acid: { color: hsl3(95, 90, 38), glow: hsl3(85, 100, 60), emissive: true },
  void: { color: hsl3(275, 70, 22), glow: hsl3(290, 100, 65), emissive: true },
  water: { color: hsl3(200, 70, 35), glow: hsl3(190, 80, 70), emissive: false },
  tar: { color: hsl3(250, 15, 10), glow: hsl3(30, 70, 50), emissive: false },
};

export function generateTheme(seed: number): Theme {
  const rng = new Rng(deriveSeed(seed, 'theme'));
  const hue = rng.range(0, 360);
  const mood = rng.weighted([
    ['day', 3],
    ['dusk', 3],
    ['night', 3],
    ['infernal', 1.5],
    ['toxic', 1],
  ] as const);
  const night = mood === 'night' || mood === 'infernal' || mood === 'toxic';
  const skyS = rng.range(40, 75);

  const skyTop = mood === 'day' ? hsl3(hue, skyS, 55) : mood === 'dusk' ? hsl3(hue + 220, skyS, 25) : mood === 'infernal' ? hsl3(5, 70, 8) : mood === 'toxic' ? hsl3(150, 50, 8) : hsl3(hue, skyS * 0.8, 7);
  const skyMid = mood === 'day' ? hsl3(hue + 15, skyS + 5, 64) : mood === 'dusk' ? hsl3(hue + 300, skyS + 10, 45) : mood === 'infernal' ? hsl3(15, 80, 20) : mood === 'toxic' ? hsl3(110, 60, 18) : hsl3(hue + 20, skyS * 0.7, 16);
  const skyBottom = mood === 'day' ? hsl3(hue + 35, skyS + 15, 78) : mood === 'dusk' ? hsl3(30, 90, 65) : mood === 'infernal' ? hsl3(28, 90, 42) : mood === 'toxic' ? hsl3(90, 70, 35) : hsl3(hue + 40, skyS * 0.7, 28);

  const terrainKind = rng.weighted<TerrainKind>([
    ['rock', 3],
    ['brick', 2],
    ['metal', 1.5],
    ['crystal', 1.3],
    ['organic', 2],
    ['sand', 1],
  ]);
  const tHue = (hue + rng.pick([150, 180, 200, 120, -140, 30])) % 360;
  const tSat = terrainKind === 'metal' ? rng.range(5, 18) : rng.range(15, 40);
  const tL = night ? rng.range(22, 30) : rng.range(30, 40);
  const cap = (
    {
      rock: rng.pick(['grass', 'moss', 'snow', 'none'] as const),
      brick: rng.pick(['moss', 'grass', 'none'] as const),
      metal: rng.pick(['rust', 'none', 'moss'] as const),
      crystal: rng.pick(['crystal', 'snow', 'none'] as const),
      organic: rng.pick(['grass', 'moss'] as const),
      sand: rng.pick(['none', 'grass'] as const),
    } as const
  )[terrainKind];
  const capHue = cap === 'grass' ? rng.range(70, 150) : cap === 'moss' ? rng.range(80, 160) : cap === 'snow' ? 210 : cap === 'rust' ? 20 : rng.range(170, 320);
  const capColor = cap === 'snow' ? hsl3(210, 30, 92) : cap === 'rust' ? hsl3(capHue, 65, 38) : hsl3(capHue, rng.range(45, 75), night ? 38 : 45);

  const liquidKind = mood === 'infernal' ? 'slag' : mood === 'toxic' ? 'acid' : rng.weighted<LiquidKind>([
    ['slag', 3],
    ['acid', 1.5],
    ['void', 1.5],
    ['water', night ? 0.6 : 1.5],
    ['tar', 0.8],
  ]);

  const celestialKind = rng.weighted<Celestial>(mood === 'day' ? [['sun', 4], ['planet', 1], ['none', 1]] : mood === 'dusk' ? [['sun', 4], ['planet', 1]] : [['moon', 4], ['planet', 2], ['eclipse', 1], ['none', 0.5]]);
  const celestialColor = celestialKind === 'sun' ? (mood === 'dusk' ? hsl3(25, 100, 70) : hsl3(50, 100, 88)) : celestialKind === 'moon' ? hsl3(hue + 200, 25, 85) : celestialKind === 'eclipse' ? hsl3(0, 0, 4) : hsl3(rng.range(0, 360), 50, 60);

  const skylineKinds: SkylineKind[] = ['mountains', 'spires', 'mesas', 'city', 'forest', 'islands', 'crystals'];
  const farKind = rng.pick(skylineKinds);
  const nearKind = rng.chance(0.6) ? farKind : rng.pick(skylineKinds);
  const layerCount = 3;
  const layers: SkyLayer[] = Array.from({ length: layerCount }, (_, i) => {
    const t = i / (layerCount - 1);
    const kind = i === 0 ? (rng.chance(0.5) ? 'mountains' : farKind) : i === layerCount - 1 ? nearKind : farKind;
    return {
      kind,
      base: 0.38 + t * 0.32 + rng.range(-0.04, 0.04),
      amp: rng.range(0.06, 0.16) * (1 - t * 0.4),
      freqs: [rng.range(0.8, 2), rng.range(2.5, 5), rng.range(6, 11)],
      phases: [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)],
      color: night ? hsl3(hue + 15 + t * 10, skyS * 0.5, 9 + (1 - t) * 9) : mood === 'dusk' ? hsl3(hue + 250 + t * 20, skyS * 0.45, 34 - t * 14) : hsl3(hue + 20 + t * 25, skyS * 0.55, 52 - t * 20),
      depth: 0.15 + t * 0.35,
      seed: rng.int(0, 1e9),
    };
  });

  const decorPool: DecorKind[] = (
    {
      rock: ['flower', 'mushroom', 'crystal', 'vine', 'lantern', 'bones'],
      brick: ['torch', 'lantern', 'vine', 'bones', 'pipe'],
      metal: ['pipe', 'lantern', 'crystal', 'bones'],
      crystal: ['crystal', 'crystal', 'mushroom', 'lantern'],
      organic: ['mushroom', 'flower', 'vine', 'vine', 'lantern'],
      sand: ['bones', 'torch', 'crystal', 'flower'],
    } as const
  )[terrainKind].slice();
  rng.shuffle(decorPool);

  const ambientLight = mood === 'day' ? rng.range(0.85, 1) : mood === 'dusk' ? rng.range(0.6, 0.75) : rng.range(0.32, 0.5);
  const lq = LIQUID[liquidKind];
  return {
    name: placeName(rng),
    seed,
    night,
    skyTop,
    skyMid,
    skyBottom,
    fog: night ? hsl3(skyMid.h, skyS * 0.5, 18) : hsl3(skyBottom.h, skyS * 0.6, 80),
    celestial: { kind: celestialKind, x: rng.range(0.15, 0.85), y: rng.range(0.12, 0.35), r: celestialKind === 'planet' ? rng.range(30, 60) : rng.range(14, 26), color: celestialColor, glow: celestialKind === 'eclipse' ? hsl3(rng.range(0, 360), 90, 70) : celestialColor },
    layers,
    clouds: mood === 'day' ? rng.int(5, 10) : mood === 'dusk' ? rng.int(4, 8) : rng.int(0, 4),
    rays: mood === 'day' || mood === 'dusk' ? rng.chance(0.8) : rng.chance(0.3),
    terrain: {
      kind: terrainKind,
      base: hsl3(tHue, tSat, tL),
      dark: hsl3(tHue + 10, tSat * 0.9, tL * 0.55),
      light: hsl3(tHue - 10, tSat * 1.1, Math.min(80, tL * 1.45)),
      cap,
      capColor,
      vein: hsl3(rng.pick([180, 200, 280, 320, 40, 120]), 90, 60),
      veins: terrainKind === 'crystal' || rng.chance(night ? 0.45 : 0.2),
    },
    liquid: { kind: liquidKind, ...lq },
    ambient: mood === 'infernal' ? 'embers' : mood === 'toxic' ? 'spores' : rng.pick(night ? (['fireflies', 'embers', 'spores', 'snow', 'dust'] as const) : (['dust', 'snow', 'spores', 'bubbles'] as const)),
    ambientLight,
    ambientTint: night ? hsl3(skyTop.h, 40, 60) : hsl3(skyBottom.h, 30, 85),
    decor: decorPool.slice(0, 3),
    accent: hsl3((hue + 180) % 360, 85, 60),
    grade: {
      tint: mood === 'day' ? [1.02, 1.0, 0.97] : mood === 'dusk' ? [1.06, 0.97, 0.92] : mood === 'infernal' ? [1.1, 0.95, 0.85] : mood === 'toxic' ? [0.95, 1.08, 0.9] : [0.95, 0.98, 1.08],
      lift: night ? [0.01, 0.012, 0.03] : [0.01, 0.008, 0.0],
      exposure: night ? 1.15 : 1.0,
    },
  };
}
