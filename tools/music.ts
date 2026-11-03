/**
 * Music renders: each theme's song through the real mixer in headless Chromium's OfflineAudioContext,
 * written as WAVs you can listen to, with loudness and voice-limiter numbers printed beside them.
 *
 *   pnpm music                          every theme, seed 1, 40 s at the race mix
 *   pnpm music --themes farm,title --seeds 1,2,3 --seconds 60   (title: the menu tune)
 *   pnpm music --mix calm               a phase mix from player.ts (silent, countdown, calm, build, score, drive)
 *   pnpm music --out shots/music-before
 *   pnpm music --sting fanfare          a stinger (fanfare, round) over the song's mix, from the first frame
 *   pnpm music --solo lead,bass         only these layers (pad, bass, harmony, lead, drums, perc), at full level
 *
 * Writes <out>/<theme>-<seed>.wav (default shots/music). No server: the page is a bundle of
 * tools/music/page.ts injected into about:blank.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import type { Render } from './music/page';
import type { SongId } from '../src/audio/music/styles';
import { THEME_IDS } from '../src/themes';
import { argReader, launchBrowser, watchdog } from './lib/server';

const { opt } = argReader(process.argv.slice(2));
const themes = (opt('themes') === 'all' || !opt('themes') ? THEME_IDS : opt('themes')!.split(',')) as SongId[];
const seeds = opt('seeds', '1')!.split(',').map(Number);
const seconds = Number(opt('seconds', '40'));
const mix = opt('mix', 'drive')!;
const solo = opt('solo')?.split(',') ?? null;
const sting = opt('sting') ?? null;
const outDir = resolve(opt('out', 'shots/music')!);
const RATE = 44100;

function wav(left: Buffer, right: Buffer): Buffer {
  const n = left.length / 2;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(left.readInt16LE(i * 2), i * 4);
    data.writeInt16LE(right.readInt16LE(i * 2), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Peak and loudest 3 s RMS window, in dBFS, from the left channel. */
function levels(pcm: Buffer): { peak: number; rms: number } {
  const n = pcm.length / 2;
  const win = RATE * 3;
  let peak = 0;
  let best = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const x = pcm.readInt16LE(i * 2) / 32768;
    peak = Math.max(peak, Math.abs(x));
    acc += x * x;
    if (i >= win) {
      const y = pcm.readInt16LE((i - win) * 2) / 32768;
      acc -= y * y;
      best = Math.max(best, acc / win);
    }
  }
  const db = (x: number) => (20 * Math.log10(Math.max(1e-9, x))).toFixed(1);
  return { peak: Number(db(peak)), rms: Number(db(Math.sqrt(best))) };
}

async function main() {
  const stop = watchdog(Number(process.env.SHOT_TIMEOUT ?? 600));
  const out = await build({
    configFile: false,
    logLevel: 'warn',
    build: { write: false, minify: false, lib: { entry: resolve('tools/music/page.ts'), formats: ['iife'], name: 'slagMusic' } },
  });
  const chunk = (Array.isArray(out) ? out[0] : out) as { output: { type: string; code?: string }[] };
  const code = chunk.output.find((o) => o.type === 'chunk')!.code!;
  mkdirSync(outDir, { recursive: true });
  const browser = await launchBrowser(['--autoplay-policy=no-user-gesture-required']);
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.addScriptTag({ content: code });
    for (const theme of themes)
      for (const seed of seeds) {
        const r = await page.evaluate((args) => (globalThis as unknown as { renderSong: (...a: unknown[]) => Promise<Render> }).renderSong(...args), [
          theme,
          seed,
          seconds,
          mix,
          solo,
          sting,
        ] as const);
        const L = Buffer.from(r.left, 'base64');
        const file = `${outDir}/${theme}-${seed}${solo ? `-${solo.join('+')}` : ''}${sting ? `-${sting}` : ''}.wav`;
        writeFileSync(file, wav(L, Buffer.from(r.right, 'base64')));
        const lv = levels(L);
        console.log(
          `${theme.padEnd(9)} seed ${String(seed).padEnd(4)} ${r.bpm} bpm ${r.mode.padEnd(16)} peak ${lv.peak} dB  loudest-3s ${lv.rms} dB  voices ${r.played} stolen ${r.stolen} dropped ${r.dropped}  ${file}`,
        );
      }
  } finally {
    await browser.close();
    stop();
  }
}

void main();
