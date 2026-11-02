'use client';

import { useEffect } from 'react';
import { reportError } from '../src/telemetry';
import './globals.css';

/**
 * Root error boundary. Next catches render and effect errors (a failed
 * `bootGame` lands here) before they reach `window.onerror`, so without this
 * they would never be reported. The button does a full load, not client
 * routing, because the app is in a bad state.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => reportError(error, { boundary: 'global-error', digest: error.digest }), [error]);
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800&family=Lilita+One&display=swap" rel="stylesheet" />
      </head>
      <body>
        <main className="page-plain">
          <h1>Something Melted</h1>
          <p>The game hit an error it couldn&apos;t recover from.</p>
          <button type="button" className="btn-link" onClick={() => location.assign('/')}>
            MAIN MENU
          </button>
        </main>
      </body>
    </html>
  );
}
