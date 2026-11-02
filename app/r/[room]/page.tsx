import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { roomFromPath } from '../../../src/game/room';
import { DESCRIPTION, inviteTitle, NAME, oembedAlternate } from '../../site';
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

/**
 * An invite: the code in the title, and the invite card (`opengraph-image.jpg` beside this file).
 * Lobbies are short-lived, so search engines may fetch them (link previews need that) but not index them.
 */
export async function generateMetadata(props: Props): Promise<Metadata> {
  const room = await roomOf(props);
  const path = `/r/${room}`;
  return {
    title: `${NAME} · Lobby ${room}`,
    description: DESCRIPTION,
    robots: { index: false, follow: false },
    alternates: { types: oembedAlternate(path) },
    openGraph: { type: 'website', siteName: NAME, title: inviteTitle(room), description: DESCRIPTION, url: path },
  };
}

/** Server-rendered lobby route; the game itself runs entirely client-side. */
export default async function RoomPage(props: Props) {
  const room = await roomOf(props);
  return <GameClient room={room} />;
}
