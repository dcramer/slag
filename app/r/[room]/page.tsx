import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { roomFromPath } from '../../../src/game/room';
import { GAME_CHROME, lobby, routeTitle } from '../../../src/routes';
import { lobbyLoadingHTML } from '../../../src/ui/screens/markup';
import Game from '../../Game';
import { DESCRIPTION, inviteTitle, NAME, oembedAlternate } from '../../site';

/**
 * The game's viewport (mobile): no pinch/double-tap zoom, edge to edge under the notch. The game sets
 * the same on a soft navigation into a lobby (src/main.ts), so a fresh load and a click agree.
 */
export const viewport: Viewport = GAME_CHROME;

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
    title: routeTitle(lobby(room)),
    description: DESCRIPTION,
    robots: { index: false, follow: false },
    alternates: { types: oembedAlternate(path) },
    openGraph: { type: 'website', siteName: NAME, title: inviteTitle(room), description: DESCRIPTION, url: path },
  };
}

/** A lobby: an invalid code is a 404 here; a valid one paints the game's dark until the game is up. */
export default async function RoomPage(props: Props) {
  await roomOf(props);
  return <Game html={lobbyLoadingHTML()} />;
}
