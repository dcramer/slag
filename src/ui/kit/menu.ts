import type { InputManager } from '../../input/input';
import type { MenuAction } from '../settings-nav';
import { type MenuHost, MenuSurface } from './surface';
import { Ui } from './ui';

/**
 * A menu drawn on canvas with the kit: open and close, and the game's input held while it's up (keys
 * and pads stop reaching the match). Without a document (tests) it opens with no surface, and a test
 * drives `frame` and `ui` directly.
 */
export abstract class CanvasMenu implements MenuHost {
  readonly ui = new Ui();
  private surface: MenuSurface | null = null;
  private opened = false;
  onClose: (() => void) | null = null;

  constructor(
    protected input: Pick<InputManager, 'captured' | 'capturePads'>,
    private name: string,
  ) {}

  get isOpen() {
    return this.opened;
  }

  protected mount() {
    if (this.opened) return;
    this.opened = true;
    this.input.captured = true;
    this.input.capturePads(true);
    if (typeof document !== 'undefined') this.surface = new MenuSurface(this.name, this, this.ui);
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    this.surface?.dispose();
    this.surface = null;
    this.input.captured = false;
    this.input.capturePads(false);
    this.closed();
    this.onClose?.();
  }

  /** Let go of anything opening took, beyond the surface. */
  protected closed() {}

  /** One frame on `c`, `W`×`H` units: what the surface does every animation frame. */
  frame(c: CanvasRenderingContext2D, W: number, H: number, t = 0) {
    this.ui.begin(c, W, H, t);
    this.draw(this.ui);
    this.ui.end();
  }

  /** Route an action the way the surface would: the kit first, then the menu. */
  send(a: MenuAction) {
    if (this.busy?.() || !this.ui.act(a)) this.act(a);
  }

  abstract draw(ui: Ui): void;
  abstract act(a: MenuAction): void;
  key?(e: KeyboardEvent): boolean;
  busy?(): boolean;
}
