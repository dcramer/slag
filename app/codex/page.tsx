import type { Metadata } from 'next';
import CodexClient from './CodexClient';

export const metadata: Metadata = { title: 'slag · codex', description: 'Every part and projectile props are built from.' };

export default function CodexPage() {
  return <CodexClient />;
}
