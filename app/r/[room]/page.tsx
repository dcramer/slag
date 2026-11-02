import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { roomFromPath } from '../../../src/game/room';
import GameClient from './GameClient';

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
