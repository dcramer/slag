import { envAHR, type Voice } from '../synth';
import { SAMPLE_SETS, type SampleSetId } from './sample-map';

/**
 * Recorded instruments (public/samples/, built by `pnpm samples` from CC0 libraries; credits in
 * public/ASSETS.md). A song asks for the sets its instruments use; until they arrive, and wherever
 * they can't (no network, a host that doesn't serve them, tests), each instrument plays its synth
 * patch instead, so the game never waits on a download and never goes silent.
 *
 * A note plays the nearest recording, repitched by playback rate and corrected by that recording's
 * measured detuning. MP3 decoders pad the start, so each buffer starts at its measured onset.
 */

let base = '/samples/';

/** Where public/samples is served, for a host that puts it elsewhere. */
export function setSampleBase(url: string): void {
  base = url.endsWith('/') ? url : `${url}/`;
}

interface Loaded {
  bufs: AudioBuffer[];
  /** Seconds of encoder padding before each buffer's onset. */
  onsets: number[];
}

const banks = new WeakMap<BaseAudioContext, Map<SampleSetId, Promise<Loaded | null> | Loaded | null>>();

function bank(ctx: BaseAudioContext) {
  let b = banks.get(ctx);
  if (!b) banks.set(ctx, (b = new Map()));
  return b;
}

/** First sample above −40 dBFS: the recording's onset (they were trimmed to it and peak at −1 dBFS before encoding). */
function onsetOf(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  const n = Math.min(d.length, Math.floor(buf.sampleRate * 0.1));
  for (let i = 0; i < n; i++) if (Math.abs(d[i]) > 0.01) return Math.max(0, i - 8) / buf.sampleRate;
  return 0;
}

async function fetchSet(ctx: BaseAudioContext, id: SampleSetId): Promise<Loaded | null> {
  const set = SAMPLE_SETS[id];
  const keys = 'notes' in set ? set.notes : Array.from({ length: set.hits }, (_, i) => i);
  try {
    const bufs = await Promise.all(
      keys.map(async (k) => {
        const r = await fetch(`${base}${id}/${k}.mp3`);
        if (!r.ok) throw new Error(`${id}/${k}: ${r.status}`);
        return ctx.decodeAudioData(await r.arrayBuffer());
      }),
    );
    return { bufs, onsets: bufs.map(onsetOf) };
  } catch {
    return null; // stays on its synth patch
  }
}

/** Start loading `ids` into `ctx`. Resolves when every one has arrived or given up; null when there's nothing to wait for. */
export function loadSamples(ctx: BaseAudioContext, ids: Iterable<SampleSetId>): Promise<void> | null {
  const b = bank(ctx);
  const can = typeof fetch === 'function' && typeof (ctx as Partial<BaseAudioContext>).decodeAudioData === 'function';
  const waits: Promise<unknown>[] = [];
  for (const id of ids) {
    if (b.has(id)) {
      const v = b.get(id);
      if (v instanceof Promise) waits.push(v);
      continue;
    }
    if (!can) {
      b.set(id, null);
      continue;
    }
    const p = fetchSet(ctx, id).then((l) => {
      b.set(id, l);
      return l;
    });
    b.set(id, p);
    waits.push(p);
  }
  return waits.length ? Promise.all(waits).then(() => undefined) : null;
}

function loaded(ctx: BaseAudioContext, id: SampleSetId): Loaded | null {
  const v = banks.get(ctx)?.get(id);
  return v && !(v instanceof Promise) ? v : null;
}

/** Same signature as a synth patch (music/instruments.ts). */
type Patch = (v: Voice, t: number, f: number, d: number) => void;

export interface SampledOpts {
  /** Held notes: the recording plays for the written length, then releases. Otherwise it rings out. */
  sustain?: boolean;
  /** Release time in seconds (default 0.12 held, 0.05 rung). */
  release?: number;
  /** Unpitched sets: the MIDI note a hit sounds as, so tuned drums follow the song (repitch kept within an octave). */
  tune?: number;
  /** Extra notes stacked on each one, in semitones (a power chord's fifth). */
  stack?: number[];
}

let roundRobin = 0;

/**
 * An instrument that plays a sample set and falls back to `synth` while the set isn't loaded.
 * Returns the patch plus the set it needs, so a song can ask for its sets up front.
 */
export function sampled(id: SampleSetId, synth: Patch, o: SampledOpts = {}): Patch & { set: SampleSetId } {
  const set = SAMPLE_SETS[id];
  const patch = (v: Voice, t: number, f: number, d: number) => {
    const l = loaded(v.ctx, id);
    if (!l) return synth(v, t, f, d);
    const midi = 69 + 12 * Math.log2(f / 440);
    for (const up of [0, ...(o.stack ?? [])]) {
      let i: number;
      let rate: number;
      if ('notes' in set) {
        i = 0;
        for (let k = 1; k < set.notes.length; k++) if (Math.abs(set.notes[k] - midi - up) < Math.abs(set.notes[i] - midi - up)) i = k;
        rate = 2 ** ((midi + up - set.notes[i] - set.cents[i] / 100) / 12);
      } else {
        i = roundRobin++ % set.hits;
        rate = o.tune === undefined ? 1 : 2 ** (Math.max(-12, Math.min(12, midi - o.tune)) / 12);
      }
      const buf = l.bufs[i];
      const ring = (buf.duration - l.onsets[i]) / rate;
      const release = o.release ?? (o.sustain ? 0.12 : 0.05);
      const dur = o.sustain ? Math.min(ring, d + release) : ring;
      const g = v.gain(v.out);
      envAHR(g.gain, t, 1, 0.004, Math.max(0, dur - release - 0.004), release);
      v.sample(buf, t, rate, dur + 0.02, g, l.onsets[i]);
    }
  };
  return Object.assign(patch, { set: id });
}
