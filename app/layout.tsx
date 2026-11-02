import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PAGE_CHROME } from '../src/routes';
import { FONTS_HREF, SCREEN_CSS, SCREEN_STYLE_ID } from '../src/ui/screens/css';
import { DESCRIPTION, NAME, siteUrl } from './site';

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
  twitter: { card: 'summary_large_image', title: NAME, description: DESCRIPTION },
  // Mobile: "Add to Home Screen" launches chromeless (iOS) with a dark status bar over the game.
  // (Next emits mobile-web-app-capable for `capable`.)
  appleWebApp: { capable: true, title: NAME, statusBarStyle: 'black-translucent' },
};

/** Menus scroll and zoom like pages; the lobby route asks for the game's own (src/routes.ts). */
export const viewport: Viewport = PAGE_CHROME;

/**
 * The game's fonts (docs/ART.md → Type) and its screens' styles, inlined so the server-rendered
 * main menu paints styled before any script. The game adds both itself if a host leaves them out.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href={FONTS_HREF} rel="stylesheet" />
        <style id={SCREEN_STYLE_ID} dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
