/**
 * Smoke-test a running relay (local `wrangler dev`, `npm run relay`, or the
 * deployed worker): two peers join a room, exchange a message, one leaves.
 *
 *   tsx tools/relay-probe.ts ws://127.0.0.1:8799
 *   tsx tools/relay-probe.ts wss://slag-relay.<you>.workers.dev
 */
import { WebSocket } from 'ws';

const base = (process.argv[2] ?? 'ws://127.0.0.1:8787').replace(/\/+$/, '');
const room = `PROBE${Math.floor(Math.random() * 1000)}`;

function client(peer: string): Promise<{ ws: WebSocket; msgs: any[]; next: (t: string) => Promise<any> }> {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${base}/r/${room}?peer=${peer}`);
    const msgs: any[] = [];
    const waiters: [string, (m: any) => void][] = [];
    ws.on('message', (d) => {
      const text = d.toString();
      const m = text === 'pong' ? { t: 'keepalive-pong' } : JSON.parse(text);
      const i = waiters.findIndex(([t]) => t === m.t);
      if (i >= 0) waiters.splice(i, 1)[0][1](m);
      else msgs.push(m);
    });
    ws.on('error', rej);
    ws.on('open', () =>
      res({
        ws,
        msgs,
        next: (t) => {
          const i = msgs.findIndex((m) => m.t === t);
          if (i >= 0) return Promise.resolve(msgs.splice(i, 1)[0]);
          return new Promise((r, j) => {
            waiters.push([t, r]);
            setTimeout(() => j(new Error(`timeout waiting for ${t}`)), 5000);
          });
        },
      }),
    );
  });
}

const a = await client('probe-a');
const wa = await a.next('welcome');
const b = await client('probe-b');
const wb = await b.next('welcome');
const ja = await a.next('join');
a.ws.send(JSON.stringify({ d: { hello: 'b' } }));
const mb = await b.next('msg');
b.ws.send('ping');
const ka = await b.next('keepalive-pong');
a.ws.close();
const lb = await b.next('leave');
b.ws.close();
const ok = wa.self.order < wb.self.order && wb.members.length === 2 && ja.m.id === 'probe-b' && mb.from === 'probe-a' && mb.d.hello === 'b' && lb.id === 'probe-a' && !!ka;
console.log(JSON.stringify({ room, a: wa.self, b: wb.self, msg: mb, leave: lb }));
console.log(ok ? 'relay ok' : 'relay FAILED');
process.exit(ok ? 0 : 1);
