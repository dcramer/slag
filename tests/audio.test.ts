import { describe, expect, it } from 'vitest';
import { type CueEnv, cuesForEvent, finishNotes, fireName, popName, slotPitch } from '../src/audio/cues';
import { softClipCurve, Throttle } from '../src/audio/mixer';
import { composeSong } from '../src/audio/music/compose';
import { INSTRUMENTS } from '../src/audio/music/instruments';
import { STYLES } from '../src/audio/music/styles';
import { degreeToMidi, inScale } from '../src/audio/music/theory';
import { SFX } from '../src/audio/sfx';
import { panFor, placeOneShot } from '../src/audio/spatial';
import { DEFAULT_VOLUMES, loadVolumes, saveVolumes, sliderGain, VOLUME_KEY } from '../src/audio/volumes';
import type { GameEvent } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';

const mapStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('audio volumes', () => {
  it('round-trips through storage under slag.audio.v1', () => {
    const s = mapStore();
    expect(loadVolumes(s)).toEqual(DEFAULT_VOLUMES);
    saveVolumes({ master: 0.5, music: 0.25, sfx: 1 }, s);
    expect(s.m.has(VOLUME_KEY)).toBe(true);
    expect(loadVolumes(s)).toEqual({ master: 0.5, music: 0.25, sfx: 1 });
  });
  it('sanitizes garbage', () => {
    const s = mapStore();
    s.setItem(VOLUME_KEY, '{"master": 7, "music": "x"}');
    expect(loadVolumes(s)).toEqual({ master: 1, music: DEFAULT_VOLUMES.music, sfx: DEFAULT_VOLUMES.sfx });
    s.setItem(VOLUME_KEY, 'not json');
    expect(loadVolumes(s)).toEqual(DEFAULT_VOLUMES);
  });
  it('slider taper is monotonic and silent at 0', () => {
    expect(sliderGain(0)).toBe(0);
    expect(sliderGain(1)).toBe(1);
    expect(sliderGain(0.5)).toBeLessThan(0.5);
  });
});

describe('music composer', () => {
  it('is deterministic per (seed, theme)', () => {
    for (const th of THEME_IDS) expect(composeSong(1234, th)).toEqual(composeSong(1234, th));
  });
  it('varies with the seed', () => {
    for (const th of THEME_IDS) {
      const sigs = new Set([1, 2, 3, 4, 5, 6].map((s) => JSON.stringify(composeSong(s, th).tracks.find((t) => t.layer === 'lead')!.notes)));
      expect(sigs.size, th).toBeGreaterThan(3);
    }
  });
  it('writes in-key, in-range, well-formed parts for every theme', () => {
    for (const th of THEME_IDS) {
      for (let seed = 0; seed < 20; seed++) {
        const s = composeSong(seed, th);
        const total = s.bars * s.stepsPerBar;
        expect(s.stepsPerBar).toBe(STYLES[th].stepsPerBeat * 4);
        expect(s.bpm).toBeGreaterThanOrEqual(STYLES[th].bpm[0]);
        expect(s.bpm).toBeLessThanOrEqual(STYLES[th].bpm[1]);
        for (const tr of s.tracks) {
          expect(INSTRUMENTS[tr.inst], tr.inst).toBeTypeOf('function');
          expect(tr.notes.length, `${th} ${tr.name}`).toBeGreaterThan(0);
          for (const n of tr.notes) {
            expect(n.step).toBeGreaterThanOrEqual(0);
            expect(n.step).toBeLessThan(total);
            expect(n.len).toBeGreaterThan(0);
            expect(n.vel).toBeGreaterThan(0);
            expect(n.vel).toBeLessThanOrEqual(1);
            expect(n.midi).toBeGreaterThanOrEqual(24);
            expect(n.midi).toBeLessThanOrEqual(100);
            if (tr.layer === 'lead' || tr.layer === 'harmony' || tr.layer === 'pad')
              expect(inScale(s.root, s.mode, n.midi), `${th} ${tr.name} ${n.midi}`).toBe(true);
          }
        }
        // The melody resolves to a tonic chord tone at the loop end.
        const lead = s.tracks.find((t) => t.layer === 'lead')!.notes;
        const last = lead[lead.length - 1];
        const pc = (((last.midi - s.root) % 12) + 12) % 12;
        expect([0, degreeToMidi(0, s.mode, 2) % 12, 7]).toContain(pc);
      }
    }
  });
  it('harbor is in compound time (12 steps per bar)', () => {
    expect(composeSong(9, 'harbor').stepsPerBar).toBe(12);
  });
});

const env: CueEnv = {
  theme: 'farm',
  liquid: 'water',
  pitchOf: slotPitch,
  note: (d, o = 0) => degreeToMidi(60 + 12 * o, 'ionian', d),
  placedVariant: () => 'wood',
  propPos: () => ({ x: 10, y: 20 }),
};

describe('event → sound mapping', () => {
  const events: GameEvent[] = [
    { type: 'death', slot: 0, x: 1, y: 2, cause: 'hazard', vx: 0, vy: 0 },
    { type: 'death', slot: 1, x: 1, y: 2, cause: 'fall', vx: 0, vy: 0 },
    { type: 'death', slot: 2, x: 1, y: 2, cause: 'crush', vx: 0, vy: 0 },
    { type: 'death', slot: 3, x: 1, y: 2, cause: 'pop', vx: 0, vy: 0 },
    { type: 'death', slot: 4, x: 1, y: 2, cause: 'timeout', vx: 0, vy: 0 },
    { type: 'finish', slot: 0, place: 1, x: 1, y: 2 },
    { type: 'spring', x: 1, y: 2 },
    { type: 'pop', x: 1, y: 2, ammo: 'cannonball' },
    { type: 'fire', x: 1, y: 2, angle: 0, style: 'totem' },
    { type: 'crumble-start', uid: 3 },
    { type: 'crumble-break', uid: 3 },
    { type: 'explosion', x: 1, y: 2, r: 48 },
    { type: 'place', slot: 0, x: 1, y: 2 },
    { type: 'claim', slot: 2 },
    { type: 'phase', phase: 'pick' },
  ];
  it('every event maps to known sounds', () => {
    for (const e of events) {
      const cues = cuesForEvent(e, env);
      expect(cues.length, e.type).toBeGreaterThan(0);
      for (const c of cues) expect(SFX[c.name], c.name).toBeDefined();
    }
  });
  it('death causes sound different', () => {
    const names = events.slice(0, 5).map((e) => cuesForEvent(e, env)[0].name);
    expect(new Set(names).size).toBe(5);
    expect(cuesForEvent(events[1], env)[0].variant).toBe('water');
  });
  it('launcher styles and ammo have their own voices', () => {
    const styles = ['crossbow', 'ballista', 'cannon', 'totem', 'turret', 'thrower'];
    expect(new Set(styles.map(fireName)).size).toBe(styles.length);
    const ammo = ['bolt', 'arrow', 'cannonball', 'fireball', 'plasma', 'shuriken'];
    expect(new Set(ammo.map(popName)).size).toBe(ammo.length);
  });
  it('finish flourish shrinks with place', () => {
    const n = [1, 2, 3, 4, 7].map((p) => finishNotes(p, env.note).length);
    expect(n).toEqual([4, 3, 2, 1, 1]);
  });
  it('crumble cues are positioned at the prop', () => {
    expect(cuesForEvent(events[9], env)[0]).toMatchObject({ name: 'crumble-start', x: 10, y: 20 });
  });
});

describe('mixer helpers', () => {
  it('soft clip never exceeds ±0.98 and is linear for small signals', () => {
    const c = softClipCurve(1001);
    for (const v of c) expect(Math.abs(v)).toBeLessThanOrEqual(0.98);
    expect(c[750]).toBeCloseTo(0.5, 5);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
  });
  it('throttle caps repeats per window', () => {
    const t = new Throttle();
    const ok = Array.from({ length: 10 }, () => t.allow('land', 1, 3, 0.1)).filter(Boolean).length;
    expect(ok).toBe(3);
    expect(t.allow('land', 1.2, 3, 0.1)).toBe(true);
  });
  it('pans by screen side and attenuates gently', () => {
    const L = { x: 384, y: 216, zoom: 1, runners: [] };
    expect(panFor(0, L)).toBeLessThan(-0.5);
    expect(panFor(768, L)).toBeGreaterThan(0.5);
    const near = placeOneShot(384, 216, L).gain;
    const far = placeOneShot(0, 0, L).gain;
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0.4);
  });
});
