'use client';

import dynamic from 'next/dynamic';

// Client-only: the stage draws real game characters, so keep that code out of the server bundle.
const HomeStageMount = dynamic(() => import('./HomeStageMount'), { ssr: false });

export default function HomeStage() {
  return <HomeStageMount />;
}
