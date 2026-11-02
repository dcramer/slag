import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

/** The commit is the release, so events line up with the source maps uploaded for that build. */
const release = process.env.VERCEL_GIT_COMMIT_SHA;
/** No token (local builds, CI, forks): skip the upload and generate no source maps at all. */
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);
/**
 * Vercel builds have no .git, so the plugin's default `setCommits: { auto: true }` can't read history. Vercel names
 * the repo and commit instead, which is enough for Sentry's suspect commits once the repo is linked to the project.
 */
const repo =
  process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : '';
const setCommits = repo && release ? { repo, commit: release, ignoreMissing: true, ignoreEmpty: true } : false;
/** Marks when a release reached production or a preview, so an issue's first-seen lines up with a deploy. */
const deploy = process.env.VERCEL_ENV ? { env: process.env.VERCEL_ENV } : false;

const config: NextConfig = {
  // The game mounts imperatively once; strict-mode double effects add nothing here.
  reactStrictMode: false,
  // No floating dev badge over the game (also keeps screenshots clean).
  devIndicators: false,
  // Type-checking is done by `npm run check` (tsc); don't duplicate it in `next build`.
  typescript: { ignoreBuildErrors: true },
  // Read by app/sentry-options.ts on both client and server.
  env: {
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.VERCEL_ENV ?? 'local',
    NEXT_PUBLIC_SENTRY_RELEASE: release ?? '',
  },
  async headers() {
    return [{ source: '/textures/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] }];
  },
};

export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: release, create: uploadSourceMaps, setCommits, deploy },
  // Maps go to Sentry, then get deleted so the deployed site never serves them.
  sourcemaps: { disable: !uploadSourceMaps, deleteSourcemapsAfterUpload: true },
  silent: !process.env.CI,
  telemetry: false,
  // No browser tracing, and server traces come from Next's own spans: these name client routes in traces and auto-instrument libraries.
  routeManifestInjection: false,
  buildTimeInstrumentation: false,
  suppressOnRouterTransitionStartWarning: true,
});
