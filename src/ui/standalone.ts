import 'client-only';
import { Silent } from '../audio';
import { InputManager } from '../input/input';
import { loadHaptics, SettingsMenu } from './menus';
import { isTouchFirst, savedQuality, saveQuality } from './touch/device';

/**
 * The in-game SettingsMenu outside a game (main menu). The InputManager is
 * attached to a detached EventTarget so it doesn't swallow page keys; it is
 * only used to load/apply/persist bindings. Audio volumes persist through
 * the same storage the game reads, as does graphics quality, which takes
 * effect the next time a game boots. Returns a cleanup function.
 */
export function openStandaloneSettings(onClose: () => void): () => void {
  const input = new InputManager(new EventTarget() as unknown as Window);
  // Phones get the touch options instead of the key-rebind grid.
  input.touch.setActive(isTouchFirst());
  input.touch.haptics = loadHaptics();
  const menu = new SettingsMenu(input, new Silent());
  menu.quality = { pinned: savedQuality, set: saveQuality };
  let closed = false;
  menu.onClose = () => {
    closed = true;
    window.removeEventListener('keydown', onKey);
    input.dispose();
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') menu.close();
  };
  window.addEventListener('keydown', onKey);
  menu.open();
  return () => {
    if (!closed) {
      menu.onClose = null;
      menu.close();
      window.removeEventListener('keydown', onKey);
      input.dispose();
    }
  };
}
