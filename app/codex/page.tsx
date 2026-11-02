import type { Metadata } from 'next';
import { NAME, oembedAlternate, SITE_CARD } from '../site';
import CodexClient from './CodexClient';

const title = `${NAME} · Codex`;
const description = 'Every part and projectile props are built from.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/codex', types: oembedAlternate('/codex') },
  // A child segment that sets openGraph loses the root's file-convention image, so name it.
  openGraph: { type: 'website', siteName: NAME, title, description, url: '/codex', images: SITE_CARD },
  twitter: { card: 'summary_large_image', images: SITE_CARD },
};

export default function CodexPage() {
  return <CodexClient />;
}
