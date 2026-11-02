import { deriveSeed, Rng } from '../../core/rng';
import type { ThemeId } from '../../themes';
import type { InstId } from './instruments';
import { type DrumPart, type Layer, STYLES } from './styles';
import { chordDegrees, degreeToMidi, type ModeName } from './theory';

/**
 * Generative composer: (level seed, theme) → an 8-bar looping Song.
 * Deterministic (seeded Rng, no Math.random), so a level always has the
 * same tune and tests can pin it. The song is plain data; the sequencer
 * (player.ts) schedules it and the director fades layers in and out with
 * the match phase.
 *
 * Form: chords = 4-bar progression ×2 (second pass may turn around on V);
 * melody A A' B A'' where A' re-fits A's contour to the new chords and A''
 * cadences on the tonic.
 */

export interface NoteEv {
  /** Step within the whole loop. */
  step: number;
  midi: number;
  /** Length in steps. */
  len: number;
  vel: number;
}

export interface Track {
  name: string;
  layer: Layer;
  inst: InstId;
  gain: number;
  pan: number;
  notes: NoteEv[];
}

export interface Song {
  theme: ThemeId;
  seed: number;
  bpm: number;
  stepsPerBeat: number;
  stepsPerBar: number;
  bars: number;
  swing: number;
  root: number;
  mode: ModeName;
  /** Chord root scale degree per bar. */
  chords: number[];
  tracks: Track[];
  lead: InstId;
  harmony: InstId;
  space: [number, number, number];
  /** Overall song level. */
  level: number;
}

export const SONG_BARS = 8;

export function composeSong(seed: number, theme: ThemeId): Song {
  const st = STYLES[theme];
  const rng = new Rng(deriveSeed(seed, `music:${theme}`));
  const spb = st.stepsPerBeat * 4;
  const bpm = rng.int(st.bpm[0], st.bpm[1]);
  const swing = rng.range(st.swing[0], st.swing[1]);
  const root = rng.pick(st.roots);
  const mode = rng.pick(st.modes);
  const prog = rng.pick(st.progressions).slice();
  if (rng.chance(0.3)) prog[2] = rng.pick(rng.pick(st.progressions).slice(1, 3));
  const prog2 = prog.slice();
  if (rng.chance(0.5) && prog2[3] !== 4) prog2[3] = 4;
  const chords = [...prog, ...prog2];
  const total = SONG_BARS * spb;
  const tracks: Track[] = [];
  const ctx: Ctx = { rng, spb, root, mode, chords, stepsPerBeat: st.stepsPerBeat, total };

  tracks.push({
    name: 'bass',
    layer: 'bass',
    inst: st.bass.inst,
    gain: st.bass.gain,
    pan: 0,
    notes: bassLine(ctx, rng.pick(st.bass.patterns), rng.pick(st.bass.patterns)),
  });
  tracks.push({
    name: 'harmony',
    layer: 'harmony',
    inst: st.harmony.inst,
    gain: st.harmony.gain,
    pan: -0.2,
    notes: harmonyPart(ctx, st.harmony.pattern, st.harmony.octave, st.harmony.every ?? 2, st.harmony.inst === 'drone'),
  });
  if (st.pad)
    tracks.push({ name: 'pad', layer: 'pad', inst: st.pad.inst, gain: st.pad.gain, pan: 0.15, notes: harmonyPart(ctx, 'sustain', st.pad.octave, 2, false) });
  const lead = melody(ctx, st.lead.octave, st.lead.density, st.lead.legato);
  tracks.push({ name: 'lead', layer: 'lead', inst: st.lead.inst, gain: st.lead.gain, pan: 0.12, notes: lead });
  if (st.counter)
    tracks.push({
      name: 'counter',
      layer: 'harmony',
      inst: st.counter.inst,
      gain: st.counter.gain,
      pan: -0.3,
      notes: counterLine(ctx, lead, st.counter.octave - st.lead.octave),
    });
  st.drums.forEach((d, i) =>
    tracks.push({ name: `${d.inst}${i}`, layer: d.layer, inst: d.inst, gain: d.gain, pan: d.pan ?? 0, notes: drumPart(ctx, d, i === 1) }),
  );

  return {
    theme,
    seed,
    bpm,
    stepsPerBeat: st.stepsPerBeat,
    stepsPerBar: spb,
    bars: SONG_BARS,
    swing,
    root,
    mode,
    chords,
    tracks,
    lead: st.lead.inst,
    harmony: st.harmony.inst,
    space: st.space,
    level: st.level ?? 1,
  };
}

interface Ctx {
  rng: Rng;
  spb: number;
  root: number;
  mode: ModeName;
  chords: number[];
  stepsPerBeat: number;
  total: number;
}

/** Bass-octave MIDI for a chord's root, kept within [root−5, root+7]. */
function bassRoot(c: Ctx, deg: number): number {
  const m = degreeToMidi(c.root, c.mode, deg);
  return m > c.root + 7 ? m - 12 : m;
}

function bassLine(c: Ctx, main: string, fill: string): NoteEv[] {
  const out: NoteEv[] = [];
  c.chords.forEach((deg, bar) => {
    const pat = bar === c.chords.length - 1 ? fill : main;
    const next = c.chords[(bar + 1) % c.chords.length];
    const r = bassRoot(c, deg);
    for (let s = 0; s < c.spb; s++) {
      const ch = pat[s % pat.length];
      if (ch === '-') {
        const last = out[out.length - 1];
        if (last) last.len++;
        continue;
      }
      let midi: number | null = null;
      if (ch === 'R') midi = r;
      else if (ch === 'F') midi = r + (degreeToMidi(c.root, c.mode, deg + 4) - degreeToMidi(c.root, c.mode, deg));
      else if (ch === 'O') midi = r + 12;
      else if (ch === 'T') midi = r + (degreeToMidi(c.root, c.mode, deg + 2) - degreeToMidi(c.root, c.mode, deg));
      else if (ch === 'A') {
        const n = bassRoot(c, next);
        midi = n + (n > r ? -1 : 1) * (c.rng.chance(0.5) ? 1 : 2);
      }
      if (midi === null) continue;
      out.push({ step: bar * c.spb + s, midi, len: 1, vel: s === 0 ? 1 : 0.8 });
    }
  });
  // Notes ring until the next one (capped at a beat and a half).
  for (let i = 0; i < out.length; i++) {
    const nx = out[i + 1]?.step ?? c.total;
    if (out[i].len === 1) out[i].len = Math.max(1, Math.min(nx - out[i].step, c.stepsPerBeat * 1.5));
  }
  return out;
}

const ROLLS = [
  [0, 2, 1, 3, 0, 2, 1, 3],
  [0, 1, 2, 0, 1, 2, 0, 3],
  [3, 1, 0, 2, 3, 1, 0, 2],
];
const ARPS = [
  [0, 1, 2, 3, 2, 1, 0, 1],
  [0, 2, 1, 3, 1, 2, 0, 2],
  [0, 1, 2, 3, 0, 1, 2, 3],
];

function harmonyPart(c: Ctx, pattern: string, octave: number, every: number, power: boolean): NoteEv[] {
  const out: NoteEv[] = [];
  const base = c.root + 12 * octave;
  const roll = c.rng.pick(ROLLS);
  const arp = c.rng.pick(ARPS);
  c.chords.forEach((deg, bar) => {
    const degs = power ? [deg, deg + 4, deg + 7] : [...chordDegrees(deg, 3), deg + 7];
    const tones = degs.map((d) => degreeToMidi(base, c.mode, d));
    // Keep voicings near the base octave.
    const lift = tones[0] > base + 7 ? -12 : 0;
    const at = (s: number, i: number, len: number, vel: number) => out.push({ step: bar * c.spb + s, midi: tones[i] + lift, len, vel });
    if (pattern === 'roll' || pattern === 'arp' || pattern === 'alberti') {
      const seq = pattern === 'roll' ? roll : pattern === 'arp' ? arp : [0, 2, 1, 2];
      for (let s = 0, k = 0; s < c.spb; s += every, k++)
        at(s, seq[k % seq.length], every * (pattern === 'roll' ? 2 : 1), s % c.stepsPerBeat === 0 ? 0.95 : 0.7);
    } else if (pattern === 'stab') {
      for (let s = 2; s < c.spb; s += 4) for (let i = 0; i < 3; i++) at(s, i, 1, s === 10 ? 1 : 0.8);
    } else if (pattern === 'oompah') {
      for (let s = c.stepsPerBeat; s < c.spb; s += c.stepsPerBeat * 2) for (let i = 0; i < 3; i++) at(s, i, c.stepsPerBeat - 1, 0.85);
    } else if (pattern === 'pulse') {
      for (let s = 0; s < c.spb; s += 2) for (let i = 0; i < 3; i++) at(s, i, 1, s % c.stepsPerBeat === 0 ? 0.9 : 0.65);
    } else for (let i = 0; i < 3; i++) at(0, i, c.spb, 0.8);
  });
  return out;
}

/** Onsets (steps within a 2-bar motif), favoring strong beats. */
function motifRhythm(c: Ctx, density: number): number[] {
  const n = c.spb * 2;
  const on: number[] = [0];
  for (let s = 1; s < n - 1; s++) {
    const beat = s % c.stepsPerBeat === 0;
    const w = beat ? (s % (c.stepsPerBeat * 2) === 0 ? 0.85 : 0.6) : c.stepsPerBeat === 4 && s % 2 === 0 ? 0.35 : 0.12;
    if (c.rng.next() < Math.min(0.95, w * density * 1.5)) on.push(s);
  }
  return on;
}

/** Nearest chord-tone degree to `d` for the chord on `chordDeg`. */
function snapToChord(d: number, chordDeg: number): number {
  let best = d;
  let bd = Infinity;
  for (const t of chordDegrees(chordDeg, 3))
    for (let o = -14; o <= 14; o += 7) {
      const x = t + o;
      if (Math.abs(x - d) < bd) {
        bd = Math.abs(x - d);
        best = x;
      }
    }
  return best;
}

function contour(c: Ctx, len: number): number[] {
  const out: number[] = [];
  let d = c.rng.pick([0, 2, 4]);
  for (let i = 0; i < len; i++) {
    out.push(d);
    const r = c.rng.next();
    d += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.94 ? -2 : c.rng.pick([3, -3, 4]);
    if (d > 8) d -= 2;
    if (d < -2) d += 2;
  }
  return out;
}

function melody(c: Ctx, octave: number, density: number, legato: number): NoteEv[] {
  const base = c.root + 12 * octave;
  const out: NoteEv[] = [];
  const A = motifRhythm(c, density);
  const B = motifRhythm(c, density);
  const cA = contour(c, A.length);
  const cB = contour(c, B.length);
  const sections: [number[], number[], number][] = [
    [A, cA, 0],
    [A, cA.map((d) => d + c.rng.pick([0, 1, -1])), 2],
    [B, cB, 4],
    [A, cA, 6],
  ];
  for (const [rhythm, cont, bar0] of sections) {
    rhythm.forEach((s, i) => {
      const bar = bar0 + Math.floor(s / c.spb);
      const strong = s % c.stepsPerBeat === 0;
      let d = strong ? snapToChord(cont[i], c.chords[bar]) : cont[i];
      const nx = rhythm[i + 1] ?? c.spb * 2;
      let len = Math.max(1, Math.round((nx - s) * legato));
      const lastNote = bar0 === 6 && i === rhythm.length - 1;
      if (lastNote) {
        d = snapToChord(d, 0);
        len = c.spb * 2 - s;
      }
      out.push({ step: bar0 * c.spb + s, midi: degreeToMidi(base, c.mode, d), len, vel: strong ? 0.9 : 0.65 + c.rng.next() * 0.15 });
    });
  }
  return out;
}

/** A harmonizing line a third below the lead on strong beats (castle counterpoint). */
function counterLine(c: Ctx, lead: NoteEv[], octaves: number): NoteEv[] {
  return lead
    .filter((n) => n.step % c.stepsPerBeat === 0 && c.rng.chance(0.7))
    .map((n) => {
      const bar = Math.floor(n.step / c.spb);
      const third = snapToChord(degreeFromMidi(c, n.midi) - 2, c.chords[bar]);
      return { ...n, midi: degreeToMidi(c.root, c.mode, third) + 12 * octaves, vel: n.vel * 0.8 };
    });
}

function degreeFromMidi(c: Ctx, midi: number): number {
  for (let d = -21; d < 42; d++) if (degreeToMidi(c.root, c.mode, d) >= midi) return d;
  return 0;
}

function drumPart(c: Ctx, part: DrumPart, fills: boolean): NoteEv[] {
  const pat = c.rng.pick(part.patterns);
  const midi = part.tuned !== undefined ? bassRoot(c, part.tuned) : 60;
  const out: NoteEv[] = [];
  for (let bar = 0; bar < SONG_BARS; bar++) {
    for (let s = 0; s < c.spb; s++) {
      let ch = pat[s % pat.length];
      // Fill into the loop point on the second hit part.
      if (fills && bar === SONG_BARS - 1 && s >= c.spb - 4 && part.layer === 'drums') ch = s === c.spb - 1 ? 'X' : s % 2 ? 'x' : 'o';
      const vel = ch === 'X' ? 1 : ch === 'x' ? 0.75 : ch === 'o' ? 0.4 : 0;
      if (vel) out.push({ step: bar * c.spb + s, midi, len: 1, vel: vel * (0.92 + c.rng.next() * 0.08) });
    }
  }
  return out;
}
