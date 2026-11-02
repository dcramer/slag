import type { NextConfig } from 'next';

const config: NextConfig = {
  // The game mounts imperatively once; strict-mode double effects add nothing here.
  reactStrictMode: false,
  // No floating dev badge over the game (also keeps screenshots clean).
  devIndicators: false,
  // Type-checking is done by `npm run check` (tsc); don't duplicate it in `next build`.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: '/textures/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] }];
  },
};

export default config;
