import { CLOSE_BAD, CLOSE_FULL, CLOSE_REPLACED, type RelayServerMsg } from './relay-protocol';
import { type Member, sortMembers, type Transport, type TransportHandlers } from './transport';

const KEEPALIVE_MS = 20_000;
const BACKOFF_MS = [300, 1000, 2000, 4000, 8000];

/**
 * The real transport: one WebSocket to the room's Durable Object relay
 * (relay/worker.ts). WSS on port 443 works on every network that can load
 * the page — no NAT traversal, no TURN. The relay assigns join order, so
 * presence is authoritative. Reconnects with backoff; a reconnect is a new
 * join (later order), which the session treats like a refresh.
 */
export class RelayTransport implements Transport {
  readonly kind = 'relay';
  private ws: WebSocket | null = null;
  private h: TransportHandlers | null = null;
  private members = new Map<string, Member>();
  private attempt = 0;
  private closed = false;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly baseUrl: string,
    readonly room: string,
    readonly self: string,
  ) {}

  start(h: TransportHandlers) {
    this.h = h;
    this.connect();
  }

  private url() {
    const base = this.baseUrl.replace(/\/+$/, '').replace(/^http/, 'ws');
    return `${base}/r/${encodeURIComponent(this.room)}?peer=${encodeURIComponent(this.self)}`;
  }

  private connect() {
    if (this.closed) return;
    this.h?.status(this.attempt === 0 ? 'connecting' : 'reconnecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url());
    } catch (e) {
      this.h?.status('unavailable', String(e));
      return;
    }
    this.ws = ws;
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      let msg: RelayServerMsg;
      try {
        msg = JSON.parse(e.data) as RelayServerMsg;
      } catch {
        return;
      }
      this.onServer(msg);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.keepalive) clearInterval(this.keepalive);
      this.members.clear();
      if (this.closed) return;
      if (e.code === CLOSE_REPLACED || e.code === CLOSE_FULL || e.code === CLOSE_BAD) {
        this.h?.status(e.code === CLOSE_FULL ? 'unavailable' : 'closed', e.reason || String(e.code));
        return;
      }
      this.h?.status('reconnecting', e.reason || `closed ${e.code}`);
      const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
      this.attempt++;
      this.retry = setTimeout(() => this.connect(), delay);
    };
  }

  private onServer(msg: RelayServerMsg) {
    switch (msg.t) {
      case 'welcome':
        this.attempt = 0;
        this.members = new Map(msg.members.map((m) => [m.id, m]));
        if (this.keepalive) clearInterval(this.keepalive);
        this.keepalive = setInterval(() => this.ws?.readyState === WebSocket.OPEN && this.ws.send('ping'), KEEPALIVE_MS);
        this.h?.status('open');
        this.emit();
        break;
      case 'join':
        this.members.set(msg.m.id, msg.m);
        this.emit();
        break;
      case 'leave':
        this.members.delete(msg.id);
        this.emit();
        break;
      case 'msg':
        this.h?.message(msg.from, msg.d);
        break;
      case 'error':
        this.h?.status('unavailable', msg.reason);
        break;
    }
  }

  private emit() {
    this.h?.members(sortMembers([...this.members.values()]));
  }

  send(data: unknown, to?: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(to ? { d: data, to } : { d: data }));
  }

  close() {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    if (this.keepalive) clearInterval(this.keepalive);
    try {
      this.ws?.close(1000, 'bye');
    } catch {
      // ignore
    }
    this.ws = null;
    this.h?.status('closed');
    this.h = null;
  }
}
