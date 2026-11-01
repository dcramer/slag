import { deriveSeed, Rng } from '../core/rng';
import { placeName } from './names';

export type Skyline = 'hills' | 'spires' | 'blobs' | 'mesas';

export interface Theme {
  name: string;
  hue: number;
  skyTop: string;
  skyBottom: string;
  far: string;
  near: string;
  ground: string;
  groundDark: string;
  groundTop: string;
  accent: string;
  skyline: Skyline;
  stars: boolean;
  /** Parameters for the skyline silhouettes, generated once so rendering stays stable. */
  layers: { base: number; amp: number; freqs: number[]; phases: number[] }[];
}

export function hsl(h: number, s: number, l: number, a = 1): string {
  const hh = ((h % 360) + 360) % 360;
  return a === 1 ? `hsl(${hh.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)` : `hsl(${hh.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}% / ${a})`;
}

export function generateTheme(seed: number): Theme {
  const rng = new Rng(deriveSeed(seed, 'theme'));
  const hue = rng.range(0, 360);
  const night = rng.chance(0.4);
  // Ground hue is offset from sky so terrain reads clearly against the background.
  const gHue = hue + rng.pick([150, 180, 200, 120, -140]);
  const skyS = rng.range(35, 70);
  const layers = [0, 1].map((i) => ({
    base: i === 0 ? rng.range(0.45, 0.6) : rng.range(0.62, 0.78),
    amp: rng.range(0.05, 0.16),
    freqs: [rng.range(0.8, 2), rng.range(2.5, 5), rng.range(6, 11)],
    phases: [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)],
  }));
  return {
    name: placeName(rng),
    hue,
    skyTop: night ? hsl(hue, skyS, 9) : hsl(hue, skyS, 62),
    skyBottom: night ? hsl(hue + 30, skyS, 22) : hsl(hue + 25, skyS + 10, 82),
    far: night ? hsl(hue + 10, skyS * 0.6, 17) : hsl(hue + 10, skyS * 0.5, 66),
    near: night ? hsl(hue + 20, skyS * 0.6, 13) : hsl(hue + 15, skyS * 0.5, 54),
    ground: hsl(gHue, rng.range(20, 45), night ? 30 : 36),
    groundDark: hsl(gHue, rng.range(20, 40), night ? 18 : 24),
    groundTop: hsl(gHue + rng.range(-40, 40), rng.range(45, 75), night ? 52 : 58),
    accent: hsl(hue + 180, 80, 60),
    skyline: rng.pick(['hills', 'spires', 'blobs', 'mesas'] as const),
    stars: night,
    layers,
  };
}
