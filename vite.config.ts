import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Dev-server equivalent of Vercel's cleanUrls/rewrites: /codex → codex.html, /r/:room → index.html. */
function cleanUrls(): Plugin {
  return {
    name: 'slag-clean-urls',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/';
        if (/^\/codex\/?(\?|$)/.test(url)) req.url = url.replace(/^\/codex\/?/, '/codex.html');
        else if (/^\/r\/[^/?]+\/?(\?|$)/.test(url)) req.url = url.replace(/^\/r\/[^/?]+\/?/, '/index.html');
        next();
      });
    },
  };
}

export default defineConfig({
  // Absolute base so deep links like /r/<room> (rewritten to index.html on Vercel) still load /assets/*.
  base: '/',
  plugins: [cleanUrls()],
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), codex: resolve(__dirname, 'codex.html') } },
  },
});
