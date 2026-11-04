import { css } from '../core/color';
import type { Match } from '../game/match';
import type { HudAction, NetArrival, NetInfo, NetWatcher } from '../render/hud';
import type { InputFrame } from '../sim/types';
import { addBreadcrumb } from '../telemetry';
import { peerOf, personOf } from './actions';
import { acquirePeerId, clientId, kickedUntil, loadResume, markKicked, saveResume } from './identity';
import { NetSession, type NetStatus } from './session';
import { HttpSignal } from './signal-client';
import { snapshotMatch } from './snapshot';
import { BroadcastTransport, type Transport } from './transport';
import { browserRtc, WebRtcTransport } from './webrtc-transport';

/**
 * Browser entry point for online play: picks a transport, claims this tab's
 * peer id, wires resume-saves and page lifecycle, and returns the session.
 *
 * Transport choice:
 *   ?net=off    offline (also implied by debug ?players / ?race)
 *   ?net=bc     BroadcastChannel: tabs of this browser only, no server
 *   otherwise   WebRTC, through the signaling API (signal-client.ts says where that is)
 */

/** What the HUD draws for the room: the online panel, the joining screen, and where this peer sits. */
export type NetHudInfo = NetInfo;

export interface RoomConnection {
  net: NetSession;
  inviteUrl: string;
  /** For the HUD; undefined when offline. */
  hudInfo(): NetHudInfo | undefined;
  /** Report a status change worth interrupting play for, once. */
  toast(show: (msg: string) => void): void;
  /** Remove the peer that owns a match device. */
  kick(device: string): void;
  /** Host's keyboard and gamepad route to kicking, in the lobby: `use` picks a player, confirm kicks, alt cancels. Consumes what it uses. */
  lobbyInput(frames: Record<string, InputFrame>): void;
  /**
   * Keyboard and gamepad on the joining screen and for a peer without a seat: confirm takes a seat (or the failed
   * room's way out), alt watches. Consumes what it uses, and returns the HUD action to run, if any.
   */
  seatInput(frames: Record<string, InputFrame>): HudAction | null;
  /** Take a seat (now in the lobby, next round mid-match). */
  play(): void;
  /** Watch instead of playing. */
  watch(): void;
  /** The room failed: play on here, offline, without the joining screen. */
  stayOffline(): void;
  /** Kicked, and the ban has run out: try the room again. */
  rejoin(): void;
  /** Leave the room for good: save, say goodbye so it re-elects at once, and stop every timer and listener. */
  close(): void;
}

export interface ConnectOptions {
  /** The local device to seat, read when the seat is asked for (see `SessionOptions.primaryDevice`). */
  primaryDevice: () => string;
  params?: URLSearchParams;
  /** Try the room again: a kicked tab whose ban ran out pressed Rejoin. */
  onRejoin(): void;
  /** The page came back from the back/forward cache after the session was closed: start the room over. */
  onRestored(): void;
  /** The name an observer's chip shows. */
  name?: () => string;
}

/** Joining screens shorter than this aren't shown: a fresh room of our own is up before anyone could read one. */
const ARRIVAL_DELAY_MS = 350;

export function chooseTransport(room: string, peer: string, params: URLSearchParams): Transport | null {
  const mode = params.get('net');
  if (mode === 'off' || (!mode && (params.has('players') || params.has('race')))) return null;
  if (mode === 'bc') return new BroadcastTransport(room, peer);
  const rtc = browserRtc();
  // No WebRTC in this browser: stay local, and say why in the lobby.
  if (!rtc) return unavailableTransport(peer, 'WebRTC Unsupported');
  return new WebRtcTransport(room, peer, { signal: new HttpSignal(room, peer), rtc, hidden: () => document.hidden });
}

function unavailableTransport(self: string, why: string): Transport {
  return { kind: 'webrtc', self, start: (h) => h.status('unavailable', why), send: () => {}, close: () => {} };
}

const STATUS_LABEL: Record<NetStatus, string> = {
  offline: 'Offline',
  connecting: 'Connecting…',
  online: 'Online',
  reconnecting: 'Reconnecting…',
  unavailable: 'Offline',
  kicked: 'Kicked',
};

/** The host runs another build: its snapshots don't load here. */
const REFUSED = 'Different Version · Reload';

export function connectRoom(room: string, match: Match, opts: ConnectOptions): RoomConnection {
  const params = opts.params ?? new URLSearchParams(location.search);
  const ident = acquirePeerId(room);
  const opened = Date.now();
  const life = new AbortController();
  const on = { signal: life.signal };
  // Kicked from here and still banned: don't even ask, the host would only refuse. The screen counts down instead.
  const banned = kickedUntil(room);
  const chosen = chooseTransport(room, ident.id, params);
  const transport: Transport | null = chosen && banned ? { kind: chosen.kind, self: ident.id, start: () => {}, send: () => {}, close: () => {} } : chosen;
  // `?ban=<seconds>`: a host's kicks last that long (tests; the default is KICK_BAN_FRAMES).
  const banSeconds = Number(params.get('ban'));
  // `?drop=<seconds>`: how long a gone player keeps its seat mid-match; `?expire=<seconds>`: how long an empty room lasts. Tests only.
  const dropSeconds = Number(params.get('drop'));
  const expireSeconds = Number(params.get('expire'));
  const net = new NetSession({
    transport,
    match,
    primaryDevice: opts.primaryDevice,
    watch: params.has('watch'),
    name: opts.name,
    resume: () => loadResume(room, opened, expireSeconds > 0 ? expireSeconds * 1000 : undefined), // a previous visit's state, never this one's
    client: clientId(),
    banFrames: banSeconds > 0 ? banSeconds * 60 : undefined,
    dropFrames: dropSeconds > 0 ? dropSeconds * 60 : undefined,
    onKicked: (until) => markKicked(room, until),
    // The session only logs what changes the room (links, migrations, syncs, desyncs): each is a step in the trail.
    log: (m) => {
      console.info(`[net] ${m}`);
      addBreadcrumb('net', m);
    },
  });
  if (banned) net.refuse(banned);

  // Resume-save: the last state this browser saw, so a room everyone left can pick up where it was.
  let lastSave = 0;
  const save = () => {
    // Only the room's state: a page still joining starts as a host of its own empty lobby, and one that never got in
    // (unavailable, kicked) or is between hosts holds nothing better, so saving would bury the last good save.
    if (!transport || net.status !== 'online' || net.paused || (net.role === 'guest' && !net.synced)) return;
    saveResume(room, snapshotMatch(match), net.ns);
  };
  const timer = setInterval(() => {
    if (Date.now() - lastSave > 2000) {
      lastSave = Date.now();
      save();
    }
  }, 1000);
  const shut = () => {
    if (life.signal.aborted) return;
    life.abort();
    clearInterval(timer);
    save();
    net.close(); // say goodbye now so the room re-elects immediately
    ident.release();
  };
  // Back/forward cache: the session was closed on pagehide; start over cleanly.
  // It outlives shut(), which pagehide runs: only leaving the room in the app ends it.
  const page = new AbortController();
  addEventListener('pageshow', (e) => e.persisted && opts.onRestored(), { signal: page.signal });
  addEventListener('pagehide', shut, on);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (!document.hidden && transport instanceof WebRtcTransport) transport.resume();
    },
    on,
  );

  const inviteUrl = `${location.origin}/r/${room}`;
  const statusLine = (): string => {
    const peers = net.peers();
    if (net.status === 'unavailable') return net.detail || STATUS_LABEL.unavailable;
    if (net.status === 'kicked') return STATUS_LABEL.kicked;
    if (net.status === 'reconnecting' || net.status === 'connecting') return STATUS_LABEL[net.status];
    if (net.paused && net.role === 'host') return 'Migrating Host…';
    if (net.role === 'guest' && !net.synced) return net.refused ? REFUSED : 'Joining…';
    if (transport?.kind === 'broadcast') return `Local Tabs · ${peers.length} Connected`;
    return net.isHost ? `Hosting · ${peers.length} Connected` : `${peers.length} Connected`;
  };
  /** Not in the room, whatever the link says: an invite from here would only bring people to this. */
  const cutOff = () => net.status === 'unavailable' || net.status === 'kicked' || (net.refused && !net.synced);
  const kickable = () =>
    net.isHost && transport && match.phase === 'lobby'
      ? match.players.filter((p) => personOf(p.device) && personOf(p.device) !== net.self).map((p) => p.slot)
      : [];
  const peerInSlot = (slot: number) => personOf(match.player(slot)?.device ?? '');
  let kickSlot = -1;
  let lastToast = '';
  /** In the room at least once: the joining screen is for getting in, not for every later hiccup (toasts cover those). */
  let wasIn = false;
  let offline = false;
  const seat = (): NetInfo['seat'] => {
    if (net.seated) return match.players.some((p) => personOf(p.device) === net.self && p.leaving) ? 'leaving' : 'seated';
    // Asking in the lobby (an arrival) is a seat a few frames away; owed one mid-round is a seat next round.
    return net.queued || (net.intent === 'play' && !net.watching) ? 'queued' : 'watching';
  };
  const seats = (): string[] => [...match.players.filter((p) => !p.leaving).map((p) => css(p.character.body)), ...net.ns.queue.map(() => 'queued')];
  const arrival = (): NetArrival | undefined => {
    if (offline) return undefined;
    if (cutOff()) {
      const kicked = net.status === 'kicked';
      const title = kicked ? STATUS_LABEL.kicked : net.refused ? 'Different Version' : net.detail || STATUS_LABEL.unavailable;
      // Kicked: a countdown to when the room will have us back, then Rejoin.
      const rejoinIn = kicked ? Math.max(0, Math.ceil((net.kickedUntil - Date.now()) / 1000)) : undefined;
      return { stage: 'failed', title, here: 0, offline: !kicked, rejoinIn };
    }
    wasIn ||= net.status === 'online' && (net.role === 'host' ? !net.paused : net.synced);
    if (wasIn || Date.now() - opened < ARRIVAL_DELAY_MS) return undefined;
    return { stage: 'connecting', title: statusLine(), here: net.status === 'online' ? net.members.length : 0 };
  };
  const watchers = (): NetWatcher[] => {
    const host = net.isHost && match.phase === 'lobby';
    return net
      .peers()
      .filter((p) => !p.seated)
      .map((p) => ({ peer: p.id, name: p.name, self: p.isSelf, afk: !!p.watching?.afk, kickable: host && !p.isSelf }));
  };
  return {
    net,
    inviteUrl,
    close() {
      shut();
      page.abort();
    },
    hudInfo() {
      if (!transport) return undefined;
      return {
        status: statusLine(),
        inviteUrl: cutOff() ? undefined : inviteUrl,
        offline: cutOff(),
        stranded: net.refused && !net.synced,
        hostSlot: match.players.find((p) => personOf(p.device) === net.hostId)?.slot,
        kickable: kickable(),
        kickSlot,
        peers: net.peers().map((p) => ({ name: p.name, isHost: p.isHost, pingMs: p.ping === null || p.isHost ? undefined : p.ping, local: p.isSelf })),
        seat: cutOff() ? undefined : seat(),
        space: net.space,
        seats: seats(),
        watchers: watchers(),
        arrival: arrival(),
      };
    },
    play: () => net.play(),
    watch: () => net.watch(),
    rejoin: () => opts.onRejoin(),
    stayOffline: () => {
      offline = true;
    },
    seatInput(frames) {
      if (!transport) return null;
      const a = arrival();
      const s = a || cutOff() ? null : seat();
      // A watcher sends no input, so its keys are free for Join; a seated peer's are its player's.
      if (!a && s !== 'watching') return null;
      let out: HudAction | null = null;
      for (const f of Object.values(frames)) {
        if (f.confirmPressed) {
          if (a) out = a.stage === 'failed' ? (a.rejoinIn === 0 ? 'rejoin' : a.offline ? 'offline' : 'home') : null;
          else if (net.space > 0) out = 'play';
        }
        f.confirmPressed = f.altPressed = f.downPressed = f.usePressed = false;
      }
      return out;
    },
    kick: (device) => net.kick(peerOf(device)),
    lobbyInput(frames) {
      const list = kickable();
      if (!list.includes(kickSlot)) kickSlot = -1;
      if (list.length === 0) return;
      for (const f of Object.values(frames)) {
        if (f.usePressed) kickSlot = list[list.indexOf(kickSlot) + 1] ?? -1;
        else if (kickSlot >= 0 && f.confirmPressed) {
          net.kick(peerInSlot(kickSlot));
          kickSlot = -2; // this frame's confirm is spent
        } else if (kickSlot >= 0 && f.altPressed) kickSlot = -2;
        if (kickSlot !== -1) f.confirmPressed = f.altPressed = f.downPressed = false;
        if (kickSlot === -2) kickSlot = -1;
      }
    },
    toast(show) {
      // The panel only shows in the lobby; the states that freeze a race need saying everywhere.
      const msg =
        net.status === 'kicked'
          ? 'Kicked'
          : net.status === 'reconnecting'
            ? 'Connection Lost'
            : net.status === 'unavailable'
              ? statusLine()
              : net.refused && !net.synced
                ? REFUSED
                : net.paused && net.isHost
                  ? 'Host Left'
                  : '';
      if (msg && msg !== lastToast) show(msg);
      lastToast = msg;
    },
  };
}
