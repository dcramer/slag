import { CLOSE_BAD, CLOSE_FULL, CLOSE_REPLACED, MAX_CONNS, MAX_MSG_BYTES, PEER_RE, type RelayClientMsg, type RelayServerMsg } from '../src/net/relay-protocol';
import type { Member } from '../src/net/transport';

/**
 * Platform-independent room relay: presence with authoritative join order,
 * and message fan-out. The Cloudflare Durable Object (worker.ts) and the
 * local Node dev server (tools/relay-dev.ts) both drive this class, so the
 * logic tested in tests/relay.test.ts is the logic that ships.
 *
 * Connections are opaque handles `C` provided by the host platform.
 */
export interface RelayIO<C> {
  send(conn: C, text: string): void;
  close(conn: C, code: number, reason: string): void;
  /** Persist per-connection data so it survives Durable Object hibernation (optional). */
  attach?(conn: C, m: Member): void;
}

export class RelayRoom<C> {
  private conns = new Map<C, Member>();
  private nextOrder = 0;

  constructor(private io: RelayIO<C>) {}

  /** Rebuild state after a hibernation wake-up from connections' saved attachments. */
  restore(entries: [C, Member][]) {
    for (const [c, m] of entries) {
      this.conns.set(c, m);
      this.nextOrder = Math.max(this.nextOrder, m.order + 1);
    }
  }

  get size() {
    return this.conns.size;
  }

  members(): Member[] {
    return [...this.conns.values()].sort((a, b) => a.order - b.order);
  }

  /** A socket connected as `peer`. Returns false if it was rejected (and closed). */
  open(conn: C, peer: string): boolean {
    if (!PEER_RE.test(peer)) {
      this.io.close(conn, CLOSE_BAD, 'bad peer id');
      return false;
    }
    // Same peer reconnecting (refresh, flaky network): the new socket wins.
    for (const [c, m] of this.conns) {
      if (m.id !== peer) continue;
      this.conns.delete(c);
      this.io.close(c, CLOSE_REPLACED, 'replaced');
      this.broadcast({ t: 'leave', id: peer });
    }
    if (this.conns.size >= MAX_CONNS) {
      this.io.close(conn, CLOSE_FULL, 'room full');
      return false;
    }
    // An empty room starts counting again: the next arrival is host.
    if (this.conns.size === 0) this.nextOrder = 0;
    const m: Member = { id: peer, order: this.nextOrder++ };
    this.conns.set(conn, m);
    this.io.attach?.(conn, m);
    this.send(conn, { t: 'welcome', self: m, members: this.members() });
    this.broadcast({ t: 'join', m }, conn);
    return true;
  }

  message(conn: C, text: string) {
    const me = this.conns.get(conn);
    if (!me) return;
    if (text.length > MAX_MSG_BYTES) return;
    let msg: RelayClientMsg;
    try {
      msg = JSON.parse(text) as RelayClientMsg;
    } catch {
      return;
    }
    if ('ping' in msg) {
      this.send(conn, { t: 'pong', ts: msg.ping });
      return;
    }
    // Re-serialize only the envelope; the payload is forwarded as parsed JSON.
    const out = JSON.stringify({ t: 'msg', from: me.id, d: msg.d } satisfies RelayServerMsg);
    if (msg.to) {
      for (const [c, m] of this.conns) if (m.id === msg.to) this.io.send(c, out);
    } else {
      for (const c of this.conns.keys()) if (c !== conn) this.io.send(c, out);
    }
  }

  close(conn: C) {
    const m = this.conns.get(conn);
    if (!m) return;
    this.conns.delete(conn);
    this.broadcast({ t: 'leave', id: m.id });
  }

  private send(conn: C, msg: RelayServerMsg) {
    this.io.send(conn, JSON.stringify(msg));
  }

  private broadcast(msg: RelayServerMsg, except?: C) {
    const text = JSON.stringify(msg);
    for (const c of this.conns.keys()) if (c !== except) this.io.send(c, text);
  }
}
