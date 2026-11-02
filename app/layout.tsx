import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DESCRIPTION, NAME, siteUrl, THEME_COLOR } from './site';

/**
 * Site-wide tags. The icons (favicon.ico, icon.svg, apple-icon.png), the manifest and the
 * link-preview image are file conventions next to this layout, all made by `pnpm brand`.
 */
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: NAME,
  description: DESCRIPTION,
  applicationName: NAME,
  openGraph: { type: 'website', siteName: NAME, title: NAME, description: DESCRIPTION },
  twitter: { card: 'summary_large_image' },
  // Mobile: "Add to Home Screen" launches chromeless (iOS) with a dark status bar over the game.
  // (Next emits mobile-web-app-capable for `capable`.)
  appleWebApp: { capable: true, title: NAME, statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: THEME_COLOR };

/**
 * Type system (docs/ART.md): Lilita One for display (titles, big numbers,
 * menu items), Barlow for UI text. Both are loaded here for the pages and
 * the canvas HUD.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800&family=Lilita+One&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
