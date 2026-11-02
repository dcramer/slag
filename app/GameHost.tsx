'use client';

import dynamic from 'next/dynamic';

// Client-only: ssr:false keeps the game (and all of src/ it pulls in) out of the server bundle.
const GameMount = dynamic(() => import('./GameMount'), { ssr: false });

export default function GameHost({ rootId }: { rootId: string }) {
  return <GameMount rootId={rootId} />;
}
