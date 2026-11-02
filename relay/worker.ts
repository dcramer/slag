/**
 * slag room relay — Cloudflare Worker + Durable Object (Workers Free plan).
 *
 * One Durable Object per room code: a single-threaded, globally unique
 * instance, which is exactly what host election needs (one authoritative
 * member list and join order, and one total order of messages per receiver).
 * Uses the WebSocket Hibernation API so idle rooms cost nothing.
 *
 * Deploy: see docs/NETCODE.md → "Setup". Endpoint: wss://<worker>/r/<ROOM>?peer=<id>
 * All room logic lives in room.ts (shared with tools/relay-dev.ts and tested).
 */
import { DurableObject } from 'cloudflare:workers';
import { ROOM_RE } from '../src/net/relay-protocol';
import type { Member } from '../src/net/transport';
import { RelayRoom } from './room';

interface Env {
  ROOMS: DurableObjectNamespace;
  /** Optional comma-separated list of allowed page origins (e.g. https://slag.vercel.app). Empty = allow any. */
  ALLOWED_ORIGINS?: string;
}

export class SlagRoom extends DurableObject<Env> {
  private room: RelayRoom<CfWebSocket>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.room = new RelayRoom<CfWebSocket>({
      send: (ws, text) => {
        try {
          ws.send(text);
        } catch {
          // socket already closing
        }
      },
      close: (ws, code, reason) => {
        try {
          ws.close(code, reason);
        } catch {
          // already closed
        }
      },
      attach: (ws, m) => ws.serializeAttachment(m),
    });
    // Woken from hibernation: rebuild presence from the sockets' attachments.
    this.room.restore(
      ctx
        .getWebSockets()
        .map((ws) => [ws, ws.deserializeAttachment() as Member | null] as [CfWebSocket, Member | null])
        .filter((e): e is [CfWebSocket, Member] => !!e[1]),
    );
    // Keepalives ("ping" → "pong") are answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request): Promise<Response> {
    const peer = new URL(req.url).searchParams.get('peer') ?? '';
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    this.room.open(server, peer);
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  async webSocketMessage(ws: CfWebSocket, msg: string | ArrayBuffer) {
    if (typeof msg === 'string') this.room.message(ws, msg);
  }

  async webSocketClose(ws: CfWebSocket, code: number) {
    this.room.close(ws);
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: CfWebSocket) {
    this.room.close(ws);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = /^\/r\/([A-Za-z0-9]{3,12})\/?$/.exec(url.pathname);
    if (!m) return new Response('slag relay: connect a WebSocket to /r/<ROOM>?peer=<id>\n', { status: url.pathname === '/' ? 200 : 404 });
    const room = m[1].toUpperCase();
    if (!ROOM_RE.test(room)) return new Response('bad room', { status: 400 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const allowed = (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = req.headers.get('Origin') ?? '';
    if (allowed.length && !allowed.includes(origin)) return new Response('origin not allowed', { status: 403 });
    return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(req);
  },
};
