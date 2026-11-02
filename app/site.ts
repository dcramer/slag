import type { Metadata } from 'next';
import { PAGE_CHROME } from '../src/routes';

/**
 * What a shared link says about SLAG: the base URL that link previews resolve against, and the
 * copy the home page, lobby invites, the manifest and the oEmbed route all share. Host code only;
 * nothing in src/ reads it.
 */

export const NAME = 'SLAG';
/** The one description: page meta, Open Graph and Twitter cards, oEmbed, and the manifest. */
export const DESCRIPTION =
  "A party platformer where every round you and your friends add a part to the level, then race through it. Make it when they don't and you score. Make it too easy and nobody does.";
/** The molten-dark of the menu: browser chrome, splash screens and the manifest match it. */
export const THEME_COLOR = PAGE_CHROME.themeColor;

/**
 * Absolute origin for og:image, og:url and the oEmbed link. Crawlers need absolute URLs, and the
 * right host differs per deployment: production answers on its project domain, a preview on its
 * branch URL (stable across pushes), and local builds on localhost. Vercel sets these at build
 * and at run time, so static and dynamic routes agree.
 */
export function siteUrl(): URL {
  const env = process.env;
  const host = env.VERCEL_ENV === 'preview' ? (env.VERCEL_BRANCH_URL ?? env.VERCEL_URL) : (env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL);
  return new URL(host ? `https://${host}` : `http://localhost:${env.PORT ?? 3000}`);
}

/** The site's link-preview card (app/opengraph-image.jpg, made by `pnpm brand`), for pages that can't inherit it. */
export const SITE_CARD = {
  url: '/opengraph-image.jpg',
  width: 1200,
  height: 630,
  type: 'image/jpeg',
  alt: 'SLAG: eight runners racing through a level full of traps.',
};

/** The discovery link for /api/oembed, for a page at `path`. */
export function oembedAlternate(path: string): NonNullable<Metadata['alternates']>['types'] {
  const page = new URL(path, siteUrl()).href;
  return { 'application/json+oembed': `/api/oembed?url=${encodeURIComponent(page)}&format=json` };
}

/** A lobby code's invite title, the same in the page's tags and in its oEmbed answer. */
export const inviteTitle = (room: string) => `Join ${NAME} Lobby ${room}`;
