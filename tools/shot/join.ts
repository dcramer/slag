/**
 * The join-and-watch storyboard (docs/storyboards/join-observe.md): every state a peer passes through
 * arriving at a room, choosing to play or watch, and being moved to watching, on a desktop and on a phone.
 * The net info the HUD draws is staged (the real flow is tools/online-test.ts `observe`), so every state,
 * a full room and each failure included, is one deterministic frame.
 *
 *   pnpm shot join [--out docs/storyboards/join-observe] [--only connecting,full]
 */
import { execFileSync } from 'node:child_process';
import { devices, type Page } from 'playwright';
import { base, browser, errors, opt, out, page, pet, type Scenarios } from './ctx';

type Seat = 'seated' | 'leaving' | 'choosing' | 'queued' | 'watching';
interface Frame {
  name: string;
  /** Debug URL params: the match behind the screen. */
  q: string;
  net: Record<string, unknown>;
  /** Players to mark (by index) before the frame. */
  afk?: number[];
  leaving?: number[];
  /** Sim frames to step first. */
  frames?: number;
}

const watchers = (list: [string, boolean?, boolean?][]) =>
  list.map(([name, afk, self], i) => ({ peer: `w${i}`, name, afk: !!afk, self: !!self, kickable: !self }));
const online = (status: string, seat: Seat, space: number, extra: Record<string, unknown> = {}) => ({
  status,
  seat,
  space,
  peers: [],
  inviteUrl: 'x',
  watchers: [],
  ...extra,
});
const failed = (title: string, offline = true) =>
  online('Offline', 'seated', 0, { offline: true, inviteUrl: undefined, arrival: { stage: 'failed', title, here: 0, offline } });

const FRAMES: Frame[] = [
  { name: '01-connecting', q: '', net: online('Joining…', 'seated', 0, { arrival: { stage: 'connecting', title: 'Joining…', here: 3 } }) },
  {
    name: '02-lobby-joined',
    q: 'players=3',
    net: online('3 Connected', 'seated', 5, { hostSlot: 1, watchers: watchers([['Moss'], ['']]) }),
  },
  { name: '03-in-progress-space', q: 'players=3&race=saw', frames: 150, net: online('4 Connected', 'choosing', 5) },
  { name: '04-in-progress-full', q: 'players=8&race=saw', frames: 150, net: online('9 Connected', 'choosing', 0) },
  { name: '05-seat-frees', q: 'players=8&race=saw', frames: 150, leaving: [5], net: online('9 Connected', 'choosing', 1) },
  { name: '06-next-round', q: 'players=7&race=saw', frames: 150, net: online('8 Connected', 'queued', 1) },
  { name: '07-watching-join', q: 'players=3&race=saw', frames: 200, net: online('4 Connected', 'watching', 5) },
  { name: '08-swap-lobby', q: 'players=2', net: online('2 Connected', 'seated', 6, { hostSlot: 1 }) },
  { name: '09-swap-mid-match', q: 'players=3&race=saw', frames: 150, leaving: [0], net: online('3 Connected', 'leaving', 6) },
  {
    name: '10-afk',
    q: 'players=3',
    afk: [2],
    net: online('4 Connected', 'seated', 5, { hostSlot: 0, kickable: [1, 2], watchers: watchers([['Grub', true]]) }),
  },
  { name: '11-failed-unset', q: '', net: failed('Online Not Set Up') },
  { name: '12-failed-full', q: '', net: failed('Room Is Full') },
  { name: '13-failed-unreachable', q: '', net: failed('Cannot Reach Host') },
  { name: '14-failed-version', q: '', net: failed('Different Version') },
  { name: '15-failed-kicked', q: '', net: failed('Kicked', false) },
];

async function frame(p: Page, f: Frame, tag: string): Promise<string> {
  await p.goto(`${base}r/SHOTS?seed=storyboard&net=off&q=high${f.q ? `&${f.q}` : ''}`);
  await p.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(
    ([net, afk, leaving, n, touch]) => {
      const d = (window as any).slagDebug;
      d.pause(true);
      if (touch) d.renderer.hud.inputMode = 'touch';
      const m = d.match;
      for (const i of afk) if (m.players[i]) m.players[i].afk = true;
      for (const i of leaving) if (m.players[i]) m.players[i].leaving = true;
      // Pings on the cards of everyone but us, and a host label, as a live room has them.
      const pings = [undefined, 42, 135, 230, 61, 88, 97, 150];
      d.renderer.hud.net = {
        ...net,
        peers: m.players.map((pl: any, i: number) => ({
          name: pl.character.name,
          isHost: i === (net as any).hostSlot,
          local: i === 0,
          pingMs: i ? pings[i] : undefined,
        })),
      };
      d.step(n);
    },
    [f.net, f.afk ?? [], f.leaving ?? [], f.frames ?? 30, tag === 'phone'] as const,
  );
  const path = `${out}/${f.name}-${tag}.png`;
  await p.screenshot({ path });
  pet();
  return path;
}

export const shots: Scenarios = {
  async join() {
    const only = opt('only')?.split(',');
    const wanted = FRAMES.filter((f) => !only || only.some((o) => f.name.includes(o)));
    const { defaultBrowserType: _ignored, ...phone } = devices['iPhone 13 landscape'];
    const ctx = await browser.newContext({ ...phone, deviceScaleFactor: 2 });
    const pp = await ctx.newPage();
    pp.on('pageerror', (e: Error) => errors.push(String(e)));
    const paths: string[] = [];
    for (const f of wanted) {
      paths.push(await frame(page, f, 'desktop'));
      paths.push(await frame(pp, f, 'phone'));
    }
    await ctx.close();
    // The storyboard is checked in: small JPEGs, not full-size PNGs.
    if (opt('jpeg') !== 'no') {
      for (const pth of paths) {
        execFileSync('convert', [pth, '-resize', '1100x1100>', '-quality', '82', pth.replace(/\.png$/, '.jpg')]);
        execFileSync('rm', [pth]);
        console.log(pth.replace(/\.png$/, '.jpg'));
      }
    } else for (const pth of paths) console.log(pth);
  },
};
