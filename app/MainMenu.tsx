'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { newRoomCode, roomFromPath } from '../src/game/room';
import { type Glyph, glyphSVG } from '../src/ui/glyphs';

// Settings reuse the in-game SettingsMenu, which needs game modules: client-only, loaded on demand.
const HomeSettings = dynamic(() => import('./HomeSettings'), { ssr: false });

type ItemId = 'play' | 'join' | 'codex' | 'settings';

const ITEMS: { id: ItemId; title: string; sub: string }[] = [
  { id: 'play', title: 'PLAY', sub: 'Start a New Lobby' },
  { id: 'join', title: 'JOIN A LOBBY', sub: 'Enter a Lobby Code' },
  { id: 'codex', title: 'CODEX', sub: 'Spoilers!' },
  { id: 'settings', title: 'SETTINGS', sub: 'Audio, Video and Controls' },
];

function G({ g, h = 22 }: { g: Glyph; h?: number }) {
  return <span className="slag-glyph" dangerouslySetInnerHTML={{ __html: glyphSVG(g, h) }} />;
}

/**
 * Go to a lobby. A full page load on purpose: the game boots once per page
 * (bootGame is a singleton), so a soft navigation back into a second lobby
 * would find it already running. Debug params (?seed, ?theme, …) carry through.
 */
function enterLobby(room: string) {
  location.assign(`/r/${room}${location.search}`);
}

/**
 * Main menu: console-style selection (one item is always active) that works
 * with mouse, touch, keyboard (↑/↓, Enter, Esc) and gamepads (stick/d-pad,
 * Ⓐ, Ⓑ). The footer shows prompts for whichever input was used last.
 */
export default function MainMenu({ brand, stage }: { brand: ReactNode; stage: ReactNode }) {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [settings, setSettings] = useState(false);
  const [pad, setPad] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const codeRef = useRef<HTMLInputElement>(null);

  const activate = useCallback(
    (id: ItemId) => {
      setErr('');
      if (id === 'play') enterLobby(newRoomCode());
      else if (id === 'codex') router.push('/codex');
      else if (id === 'settings') setSettings(true);
      else {
        setJoining(true);
        setTimeout(() => codeRef.current?.focus(), 0);
      }
    },
    [router],
  );

  const submitJoin = useCallback(() => {
    const room = roomFromPath(`/r/${code.trim()}`);
    if (!room) {
      setErr('Codes are 3–12 letters and numbers.');
      return;
    }
    enterLobby(room);
  }, [code]);

  const move = useCallback((d: number) => {
    setActive((a) => {
      const n = (a + d + ITEMS.length) % ITEMS.length;
      refs.current[n]?.focus();
      return n;
    });
  }, []);

  const back = useCallback(() => {
    setJoining(false);
    setErr('');
    refs.current[1]?.focus();
  }, []);

  // Keyboard: arrows move the selection; Esc backs out of code entry.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settings) return;
      if (e.key === 'Escape' && joining) back();
      if (document.activeElement === codeRef.current) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        move(e.key === 'ArrowDown' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings, joining, move, back]);

  // Gamepads: stick/d-pad moves, Ⓐ selects, Ⓑ backs out.
  useEffect(() => {
    let raf = 0;
    let hadPad = false;
    const connected = () => (navigator.getGamepads ? [...navigator.getGamepads()].filter((p) => p?.connected) : []);
    const read = (pads: ReturnType<typeof connected>) => {
      const cur = { up: false, down: false, a: false, b: false };
      for (const p of pads) {
        if (!p) continue;
        const ay = p.axes.at(1) ?? 0;
        const btn = (i: number) => p.buttons.at(i)?.pressed ?? false;
        cur.up ||= ay < -0.5 || btn(12);
        cur.down ||= ay > 0.5 || btn(13);
        cur.a ||= btn(0);
        cur.b ||= btn(1);
      }
      return cur;
    };
    // Whatever is held as this starts isn't a press: the Ⓐ on Settings' Done must not reopen it.
    const prev = read(connected());
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const pads = connected();
      if (pads.length > 0 !== hadPad) {
        hadPad = pads.length > 0;
        setPad(hadPad);
      }
      if (settings) return;
      const cur = read(pads);
      if (cur.up && !prev.up) move(-1);
      if (cur.down && !prev.down) move(1);
      if (cur.a && !prev.a) {
        const el = document.activeElement;
        if (el instanceof HTMLElement && el !== document.body && el !== codeRef.current) el.click();
        else if (el === codeRef.current) submitJoin();
        else refs.current[active]?.click();
      }
      if (cur.b && !prev.b && joining) back();
      Object.assign(prev, cur);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [settings, joining, active, move, back, submitJoin]);

  const confirmGlyphs: Glyph[] = [{ kind: 'key', label: 'Enter' }, ...(pad ? [{ kind: 'pad', button: 'A' } as Glyph] : [])];
  const backGlyphs: Glyph[] = [{ kind: 'key', label: 'Esc' }, ...(pad ? [{ kind: 'pad', button: 'B' } as Glyph] : [])];

  return (
    <>
      <main className="home-main">
        {brand}
        <nav className="menu-wrap" aria-label="Main menu">
          <ul className="menu">
            {ITEMS.map((it, i) => (
              <li key={it.id}>
                <button
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  className="menu-item"
                  data-active={active === i}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => activate(it.id)}
                  aria-expanded={it.id === 'join' ? joining : undefined}
                >
                  <span className="t">{it.title}</span>
                  <span className="s">{it.sub}</span>
                  <span className="chev" />
                </button>
                {it.id === 'join' && joining && (
                  <>
                    <form
                      className="join"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitJoin();
                      }}
                    >
                      <input
                        ref={codeRef}
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
                          setErr('');
                        }}
                        maxLength={12}
                        placeholder="CODE"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        aria-label="Lobby code"
                        aria-invalid={!!err}
                      />
                      <button type="submit">JOIN</button>
                    </form>
                    {err && (
                      <p className="join-err" role="alert">
                        {err}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="stage" aria-hidden="true">
          {stage}
        </div>
      </main>
      <footer className="footbar">
        <div className="prompts" aria-hidden="true">
          <span className="prompt">
            <G g={{ kind: 'key', label: '↑' }} />
            <G g={{ kind: 'key', label: '↓' }} />
            {pad && <G g={{ kind: 'pad', button: 'DPAD' }} />}
            Select
          </span>
          <span className="prompt">
            {confirmGlyphs.map((g) => (
              <G key={g.kind} g={g} />
            ))}
            Confirm
          </span>
          {joining && (
            <span className="prompt">
              {backGlyphs.map((g) => (
                <G key={g.kind} g={g} />
              ))}
              Back
            </span>
          )}
        </div>
      </footer>
      {settings && (
        <HomeSettings
          onClose={() => {
            setSettings(false);
            refs.current[3]?.focus();
          }}
        />
      )}
    </>
  );
}
