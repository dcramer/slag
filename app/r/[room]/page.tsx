import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { roomFromPath } from '../../../src/game/room';
import GameClient from './GameClient';

/**
 * Game route only (mobile): no pinch/double-tap zoom, and draw edge to edge
 * under the notch (the renderer and touch controls inset themselves with
 * env(safe-area-inset-*)). Scoped here so /codex stays zoomable.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#07060b',
};

type Props = { params: Promise<{ room: string }> };

async function roomOf(props: Props): Promise<string> {
  const room = roomFromPath(`/r/${(await props.params).room}`);
  if (!room) notFound();
  return room;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const room = await roomOf(props);
  return {
    title: `slag · lobby ${room}`,
    description: `Join lobby ${room} — build it, break it, beat it.`,
    openGraph: { title: `Join my slag lobby: ${room}`, description: 'A procedurally generated party platformer.' },
  };
}

/** Server-rendered lobby route; the game itself runs entirely client-side. */
export default async function RoomPage(props: Props) {
  const room = await roomOf(props);
  return <GameClient room={room} />;
}
