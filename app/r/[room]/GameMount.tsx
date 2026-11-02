'use client';

import { useEffect, useRef } from 'react';
import { bootGame } from '../../../src/game-client';

/** Client-only: mounts the canvases and starts the game loop. */
export default function GameMount({ room }: { room: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the URL canonical (uppercase code) without a navigation.
    if (location.pathname !== `/r/${room}`) history.replaceState(null, '', `/r/${room}${location.search}${location.hash}`);
    if (ref.current) bootGame(ref.current, room);
  }, [room]);
  return <div ref={ref} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#07060b' }} />;
}
