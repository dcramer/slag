/**
 * Local room relay for development and browser tests: the same RelayRoom
 * logic the Cloudflare Durable Object runs (relay/room.ts), served over a
 * plain Node WebSocket server.
 *
 *   npm run relay                  # ws://127.0.0.1:8787
 *   open http://localhost:3000/r/ABCDE?relay=ws://127.0.0.1:8787   (in two browsers)
 *
 * `startRelay()` is also used by tools/online-test.ts.
 */
import { createServer, type Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { RelayRoom } from '../relay/room';
import { ROOM_RE } from '../src/net/relay-protocol';

export interface DevRelay {
  url: string;
  server: Server;
  close(): Promise<void>;
  /** Drop a peer's socket without a close handshake (simulates a crash / network loss). */
  kill(peer: string): void;
}

export async function startRelay(port = 8787, host = '127.0.0.1'): Promise<DevRelay> {
  const rooms = new Map<string, RelayRoom<WebSocket>>();
  const peers = new Map<WebSocket, string>();
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('slag dev relay\n');
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const m = /^\/r\/([A-Za-z0-9]{3,12})\/?$/.exec(url.pathname);
    const code = m?.[1].toUpperCase() ?? '';
    if (!ROOM_RE.test(code)) return ws.close(4003, 'bad room');
    let room = rooms.get(code);
    if (!room) {
      room = new RelayRoom<WebSocket>({
        send: (c, t) => c.readyState === WebSocket.OPEN && c.send(t),
        close: (c, code, reason) => c.close(code, reason),
      });
      rooms.set(code, room);
    }
    const r = room;
    const peer = url.searchParams.get('peer') ?? '';
    peers.set(ws, peer);
    ws.on('message', (data) => {
      const text = data.toString();
      if (text === 'ping') ws.send('pong');
      else r.message(ws, text);
    });
    ws.on('close', () => {
      peers.delete(ws);
      r.close(ws);
      if (r.size === 0) rooms.delete(code);
    });
    r.open(ws, peer);
  });
  await new Promise<void>((res) => server.listen(port, host, res));
  const addr = server.address();
  const p = typeof addr === 'object' && addr ? addr.port : port;
  return {
    url: `ws://${host}:${p}`,
    server,
    kill(peer) {
      for (const [ws, id] of peers) if (id === peer) ws.terminate();
    },
    close: () =>
      new Promise((res) => {
        for (const c of wss.clients) c.terminate();
        wss.close();
        server.close(() => res());
      }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8787);
  const r = await startRelay(port);
  console.log(`slag dev relay on ${r.url}  (open /r/<CODE>?relay=${r.url})`);
}
