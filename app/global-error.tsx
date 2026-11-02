'use client';

import { type MouseEvent, useEffect } from 'react';
import { reportError } from '../src/telemetry';
import { FONTS_HREF, SCREEN_CSS } from '../src/ui/screens/css';
import { plainHTML } from '../src/ui/screens/markup';

/**
 * The host's last line: an error in this React shell itself. The game's screens don't render through
 * React, and src/main.ts catches and reports their failures with the same error screen, so this only
 * fires if Next or the mount breaks. It reports, then shows the game's error screen; MAIN MENU is a
 * full page load, since the app is in a bad state.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => reportError(error, { boundary: 'global-error', digest: error.digest }), [error]);
  const onClick = (e: MouseEvent) => {
    if ((e.target as Element).closest('button')) location.assign('/');
  };
  return (
    <html lang="en">
      <head>
        <link href={FONTS_HREF} rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: SCREEN_CSS }} />
      </head>
      <body>
        <div onClick={onClick} dangerouslySetInnerHTML={{ __html: plainHTML('error').replace(' disabled', '') }} />
      </body>
    </html>
  );
}
