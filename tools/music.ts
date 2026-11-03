/**
 * Music renders: each theme's song through the real mixer in headless Chromium's OfflineAudioContext,
 * written as WAVs you can listen to, with loudness and voice-limiter numbers printed beside them.
 *
 *   pnpm music                          every theme, seed 1, 40 s at the race mix
 *   pnpm music --themes farm,title --seeds 1,2,3 --seconds 60   (title: the menu tune)
 *   pnpm music --mix calm               a phase mix from player.ts (silent, countdown, calm, build, score, drive)
 *   pnpm music --out shots/music-before
 *   pnpm music --themes farm --arr jig  one of a theme's arrangements (default: the seed picks)
 *   pnpm music --sting fanfare          a stinger (fanfare, round) over the song's mix, from the first frame
 *   pnpm music --solo lead,bass         only these layers (pad, bass, harmony, lead, drums, perc), at full level
 *   pnpm music --sfx all                every sound effect and variant alone (or --sfx jump,land), into shots/sfx
 *
 * Writes <out>/<theme>-<seed>.wav (default shots/music). No server: the page is a bundle of
 * tools/music/page.ts injected into about:blank.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
import type { Cue } from '../src/audio/cues';
import { SFX_NAMES } from '../src/audio/sfx';
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
const arr = opt('arr') ?? null;
const sfx = opt('sfx');
const outDir = resolve(opt('out', sfx ? 'shots/sfx' : 'shots/music')!);
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

/** Every variant an effect is played with in the game (src/audio/cues.ts), so each gets heard. */
const SFX_VARIANTS: Record<string, string[]> = {
  land: ['soft', 'stone', 'metal', 'wood', 'ice', 'goo'],
  step: ['soft', 'stone', 'metal', 'wood', 'ice', 'goo'],
  splash: ['water', 'slag', 'acid', 'void', 'tar'],
  place: ['wood', 'metal', 'magic'],
  countdown: ['', 'go'],
  'ui-tick': ['', 'urgent'],
  'ui-toggle': ['on', 'off'],
};
/** Song-key notes for the musical cues, in F major as the director would hand them over. */
const SFX_NOTES: Record<string, number[]> = { finish: [65, 69, 72, 77], claim: [77, 81], place: [65, 72], join: [65, 72], countdown: [72] };

function sfxCues(names: string[]): { file: string; cue: Cue }[] {
  return names.flatMap((name) =>
    (SFX_VARIANTS[name] ?? ['']).map((variant) => {
      const notes = name === 'countdown' && variant === 'go' ? [77, 81, 84] : (SFX_NOTES[name] ?? []);
      return { file: variant ? `${name}.${variant}` : name, cue: { name, variant, notes, amount: 0.6 } as Cue };
    }),
  );
}

/** Peak and loudest `seconds` RMS window, in dBFS, from the left channel. */
function levels(pcm: Buffer, seconds = 3): { peak: number; rms: number } {
  const n = pcm.length / 2;
  const win = Math.round(RATE * seconds);
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
    // The recorded instruments, as the game's host would serve them.
    await page.route('https://samples.invalid/samples/**', (r) =>
      r.fulfill({ path: `public${new URL(r.request().url()).pathname}`, contentType: 'audio/mpeg', headers: { 'access-control-allow-origin': '*' } }),
    );
    await page.addScriptTag({ content: code });
    if (sfx) {
      for (const { file, cue } of sfxCues(sfx === 'all' ? SFX_NAMES : sfx.split(','))) {
        const r = await page.evaluate(
          ([c, sec]) => (globalThis as unknown as { renderCue: (c: Cue, s: number) => Promise<Pick<Render, 'left' | 'right'>> }).renderCue(c, sec),
          [cue, 2] as const,
        );
        const L = Buffer.from(r.left, 'base64');
        writeFileSync(`${outDir}/${file}.wav`, wav(L, Buffer.from(r.right, 'base64')));
        // Loudest 400 ms: the "momentary" window loudness meters use for short sounds.
        const lv = levels(L, 0.4);
        console.log(`${file.padEnd(20)} peak ${String(lv.peak).padStart(6)} dB  loudest-400ms ${String(lv.rms).padStart(6)} dB`);
      }
      return;
    }
    for (const theme of themes)
      for (const seed of seeds) {
        const r = await page.evaluate((args) => (globalThis as unknown as { renderSong: (...a: unknown[]) => Promise<Render> }).renderSong(...args), [
          theme,
          seed,
          seconds,
          mix,
          solo,
          sting,
          arr,
        ] as const);
        const L = Buffer.from(r.left, 'base64');
        const file = `${outDir}/${theme}${arr ? `.${arr}` : ''}-${seed}${solo ? `-${solo.join('+')}` : ''}${sting ? `-${sting}` : ''}.wav`;
        writeFileSync(file, wav(L, Buffer.from(r.right, 'base64')));
        const lv = levels(L);
        console.log(
          `${theme.padEnd(9)} seed ${String(seed).padEnd(4)} ${r.arrangement.padEnd(10)} ${r.bpm} bpm ${r.mode.padEnd(16)} peak ${lv.peak} dB  loudest-3s ${lv.rms} dB  voices ${r.played} stolen ${r.stolen} dropped ${r.dropped}  ${file}`,
        );
      }
  } finally {
    await browser.close();
    stop();
  }
}

void main();
