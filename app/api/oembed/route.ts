import { roomFromPath } from '../../../src/game/room';
import { DESCRIPTION, inviteTitle, NAME } from '../../site';

/**
 * oEmbed (https://oembed.com) for SLAG pages: GET /api/oembed?url=<page>&format=json. Pages point
 * here with a <link rel="alternate" type="application/json+oembed">. Consumers that read oEmbed
 * (Slack, Discord, Notion, Iframely/Embedly-backed apps) get the page's title, provider and the
 * same 1200×630 card as og:image. It's a `link` embed: there's nothing to play inside someone
 * else's page, so consumers fall back to the Open Graph card for layout. Stateless; the answer is
 * a pure function of the path.
 */

const CARD = { width: 1200, height: 630 };

function describe(path: string): { title: string; image: string } | null {
  if (path === '/') return { title: NAME, image: '/opengraph-image.jpg' };
  if (path === '/codex') return { title: `${NAME} · Codex`, image: '/opengraph-image.jpg' };
  if (path === '/lobbies') return { title: `${NAME} · Lobbies`, image: '/opengraph-image.jpg' };
  if (path === '/about') return { title: `${NAME} · About`, image: '/opengraph-image.jpg' };
  const room = roomFromPath(path);
  // Every lobby shares one invite card; Next serves it under the segment's placeholder, as og:image does.
  return room ? { title: inviteTitle(room), image: '/r/-/opengraph-image.jpg' } : null;
}

export function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const format = query.get('format') ?? 'json';
  if (format !== 'json') return new Response('Only format=json is supported.', { status: 501 });
  let page: URL;
  try {
    page = new URL(query.get('url') ?? '');
  } catch {
    return new Response('Missing or malformed url.', { status: 400 });
  }
  const found = describe(page.pathname);
  if (!found) return new Response('Not a SLAG page.', { status: 404 });
  // Answer for the host that was asked, so previews and production each point at their own card.
  const origin = new URL(req.url).origin;
  return Response.json(
    {
      version: '1.0',
      type: 'link',
      title: found.title,
      description: DESCRIPTION,
      provider_name: NAME,
      provider_url: `${origin}/`,
      thumbnail_url: `${origin}${found.image}`,
      thumbnail_width: CARD.width,
      thumbnail_height: CARD.height,
      cache_age: 86400,
    },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  );
}
