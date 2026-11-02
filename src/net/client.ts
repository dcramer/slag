import type { Match } from '../game/match';
import { acquirePeerId, loadResume, saveResume } from './identity';
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
}

export interface RoomConnection {
  net: NetSession;
  inviteUrl: string;
  /** For the HUD; undefined when offline. */
  hudInfo(): NetHudInfo | undefined;
  /** Report a status change worth interrupting play for, once. */
  toast(show: (msg: string) => void): void;
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
};

export function connectRoom(room: string, match: Match, opts: { primaryDevice: string; params?: URLSearchParams }): RoomConnection {
  const params = opts.params ?? new URLSearchParams(location.search);
  const ident = acquirePeerId(room);
  const transport = chooseTransport(room, ident.id, params);
  const net = new NetSession({
    transport,
    match,
    primaryDevice: opts.primaryDevice,
    resume: () => loadResume(room),
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
    if (net.status === 'reconnecting' || net.status === 'connecting') return STATUS_LABEL[net.status];
    if (net.paused && net.role === 'host') return 'Migrating Host…';
    if (net.role === 'guest' && !net.synced) return 'Joining…';
    if (transport?.kind === 'broadcast') return `Local Tabs · ${peers.length} Connected`;
    return net.isHost ? `Hosting · ${peers.length} Connected` : `${peers.length} Connected`;
  };
  let lastToast = '';
  return {
    net,
    inviteUrl,
    hudInfo() {
      if (!transport) return undefined;
      return {
        status: statusLine(),
        inviteUrl: net.status === 'unavailable' ? undefined : inviteUrl,
        offline: net.status === 'unavailable',
        peers: net.peers().map((p) => ({ name: p.name, isHost: p.isHost, pingMs: p.ping === null || p.isHost ? undefined : p.ping, local: p.isSelf })),
      };
    },
    toast(show) {
      // The panel only shows in the lobby; the states that freeze a race need saying everywhere.
      const msg = net.status === 'reconnecting' ? 'Connection Lost' : net.status === 'unavailable' ? statusLine() : net.paused && net.isHost ? 'Host Left' : '';
      if (msg && msg !== lastToast) show(msg);
      lastToast = msg;
    },
  };
}
