/**
 * Brand assets: the favicon, the app icons and the link-preview image. Everything is rendered
 * in headless Chromium from sources in this repo, so an art pass is one command away from new
 * files. The outputs are committed host files; nothing in src/ reads them.
 *
 *   pnpm brand                → icons, then og
 *   pnpm brand icons          → from tools/brand-mark.svg (the master mark): app/icon.svg (plus a
 *                               hand-placed 16 px layer), app/favicon.ico (16/32/48),
 *                               app/apple-icon.png (180), public/icons/icon-{192,512}.png,
 *                               public/icons/maskable-512.png
 *   pnpm brand og             → app/opengraph-image.* and app/r/[room]/opengraph-image.* (1200×630,
 *                               site and lobby invite): the home-screen logo over a real 8-player
 *                               race, rendered by the production build
 *   pnpm brand preview        → shots/brand-icons.png: every icon at actual size and zoomed 8×
 *
 * og options: --seed og2 --theme factory --players 8 --frames 150 --zoom 1.8 (race camera zoom cap, 0 = off)
 *             --race saw,launcher,... (picked by eye: eight different runners spread under the logo, hazards around them)
 *             --art shots/brand-og-art.png (reuse the race art the last run saved: polish the framing
 *             without re-rendering the race)
 */

import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser, Page } from 'playwright';
import { argReader, launchBrowser, startServer, watchdog } from './lib/server';

const argv = process.argv.slice(2);
const task = argv[0] && !argv[0].startsWith('--') ? argv.shift()! : 'all';
const { opt } = argReader(argv);
const SHOTS = resolve('shots');
mkdirSync(SHOTS, { recursive: true });
mkdirSync('public/icons', { recursive: true });

/** The master mark, vector only. `icons` adds the hand-placed 16 px layer and writes app/icon.svg. */
const MASTER = 'tools/brand-mark.svg';

/** The plate behind the mark on home-screen icons: soot with molten light pooling at the bottom, like the main menu. */
const PLATE = 'radial-gradient(70% 55% at 50% 100%, rgba(255,106,31,0.5), rgba(184,35,15,0.18) 55%, transparent 80%), linear-gradient(#2b201b, #120b08)';

interface IconSpec {
  file: string;
  size: number;
  /** Mark size as a fraction of the icon. */
  mark: number;
  plate?: 'square' | 'rounded';
}

/** Tab icons are the bare mark, as big as it goes; home-screen icons sit on a plate. Maskable keeps the mark inside the 80% safe circle. */
const ICONS: IconSpec[] = [
  { file: 'shots/brand-16.png', size: 16, mark: 1 },
  { file: 'shots/brand-32.png', size: 32, mark: 1 },
  { file: 'shots/brand-48.png', size: 48, mark: 1 },
  { file: 'app/apple-icon.png', size: 180, mark: 0.86, plate: 'square' },
  { file: 'public/icons/icon-192.png', size: 192, mark: 0.86, plate: 'rounded' },
  { file: 'public/icons/icon-512.png', size: 512, mark: 0.86, plate: 'rounded' },
  { file: 'public/icons/maskable-512.png', size: 512, mark: 0.66, plate: 'square' },
];

async function renderIcon(browser: Browser, spec: IconSpec, markUrl: string): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width: spec.size, height: spec.size } });
  const m = spec.size * spec.mark;
  const plate = spec.plate ? `background:${PLATE};${spec.plate === 'rounded' ? 'border-radius:22%;' : ''}` : '';
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><div style="width:${spec.size}px;height:${spec.size}px;display:grid;place-items:center;${plate}">` +
      `<img src="${markUrl}" style="width:${m}px;height:${m}px;display:block"></div></body></html>`,
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  const png = await page.screenshot({ omitBackground: true });
  await page.close();
  return png;
}

/**
 * The 16 px mark, placed by hand: the vector S blurs into a blob at that size. `x` is molten fill;
 * the ink outline (4-neighbour) and the one-pixel drop below it are derived, as on the big mark.
 */
const PIXEL_16 = [
  '................',
  '.....xxxxxxxx...',
  '....xxxxxxxxxx..',
  '...xxxx.........',
  '...xxxx.........',
  '...xxxxxxxxx....',
  '....xxxxxxxxxx..',
  '..........xxxx..',
  '..........xxxx..',
  '..xxxxxxxxxxxx..',
  '...xxxxxxxxxx...',
  '.....xx...x.....',
  '.....xx.........',
  '................',
  '................',
  '................',
];

/** White-hot → amber → molten → ember down the glyph, as on the logo. */
const MOLTEN: [number, [number, number, number]][] = [
  [0.1, [0xff, 0xf1, 0xb8]],
  [0.35, [0xff, 0xb0, 0x2e]],
  [0.62, [0xff, 0x6a, 0x1f]],
  [0.92, [0xb8, 0x23, 0x0f]],
];
const INK = '#120b08';

function molten(t: number): string {
  let c = MOLTEN.at(-1)![1];
  if (t <= MOLTEN[0][0]) c = MOLTEN[0][1];
  else
    for (let i = 1; i < MOLTEN.length; i++) {
      const [t1, c1] = MOLTEN[i];
      const [t0, c0] = MOLTEN[i - 1];
      if (t > t1) continue;
      c = c0.map((v, k) => Math.round(v + ((c1[k] - v) * (t - t0)) / (t1 - t0))) as [number, number, number];
      break;
    }
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** The grid as crisp horizontal runs, one path per colour, in a 16-unit space. */
function pixelLayer(grid: string[]): string {
  const n = grid.length;
  const fill = (x: number, y: number) => grid[y]?.[x] === 'x';
  const ink = (x: number, y: number) => !fill(x, y) && (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1));
  const rows = grid.flatMap((r, y) => (r.includes('x') ? [y] : []));
  const [top, bottom] = [rows[0], rows.at(-1)!];
  const colour = (x: number, y: number) =>
    fill(x, y) ? molten((y - top) / Math.max(1, bottom - top)) : ink(x, y) || ink(x, y - 1) || fill(x, y - 1) ? INK : null;
  const paths = new Map<string, string>();
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n;) {
      const c = colour(x, y);
      let run = 1;
      while (x + run < n && colour(x + run, y) === c) run++;
      if (c) paths.set(c, `${paths.get(c) ?? ''}M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  return [...paths].map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('');
}

/**
 * app/icon.svg: the vector mark, with the pixel mark swapped in when it's drawn 24 px or smaller.
 * Width media queries inside an SVG image follow the size it's drawn at (resolution queries
 * don't), so one file is crisp in a 16 px tab and smooth everywhere bigger. Browsers that ignore
 * the query get the vector mark.
 */
function iconSvg(): string {
  const master = readFileSync(MASTER, 'utf8');
  const style = '<style>.px{display:none}@media (max-width:24px){.px{display:inline}.vec{display:none}}</style>';
  const open = master.indexOf('>', master.indexOf('<svg')) + 1;
  const close = master.lastIndexOf('</svg>');
  const vector = master.slice(open, close).replace(/<defs>[\s\S]*?<\/defs>/, '');
  const defs = /<defs>[\s\S]*?<\/defs>/.exec(master)?.[0] ?? '';
  const n = PIXEL_16.length;
  return (
    `${master.slice(0, open)}${style}${defs}<g class="vec">${vector.trim()}</g>` +
    `<g class="px" transform="scale(${64 / n})" shape-rendering="crispEdges">${pixelLayer(PIXEL_16)}</g></svg>\n`
  );
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** An .ico of PNG entries (every browser since IE11 reads these). */
function ico(pngs: { size: number; png: Buffer }[]): Buffer {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e);
    head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4); // planes
    head.writeUInt16LE(32, e + 6); // bpp
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.png)]);
}

async function icons(browser: Browser) {
  const svg = iconSvg();
  writeFileSync('app/icon.svg', svg);
  console.log('app/icon.svg');
  const markUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const tab = new Map<number, Buffer>();
  for (const spec of ICONS) {
    const png = recompress(await renderIcon(browser, spec, markUrl));
    if (!spec.plate) tab.set(spec.size, png);
    writeFileSync(spec.file, png);
    console.log(spec.file);
  }
  writeFileSync('app/favicon.ico', ico([16, 32, 48].map((size) => ({ size, png: tab.get(size)! }))));
  console.log('app/favicon.ico');
}

/** Every icon at actual size on light and dark, then zoomed 8× without smoothing, so the small ones can be judged pixel by pixel. */
async function preview(browser: Browser) {
  const files = [
    'shots/brand-16.png',
    'shots/brand-32.png',
    'shots/brand-48.png',
    'app/apple-icon.png',
    'public/icons/icon-192.png',
    'public/icons/maskable-512.png',
  ];
  const url = (f: string) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
  const row = (bg: string) =>
    `<div style="display:flex;gap:16px;align-items:flex-end;padding:16px;background:${bg}">${files.map((f) => `<img src="${url(f)}">`).join('')}</div>`;
  const zoom = ['shots/brand-16.png', 'shots/brand-32.png', 'shots/brand-48.png']
    .map((f, i) => `<img src="${url(f)}" style="image-rendering:pixelated;width:${[16, 32, 48][i] * 8}px">`)
    .join('');
  const page = await browser.newPage({ viewport: { width: 1200, height: 400 } });
  await page.setContent(
    `<html><body style="margin:0;font:12px monospace">${row('#dee1e6')}${row('#202124')}<div style="display:flex;gap:16px;align-items:flex-start;padding:16px;background:#888">${zoom}</div>` +
      `<div style="padding:16px;background:#fff"><img src="${url('public/icons/maskable-512.png')}" style="width:256px;clip-path:circle(40%)"></div></body></html>`,
  );
  await page.screenshot({ path: `${SHOTS}/brand-icons.png`, fullPage: true });
  await page.close();
  console.log(`${SHOTS}/brand-icons.png`);
}

/**
 * Re-encode a PNG with the strongest zlib setting. Chromium favours speed; this only changes the
 * compression, never a pixel. Handles the 8-bit RGBA/RGB non-interlaced PNGs Chromium writes.
 */
function recompress(png: Buffer): Buffer {
  const chunks: { type: string; data: Buffer }[] = [];
  for (let p = 8; p < png.length;) {
    const len = png.readUInt32BE(p);
    chunks.push({ type: png.toString('latin1', p + 4, p + 8), data: png.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  const ihdr = chunks.find((c) => c.type === 'IHDR')!.data;
  const raw = inflateSync(Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const data = deflateSync(raw, { level: 9, memLevel: 9 });
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', data), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Link previews are 1.91:1; Discord, Slack, iMessage and X all show this size uncropped. */
const OG_W = 1200;
const OG_H = 630;
const DEVICES = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5'];

/**
 * A real race from the production build, rendered at 2× and framed to 1.91:1. The runners get
 * scripted input (staggered starts, different jump rhythms) so the shot catches them spread out
 * and mid-air instead of piled on the spawn.
 */
async function raceArt(browser: Browser, base: string, pet: () => void): Promise<Buffer> {
  const seed = opt('seed', 'og2')!;
  const theme = opt('theme', 'factory')!;
  const zoom = opt('zoom', '1.8')!;
  const players = Number(opt('players', '8'));
  const frames = Number(opt('frames', '150'));
  const race = opt('race', 'saw,flail,launcher,spring,laser,crusher,platform,fan,spikestrip,wheel')!;
  const vh = Math.round(OG_W / (16 / 9));
  const page = await browser.newPage({ viewport: { width: OG_W, height: vh }, deviceScaleFactor: 2 });
  const errors: string[] = [];
  page.on('pageerror', (e: Error) => errors.push(String(e)));
  await page.goto(
    `${base}r/OGART?seed=${seed}&theme=${theme}&players=${players}&race=${race}&propseed=${opt('propseed', '1')}&ui=0&lettering=0&net=off${zoom === '0' ? '' : `&zoom=${zoom}`}`,
  );
  await page.waitForFunction(() => 'slagDebug' in window, null, { timeout: 30_000 });
  await page.evaluate(() => (window as any).slagDebug.pause(true));
  // The real-time loop ran a few frames before the pause, depending on boot time. Clock the script
  // off the race's own frame, and start it before anyone moves, so the same options give the same race.
  const start: number = await page.evaluate(() => (window as any).slagDebug.match.run?.frame ?? 0);
  if (start > 60) throw new Error(`race was ${start} frames in before the pause; the script starts runners at 70`);
  for (let f = start; f < frames; f += 10) {
    await page.evaluate(
      ([f0, n, devs]) => {
        const d = (window as any).slagDebug;
        for (let f = f0; f < Math.min(f0 + 10, n); f++) {
          const inputs: Record<string, unknown> = {};
          devs.forEach((dev, i) => {
            const t = f - 70 - i * 7;
            const period = 34 + ((i * 11) % 23);
            const phase = t % period;
            inputs[dev] = {
              left: false,
              right: t > 0,
              up: false,
              down: false,
              run: t > 0 && i % 3 !== 2,
              jump: t > 0 && phase < 14,
              jumpPressed: t > 0 && phase === 0,
              confirmPressed: false,
              altPressed: false,
              downPressed: false,
            };
          });
          d.step(1, inputs);
        }
      },
      [f, frames, DEVICES.slice(0, players)] as const,
    );
    pet();
  }
  // The race is frame-exact; the camera eases on render time, so framing can shift a few pixels between runs.
  const png = await page.screenshot({ clip: { x: 0, y: (vh - OG_H) / 2, width: OG_W, height: OG_H } });
  if (errors.length) throw new Error(`race page errors:\n${errors.join('\n')}`);
  await page.close();
  return png;
}

/**
 * One preview per kind of link: the site, and a lobby invite. Next serves each file as the
 * og:image of its route segment, so a pasted invite looks like one. (Turbopack ignores
 * opengraph-image.alt.txt, so there's none; app/site.ts carries alt text where it's set by hand.)
 */
const CARDS = [
  // The site card is the title alone; app/site.ts's description travels in the tags beside it.
  { dir: 'app', kicker: null },
  { dir: 'app/r/[room]', kicker: 'Lobby Invite · 1–8 Players' },
];

/**
 * JPEG: a fifth of the PNG's size with no visible loss at 88 on this art, and crawlers fetch it
 * cold on every unfurl. app/api/oembed/route.ts names these files, so keep the extension.
 */
async function saveCard(page: Page, dir: string): Promise<void> {
  const jpg = await page.screenshot({ type: 'jpeg', quality: 88 });
  rmSync(`${dir}/opengraph-image.png`, { force: true });
  writeFileSync(`${dir}/opengraph-image.jpg`, jpg);
  console.log(`${dir}/opengraph-image.jpg (${Math.round(jpg.length / 1024)} KB)`);
}

/**
 * The home-screen logo (its own markup and CSS, read from the running site, so the preview tracks
 * the logo) over the race art, with the soot pulled in behind it so it reads at thumbnail size.
 */
async function og(browser: Browser) {
  const pet = watchdog();
  const server = await startServer();
  try {
    const artFile = opt('art');
    const art = artFile ? readFileSync(artFile) : await raceArt(browser, server.base, pet);
    if (!artFile) writeFileSync(`${SHOTS}/brand-og-art.png`, art);
    const page = await browser.newPage({ viewport: { width: OG_W, height: OG_H } });
    await page.goto(server.base);
    await page.evaluate(() => document.fonts.ready);
    // The page's stylesheets (the fonts) and its inline styles (the game's screen CSS).
    const { brand, css, styles } = await page.evaluate(() => ({
      brand: document.querySelector('.brand')!.outerHTML,
      css: [...document.querySelectorAll<HTMLLinkElement>('link[rel=stylesheet]')].map((l) => l.href),
      styles: [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n'),
    }));
    for (const card of CARDS) {
      const kicker = card.kicker ? brand.replace(/<\/div>$/, `<div class="kicker">${card.kicker}</div></div>`) : brand;
      await page.setContent(
        `<html><head>${css.map((h) => `<link rel="stylesheet" href="${h}">`).join('')}<style>${styles}</style><style>
          body { margin: 0; width: ${OG_W}px; height: ${OG_H}px; overflow: hidden; background: #0e0806; }
          .og { position: relative; width: 100%; height: 100%; background: url(data:image/png;base64,${art.toString('base64')}) center / 100% 100%; }
          .og::before { content: ''; position: absolute; inset: 0;
            background: radial-gradient(40% 42% at 50% 40%, rgba(14, 8, 6, 0.7), rgba(14, 8, 6, 0.35) 55%, rgba(14, 8, 6, 0) 100%),
              linear-gradient(rgba(14, 8, 6, 0.25), rgba(14, 8, 6, 0) 30%, rgba(14, 8, 6, 0) 70%, rgba(14, 8, 6, 0.35)); }
          .og .brand { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; zoom: 1.3; }
          .og .logo { font-size: 150px; }
          .og .logo-drip { animation: none; }
          .og .brand { margin: 0; }
          .og .kicker { margin: 30px 0 0; display: inline-flex; align-items: center; gap: 10px; font: 800 13px/1 var(--ui);
            letter-spacing: 0.18em; text-transform: uppercase; color: var(--bone); text-shadow: 0 2px 0 var(--ink); }
          .og .kicker::before { content: ''; width: 34px; height: 8px; background: var(--tape); border: 2px solid var(--ink); }
        </style></head><body><div class="og">${kicker}</div></body></html>`,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      await saveCard(page, card.dir);
    }
    await page.close();
  } finally {
    await server.close();
  }
}

const browser = await launchBrowser();
try {
  if (task === 'icons' || task === 'all') await icons(browser);
  if (task === 'icons' || task === 'all' || task === 'preview') await preview(browser);
  if (task === 'og' || task === 'all') await og(browser);
} finally {
  await browser.close();
}
