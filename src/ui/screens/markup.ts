import { type Glyph, glyphSVG, type PadButton } from '../glyphs';
import { logoSVG } from './logo-art';

/**
 * Markup of the DOM screens as plain strings: the main menu, the 404 and
 * error screens, and the logo. Pure and deterministic, so a host may
 * server-render it for a fast first paint (app/ does), and the screen code
 * adopts what's already on the page instead of building it again. Styles are
 * in ./css.ts; behavior is in ./home.ts and ./plain.ts.
 */

export type MenuItemId = 'play' | 'join' | 'codex' | 'settings';

export const MENU_ITEMS: readonly { id: MenuItemId; title: string; sub: string }[] = [
  { id: 'play', title: 'PLAY', sub: 'Start a New Lobby' },
  { id: 'join', title: 'JOIN A LOBBY', sub: 'Enter a Lobby Code' },
  { id: 'codex', title: 'CODEX', sub: 'Spoilers!' },
  { id: 'settings', title: 'SETTINGS', sub: 'Audio, Video and Controls' },
];

/**
 * The SLAG logo: the inked SVG (./logo-art.ts), with the word as text for screen readers.
 * One logo everywhere: the main menu shows it as is, the lobby scales it into
 * its top bar (./logo.ts), and the link-preview card is cut from the menu's.
 */
export function logoHTML(tag: 'h1' | 'div' = 'h1'): string {
  return `<${tag} class="logo"><span class="logo-t">SLAG</span>${logoSVG()}</${tag}>`;
}

/** A fixed ember field: same sparks on every visit, and on server and client alike. */
export function embersHTML(): string {
  let out = '';
  for (let i = 0; i < 26; i++) {
    const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
    const size = `${(2 + r(4) * 2.5).toFixed(1)}px`;
    out +=
      `<i style="left:${(r(1) * 100).toFixed(1)}%;animation-duration:${(6 + r(2) * 8).toFixed(1)}s;` +
      `animation-delay:${(-r(3) * 14).toFixed(1)}s;width:${size};height:${size};--dx:${((r(5) - 0.5) * 120).toFixed(0)}px"></i>`;
  }
  return out;
}

const glyph = (g: Glyph, h = 22) => `<span class="slag-glyph">${glyphSVG(g, h)}</span>`;

/**
 * The main menu's backdrop for every other screen: the same dark, glow, heat
 * shimmer and ember field, pinned to the window so it stays put while a page scrolls.
 */
export function forgeHTML(): string {
  return `<div class="forge-bg" aria-hidden="true"><div class="embers">${embersHTML()}</div></div>`;
}

/** The logo at its full size, scaled as a whole into a box (`--k` in CSS), so drips and outline keep the menu's proportions. */
export function scaledLogoHTML(): string {
  return `<div class="logo-k" aria-hidden="true">${logoHTML('div')}</div>`;
}

/** One footer prompt: keycaps, then the pad's buttons once a pad is plugged in, then the action. `act` makes it a button the screen listens to. */
export function promptHTML(keys: readonly string[], pad: readonly PadButton[] | null, label: string, act?: string): string {
  const glyphs = keys.map((k) => glyph({ kind: 'key', label: k })).join('') + (pad ?? []).map((b) => glyph({ kind: 'pad', button: b })).join('');
  return act ? `<button type="button" class="prompt" data-act="${act}">${glyphs}${label}</button>` : `<span class="prompt">${glyphs}${label}</span>`;
}

/** The main menu's footer prompts: pad glyphs join the keys once a pad is plugged in, and Back shows while a code is being typed. */
export function homePromptsHTML(pad: boolean, joining: boolean): string {
  const padGlyph = (button: 'A' | 'B' | 'DPAD') => (pad ? glyph({ kind: 'pad', button }) : '');
  let out =
    `<span class="prompt">${glyph({ kind: 'key', label: '↑' })}${glyph({ kind: 'key', label: '↓' })}${padGlyph('DPAD')}Select</span>` +
    `<span class="prompt">${glyph({ kind: 'key', label: 'Enter' })}${padGlyph('A')}Confirm</span>`;
  if (joining) out += `<span class="prompt">${glyph({ kind: 'key', label: 'Esc' })}${padGlyph('B')}Back</span>`;
  return out;
}

/**
 * The main menu: logo, console-style menu, the character stage, and the footer prompt bar. Items
 * start disabled and the screen enables them once it listens, so a click that lands before the
 * script has run waits (automation does) instead of vanishing.
 */
export function homeHTML(): string {
  const items = MENU_ITEMS.map(
    (it, i) =>
      `<li><button class="menu-item" data-id="${it.id}" data-active="${i === 0}"${it.id === 'join' ? ' aria-expanded="false"' : ''} disabled>` +
      `<span class="t">${it.title}</span><span class="s">${it.sub}</span><span class="chev"></span></button></li>`,
  ).join('');
  return (
    `<div class="home" data-screen="home"><div class="embers" aria-hidden="true">${embersHTML()}</div>` +
    `<main class="home-main"><div class="brand">${logoHTML()}</div>` +
    `<nav class="menu-wrap" aria-label="Main menu"><ul class="menu">${items}</ul></nav>` +
    `<div class="stage" aria-hidden="true"><canvas></canvas></div></main>` +
    `<footer class="footbar"><span class="meta">1–8 Players</span><div class="prompts" aria-hidden="true">${homePromptsHTML(false, false)}</div></footer></div>`
  );
}

/** The two screens that only say something went wrong and lead back to the menu, and what's sinking in the pool under each. */
const PLAIN_SCREENS = {
  missing: {
    title: 'Lost in the Slag',
    body: 'That lobby code doesn’t look right. Codes are 3–12 letters and numbers.',
    sink: '<span class="sinker sinker-num">404</span>',
  },
  error: { title: 'Something Melted', body: 'The game hit an error it couldn’t recover from.', sink: '<span class="sinker sinker-crate"><i></i></span>' },
} as const;

export type PlainScreen = keyof typeof PLAIN_SCREENS;

/** The pool's surface line, in its SVG's 1200×60 box (stretched to the window's width). */
const POOL_SURFACE = 'M0 26 C120 12 240 34 380 24 S640 10 780 22 S1040 36 1200 20';

/** The 404 and error screens' footer: there's one way out, so one prompt. */
export function plainPromptsHTML(pad: boolean): string {
  return promptHTML(['Enter'], pad ? ['A'] : null, 'Main Menu');
}

/**
 * The 404 and error screens: the menu's logo and backdrop, one plate with the
 * heading, a line and MAIN MENU (already selected), and a pool of slag along
 * the bottom with something sinking in it.
 */
export function plainHTML(kind: PlainScreen): string {
  const s = PLAIN_SCREENS[kind];
  const surface =
    `<svg class="pool-surf" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">` +
    `<defs><linearGradient id="slag-pool-${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.2" stop-color="#ffb02e"/><stop offset="0.75" stop-color="#ff6a1f"/><stop offset="1" stop-color="#f25e1c"/></linearGradient></defs>` +
    `<path d="${POOL_SURFACE} V60 H0 Z" fill="url(#slag-pool-${kind})"/>` +
    `<path d="${POOL_SURFACE}" fill="none" stroke="#120b08" stroke-width="7" vector-effect="non-scaling-stroke"/>` +
    `<path d="${POOL_SURFACE}" fill="none" stroke="#fff1b8" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;
  return (
    `<div class="plain" data-screen="${kind}">${forgeHTML()}` +
    `<div class="plain-pool" aria-hidden="true">${s.sink}${surface}<div class="pool-body"></div></div>` +
    `<main class="plain-main">${scaledLogoHTML()}<section class="plain-card"><h1>${s.title}</h1><p>${s.body}</p>` +
    `<button type="button" class="menu-item btn-link" data-active="true" disabled><span class="t">MAIN MENU</span><span class="chev"></span></button></section></main>` +
    `<footer class="footbar"><div class="prompts" aria-hidden="true">${plainPromptsHTML(false)}</div></footer></div>`
  );
}

/** What a lobby URL paints before the game is up: the game's own dark, edge to edge. */
export function lobbyLoadingHTML(): string {
  return '<div data-screen="lobby" style="position:fixed;inset:0;background:#07060b"></div>';
}
