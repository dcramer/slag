import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioContext } from '../src/audio/fake';
import { Mixer } from '../src/audio/mixer';
import { INSTRUMENTS, type InstId, sampleSets } from '../src/audio/music/instruments';
import { SAMPLE_SETS, type SampleSetId } from '../src/audio/music/sample-map';
import { loadSamples } from '../src/audio/music/sampler';
import { mtof } from '../src/audio/synth';
import { DEFAULT_VOLUMES } from '../src/audio/volumes';

const INST_IDS = Object.keys(INSTRUMENTS) as InstId[];

describe('recorded instruments', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ships every sample a set lists, and every sampled instrument names a set that exists', () => {
    for (const [id, set] of Object.entries(SAMPLE_SETS)) {
      const keys = 'notes' in set ? set.notes : Array.from({ length: set.hits }, (_, i) => i);
      if ('notes' in set) expect(set.cents.length, id).toBe(set.notes.length);
      for (const k of keys) expect(existsSync(`public/samples/${id}/${k}.mp3`), `${id}/${k}`).toBe(true);
    }
    for (const id of sampleSets(INST_IDS)) expect(SAMPLE_SETS[id], id).toBeDefined();
  });

  it('plays the synth patch until its recordings load, then the nearest recording, repitched and detune-corrected', async () => {
    const fake = new FakeAudioContext();
    const ctx = fake.asContext();
    const play = (midi: number) => {
      const v = new Mixer(ctx, DEFAULT_VOLUMES).voice({ bus: 'music', prio: 2, gain: 0.5 })!;
      fake.sources.clear();
      INSTRUMENTS.harmonica(v, 0, mtof(midi), 0.5);
      return [...fake.sources] as unknown as { constructor: { name: string }; playbackRate?: { value: number } }[];
    };

    // A context that can't decode (or a host without the files) has nothing to wait for and keeps the synth.
    expect(loadSamples(ctx, ['harmonica'])).toBeNull();
    expect(play(74).every((s) => s.constructor.name !== 'FakeBufferSource')).toBe(true);

    const fresh = new FakeAudioContext();
    Object.assign(fresh, { decodeAudioData: async () => Object.assign(fresh.createBuffer(1, 16000, 8000), { duration: 2 }) });
    vi.stubGlobal('fetch', async () => new Response(new ArrayBuffer(8)));
    await loadSamples(fresh.asContext(), ['harmonica' satisfies SampleSetId]);
    const v = new Mixer(fresh.asContext(), DEFAULT_VOLUMES).voice({ bus: 'music', prio: 2, gain: 0.5 })!;
    fresh.sources.clear();
    INSTRUMENTS.harmonica(v, 0, mtof(74), 0.5);
    const srcs = [...fresh.sources] as unknown as { constructor: { name: string }; playbackRate: { value: number } }[];
    expect(srcs.map((s) => s.constructor.name)).toEqual(['FakeBufferSource']);
    const { notes, cents } = SAMPLE_SETS.harmonica;
    const i = notes.findIndex((n) => n === 72 || n === 76);
    expect(srcs[0].playbackRate.value).toBeCloseTo(2 ** ((74 - notes[i] - cents[i] / 100) / 12), 5);
  });
});
