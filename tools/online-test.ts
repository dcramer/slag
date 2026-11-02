/**
 * End-to-end online test: real WebRTC data channels between headless Chromium
 * pages (one browser context per peer, like separate machines), real signaling
 * routes, in-memory store. Peers, not mocks: if this passes, the game really
 * played across browsers on this machine. NAT traversal, TURN and Upstash are
 * not exercised (see docs/NETCODE.md → Testing).
 *
 *   pnpm online-test                     # everything (slow: ~15 min under load)
 *   pnpm online-test -- --only pick,bc   # named scenarios
 *   SHOT_DEV=1 pnpm online-test          # against `next dev`
 *
 * Scenarios:
 *   play        join, live cursors, claim race, a remote ghost, a race, refresh keeps the slot, next round
 *   pick place run   the host's renderer is killed (no goodbye) in that phase
 *   leave       the host navigates away (goodbye path) mid-race
 *   twice       the host dies, and the new host dies straight after taking over
 *   bc          BroadcastChannel transport (?net=bc)
 *   unset       production with no store credentials: the game degrades, with a clear status
 *
 * Every migration prints seconds to recovery. Screenshots go to shots/online-*.png.
 * Exits non-zero on failure.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { launchChromium, startNext } from './next-server';

const argv = process.argv.slice(2);
const onlyArg = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const wanted = (name: string) => !onlyArg || onlyArg.includes(name);
const out = resolve('shots');
mkdirSync(out, { recursive: true });

type NetView = {
  self: string;
  isHost: boolean;
  hostId: string;
  synced: boolean;
  paused: boolean;
  status: string;
  detail: string;
  members: string[];
  frame: number;
  phase: string;
  round: number;
  hash: number;
  players: { device: string; slot: number; name: string; score: number; away: boolean; claim: number; placed: boolean; cursor: { x: number; y: number } }[];
  crate: { claimedBy: number; x: number; y: number }[];
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
      paused: n.paused,
      status: n.status,
      detail: n.detail,
      members: n.members.map((x: any) => x.id),
      frame: m.frame,
      phase: m.phase,
      round: m.round,
      hash: d.hash(),
      players: m.players.map((q: any) => ({
        device: q.device,
        slot: q.slot,
        name: q.character.name,
        score: q.score,
        away: !!q.away,
        claim: q.claim,
        placed: q.placed,
        cursor: { ...q.cursor },
      })),
      crate: m.crate.map((c: any) => ({ claimedBy: c.claimedBy, x: c.rect.x + c.rect.w / 2, y: c.rect.y + c.rect.h / 2 })),
      stats: { ...n.stats },
    };
  });
}

async function waitFor(p: Page, what: string, fn: (v: NetView) => boolean, ms = 60_000): Promise<NetView> {
  const t0 = Date.now();
  let v = await view(p);
  while (!fn(v)) {
    if (Date.now() - t0 > ms) {
      check(false, `timed out waiting for ${what} (frame ${v.frame}, phase ${v.phase}, host ${v.hostId}, status ${v.status}, synced ${v.synced})`);
      return v;
    }
    await sleep(150);
    v = await view(p);
  }
  return v;
}

/** View coordinates → this page's mouse coordinates. */
async function mouseAt(p: Page, x: number, y: number): Promise<[number, number]> {
  return p.evaluate(
    ([vx, vy]) => {
      const r = document.querySelector('canvas')!.getBoundingClientRect();
      return [r.left + (vx / 768) * r.width, r.top + (vy / 432) * r.height] as [number, number];
    },
    [x, y],
  );
}

async function clickView(p: Page, x: number, y: number) {
  const [mx, my] = await mouseAt(p, x, y);
  await p.mouse.move(mx, my);
  await p.mouse.down();
  await p.mouse.up();
}

/** Any point where this peer's held part can legally go. Mutates and restores its cursor inside one synchronous call. */
async function validSpot(p: Page, device: string): Promise<{ x: number; y: number } | null> {
  return p.evaluate((dev) => {
    const m = (window as any).slagDebug.match;
    const me = m.players.find((q: any) => q.device === dev);
    if (!me) return null;
    const keep = { ...me.cursor };
    let found: { x: number; y: number } | null = null;
    for (let y = 90; y < 400 && !found; y += 16) {
      for (let x = 90; x < 700 && !found; x += 16) {
        me.cursor.x = x;
        me.cursor.y = y;
        if (m.canPlaceFor(me)) found = { x, y };
      }
    }
    me.cursor.x = keep.x;
    me.cursor.y = keep.y;
    return found;
  }, device);
}

interface Room {
  name: string;
  open(label: string): Promise<Page>;
  shot(p: Page, name: string): Promise<void>;
  errors: string[];
  dispose(): Promise<void>;
}

async function newRoom(browser: Browser, base: string, label: string, query: string, opts: { shared?: boolean } = {}): Promise<Room> {
  const name = `T${label.slice(0, 2).toUpperCase()}${Math.floor(Math.random() * 1e7)
    .toString(36)
    .toUpperCase()}`.slice(0, 10);
  console.log(`\n== ${label}: room ${name}`);
  const size = { viewport: { width: 480, height: 270 } };
  const sharedCtx = opts.shared ? await browser.newContext(size) : null;
  const contexts: BrowserContext[] = [];
  const errors: string[] = [];
  return {
    name,
    errors,
    async open(tag) {
      let c = sharedCtx;
      if (!c) {
        c = await browser.newContext(size);
        contexts.push(c);
      }
      await c.addInitScript(() => localStorage.setItem('slag.profile.v1', JSON.stringify({ version: 1, name: null, prompted: true })));
      const p = await c.newPage();
      p.on('pageerror', (e) => errors.push(`${tag}: ${String(e)}`));
      p.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`);
        else if (m.text().startsWith('[net]')) console.log(`     ${tag} ${m.text()}`);
      });
      await p.goto(`${base}r/${name}?${query}`);
      await p.waitForFunction(() => 'slagDebug' in window, null, { timeout: 60_000 });
      return p;
    },
    // Software GL with several pages is slow; a missed screenshot is reported but isn't a netcode failure.
    async shot(p, shot) {
      const path = `${out}/online-${label}-${shot}.png`;
      try {
        await p.screenshot({ path, timeout: 60_000 });
        console.log(`     ${path}`);
      } catch (e) {
        console.log(`     (screenshot ${shot} skipped: ${String(e).split('\n')[0]})`);
      }
    },
    async dispose() {
      await sharedCtx?.close().catch(() => {});
      for (const c of contexts) await c.close().catch(() => {});
    },
  };
}

const FAST_RULES = { targetScore: 120, pickSeconds: 30, placeSeconds: 45, raceSeconds: 30 };

/** n peers joined, seated and ready: the room is in `pick`. The first page is host. */
async function startMatch(r: Room, n: number): Promise<{ pages: Page[]; ids: string[] }> {
  const pages: Page[] = [];
  const ids: string[] = [];
  const tags = 'ABCDEFGH';
  pages.push(await r.open(tags[0]));
  const v0 = await waitFor(pages[0], 'first peer hosting', (v) => v.status === 'online' && v.isHost);
  ids.push(v0.self);
  for (let i = 1; i < n; i++) {
    pages.push(await r.open(tags[i]));
    const v = await waitFor(pages[i], `peer ${tags[i]} linked`, (x) => x.synced && x.status === 'online' && x.hostId === v0.self);
    ids.push(v.self);
  }
  check(new Set(ids).size === n, `${n} peers joined with distinct ids`);
  await pages[0].evaluate((rules) => (window as any).slagDebug.net.act({ t: 'rules', rules }), FAST_RULES);
  for (const p of pages) await p.keyboard.press('Enter');
  await waitFor(pages[0], 'everyone seated', (v) => v.players.length === n);
  for (const p of pages) await p.keyboard.press('Enter');
  await waitFor(pages[0], 'match start', (v) => v.phase === 'pick');
  return { pages, ids };
}

/** From pick: everyone claims a different card. */
async function toPlace(pages: Page[]) {
  for (let i = 0; i < pages.length; i++) {
    const v = await waitFor(pages[i], 'crate ready', (x) => x.phase === 'pick' && x.crate.length > i);
    await sleep(300); // past the opening frames where clicks are ignored
    await clickView(pages[i], v.crate[i].x, v.crate[i].y);
  }
  await waitFor(pages[0], 'place phase', (v) => v.phase === 'place');
}

/** From place: everyone puts their part down. */
async function toRun(pages: Page[], ids: string[]) {
  for (let i = 0; i < pages.length; i++) {
    const s = await validSpot(pages[i], `${ids[i]}:kb1`);
    if (s) await clickView(pages[i], s.x, s.y);
  }
  await waitFor(pages[0], 'race', (v) => v.phase === 'run', 120_000);
}

/** No pagehide, no goodbye, no beacon: the renderer process just stops. */
async function crash(p: Page) {
  const cdp = await p.context().newCDPSession(p);
  void cdp.send('Page.crash').catch(() => {}); // never answers: the renderer it would answer from is gone
  await sleep(50);
}

/** Freeze the host, let guests drain, compare state at one frame. */
async function compareHashes(pages: Page[], label: string) {
  const host = pages[0];
  await host.evaluate(() => {
    const d = (window as any).slagDebug;
    d.pause(true);
    d.net.flush();
  });
  await sleep(2500);
  const vs = await Promise.all(pages.map(view));
  const sameFrame = new Set(vs.map((v) => v.frame)).size === 1;
  const sameHash = new Set(vs.map((v) => v.hash)).size === 1;
  check(
    sameFrame && sameHash,
    `${label}: identical state on ${pages.length} peers (frames ${vs.map((v) => v.frame).join('/')}, hashes ${vs.map((v) => v.hash).join('/')})`,
  );
  await host.evaluate(() => (window as any).slagDebug.pause(false));
}

/** Time from `t0` until every survivor agrees on a host and the sim is advancing again. */
async function recovery(pages: Page[], t0: number, frameBefore: number, ms = 45_000): Promise<number> {
  for (;;) {
    const vs = await Promise.all(pages.map(view));
    const hosts = new Set(vs.map((v) => v.hostId));
    const ok =
      hosts.size === 1 && vs.every((v) => v.status === 'online' && v.synced && !v.paused && v.frame > frameBefore) && vs.filter((v) => v.isHost).length === 1;
    if (ok) return (Date.now() - t0) / 1000;
    if (Date.now() - t0 > ms) {
      check(false, `no recovery in ${ms / 1000}s: ${JSON.stringify(vs.map((v) => [v.self, v.isHost, v.hostId, v.status, v.synced, v.paused, v.frame]))}`);
      return -1;
    }
    await sleep(100);
  }
}

const recoveries: string[] = [];

async function killScenario(browser: Browser, base: string, phase: 'pick' | 'place' | 'run') {
  const r = await newRoom(browser, base, phase, '');
  const { pages, ids } = await startMatch(r, 3);
  if (phase !== 'pick') await toPlace(pages);
  if (phase === 'run') {
    await toRun(pages, ids);
    for (const p of pages.slice(1)) await p.keyboard.down('ArrowRight');
    await sleep(1000);
  }
  const before = await view(pages[1]);
  const t0 = Date.now();
  await crash(pages[0]);
  const survivors = pages.slice(1);
  const secs = await recovery(survivors, t0, before.frame);
  recoveries.push(`${phase} (crash): ${secs.toFixed(1)}s`);
  console.log(`     recovered in ${secs.toFixed(1)}s`);
  const after = await view(pages[1]);
  check(after.isHost, `next in join order takes over (${phase})`);
  check(after.phase === before.phase, `phase survives (${before.phase} → ${after.phase})`);
  const a = await waitFor(pages[1], "old host's player marked away", (v) => v.players.find((q) => q.device.startsWith(`${ids[0]}:`))?.away === true, 15_000);
  check(a.players.find((q) => q.device.startsWith(`${ids[0]}:`))?.away === true, 'crashed host handled as a dropped player');
  await compareHashes(survivors, phase);
  await r.shot(pages[2], 'after');
  const real = r.errors.filter((e) => !/favicon|ERR_/.test(e));
  check(real.length === 0, `no page errors${real.length ? `:\n${real.join('\n')}` : ''}`);
  await r.dispose();
}

async function leaveScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'leave', '');
  const { pages, ids } = await startMatch(r, 3);
  await toPlace(pages);
  await toRun(pages, ids);
  const before = await view(pages[1]);
  const t0 = Date.now();
  await pages[0].goto('about:blank'); // a real pagehide: goodbye frame and leave beacon
  const survivors = pages.slice(1);
  const secs = await recovery(survivors, t0, before.frame);
  recoveries.push(`run (graceful leave): ${secs.toFixed(1)}s`);
  console.log(`     recovered in ${secs.toFixed(1)}s`);
  check((await view(pages[1])).isHost, 'next in join order takes over');
  await compareHashes(survivors, 'graceful leave');
  await r.dispose();
}

async function twiceScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'twice', '');
  const { pages, ids } = await startMatch(r, 4);
  await toPlace(pages);
  await toRun(pages, ids);
  const before = await view(pages[2]);
  const t0 = Date.now();
  await crash(pages[0]);
  await waitFor(pages[1], 'B takes over', (v) => v.isHost, 30_000);
  const t1 = Date.now();
  await crash(pages[1]); // straight after taking over, likely before anyone linked
  const survivors = pages.slice(2);
  const secs = await recovery(survivors, t0, before.frame);
  recoveries.push(`run (new host dies at once): ${secs.toFixed(1)}s total, ${((Date.now() - t1) / 1000).toFixed(1)}s after the second crash`);
  console.log(`     recovered in ${secs.toFixed(1)}s`);
  check((await view(pages[2])).isHost, 'the third peer in join order ends up host');
  await compareHashes(survivors, 'double migration');
  await r.dispose();
}

async function playScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'play', '');
  const { pages, ids } = await startMatch(r, 3);
  const [A, B, C] = pages;
  await r.shot(B, 'lobby-pick');

  // --- live cursors: a guest's mouse moves on the host and on the other guest, with no clicks.
  const start = await waitFor(C, 'crate', (v) => v.crate.length >= 3);
  await sleep(400);
  const devB = `${ids[1]}:kb1`;
  const [bx, by] = await mouseAt(B, 300, 300);
  await B.mouse.move(bx, by);
  const moved = (v: NetView) => {
    const q = v.players.find((p) => p.device === devB);
    return !!q && Math.abs(q.cursor.x - 300) < 3 && Math.abs(q.cursor.y - 300) < 3;
  };
  await waitFor(A, "B's cursor on the host", moved, 5000);
  const seen = await waitFor(C, "B's cursor on the other guest", moved, 5000);
  check(moved(seen), 'a remote cursor moves live, with no click');

  // --- claim race: two guests click one card at once. Exactly one wins, everywhere, and the loser never saw it as theirs.
  const card = start.crate[0];
  await Promise.all([clickView(B, card.x, card.y), clickView(C, card.x, card.y)]);
  const claimed = await waitFor(A, 'the card to be claimed', (v) => v.crate[0].claimedBy >= 0, 5000);
  await sleep(600);
  const views = await Promise.all(pages.map(view));
  const winners = new Set(views.map((v) => v.crate[0].claimedBy));
  const owners = views.map((v) => v.players.filter((p) => p.claim === 0).length);
  check(winners.size === 1 && owners.every((n) => n === 1), `claim race: one winner on every peer (slot ${claimed.crate[0].claimedBy}), one owner each`);

  // Whoever lost takes another card; the host takes a third. Pick → place.
  for (let i = 0; i < 3; i++) {
    const v = await view(pages[i]);
    const me = v.players.find((p) => p.device === `${ids[i]}:kb1`)!;
    if (me.claim >= 0) continue;
    const free = v.crate.findIndex((c) => c.claimedBy < 0);
    await clickView(pages[i], v.crate[free].x, v.crate[free].y);
    await sleep(300);
  }
  await waitFor(A, 'place phase', (v) => v.phase === 'place');

  // --- a remote ghost: B hovers its part in the level; C's screenshot must show it.
  const spot = await validSpot(B, devB);
  if (spot) {
    const [gx, gy] = await mouseAt(B, spot.x, spot.y);
    await B.mouse.move(gx, gy);
    await waitFor(C, "B's ghost on C", (v) => {
      const q = v.players.find((p) => p.device === devB);
      return !!q && Math.abs(q.cursor.x - spot.x) < 3 && Math.abs(q.cursor.y - spot.y) < 3;
    });
    await sleep(300);
    await r.shot(C, 'remote-ghost');
    const seesGhost = await C.evaluate((dev) => {
      const v = (window as any).slagDebug.net.view;
      const q = v.players.find((p: any) => p.device === dev);
      return !!v.ghostOrigin(q) && !q.placed;
    }, devB);
    check(seesGhost, "another player's held part is in this peer's view");
  } else check(false, 'found no legal spot for the ghost shot');

  await toRun(pages, ids);
  for (const p of [B, C]) await p.keyboard.down('ArrowRight');
  await sleep(1500);
  await r.shot(C, 'race');
  await compareHashes(pages, 'mid-race');

  // --- a guest refreshes and gets its slot back
  const cBefore = (await view(C)).players.find((p) => p.device === `${ids[2]}:kb1`);
  await C.reload();
  await C.waitForFunction(() => 'slagDebug' in window, null, { timeout: 60_000 });
  const c2 = await waitFor(C, 'C rejoined', (v) => v.synced && v.status === 'online' && v.hostId === ids[0]);
  check(c2.self === ids[2], `refresh keeps the peer id (${ids[2]})`);
  const cAfter = c2.players.find((p) => p.device === `${ids[2]}:kb1`);
  check(
    !!cBefore && !!cAfter && cBefore.slot === cAfter.slot && cBefore.name === cAfter.name,
    `refresh restores the same slot and character (${cAfter?.name})`,
  );
  await waitFor(A, "C's player back from away", (v) => v.players.find((p) => p.device === `${ids[2]}:kb1`)?.away === false, 15_000);
  const a3 = await waitFor(A, 'next round', (v) => v.round >= 2 && v.phase === 'pick', 180_000);
  check(a3.round >= 2, 'match carries on into the next round');
  const desyncs = (await view(A)).stats.desyncs;
  check(desyncs === 0, `no desyncs detected (${desyncs})`);
  const real = r.errors.filter((e) => !/favicon/.test(e));
  check(real.length === 0, `no page errors${real.length ? `:\n${real.join('\n')}` : ''}`);
  await r.dispose();
}

async function bcScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'bc', 'net=bc', { shared: true });
  const { pages } = await startMatch(r, 2);
  check((await view(pages[1])).hostId === (await view(pages[0])).self, 'tabs of one browser find each other over BroadcastChannel');
  await compareHashes(pages, 'BroadcastChannel');
  await r.dispose();
}

async function unsetScenario(browser: Browser) {
  const server = await startNext({
    SLAG_SIGNAL_STORE: '',
    KV_REST_API_URL: '',
    KV_REST_API_TOKEN: '',
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
  });
  try {
    const r = await newRoom(browser, server.base, 'unset', '');
    const p = await r.open('A');
    const v = await waitFor(p, 'online to give up cleanly', (x) => x.status === 'unavailable', 20_000);
    check(v.detail === 'Online Not Set Up', `missing store credentials: "${v.detail}"`);
    await p.keyboard.press('Enter');
    const seated = await waitFor(p, 'local play still works', (x) => x.players.length === 1, 10_000);
    check(seated.players.length === 1 && seated.frame > 0, 'the game runs locally');
    await sleep(500);
    await r.shot(p, 'lobby');
    const real = r.errors.filter((e) => !/503|favicon/.test(e));
    check(real.length === 0, `no page errors${real.length ? `:\n${real.join('\n')}` : ''}`);
    await r.dispose();
  } finally {
    await server.close();
  }
}

const browser = await launchChromium();
const server = await startNext({ SLAG_SIGNAL_STORE: 'memory' });
try {
  if (wanted('play')) await playScenario(browser, server.base);
  if (wanted('pick')) await killScenario(browser, server.base, 'pick');
  if (wanted('place')) await killScenario(browser, server.base, 'place');
  if (wanted('run')) await killScenario(browser, server.base, 'run');
  if (wanted('leave')) await leaveScenario(browser, server.base);
  if (wanted('twice')) await twiceScenario(browser, server.base);
  if (wanted('bc')) await bcScenario(browser, server.base);
} finally {
  await server.close();
}
try {
  if (wanted('unset')) await unsetScenario(browser);
} finally {
  await browser.close();
}
if (recoveries.length) console.log(`\nseconds to recovery:\n  ${recoveries.join('\n  ')}`);
console.log(failures ? `\n${failures} check(s) failed` : '\nall online checks passed');
process.exit(failures ? 1 : 0);
