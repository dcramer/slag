'use client';

import { useEffect } from 'react';
import { mountCodex } from '../../src/codex/main';

export default function CodexMount() {
  useEffect(() => mountCodex(), []);
  return <div id="codex" />;
}
