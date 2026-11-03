import type { Metadata } from 'next';
import { ABOUT, routeTitle } from '../../src/routes';
import { aboutHTML } from '../../src/ui/screens/markup';
import Game from '../Game';
import { NAME, oembedAlternate, SITE_CARD } from '../site';

const title = routeTitle(ABOUT);
const description = 'Credits, license and source code for SLAG.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/about', types: oembedAlternate('/about') },
  // A child segment that sets openGraph loses the root's file-convention image, so name it.
  openGraph: { type: 'website', siteName: NAME, title, description, url: '/about', images: SITE_CARD },
  twitter: { card: 'summary_large_image', images: SITE_CARD },
};

/** The About screen, server-rendered so it paints before the game's script runs. */
export default function AboutPage() {
  return <Game html={aboutHTML()} />;
}
