import { type HSL, hsl3 } from '../../core/color';
import { Rng } from '../../core/rng';
import type { ThemeId } from '../../themes';
import { word } from '../names';
import { type DecorKind, pickDecor } from '../decor';
import type { Ambient, Celestial, CloudStyle, LiquidKind, Mood, SkyLayer, SkylineKind, TerrainLook, Theme } from './types';

/**
 * Per-theme look recipes. Each recipe rolls a mood (time of day / weather)
 * and then picks palette, skyline, terrain material, liquid, decor and grade
 * that read as that place at a glance, with seeded variation inside the theme.
 */

export type Look = Omit<Theme, 'id' | 'seed'>;

/** Small seeded nudge so two farms never share the exact same palette. */
const jit = (rng: Rng, c: HSL, dh = 6, ds = 6, dl = 4): HSL =>
  hsl3(c.h + rng.range(-dh, dh), Math.max(0, Math.min(100, c.s + rng.range(-ds, ds))), Math.max(0, Math.min(100, c.l + rng.range(-dl, dl))));

interface LayerSpec {
  kind: SkylineKind;
  base: number;
  amp?: number;
  color: HSL;
  detail?: HSL;
  glow?: HSL;
  lit?: number;
  haze: number;
  depth: number;
}

function layers(rng: Rng, specs: LayerSpec[]): SkyLayer[] {
  return specs.map((s) => ({
    kind: s.kind,
    base: s.base + rng.range(-0.025, 0.025),
    amp: (s.amp ?? 0.08) * rng.range(0.8, 1.2),
    freqs: [rng.range(0.8, 2), rng.range(2.5, 5), rng.range(6, 11)],
    phases: [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)],
    color: jit(rng, s.color, 4, 4, 3),
    detail: s.detail ?? s.color,
    glow: s.glow ?? hsl3(40, 95, 65),
    lit: s.lit ?? 0,
    depth: s.depth,
    haze: s.haze,
    seed: rng.int(0, 1e9),
  }));
}

/**
 * Another backdrop layer slipped in at `at`, rolled from its own stream seeded off the layers already
 * rolled: the main stream draws exactly what it did before, so every seed keeps its look and adds depth.
 */
function deeper(ls: SkyLayer[], at: number, spec: LayerSpec): SkyLayer[] {
  const extra = layers(new Rng((ls[0].seed ^ 0x5eedbac) >>> 0), [spec]);
  return [...ls.slice(0, at), ...extra, ...ls.slice(at)];
}

function mat(base: HSL, dl = 0.55, ll = 1.45): { base: HSL; dark: HSL; light: HSL } {
  return { base, dark: hsl3(base.h + 6, base.s * 0.95, base.l * dl), light: hsl3(base.h - 6, Math.min(100, base.s * 1.05), Math.min(85, base.l * ll)) };
}

function celestial(rng: Rng, kind: Celestial, color: HSL, x: [number, number], y: [number, number], r: [number, number], glow?: HSL): Theme['celestial'] {
  return { kind, x: rng.range(x[0], x[1]), y: rng.range(y[0], y[1]), r: rng.range(r[0], r[1]), color, glow: glow ?? color };
}

interface Common {
  mood: Mood;
  night: boolean;
  sky: [HSL, HSL, HSL];
  fog: HSL;
  horizon: Theme['horizon'];
  celestial: Theme['celestial'];
  stars: number;
  layers: SkyLayer[];
  clouds: number;
  cloudStyle: CloudStyle;
  cloudColor: HSL;
  rays: boolean;
  terrain: TerrainLook;
  liquid: { kind: LiquidKind; color: HSL; glow: HSL; emissive: boolean };
  ambient: Ambient;
  ambientLight: number;
  ambientTint: HSL;
  decor: DecorKind[];
  decorDensity: number;
  lamp: HSL;
  accent: HSL;
  grade: Theme['grade'];
  name: string;
}

function look(rng: Rng, c: Common): Look {
  return {
    name: c.name,
    mood: c.mood,
    night: c.night,
    skyTop: jit(rng, c.sky[0], 4, 4, 2),
    skyMid: jit(rng, c.sky[1], 4, 4, 2),
    skyBottom: jit(rng, c.sky[2], 4, 4, 2),
    fog: c.fog,
    horizon: c.horizon,
    celestial: c.celestial,
    stars: c.stars,
    layers: c.layers,
    clouds: c.clouds,
    cloudStyle: c.cloudStyle,
    cloudColor: c.cloudColor,
    rays: c.rays,
    terrain: c.terrain,
    liquid: c.liquid,
    ambient: c.ambient,
    ambientLight: c.ambientLight,
    ambientTint: c.ambientTint,
    decor: c.decor,
    decorDensity: c.decorDensity,
    lamp: c.lamp,
    accent: c.accent,
    grade: c.grade,
  };
}

const NONE = celestialNone();
function celestialNone(): Theme['celestial'] {
  return { kind: 'none', x: 0.5, y: 0.2, r: 0, color: hsl3(0, 0, 0), glow: hsl3(0, 0, 0) };
}

// ---------------------------------------------------------------------------

function farm(rng: Rng): Look {
  const mood = rng.weighted<Mood>([
    ['day', 4],
    ['golden', 3.5],
    ['dusk', 2.5],
  ]);
  const sky: [HSL, HSL, HSL] =
    mood === 'day'
      ? [hsl3(208, 68, 50), hsl3(200, 62, 68), hsl3(190, 55, 84)]
      : mood === 'golden'
        ? [hsl3(215, 45, 50), hsl3(28, 70, 72), hsl3(42, 92, 78)]
        : [hsl3(250, 40, 24), hsl3(325, 45, 46), hsl3(24, 90, 64)];
  const fog = mood === 'day' ? hsl3(198, 42, 80) : mood === 'golden' ? hsl3(34, 55, 72) : hsl3(330, 35, 52);
  const sunCol = mood === 'day' ? hsl3(52, 100, 90) : mood === 'golden' ? hsl3(38, 100, 78) : hsl3(20, 100, 68);
  const hillH = mood === 'dusk' ? hsl3(300, 18, 40) : mood === 'golden' ? hsl3(75, 25, 58) : hsl3(140, 22, 62);
  const grass = jit(rng, mood === 'dusk' ? hsl3(100, 45, 34) : hsl3(rng.range(85, 105), 62, 42));
  const soil = jit(rng, hsl3(26, 42, 30));
  return look(rng, {
    name: rng.pick([
      `${word(rng, 1, 2)} Farm`,
      `${word(rng, 1, 2)}'s Acres`,
      `${word(rng, 2, 2)} Fields`,
      `Old ${word(rng, 1, 2)} Homestead`,
      `${word(rng, 1, 2)} Hollow`,
    ]),
    mood,
    night: false,
    sky: sky.map((c) => jit(rng, c, 5, 5, 3)) as [HSL, HSL, HSL],
    fog,
    horizon: { color: mood === 'day' ? hsl3(50, 80, 90) : sunCol, strength: mood === 'day' ? 0.15 : 0.45, y: 0.62 },
    celestial: celestial(rng, 'sun', sunCol, [0.2, 0.8], mood === 'day' ? [0.12, 0.25] : [0.38, 0.52], mood === 'day' ? [16, 20] : [24, 32]),
    stars: mood === 'dusk' ? 40 : 0,
    layers: layers(rng, [
      { kind: 'hills', base: 0.52, amp: 0.09, color: hillH, haze: 0.42, depth: 0.08 },
      {
        kind: 'farmstead',
        base: 0.6,
        amp: 0.06,
        color: mood === 'dusk' ? hsl3(290, 20, 26) : hsl3(100, 32, 42),
        detail: mood === 'dusk' ? hsl3(350, 35, 30) : hsl3(4, 58, 42),
        glow: hsl3(42, 100, 65),
        lit: mood === 'dusk' ? 0.8 : 0.1,
        haze: 0.2,
        depth: 0.2,
      },
      {
        kind: 'fields',
        base: 0.74,
        amp: 0.05,
        color: mood === 'dusk' ? hsl3(280, 22, 18) : hsl3(90, 42, 30),
        detail: mood === 'dusk' ? hsl3(35, 35, 30) : hsl3(46, 70, 55),
        haze: 0.06,
        depth: 0.38,
      },
    ]),
    clouds: rng.int(5, 9),
    cloudStyle: 'puffy',
    cloudColor: mood === 'day' ? hsl3(210, 40, 97) : mood === 'golden' ? hsl3(30, 80, 86) : hsl3(340, 45, 66),
    rays: true,
    terrain: {
      kind: 'dirt',
      ...mat(soil, 0.55, 1.5),
      cap: 'grass',
      capColor: grass,
      vein: hsl3(45, 80, 60),
      veins: false,
      outline: hsl3(20, 45, 10),
      sub: rng.chance(0.7) ? { kind: 'strata', ...mat(jit(rng, hsl3(28, 22, 30))), depth: 4 } : null,
      platform: { kind: 'wood', color: jit(rng, hsl3(32, 45, 42)) },
    },
    liquid: { kind: 'water', color: hsl3(196, 60, 36), glow: hsl3(185, 70, 78), emissive: false },
    ambient: mood === 'dusk' ? 'fireflies' : 'pollen',
    ambientLight: mood === 'day' ? rng.range(0.86, 0.94) : mood === 'golden' ? rng.range(0.74, 0.82) : rng.range(0.55, 0.65),
    ambientTint: mood === 'day' ? hsl3(50, 30, 92) : mood === 'golden' ? hsl3(35, 70, 80) : hsl3(320, 40, 70),
    decor: pickDecor(rng, 'farm', ['fence', 'haybale'], 5),
    decorDensity: 0.2,
    lamp: hsl3(40, 95, 62),
    accent: hsl3(rng.pick([5, 48, 200]), 90, 58),
    grade:
      mood === 'day'
        ? { tint: [1.03, 1.01, 0.95], lift: [0.012, 0.01, 0.0], exposure: 1.0 }
        : mood === 'golden'
          ? { tint: [1.08, 1.0, 0.88], lift: [0.02, 0.012, 0.0], exposure: 1.02 }
          : { tint: [1.06, 0.95, 0.98], lift: [0.02, 0.008, 0.03], exposure: 1.08 },
  });
}

function factory(rng: Rng): Look {
  const mood = rng.weighted<Mood>([
    ['smog', 5],
    ['night', 4],
  ]);
  const smog = mood === 'smog';
  const fog = smog ? hsl3(30, 30, 46) : hsl3(25, 30, 22);
  const brick = jit(rng, hsl3(8, 34, 27));
  const steel = jit(rng, hsl3(212, 10, 36));
  const rusty = rng.chance(0.4);
  return look(rng, {
    name: rng.pick([
      `${word(rng, 1, 2)} Works`,
      `${word(rng, 1, 2)} Foundry`,
      `Plant No. ${rng.int(2, 99)}`,
      `${word(rng, 1, 2)} Smelter`,
      `${word(rng, 2, 2)} Mill`,
    ]),
    mood,
    night: !smog,
    sky: smog ? [hsl3(20, 22, 22), hsl3(26, 42, 40), hsl3(36, 72, 58)] : [hsl3(235, 30, 8), hsl3(255, 20, 15), hsl3(18, 50, 28)],
    fog,
    horizon: { color: smog ? hsl3(32, 90, 60) : hsl3(22, 95, 52), strength: smog ? 0.35 : 0.55, y: 0.72 },
    celestial: smog
      ? celestial(rng, 'sun', hsl3(28, 100, 72), [0.25, 0.75], [0.2, 0.34], [26, 34], hsl3(30, 90, 60))
      : celestial(rng, 'moon', hsl3(40, 25, 78), [0.15, 0.85], [0.12, 0.25], [12, 16]),
    stars: smog ? 0 : 50,
    layers: deeper(
      layers(rng, [
        {
          kind: 'industry',
          base: 0.5,
          amp: 0.05,
          color: smog ? hsl3(25, 18, 36) : hsl3(250, 18, 15),
          detail: smog ? hsl3(25, 15, 44) : hsl3(250, 15, 22),
          glow: hsl3(35, 100, 62),
          lit: smog ? 0.25 : 0.5,
          haze: 0.5,
          depth: 0.08,
        },
        {
          kind: 'refinery',
          base: 0.6,
          amp: 0.05,
          color: smog ? hsl3(20, 16, 24) : hsl3(245, 16, 10),
          detail: smog ? hsl3(25, 15, 34) : hsl3(240, 12, 20),
          glow: hsl3(rng.pick([30, 45, 190]), 100, 62),
          lit: 0.45,
          haze: 0.3,
          depth: 0.2,
        },
        {
          kind: 'industry',
          base: 0.72,
          amp: 0.04,
          color: smog ? hsl3(15, 18, 15) : hsl3(240, 15, 7),
          detail: smog ? hsl3(15, 18, 24) : hsl3(240, 15, 15),
          glow: hsl3(38, 100, 60),
          lit: 0.5,
          haze: 0.12,
          depth: 0.36,
        },
      ]),
      0,
      {
        kind: 'refinery',
        base: 0.43,
        amp: 0.05,
        color: smog ? hsl3(28, 20, 40) : hsl3(252, 18, 18),
        detail: smog ? hsl3(28, 18, 46) : hsl3(252, 15, 24),
        glow: hsl3(32, 100, 62),
        lit: 0.2,
        haze: 0.62,
        depth: 0.035,
      },
    ),
    clouds: rng.int(4, 7),
    cloudStyle: 'wispy',
    cloudColor: smog ? hsl3(28, 25, 52) : hsl3(250, 15, 22),
    rays: smog && rng.chance(0.6),
    terrain: {
      kind: rusty ? 'rustplate' : 'metal',
      ...mat(rusty ? jit(rng, hsl3(18, 38, 30)) : steel, 0.5, 1.5),
      cap: rusty ? 'rust' : 'trim',
      capColor: rusty ? hsl3(20, 65, 38) : hsl3(48, 95, 52),
      vein: hsl3(28, 100, 58),
      veins: false,
      outline: hsl3(220, 25, 6),
      sub: { kind: 'brick', ...mat(brick, 0.55, 1.4), depth: 2 },
      platform: { kind: 'grate', color: hsl3(210, 10, 50) },
    },
    liquid: { kind: 'slag', color: hsl3(18, 95, 45), glow: hsl3(32, 100, 60), emissive: true },
    ambient: 'embers',
    ambientLight: smog ? rng.range(0.62, 0.72) : rng.range(0.4, 0.5),
    ambientTint: smog ? hsl3(32, 50, 72) : hsl3(230, 30, 60),
    decor: pickDecor(rng, 'factory', ['pipe', 'barrel'], 6),
    decorDensity: 0.16,
    lamp: hsl3(38, 100, 60),
    accent: hsl3(rng.pick([190, 50, 140]), 95, 58),
    grade: smog
      ? { tint: [1.08, 0.99, 0.86], lift: [0.025, 0.015, 0.0], exposure: 1.03 }
      : { tint: [1.0, 0.97, 1.02], lift: [0.012, 0.01, 0.025], exposure: 1.15 },
  });
}

function castle(rng: Rng): Look {
  const mood = rng.weighted<Mood>([
    ['dusk', 4],
    ['night', 3.5],
    ['overcast', 2.5],
  ]);
  const night = mood === 'night';
  const stone = jit(rng, hsl3(rng.range(25, 45), 10, 44), 6, 4, 4);
  const fog = mood === 'dusk' ? hsl3(300, 25, 48) : night ? hsl3(225, 35, 22) : hsl3(210, 15, 62);
  return look(rng, {
    name: rng.pick([
      `Castle ${word(rng, 2, 3)}`,
      `${word(rng, 1, 2)} Keep`,
      `Fort ${word(rng, 1, 2)}`,
      `${word(rng, 2, 2)} Citadel`,
      `The ${word(rng, 1, 2)} Ramparts`,
    ]),
    mood,
    night,
    sky:
      mood === 'dusk'
        ? [hsl3(245, 38, 20), hsl3(290, 28, 40), hsl3(22, 75, 60)]
        : night
          ? [hsl3(228, 50, 8), hsl3(222, 38, 17), hsl3(212, 32, 30)]
          : [hsl3(218, 20, 38), hsl3(212, 16, 54), hsl3(205, 16, 68)],
    fog,
    horizon: { color: mood === 'dusk' ? hsl3(25, 90, 62) : night ? hsl3(215, 40, 40) : hsl3(210, 10, 85), strength: mood === 'dusk' ? 0.45 : 0.2, y: 0.66 },
    celestial:
      mood === 'dusk'
        ? celestial(rng, 'sun', hsl3(22, 100, 66), [0.2, 0.8], [0.42, 0.52], [22, 28])
        : night
          ? celestial(rng, 'moon', hsl3(210, 25, 88), [0.15, 0.85], [0.12, 0.24], [18, 26])
          : NONE,
    stars: night ? 160 : mood === 'dusk' ? 30 : 0,
    layers: layers(rng, [
      {
        kind: 'mountains',
        base: 0.5,
        amp: 0.13,
        color: mood === 'dusk' ? hsl3(280, 18, 38) : night ? hsl3(225, 25, 20) : hsl3(210, 10, 58),
        haze: 0.5,
        depth: 0.06,
      },
      {
        kind: 'castle',
        base: 0.58,
        amp: 0.04,
        color: mood === 'dusk' ? hsl3(270, 18, 24) : night ? hsl3(228, 25, 12) : hsl3(215, 8, 42),
        detail: mood === 'overcast' ? hsl3(210, 25, 35) : hsl3(rng.pick([0, 220, 140]), 55, 35),
        glow: hsl3(38, 100, 62),
        lit: night ? 0.55 : mood === 'dusk' ? 0.35 : 0.08,
        haze: 0.3,
        depth: 0.18,
      },
      {
        kind: 'ramparts',
        base: 0.74,
        amp: 0.03,
        color: mood === 'dusk' ? hsl3(265, 18, 15) : night ? hsl3(230, 22, 7) : hsl3(215, 8, 30),
        detail: hsl3(rng.pick([0, 215, 45]), 60, 38),
        glow: hsl3(32, 100, 58),
        lit: 1,
        haze: 0.12,
        depth: 0.34,
      },
    ]),
    clouds: mood === 'overcast' ? rng.int(8, 12) : rng.int(2, 6),
    cloudStyle: 'wispy',
    cloudColor: mood === 'dusk' ? hsl3(330, 40, 62) : night ? hsl3(225, 25, 26) : hsl3(210, 8, 80),
    rays: mood !== 'night' && rng.chance(0.6),
    terrain: {
      kind: 'stone',
      ...mat(stone, 0.5, 1.45),
      cap: 'moss',
      capColor: jit(rng, hsl3(88, 40, 36)),
      vein: hsl3(45, 80, 60),
      veins: false,
      outline: hsl3(230, 25, 7),
      sub: null,
      platform: { kind: 'wood', color: hsl3(25, 40, 32) },
    },
    liquid: rng.chance(0.65)
      ? { kind: 'water', color: hsl3(178, 35, 24), glow: hsl3(170, 40, 60), emissive: false }
      : { kind: 'tar', color: hsl3(250, 15, 10), glow: hsl3(30, 70, 50), emissive: false },
    ambient: night ? 'fireflies' : 'dust',
    ambientLight: mood === 'overcast' ? rng.range(0.72, 0.82) : mood === 'dusk' ? rng.range(0.58, 0.66) : rng.range(0.38, 0.46),
    ambientTint: mood === 'dusk' ? hsl3(310, 40, 70) : night ? hsl3(220, 45, 62) : hsl3(210, 15, 85),
    decor: pickDecor(rng, 'castle', ['torch', 'banner'], 5),
    decorDensity: 0.14,
    lamp: hsl3(34, 100, 60),
    accent: hsl3(rng.pick([48, 0, 200]), 90, 58),
    grade:
      mood === 'dusk'
        ? { tint: [1.06, 0.96, 0.98], lift: [0.02, 0.01, 0.03], exposure: 1.06 }
        : night
          ? { tint: [0.94, 0.98, 1.1], lift: [0.008, 0.014, 0.035], exposure: 1.18 }
          : { tint: [0.98, 1.0, 1.03], lift: [0.012, 0.012, 0.018], exposure: 1.02 },
  });
}

function jungle(rng: Rng): Look {
  const mood = rng.weighted<Mood>([
    ['day', 4],
    ['golden', 3],
    ['night', 2.5],
  ]);
  const night = mood === 'night';
  const leaf = jit(rng, hsl3(rng.range(95, 130), 50, 30));
  return look(rng, {
    name: rng.pick([
      `${word(rng, 2, 3)} Jungle`,
      `The ${word(rng, 1, 2)} Wilds`,
      `${word(rng, 2, 2)} Ruins`,
      `Temple of ${word(rng, 2, 3)}`,
      `${word(rng, 1, 2)} Swamp`,
    ]),
    mood,
    night,
    sky:
      mood === 'day'
        ? [hsl3(192, 55, 48), hsl3(170, 40, 64), hsl3(95, 40, 76)]
        : mood === 'golden'
          ? [hsl3(205, 50, 46), hsl3(50, 60, 66), hsl3(32, 80, 70)]
          : [hsl3(220, 50, 8), hsl3(190, 40, 14), hsl3(160, 40, 22)],
    fog: mood === 'day' ? hsl3(140, 30, 70) : mood === 'golden' ? hsl3(48, 45, 62) : hsl3(170, 35, 18),
    horizon: { color: mood === 'golden' ? hsl3(40, 90, 70) : night ? hsl3(160, 50, 30) : hsl3(80, 50, 80), strength: 0.3, y: 0.6 },
    celestial: night
      ? celestial(rng, 'moon', hsl3(150, 25, 86), [0.2, 0.8], [0.12, 0.24], [14, 20])
      : celestial(rng, 'sun', mood === 'golden' ? hsl3(40, 100, 80) : hsl3(55, 100, 92), [0.2, 0.8], [0.12, 0.3], [18, 24]),
    stars: night ? 90 : 0,
    layers: layers(rng, [
      { kind: 'karst', base: 0.46, amp: 0.1, color: night ? hsl3(175, 30, 16) : hsl3(150, 22, 52), haze: 0.55, depth: 0.07 },
      {
        kind: 'canopy',
        base: 0.56,
        amp: 0.07,
        color: night ? hsl3(160, 40, 11) : hsl3(125, 38, 34),
        detail: night ? hsl3(150, 40, 18) : hsl3(100, 45, 44),
        haze: 0.32,
        depth: 0.2,
      },
      {
        kind: 'canopy',
        base: 0.7,
        amp: 0.06,
        color: night ? hsl3(150, 40, 6) : hsl3(135, 45, 18),
        detail: night ? hsl3(140, 45, 12) : hsl3(110, 50, 28),
        glow: hsl3(70, 100, 60),
        lit: night ? 0.6 : 0,
        haze: 0.1,
        depth: 0.36,
      },
    ]),
    clouds: night ? rng.int(0, 2) : rng.int(3, 6),
    cloudStyle: 'wispy',
    cloudColor: night ? hsl3(180, 20, 25) : hsl3(70, 30, 92),
    rays: !night,
    terrain: {
      kind: 'organic',
      ...mat(jit(rng, hsl3(70, 22, 28)), 0.5, 1.45),
      cap: 'moss',
      capColor: leaf,
      vein: hsl3(rng.pick([170, 70, 300]), 90, 60),
      veins: night && rng.chance(0.6),
      outline: hsl3(150, 40, 6),
      sub: { kind: 'loam', ...mat(jit(rng, hsl3(40, 30, 22))), depth: 3 },
      platform: { kind: 'bamboo', color: hsl3(55, 45, 50) },
    },
    liquid: { kind: 'swamp', color: hsl3(85, 38, 22), glow: hsl3(80, 60, 55), emissive: false },
    ambient: night ? 'fireflies' : rng.pick(['pollen', 'spores'] as const),
    ambientLight: mood === 'day' ? rng.range(0.82, 0.92) : mood === 'golden' ? rng.range(0.75, 0.85) : rng.range(0.4, 0.48),
    ambientTint: mood === 'day' ? hsl3(90, 40, 85) : mood === 'golden' ? hsl3(45, 55, 84) : hsl3(170, 45, 60),
    decor: pickDecor(rng, 'jungle', ['fern', 'vine'], 5),
    decorDensity: 0.26,
    lamp: hsl3(60, 100, 65),
    accent: hsl3(rng.pick([330, 45, 190]), 90, 60),
    grade:
      mood === 'day'
        ? { tint: [0.98, 1.04, 0.95], lift: [0.0, 0.012, 0.008], exposure: 1.0 }
        : mood === 'golden'
          ? { tint: [1.03, 1.02, 0.94], lift: [0.03, 0.03, 0.02], exposure: 1.02 }
          : { tint: [0.92, 1.04, 1.04], lift: [0.0, 0.015, 0.025], exposure: 1.15 },
  });
}

function volcano(rng: Rng): Look {
  const mood = rng.weighted<Mood>([
    ['infernal', 5],
    ['night', 3],
  ]);
  const inf = mood === 'infernal';
  const lavaHue = rng.range(14, 28);
  return look(rng, {
    name: rng.pick([
      `Mount ${word(rng, 2, 3)}`,
      `${word(rng, 1, 2)} Caldera`,
      `The ${word(rng, 1, 2)} Forge`,
      `${word(rng, 2, 2)} Inferno`,
      `${word(rng, 1, 2)} Peak`,
    ]),
    mood,
    night: true,
    // A lit, smoky sky behind the play band: the basalt and the ridges are dark against it, never dark on dark.
    sky: inf ? [hsl3(355, 32, 30), hsl3(12, 46, 54), hsl3(26, 75, 64)] : [hsl3(262, 22, 28), hsl3(345, 32, 50), hsl3(18, 60, 58)],
    fog: inf ? hsl3(14, 36, 50) : hsl3(348, 22, 42),
    // The lava's light on the smoke sits behind the play band, not down at the pool.
    horizon: { color: hsl3(lavaHue, 100, 58), strength: inf ? 0.75 : 0.65, y: 0.56 },
    celestial: inf
      ? celestial(rng, 'eclipse', hsl3(0, 0, 4), [0.2, 0.8], [0.12, 0.22], [14, 20], hsl3(lavaHue + 10, 100, 62))
      : celestial(rng, 'moon', hsl3(15, 50, 70), [0.2, 0.8], [0.12, 0.22], [14, 18], hsl3(10, 80, 55)),
    stars: inf ? 0 : 60,
    layers: layers(rng, [
      {
        kind: 'volcano',
        base: 0.4,
        amp: 0.05,
        color: inf ? hsl3(5, 26, 17) : hsl3(300, 12, 15),
        glow: hsl3(lavaHue + 5, 100, 58),
        lit: 1,
        haze: 0.4,
        depth: 0.05,
      },
      { kind: 'crags', base: 0.6, amp: 0.08, color: inf ? hsl3(5, 22, 8) : hsl3(300, 10, 8), glow: hsl3(lavaHue, 100, 55), lit: 0.6, haze: 0.16, depth: 0.18 },
      { kind: 'crags', base: 0.76, amp: 0.06, color: hsl3(10, 15, 5), glow: hsl3(lavaHue, 100, 55), lit: 0.8, haze: 0.08, depth: 0.34 },
    ]),
    clouds: rng.int(5, 8),
    cloudStyle: 'ash',
    cloudColor: inf ? hsl3(8, 26, 30) : hsl3(330, 14, 28),
    rays: false,
    terrain: {
      kind: 'basalt',
      ...mat(jit(rng, hsl3(15, 10, 17)), 0.45, 1.4),
      cap: 'ash',
      capColor: hsl3(20, 8, 46),
      vein: hsl3(lavaHue + 6, 100, 56),
      veins: true,
      outline: hsl3(0, 30, 4),
      sub: null,
      platform: { kind: 'stone', color: hsl3(15, 12, 26) },
    },
    liquid: { kind: 'lava', color: hsl3(lavaHue, 100, 48), glow: hsl3(lavaHue + 14, 100, 60), emissive: true },
    ambient: 'embers',
    // The backdrop prints at about ambient^0.6 of itself: below this the smoky sky goes back to near black.
    ambientLight: inf ? rng.range(0.58, 0.66) : rng.range(0.5, 0.58),
    ambientTint: hsl3(lavaHue, 80, 62),
    decor: pickDecor(rng, 'volcano', ['fumarole', 'obsidian'], 4),
    decorDensity: 0.13,
    lamp: hsl3(lavaHue + 8, 100, 58),
    accent: hsl3(rng.pick([190, 280, 50]), 95, 62),
    grade: inf
      ? { tint: [1.12, 0.96, 0.84], lift: [0.03, 0.008, 0.0], exposure: 1.08 }
      : { tint: [1.06, 0.96, 0.96], lift: [0.02, 0.006, 0.02], exposure: 1.12 },
  });
}

function harbor(rng: Rng): Look {
  const mood = rng.weighted<Mood>([
    ['golden', 5],
    ['day', 3],
    ['night', 2.5],
  ]);
  const night = mood === 'night';
  const golden = mood === 'golden';
  const sea = golden ? hsl3(205, 40, 40) : night ? hsl3(218, 45, 16) : hsl3(198, 60, 42);
  const wood = jit(rng, hsl3(26, 34, 31));
  const sunCol = golden ? hsl3(36, 100, 74) : hsl3(52, 100, 92);
  return look(rng, {
    name: rng.pick([`Port ${word(rng, 2, 3)}`, `${word(rng, 1, 2)} Wharf`, `${word(rng, 1, 2)} Bay`, `${word(rng, 2, 2)} Docks`, `${word(rng, 1, 2)} Cove`]),
    mood,
    night,
    sky: golden
      ? [hsl3(214, 42, 38), hsl3(20, 58, 58), hsl3(38, 85, 68)]
      : night
        ? [hsl3(228, 50, 8), hsl3(225, 40, 17), hsl3(215, 35, 28)]
        : [hsl3(205, 70, 50), hsl3(198, 62, 68), hsl3(192, 50, 84)],
    fog: golden ? hsl3(28, 50, 68) : night ? hsl3(220, 35, 22) : hsl3(198, 40, 76),
    horizon: { color: golden ? hsl3(32, 100, 70) : night ? hsl3(215, 40, 40) : hsl3(190, 50, 90), strength: golden ? 0.55 : 0.2, y: 0.6 },
    celestial: golden
      ? celestial(rng, 'sun', sunCol, [0.3, 0.7], [0.44, 0.52], [26, 32])
      : night
        ? celestial(rng, 'moon', hsl3(210, 25, 90), [0.2, 0.8], [0.12, 0.22], [16, 22])
        : celestial(rng, 'sun', sunCol, [0.2, 0.8], [0.12, 0.22], [16, 20]),
    stars: night ? 140 : 0,
    layers: layers(rng, [
      {
        kind: 'sea',
        base: 0.6,
        amp: 0.04,
        color: sea,
        detail: night ? hsl3(225, 30, 7) : golden ? hsl3(250, 18, 42) : hsl3(150, 18, 55),
        glow: hsl3(48, 100, 75),
        lit: 1,
        haze: 0.24,
        depth: 0.05,
      },
      {
        kind: 'ships',
        base: 0.62,
        amp: 0.02,
        color: golden ? hsl3(260, 20, 26) : night ? hsl3(225, 25, 10) : hsl3(210, 20, 36),
        detail: golden ? hsl3(35, 50, 70) : night ? hsl3(220, 15, 30) : hsl3(40, 30, 90),
        glow: hsl3(42, 100, 62),
        lit: night ? 0.8 : 0.2,
        haze: 0.16,
        depth: 0.16,
      },
      {
        kind: 'docks',
        base: 0.72,
        amp: 0.03,
        color: golden ? hsl3(255, 22, 16) : night ? hsl3(225, 25, 6) : hsl3(210, 22, 24),
        detail: golden ? hsl3(15, 40, 30) : night ? hsl3(220, 20, 14) : hsl3(10, 35, 38),
        glow: hsl3(42, 100, 62),
        lit: night ? 0.7 : 0.25,
        haze: 0.06,
        depth: 0.34,
      },
    ]),
    clouds: night ? rng.int(1, 3) : rng.int(4, 8),
    cloudStyle: golden ? 'wispy' : 'puffy',
    cloudColor: golden ? hsl3(25, 80, 80) : night ? hsl3(225, 20, 26) : hsl3(205, 30, 97),
    rays: !night,
    terrain: {
      kind: 'planks',
      ...mat(wood, 0.5, 1.5),
      cap: 'beam',
      capColor: jit(rng, hsl3(30, 35, 44)),
      vein: hsl3(45, 80, 60),
      veins: false,
      outline: hsl3(25, 40, 8),
      sub: { kind: 'cobble', ...mat(jit(rng, hsl3(35, 10, 42))), depth: 2 },
      platform: { kind: 'wood', color: hsl3(30, 35, 40) },
    },
    liquid: { kind: 'sea', color: sea, glow: golden ? hsl3(40, 90, 80) : hsl3(190, 60, 85), emissive: false },
    ambient: 'dust',
    ambientLight: golden ? rng.range(0.74, 0.82) : night ? rng.range(0.42, 0.5) : rng.range(0.86, 0.94),
    ambientTint: golden ? hsl3(32, 75, 78) : night ? hsl3(220, 45, 62) : hsl3(200, 25, 92),
    decor: pickDecor(rng, 'harbor', ['barrel', 'rope', 'lamppost'], 7),
    decorDensity: 0.17,
    lamp: hsl3(40, 100, 62),
    accent: hsl3(rng.pick([5, 50, 160]), 90, 58),
    grade: golden
      ? { tint: [1.09, 1.0, 0.9], lift: [0.02, 0.012, 0.01], exposure: 1.02 }
      : night
        ? { tint: [0.94, 0.99, 1.1], lift: [0.006, 0.014, 0.035], exposure: 1.18 }
        : { tint: [1.0, 1.01, 1.02], lift: [0.004, 0.008, 0.012], exposure: 0.95 },
  });
}

function mine(rng: Rng): Look {
  const crystalHue = rng.pick([185, 200, 285, 320, 150]);
  const acid = rng.chance(0.6);
  return look(rng, {
    name: rng.pick([
      `${word(rng, 1, 2)} Mine`,
      `Shaft ${rng.int(3, 19)}`,
      `The ${word(rng, 1, 2)} Dig`,
      `${word(rng, 2, 2)} Lode`,
      `${word(rng, 1, 2)} Quarry`,
    ]),
    mood: 'underground',
    night: true,
    sky: [hsl3(28, 18, 4), hsl3(25, 22, 9), hsl3(30, 30, 15)],
    fog: hsl3(28, 25, 15),
    horizon: { color: hsl3(crystalHue, 60, 40), strength: 0.2, y: 0.75 },
    celestial: NONE,
    stars: 0,
    layers: layers(rng, [
      { kind: 'cave', base: 0.5, amp: 0.1, color: hsl3(28, 18, 13), glow: hsl3(crystalHue, 90, 62), lit: 0.6, haze: 0.45, depth: 0.06 },
      {
        kind: 'mineshaft',
        base: 0.62,
        amp: 0.05,
        color: hsl3(25, 30, 9),
        detail: hsl3(28, 40, 22),
        glow: hsl3(38, 100, 60),
        lit: 0.8,
        haze: 0.25,
        depth: 0.18,
      },
      { kind: 'cave', base: 0.72, amp: 0.08, color: hsl3(25, 18, 5), glow: hsl3(crystalHue, 90, 60), lit: 0.4, haze: 0.08, depth: 0.32 },
    ]),
    clouds: 0,
    cloudStyle: 'wispy',
    cloudColor: hsl3(28, 20, 20),
    rays: rng.chance(0.7),
    terrain: {
      kind: 'cave',
      ...mat(jit(rng, hsl3(28, 14, 27)), 0.45, 1.5),
      cap: rng.chance(0.5) ? 'crystal' : 'gravel',
      capColor: hsl3(30, 12, 42),
      vein: hsl3(crystalHue, 95, 62),
      veins: true,
      outline: hsl3(25, 30, 4),
      sub: rng.chance(0.5) ? { kind: 'strata', ...mat(jit(rng, hsl3(25, 16, 24))), depth: 3 } : null,
      platform: { kind: 'wood', color: hsl3(30, 40, 36) },
    },
    liquid: acid
      ? { kind: 'acid', color: hsl3(95, 90, 38), glow: hsl3(85, 100, 60), emissive: true }
      : { kind: 'tar', color: hsl3(250, 15, 9), glow: hsl3(30, 70, 50), emissive: false },
    ambient: rng.pick(['dust', 'spores'] as const),
    ambientLight: rng.range(0.34, 0.42),
    ambientTint: hsl3(32, 45, 60),
    decor: pickDecor(rng, 'mine', ['lantern', 'support', 'crystal'], 6),
    decorDensity: 0.16,
    lamp: hsl3(36, 100, 60),
    accent: hsl3(crystalHue, 90, 62),
    grade: { tint: [1.06, 0.98, 0.92], lift: [0.02, 0.014, 0.012], exposure: 1.18 },
  });
}

function rooftops(rng: Rng): Look {
  const mood = rng.weighted<Mood>([
    ['night', 5],
    ['dusk', 3],
  ]);
  const dusk = mood === 'dusk';
  const neonA = hsl3(rng.pick([320, 190, 280]), 100, 62);
  const brickish = rng.chance(0.55);
  return look(rng, {
    name: rng.pick([
      `${word(rng, 2, 3)} Heights`,
      `${word(rng, 1, 2)} District`,
      `Neo ${word(rng, 2, 2)}`,
      `${word(rng, 1, 2)} Skyline`,
      `Downtown ${word(rng, 1, 2)}`,
    ]),
    mood,
    night: !dusk,
    sky: dusk ? [hsl3(250, 36, 17), hsl3(312, 30, 29), hsl3(16, 48, 40)] : [hsl3(245, 42, 7), hsl3(262, 30, 12), hsl3(285, 28, 18)],
    fog: dusk ? hsl3(300, 20, 27) : hsl3(272, 24, 15),
    horizon: { color: dusk ? hsl3(22, 80, 55) : neonA, strength: dusk ? 0.26 : 0.16, y: 0.75 },
    celestial: dusk
      ? celestial(rng, 'sun', hsl3(16, 70, 56), [0.25, 0.75], [0.44, 0.52], [24, 30])
      : celestial(rng, 'moon', hsl3(260, 30, 88), [0.15, 0.85], [0.1, 0.2], [14, 20]),
    stars: 0,
    layers: layers(rng, [
      {
        kind: 'skyscrapers',
        base: 0.36,
        amp: 0.08,
        color: dusk ? hsl3(290, 18, 26) : hsl3(255, 22, 12),
        glow: hsl3(45, 90, 70),
        lit: 0,
        haze: 0.62,
        depth: 0.06,
      },
      {
        kind: 'skyscrapers',
        base: 0.48,
        amp: 0.08,
        color: dusk ? hsl3(280, 18, 17) : hsl3(250, 22, 9),
        detail: neonA,
        glow: hsl3(46, 80, 62),
        lit: dusk ? 0.09 : 0.13,
        haze: 0.42,
        depth: 0.16,
      },
      {
        kind: 'rooftops',
        base: 0.7,
        amp: 0.04,
        color: dusk ? hsl3(270, 20, 10) : hsl3(245, 22, 5),
        detail: neonA,
        glow: hsl3(42, 90, 58),
        lit: 0.22,
        haze: 0.08,
        depth: 0.32,
      },
    ]),
    clouds: rng.int(1, 4),
    cloudStyle: 'wispy',
    cloudColor: dusk ? hsl3(330, 45, 62) : hsl3(270, 25, 24),
    rays: false,
    terrain: {
      kind: brickish ? 'brick' : 'concrete',
      ...mat(brickish ? jit(rng, hsl3(12, 36, 32)) : jit(rng, hsl3(220, 6, 40)), 0.5, 1.45),
      cap: 'ledge',
      capColor: hsl3(215, 8, 70),
      vein: neonA,
      veins: false,
      outline: hsl3(250, 30, 5),
      sub: brickish ? null : { kind: 'brick', ...mat(jit(rng, hsl3(14, 30, 28))), depth: 2 },
      platform: { kind: 'grate', color: hsl3(220, 10, 46) },
    },
    liquid: { kind: 'street', color: hsl3(250, 25, 8), glow: neonA, emissive: true },
    ambient: 'dust',
    ambientLight: dusk ? rng.range(0.6, 0.68) : rng.range(0.42, 0.5),
    ambientTint: dusk ? hsl3(320, 45, 72) : hsl3(265, 45, 64),
    decor: pickDecor(rng, 'rooftops', ['antenna', 'acunit', 'neon'], 6),
    decorDensity: 0.15,
    lamp: hsl3(45, 95, 65),
    accent: hsl3(rng.pick([50, 160, 20]), 95, 58),
    grade: dusk
      ? { tint: [1.04, 0.97, 1.0], lift: [0.015, 0.008, 0.025], exposure: 1.0 }
      : { tint: [1.0, 0.95, 1.08], lift: [0.015, 0.006, 0.035], exposure: 1.16 },
  });
}

function glacier(rng: Rng): Look {
  const mood = rng.weighted<Mood>([
    ['day', 3.5],
    ['night', 3.5],
    ['overcast', 2],
  ]);
  const night = mood === 'night';
  const overcast = mood === 'overcast';
  // The aurora's hue: one curtain color per level, green most often.
  const aur = rng.weighted<number>([
    [140, 5],
    [165, 2],
    [290, 1.5],
  ]);
  const rock = jit(rng, night ? hsl3(222, 16, 26) : hsl3(rng.range(205, 225), 12, 34), 4, 4, 3);
  const iceHue = rng.range(188, 200);
  return look(rng, {
    name: rng.pick([
      `${word(rng, 2, 3)} Glacier`,
      `Mount ${word(rng, 1, 2)}`,
      `The ${word(rng, 1, 2)} Icefall`,
      `Camp ${rng.int(2, 9)}`,
      `${word(rng, 1, 2)} Pass`,
    ]),
    mood,
    night,
    sky: night
      ? [hsl3(232, 55, 7), hsl3(222, 45, 14), hsl3(205, 40, 24)]
      : overcast
        ? [hsl3(212, 14, 56), hsl3(208, 14, 70), hsl3(205, 16, 82)]
        : [hsl3(212, 72, 44), hsl3(202, 62, 66), hsl3(192, 50, 86)],
    fog: night ? hsl3(215, 35, 22) : overcast ? hsl3(208, 15, 78) : hsl3(198, 40, 84),
    horizon: night ? { color: hsl3(aur, 70, 50), strength: 0.25, y: 0.62 } : { color: hsl3(195, 50, 94), strength: overcast ? 0.1 : 0.22, y: 0.6 },
    celestial: night
      ? celestial(rng, 'moon', hsl3(205, 30, 92), [0.15, 0.85], [0.1, 0.2], [12, 18])
      : overcast
        ? NONE
        : celestial(rng, 'sun', hsl3(52, 60, 96), [0.2, 0.8], [0.1, 0.22], [14, 18]),
    stars: night ? 170 : 0,
    layers: layers(rng, [
      ...(night
        ? [
            {
              kind: 'aurora' as const,
              base: 0.3,
              amp: 0.1,
              color: hsl3(aur, 80, 55),
              detail: hsl3(aur + 40, 80, 60),
              glow: hsl3(aur, 90, 62),
              lit: 1,
              haze: 0.1,
              depth: 0.02,
            },
          ]
        : []),
      {
        kind: 'peaks',
        base: 0.48,
        amp: 0.14,
        color: night ? hsl3(222, 28, 22) : overcast ? hsl3(210, 10, 66) : hsl3(212, 28, 62),
        detail: night ? hsl3(215, 30, 58) : hsl3(200, 30, 96),
        haze: 0.45,
        depth: 0.06,
      },
      {
        kind: 'icefall',
        base: 0.6,
        amp: 0.06,
        color: night ? hsl3(215, 30, 30) : hsl3(198, 38, 72),
        detail: night ? hsl3(190, 50, 50) : hsl3(iceHue, 70, 62),
        glow: hsl3(42, 100, 62),
        lit: night ? 0.7 : 0.2,
        haze: 0.22,
        depth: 0.18,
      },
      {
        kind: 'peaks',
        base: 0.74,
        amp: 0.06,
        color: night ? hsl3(225, 25, 14) : hsl3(212, 18, 40),
        detail: night ? hsl3(215, 25, 46) : hsl3(205, 25, 92),
        haze: 0.08,
        depth: 0.34,
      },
    ]),
    clouds: overcast ? rng.int(7, 11) : night ? rng.int(0, 2) : rng.int(2, 5),
    cloudStyle: overcast ? 'puffy' : 'wispy',
    cloudColor: night ? hsl3(220, 25, 24) : overcast ? hsl3(208, 10, 86) : hsl3(205, 30, 97),
    rays: mood === 'day' && rng.chance(0.6),
    terrain: {
      kind: 'rock',
      ...mat(rock, 0.5, 1.6),
      cap: 'gravel',
      capColor: hsl3(212, 10, 66),
      vein: hsl3(iceHue, 80, 70),
      veins: false,
      outline: hsl3(224, 40, 8),
      sub: rng.chance(0.5) ? { kind: 'strata', ...mat(jit(rng, hsl3(220, 14, 24))), depth: 4 } : null,
      platform: { kind: 'wood', color: jit(rng, hsl3(28, 38, 40)) },
      ice: {
        base: hsl3(iceHue, night ? 48 : 62, night ? 52 : 72),
        dark: hsl3(iceHue + 14, night ? 50 : 58, night ? 34 : 50),
        light: hsl3(iceHue - 8, 70, night ? 74 : 92),
      },
    },
    liquid: { kind: 'water', color: hsl3(iceHue + 6, 55, night ? 18 : 30), glow: hsl3(iceHue, 70, 82), emissive: false },
    ambient: 'dust',
    ambientLight: night ? rng.range(0.44, 0.52) : overcast ? rng.range(0.78, 0.86) : rng.range(0.88, 0.96),
    ambientTint: night ? hsl3(aur, 35, 70) : hsl3(200, 30, 94),
    decor: pickDecor(rng, 'glacier', ['cairn', 'icicles'], 4),
    decorDensity: 0.12,
    lamp: hsl3(40, 95, 62),
    accent: hsl3(rng.pick([5, 28, 48]), 92, 56),
    grade: night
      ? { tint: [0.92, 1.0, 1.1], lift: [0.006, 0.016, 0.035], exposure: 1.16 }
      : overcast
        ? { tint: [0.98, 1.0, 1.04], lift: [0.014, 0.016, 0.02], exposure: 0.98 }
        : { tint: [0.97, 1.0, 1.05], lift: [0.006, 0.01, 0.018], exposure: 0.96 },
  });
}

function space(rng: Rng): Look {
  // A station or an asteroid field: the sculptor reads the terrain kind, so the shape matches the material.
  const station = rng.chance(0.5);
  const mood = rng.weighted<Mood>([
    ['night', 6],
    ['dusk', 2],
  ]);
  const neb = rng.pick([280, 320, 200, 250]);
  const planetHue = rng.pick([20, 35, 190, 160, 330]);
  const hull = jit(rng, hsl3(rng.range(205, 225), 8, 62), 4, 3, 4);
  const regolith = jit(rng, hsl3(rng.range(20, 40), 10, 36), 6, 4, 4);
  return look(rng, {
    name: rng.pick([
      station ? `${word(rng, 1, 2)} Station` : `${word(rng, 2, 3)} Belt`,
      station ? `Outpost ${rng.int(3, 99)}` : `Rock ${rng.int(3, 999)}`,
      `${word(rng, 2, 2)} Orbit`,
      `Dock ${String.fromCharCode(65 + rng.int(0, 25))}-${rng.int(1, 9)}`,
      `The ${word(rng, 1, 2)} Drift`,
    ]),
    mood,
    night: true,
    sky: mood === 'dusk' ? [hsl3(250, 50, 6), hsl3(neb, 40, 13), hsl3(neb + 20, 45, 24)] : [hsl3(240, 45, 3), hsl3(250, 40, 7), hsl3(neb, 35, 13)],
    fog: hsl3(neb, 30, 12),
    horizon: { color: hsl3(planetHue, 70, 58), strength: 0.3, y: 0.82 },
    celestial: celestial(rng, rng.chance(0.6) ? 'sun' : 'moon', hsl3(rng.pick([45, 200]), 40, 96), [0.15, 0.85], [0.1, 0.22], [6, 9], hsl3(45, 80, 80)),
    stars: 320,
    layers: deeper(
      layers(rng, [
        {
          kind: 'planet',
          base: 0.62,
          amp: 0.05,
          color: hsl3(planetHue, 40, mood === 'dusk' ? 40 : 30),
          detail: hsl3(planetHue + 25, 45, 52),
          glow: hsl3(planetHue, 80, 66),
          lit: 1,
          haze: 0.1,
          depth: 0.03,
        },
        {
          kind: 'orbital',
          base: 0.45,
          amp: 0.06,
          color: hsl3(225, 18, 22),
          detail: hsl3(215, 25, 40),
          glow: hsl3(rng.pick([0, 190, 48]), 100, 62),
          lit: 0.7,
          haze: 0.3,
          depth: 0.12,
        },
        {
          kind: 'debris',
          base: 0.7,
          amp: 0.12,
          color: hsl3(250, 14, 12),
          detail: hsl3(250, 14, 24),
          haze: 0.1,
          depth: 0.3,
        },
      ]),
      1,
      { kind: 'debris', base: 0.42, amp: 0.1, color: hsl3(neb, 16, 16), detail: hsl3(neb, 18, 28), haze: 0.45, depth: 0.07 },
    ),
    clouds: 0,
    cloudStyle: 'wispy',
    cloudColor: hsl3(neb, 30, 24),
    rays: false,
    terrain: station
      ? {
          kind: 'hull',
          ...mat(hull, 0.55, 1.3),
          cap: 'trim',
          capColor: hsl3(48, 95, 54),
          vein: hsl3(rng.pick([190, 0, 140]), 100, 60),
          veins: false,
          outline: hsl3(230, 30, 6),
          sub: { kind: 'metal', ...mat(jit(rng, hsl3(220, 10, 34)), 0.5, 1.4), depth: 2 },
          platform: { kind: 'grate', color: hsl3(215, 10, 56) },
        }
      : {
          kind: 'regolith',
          ...mat(regolith, 0.5, 1.6),
          cap: rng.chance(0.4) ? 'crystal' : 'gravel',
          capColor: hsl3(30, 8, 52),
          vein: hsl3(rng.pick([170, 280, 320]), 95, 62),
          veins: rng.chance(0.4),
          outline: hsl3(250, 30, 5),
          sub: null,
          platform: { kind: 'grate', color: hsl3(215, 10, 50) },
        },
    // The pit is the top of the planet's air: fall in and you burn up, so it glows faintly where it starts.
    liquid: { kind: 'void', color: hsl3(neb, 35, 8), glow: hsl3(neb + 20, 60, 46), emissive: true },
    ambient: 'dust',
    ambientLight: rng.range(0.5, 0.6),
    ambientTint: hsl3(neb, 30, 80),
    decor: station
      ? pickDecor(rng, 'space', ['beacon', 'dish'], 5, ['antenna', 'cable', 'lander', 'cargopod', 'solarpanel', 'warnlamp', 'wrench', 'helmet'])
      : pickDecor(rng, 'space', ['crystal', 'moonrock'], 5, ['lander', 'pennant', 'beacon', 'bones', 'moonflag', 'minisat', 'helmet', 'wrench']),
    decorDensity: 0.1,
    lamp: hsl3(195, 80, 70),
    accent: hsl3(rng.pick([48, 190, 330]), 95, 60),
    grade: { tint: [0.98, 0.98, 1.06], lift: [0.012, 0.01, 0.03], exposure: 1.12 },
  });
}

export const RECIPES: Record<ThemeId, (rng: Rng) => Look> = { farm, factory, castle, jungle, volcano, harbor, mine, rooftops, glacier, space };
