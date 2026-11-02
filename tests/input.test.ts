import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '../src/input/input';

/** A mouse event as the input manager reads it, on a bare event target. */
const mouse = (type: string, fields: Record<string, unknown>) => Object.assign(new Event(type), { pointerType: 'mouse', clientX: 0, clientY: 0, ...fields });

describe('mouse alt', () => {
  const setup = (place: boolean) => {
    const target = new EventTarget();
    const input = new InputManager(target as unknown as Window);
    input.mouseAlts = () => place;
    input.viewEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 768, height: 432 }) } as HTMLElement;
    return { target, frame: () => input.sample()[input.mouseDevice] };
  };

  it('right click and the wheel rotate during place', () => {
    const { target, frame } = setup(true);
    target.dispatchEvent(mouse('pointerdown', { button: 2 }));
    expect(frame().altPressed).toBe(true);
    target.dispatchEvent(mouse('wheel', { deltaY: 4 }));
    expect(frame().altPressed).toBe(true);
  });

  it('right click and the wheel can never self-destruct in a race', () => {
    const { target, frame } = setup(false);
    target.dispatchEvent(mouse('pointerdown', { button: 2 }));
    expect(frame().altPressed).toBe(false);
    target.dispatchEvent(mouse('wheel', { deltaY: 4 }));
    expect(frame().altPressed).toBe(false);
  });
});

describe('pads and menus', () => {
  /** A connected pad whose pressed buttons the test controls. */
  const setup = () => {
    const pressed = new Set<number>();
    const pad = {
      index: 0,
      connected: true,
      axes: [0, 0],
      get buttons() {
        return Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.has(i), value: pressed.has(i) ? 1 : 0 }));
      },
    };
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    return { pressed, input: new InputManager(new EventTarget() as unknown as Window) };
  };

  afterEach(() => vi.unstubAllGlobals());

  it('keeps pad presses out of the game while a menu drives itself with them', () => {
    const { pressed, input } = setup();
    input.capturePads(true);
    pressed.add(0);
    expect(input.sample().pad0).toBeUndefined();
  });

  it('does not count a button held through closing the menu as a press', () => {
    const { pressed, input } = setup();
    input.capturePads(true);
    pressed.add(0);
    input.capturePads(false);
    const f = input.sample().pad0;
    expect(f.jump).toBe(true);
    expect(f.confirmPressed).toBe(false);
    pressed.delete(0);
    input.sample();
    pressed.add(0);
    expect(input.sample().pad0.confirmPressed).toBe(true);
  });

  it('reopens on Start after every B-close', () => {
    const { pressed, input } = setup();
    let open = false;
    let opens = 0;
    // As in game-client: Start opens the menu, which captures the pads until B closes it.
    input.onEscape = () => {
      opens++;
      open = true;
      input.capturePads(true);
    };
    for (let i = 0; i < 20; i++) {
      pressed.add(9);
      input.sample();
      pressed.delete(9);
      input.sample();
      expect(open).toBe(true);
      pressed.add(1);
      input.sample();
      open = false;
      input.capturePads(false); // B closes it, still held
      input.sample();
      pressed.delete(1);
      input.sample();
    }
    expect(opens).toBe(20);
  });

  it('opens the menu on Start, once per press', () => {
    const { pressed, input } = setup();
    let escapes = 0;
    input.onEscape = () => escapes++;
    pressed.add(9);
    input.sample();
    input.sample();
    expect(escapes).toBe(1);
  });

  it('leaves Start to the open menu, and a Start that closed it does not reopen it', () => {
    const { pressed, input } = setup();
    let escapes = 0;
    input.onEscape = () => escapes++;
    input.capturePads(true);
    pressed.add(9);
    input.sample();
    input.capturePads(false);
    input.sample();
    expect(escapes).toBe(0);
  });
});
