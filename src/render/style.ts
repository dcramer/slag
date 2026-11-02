/**
 * Render style selection. The look is a presentation choice (never sim
 * state), persisted per browser under `slag.render.v1` and overridable per
 * page with `?style=comic`. Pure helpers so they can be tested without a DOM.
 *
 *   default  lit, bloomed, ACES-tonemapped "painterly neon" look
 *   comic    printed look: ink silhouettes, flat tones, dot screens, lettering (comic-shader.ts, comic.ts)
 */
export const RENDER_STYLES = ['default', 'comic'] as const;
export type RenderStyle = (typeof RENDER_STYLES)[number];

export const RENDER_KEY = 'slag.render.v1';

export interface RenderSettings {
  style: RenderStyle;
}

/** Minimal Storage shape (localStorage, or a Map-backed fake in tests). */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function isRenderStyle(v: unknown): v is RenderStyle {
  return typeof v === 'string' && (RENDER_STYLES as readonly string[]).includes(v);
}

function defaultStorage(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadRenderSettings(storage: KV | null = defaultStorage()): RenderSettings {
  try {
    const raw = storage?.getItem(RENDER_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<RenderSettings>) : null;
    return { style: isRenderStyle(v?.style) ? v.style : 'default' };
  } catch {
    return { style: 'default' };
  }
}

export function saveRenderSettings(s: RenderSettings, storage: KV | null = defaultStorage()): void {
  try {
    storage?.setItem(RENDER_KEY, JSON.stringify({ style: isRenderStyle(s.style) ? s.style : 'default' }));
  } catch {
    // Quota / privacy mode: the setting just won't persist.
  }
}

/** URL `?style=` wins (for sharing / screenshots), then the saved setting. */
export function initialStyle(search: string, storage: KV | null = defaultStorage()): RenderStyle {
  const q = new URLSearchParams(search).get('style');
  return isRenderStyle(q) ? q : loadRenderSettings(storage).style;
}
