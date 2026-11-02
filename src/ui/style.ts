/**
 * The UI design tokens: one palette and one type system shared by the
 * Canvas2D HUD (src/render/hud.ts), the DOM overlays (src/ui/menus.ts) and
 * the DOM screens (src/ui/screens/css.ts mirrors these as CSS variables).
 * Pure constants, safe to import anywhere. See docs/ART.md for the rules.
 */

/** Foundry palette: warm iron and soot, molten accents, bone text. */
export const PAL = {
  /** Outlines, hard drop shadows. */
  ink: '#120b08',
  /** Recessed / empty surfaces. */
  soot: '#1a1210',
  /** Default plate fill. */
  iron: '#2b201b',
  /** Plate top bevel / hover fill. */
  ironHi: '#3d2e26',
  /** Rivets, dividers, disabled strokes. */
  steel: '#6e625a',
  /** Primary text. */
  bone: '#f6ead8',
  /** Secondary text (≥ 7:1 on iron). */
  ash: '#c9b8a3',
  /** Tertiary text on soot; never smaller than the caption size. */
  dim: '#9b8a78',
  /** Primary accent: buttons, focus, highlights. */
  molten: '#ff6a1f',
  amber: '#ffb02e',
  whiteHot: '#fff1b8',
  ember: '#b8230f',
  /** Success / ready. */
  toxic: '#a6e22e',
  /** Danger / urgent. */
  danger: '#ff4a3d',
  /** Hazard-tape yellow. */
  hazard: '#f2b705',
} as const;

/** Font stacks: one display face, one UI face. Loaded from FONTS_HREF (src/ui/screens/css.ts). */
export const FONT = {
  display: '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif',
  ui: 'Barlow, "Segoe UI", system-ui, sans-serif',
} as const;

/**
 * HUD type scale, in logical view px (the HUD is 768×432 scaled to the
 * window; 1 px ≈ 1.67 CSS px at 1280×720). Nothing smaller than `caption`.
 */
export const TYPE = {
  caption: 8,
  body: 9.5,
  label: 11,
  head: 16,
  title: 30,
  hero: 56,
} as const;
