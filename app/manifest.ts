import type { MetadataRoute } from 'next';
import { DESCRIPTION, NAME, THEME_COLOR } from './site';

/**
 * "Add to Home Screen": launches like an app, chromeless and landscape, on the menu's soot. The
 * icons are made by `pnpm brand`; the maskable one keeps the mark inside the safe circle.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: NAME,
    short_name: NAME,
    description: DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'landscape',
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    categories: ['games'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
