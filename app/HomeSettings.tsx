'use client';

import { useEffect, useRef } from 'react';
import { openStandaloneSettings } from '../src/ui/standalone';

/** Client-only (loaded via next/dynamic ssr:false): the in-game SettingsMenu over the main menu. */
export default function HomeSettings({ onClose }: { onClose: () => void }) {
  const done = useRef(onClose);
  useEffect(() => {
    done.current = onClose;
  });
  useEffect(() => openStandaloneSettings(() => done.current()), []);
  return null;
}
