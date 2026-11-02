'use client';

import { useEffect } from 'react';

export default function CodexClient() {
  useEffect(() => {
    import('../../src/codex/main').then(({ mountCodex }) => mountCodex());
  }, []);
  return <div id="codex" />;
}
