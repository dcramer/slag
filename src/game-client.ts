import 'client-only';
import { createAudio } from './audio';
import { parseSeed } from './core/rng';
import { installDebug } from './debug';
import { type GenInfo, lastGenInfo } from './gen/level';
import { Match, planMisses, rulesProfile } from './game/match';
import { roomSeed } from './game/room';
import { loadRules, saveRules } from './game/rules';
import { InputManager } from './input/input';
import { TOUCH_DEVICE, touchModeFor } from './input/touch';
import { connectRoom, type RoomConnection } from './net/client';
import { SNAP_VERSION } from './net/snapshot';
import type { Nav, Unmount } from './router';
import { HOME, lobby } from './routes';
import { ITEMS } from './sim/items';
import type { HudAction, JoinCardInfo } from './render/hud';
import { type CharacterDef, generateCharacter } from './gen/character';
import type { InputFrame } from './sim/types';
import { Renderer } from './render/renderer';
import type { Level } from './sim/level';
import { DT, POP_HOLD } from './sim/constants';
import { addBreadcrumb, reportEvent, setContext, setTelemetryContext, type TelemetryContext, type TelemetryData } from './telemetry';
import { THEME_IDS } from './themes';
import { InputModeTracker } from './ui/input-mode';
import { LevelAhead, reportGenFallback } from './level-ahead';
import { loadHaptics, NamePrompt, RulesMenu, SettingsMenu } from './ui/menus';
import { FloatingLogo } from './ui/screens/logo';
import { detectQuality, isTouchFirst, savedQuality, saveQuality } from './ui/touch/device';
import { TouchOverlay } from './ui/touch/overlay';
import { loadProfile, saveProfile } from './ui/profile';

/** About the gap between a pinch's two fingers landing, in sim frames. */
const PINCH_WAIT_FRAMES = 6;

/** One level builder for the page: its worker outlives any one lobby, so the next one starts warm. */
let levelAhead: LevelAhead | null = null;

/**
 * The lobby screen, and the whole game behind it: mounts the canvases into
 * `root` and runs lobby `room` until the returned function is called, which
 * leaves the room and lets go of everything the game took (listeners, the
 * GPU and audio contexts, workers, the network). Debug URL params (?seed,
 * ?theme, ?players, ?race…) are still read from location.search. The first
 * level is built off the main thread, so the page stays alive while it loads.
 */
export async function mountLobby(root: HTMLElement, room: string, nav: Nav): Promise<Unmount> {
  setTelemetryContext(() => ({ screen: 'lobby', room })); // a failed boot still says which lobby
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;overflow:hidden;background:#07060b';
  root.append(container);
  const params = new URLSearchParams(location.search);
  const seedParam = params.get('seed'); // debug override
  const themeParam = params.get('theme');
  const seed = seedParam ? parseSeed(seedParam) : roomSeed(room);
  const theme = THEME_IDS.find((t) => t === themeParam);
  const rules = loadRules();
  levelAhead ??= new LevelAhead();
  const levels = levelAhead;
  await levels.first({ seed, theme, profile: rulesProfile(rules) });
  // Gone while the level was being built: the router drops what this returns, so there's nothing to stop.
  if (!container.isConnected) return () => {};
  return startGame(container, room, params, new Match(seed, theme, rules), levels, nav);
}

function startGame(container: HTMLElement, room: string, params: URLSearchParams, match: Match, levels: LevelAhead, nav: Nav): Unmount {
  /** Aborts when the game leaves the page; everything it set up hangs off this. */
  const life = new AbortController();
  const glCanvas = document.createElement('canvas');
  const hudCanvas = document.createElement('canvas');
  glCanvas.tabIndex = 0;
  glCanvas.style.cssText = 'display:block;outline:none';
  hudCanvas.style.cssText = 'display:block;pointer-events:none';
  container.append(glCanvas, hudCanvas);
  glCanvas.focus();

  // Host-rolled per-match salt (crate order); re-rolled while in the lobby so every game differs.
  match.nextSalt = (Math.random() * 4294967296) >>> 0;
  const input = new InputManager(window);
  // In the lobby only real buttons act; a stray click must not join/ready/start.
  input.clickConfirms = () => match.phase !== 'lobby';
  input.mouseAlts = () => match.phase === 'place';
  const renderer = new Renderer(glCanvas, hudCanvas);
  input.viewEl = renderer.viewBox;
  renderer.hud.room = room;

  // --- online (src/net): every browser on /r/<room> runs the same lockstep match -------
  // Match devices are global ids ('<peer>:kb1'); the session maps local devices in and out.
  const conn = connectRoom(room, match, {
    // Read at seat time: touch only becomes the pointer device further down, so a phone read here would seat a keyboard.
    primaryDevice: () => input.pointerDevice,
    params,
    onRejoin: () => nav.hardLoad(lobby(room)),
    name: () => loadProfile().name ?? '',
    // Back from the back/forward cache with the session closed: join the room again.
    onRestored: () => nav.hardLoad(lobby(room)),
  });
  const net = conn.net;
  const myDevice = () => net.globalDevice(input.pointerDevice);
  const localDev = (d: string) => (net.isLocal(d) && d.includes(':') ? d.slice(d.indexOf(':') + 1) : d);
  renderer.hud.devices = {
    deviceLabel: (d) => (net.isLocal(d) ? input.deviceLabel(localDev(d)) : 'online'),
    hints: (d) => input.hints(net.isLocal(d) ? localDev(d) : 'pad0'),
    isLocal: (d) => net.isLocal(d),
    get settings() {
      return input.settings;
    },
  };
  renderer.hud.hidden = params.get('ui') === '0';
  const audio = createAudio();
  audio.isLocal = (d) => net.isLocal(d);
  const inputMode = new InputModeTracker(window);
  watchTelemetry(room, match, conn, renderer);

  // --- local menus (DOM overlays) and profile ---------------------------------
  const settingsMenu = new SettingsMenu(input, audio);
  settingsMenu.leave = () => nav.go(HOME);
  // Watch is here, a menu away, so it's never pressed by accident mid-race; the lobby card has it too.
  settingsMenu.seat = () => {
    if (!net.transport || net.status !== 'online' || (net.role === 'guest' && !net.synced)) return null;
    if (net.seated && net.intent !== 'watch') return { label: 'Watch', run: () => conn.watch() };
    if (!net.seated && !net.queued && net.space > 0) return { label: 'Play', run: openCard };
    return null;
  };
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
        if (card) cardName();
        else promptName();
        return true;
      case 'kick':
        if (b.device) conn.kick(b.device);
        return true;
      case 'invite': {
        const url = conn.inviteUrl;
        navigator.clipboard?.writeText(url).then(
          () => renderer.hud.toast('Invite Link Copied'),
          () => renderer.hud.toast(url, 4000),
        );
        return true;
      }
      case 'play':
      case 'seat':
      case 'cancel':
      case 'watch':
      case 'home':
      case 'offline':
      case 'rejoin':
        runAction(b.action);
        return true;
      case 'join':
        // An open bay: someone watching opens the join card; a fresh arrival is seated as it always was.
        if (net.transport && !net.seated && net.watching) {
          openCard();
          return true;
        }
        return { device: b.device ?? input.pointerDevice, confirm: true };
      case 'ready':
      case 'continue':
        return { device: b.device ?? input.pointerDevice, confirm: true };
      case 'look':
        if (!b.device) {
          cardLook();
          return true;
        }
        return { device: b.device ?? input.pointerDevice, alt: true };
      case 'level':
        return { device: b.device ?? input.pointerDevice, down: true };
    }
  };
  /** The joining screen's and the observer's actions, from a click, a tap or a key. */
  function runAction(a: HudAction) {
    if (a === 'play') openCard();
    else if (a === 'seat') cardSeat();
    else if (a === 'cancel') card = null;
    else if (a === 'watch') conn.watch();
    else if (a === 'home') nav.go(HOME);
    else if (a === 'offline') conn.stayOffline();
    else if (a === 'rejoin') conn.rejoin();
  }

  // --- the join card: a watcher's Join, over the live match ------------------------------
  // The character is the saved look (rolled now if there's none yet) and the saved name; once seated, syncProfile
  // applies both like any join. Only the seat request goes to the host.
  let card: { stage: JoinCardInfo['stage']; until: number; now: boolean } | null = null;
  const CARD_RESULT_MS = 1600;
  let cardChar: { key: string; def: CharacterDef } | null = null;
  function cardCharacter(): CharacterDef {
    if (profile.look == null) {
      profile.look = (Math.random() * 4294967296) >>> 0;
      saveProfile(profile);
    }
    const key = `${profile.look}:${profile.name ?? ''}`;
    if (cardChar?.key !== key) {
      const def = generateCharacter(profile.look);
      cardChar = { key, def: profile.name ? { ...def, name: profile.name } : def };
    }
    return cardChar.def;
  }
  function openCard() {
    if (net.transport && !net.seated && !net.queued && net.space > 0) card = { stage: 'edit', until: 0, now: false };
  }
  function cardSeat() {
    if (card?.stage !== 'edit' || net.space <= 0) return;
    card.stage = 'asking';
    net.play();
  }
  function cardLook() {
    if (card?.stage !== 'edit') return;
    profile.look = (Math.random() * 4294967296) >>> 0;
    saveProfile(profile);
  }
  function cardName() {
    if (card?.stage !== 'edit') return;
    const ch = cardCharacter();
    namePrompt.onClose = () => {};
    namePrompt.open(ch.name, profile.name, (name) => {
      if (!name) return;
      profile.name = name;
      profile.prompted = true;
      saveProfile(profile);
    });
  }
  /** Keyboard and gamepad on the card: confirm joins, alt cancels, use rolls a new look, down renames. */
  function cardInput(frames: Record<string, InputFrame>) {
    for (const f of Object.values(frames)) {
      if (card?.stage === 'edit') {
        if (f.confirmPressed) cardSeat();
        else if (f.altPressed) card = null;
        else if (f.usePressed) cardLook();
        else if (f.downPressed) cardName();
      }
      f.confirmPressed = f.altPressed = f.downPressed = f.usePressed = f.jumpPressed = false;
    }
  }
  /** Per drawn frame: the host's answer, how long it stays up, and the card's picture for the HUD. */
  function updateCard(now: number) {
    if (card?.stage === 'asking' && net.seatAsk !== 'asking') {
      card.stage = net.seatAsk === 'won' ? 'won' : 'taken';
      card.now = net.seated;
      card.until = now + CARD_RESULT_MS;
    }
    if (card && ((card.until && now > card.until) || (card.stage === 'edit' && (net.seated || net.queued)))) card = null;
    renderer.hud.joinCard = card ? { character: cardCharacter(), stage: card.stage, now: card.now } : undefined;
  }
  window.addEventListener('keydown', () => audio.unlock(), { once: true, signal: life.signal });

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
  let restoring = false;
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
        restoring = p.character.seed !== profile.look;
        if (restoring) net.act({ t: 'look', dev: p.device, seed: profile.look });
        appliedLook = profile.look;
      } else {
        appliedLook = p.character.seed;
        profile.look = appliedLook;
        saveProfile(profile);
      }
    } else if (p.character.seed !== appliedLook && !net.pending) {
      appliedLook = p.character.seed;
      // Refused because someone here has that look already (say, our other tab): not a choice to save.
      if (!restoring) {
        profile.look = appliedLook;
        saveProfile(profile);
      }
      restoring = false;
    } else if (p.character.seed === appliedLook) restoring = false;
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
  installDebug(match, renderer, loop, net, life.signal);
  // The main menu's logo, laid over the HUD's top bar wherever the HUD puts it, every rendered frame (stepped ones too).
  const logo = new FloatingLogo(container);
  renderer.placeLogo = (box) => logo.place(box);

  // Fixed-timestep simulation, render as fast as the display allows.
  let acc = 0;
  let last = performance.now();
  let lastPhase = match.phase;
  // What the sim and the generator say went wrong, reported by the host alone: every peer computes the same thing.
  // Null: the first frame checks the first level, which this thread made itself when there was no worker.
  let lastLevel: Level | null = null;
  let lastGen: GenInfo | null = null;
  let misses = planMisses.count;
  function checkLevel() {
    lastLevel = match.level;
    addBreadcrumb('game', 'level', { seed: match.seed, theme: match.level.theme.id });
    // A new lastGenInfo means it was generated here rather than handed over by the worker, which reports its own.
    if (lastGen === lastGenInfo) return;
    lastGen = lastGenInfo;
    if (net.isHost) reportGenFallback(lastGenInfo, { seed: match.seed, theme: match.themeOverride, profile: match.profileOverride() });
  }
  function checkPlan() {
    if (planMisses.count === misses) return;
    misses = planMisses.count;
    const data = { seed: match.seed, theme: match.level.theme.id, round: match.round, placed: match.placed.length };
    if (net.isHost) reportEvent('plan-lost', 'error', data);
  }
  let ahead = '';
  /** Keep what the match could ask for next built and waiting. */
  function buildAhead() {
    const key = `${match.seed}:${match.phase === 'lobby'}:${match.themeOverride}:${JSON.stringify(match.profileOverride())}`;
    if (key === ahead) return;
    ahead = key;
    levels.want(match.upcoming());
  }
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
      const frames = input.sample();
      if (card) cardInput(frames);
      const seatAction = conn.seatInput(frames);
      if (seatAction) runAction(seatAction);
      conn.lobbyInput(frames);
      net.tick(frames);
      acc -= DT;
    }
  }
  function frame(now: number) {
    if (life.signal.aborted) return;
    advance(now, 0.25);
    buildAhead();
    if (loop.paused) {
      requestAnimationFrame(frame);
      return;
    }
    if (match.phase !== lastPhase) {
      lastPhase = match.phase;
      addBreadcrumb('game', `phase ${lastPhase}`, { round: match.round });
      checkPlan();
    }
    if (match.level !== lastLevel) checkLevel();
    syncProfile();
    renderer.hud.pointer = input.touch.active ? null : input.pointerPos; // no hover highlights under a finger
    uiHover();
    renderer.hud.mouseDevice = myDevice();
    renderer.hud.net = conn.hudInfo();
    conn.toast((msg) => renderer.hud.toast(msg, 3000, true)); // every net toast is bad news
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
    touchOverlay.update({
      canPlace: tp && match.phase === 'place' ? match.canPlaceFor(tp) : undefined,
      use: held ? ITEMS[held.kind].verb : undefined,
      pop: tr ? tr.pop / POP_HOLD : 0,
    });
    const view = net.view; // guests mid-race: the locally predicted match. Pick and place: live cursors.
    renderer.hud.pendingCard = net.pendingCard;
    updateCard(now);
    const events = net.drainEvents();
    if (tp && input.touch.active && events.some((e) => e.type === 'death' && e.slot === tp.slot)) input.touch.buzz(30);
    audio.handle(events, view);
    audio.update(view, now);
    renderer.render(view, now, events);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Animation frames stop in a background tab and crawl on a busy page, and a peer's ticks are what
  // everyone else is waiting on. A worker's timer is free of both.
  keepTicking(!!net.transport, (now) => !life.signal.aborted && advance(now, 1), life.signal);

  return () => {
    life.abort();
    for (const m of menus) if (m.isOpen) m.close();
    conn.close();
    levels.want([]);
    input.dispose();
    inputMode.dispose();
    touchOverlay.dispose();
    renderer.dispose();
    audio.dispose?.();
    logo.remove();
    container.remove();
    setTelemetryContext(null);
    for (const name of GAME_CONTEXTS) setContext(name, null);
  };
}

const GAME_CONTEXTS = ['level', 'rules', 'net', 'match'] as const;

/**
 * What every report from the lobby carries: tags to search by, contexts to read. All of it is read when a report is
 * built, never per frame.
 */
function watchTelemetry(room: string, match: Match, conn: RoomConnection, renderer: Renderer) {
  const net = conn.net;
  const online = () => !!net.transport;
  setTelemetryContext((): TelemetryContext => ({
    screen: 'lobby',
    room,
    'match.phase': match.phase,
    'match.round': match.round,
    'level.seed': match.seed,
    'level.theme': match.level.theme.id,
    'level.size': match.level.profile?.size ?? 'classic',
    'level.concept': match.level.landmark?.concept ?? 'none',
    players: match.players.length,
    observers: online() ? net.peers().filter((p) => !p.seated).length : 0, // peers with no seat: watching, or owed a seat next round
    'net.role': online() ? (net.isHost ? 'host' : 'guest') : 'local',
    'net.transport': net.transport?.kind ?? 'none',
    'net.status': net.status,
    'net.snap': SNAP_VERSION,
    'input.mode': renderer.hud.lastInput,
    'render.quality': renderer.quality,
  }));
  setContext('level', () => {
    const l = match.level;
    const p = l.profile;
    return {
      seed: match.seed,
      theme: l.theme.id,
      size: `${l.w}x${l.h}`,
      style: l.style,
      concept: l.landmark?.concept,
      weather: l.weather?.kind ?? 'clear',
      gravity: l.gravity ?? 1,
      density: p?.density,
      danger: p?.danger,
      route: p?.route,
      setPieces: l.setPieces.length,
    };
  });
  setContext('rules', () => ({ ...match.rules }) as TelemetryData);
  setContext('match', () => ({
    frame: match.frame,
    phaseFrame: match.phaseFrame,
    placed: match.placed.length,
    crate: match.crate.length,
    winners: match.winners.length,
  }));
  setContext('net', () =>
    online()
      ? {
          self: net.self,
          host: net.hostId,
          detail: net.detail || undefined,
          peers: net.members.length,
          synced: net.synced,
          paused: net.paused,
          refused: net.refused,
          desyncs: net.stats.desyncs,
          syncs: net.stats.syncs,
          migrations: net.stats.migrations,
          render: renderer.renderStyle,
        }
      : { render: renderer.renderStyle },
  );
}

/** Calls `step(now)` from a worker: always online, where a stalled tick stalls the room; offline, only while hidden. Ends with `signal`. */
function keepTicking(online: boolean, step: (now: number) => void, signal: AbortSignal) {
  let worker: Worker | null = null;
  const sync = () => {
    const wanted = online || document.hidden;
    if (wanted && !worker) {
      try {
        const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${online ? 8 : 50})`], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = () => step(performance.now());
      } catch {
        worker = null;
      }
    } else if (!wanted && worker) {
      worker.terminate();
      worker = null;
    }
  };
  sync();
  document.addEventListener('visibilitychange', sync, { signal });
  signal.addEventListener('abort', () => {
    worker?.terminate();
    worker = null;
  });
}
