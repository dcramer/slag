'use client';

import dynamic from 'next/dynamic';

// The game is 100% client-side: ssr:false keeps it (and all of src/) out of the server bundle.
const GameMount = dynamic(() => import('./GameMount'), {
  ssr: false,
  loading: () => <div style={{ position: 'fixed', inset: 0, background: '#07060b' }} />,
});

export default function GameClient({ room }: { room: string }) {
  return <GameMount room={room} />;
}
