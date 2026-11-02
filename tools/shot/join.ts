/**
 * The join-and-watch storyboard (docs/storyboards/join-observe.md): every state a peer passes through
 * arriving at a room, watching, taking a seat with the join card, and being moved to watching, on a
 * desktop and on a phone. The net info the HUD draws is staged (the real flow runs in tools/online-test.ts
 * `observe`), so every state, a full room, a lost race and each failure included, is one deterministic frame.
 *
 *   pnpm shot join [--out docs/storyboards/join-observe] [--only card,full] [--jpeg no]
 */
import { execFileSync } from 'node:child_process';
import { devices, type Page } from 'playwright';
import { base, browser, errors, opt, out, page, pet, type Scenarios } from './ctx';

type Seat = 'seated' | 'leaving' | 'queued' | 'watching';
interface Frame {
  name: string;
  /** Debug URL params: the match behind the screen (`players` and `race` start one). */
  q: string;
  /** Lobby frames: seat this many players without starting. */
  lobby?: number;
  net: Record<string, unknown>;
  afk?: number[];
  leaving?: number[];
  /** Sim frames to step first. */
  frames?: number;
  /** The join card: its stage, a second roll of the dice, a typed name. */
  card?: { stage: 'edit' | 'asking' | 'won' | 'taken'; reroll?: boolean; name?: string };
}

const watchers = (list: [string, boolean?, boolean?][], host = true) =>
  list.map(([name, afk, self], i) => ({ peer: `w${i}`, name, afk: !!afk, self: !!self, kickable: host && !self }));
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
const RACE = 'race=saw';

const FRAMES: Frame[] = [
  { name: '01-connecting', q: '', net: online('Joining…', 'seated', 0, { arrival: { stage: 'connecting', title: 'Joining…', here: 3 } }) },
  {
    name: '02-lobby-joined',
    q: '',
    lobby: 3,
    net: online('Hosting · 5 Connected', 'seated', 5, { hostSlot: 0, kickable: [1, 2], watchers: watchers([['Moss'], ['']]) }),
  },
  { name: '03-lobby-watching', q: '', lobby: 3, net: online('5 Connected', 'watching', 5, { hostSlot: 0, watchers: watchers([['Moss', false, true], ['']], false) }) },
  {
    name: '04-arrive-watching',
    q: `players=3&${RACE}`,
    frames: 200,
    net: online('4 Connected', 'watching', 5, { watchers: watchers([['Moss', false, true]], false) }),
  },
  { name: '05-match-full', q: `players=8&${RACE}`, frames: 200, net: online('9 Connected', 'watching', 0) },
  { name: '06-seat-frees', q: `players=8&${RACE}`, frames: 260, leaving: [5], net: online('9 Connected', 'watching', 1) },
  { name: '07-join-card', q: `players=3&${RACE}`, frames: 200, net: online('4 Connected', 'watching', 5), card: { stage: 'edit' } },
  {
    name: '08-join-card-new-look',
    q: `players=3&${RACE}`,
    frames: 200,
    net: online('4 Connected', 'watching', 5),
    card: { stage: 'edit', reroll: true, name: 'Moss' },
  },
  { name: '09-joining', q: `players=3&${RACE}`, frames: 200, net: online('4 Connected', 'watching', 5), card: { stage: 'asking', reroll: true, name: 'Moss' } },
  {
    name: '10-in-next-round',
    q: `players=3&${RACE}`,
    frames: 200,
    net: online('4 Connected', 'queued', 4),
    card: { stage: 'won', reroll: true, name: 'Moss' },
  },
  { name: '11-taken', q: `players=7&${RACE}`, frames: 200, net: online('9 Connected', 'watching', 0), card: { stage: 'taken', reroll: true, name: 'Moss' } },
  { name: '12-queued', q: `players=3&${RACE}`, frames: 300, net: online('4 Connected', 'queued', 4) },
  { name: '13-seated', q: 'players=4', frames: 40, net: online('4 Connected', 'seated', 4) },
  { name: '14-swap-lobby', q: '', lobby: 2, net: online('2 Connected', 'seated', 6, { hostSlot: 1 }) },
  { name: '15-swap-mid-match', q: `players=3&${RACE}`, frames: 200, leaving: [0], net: online('3 Connected', 'leaving', 6) },
  {
    name: '16-afk',
    q: '',
    lobby: 3,
    afk: [2],
    net: online('Hosting · 4 Connected', 'seated', 5, { hostSlot: 0, kickable: [1, 2], watchers: watchers([['Grub', true]]) }),
  },
  { name: '17-failed-unset', q: '', net: failed('Online Not Set Up') },
  { name: '18-failed-full', q: '', net: failed('Room Is Full') },
  { name: '19-failed-unreachable', q: '', net: failed('Cannot Reach Host') },
  { name: '20-failed-version', q: '', net: failed('Different Version') },
  { name: '21-failed-kicked', q: '', net: failed('Kicked', false) },
];

async function frame(p: Page, f: Frame, tag: string): Promise<string> {
  await p.goto(`${base}r/SHOTS?seed=storyboard&net=off&q=high${f.q ? `&${f.q}` : ''}`);
  await p.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(
    ([net, afk, leaving, n, touch, lobby, card]) => {
      const d = (window as any).slagDebug;
      d.pause(true);
      const hud = d.renderer.hud;
      if (touch) hud.inputMode = 'touch';
      const m = d.match;
      for (const dev of [touch ? 'touch' : 'kb1', 'kb2', 'pad0', 'pad1'].slice(0, lobby)) m.join(dev);
      hud.mouseDevice = (net as any).seat === 'watching' ? 'nobody' : touch ? 'touch' : 'kb1';
      for (const i of afk) if (m.players[i]) m.players[i].afk = true;
      for (const i of leaving) if (m.players[i]) m.players[i].leaving = true;
      // Pings on the cards of everyone but us, and a host label, as a live room has them.
      const pings = [undefined, 42, 135, 230, 61, 88, 97, 150];
      hud.net = {
        ...net,
        seats: m.players.filter((pl: any) => !pl.leaving).map((pl: any) => `hsl(${pl.character.body.h} ${pl.character.body.s}% ${pl.character.body.l}%)`),
        peers: m.players.map((pl: any, i: number) => ({
          name: pl.character.name,
          isHost: i === (net as any).hostSlot,
          local: i === 0,
          pingMs: i ? pings[i] : undefined,
        })),
      };
      if (card) {
        // A toy of our own, rolled the way a seat rolls one, then let go again.
        // (Inline, no named helpers: the bundler wraps them in a __name the page doesn't have.)
        let ch = null;
        for (let k = card.reroll ? 2 : 1; k > 0; k--) {
          const x = m.join(`card${k}`);
          m.players = m.players.filter((pl: any) => pl !== x);
          ch = x.character;
        }
        hud.joinCard = { character: card.name ? { ...ch, name: card.name } : ch, stage: card.stage, now: false };
      }
      d.step(n);
    },
    [f.net, f.afk ?? [], f.leaving ?? [], f.frames ?? 30, tag === 'phone', f.lobby ?? 0, f.card ?? null] as const,
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
