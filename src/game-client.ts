import 'client-only';
import { createAudio } from './audio';
import { parseSeed } from './core/rng';
import { installDebug } from './debug';
import { Match } from './game/match';
import { roomSeed } from './game/room';
import { loadRules, saveRules } from './game/rules';
import { InputManager } from './input/input';
import { mountNetBadge } from './net/badge';
import { connectRoom } from './net/client';
import { Renderer } from './render/renderer';
import { DT } from './sim/constants';
import { THEME_IDS } from './themes';
import { NamePrompt, RulesMenu, SettingsMenu } from './ui/menus';
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
  const input = new InputManager(window);
  input.viewEl = glCanvas;
  // In the lobby only real buttons act; a stray click must not join/ready/start.
  input.clickConfirms = () => match.phase !== 'lobby';
  const renderer = new Renderer(glCanvas, hudCanvas);
  renderer.hud.room = room;

  // --- online (src/net): every browser on /r/<room> runs the same lockstep match -------
  // Match devices are global ids ('<peer>:kb1'); the session maps local devices in and out.
  const conn = connectRoom(room, match, { primaryDevice: input.mouseDevice, params });
  const net = conn.net;
  const myDevice = () => net.globalDevice(input.mouseDevice);
  const localDev = (d: string) => (net.isLocal(d) && d.includes(':') ? d.slice(d.indexOf(':') + 1) : d);
  renderer.hud.devices = {
    deviceLabel: (d) => (net.isLocal(d) ? input.deviceLabel(localDev(d)) : 'online'),
    hints: (d) => input.hints(net.isLocal(d) ? localDev(d) : 'pad0'),
  };
  // For the HUD's online lobby (crown, pings, invite): see NetHudInfo in src/net/client.ts.
  Object.assign(renderer.hud, { net: conn.hud });
  if (params.get('ui') !== '0' && conn.net.transport) mountNetBadge(container, conn);
  renderer.hud.hidden = params.get('ui') === '0';
  const audio = createAudio();

  // --- local menus (DOM overlays) and profile ---------------------------------
  const settingsMenu = new SettingsMenu(input, audio);
  const rulesMenu = new RulesMenu(input);
  const namePrompt = new NamePrompt(input);
  const profile = loadProfile();
  const menus = [settingsMenu, rulesMenu, namePrompt];

  function promptName() {
    const p = match.players.find((q) => q.device === myDevice());
    if (!p) return;
    namePrompt.open(p.character.name, profile.name, (name) => {
      profile.name = name;
      profile.prompted = true;
      saveProfile(profile);
      if (name) net.act({ t: 'name', dev: p.device, name });
    });
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
    const b = match.phase === 'lobby' ? renderer.hud.hit(x, y) : null;
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
      case 'join':
      case 'ready':
        return { device: b.device ?? input.mouseDevice, confirm: true };
      case 'look':
        return { device: b.device ?? input.mouseDevice, alt: true };
      case 'level':
        return { device: b.device ?? input.mouseDevice, down: true };
      default:
        // Online lobby buttons the HUD may add (see NetHudInfo): 'invite' copies the room link.
        if ((b as { action: string }).action === 'invite') {
          void conn.copyInvite();
          return true;
        }
        return null;
    }
  };
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  /** Keep the local keyboard/mouse player's chosen name; ask once on first join. */
  let nameSent = '';
  function syncProfile() {
    const p = match.players.find((q) => q.device === myDevice());
    if (!p) return;
    // A name change is a sequenced action online: send it once per (player, name), not every frame.
    const want = `${p.slot}:${profile.name}`;
    if (profile.name && p.character.name !== profile.name && nameSent !== want) {
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
    const b = pt && match.phase === 'lobby' && !menus.some((m) => m.isOpen) ? renderer.hud.hit(pt.x, pt.y) : null;
    const key = b ? `${b.action}:${b.device ?? ''}` : '';
    if (key && key !== hoverKey) audio.ui?.('hover');
    hoverKey = key;
  }

  const loop = { paused: false };
  installDebug(match, renderer, loop, net);

  // Fixed-timestep simulation, render as fast as the display allows.
  let acc = 0;
  let last = performance.now();
  /** Run the fixed steps due by `now`. Online, the session sequences inputs (host) or applies bundles (guest). */
  function advance(now: number, maxCatchUp: number) {
    acc += Math.min(maxCatchUp, (now - last) / 1000);
    last = now;
    if (loop.paused) {
      acc = 0;
      return;
    }
    while (acc >= DT) {
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
    syncProfile();
    renderer.hud.pointer = input.pointerPos;
    uiHover();
    renderer.hud.mouseDevice = myDevice();
    const view = net.view; // guests mid-race: the locally predicted match
    const events = net.drainEvents();
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
