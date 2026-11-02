import 'client-only';
import { createAudio } from './audio';
import { parseSeed } from './core/rng';
import { installDebug } from './debug';
import { Match } from './game/match';
import { roomSeed } from './game/room';
import { loadRules, saveRules } from './game/rules';
import { InputManager } from './input/input';
import { TOUCH_DEVICE, touchModeFor } from './input/touch';
import { ITEMS } from './sim/items';
import { Renderer } from './render/renderer';
import { DT } from './sim/constants';
import { THEME_IDS } from './themes';
import { InputModeTracker } from './ui/input-mode';
import { loadHaptics, NamePrompt, RulesMenu, SettingsMenu } from './ui/menus';
import { detectQuality, isTouchFirst } from './ui/touch/device';
import { TouchOverlay } from './ui/touch/overlay';
import { loadProfile, saveProfile } from './ui/profile';

let booted = false;

/**
 * Boot the game into `container` for lobby `room`. All game logic runs
 * client-side; the Next.js route (/r/[room]) only server-renders the shell
 * and calls this once mounted. Debug URL params (?seed, ?theme, ?players,
 * ?race…) are still read from location.search.
 */
export function bootGame(container: HTMLElement, room: string): void {
  if (booted) return; // React strict mode / remounts: one game per page
  booted = true;
  const glCanvas = document.createElement('canvas');
  const hudCanvas = document.createElement('canvas');
  glCanvas.tabIndex = 0;
  glCanvas.style.cssText = 'display:block;outline:none';
  hudCanvas.style.cssText = 'display:block;pointer-events:none';
  container.append(glCanvas, hudCanvas);
  glCanvas.focus();

  const params = new URLSearchParams(location.search);
  const seedParam = params.get('seed'); // debug override
  const themeParam = params.get('theme');
  const match = new Match(
    seedParam ? parseSeed(seedParam) : roomSeed(room),
    THEME_IDS.find((t) => t === themeParam),
  );
  match.rules = loadRules();
  // Host-rolled per-match salt (crate order); re-rolled while in the lobby so every game differs.
  match.nextSalt = (Math.random() * 4294967296) >>> 0;
  const input = new InputManager(window);
  input.viewEl = glCanvas;
  // In the lobby only real buttons act; a stray click must not join/ready/start.
  input.clickConfirms = () => match.phase !== 'lobby';
  const renderer = new Renderer(glCanvas, hudCanvas);
  renderer.hud.devices = input;
  renderer.hud.room = room;
  renderer.hud.hidden = params.get('ui') === '0';
  const audio = createAudio();
  const inputMode = new InputModeTracker(window);

  // --- local menus (DOM overlays) and profile ---------------------------------
  const settingsMenu = new SettingsMenu(input, audio);
  settingsMenu.leave = () => location.assign('/');
  settingsMenu.quality = {
    pinned: () => {
      try {
        const q = localStorage.getItem('slag.quality');
        return q === 'high' || q === 'mid' || q === 'low' ? q : null;
      } catch {
        return null;
      }
    },
    set: (tier) => {
      try {
        if (tier) localStorage.setItem('slag.quality', tier);
        else localStorage.removeItem('slag.quality');
      } catch {
        // Not persisted; still applies this session.
      }
      renderer.setQuality(tier ?? detectQuality().tier);
    },
  };
  const rulesMenu = new RulesMenu(input);
  const namePrompt = new NamePrompt(input);
  const profile = loadProfile();
  const menus = [settingsMenu, rulesMenu, namePrompt];

  function promptName() {
    const p = match.players.find((q) => q.device === input.pointerDevice);
    if (!p) return;
    let decided = false;
    // Whatever you end up with — typed, kept-random, or just closing the prompt — is remembered.
    const keep = (name: string) => {
      decided = true;
      profile.name = name;
      profile.prompted = true;
      saveProfile(profile);
      match.setName(p.slot, name);
    };
    namePrompt.onClose = () => {
      if (!decided) keep(p.character.name);
    };
    namePrompt.open(p.character.name, profile.name, (name) => keep(name ?? p.character.name));
  }

  input.onEscape = () => {
    const open = menus.find((m) => m.isOpen);
    audio.ui?.(open ? 'close' : 'open');
    if (open) open.close();
    else settingsMenu.open();
  };

  input.hitTest = (x, y) => {
    audio.unlock();
    if (menus.some((m) => m.isOpen)) return null;
    const b = renderer.hud.hit(x, y);
    if (!b) return null;
    audio.ui?.('click');
    switch (b.action) {
      case 'settings':
        settingsMenu.open();
        return true;
      case 'rules':
        rulesMenu.open(match.rules, (r) => {
          if (match.phase !== 'lobby') return;
          match.rules = r;
          saveRules(r);
        });
        return true;
      case 'name':
        promptName();
        return true;
      case 'invite': {
        const url = renderer.hud.net?.inviteUrl ?? location.href;
        navigator.clipboard?.writeText(url).then(
          () => renderer.hud.toast('Invite Link Copied'),
          () => renderer.hud.toast(url, 4000),
        );
        return true;
      }
      case 'join':
      case 'ready':
      case 'continue':
        return { device: b.device ?? input.pointerDevice, confirm: true };
      case 'look':
        return { device: b.device ?? input.pointerDevice, alt: true };
      case 'level':
        return { device: b.device ?? input.pointerDevice, down: true };
    }
  };
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  // --- touch controls (mobile; see docs/MOBILE.md) ---------------------------
  // Touch is its own device ('touch'); pointerDevice switches the HUD's "mine"
  // buttons to it while touch is the latest input.
  input.touch.setActive(isTouchFirst());
  input.touch.haptics = loadHaptics();
  input.touch.onGesture = () => audio.unlock(); // iOS only unlocks audio inside a touch gesture
  const touchOverlay = new TouchOverlay(input.touch, container, () => input.onEscape?.());

  /** Keep the local keyboard/mouse player's chosen name; ask once on first join. */
  let appliedLook: number | null = null;
  function syncProfile() {
    const p = match.players.find((q) => q.device === input.pointerDevice);
    if (!p) {
      appliedLook = null; // re-apply the saved look when they (re)join
      return;
    }
    // Look: restore the saved one on join; afterwards a new look (reroll) becomes the saved one.
    if (appliedLook === null) {
      if (profile.look != null) match.setLook(p.slot, profile.look);
      appliedLook = p.character.seed;
      if (profile.look == null) {
        profile.look = appliedLook;
        saveProfile(profile);
      }
    } else if (p.character.seed !== appliedLook) {
      appliedLook = p.character.seed;
      profile.look = appliedLook;
      saveProfile(profile);
    }
    // Name: a reroll also rolls a random name, so re-apply the saved one.
    // Name: a reroll also rolls a random name, so re-apply the saved one (unless another local player already has it).
    const taken = match.players.some((q) => q !== p && q.character.name === profile.name);
    if (profile.name && !taken && p.character.name !== profile.name) match.setName(p.slot, profile.name);
    if (!profile.prompted && match.phase === 'lobby' && !menus.some((m) => m.isOpen)) {
      profile.prompted = true;
      saveProfile(profile);
      promptName();
    }
  }

  /** Soft tick when the pointer moves onto a different HUD button. */
  let hoverKey = '';
  function uiHover() {
    const pt = input.pointerPos;
    const b = pt && !menus.some((m) => m.isOpen) ? renderer.hud.hit(pt.x, pt.y) : null;
    const key = b ? `${b.action}:${b.device ?? ''}` : '';
    glCanvas.style.cursor = b ? 'pointer' : '';
    if (key && key !== hoverKey) audio.ui?.('hover');
    hoverKey = key;
  }

  const loop = { paused: false };
  installDebug(match, renderer, loop);

  // Fixed-timestep simulation, render as fast as the display allows.
  let acc = 0;
  let last = performance.now();
  function frame(now: number) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    if (loop.paused) {
      acc = 0;
      requestAnimationFrame(frame);
      return;
    }
    while (acc >= DT) {
      if (match.phase === 'lobby' && match.phaseFrame === 0) match.nextSalt = (Math.random() * 4294967296) >>> 0;
      input.touch.setMode(touchModeFor(match));
      match.step(input.sample());
      acc -= DT;
    }
    syncProfile();
    renderer.hud.pointer = input.touch.active ? null : input.pointerPos; // no hover highlights under a finger
    uiHover();
    renderer.hud.mouseDevice = input.pointerDevice;
    inputMode.update();
    // Touch controls are authoritative for "touch"; otherwise the last keyboard/mouse vs pad input wins.
    renderer.hud.lastInput = input.touch.active ? 'touch' : inputMode.mode === 'touch' ? 'keyboard' : inputMode.mode;
    renderer.hud.padCount = inputMode.pads;
    const tp = match.players.find((p) => p.device === TOUCH_DEVICE);
    const tr = tp && match.phase === 'run' ? match.run?.runners.find((r) => r.slot === tp.slot && r.alive && !r.finished) : undefined;
    const held = tr?.items.held;
    input.touch.useReady = !!held;
    touchOverlay.update({ canPlace: tp && match.phase === 'place' ? match.canPlaceFor(tp) : undefined, use: held ? ITEMS[held.kind].verb : undefined });
    const events = match.drainEvents();
    if (tp && input.touch.active && events.some((e) => e.type === 'death' && e.slot === tp.slot)) input.touch.buzz(30);
    audio.handle(events, match);
    audio.update(match, now);
    renderer.render(match, now, events);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
