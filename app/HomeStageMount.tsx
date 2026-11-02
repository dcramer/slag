'use client';

import { useEffect, useRef } from 'react';
import { mountStage } from '../src/ui/home-stage';

/** Canvas with a crowd of generated characters on a slag heap. */
export default function HomeStageMount() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? mountStage(ref.current) : undefined), []);
  return <canvas ref={ref} />;
}
