'use client';

import dynamic from 'next/dynamic';

// Client-only: keeps the codex (and the game code it draws with) out of the server bundle.
const CodexMount = dynamic(() => import('./CodexMount'), { ssr: false });

export default function CodexClient() {
  return <CodexMount />;
}
