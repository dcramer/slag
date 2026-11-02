/**
 * End-to-end online test in headless Chromium: several pages on the same
 * /r/<CODE>, through a real transport.
 *
 *   npm run online-test                # both transports
 *   npm run online-test -- --net bc    # BroadcastChannel only (tabs of one browser)
 *   npm run online-test -- --net relay # WebSocket relay (tools/relay-dev.ts = relay/room.ts logic)
 *   npm run online-test -- --net relay --relay-url ws://127.0.0.1:8799   # e.g. `wrangler dev` in relay/
 *
 * Scenario: three peers join, ready up and start; mid-race the host's page
 * closes → the next peer becomes host and the race continues; state hashes
 * match; a guest refreshes and gets its slot back; the match reaches the next
 * round. Screenshots go to shots/online-*.png. Exits non-zero on failure.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { launchChromium, startNext } from './next-server';
import { startRelay } from './relay-dev';

const argv = process.argv.slice(2);
const only = argv.includes('--net') ? argv[argv.indexOf('--net') + 1] : null;
const externalRelay = argv.includes('--relay-url') ? argv[argv.indexOf('--relay-url') + 1] : null;
const out = resolve('shots');
mkdirSync(out, { recursive: true });

type NetView = {
  self: string;
  isHost: boolean;
  hostId: string;
  synced: boolean;
  status: string;
  frame: number;
  phase: string;
  round: number;
  hash: number;
  players: { device: string; slot: number; name: string; score: number; away: boolean }[];
  stats: Record<string, number>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(ok: boolean, what: string) {
  console.log(`${ok ? '  ok ' : '  FAIL'} ${what}`);
  if (!ok) failures++;
}

async function view(p: Page): Promise<NetView> {
  return p.evaluate(() => {
    const d = (window as any).slagDebug;
    const n = d.net;
    const m = d.match;
    return {
      self: n.self,
      isHost: n.isHost,
      hostId: n.hostId,
      synced: n.synced,
      status: n.status,
      frame: m.frame,
      phase: m.phase,
      round: m.round,
      hash: d.hash(),
      players: m.players.map((q: any) => ({ device: q.device, slot: q.slot, name: q.character.name, score: q.score, away: !!q.away })),
      stats: { ...n.stats },
    };
  });
}

async function waitFor(p: Page, what: string, fn: (v: NetView) => boolean, ms = 30_000): Promise<NetView> {
  const t0 = Date.now();
  let v = await view(p);
  while (!fn(v)) {
    if (Date.now() - t0 > ms) {
      check(false, `timed out waiting for ${what} (frame ${v.frame}, phase ${v.phase}, host ${v.hostId}, synced ${v.synced})`);
      return v;
    }
    await sleep(150);
    v = await view(p);
  }
  return v;
}

async function scenario(browser: Browser, base: string, mode: 'bc' | 'relay', relayUrl: string, kill: (peer: string) => void) {
  const room = `T${mode === 'bc' ? 'B' : 'R'}${Math.floor(Math.random() * 1e6)
    .toString(36)
    .toUpperCase()}`.slice(0, 8);
  console.log(`\n== ${mode}: room ${room}`);
  const q = mode === 'bc' ? 'net=bc' : `relay=${encodeURIComponent(relayUrl)}`;
  // bc: one browser (tabs share BroadcastChannel and storage). relay: one context per peer, like separate machines.
  const shared = mode === 'bc' ? await browser.newContext({ viewport: { width: 480, height: 270 } }) : null;
  const contexts: BrowserContext[] = [];
  const errors: string[] = [];
  async function open(label: string, ctx?: BrowserContext): Promise<Page> {
    let c = ctx ?? shared;
    if (!c) {
      c = await browser.newContext({ viewport: { width: 480, height: 270 } });
      contexts.push(c);
    }
    await c.addInitScript(() => localStorage.setItem('slag.profile.v1', JSON.stringify({ version: 1, name: null, prompted: true })));
    const p = await c.newPage();
    p.on('pageerror', (e) => errors.push(`${label}: ${String(e)}`));
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${label}: ${m.text()}`);
      else if (m.text().startsWith('[net]')) console.log(`     ${label} ${m.text()}`);
    });
    await p.goto(`${base}r/${room}?${q}`);
    await p.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
    return p;
  }
  // Software GL with several pages is slow; a missed screenshot is not a netcode failure.
  const shot = async (p: Page, name: string) => {
    try {
      await p.screenshot({ path: `${out}/online-${mode}-${name}.png`, timeout: 60_000 });
      console.log(`     ${out}/online-${mode}-${name}.png`);
    } catch (e) {
      console.log(`     (screenshot ${name} skipped: ${String(e).split('\n')[0]})`);
    }
  };

  const A = await open('A');
  const a0 = await waitFor(A, 'A online as host', (v) => v.status === 'online' && v.isHost);
  check(a0.isHost, 'first peer in an empty room is host');
  const B = await open('B');
  const C = await open('C');
  const b0 = await waitFor(B, 'B synced', (v) => v.synced && v.hostId === a0.self);
  const c0 = await waitFor(C, 'C synced', (v) => v.synced && v.hostId === a0.self);
  check(!b0.isHost && !c0.isHost && b0.self !== c0.self && b0.self !== a0.self, 'later peers are guests with distinct ids');

  await A.evaluate(() => (window as any).slagDebug.net.act({ t: 'rules', rules: { targetScore: 120, pickSeconds: 10, placeSeconds: 15, raceSeconds: 30 } }));
  for (const p of [A, B, C]) await p.keyboard.press('Enter'); // join
  await waitFor(C, 'three players seated', (v) => v.players.length === 3);
  await shot(B, 'lobby');
  for (const p of [A, B, C]) await p.keyboard.press('Enter'); // ready
  await waitFor(B, 'match start', (v) => v.phase === 'pick', 20_000);
  const ar = await waitFor(A, 'race', (v) => v.phase === 'run', 150_000);
  check(ar.phase === 'run', 'everyone ready → pick → place → race');
  for (const p of [B, C]) await p.keyboard.down('ArrowRight');
  await sleep(1500);
  await shot(C, 'race');

  // --- host leaves mid-race
  const before = await view(B);
  if (mode === 'relay') kill(a0.self); // abrupt network loss, no goodbye
  await A.close();
  const b1 = await waitFor(B, 'B takes over as host', (v) => v.isHost, 15_000);
  check(b1.isHost, 'next-earliest peer becomes host after the host leaves');
  const b2 = await waitFor(B, 'race continues', (v) => v.frame > before.frame + 120, 20_000);
  check(b2.frame > before.frame + 120, `sim keeps running on the new host (frame ${before.frame} → ${b2.frame})`);
  const c1 = await waitFor(C, 'C follows B', (v) => v.hostId === b1.self && v.frame > before.frame + 60, 15_000);
  check(c1.hostId === b1.self, 'remaining guest follows the new host');
  check(b2.players.find((p) => p.device.startsWith(`${a0.self}:`))?.away === true, "old host's player is marked away");
  // Freeze the host, let the guest catch up, compare state hashes at the same frame.
  await B.evaluate(() => {
    const d = (window as any).slagDebug;
    d.pause(true);
    d.net.flush();
  });
  await sleep(1500);
  const [bh, ch] = [await view(B), await view(C)];
  check(bh.frame === ch.frame && bh.hash === ch.hash, `identical state after migration (frame ${bh.frame}/${ch.frame}, hash ${bh.hash}/${ch.hash})`);
  await B.evaluate(() => (window as any).slagDebug.pause(false));
  await shot(B, 'migrated');

  // --- a guest refreshes and gets its slot back
  const cBefore = (await view(C)).players.find((p) => p.device === `${c0.self}:kb1`);
  await C.reload();
  await C.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  const c2 = await waitFor(C, 'C rejoined', (v) => v.synced && v.hostId === b1.self, 20_000);
  check(c2.self === c0.self, `refresh keeps the peer id (${c0.self})`);
  const cAfter = c2.players.find((p) => p.device === `${c0.self}:kb1`);
  check(!!cBefore && !!cAfter && cBefore.slot === cAfter.slot && cBefore.name === cAfter.name, `refresh restores the same slot/character (P${(cAfter?.slot ?? -1) + 1} ${cAfter?.name})`);
  await waitFor(B, "C's player back from away", (v) => v.players.find((p) => p.device === `${c0.self}:kb1`)?.away === false, 10_000);
  await C.keyboard.down('ArrowRight');
  const b3 = await waitFor(B, 'next round', (v) => v.round >= 2 && v.phase === 'pick', 150_000);
  check(b3.round >= 2, 'match carries on into the next round');
  const c3 = await waitFor(C, 'C in next round', (v) => v.round >= 2, 20_000);
  check(c3.round >= 2, 'refreshed guest plays on');
  await shot(C, 'next-round');
  const desyncs = (await view(B)).stats.desyncs;
  check(desyncs === 0, `no desyncs detected (${desyncs})`);
  const real = errors.filter((e) => !/WebSocket|ERR_CONNECTION|favicon/.test(e));
  check(real.length === 0, `no page errors${real.length ? `:\n${real.join('\n')}` : ''}`);
  await shared?.close();
  for (const c of contexts) await c.close();
}

const { base, close } = await startNext();
const relay = await startRelay(0);
const browser = await launchChromium();
try {
  if (!only || only === 'bc') await scenario(browser, base, 'bc', relay.url, () => {});
  // An external relay (e.g. the real worker under `wrangler dev`) can't be told to drop a socket: the host page just closes.
  if (!only || only === 'relay') await scenario(browser, base, 'relay', externalRelay ?? relay.url, (p) => !externalRelay && relay.kill(p));
} finally {
  await browser.close();
  await relay.close();
  await close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall online checks passed');
process.exitCode = failures ? 1 : 0;
