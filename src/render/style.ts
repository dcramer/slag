/**
 * Art styles. The look is a presentation choice (never sim state), persisted per browser under
 * `slag.render.v1` and overridable per page with `?style=cel`. Pure helpers so they can be tested
 * without a DOM. Add a style by adding it to `STYLES`; the Settings picker follows.
 */
export interface StyleDef {
  /** Settings chip. */
  label: string;
  /** Draws through the cel pass: foreground layer, flat terrain, light bands, ink (cel-shader.ts). */
  cel: boolean;
  /** Impact words on sim events (`Lettering` in cel.ts). One flag, so they can be judged apart from the look. */
  lettering: boolean;
}

export const STYLES = {
  classic: { label: 'Classic', cel: false, lettering: false },
  cel: { label: 'Cel', cel: true, lettering: true },
} as const satisfies Record<string, StyleDef>;

export type RenderStyle = keyof typeof STYLES;

export const STYLE_IDS = Object.keys(STYLES) as RenderStyle[];

/** What a new player gets. Flip this one line to change the game's main look. */
export const DEFAULT_STYLE: RenderStyle = 'classic';

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
  return typeof v === 'string' && (STYLE_IDS as readonly string[]).includes(v);
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
    return { style: isRenderStyle(v?.style) ? v.style : DEFAULT_STYLE };
  } catch {
    return { style: DEFAULT_STYLE };
  }
}

export function saveRenderSettings(s: RenderSettings, storage: KV | null = defaultStorage()): void {
  try {
    storage?.setItem(RENDER_KEY, JSON.stringify({ style: isRenderStyle(s.style) ? s.style : DEFAULT_STYLE }));
  } catch {
    // Quota / privacy mode: the setting just won't persist.
  }
}

/** URL `?style=` wins (for sharing / screenshots), then the saved setting. */
export function initialStyle(search: string, storage: KV | null = defaultStorage()): RenderStyle {
  const q = new URLSearchParams(search).get('style');
  return isRenderStyle(q) ? q : loadRenderSettings(storage).style;
}

/** `?lettering=0` turns impact words off for this page, to compare a style with and without them. */
export function letteringAllowed(search: string): boolean {
  return new URLSearchParams(search).get('lettering') !== '0';
}
