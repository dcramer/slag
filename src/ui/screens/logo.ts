import { logoHTML } from './markup';

/** The font size the logo is built at (the main menu's, on a desktop). Everything else is that, scaled. */
const FULL_PX = 150;

/** Where to show the logo: its center and font size, in CSS px of the window. */
export interface LogoBox {
  x: number;
  y: number;
  size: number;
}

/**
 * The main menu's logo laid over a canvas screen (the lobby's top bar). It's
 * the same markup and CSS at full size, scaled as a whole, so outline, hard
 * drop, drips and glow keep their proportions, and text stays crisp at any
 * pixel ratio instead of going through the HUD canvas.
 */
export class FloatingLogo {
  private el = document.createElement('div');
  private key = '';

  constructor(parent: HTMLElement) {
    this.el.className = 'slag-logo-float';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = logoHTML('div');
    this.el.hidden = true;
    parent.append(this.el);
  }

  /** Show it centered on `box`, or hide it. Cheap to call every frame: the DOM is touched only on change. */
  place(box: LogoBox | null): void {
    const key = box ? `${box.x.toFixed(1)},${box.y.toFixed(1)},${box.size.toFixed(2)}` : '';
    if (key === this.key) return;
    this.key = key;
    this.el.hidden = !box;
    if (box) this.el.style.transform = `translate(${box.x}px, ${box.y}px) translate(-50%, -50%) scale(${box.size / FULL_PX})`;
  }

  remove(): void {
    this.el.remove();
  }
}
