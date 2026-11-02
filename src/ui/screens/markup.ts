import { type Glyph, glyphSVG } from '../glyphs';

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

/** Drip lengths under the logo, left to right, in px at the logo's full size. */
const DRIPS = [26, 14, 34, 18, 30, 12, 24];

/**
 * The SLAG logo: an ink outline and hard drop behind a molten fill, with drips.
 * One logo everywhere: the main menu shows it as is, the lobby scales it into
 * its top bar (./logo.ts), and the link-preview card is cut from the menu's.
 */
export function logoHTML(tag: 'h1' | 'div' = 'h1'): string {
  const drips = DRIPS.map((len, i) => `<span style="--len:${len}px;--d:${(-i * 0.7).toFixed(1)}s"></span>`).join('');
  return (
    `<${tag} class="logo"><span class="logo-o" aria-hidden="true">SLAG</span>` +
    `<span class="drips" aria-hidden="true">${drips}</span><span class="logo-f">SLAG</span></${tag}>`
  );
}

/** A fixed ember field: same sparks on every visit, and on server and client alike. */
function embersHTML(): string {
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
    `<main class="home-main"><div class="brand">${logoHTML()}<div class="kicker">Party Platformer · 1–8 Players</div></div>` +
    `<nav class="menu-wrap" aria-label="Main menu"><ul class="menu">${items}</ul></nav>` +
    `<div class="stage" aria-hidden="true"><canvas></canvas></div></main>` +
    `<footer class="footbar"><div class="prompts" aria-hidden="true">${homePromptsHTML(false, false)}</div></footer></div>`
  );
}

/** The two screens that only say something went wrong and lead back to the menu. */
const PLAIN_SCREENS = {
  missing: { title: 'Lost in the Slag', body: 'That lobby code doesn’t look right. Codes are 3–12 letters and numbers.' },
  error: { title: 'Something Melted', body: 'The game hit an error it couldn’t recover from.' },
} as const;

export type PlainScreen = keyof typeof PLAIN_SCREENS;

export function plainHTML(kind: PlainScreen): string {
  const s = PLAIN_SCREENS[kind];
  return `<main class="page-plain" data-screen="${kind}"><h1>${s.title}</h1><p>${s.body}</p><button type="button" class="btn-link" disabled>MAIN MENU</button></main>`;
}

/** What a lobby URL paints before the game is up: the game's own dark, edge to edge. */
export function lobbyLoadingHTML(): string {
  return '<div data-screen="lobby" style="position:fixed;inset:0;background:#07060b"></div>';
}
