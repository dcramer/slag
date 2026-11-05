import 'client-only';
import { pageAudio } from './audio/page';
import { BotSeats } from './brain/bots';
import { isBotDevice } from './brain/device';
import { parseSeed } from './core/rng';
import { installDebug } from './debug';
import { type GenInfo, lastGenInfo } from './gen/level';
import { BOT_LEVELS, botLevelLabel, Match, planMisses, rulesProfile } from './game/match';
import { roomSeed } from './game/room';
import { loadRules, saveRules } from './game/rules';
import { InputManager } from './input/input';
import { TOUCH_DEVICE, touchModeFor } from './input/touch';
import { connectRoom, type RoomConnection } from './net/client';
import { joinOpensCard, localOf } from './net/actions';
import { SNAP_VERSION } from './net/snapshot';
import type { Nav, Unmount } from './router';
import { HOME, lobby } from './routes';
import { ITEMS } from './sim/items';
import type { HudAction, JoinCardInfo } from './render/hud';
import { type CharacterDef, generateCharacter, PLAYER_COLORS, withColor } from './gen/character';
import type { InputFrame } from './sim/types';
import { Renderer } from './render/renderer';
import type { Level } from './sim/level';
import { DT, MAX_PLAYERS, POP_HOLD } from './sim/constants';
import { addBreadcrumb, flushTelemetry, reportEvent, setContext, setTelemetryContext, type TelemetryContext, type TelemetryData } from './telemetry';
import { THEME_IDS } from './themes';
import { InputModeTracker } from './ui/input-mode';
import { LevelAhead, reportGenFallback } from './level-ahead';
import { FramePacing } from './frame-pacing';
import { LevelMenu, loadHaptics, ModeMenu, NamePrompt, RulesMenu, SettingsMenu } from './ui/menus';
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
export async function mountLobby(root: HTMLElement, room: string, nav: Nav, opts: { watch?: boolean } = {}): Promise<Unmount> {
  setTelemetryContext(() => ({ screen: 'lobby', room })); // a failed boot still says which lobby
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;overflow:hidden;background:#07060b';
  root.append(container);
  const params = new URLSearchParams(location.search);
  // Chosen to watch from the lobby list: arrive as a watch link does.
  if (opts.watch) params.set('watch', '');
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
  const localDev = (d: string) => (net.isLocal(d) ? localOf(d) : d);
  /** Bots this machine runs: seated as its own devices, so their inputs travel like a second keyboard's. */
  const bots = new BotSeats();
  renderer.hud.ownsBot = (d) => net.isLocal(d) && bots.has(localDev(d));
  renderer.hud.devices = {
    deviceLabel: (d) =>
      isBotDevice(d)
        ? `${botLevelLabel(match.players.find((p) => p.device === d)?.bot ?? 'normal')} Bot`
        : net.isLocal(d)
          ? input.deviceLabel(localDev(d))
          : 'online',
    hints: (d) => input.hints(net.isLocal(d) ? localDev(d) : 'pad0'),
    isLocal: (d) => net.isLocal(d),
    get settings() {
      return input.settings;
    },
  };
  renderer.hud.hidden = params.get('ui') === '0';
  const audio = pageAudio();
  audio.isLocal = (d) => net.isLocal(d);
  const inputMode = new InputModeTracker(window);
  watchTelemetry(room, match, conn, renderer);

  // --- local menus (canvas, src/ui/kit) and profile ----------------------------
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
  const levelMenu = new LevelMenu(input);
  const modeMenu = new ModeMenu(input);
  const namePrompt = new NamePrompt(input);
  const profile = loadProfile();
  const menus = [settingsMenu, rulesMenu, levelMenu, modeMenu, namePrompt];

  /** The character in swatch `i` if it can be worn, else as it is: one object per answer, so the renderer's caches hold. */
  let tinted: { from: CharacterDef; i: number; def: CharacterDef } | null = null;
  function tint(ch: CharacterDef, i: number | undefined, free: boolean): CharacterDef {
    if (i === undefined || ch.color === i || !free) return ch;
    if (tinted?.from !== ch || tinted.i !== i) tinted = { from: ch, i, def: withColor(ch, i) };
    return tinted.def;
  }
  /** Wear swatch `i` from now on: saved, and asked of the room when seated (sequenced by the host online). */
  function pickColor(i: number) {
    profile.color = i;
    saveProfile(profile);
    const p = match.players.find((q) => q.device === myDevice());
    if (p) {
      colorSent = `${p.slot}:${i}`;
      net.act({ t: 'color', dev: p.device, color: i });
    }
  }

  /**
   * The name screen for a seat on this screen: by default the pointer's, whose name and color are saved for next
   * time. Another local seat (a pad beside you) gets the same screen, and its picks last as long as the seat.
   */
  function promptName(dev = myDevice()) {
    const p = match.players.find((q) => q.device === dev);
    if (!p) return;
    const own = dev === myDevice();
    let decided = false;
    // Whatever you end up with — typed, kept-random, or just closing the prompt — is remembered.
    const keep = (name: string) => {
      decided = true;
      if (own) {
        profile.name = name;
        profile.prompted = true;
        saveProfile(profile);
      }
      net.act({ t: 'name', dev: p.device, name }); // sequenced by the host online
    };
    namePrompt.onClose = () => {
      if (!decided && own) keep(p.character.name);
    };
    const me = () => match.players.find((q) => q.device === p.device);
    namePrompt.open({
      randomName: p.character.name,
      current: own ? profile.name : null,
      preview: (i) => {
        const q = me() ?? p;
        return tint(q.character, i, i !== undefined && match.colorFree(i, q));
      },
      free: (i) => match.colorFree(i, me()),
      onColor: own ? pickColor : (i) => net.act({ t: 'color', dev: p.device, color: i }),
      onDone: (name) => keep(name ?? p.character.name),
    });
  }

  /** Run held last step, per local device: a press of it in the lobby opens that seat's name screen (a pad has no pointer). */
  const runHeld = new Map<string, boolean>();
  function nameInput(frames: Record<string, InputFrame>) {
    for (const [dev, f] of Object.entries(frames)) {
      const was = runHeld.get(dev) ?? false;
      runHeld.set(dev, !!f.run);
      if (!f.run || was || dev === TOUCH_DEVICE || match.phase !== 'lobby' || card || menus.some((m) => m.isOpen)) continue;
      if ((renderer.hud.net?.kickSlot ?? -1) >= 0) continue;
      const g = net.globalDevice(dev);
      if (match.players.some((q) => q.device === g)) promptName(g);
    }
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
        rulesMenu.open(
          match.rules,
          (r) => {
            // Online the host's rules are authoritative; guests' edits are ignored (TODO HUD: read-only for guests).
            if (match.phase !== 'lobby' || !net.isHost) return;
            net.act({ t: 'rules', rules: r });
            saveRules(r);
          },
          // Public or Private only means something for a room on the lobby list.
          { listed: !!net.transport?.list },
        );
        return true;
      case 'modeMenu':
        modeMenu.open({
          mode: () => match.rules.mode,
          // A rule like any other: online it's the host's, and it's kept with the host's preferences.
          setMode: (mode) => {
            if (match.phase !== 'lobby' || !net.isHost) return;
            const r = { ...match.rules, mode };
            net.act({ t: 'rules', rules: r });
            saveRules(r);
          },
        });
        return true;
      case 'levelMenu':
        levelMenu.open({
          seed: () => match.seed,
          theme: () => match.themeOverride ?? null,
          rules: () => match.rules,
          name: () => match.level.theme.name,
          shownTheme: () => match.level.theme.id,
          picture: () => renderer.still(),
          // Online the level and the rules are the host's, as the Rules menu's are.
          setLevel: (seed, theme) => {
            if (match.phase === 'lobby' && net.isHost) net.act({ t: 'level', seed, theme });
          },
          setRules: (r) => {
            if (match.phase !== 'lobby' || !net.isHost) return;
            net.act({ t: 'rules', rules: r });
            saveRules(r);
          },
        });
        return true;
      case 'name':
        if (card) cardName();
        else promptName(b.device);
        return true;
      case 'kick':
        if (b.device) conn.kick(b.device);
        return true;
      case 'bot':
        if (canAddBots()) net.act({ t: 'join', dev: net.globalDevice(bots.add(match, 'runner', (d) => net.globalDevice(d))) });
        return true;
      case 'botLevel': {
        const p = match.players.find((q) => q.device === b.device);
        if (p && renderer.hud.ownsBot(p.device))
          net.act({ t: 'bot', dev: p.device, level: BOT_LEVELS[(BOT_LEVELS.indexOf(p.bot ?? 'normal') + 1) % BOT_LEVELS.length] });
        return true;
      }
      case 'unbot':
        if (match.phase === 'lobby' && b.device && renderer.hud.ownsBot(b.device)) {
          net.act({ t: 'leave', dev: b.device });
          bots.remove(localDev(b.device));
        }
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
      // A new player starts in a swatch, like a seat's roll; an old profile with a look keeps its rolled hue.
      profile.color ??= match.freeColorNear(generateCharacter(profile.look).hue);
      saveProfile(profile);
    }
    // The swatch you'd get: the saved one, or the free one nearest it if someone seated wears it.
    let i = profile.color;
    if (i !== undefined && !match.colorFree(i)) i = match.freeColorNear(PLAYER_COLORS[i].h);
    const key = `${profile.look}:${profile.name ?? ''}:${i ?? ''}`;
    if (cardChar?.key !== key) {
      const def = generateCharacter(profile.look);
      const named = profile.name ? { ...def, name: profile.name } : def;
      cardChar = { key, def: i === undefined ? named : withColor(named, i) };
    }
    return cardChar.def;
  }
  /**
   * Join from watching. In the lobby there's nothing to wait for and nothing the lobby card can't change, so it
   * seats you the way arriving does: your card appears among the players. Mid-match it opens the join card.
   */
  function openCard() {
    if (!net.transport || net.seated || net.queued || net.space <= 0) return;
    if (!joinOpensCard(match.phase)) {
      card = null;
      lobbyAsk = true;
      net.play();
    } else card = { stage: 'edit', until: 0, now: false };
  }
  /** A Join from watching in the lobby is out: a lost race for the last seat is said the lobby's way, in a toast. */
  let lobbyAsk = false;
  function settleLobbyAsk() {
    if (!lobbyAsk || net.seatAsk === 'asking') return;
    lobbyAsk = false;
    if (net.seatAsk === 'taken') renderer.hud.toast('Seat Taken', 2400, true);
  }
  function cardSeat() {
    if (card?.stage !== 'edit' || net.space <= 0) return;
    // The match ended into the lobby while the card was up: seated the lobby's way.
    if (!joinOpensCard(match.phase)) return openCard();
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
    namePrompt.open({
      randomName: ch.name,
      current: profile.name,
      preview: () => cardCharacter(),
      free: (i) => match.colorFree(i),
      onColor: pickColor,
      onDone: (name) => {
        if (!name) return;
        profile.name = name;
        profile.prompted = true;
        saveProfile(profile);
      },
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
    settleLobbyAsk();
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
  let colorSent = '';
  function syncProfile() {
    const p = match.players.find((q) => q.device === myDevice());
    if (!p) {
      appliedLook = null; // re-apply the saved look when they (re)join
      return;
    }
    // Look: restore the saved one on join; afterwards a new look (reroll) becomes the saved one.
    if (appliedLook === null) {
      if (profile.look != null) {
        restoring = p.character.seed !== profile.look || (profile.color !== undefined && p.character.color !== profile.color);
        if (restoring) net.act({ t: 'look', dev: p.device, seed: profile.look, ...(profile.color === undefined ? {} : { color: profile.color }) });
        appliedLook = profile.look;
      } else {
        appliedLook = p.character.seed;
        profile.look = appliedLook;
        if (p.character.color !== undefined) profile.color = p.character.color;
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
    // Color: the saved swatch, once it's free (someone else wore it when we sat down, say). Asked once per seat and swatch.
    const wear = `${p.slot}:${profile.color}`;
    if (profile.color !== undefined && p.character.color !== profile.color && colorSent !== wear && !net.pending && match.colorFree(profile.color, p)) {
      colorSent = wear;
      net.act({ t: 'color', dev: p.device, color: profile.color });
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

  /** The lobby's host (or an offline game), seated itself, with a seat to spare. */
  function canAddBots(): boolean {
    return (
      match.phase === 'lobby' && (net.isHost || !net.transport) && match.players.some((p) => p.device === myDevice()) && match.players.length < MAX_PLAYERS
    );
  }

  const loop = { paused: false };
  installDebug(match, renderer, loop, net, life.signal, bots);
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
      nameInput(frames);
      Object.assign(
        frames,
        bots.frames(match, (d) => net.globalDevice(d)),
      );
      net.tick(frames);
      acc -= DT;
    }
  }
  function frame(now: number) {
    if (life.signal.aborted) return;
    const start = performance.now();
    advance(now, 0.25);
    buildAhead();
    if (loop.paused) {
      pacing.pause();
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
    renderer.hud.canAddBots = canAddBots();
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
    renderer.render(view, now, events, acc / DT); // drawn between the last two steps (render/blend.ts)
    pacing.frame(now, match.phase, performance.now() - start);
    requestAnimationFrame(frame);
  }
  const pacing = new FramePacing();
  // The window ends with the tab hidden, and may be the page's last: send it now rather than on the backend's timer.
  const hidden = () => {
    if (!document.hidden) return;
    pacing.pause();
    flushTelemetry();
  };
  document.addEventListener('visibilitychange', hidden, { signal: life.signal });
  requestAnimationFrame(frame);
  // Animation frames stop in a background tab and crawl on a busy page, and a peer's ticks are what
  // everyone else is waiting on. A worker's timer is free of both.
  keepTicking(!!net.transport, (now) => !life.signal.aborted && advance(now, 1), life.signal);

  return () => {
    life.abort();
    pacing.pause();
    for (const m of menus) if (m.isOpen) m.close();
    conn.close();
    levels.want([]);
    input.dispose();
    inputMode.dispose();
    touchOverlay.dispose();
    renderer.dispose();
    audio.menu?.();
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
  // A page being unloaded goes hidden after pagehide: no worker for it (WebKit refuses the blob then, and logs an error).
  let leaving = false;
  addEventListener('pagehide', () => (leaving = true), { signal });
  addEventListener('pageshow', () => (leaving = false), { signal });
  const sync = () => {
    const wanted = (online || document.hidden) && !leaving;
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
