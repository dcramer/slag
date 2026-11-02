import type { Metadata } from 'next';
import { LOBBIES, routeTitle } from '../../src/routes';
import { lobbiesHTML } from '../../src/ui/screens/markup';
import Game from '../Game';
import { NAME, oembedAlternate, SITE_CARD } from '../site';

const title = routeTitle(LOBBIES);
const description = 'Public lobbies to join or watch.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/lobbies', types: oembedAlternate('/lobbies') },
  // A child segment that sets openGraph loses the root's file-convention image, so name it.
  openGraph: { type: 'website', siteName: NAME, title, description, url: '/lobbies', images: SITE_CARD },
  twitter: { card: 'summary_large_image', images: SITE_CARD },
};

/** The Lobbies screen, its frame server-rendered so it paints before the game's script runs; the list comes from the client. */
export default function LobbiesPage() {
  return <Game html={lobbiesHTML()} />;
}
