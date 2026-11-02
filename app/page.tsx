import { redirect } from 'next/navigation';
import { newRoomCode } from '../src/game/room';

// Every visit to / gets a fresh lobby.
export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') q.set(k, v);
  const qs = q.toString();
  redirect(`/r/${newRoomCode()}${qs ? `?${qs}` : ''}`);
}
