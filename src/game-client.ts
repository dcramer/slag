import 'client-only';
import { createAudio } from './audio';
import { parseSeed } from './core/rng';
import { installDebug } from './debug';
import { Match } from './game/match';
import { roomSeed } from './game/room';
import { loadRules, saveRules } from './game/rules';
import { InputManager } from './input/input';
import { TOUCH_DEVICE, touchModeFor } from './input/touch';
import { connectRoom } from './net/client';
import { ITEMS } from './sim/items';
import { Renderer } from './render/renderer';
import { DT } from './sim/constants';
import { addBreadcrumb, setTelemetryContext } from './telemetry';
import { THEME_IDS } from './themes';
import { InputModeTracker } from './ui/input-mode';
import { loadHaptics, NamePrompt, RulesMenu, SettingsMenu } from './ui/menus';
import { detectQuality, isTouchFirst, savedQuality, saveQuality } from './ui/touch/device';
import { TouchOverlay } from './ui/touch/overlay';
import { loadProfile, saveProfile } from './ui/profile';

let booted = false;
/** About the gap between a pinch's two fingers landing, in sim frames. */
const PINCH_WAIT_FRAMES = 6;

/**
 * Boot the game into `container` for lobby `room`. All game logic runs
 * client-side; the Next.js route (/r/[room]) only server-renders the shell
 * and calls this once mounted. Debug URL params (?seed, ?theme, ?players,
 * ?race…) are still read from location.search.
 */
export function bootGame(container: HTMLElement, room: string): void {
  if (booted) return; // React strict mode / remounts: one game per page
  booted = true;
  setTelemetryContext(() => ({ room })); // a failed boot still says which lobby
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
  match.setRules(loadRules());
  // Host-rolled per-match salt (crate order); re-rolled while in the lobby so every game differs.
  match.nextSalt = (Math.random() * 4294967296) >>> 0;
  const gameContext = () => ({
    room,
    seed: match.seed,
    theme: match.level.theme.id,
    phase: match.phase,
    round: match.round,
    players: match.players.length,
  });
  setTelemetryContext(gameContext);
  const input = new InputManager(window);
  // In the lobby only real buttons act; a stray click must not join/ready/start.
  input.clickConfirms = () => match.phase !== 'lobby';
  input.mouseAlts = () => match.phase === 'place';
  const renderer = new Renderer(glCanvas, hudCanvas);
  input.viewEl = renderer.viewBox;
  renderer.hud.room = room;

  // --- online (src/net): every browser on /r/<room> runs the same lockstep match -------
  // Match devices are global ids ('<peer>:kb1'); the session maps local devices in and out.
  const conn = connectRoom(room, match, { primaryDevice: input.pointerDevice, params });
  const net = conn.net;
  const myDevice = () => net.globalDevice(input.pointerDevice);
  const localDev = (d: string) => (net.isLocal(d) && d.includes(':') ? d.slice(d.indexOf(':') + 1) : d);
  renderer.hud.devices = {
    deviceLabel: (d) => (net.isLocal(d) ? input.deviceLabel(localDev(d)) : 'online'),
    hints: (d) => input.hints(net.isLocal(d) ? localDev(d) : 'pad0'),
    get settings() {
      return input.settings;
    },
  };
  renderer.hud.hidden = params.get('ui') === '0';
  const audio = createAudio();
  const inputMode = new InputModeTracker(window);
  setTelemetryContext(() => ({ ...gameContext(), renderStyle: renderer.renderStyle, inputDevice: renderer.hud.lastInput }));

  // --- local menus (DOM overlays) and profile ---------------------------------
  const settingsMenu = new SettingsMenu(input, audio);
  settingsMenu.leave = () => location.assign('/');
  settingsMenu.quality = {
    pinned: savedQuality,
    set: (tier) => {
      saveQuality(tier);
      renderer.setQuality(tier ?? detectQuality().tier);
    },
  };
  const rulesMenu = new RulesMenu(input);
  const namePrompt = new NamePrompt(input);
  const profile = loadProfile();
  const menus = [settingsMenu, rulesMenu, namePrompt];

  function promptName() {
    const p = match.players.find((q) => q.device === myDevice());
    if (!p) return;
    let decided = false;
    // Whatever you end up with — typed, kept-random, or just closing the prompt — is remembered.
    const keep = (name: string) => {
      decided = true;
      profile.name = name;
      profile.prompted = true;
      saveProfile(profile);
      net.act({ t: 'name', dev: p.device, name }); // sequenced by the host online
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
          // Online the host's rules are authoritative; guests' edits are ignored (TODO HUD: read-only for guests).
          if (match.phase !== 'lobby' || !net.isHost) return;
          net.act({ t: 'rules', rules: r });
          saveRules(r);
        });
        return true;
      case 'name':
        promptName();
        return true;
      case 'invite': {
        const url = conn.inviteUrl;
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
  input.touch.onPinch = (ratio, mid, delta) => renderer.phone.pinch(ratio, mid, delta);
  input.pointerMap = (p) => renderer.pointerToMatch(match.phase, p);
  const touchOverlay = new TouchOverlay(input.touch, container, () => input.onEscape?.());

  /** Keep the local keyboard/mouse player's chosen name; ask once on first join. */
  // Online, look and name changes are host-sequenced actions: send each once, not every frame.
  let appliedLook: number | null = null;
  let nameSent = '';
  function syncProfile() {
    const p = match.players.find((q) => q.device === myDevice());
    if (!p) {
      appliedLook = null; // re-apply the saved look when they (re)join
      return;
    }
    // Look: restore the saved one on join; afterwards a new look (reroll) becomes the saved one.
    if (appliedLook === null) {
      if (profile.look != null) {
        if (p.character.seed !== profile.look) net.act({ t: 'look', dev: p.device, seed: profile.look });
        appliedLook = profile.look;
      } else {
        appliedLook = p.character.seed;
        profile.look = appliedLook;
        saveProfile(profile);
      }
    } else if (p.character.seed !== appliedLook && !net.pending) {
      appliedLook = p.character.seed;
      profile.look = appliedLook;
      saveProfile(profile);
    }
    // Name: a reroll also rolls a random name, so re-apply the saved one.
    // Name: a reroll also rolls a random name, so re-apply the saved one (unless another local player already has it).
    const taken = match.players.some((q) => q !== p && q.character.name === profile.name);
    const want = `${p.slot}:${p.character.seed}:${profile.name}`;
    if (profile.name && !taken && p.character.name !== profile.name && nameSent !== want) {
      nameSent = want;
      net.act({ t: 'name', dev: p.device, name: profile.name });
    }
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
  installDebug(match, renderer, loop, net);

  // Fixed-timestep simulation, render as fast as the display allows.
  let acc = 0;
  let last = performance.now();
  let lastPhase = match.phase;
  /** Run the fixed steps due by `now`. Online, the session sequences inputs (host) or applies bundles (guest). */
  function advance(now: number, maxCatchUp: number) {
    acc += Math.min(maxCatchUp, (now - last) / 1000);
    last = now;
    if (loop.paused) {
      acc = 0;
      return;
    }
    while (acc >= DT) {
      // Host-rolled per-match salt, re-rolled on entering the lobby; a host action so every peer shares it.
      if (net.isHost && !net.paused && match.phase === 'lobby' && match.phaseFrame === 0) net.act({ t: 'salt', salt: (Math.random() * 4294967296) >>> 0 });
      input.touch.setMode(touchModeFor(match, net.globalDevice(TOUCH_DEVICE)));
      net.tick(input.sample());
      acc -= DT;
    }
  }
  function frame(now: number) {
    advance(now, 0.25);
    if (loop.paused) {
      requestAnimationFrame(frame);
      return;
    }
    if (match.phase !== lastPhase) {
      lastPhase = match.phase;
      addBreadcrumb('game', `phase ${lastPhase}`, { round: match.round });
    }
    syncProfile();
    renderer.hud.pointer = input.touch.active ? null : input.pointerPos; // no hover highlights under a finger
    uiHover();
    renderer.hud.mouseDevice = myDevice();
    renderer.hud.net = conn.hudInfo();
    conn.toast((msg) => renderer.hud.toast(msg, 3000));
    inputMode.update();
    // Touch controls are authoritative for "touch"; otherwise the last keyboard/mouse vs pad input wins.
    renderer.hud.lastInput = input.touch.active ? 'touch' : inputMode.mode === 'touch' ? 'keyboard' : inputMode.mode;
    renderer.hud.padCount = inputMode.pads;
    const touchDev = net.globalDevice(TOUCH_DEVICE);
    const tp = match.players.find((p) => p.device === touchDev);
    const tr = tp && match.phase === 'run' ? match.run?.runners.find((r) => r.slot === tp.slot && r.alive && !r.finished) : undefined;
    const held = tr?.items.held;
    input.touch.useReady = !!held;
    renderer.phone.dragPoint = input.touch.dragView();
    input.touch.pinchWait = renderer.phone.enabled ? PINCH_WAIT_FRAMES : 0;
    touchOverlay.update({ canPlace: tp && match.phase === 'place' ? match.canPlaceFor(tp) : undefined, use: held ? ITEMS[held.kind].verb : undefined });
    const view = net.view; // guests mid-race: the locally predicted match. Pick and place: live cursors.
    renderer.hud.pendingCard = net.pendingCard;
    const events = net.drainEvents();
    if (tp && input.touch.active && events.some((e) => e.type === 'death' && e.slot === tp.slot)) input.touch.buzz(30);
    audio.handle(events, view);
    audio.update(view, now);
    renderer.render(view, now, events);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Background tabs get no animation frames; a hidden host would freeze the whole room.
  // A worker timer (not throttled like page timers) keeps the sim ticking while hidden.
  keepTickingWhenHidden((now) => advance(now, 1));
}

/** Calls `step(now)` ~20×/s while the page is hidden. */
function keepTickingWhenHidden(step: (now: number) => void) {
  let worker: Worker | null = null;
  const sync = () => {
    if (document.hidden && !worker) {
      try {
        const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 50)'], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = () => document.hidden && step(performance.now());
      } catch {
        worker = null;
      }
    } else if (!document.hidden && worker) {
      worker.terminate();
      worker = null;
    }
  };
  document.addEventListener('visibilitychange', sync);
}
