import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryHistory } from '../src/router';

/**
 * mountGame's screen switching (src/main.ts), with the screens themselves stubbed: what matters here is when a
 * screen mounts, not what it draws. A lobby's code loads on first visit, and the visitor can leave before it lands.
 */

const lobbyChunk = vi.hoisted(() => {
  const s = { release: () => {}, mounts: [] as string[], unmounts: 0 };
  return s;
});

vi.mock('../src/game-client', async () => {
  await new Promise<void>((done) => (lobbyChunk.release = done));
  return {
    mountLobby: (_root: unknown, room: string) => {
      lobbyChunk.mounts.push(room);
      return Promise.resolve(() => lobbyChunk.unmounts++);
    },
  };
});
vi.mock('../src/ui/screens/home', () => ({ mountHome: () => () => {} }));
vi.mock('../src/audio/page', () => ({ pageAudio: () => ({ unlock() {}, menu() {} }), closePageAudio() {} }));
vi.mock('../src/ui/screens/css', () => ({ FONTS_HREF: '', SCREEN_CSS: '', SCREEN_STYLE_ID: 'slag-screens' }));

function element(): Record<string, unknown> {
  return {
    dataset: {},
    firstElementChild: null,
    content: '',
    addEventListener() {},
    replaceChildren() {},
    append() {},
  };
}

beforeEach(() => {
  vi.stubGlobal('document', {
    head: element(),
    hidden: false,
    title: '',
    addEventListener() {},
    getElementById: () => element(),
    querySelector: () => element(),
    createElement: () => element(),
  });
  vi.stubGlobal('window', { scrollTo() {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mountGame', () => {
  it('never mounts a lobby the visitor left while its code was loading', async () => {
    const { mountGame } = await import('../src/main');
    let back = () => {};
    const hist = { ...memoryHistory('/r/ABCDE'), listen: (cb: () => void) => ((back = cb), () => {}) };
    Object.defineProperty(hist, 'path', { get: () => (left ? '/' : '/r/ABCDE') });
    let left = false;
    const stop = mountGame(element() as unknown as HTMLElement, { history: hist });
    await new Promise((r) => setTimeout(r, 10));
    // Back to the menu before the game's code arrived.
    left = true;
    back();
    await new Promise((r) => setTimeout(r, 10));
    lobbyChunk.release();
    await new Promise((r) => setTimeout(r, 10));
    // Mounting it would join the room, and draw over the menu, only to leave again.
    expect(lobbyChunk.mounts).toEqual([]);
    stop();
  });
});
