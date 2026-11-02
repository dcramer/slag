import { describe, expect, it } from 'vitest';
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
