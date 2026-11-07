import type { Metadata } from 'next';
import Game from '../../Game';
import { metadata as codex } from '../page';

/** A codex card's permalink (src/codex/links.ts): the codex page, which opens the card itself, or stays plain for one it doesn't know. */
export const metadata: Metadata = codex;

export default function CodexCardPage() {
  return <Game />;
}
