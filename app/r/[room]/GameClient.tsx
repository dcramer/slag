'use client';

import { useEffect, useRef } from 'react';

export default function GameClient({ room }: { room: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the URL canonical (uppercase code) without a navigation.
    if (location.pathname !== `/r/${room}`) history.replaceState(null, '', `/r/${room}${location.search}${location.hash}`);
    let cancelled = false;
    import('../../../src/game-client').then(({ bootGame }) => {
      if (!cancelled && ref.current) bootGame(ref.current, room);
    });
    return () => {
      cancelled = true;
    };
  }, [room]);
  return <div ref={ref} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#07060b' }} />;
}
