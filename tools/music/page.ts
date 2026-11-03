/**
 * Browser half of `pnpm music`: renders a song through the real mixer and director in an
 * OfflineAudioContext. The director is pumped at suspend points every PUMP seconds, exactly as the
 * live loop pumps it every frame, so the voice limiter sees the same live-voice counts it would in play.
 */
import { composeSong } from '../../src/audio/music/compose';
import type { Mix, MixName } from '../../src/audio/music/player';
import { AudioEngine } from '../../src/audio/engine';
import type { SongId } from '../../src/audio/music/styles';

const RATE = 44100;
const PUMP = 0.05;
const LAYERS = ['pad', 'bass', 'harmony', 'lead', 'drums', 'perc'] as const;

export interface Render {
  left: string;
  right: string;
  bpm: number;
  root: number;
  mode: string;
  arrangement: string;
  played: number;
  stolen: number;
  dropped: number;
}

/** Float PCM → base64 of little-endian int16 (half the size of float over the bridge). */
function pcm16(d: Float32Array): string {
  const b = new Uint8Array(d.length * 2);
  const v = new DataView(b.buffer);
  for (let i = 0; i < d.length; i++) v.setInt16(i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

async function renderSong(
  theme: SongId,
  seed: number,
  seconds: number,
  mix: MixName,
  solo: string[] | null,
  sting: 'fanfare' | 'round' | null,
  arr: string | null,
): Promise<Render> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
  const eng = new AudioEngine(ctx, { master: 0.8, music: 0.6, sfx: 0.9 });
  const song = composeSong(seed, theme, arr ?? undefined);
  eng.music.setMix(mix, 0.01);
  eng.music.setSong(song, 0.05);
  if (solo) eng.music.current!.setMix(Object.fromEntries(LAYERS.map((l) => [l, solo.includes(l) ? 1 : 0])) as Mix, 0.01);
  for (let t = PUMP; t < seconds; t += PUMP)
    void ctx.suspend(t).then(() => {
      eng.music.pump(ctx.currentTime);
      void ctx.resume();
    });
  if (sting === 'fanfare') eng.music.fanfare();
  else if (sting === 'round') eng.music.roundSting();
  eng.music.pump(0);
  const buf = await ctx.startRendering();
  const s = eng.mixer.stats;
  return {
    left: pcm16(buf.getChannelData(0)),
    right: pcm16(buf.getChannelData(1)),
    bpm: song.bpm,
    root: song.root,
    mode: song.mode,
    arrangement: song.arrangement,
    played: s.played,
    stolen: s.stolen,
    dropped: s.dropped,
  };
}

(globalThis as unknown as { renderSong: typeof renderSong }).renderSong = renderSong;
