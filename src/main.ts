import { createAudio } from './audio';
import { parseSeed, randomSeed } from './core/rng';
import { installDebug } from './debug';
import { Match } from './game/match';
import { loadRules, saveRules } from './game/rules';
import { InputManager } from './input/input';
import { Renderer } from './render/renderer';
import { DT } from './sim/constants';
import { THEME_IDS } from './themes';
import { NamePrompt, RulesMenu, SettingsMenu } from './ui/menus';
import { loadProfile, saveProfile } from './ui/profile';

const glCanvas = document.getElementById('game') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud') as HTMLCanvasElement;
glCanvas.focus();

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const themeParam = params.get('theme');
const match = new Match(
  seedParam ? parseSeed(seedParam) : randomSeed(),
  THEME_IDS.find((t) => t === themeParam),
);
match.rules = loadRules();
const input = new InputManager(window);
input.viewEl = glCanvas;
const renderer = new Renderer(glCanvas, hudCanvas);
renderer.hud.devices = input;
const audio = createAudio();

// --- local menus (DOM overlays) and profile ---------------------------------
const settingsMenu = new SettingsMenu(input, audio);
const rulesMenu = new RulesMenu(input);
const namePrompt = new NamePrompt(input);
const profile = loadProfile();
const menus = [settingsMenu, rulesMenu, namePrompt];

function promptName() {
  const p = match.players.find((q) => q.device === input.mouseDevice);
  if (!p) return;
  namePrompt.open(p.character.name, profile.name, (name) => {
    profile.name = name;
    profile.prompted = true;
    saveProfile(profile);
    if (name) match.setName(p.slot, name);
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
        if (match.phase !== 'lobby') return;
        match.rules = r;
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
  }
};
window.addEventListener('keydown', () => audio.unlock(), { once: true });

/** Keep the local keyboard/mouse player's chosen name; ask once on first join. */
function syncProfile() {
  const p = match.players.find((q) => q.device === input.mouseDevice);
  if (!p) return;
  if (profile.name && p.character.name !== profile.name) match.setName(p.slot, profile.name);
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
    match.step(input.sample());
    acc -= DT;
  }
  syncProfile();
  renderer.hud.pointer = input.pointerPos;
  uiHover();
  renderer.hud.mouseDevice = input.mouseDevice;
  const events = match.drainEvents();
  audio.handle(events, match);
  audio.update(match, now);
  renderer.render(match, now, events);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
