'use client';

import { useEffect } from 'react';
import { mountGame } from '../src/main';

/** Hands the server-rendered root to the game, which runs every screen from here on. */
export default function GameMount({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    return root ? mountGame(root) : undefined;
  }, [rootId]);
  return null;
}
