import type { CSSProperties } from 'react';
import HomeStage from './HomeStage';
import MainMenu from './MainMenu';

/**
 * The main menu. Server-rendered markup; the menu logic is a small client
 * component, and the character stage loads client-only (no game code in
 * the server bundle).
 */
export default function Home() {
  // Deterministic ember field (pure CSS animation).
  const embers = Array.from({ length: 26 }, (_, i) => {
    const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
    return {
      left: `${(r(1) * 100).toFixed(1)}%`,
      animationDuration: `${(6 + r(2) * 8).toFixed(1)}s`,
      animationDelay: `${(-r(3) * 14).toFixed(1)}s`,
      width: `${(2 + r(4) * 2.5).toFixed(1)}px`,
      height: `${(2 + r(4) * 2.5).toFixed(1)}px`,
      '--dx': `${((r(5) - 0.5) * 120).toFixed(0)}px`,
    } as CSSProperties;
  });
  const drips = [26, 14, 34, 18, 30, 12, 24];
  const brand = (
    <div className="brand">
      <h1 className="logo">
        <span className="logo-o" aria-hidden="true">
          SLAG
        </span>
        <span className="drips" aria-hidden="true">
          {drips.map((len, i) => (
            <span key={`d${len}-${String(i)}`} style={{ '--len': `${len}px`, '--d': `${(-i * 0.7).toFixed(1)}s` } as CSSProperties} />
          ))}
        </span>
        <span className="logo-f">SLAG</span>
      </h1>
      <div className="kicker">Party Platformer · 1–8 Players</div>
    </div>
  );
  return (
    <div className="home">
      <div className="embers" aria-hidden="true">
        {embers.map((style) => (
          <i key={String(style.left)} style={style} />
        ))}
      </div>
      <MainMenu brand={brand} stage={<HomeStage />} />
    </div>
  );
}
