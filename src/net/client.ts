import type { Match } from '../game/match';
import { acquirePeerId, loadResume, saveResume } from './identity';
import { RelayTransport } from './relay-transport';
import { NetSession, type PeerInfo } from './session';
import { snapshotMatch } from './snapshot';
import { BroadcastTransport, type Transport } from './transport';

/**
 * Browser entry point for online play: picks a transport, claims this tab's
 * peer id, wires resume-saves and page lifecycle, and returns the session.
 *
 * Transport choice (first match wins):
 *   ?net=off                    offline (also implied by debug ?players / ?race)
 *   ?net=bc                     BroadcastChannel: tabs of this browser only
 *   ?relay=ws://localhost:8787  a local relay (tools/relay-dev.ts); localhost only
 *   NEXT_PUBLIC_SLAG_RELAY_URL  the deployed Cloudflare relay (docs/NETCODE.md → Setup)
 *   otherwise                   BroadcastChannel, with `notice` explaining online isn't configured
 */

/** What the HUD needs to draw the online lobby (crown, pings, invite link, status line). */
export interface NetHudInfo {
  readonly status: NetSession['status'];
  /** 'relay' | 'broadcast' | null (offline). */
  readonly transport: Transport['kind'] | null;
  /** One-line explanation when online play is limited or unavailable; '' when all is well. */
  readonly notice: string;
  readonly isHost: boolean;
  readonly selfId: string;
  /** Guest waiting for the host's snapshot, or host frozen while reconnecting. */
  readonly paused: boolean;
  /** Absolute URL to share (https://…/r/CODE). */
  readonly inviteUrl: string;
  peers(): PeerInfo[];
  /** True if a match device (Player.device) belongs to this machine. */
  isLocal(device: string): boolean;
  /** Peer that owns a match device. */
  peerOf(device: string): string;
}

export interface RoomConnection {
  net: NetSession;
  hud: NetHudInfo;
  /** Copy the invite link; resolves true on success. */
  copyInvite(): Promise<boolean>;
}

const LOCAL_RELAY = /^wss?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/;

export function chooseTransport(room: string, peer: string, params: URLSearchParams): { transport: Transport | null; notice: string } {
  const mode = params.get('net');
  if (mode === 'off' || (!mode && (params.has('players') || params.has('race')))) return { transport: null, notice: 'Offline (debug)' };
  if (mode === 'bc') return { transport: new BroadcastTransport(room, peer), notice: 'Test mode: only tabs in this browser can join' };
  const override = params.get('relay');
  if (override && LOCAL_RELAY.test(override)) return { transport: new RelayTransport(override, room, peer), notice: '' };
  const url = process.env.NEXT_PUBLIC_SLAG_RELAY_URL;
  if (url) return { transport: new RelayTransport(url, room, peer), notice: '' };
  return { transport: new BroadcastTransport(room, peer), notice: 'Online play is not set up here: only tabs in this browser can join' };
}

export function connectRoom(room: string, match: Match, opts: { primaryDevice: string; params?: URLSearchParams }): RoomConnection {
  const params = opts.params ?? new URLSearchParams(location.search);
  const ident = acquirePeerId(room);
  const { transport, notice } = chooseTransport(room, ident.id, params);
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

  const inviteUrl = `${location.origin}/r/${room}`;
  const hud: NetHudInfo = {
    get status() {
      return net.status;
    },
    transport: transport?.kind ?? null,
    get notice() {
      if (net.status === 'reconnecting') return 'Connection lost: reconnecting…';
      if (net.status === 'unavailable') return `Online unavailable${net.detail ? ` (${net.detail})` : ''}: playing locally`;
      if (net.role === 'guest' && !net.synced) return 'Joining…';
      return notice;
    },
    get isHost() {
      return net.isHost;
    },
    selfId: net.self,
    get paused() {
      return net.paused;
    },
    inviteUrl,
    peers: () => net.peers(),
    isLocal: (d) => net.isLocal(d),
    peerOf: (d) => (d.includes(':') ? d.slice(0, d.indexOf(':')) : net.self),
  };
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      return true;
    } catch {
      prompt('Invite link', inviteUrl);
      return false;
    }
  };
  return { net, hud, copyInvite };
}
