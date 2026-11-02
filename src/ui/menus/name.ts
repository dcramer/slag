import { sanitizeName } from '../profile';
import { el, Overlay } from './overlay';

/** Name entry, with a one-click keep-random option. */
export class NamePrompt extends Overlay {
  open(randomName: string, current: string | null, onDone: (name: string | null) => void) {
    const input = el('input', { className: 'slag-input', value: current ?? randomName, maxLength: 12, placeholder: randomName });
    input.setAttribute('aria-label', 'Your name');
    const finish = (name: string | null) => {
      onDone(name);
      this.close();
    };
    const ok = el('button', { className: 'slag-btn primary', type: 'button', textContent: 'Save Name' });
    ok.onclick = () => finish(sanitizeName(input.value) || null);
    const keep = el('button', { className: 'slag-btn', type: 'button', textContent: `Keep “${randomName}”` });
    keep.onclick = () => finish(null);
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') ok.click();
    };
    const card = el('div', { className: 'slag-card' }, el('h2', { textContent: 'Your Name' }), input, el('div', { className: 'slag-actions' }, keep, ok));
    this.mount(card);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }
}
