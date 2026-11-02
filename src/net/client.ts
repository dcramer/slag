import type { Match } from '../game/match';
import type { InputFrame } from '../sim/types';
import { peerOf } from './actions';
import { acquirePeerId, loadResume, markKicked, saveResume } from './identity';
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

/** What the HUD's online panel draws. Structurally `NetInfo` in src/render/hud.ts. */
export interface NetHudInfo {
  status: string;
  inviteUrl?: string;
  offline?: boolean;
  peers: { name: string; isHost: boolean; pingMs?: number; local: boolean }[];
  /** The player carrying the host label. */
  hostSlot?: number;
  /** Players this peer may remove (host, lobby). */
  kickable?: number[];
  /** Player picked with the keyboard or gamepad, waiting on confirm. */
  kickSlot?: number;
}

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
}

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

/** Long enough to read before landing on the main menu. */
const KICKED_MS = 1500;

export function connectRoom(room: string, match: Match, opts: { primaryDevice: string; params?: URLSearchParams }): RoomConnection {
  const params = opts.params ?? new URLSearchParams(location.search);
  const ident = acquirePeerId(room);
  const transport = chooseTransport(room, ident.id, params);
  const net = new NetSession({
    transport,
    match,
    primaryDevice: opts.primaryDevice,
    resume: () => loadResume(room),
    onKicked: () => {
      markKicked(room);
      setTimeout(() => location.assign('/'), KICKED_MS);
    },
    log: (m) => console.info(`[net] ${m}`),
  });

  // Resume-save: the last state this browser saw, so a room everyone left can pick up where it was.
  let lastSave = 0;
  const save = () => {
    if (!transport || (net.role === 'guest' && !net.synced)) return;
    saveResume(room, snapshotMatch(match), net.ns);
  };
  const timer = setInterval(() => {
    if (Date.now() - lastSave > 2000) {
      lastSave = Date.now();
      save();
    }
  }, 1000);
  // Back/forward cache: the session was closed on pagehide; start over cleanly.
  addEventListener('pageshow', (e) => e.persisted && location.reload());
  addEventListener('pagehide', () => {
    clearInterval(timer);
    save();
    net.close(); // say goodbye now so the room re-elects immediately
    ident.release();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && transport instanceof WebRtcTransport) transport.resume();
  });

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
    net.isHost && transport && match.phase === 'lobby' ? match.players.filter((p) => peerOf(p.device) && peerOf(p.device) !== net.self).map((p) => p.slot) : [];
  const peerInSlot = (slot: number) => peerOf(match.player(slot)?.device ?? '');
  let kickSlot = -1;
  let lastToast = '';
  return {
    net,
    inviteUrl,
    hudInfo() {
      if (!transport) return undefined;
      return {
        status: statusLine(),
        inviteUrl: cutOff() ? undefined : inviteUrl,
        offline: cutOff(),
        hostSlot: match.players.find((p) => peerOf(p.device) === net.hostId)?.slot,
        kickable: kickable(),
        kickSlot,
        peers: net.peers().map((p) => ({ name: p.name, isHost: p.isHost, pingMs: p.ping === null || p.isHost ? undefined : p.ping, local: p.isSelf })),
      };
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
