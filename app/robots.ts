import type { MetadataRoute } from 'next';

/**
 * Lobbies stay crawlable on purpose: link-preview bots (X, LinkedIn) obey robots.txt, and a
 * blocked invite unfurls bare. They opt out of the index with a noindex tag instead.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: '/api/net/' } };
}
