'use client';

import { useEffect, useRef, useState } from 'react';
import { bootGame } from '../../../src/game-client';

/** Client-only: mounts the canvases and starts the game loop. */
export default function GameMount({ room }: { room: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<unknown>();
  // Boot is async, so a failure has to be rethrown here to reach global-error.tsx.
  if (failed) throw failed;
  useEffect(() => {
    // Keep the URL canonical (uppercase code) without a navigation.
    if (location.pathname !== `/r/${room}`) history.replaceState(null, '', `/r/${room}${location.search}${location.hash}`);
    if (ref.current) bootGame(ref.current, room).catch(setFailed);
  }, [room]);
  return <div ref={ref} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#07060b' }} />;
}
