import { defineConfig } from 'vite';

export default defineConfig({
  // Absolute base so deep links like /r/<room> (rewritten to index.html on Vercel) still load /assets/*.
  base: '/',
  build: { target: 'es2022' },
});
