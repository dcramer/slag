/**
 * End-to-end online test: real WebRTC data channels between headless Chromium
 * pages (one browser context per peer, like separate machines), real signaling
 * routes, in-memory store. Peers, not mocks: if this passes, the game really
 * played across browsers on this machine. NAT traversal, TURN and Upstash are
 * not exercised (see docs/NETCODE.md → Testing).
 *
 *   pnpm online-test                     # everything (slow: ~15 min under load)
 *   pnpm online-test -- --only pick,bc   # named scenarios, or a group: lobby, migration, feel, misc
 *   pnpm test:store -- --browser pick,run,leave   # the same, through Upstash REST (SRH)
 *   SHOT_DEV=1 pnpm online-test          # against `next dev`
 *
 * Scenarios:
 *   flow        as a person does it: Play on the menu, open the invite, press nothing; both peers see both bays
 *   kick        the Host label everywhere and through a migration; kicks by keyboard and mouse, with no way back
 *   refused     a guest whose build can't load the host's snapshots says so
 *   view        real mouse input lands under the pointer, at every window shape, on every level size
 *   play        join, live cursors, claim race, a remote ghost, a race, refresh keeps the slot, next round
 *   pick place run   the host's renderer is killed (no goodbye) in that phase
 *   duo         the same in a race with no third peer: the guest has nobody to ask
 *   leave       the host navigates away (goodbye path) mid-race
 *   twice       the host dies, and the new host dies straight after taking over
 *   latency     input-to-screen delay between peers, stalls and jumps
 *   hidden      the same with the host's tab in the background
 *   contact     the same with two runners pushing and riding each other
 *   bc          BroadcastChannel transport (?net=bc)
 *   unset       production with no store credentials: the game degrades, with a clear status
 *
 * Every migration prints seconds to recovery. Screenshots go to shots/online-*.png.
 * Exits non-zero on failure.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright';
import { roomSeed } from '../src/game/room';
import { overview, type ViewXform, worldToView } from '../src/game/view';
import { generateLevel } from '../src/gen/level';
import { TILE } from '../src/sim/constants';
import { spawnZone, T_EMPTY, T_SOLID, tileAt } from '../src/sim/level';
import { launchBrowser, startServer } from './lib/server';

const argv = process.argv.slice(2);
/** Named groups, each short enough to run alone on a loaded machine. */
const GROUPS: Record<string, string[]> = {
  lobby: ['flow', 'kick', 'view', 'refused'],
  migration: ['pick', 'place', 'run', 'duo', 'leave', 'twice'],
  feel: ['latency', 'hidden', 'contact'],
  misc: ['play', 'bc', 'unset'],
};
const onlyArg = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',').flatMap((x) => GROUPS[x] ?? [x]) : null;
const wanted = (name: string) => !onlyArg || onlyArg.includes(name);
/** `--store srh`: the app talks to SRH through the same env vars as production (see compose.store.yml). */
const srh = argv.includes('--store') && argv[argv.indexOf('--store') + 1] === 'srh';
const storeEnv: Record<string, string> = srh
  ? { SLAG_SIGNAL_STORE: '', KV_REST_API_URL: process.env.SRH_URL ?? 'http://127.0.0.1:8079', KV_REST_API_TOKEN: process.env.SRH_TOKEN ?? 'slag_local_token' }
  : { SLAG_SIGNAL_STORE: 'memory' };
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
  phaseFrame: number;
  round: number;
  hash: number;
  players: {
    device: string;
    slot: number;
    name: string;
    seed: number;
    ready: boolean;
    score: number;
    away: boolean;
    claim: number;
    placed: boolean;
    cursor: { x: number; y: number };
  }[];
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
      phaseFrame: m.phaseFrame,
      round: m.round,
      hash: d.hash(),
      players: m.players.map((q: any) => ({
        device: q.device,
        slot: q.slot,
        name: q.character.name,
        seed: q.character.seed,
        ready: q.ready,
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
      // The canvases fill the window; the play view is the box the HUD maps to.
      const r = (document.querySelector('[data-slag-view]') ?? document.querySelector('canvas')!).getBoundingClientRect();
      return [r.left + (vx / 768) * r.width, r.top + (vy / 432) * r.height] as [number, number];
    },
    [x, y],
  );
}

/** Where a pick-phase point is drawn on this page: small windows zoom the crate, and the game inverts that for pointers. */
async function pickAim(p: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const c = (await p.evaluate(() => (window as any).slagDebug.renderer.hud.cards)) as { s: number; ox: number; oy: number };
  return { x: c.ox + x * c.s, y: c.oy + y * c.s };
}

async function clickPick(p: Page, x: number, y: number) {
  const v = await pickAim(p, x, y);
  await clickView(p, v.x, v.y);
}

async function clickView(p: Page, x: number, y: number) {
  const [mx, my] = await mouseAt(p, x, y);
  await p.mouse.move(mx, my);
  await p.mouse.down();
  await p.mouse.up();
}

/** The same mapping the game uses for pointers in `place`: cursors there are world px, the mouse is in view px. */
async function viewOf(p: Page): Promise<ViewXform> {
  const level = await p.evaluate(() => {
    const l = (window as any).slagDebug.match.level;
    return { w: l.w as number, h: l.h as number };
  });
  return overview(level as Parameters<typeof overview>[0]);
}

/** Put this page's mouse on a world position. */
async function hoverWorld(p: Page, x: number, y: number) {
  const v = worldToView(await viewOf(p), x, y);
  const [mx, my] = await mouseAt(p, v.x, v.y);
  await p.mouse.move(mx, my);
}

async function clickWorld(p: Page, x: number, y: number) {
  const v = worldToView(await viewOf(p), x, y);
  await clickView(p, v.x, v.y);
}

/** Clicks in a phase's first frames are ignored; a fixed sleep guesses at that and loses under load. */
const clicksLive = (p: Page) => waitFor(p, 'clicks to count', (v) => v.phaseFrame > 14);

/** Any world point where this peer's held part can legally go, clear of the HUD. Mutates and restores its cursor inside one synchronous call. */
async function validSpot(p: Page, device: string, far = false): Promise<{ x: number; y: number } | null> {
  const v = await viewOf(p);
  return p.evaluate(
    ([dev, fromRight, ov, tile]) => {
      const m = (window as any).slagDebug.match;
      const me = m.players.find((q: any) => q.device === dev);
      if (!me) return null;
      const keep = { ...me.cursor };
      const W = m.level.w * tile;
      const H = m.level.h * tile;
      let found: { x: number; y: number } | null = null;
      // Tile centres: the wire carries whole view px, so below zoom 1 an edge can round into the next tile.
      for (let y = tile / 2; y < H && !found; y += tile) {
        const vy = (y - ov.cy) * ov.zoom + 216;
        if (vy < 64 || vy > 384) continue;
        for (let i = tile / 2; i < W && !found; i += tile) {
          const x = fromRight ? W - i : i;
          const vx = (x - ov.cx) * ov.zoom + 384;
          if (vx < 24 || vx > 744) continue;
          me.cursor.x = x;
          me.cursor.y = y;
          if (m.canPlaceFor(me)) found = { x, y };
        }
      }
      me.cursor.x = keep.x;
      me.cursor.y = keep.y;
      return found;
    },
    [device, far, v, TILE] as const,
  );
}

/**
 * Headless pages never go hidden, so this does what Chrome does to a background tab:
 * `document.hidden`, no animation frames, page timers clamped to 1 Hz. Workers run on.
 */
const HIDDEN_SHIM = `(() => {
  let hidden = false;
  const raf = window.requestAnimationFrame.bind(window), st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  const waiting = [];
  Object.defineProperty(document, 'hidden', { get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { get: () => (hidden ? 'hidden' : 'visible') });
  window.requestAnimationFrame = (f) => (hidden ? (waiting.push(f), 0) : raf(f));
  window.setTimeout = (f, ms, ...a) => st(f, hidden ? Math.max(ms || 0, 1000) : ms, ...a);
  window.setInterval = (f, ms, ...a) => { let last = 0; return si(() => { const t = Date.now(); if (hidden && t - last < 1000) return; last = t; f(...a); }, ms); };
  window.__setHidden = (h) => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); if (!h) for (const f of waiting.splice(0)) raf(f); };
})()`;

/** One-way delay and jitter on data channels: localhost has none, and prediction errors only show with distance. */
const NET_SHIM = `(() => {
  const st = window.setTimeout.bind(window), send = RTCDataChannel.prototype.send;
  window.__netDelay = 0;
  RTCDataChannel.prototype.send = function (d) {
    const ms = window.__netDelay;
    if (!ms) return send.call(this, d);
    if (this.label === 'rt' && Math.random() < 0.01) return;
    st(() => { try { send.call(this, d); } catch {} }, ms + Math.random() * 6);
  };
})()`;

const pct = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] : Number.NaN);

/** Wraps the tick so the sender records when each direction change was sampled. */
async function probeSender(p: Page) {
  await p.evaluate(() => {
    const n = (window as any).slagDebug.net;
    const w = window as any;
    w.__sent = [];
    if (w.__senderProbed) return;
    w.__senderProbed = true;
    let prev = 0;
    const tick = n.tick.bind(n);
    n.tick = (local: Record<string, any>) => {
      const f = Object.values(local) as any[];
      const dir = f.some((x) => x.right) ? 1 : f.some((x) => x.left) ? -1 : 0;
      if (dir !== prev) w.__sent.push({ t: Date.now(), dir });
      prev = dir;
      tick(local);
    };
  });
}

/** Records what this page actually drew for a remote runner, every display frame, plus bundle arrivals. */
async function probeViewer(p: Page, device: string) {
  await p.evaluate((dev) => {
    const d = (window as any).slagDebug;
    const n = d.net;
    const w = window as any;
    w.__seen = [];
    w.__bundles = [];
    const slot = d.match.players.find((q: any) => q.device === dev).slot;
    w.__watch = slot;
    if (w.__viewerProbed) return;
    w.__viewerProbed = true;
    const on = n.onMessage;
    n.onMessage = function (from: string, m: any) {
      if (m?.t === 'b' || m?.t === 'in') w.__bundles.push(Date.now());
      return on.call(n, from, m);
    };
    const loop = () => {
      const r = n.view.run?.runners.find((x: any) => x.slot === w.__watch);
      if (r?.alive) w.__seen.push([Date.now(), r.body.x, r.body.vx]);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, device);
}

interface LatencyReport {
  label: string;
  delayP50: number;
  delayP95: number;
  samples: number;
  fps: number;
  bundleGapP50: number;
  bundleGapP95: number;
  bundleGapMax: number;
  stalls: number;
  jumps: number;
  maxSnap: number;
  movingFrames: number;
  dry: number;
  queueAvg: number;
  folded: number;
}

/** Pulses a key on `src` and reads how long `viewer` takes to show it, and how cleanly it moves. */
async function measure(label: string, src: Page, viewer: Page, device: string, host: Page, pulses: number): Promise<LatencyReport> {
  await probeSender(src);
  await probeViewer(viewer, device);
  const before = await host.evaluate(() => ({ ...(window as any).slagDebug.net.stats }));
  for (let i = 0; i < pulses; i++) {
    const key = i % 2 ? 'ArrowLeft' : 'ArrowRight';
    await src.keyboard.down(key);
    await sleep(260);
    await src.keyboard.up(key);
    await sleep(560);
  }
  const after = await host.evaluate(() => ({ ...(window as any).slagDebug.net.stats }));
  const sent = (await src.evaluate(() => (window as any).__sent)) as { t: number; dir: number }[];
  const { seen, bundles } = (await viewer.evaluate(() => ({ seen: (window as any).__seen, bundles: (window as any).__bundles }))) as {
    seen: [number, number, number][];
    bundles: number[];
  };
  const delays: number[] = [];
  for (const e of sent) {
    if (e.dir === 0) continue;
    // Velocity, not position: an eased runner is still settling from the last pulse, and that drift looks like instant reaction.
    const moved = seen.find((s) => s[0] >= e.t && s[2] * e.dir > 10);
    if (moved && moved[0] - e.t < 1000) delays.push(moved[0] - e.t);
  }
  const gaps = bundles.slice(1).map((t, i) => t - bundles[i]);
  // While the runner is at speed, every drawn frame should advance it about the same distance.
  let stalls = 0;
  let jumps = 0;
  let moving = 0;
  let maxSnap = 0;
  for (let i = 2; i < seen.length; i++) {
    const [t0, x0] = seen[i - 1];
    const [t1, x1, vx] = seen[i];
    const dt = (t1 - t0) / 1000;
    if (dt <= 0) continue;
    // A teleport shows at any speed, including the correction when a runner stops or turns.
    maxSnap = Math.max(maxSnap, Math.abs(x1 - x0) - Math.abs(vx) * dt);
    if (Math.abs(vx) < 40 || Math.abs(seen[i - 2][2]) < 40) continue;
    moving++;
    const expected = Math.abs(vx) * dt;
    const step = Math.abs(x1 - x0);
    if (step < 0.05) stalls++;
    else if (step > expected * 2 + 1.5) jumps++;
  }
  const span = seen.length > 1 ? (seen.at(-1)![0] - seen[0][0]) / 1000 : 1;
  const hostTicks = Math.max(1, after.hostTicks - before.hostTicks);
  const report: LatencyReport = {
    label,
    delayP50: pct(delays, 0.5),
    delayP95: pct(delays, 0.95),
    samples: delays.length,
    fps: seen.length / span,
    bundleGapP50: pct(gaps, 0.5),
    bundleGapP95: pct(gaps, 0.95),
    bundleGapMax: gaps.length ? Math.max(...gaps) : Number.NaN,
    stalls,
    jumps,
    maxSnap,
    movingFrames: moving,
    dry: (after.dryTicks - before.dryTicks) / hostTicks,
    queueAvg: (after.queuedFrames - before.queuedFrames) / hostTicks,
    folded: after.foldedFrames - before.foldedFrames,
  };
  console.log(
    `     ${label}: delay p50 ${report.delayP50.toFixed(0)} ms, p95 ${report.delayP95.toFixed(0)} ms (n=${report.samples}), viewer ${report.fps.toFixed(0)} fps; ` +
      `arrivals every p50 ${report.bundleGapP50} ms, p95 ${report.bundleGapP95} ms, max ${report.bundleGapMax} ms; ` +
      `stalls ${report.stalls}, jumps ${report.jumps} of ${report.movingFrames} moving frames, biggest snap ${report.maxSnap.toFixed(1)} px; ` +
      `host queue avg ${report.queueAvg.toFixed(2)} frames, dry ${(report.dry * 100).toFixed(0)}%, folded ${report.folded}`,
  );
  return report;
}

/** The race with both runners on the spawn pad, reached the way people reach it, with parts placed far away. */
async function pairInRace(r: Room): Promise<{ A: Page; B: Page; ids: string[] }> {
  const { pages, ids } = await startMatch(r, 2, { ...FAST_RULES, raceSeconds: 0 });
  await toPlace(pages);
  for (let i = 0; i < 2; i++) {
    const s = await validSpot(pages[i], `${ids[i]}:kb1`, true);
    await clicksLive(pages[i]);
    if (s) await clickWorld(pages[i], s.x, s.y);
  }
  for (const p of pages) await waitFor(p, 'race', (v) => v.phase === 'run', 120_000);
  await sleep(4500); // the countdown
  return { A: pages[0], B: pages[1], ids };
}

/**
 * Software GL holds these pages near 16 fps and pegs the CPU, which would measure this
 * machine rather than the netcode. With drawing stubbed, rAF runs at display rate like
 * a page on a real GPU. Scenarios that look at pixels pass `visual`.
 */
async function setDrawing(p: Page, on: boolean) {
  await p.evaluate((draw) => {
    const r = (window as any).slagDebug.renderer;
    r.__draw ??= r.render;
    r.render = draw ? r.__draw : () => {};
  }, on);
}

const ONE_WAY_MS = 40;
/** Display frame, tick and send on top of the network. Generous: this runs on loaded CI boxes, and catches regressions, not jitter. */
const BUDGET_MS = 90;

function budget(r: LatencyReport, networkMs: number) {
  // The floor catches a broken measurement: nothing beats the network.
  const ok = r.samples >= 4 && r.delayP50 >= networkMs && r.delayP50 <= networkMs + BUDGET_MS;
  check(ok, `${r.label}: p50 within ${networkMs} ms network + ${BUDGET_MS} ms (${r.delayP50.toFixed(0)} ms)`);
  check(r.maxSnap < 24, `${r.label}: no teleport (${r.maxSnap.toFixed(1)} px)`);
}

async function latencyScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'latency', '', { room: 'LATENCY1', viewport: { width: 640, height: 360 } });
  const { A, B, ids } = await pairInRace(r);
  budget(await measure('0 ms, guest → host', B, A, `${ids[1]}:kb1`, A, 12), 0);
  budget(await measure('0 ms, host → guest', A, B, `${ids[0]}:kb1`, A, 12), 0);
  for (const p of [A, B]) await p.evaluate((ms) => ((window as any).__netDelay = ms), ONE_WAY_MS);
  await sleep(500);
  budget(await measure(`${ONE_WAY_MS} ms each way, guest → host`, B, A, `${ids[1]}:kb1`, A, 12), ONE_WAY_MS);
  budget(await measure(`${ONE_WAY_MS} ms each way, host → guest`, A, B, `${ids[0]}:kb1`, A, 12), ONE_WAY_MS);
  await r.dispose();
}

/** A hidden host must not drag the room down: B plays, C watches, A's tab is in the background. */
async function hiddenScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'hidden', '', { room: 'LATENCY2', viewport: { width: 640, height: 360 } });
  const { pages, ids } = await startMatch(r, 3, { ...FAST_RULES, raceSeconds: 0 });
  await toPlace(pages);
  for (let i = 0; i < 3; i++) {
    const s = await validSpot(pages[i], `${ids[i]}:kb1`, true);
    await clicksLive(pages[i]);
    if (s) await clickWorld(pages[i], s.x, s.y);
  }
  for (const p of pages) await waitFor(p, 'race', (v) => v.phase === 'run', 120_000);
  await sleep(4500);
  const [A, B, C] = pages;
  for (const p of pages) await p.evaluate((ms) => ((window as any).__netDelay = ms), ONE_WAY_MS);
  await sleep(500);
  budget(await measure('visible host, guest → guest', B, C, `${ids[1]}:kb1`, A, 8), 2 * ONE_WAY_MS);
  await A.evaluate(() => (window as any).__setHidden(true));
  await sleep(500);
  const hidden = await measure('hidden host, guest → guest', B, C, `${ids[1]}:kb1`, A, 12);
  budget(hidden, 2 * ONE_WAY_MS);
  check(hidden.bundleGapP95 < 34, `a hidden host keeps bundles coming every frame or two (p95 ${hidden.bundleGapP95} ms)`);
  await A.evaluate(() => (window as any).__setHidden(false));
  await r.dispose();
}

type Body = { slot: number; x: number; y: number; ride: number; press: number; ground: boolean };

/** Every runner as the page's confirmed match has it: on the host, the truth. */
const bodies = (p: Page) =>
  p.evaluate(() =>
    ((window as any).slagDebug.match.run?.runners ?? []).map((r: any) => ({
      slot: r.slot,
      x: r.body.x,
      y: r.body.y,
      ride: r.ride,
      press: r.press,
      ground: r.body.onGround,
    })),
  ) as Promise<Body[]>;

/**
 * Records every runner this page draws, every display frame, with the velocity
 * it's drawn moving at (the rule `drawnVelocity` in session.ts uses) and how
 * deep it is drawn into the other runner.
 */
async function probeContact(p: Page) {
  await p.evaluate(() => {
    const w = window as any;
    w.__contact = [];
    w.__contactOn = true;
    if (w.__contactProbed) return;
    w.__contactProbed = true;
    const loop = () => {
      const rs = w.slagDebug.net.view.run?.runners as any[] | undefined;
      if (w.__contactOn && rs?.length === 2 && rs.every((r) => r.alive)) {
        const t = Date.now();
        const [a, b] = rs.map((r) => r.body);
        const sideBySide = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
        const depth = sideBySide ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) : 0;
        for (const r of rs) {
          let vx = 0;
          let vy = 0;
          let at = r;
          for (let n = 0; at && n < rs.length; n++) {
            if (at.press <= 0) vx += at.body.vx;
            vy += at.body.vy;
            const under = at.ride;
            at = under >= 0 ? rs.find((o) => o.slot === under) : undefined;
          }
          w.__contact.push([t, r.slot, r.body.x, r.body.y, vx, vy, depth, r.ride]);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

/** The biggest drawn teleport of any runner, the deepest one was drawn inside the other, and how far a rider was drawn sliding on its base. */
async function contactReport(p: Page, label: string): Promise<{ snap: number; depth: number; slide: number; frames: number }> {
  const rows = (await p.evaluate(() => {
    const w = window as any;
    w.__contactOn = false;
    return w.__contact;
  })) as [number, number, number, number, number, number, number, number][];
  let snap = 0;
  let depth = 0;
  let slide = 0;
  let seat: number | null = null;
  const last = new Map<number, (typeof rows)[number]>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const [t, slot, x, y, vx, vy, d, ride] = row;
    depth = Math.max(depth, d);
    // Nobody walks on top during this test, so where a rider sits on its base shouldn't change.
    const base = ride >= 0 ? rows.slice(Math.max(0, i - 1), i + 2).find((o) => o[0] === t && o[1] === ride) : undefined;
    if (base) {
      seat ??= x - base[2];
      slide = Math.max(slide, Math.abs(x - base[2] - seat));
    }
    const was = last.get(slot);
    last.set(slot, row);
    if (!was || t <= was[0]) continue;
    const dt = (t - was[0]) / 1000;
    snap = Math.max(snap, Math.hypot(x - was[2], y - was[3]) - Math.hypot(vx, vy) * dt);
  }
  const frames = rows.length / 2;
  const sliding = seat === null ? '' : `, a rider slid ${slide.toFixed(1)} px on its base`;
  console.log(`     ${label}: biggest snap ${snap.toFixed(1)} px, drawn ${depth.toFixed(1)} px inside the other runner${sliding}, over ${frames} frames`);
  return { snap, depth, slide, frames };
}

/** Pulses `key` on `p`: held, released, so a remote view mispredicts every edge. */
async function pulse(p: Page, keys: string[], n: number, held = 260, gap = 560) {
  for (let i = 0; i < n; i++) {
    const k = keys[i % keys.length];
    await p.keyboard.down(k);
    await sleep(held);
    await p.keyboard.up(k);
    await sleep(gap);
  }
}

/** Walks `p`'s runner until the host has it past `x` (rightward). */
async function walkTo(host: Page, p: Page, slot: number, x: number) {
  await p.keyboard.down('ArrowRight');
  const t0 = Date.now();
  while (Date.now() - t0 < 5000 && ((await bodies(host)).find((r) => r.slot === slot)?.x ?? x) < x) await sleep(8);
  await p.keyboard.up('ArrowRight');
  await sleep(400);
}

/**
 * Puts B standing on A's head: B steps away from A, jumps, and steers toward A's
 * x until it lands. Steering, not timing: gravity and air control vary by level.
 */
async function mount(A: Page, B: Page, a: number, b: number): Promise<boolean> {
  const both = async () => {
    const rs = await bodies(A);
    return [rs.find((r) => r.slot === a)!, rs.find((r) => r.slot === b)!] as const;
  };
  let held = '';
  const steer = async (key: string) => {
    if (key === held) return;
    if (held) await B.keyboard.up(held);
    if (key) await B.keyboard.down(key);
    held = key;
  };
  for (let attempt = 0; attempt < 8; attempt++) {
    const [ra, rb] = await both();
    if (rb.ride === a) return true;
    const out = rb.x >= ra.x ? 'ArrowRight' : 'ArrowLeft';
    await B.keyboard.down(out);
    await sleep(140 + 60 * (attempt % 3));
    await B.keyboard.up(out);
    await sleep(500);
    await B.keyboard.down('Space');
    const t0 = Date.now();
    while (Date.now() - t0 < 2500) {
      await sleep(8);
      const [ra2, rb2] = await both();
      if (rb2.ride === a || (rb2.ground && Date.now() - t0 > 200)) break;
      const dx = ra2.x - rb2.x;
      // Feet still below the head: keep clear of A sideways, or we'd only bump into it.
      const below = rb2.y + 14 > ra2.y;
      await steer(below ? '' : dx > 1 ? 'ArrowRight' : dx < -1 ? 'ArrowLeft' : '');
    }
    await steer('');
    await B.keyboard.up('Space');
    await sleep(600);
  }
  return (await both())[1].ride === a;
}

/**
 * Runners are solid to each other, and a guest draws them predicted and eased.
 * Pushing and riding are where a projection by `vx` alone goes wrong: a pusher
 * held up by a body doesn't move at its walk, and a rider moves with its base.
 */
async function contactScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'contact', '', { room: roomWithRunway(), viewport: { width: 640, height: 360 } });
  const { A, B, ids } = await pairInRace(r);
  const players = (await view(A)).players;
  const [a, b] = ids.map((id) => players.find((q) => q.device.startsWith(`${id}:`))?.slot ?? -1);
  check((await bodies(A)).length === 2 && a >= 0 && b >= 0, `two runners in the race (slots ${a}, ${b})`);
  // Out of the spawn zone, where runners pass through each other: A just past it, B a little further, then A walks into B and shoves it along.
  const zone = (await A.evaluate(() => (window as any).slagDebug.match.run.safeZone)) as { x: number; w: number };
  const edge = zone.x + zone.w;
  await walkTo(A, B, b, edge + 40);
  await walkTo(A, A, a, edge + 4);
  console.log(`     spawn zone ends at x ${edge}; runners at ${JSON.stringify(await bodies(A))}`);
  for (const p of [A, B]) await p.evaluate((ms) => ((window as any).__netDelay = ms), ONE_WAY_MS);
  await sleep(500);
  await probeContact(B);
  await probeContact(A);
  const before = (await bodies(A)).find((x) => x.slot === b)!.x;
  // Short shoves with long rests: held against a body long enough, a runner slips through it by design (sim/collide.ts).
  await pulse(A, ['ArrowRight'], 6, 300, 600);
  const push = await contactReport(B, `${ONE_WAY_MS} ms each way, the host shoves the guest, drawn on the guest`);
  const truth = await contactReport(A, 'the same on the host, unpredicted');
  const shoved = (await bodies(A)).find((x) => x.slot === b)!.x - before;
  check(shoved > 8 && truth.depth < 0.5, `the host shoved the guest ${shoved.toFixed(0)} px, and never into it (${truth.depth.toFixed(1)} px deep)`);
  check(push.frames > 60 && push.snap < 24, `shoving: no teleport on the guest (${push.snap.toFixed(1)} px)`);
  check(push.depth < 2, `shoving: the pusher isn't drawn inside who it pushes (${push.depth.toFixed(1)} px)`);
  // B on A's head; A walks back and forth and B rides.
  for (const p of [A, B]) await p.evaluate(() => ((window as any).__netDelay = 0));
  const mounted = await mount(A, B, a, b);
  check(mounted, 'the guest stands on the host');
  if (mounted) {
    for (const p of [A, B]) await p.evaluate((ms) => ((window as any).__netDelay = ms), ONE_WAY_MS);
    await sleep(500);
    await probeContact(B);
    await pulse(A, ['ArrowLeft', 'ArrowRight'], 8);
    const still = (await bodies(A)).find((x) => x.slot === b)?.ride === a;
    const ride = await contactReport(B, `${ONE_WAY_MS} ms each way, the guest rides the host, drawn on the guest`);
    check(ride.frames > 60 && ride.snap < 24, `riding: no teleport on the guest (${ride.snap.toFixed(1)} px)`);
    check(ride.slide < 2, `riding: the rider doesn't lag its base (${ride.slide.toFixed(1)} px)`);
    check(still, 'the guest is still riding after the walk');
  }
  const real = r.errors.filter((e) => !/favicon/.test(e));
  check(real.length === 0, `no page errors${real.length ? `:\n${real.join('\n')}` : ''}`);
  await r.dispose();
}

interface Room {
  name: string;
  open(label: string): Promise<Page>;
  shot(p: Page, name: string): Promise<void>;
  errors: string[];
  dispose(): Promise<void>;
}

async function newRoom(
  browser: Browser,
  base: string,
  label: string,
  query: string,
  opts: { shared?: boolean; room?: string; viewport?: { width: number; height: number }; visual?: boolean } = {},
): Promise<Room> {
  // Fixed where a scenario needs the same level every run: the room code seeds it.
  const name =
    opts.room ??
    `T${label.slice(0, 2).toUpperCase()}${Math.floor(Math.random() * 1e7)
      .toString(36)
      .toUpperCase()}`.slice(0, 10);
  console.log(`\n== ${label}: room ${name}`);
  const size = { viewport: opts.viewport ?? { width: 480, height: 270 } };
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
      await c.addInitScript('window.__name = (f) => f'); // tsx wraps named functions in code handed to evaluate
      await c.addInitScript(NET_SHIM); // first: the network isn't throttled with a hidden tab's timers
      await c.addInitScript(HIDDEN_SHIM);
      await c.addInitScript(() => localStorage.setItem('slag.profile.v1', JSON.stringify({ version: 1, name: null, prompted: true })));
      const p = await c.newPage();
      p.on('pageerror', (e) => errors.push(`${tag}: ${String(e)}`));
      p.on('console', (m) => {
        if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`);
        else if (m.text().startsWith('[net]')) console.log(`     ${tag} ${m.text()}`);
      });
      await p.goto(`${base}r/${name}?${query}`);
      await p.waitForFunction(() => 'slagDebug' in window, null, { timeout: 60_000 });
      if (!opts.visual) await setDrawing(p, false);
      return p;
    },
    // Software GL with several pages is slow; a missed screenshot is reported but isn't a netcode failure.
    async shot(p, shot) {
      const path = `${out}/online-${label}-${shot}.png`;
      try {
        await setDrawing(p, true);
        await sleep(500);
        await p.screenshot({ path, timeout: 60_000 });
        console.log(`     ${path}`);
      } catch (e) {
        console.log(`     (screenshot ${shot} skipped: ${String(e).split('\n')[0]})`);
      }
      if (!opts.visual) await setDrawing(p, false).catch(() => {});
    },
    async dispose() {
      await sharedCtx?.close().catch(() => {});
      for (const c of contexts) await c.close().catch(() => {});
    },
  };
}

const FAST_RULES = { targetScore: 80, maxRounds: 25, pickSeconds: 30, placeSeconds: 45, raceSeconds: 30 };

/** n peers joined, seated and ready: the room is in `pick`. The first page is host. */
async function startMatch(r: Room, n: number, rules: Record<string, number> = FAST_RULES): Promise<{ pages: Page[]; ids: string[] }> {
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
  await pages[0].evaluate((x) => (window as any).slagDebug.net.act({ t: 'rules', rules: x }), rules);
  await waitFor(pages[0], 'everyone seated', (v) => v.players.length === n);
  for (const p of pages) await p.keyboard.press('Enter');
  for (const p of pages) await waitFor(p, 'match start', (v) => v.phase === 'pick');
  return { pages, ids };
}

/** From pick: everyone claims a different card. */
async function toPlace(pages: Page[]) {
  for (let i = 0; i < pages.length; i++) {
    const v = await waitFor(pages[i], 'crate ready', (x) => x.phase === 'pick' && x.crate.length > i);
    await clicksLive(pages[i]);
    await clickPick(pages[i], v.crate[i].x, v.crate[i].y);
  }
  for (const p of pages) await waitFor(p, 'place phase', (v) => v.phase === 'place');
}

/** From place: everyone puts their part down. */
async function toRun(pages: Page[], ids: string[]) {
  for (let i = 0; i < pages.length; i++) {
    const s = await validSpot(pages[i], `${ids[i]}:kb1`);
    await clicksLive(pages[i]);
    if (s) await clickWorld(pages[i], s.x, s.y);
  }
  for (const p of pages) await waitFor(p, 'race', (v) => v.phase === 'run', 120_000);
}

/** No pagehide, no goodbye, no beacon: the renderer process just stops. */
async function crash(p: Page) {
  const cdp = await p.context().newCDPSession(p);
  void cdp.send('Page.crash').catch(() => {}); // never answers: the renderer it would answer from is gone
  await sleep(50);
}

/** Freeze the host, let guests drain, compare state at one frame. */
async function compareHashes(pages: Page[], label: string) {
  const roles = await Promise.all(pages.map(view));
  const host =
    pages[
      Math.max(
        0,
        roles.findIndex((v) => v.isHost),
      )
    ];
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
async function recovery(pages: Page[], t0: number, frameBefore: number, ms = 60_000): Promise<number> {
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

async function killScenario(browser: Browser, base: string, phase: 'pick' | 'place' | 'run', n = 3) {
  const label = n === 3 ? phase : `${phase} with ${n}`;
  const r = await newRoom(browser, base, n === 3 ? phase : 'duo', '');
  const { pages, ids } = await startMatch(r, n);
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
  recoveries.push(`${label} (crash): ${secs.toFixed(1)}s`);
  console.log(`     recovered in ${secs.toFixed(1)}s`);
  const after = await view(pages[1]);
  check(after.isHost, `next in join order takes over (${phase})`);
  check(after.phase === before.phase, `phase survives (${before.phase} → ${after.phase})`);
  const a = await waitFor(pages[1], "old host's player marked away", (v) => v.players.find((q) => q.device.startsWith(`${ids[0]}:`))?.away === true, 15_000);
  check(a.players.find((q) => q.device.startsWith(`${ids[0]}:`))?.away === true, 'crashed host handled as a dropped player');
  if (survivors.length > 1) await compareHashes(survivors, phase);
  await r.shot(pages.at(-1)!, 'after');
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
  for (const p of pages) await clicksLive(p);
  const devB = `${ids[1]}:kb1`;
  const moved = (v: NetView) => {
    const q = v.players.find((p) => p.device === devB);
    return !!q && Math.abs(q.cursor.x - 300) < 3 && Math.abs(q.cursor.y - 300) < 3;
  };
  const aimB = async () => {
    const v = await pickAim(B, 300, 300);
    const [bx, by] = await mouseAt(B, v.x, v.y);
    await B.mouse.move(bx, by);
  };
  await aimUntil(aimB, A, moved);
  const seen = await aimUntil(aimB, C, moved);
  check(moved(seen), 'a remote cursor moves live, with no click');

  // --- claim race: two guests click one card at once. Exactly one wins, everywhere, and the loser never saw it as theirs.
  const card = start.crate[0];
  await Promise.all([clickPick(B, card.x, card.y), clickPick(C, card.x, card.y)]);
  const claimed = await waitFor(A, 'the card to be claimed', (v) => v.crate[0].claimedBy >= 0, 15_000);
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
    await clickPick(pages[i], v.crate[free].x, v.crate[free].y);
    await sleep(300);
  }
  await waitFor(A, 'place phase', (v) => v.phase === 'place');

  // --- a remote ghost: B hovers its part in the level; C's screenshot must show it.
  const spot = await validSpot(B, devB);
  if (spot) {
    await clicksLive(B);
    await hoverWorld(B, spot.x, spot.y);
    const tolerance = 3 / (await viewOf(B)).zoom; // the wire carries whole view px
    await waitFor(C, "B's ghost on C", (v) => {
      const q = v.players.find((p) => p.device === devB);
      return !!q && Math.abs(q.cursor.x - spot.x) < tolerance && Math.abs(q.cursor.y - spot.y) < tolerance;
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

/**
 * The way a person does it: one browser presses Play on the menu, another opens the
 * invite link. Nobody presses anything else, and there are no debug params.
 */
async function realFlowScenario(browser: Browser, base: string, label: string, sameBrowser: boolean, savedProfile: boolean) {
  console.log(`\n== ${label}`);
  const size = { viewport: { width: 960, height: 540 } };
  const ca = await browser.newContext(size);
  const cb = sameBrowser ? ca : await browser.newContext(size);
  const contexts = sameBrowser ? [ca] : [ca, cb];
  const errors: string[] = [];
  for (const c of contexts) {
    await c.addInitScript('window.__name = (f) => f');
    // Past the first-visit name prompt. A saved look is what makes two tabs of one browser collide.
    const profile = JSON.stringify({ version: 1, name: savedProfile ? 'Dave' : null, look: savedProfile ? 123456 : undefined, prompted: true });
    await c.addInitScript((v) => localStorage.setItem('slag.profile.v1', v), profile);
  }
  const watch = (p: Page, tag: string) => {
    p.on('pageerror', (e) => errors.push(`${tag}: ${String(e)}`));
    p.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
  };
  const A = await ca.newPage();
  watch(A, 'A');
  await A.goto(base);
  await A.getByRole('button', { name: /^PLAY/i }).click();
  await A.waitForFunction(() => 'slagDebug' in window, null, { timeout: 60_000 });
  await waitFor(A, 'the host seated', (v) => v.players.length === 1, 10_000);
  const invite = A.url().split('?')[0];
  const B = await cb.newPage();
  watch(B, 'B');
  const t0 = Date.now();
  await B.goto(invite);
  await B.waitForFunction(() => 'slagDebug' in window, null, { timeout: 60_000 });
  const b = await waitFor(B, 'the guest seated', (v) => v.players.length === 2, 20_000);
  console.log(`     guest sees both bays ${((Date.now() - t0) / 1000).toFixed(1)} s after opening the link`);
  const a = await waitFor(A, 'the host seeing the guest', (v) => v.players.length === 2, 5000);
  check(a.players.length === 2 && b.players.length === 2, 'both peers see both bays, with nobody pressing anything');
  const looks = (v: NetView) => v.players.map((p) => `${p.slot}:${p.name}:${p.seed}:${p.ready}`).join();
  check(looks(a) === looks(b), `both peers agree on each player (${looks(a)})`);
  check(new Set(a.players.map((p) => p.seed)).size === 2 && new Set(a.players.map((p) => p.name)).size === 2, 'the two players are different characters');
  await sleep(600);
  await r2(A, B, label);
  await ca.close();
  if (cb !== ca) await cb.close();
  const real = errors.filter((e) => !/favicon/.test(e));
  check(real.length === 0, `no page errors${real.length ? `:\n${real.join('\n')}` : ''}`);
}

async function r2(A: Page, B: Page, label: string) {
  const file = label.replaceAll(' ', '-');
  for (const [p, who] of [
    [A, 'host'],
    [B, 'guest'],
  ] as const) {
    const path = `${out}/online-${file}-${who}.png`;
    await p.screenshot({ path, timeout: 60_000 });
    console.log(`     ${path}`);
  }
}

/** Who the lobby labels as host, on this page. */
const hostLabel = (p: Page) => p.evaluate(() => (window as any).slagDebug.renderer.hud.net?.hostSlot as number | undefined);

/** The host label on every screen, and following a migration; a kick by keyboard, then by mouse, with no way back. */
async function kickScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'kick', '', { viewport: { width: 960, height: 540 }, visual: true });
  const A = await r.open('A');
  const a0 = await waitFor(A, 'host seated', (v) => v.players.length === 1 && v.isHost);
  const [B, C, D] = [await r.open('B'), await r.open('C'), await r.open('D')];
  const seated = await waitFor(A, 'everyone seated', (v) => v.players.length === 4, 30_000);
  for (const p of [B, C, D]) await waitFor(p, 'bays', (v) => v.players.length === 4, 10_000);
  const hostSlot = seated.players.find((q) => q.device.startsWith(`${a0.self}:`))!.slot;
  await sleep(300);
  const labels = await Promise.all([A, B, C, D].map(hostLabel));
  check(
    labels.every((l) => l === hostSlot),
    `every peer labels the same player Host (slot ${labels.join('/')})`,
  );
  const kickable = (p: Page) => p.evaluate(() => (window as any).slagDebug.renderer.hud.net?.kickable as number[]);
  // hud.net is rebuilt each drawn frame, and a drawn frame can take a while on a loaded box: give it a few.
  let kicks = { a: -1, b: -1 };
  for (let i = 0; i < 20 && !(kicks.a === 3 && kicks.b === 0); i++) {
    if (i) await sleep(250);
    kicks = { a: (await kickable(A))?.length ?? -1, b: (await kickable(B))?.length ?? -1 };
  }
  check(kicks.a === 3 && kicks.b === 0, `only the host has kick controls (host ${kicks.a}, guest ${kicks.b})`);
  await A.screenshot({ path: `${out}/online-kick-host.png` });
  await B.screenshot({ path: `${out}/online-kick-guest.png` });
  console.log(`     ${out}/online-kick-host.png\n     ${out}/online-kick-guest.png`);

  // By keyboard: Use picks the first other seat, Confirm kicks. Seats follow connection order, so ask who that is.
  const guests = new Map<string, Page>();
  for (const p of [B, C, D]) guests.set((await view(p)).self, p);
  await A.keyboard.press('KeyE');
  await A.waitForFunction(() => (window as any).slagDebug.renderer.hud.net?.kickSlot >= 0, null, { timeout: 15_000 });
  await sleep(300);
  await A.screenshot({ path: `${out}/online-kick-picked.png` });
  const slot = (await A.evaluate(() => (window as any).slagDebug.renderer.hud.net.kickSlot)) as number;
  const victimId = (await view(A)).players.find((q) => q.slot === slot)!.device.split(':')[0];
  const victim = guests.get(victimId)!;
  guests.delete(victimId);
  await A.keyboard.press('Enter');
  const seen = await victim
    .waitForFunction(() => (window as any).slagDebug?.net?.status === 'kicked', null, { timeout: 20_000 })
    .then(
      () => true,
      () => false,
    );
  check(seen, 'the kicked peer sees Kicked');
  await victim.screenshot({ path: `${out}/online-kick-kicked.png` }).catch(() => {});
  await victim.waitForURL((u) => u.pathname === '/', { timeout: 30_000 }).catch(() => {});
  check(new URL(victim.url()).pathname === '/', `the kicked peer lands on the main menu (${new URL(victim.url()).pathname})`);
  const after = await waitFor(A, 'kick applied', (v) => v.players.length === 3, 15_000);
  check(!after.players.some((q) => q.device.startsWith(`${victimId}:`)), 'the kicked player is gone from the host');
  const [watcher] = guests.values();
  const c1 = await waitFor(watcher, 'kick applied on a guest', (v) => v.players.length === 3, 15_000);
  check(!c1.players.some((q) => q.device.startsWith(`${victimId}:`)), 'the kicked player is gone for everyone');
  // The history entry is the room; what's being checked is where that page sends you.
  await victim.goBack({ waitUntil: 'commit', timeout: 60_000 }).catch(() => {});
  await victim.waitForURL((u) => u.pathname === '/', { timeout: 60_000 }).catch(() => {});
  check(new URL(victim.url()).pathname === '/', 'going back to the room lands on the main menu again');

  // By mouse: the button on the bay.
  const spot = await A.evaluate(() => {
    const hud = (window as any).slagDebug.renderer.hud;
    const b = hud.buttons.find((x: any) => x.action === 'kick');
    return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2, device: b.device as string } : null;
  });
  check(!!spot, 'each other bay has a Kick button');
  if (spot) {
    await clickView(A, spot.x, spot.y);
    await waitFor(A, 'mouse kick applied', (v) => v.players.length === 2 && !v.players.some((q) => q.device === spot.device), 15_000);
    guests.delete(spot.device.split(':')[0]);
  }
  const [survivorId, survivor] = [...guests.entries()][0];
  const left = (await view(A)).players.find((q) => q.device.startsWith(`${survivorId}:`))!;

  // The label moves with the host.
  await crash(A);
  await waitFor(survivor, 'the survivor hosting', (v) => v.isHost && v.status === 'online' && !v.paused, 20_000);
  await sleep(600);
  const moved = await hostLabel(survivor);
  check(moved === left.slot, `the Host label follows migration (slot ${moved})`);
  await survivor.screenshot({ path: `${out}/online-kick-migrated.png` });
  const real = r.errors.filter((e) => !/favicon/.test(e));
  check(real.length === 0, `no page errors${real.length ? `:\n${real.join('\n')}` : ''}`);
  await r.dispose();
}

/** The host on another build, faked by stamping its snapshots with a version no build has: the guest must say so, not join forever. */
async function refusedScenario(browser: Browser, base: string) {
  const r = await newRoom(browser, base, 'refused', '', { viewport: { width: 960, height: 540 }, visual: true });
  const A = await r.open('A');
  await waitFor(A, 'host', (v) => v.isHost && v.status === 'online');
  await A.evaluate(() => {
    const t = (window as any).slagDebug.net.transport;
    const send = t.send.bind(t);
    t.send = (m: any, to: string, lossy: boolean) => send(m.t === 'sync' ? { ...m, s: { ...m.s, v: -1 } } : m, to, lossy);
  });
  const B = await r.open('B');
  const refused = await B.waitForFunction(() => (window as any).slagDebug.net.refused, null, { timeout: 30_000 }).then(
    () => true,
    () => false,
  );
  const status = (await B.evaluate(() => (window as any).slagDebug.renderer.hud.net?.status)) as string;
  check(refused && status === 'Different Version · Reload', `a guest that can't load the host's state says so (${status})`);
  await r.shot(B, 'guest');
  const hud = (await B.evaluate(() => {
    const h = (window as any).slagDebug.renderer.hud;
    return { bad: h.toastBad as boolean, actions: (h.buttons as { action: string }[]).map((b) => b.action) };
  })) as { bad: boolean; actions: string[] };
  check(hud.bad, 'the toast reads as bad news, not a success check');
  const seatControls = hud.actions.filter((a) => ['join', 'ready', 'look', 'level', 'name'].includes(a));
  check(seatControls.length === 0, `no seat or join controls on a guest that can't join (${seatControls.join(', ') || 'none'})`);
  await r.dispose();
}

/** A room whose level has open, flat floor from the spawn to 7 tiles past the spawn zone, in clear weather: room for a shove and a ride. */
function roomWithRunway(): string {
  const fits = (code: string) => {
    const l = generateLevel(roomSeed(code));
    const z = spawnZone(l);
    if (!z || (l.weather && l.weather.kind !== 'clear')) return false;
    const { tx, ty } = l.spawn;
    const end = (z.x + z.w) / TILE + 7;
    // Set pieces can be hazards.
    let open = !l.setPieces.some((sp) => sp.tx < end + 6 && Math.abs(sp.ty - ty) < 10);
    for (let x = tx; x < end && open; x++) {
      open = tileAt(l, x, ty + 1) === T_SOLID;
      for (let y = ty - 3; y <= ty; y++) open &&= tileAt(l, x, y) === T_EMPTY;
    }
    return open;
  };
  // A speed hint only: the first fit when last checked. Generator changes move it, and then the search below finds the new one.
  if (fits('CONTACT1E')) return 'CONTACT1E';
  for (let i = 0; i < 500; i++) {
    const code = `CONTACT${i.toString(36).toUpperCase()}`;
    if (fits(code)) return code;
  }
  throw new Error('no level with a runway in 500 rooms');
}

/** A room code whose level matches, found the way a player's room finds it: from the code alone. */
function roomWithLevel(tag: string, fits: (w: number, h: number) => boolean): { code: string; w: number; h: number } {
  for (let i = 0; i < 500; i++) {
    const code = `V${tag}${i.toString(36).toUpperCase()}`;
    const l = generateLevel(roomSeed(code));
    if (fits(l.w, l.h)) return { code, w: l.w, h: l.h };
  }
  throw new Error(`no ${tag} level in 500 rooms`);
}

/** A new window size, once the game has laid out for it: until then the view box, and so any mouse aim, is stale. */
async function resize(p: Page, win: { width: number; height: number }) {
  await p.setViewportSize(win);
  await p.waitForFunction(
    ([w, h]) => {
      const r = document.querySelector('[data-slag-view]')!.getBoundingClientRect();
      return Math.abs(r.width - 768 * Math.min(w / 768, h / 432)) < 2;
    },
    [win.width, win.height],
    { timeout: 30_000 },
  );
}

/** What the links and sessions think, for a failure that only shows up under load. */
async function dumpNet(pages: Page[], label: string) {
  for (const [i, p] of pages.entries()) {
    const d = await p.evaluate(() => {
      const n = (window as any).slagDebug.net;
      const t = n.transport;
      return {
        status: n.status,
        role: n.role,
        host: n.hostId,
        members: n.members,
        unacked: n.unacked?.length,
        queues: [...(n.queues?.entries() ?? [])].map(([k, q]: any) => [k, q.frames.length, q.consumed]),
        away: n.match.players.map((q: any) => [q.device.slice(-8), !!q.away, q.placed, Math.round(q.cursor.x), Math.round(q.cursor.y)]),
        phase: n.match.phase,
        frame: n.match.frame,
        t: {
          role: t.role,
          hostId: t.hostId,
          probing: t.probing,
          candidate: t.candidate,
          lastStatus: t.lastStatus,
          links: [...t.links.keys()],
          open: [...t.links.values()].map((l: any) => [l.open, l.rel?.readyState, l.rt?.readyState, Date.now() - l.heard]),
          dials: [...t.dials.keys()],
          inbound: t.inbound.size,
          dead: [...t.dead.keys()],
          pollFails: t.pollFails,
          roster: [...t.roster.values()].map((m: any) => [m.id, m.order, !!m.linking]),
        },
      };
    });
    console.log(`     DUMP ${label} peer ${i}: ${JSON.stringify(d)}`);
  }
}

/** Aim until the other peer sees it, as a person's hand would: one mouse event can land on a page mid-layout. */
async function aimUntil(aim: () => Promise<void>, other: Page, near: (v: NetView) => boolean, ms = 20_000): Promise<NetView> {
  const t0 = Date.now();
  let v = await view(other);
  while (!near(v) && Date.now() - t0 < ms) {
    await aim();
    for (let i = 0; i < 12 && !near(v); i++) {
      await sleep(250);
      v = await view(other);
    }
  }
  return v;
}

const WINDOWS = [
  { name: '16x9', width: 640, height: 360 },
  { name: '21x9', width: 840, height: 360 },
  { name: '4x3', width: 640, height: 480 },
  { name: 'phone', width: 640, height: 296 },
];

/**
 * Real mouse events, at every window shape, on one level size. The card under the pointer
 * is the one taken; the cursor and ghost land under it on both peers; a click places there.
 */
async function viewScenario(browser: Browser, base: string, kind: string, fits: (w: number, h: number) => boolean) {
  const { code, w, h } = roomWithLevel(kind[0].toUpperCase(), fits);
  const r = await newRoom(browser, base, `view-${kind}`, '', { room: code, viewport: WINDOWS[0], visual: true });
  const { pages, ids } = await startMatch(r, 2);
  const [A, B] = pages;
  const devB = `${ids[1]}:kb1`;
  console.log(`     ${w}×${h} tiles, zoom ${(await viewOf(A)).zoom.toFixed(2)}`);
  for (const p of pages) await clicksLive(p);

  // Pick: the card the mouse is on, on the other peer too.
  const crate = (await view(B)).crate;
  for (const [i, win] of WINDOWS.entries()) {
    await resize(B, win);
    const card = crate[i % crate.length];
    const near = (v: NetView) => {
      const q = v.players.find((p) => p.device === devB);
      return !!q && Math.abs(q.cursor.x - card.x) < 3 && Math.abs(q.cursor.y - card.y) < 3;
    };
    const aim = async () => {
      const at = await pickAim(B, card.x, card.y);
      const [mx, my] = await mouseAt(B, at.x, at.y);
      await B.mouse.move(mx, my);
    };
    const seen = await aimUntil(aim, A, near);
    check(near(seen), `${kind} ${win.name}: the mouse is on the card, for both peers`);
  }
  const last = crate[(WINDOWS.length - 1) % crate.length];
  await clickPick(B, last.x, last.y);
  const taken = await waitFor(A, 'the card taken', (v) => v.players.find((p) => p.device === devB)!.claim >= 0, 15_000);
  check(taken.crate[taken.players.find((p) => p.device === devB)!.claim].x === last.x, `${kind}: a click takes the card under the pointer`);
  const other = (await view(A)).crate.findIndex((c) => c.claimedBy < 0);
  const free = (await view(A)).crate[other];
  await clickPick(A, free.x, free.y);
  for (const p of pages) await waitFor(p, 'place', (v) => v.phase === 'place', 30_000);
  await clicksLive(B);

  // Place: the drawn ghost sits under the pointer on this peer, and at the same world spot on the other.
  const ov = await viewOf(B);
  const spot = await validSpot(B, devB);
  if (!spot) {
    check(false, `${kind}: found no legal spot`);
    return r.dispose();
  }
  const tolerance = 3 / ov.zoom;
  // Where the HUD actually draws each player's arrow, in view px. The arrow painter (render/hud/pick-place.ts) is a
  // module function now, but every arrow is drawn scaled about its own tip through `hud.grow`, so that's the hook. Other
  // HUD parts grow too (headers), so keep enough entries for a frame's worth of both.
  const spyArrows = (p: Page) =>
    p.evaluate(() => {
      const h = (window as any).slagDebug.renderer.hud;
      const grow = h.grow.bind(h);
      h.__arrows = [];
      h.grow = (x: number, y: number, s: number) => {
        h.__arrows.push([x, y]);
        if (h.__arrows.length > 32) h.__arrows.shift();
        return grow(x, y, s);
      };
    });
  /** Waits for a drawn frame: software GL can take a while under load. */
  const arrowAt = async (p: Page, x: number, y: number) => {
    for (let i = 0; i < 40; i++) {
      const hit = await p.evaluate(
        ([vx, vy]) =>
          ((window as any).slagDebug.renderer.hud.__arrows as [number, number][]).some(([ax, ay]) => Math.abs(ax - vx) < 4 && Math.abs(ay - vy) < 4),
        [x, y],
      );
      if (hit) return true;
      await sleep(250);
    }
    return false;
  };
  await spyArrows(A);
  await spyArrows(B);
  const onScreen = (p: Page) => p.evaluate(([x, y]) => (window as any).slagDebug.renderer.worldToScreen(x, y) as { x: number; y: number }, [spot.x, spot.y]);
  for (const win of WINDOWS) {
    await resize(B, win);
    const near = (v: NetView) => {
      const q = v.players.find((p) => p.device === devB);
      return !!q && Math.abs(q.cursor.x - spot.x) < tolerance && Math.abs(q.cursor.y - spot.y) < tolerance;
    };
    const seen = await aimUntil(() => hoverWorld(B, spot.x, spot.y), A, near);
    if (!near(seen)) await dumpNet([A, B], `${kind} ${win.name}`);
    await sleep(300);
    const want = worldToView(ov, spot.x, spot.y);
    const [drawnB, drawnA] = [await onScreen(B), await onScreen(A)];
    const under = Math.hypot(drawnB.x - want.x, drawnB.y - want.y) < 2 && Math.hypot(drawnA.x - want.x, drawnA.y - want.y) < 2;
    check(near(seen) && under, `${kind} ${win.name}: the ghost is under the pointer, for both peers`);
    check((await arrowAt(B, want.x, want.y)) && (await arrowAt(A, want.x, want.y)), `${kind} ${win.name}: the arrow is on the ghost, for both peers`);
    await r.shot(B, win.name);
  }
  const g = await A.evaluate((dev) => {
    const m = (window as any).slagDebug.match;
    const q = m.players.find((p: any) => p.device === dev);
    const o = m.ghostOrigin(q);
    return { tx: o.tx, ty: o.ty, slot: q.slot, part: o.def.name as string, modules: o.def.modules.map((x: any) => x.type).join() as string };
  }, devB);
  await clickWorld(B, spot.x, spot.y);
  await waitFor(A, 'the part placed', (v) => v.players.find((p) => p.device === devB)!.placed, 15_000);
  const put = await A.evaluate((slot) => {
    const p = (window as any).slagDebug.match.placed.find((q: any) => q.owner === slot);
    return p ? { tx: p.tx, ty: p.ty } : null;
  }, g.slot);
  // A bomb goes off and leaves nothing behind; being spent is its proof.
  const landed = g.modules.includes('bomb') || (put?.tx === g.tx && put?.ty === g.ty);
  check(landed, `${kind}: a click places the part exactly where the ghost was (${g.tx},${g.ty}, got ${JSON.stringify(put)}, ${g.part}: ${g.modules})`);
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
  const server = await startServer({
    env: {
      SLAG_SIGNAL_STORE: '',
      KV_REST_API_URL: '',
      KV_REST_API_TOKEN: '',
      UPSTASH_REDIS_REST_URL: '',
      UPSTASH_REDIS_REST_TOKEN: '',
    },
  });
  try {
    const r = await newRoom(browser, server.base, 'unset', '', { visual: true });
    const p = await r.open('A');
    const v = await waitFor(p, 'online to give up cleanly', (x) => x.status === 'unavailable', 20_000);
    check(v.detail === 'Online Not Set Up', `missing store credentials: "${v.detail}"`);
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

// Real host candidates: mDNS names don't resolve between isolated headless contexts.
const browser = await launchBrowser(['--disable-features=WebRtcHideLocalIpsWithMdns']);
const server = await startServer({ env: storeEnv });
console.log(`signaling store: ${srh ? 'Upstash REST (SRH)' : 'in memory'}`);
try {
  if (wanted('flow')) {
    await realFlowScenario(browser, server.base, 'flow two browsers', false, false);
    await realFlowScenario(browser, server.base, 'flow two tabs saved look', true, true);
  }
  if (wanted('kick')) await kickScenario(browser, server.base);
  if (wanted('refused')) await refusedScenario(browser, server.base);
  if (wanted('view')) {
    await viewScenario(browser, server.base, 'classic', (w, h) => w === 48 && h === 27);
    await viewScenario(browser, server.base, 'wide', (w) => w > 48);
  }
  if (wanted('view') || wanted('view-tall')) await viewScenario(browser, server.base, 'tall', (_w, h) => h > 27);
  if (wanted('play')) await playScenario(browser, server.base);
  if (wanted('pick')) await killScenario(browser, server.base, 'pick');
  if (wanted('place')) await killScenario(browser, server.base, 'place');
  if (wanted('run')) await killScenario(browser, server.base, 'run');
  if (wanted('duo')) await killScenario(browser, server.base, 'run', 2);
  if (wanted('leave')) await leaveScenario(browser, server.base);
  if (wanted('twice')) await twiceScenario(browser, server.base);
  if (wanted('latency')) await latencyScenario(browser, server.base);
  if (wanted('hidden')) await hiddenScenario(browser, server.base);
  if (wanted('contact')) await contactScenario(browser, server.base);
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
