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
import { pressMenu, waitMenu } from '../lib/menu';
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
  /** Players whose peer is gone (`away`). */
  away?: number[];
  leaving?: number[];
  /** Sim frames to step first. */
  frames?: number;
  /** The join card: its stage, a second roll of the dice, a typed name. */
  card?: { stage: 'edit' | 'asking' | 'won' | 'taken'; reroll?: boolean; name?: string };
  /** Then click our own name: the name screen, with the swatches. */
  nameScreen?: boolean;
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
const failed = (title: string, offline = true, rejoinIn?: number) =>
  online('Offline', 'seated', 0, { offline: true, inviteUrl: undefined, arrival: { stage: 'failed', title, here: 0, offline, rejoinIn } });
const RACE = 'race=saw';

const FRAMES: Frame[] = [
  { name: '01-connecting', q: '', net: online('Joining…', 'seated', 0, { arrival: { stage: 'connecting', title: 'Joining…', here: 3 } }) },
  {
    name: '02-lobby-joined',
    q: '',
    lobby: 3,
    net: online('Hosting · 5 Connected', 'seated', 5, { hostSlot: 0, kickable: [1, 2], watchers: watchers([['Moss'], ['']]) }),
  },
  {
    name: '03-lobby-watching',
    q: '',
    lobby: 3,
    net: online('5 Connected', 'watching', 5, { hostSlot: 0, watchers: watchers([['Moss', false, true], ['']], false) }),
  },
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
  { name: '21-failed-kicked', q: '', net: failed('Kicked', false, 47) },
  { name: '22-kicked-rejoin', q: '', net: failed('Kicked', false, 0) },
  { name: '23-gone-player', q: `players=4&${RACE}`, frames: 110, away: [2], afk: [3], net: online('4 Connected', 'seated', 4) },
  // A watcher's Join in the lobby (03 is before): seated the lobby's way, our card among the players, no join card.
  {
    name: '24-lobby-joined-from-watching',
    q: '',
    lobby: 4,
    net: online('5 Connected', 'seated', 4, { hostSlot: 1, watchers: watchers([['']], false) }),
  },
  { name: '25-name-colors', q: '', lobby: 3, nameScreen: true, net: online('Hosting · 3 Connected', 'seated', 5, { hostSlot: 0, kickable: [1, 2] }) },
];

async function frame(p: Page, f: Frame, tag: string): Promise<string> {
  await p.goto(`${base}r/SHOTS?seed=storyboard&net=off&q=high${f.q ? `&${f.q}` : ''}`);
  await p.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(
    ([net, afk, leaving, n, touch, lobby, card, away]) => {
      const d = (window as any).slagDebug;
      d.pause(true);
      const hud = d.renderer.hud;
      if (touch) hud.inputMode = 'touch';
      const m = d.match;
      for (const dev of [touch ? 'touch' : 'kb1', 'kb2', 'pad0', 'pad1'].slice(0, lobby)) m.join(dev);
      hud.mouseDevice = (net as any).seat === 'watching' ? 'nobody' : touch ? 'touch' : 'kb1';
      for (const i of afk) if (m.players[i]) m.players[i].afk = true;
      for (const i of away) if (m.players[i]) m.players[i].away = true;
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
    [f.net, f.afk ?? [], f.leaving ?? [], f.frames ?? 30, tag === 'phone', f.lobby ?? 0, f.card ?? null, f.away ?? []] as const,
  );
  if (f.nameScreen) {
    const b = await p.evaluate(() => {
      const r = document.querySelector('[data-slag-view]')!.getBoundingClientRect();
      const k = r.width / 768;
      const x = (window as any).slagDebug.renderer.hud.buttons.find((q: any) => q.action === 'name');
      return x && { x: r.left + (x.x + x.w / 2) * k, y: r.top + (x.y + x.h / 2) * k };
    });
    if (!b) throw new Error(`${f.name}: no name button`);
    if (tag === 'phone') await p.touchscreen.tap(b.x, b.y);
    else await p.mouse.click(b.x, b.y);
    await waitMenu(p, 'name');
    // A swatch picked: the preview wears it.
    await pressMenu(p, (c) => c.id.startsWith('color:') && !c.disabled && !c.on, tag === 'phone' ? 'tap' : 'click');
    await p.waitForTimeout(300);
  }
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
