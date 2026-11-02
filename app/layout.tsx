import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'SLAG',
  description: 'A procedurally generated party platformer for 1–8 players. Build traps, then race through them.',
  icons: { icon: 'data:,' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0e0806' };

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
