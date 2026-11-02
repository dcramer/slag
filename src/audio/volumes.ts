/**
 * Volume settings: three 0..1 sliders (master / music / effects) plus a
 * mute switch that keeps the slider positions, persisted per browser.
 * Pure helpers so they can be tested without a DOM.
 */
export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  /** Silences everything without losing the slider positions. Omitted when false. */
  muted?: boolean;
}

export const VOLUME_KEY = 'slag.audio.v1';
export const DEFAULT_VOLUMES: Readonly<Volumes> = Object.freeze({ master: 0.8, music: 0.6, sfx: 0.9 });

/** Minimal Storage shape (localStorage, or a Map-backed fake in tests). */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const clamp01 = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

export function sanitizeVolumes(v: Partial<Record<keyof Volumes, unknown>> | null | undefined): Volumes {
  const out: Volumes = {
    master: clamp01(v?.master, DEFAULT_VOLUMES.master),
    music: clamp01(v?.music, DEFAULT_VOLUMES.music),
    sfx: clamp01(v?.sfx, DEFAULT_VOLUMES.sfx),
  };
  if (v?.muted === true) out.muted = true;
  return out;
}

/** Master bus gain for these settings (0 while muted). */
export function masterGain(v: Volumes): number {
  return v.muted ? 0 : sliderGain(v.master);
}

/** `localStorage` if the browser lets us touch it (private modes can throw). */
export function defaultStorage(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadVolumes(storage: KV | null = defaultStorage()): Volumes {
  try {
    const raw = storage?.getItem(VOLUME_KEY);
    return sanitizeVolumes(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_VOLUMES };
  }
}

export function saveVolumes(v: Volumes, storage: KV | null = defaultStorage()): void {
  try {
    storage?.setItem(VOLUME_KEY, JSON.stringify(sanitizeVolumes(v)));
  } catch {
    // Quota / privacy mode: volumes just won't persist.
  }
}

/** Slider position → linear gain. Squared so the slider feels even in loudness (≈ dB-ish taper). */
export function sliderGain(v: number): number {
  return v <= 0 ? 0 : v * v;
}
