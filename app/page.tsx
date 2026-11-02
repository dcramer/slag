import type { Metadata } from 'next';
import { homeHTML } from '../src/ui/screens/markup';
import Game from './Game';
import { DESCRIPTION, NAME, oembedAlternate } from './site';

export const metadata: Metadata = {
  alternates: { canonical: '/', types: oembedAlternate('/') },
  openGraph: { type: 'website', siteName: NAME, title: NAME, description: DESCRIPTION, url: '/' },
};

/** The main menu, server-rendered so it paints before the game's script runs. */
export default function Home() {
  return <Game html={homeHTML()} />;
}
