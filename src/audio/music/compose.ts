import { deriveSeed, Rng } from '../../core/rng';
import type { InstId } from './instruments';
import { arranged, arrangementNames, type DrumPart, type Layer, type SongId } from './styles';
import { chordDegrees, degreeToMidi, type ModeName, stableTriad } from './theory';

/**
 * Generative composer: (level seed, theme) → a 32-bar looping Song.
 * Deterministic (seeded Rng, no Math.random), so a level always has the
 * same tune and tests can pin it. The song is plain data; the sequencer
 * (player.ts) schedules it and the director fades layers in and out with
 * the match phase.
 *
 * Form: A A B A, eight bars each, so a race hears a tune rather than a riff.
 * Each section is a period: a four-bar question that ends open, then an
 * answer that repeats the question's first two bars and closes, on the tonic
 * in A and on the theme's cadence chord in B (which leads back into A).
 * Melody notes that sound on a beat are chord tones placed along an arc;
 * the notes between them step toward the next one, so lines move like a
 * singer's and never sit on a clash. Chords never land on a diminished or
 * augmented triad, and harmony and pads move to the nearest inversion
 * instead of jumping in root position.
 */

export interface NoteEv {
  /** Step within the whole loop. */
  step: number;
  midi: number;
  /** Length in steps. */
  len: number;
  vel: number;
  /** Seconds after the step (a strummed chord's later strings). */
  nudge?: number;
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
  theme: SongId;
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
  /** Which of the style's arrangements this is. */
  arrangement: string;
  /** Overall song level. */
  level: number;
}

const SECTION_BARS = 8;
const FORM = ['A', 'A', 'B', 'A'] as const;
const SONG_BARS = SECTION_BARS * FORM.length;

/** `arrangement` forces one of the style's arrangements by name (renders); otherwise the seed picks. */
export function composeSong(seed: number, theme: SongId, arrangement?: string): Song {
  const rng = new Rng(deriveSeed(seed, `music:${theme}`));
  const names = arrangementNames(theme);
  const picked = rng.pick(names);
  const st = arranged(theme, arrangement && names.includes(arrangement) ? arrangement : picked);
  const spb = st.stepsPerBeat * 4;
  const bpm = rng.int(st.bpm[0], st.bpm[1]);
  const swing = rng.range(st.swing[0], st.swing[1]);
  const root = rng.pick(st.roots);
  const mode = rng.pick(st.modes);
  const cad = st.cadence ?? 4;
  const progA = rng.pick(st.progressions).slice();
  if (rng.chance(0.3)) progA[2] = rng.pick(rng.pick(st.progressions).slice(1, 3));
  const others = st.progressions.filter((p) => p.join() !== progA.join());
  let progB = rng.pick(others.length ? others : st.progressions).slice();
  // The bridge starts away from home so it sounds like somewhere else.
  if (progB[0] === 0) progB = [...progB.slice(1), progB[0]];
  const A = [...progA, progA[0], progA[1], cad, 0];
  const B = [...progB, progB[0], progB[1], progB[2] === cad ? progB[3] : progB[2], cad];
  const chords = FORM.flatMap((f) => (f === 'A' ? A : B)).map((d) => playable(mode, d));
  const total = SONG_BARS * spb;
  const tracks: Track[] = [];
  const ctx: Ctx = { rng, spb, root, mode, chords, stepsPerBeat: st.stepsPerBeat, total };

  const mainBass = rng.pick(st.bass.patterns);
  tracks.push({
    name: 'bass',
    layer: 'bass',
    inst: st.bass.inst,
    gain: st.bass.gain,
    pan: 0,
    notes: bassLine(ctx, mainBass, rng.pick(st.bass.patterns)),
  });
  tracks.push({
    name: 'harmony',
    layer: 'harmony',
    inst: st.harmony.inst,
    gain: st.harmony.gain,
    pan: -0.2,
    notes: harmonyPart(ctx, st.harmony.pattern, st.harmony.octave, st.harmony.every ?? 2, st.harmony.inst === 'drone', !!st.harmony.strum),
  });
  if (st.pad)
    tracks.push({
      name: 'pad',
      layer: 'pad',
      inst: st.pad.inst,
      gain: st.pad.gain,
      pan: 0.15,
      notes: harmonyPart(ctx, 'sustain', st.pad.octave, 2, false, false),
    });
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
    arrangement: st.name,
    level: st.level ?? 1,
  };
}

interface Ctx {
  rng: Rng;
  spb: number;
  root: number;
  mode: ModeName;
  chords: number[];
  stepsPerBeat: 3 | 4;
  total: number;
}

/** A chord degree that can carry a bar: a diminished or augmented triad gives way to its neighbor a third away. */
function playable(mode: ModeName, d: number): number {
  const n = ((d % 7) + 7) % 7;
  for (const x of [n, (n + 5) % 7, (n + 2) % 7]) if (stableTriad(mode, x)) return x;
  return 0;
}

/** Bass-octave MIDI for a chord's root, kept within [root−5, root+7]. */
function bassRoot(c: Ctx, deg: number): number {
  const m = degreeToMidi(c.root, c.mode, deg);
  return m > c.root + 7 ? m - 12 : m;
}

function bassLine(c: Ctx, main: string, fill: string): NoteEv[] {
  const out: NoteEv[] = [];
  c.chords.forEach((deg, bar) => {
    const pat = bar % SECTION_BARS === SECTION_BARS - 1 ? fill : main;
    const next = c.chords[(bar + 1) % c.chords.length];
    const r = bassRoot(c, deg);
    const interval = (k: number) => degreeToMidi(c.root, c.mode, deg + k) - degreeToMidi(c.root, c.mode, deg);
    for (let s = 0; s < c.spb; s++) {
      const ch = pat[s % pat.length];
      if (ch === '-') {
        const last = out[out.length - 1];
        if (last) last.len++;
        continue;
      }
      let midi: number | null = null;
      if (ch === 'R') midi = r;
      else if (ch === 'F') midi = r + interval(4);
      else if (ch === 'O') midi = r + 12;
      else if (ch === 'T') midi = r + interval(2);
      else if (ch === 'A') {
        // A scale step into the next chord's root, from the side the line is on.
        const n = bassRoot(c, next);
        const step = n >= r ? -1 : 1;
        midi = n === r ? r + interval(4) : bassRoot(c, next + step) + (Math.abs(bassRoot(c, next + step) - n) > 6 ? (step > 0 ? -12 : 12) : 0);
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

/**
 * Close triad voicings, one per bar, each the inversion nearest the last one so inner voices move by
 * steps. The first sits in root position at `base`.
 */
function voiceLead(c: Ctx, base: number): number[][] {
  let prev: number[] | null = null;
  return c.chords.map((deg) => {
    const pcs = chordDegrees(deg, 3).map((d) => degreeToMidi(c.root, c.mode, d) % 12);
    let best: number[] = [];
    let bestCost = Infinity;
    for (let low = base - 5; low <= base + 7; low++) {
      if (!pcs.includes(low % 12)) continue;
      const v = [low];
      for (let k = 1; k < 3; k++) {
        let m = v[k - 1] + 1;
        while (!pcs.includes(m % 12) || v.some((x) => x % 12 === m % 12)) m++;
        v.push(m);
      }
      const rootPos = v[0] % 12 === pcs[0];
      const cost = prev ? v.reduce((a, m, i) => a + Math.abs(m - prev![i]), 0) + Math.abs(v[0] - base) * 0.15 : Math.abs(v[0] - base) + (rootPos ? 0 : 6);
      if (cost < bestCost) {
        bestCost = cost;
        best = v;
      }
    }
    prev = best;
    return best;
  });
}

/** Guitar strokes per meter: [step, velocity]; softer ones are up-strokes on the top three strings. */
const STRUMS: Record<3 | 4, [number, number][]> = {
  4: [
    [0, 1],
    [4, 0.8],
    [6, 0.6],
    [8, 0.9],
    [12, 0.8],
    [14, 0.6],
  ],
  3: [
    [0, 1],
    [3, 0.75],
    [5, 0.55],
    [6, 0.9],
    [9, 0.75],
    [11, 0.55],
  ],
};
const UP = 0.7;
/** Seconds between strings in a strum. */
const STRING_GAP = 0.012;

function harmonyPart(c: Ctx, pattern: string, octave: number, every: number, power: boolean, strum: boolean): NoteEv[] {
  const out: NoteEv[] = [];
  const base = c.root + 12 * octave;
  const roll = c.rng.pick(ROLLS);
  const arp = c.rng.pick(ARPS);
  const voiced = voiceLead(c, base);
  c.chords.forEach((deg, bar) => {
    // Drones hold root, fifth and octave; everything else plays the voice-led triad with its bottom note on top.
    const tones = power
      ? [deg, deg + 4, deg + 7].map((d) => degreeToMidi(base, c.mode, d) - (degreeToMidi(base, c.mode, deg) > base + 7 ? 12 : 0))
      : [...voiced[bar], voiced[bar][0] + 12];
    const at = (s: number, i: number, len: number, vel: number) => out.push({ step: bar * c.spb + s, midi: tones[i], len, vel });
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
    } else if (pattern === 'strum') {
      const strokes = STRUMS[c.stepsPerBeat];
      strokes.forEach(([s, vel], k) => {
        const len = (strokes[k + 1]?.[0] ?? c.spb) - s;
        for (let i = vel < UP ? 1 : 0; i < 4; i++) at(s, i, len, vel);
      });
    } else if (pattern === 'chug') {
      const r = degreeToMidi(base, c.mode, deg);
      const root = r > base + 7 ? r - 12 : r;
      for (let s = 0; s < c.spb; s += every) out.push({ step: bar * c.spb + s, midi: root, len: every, vel: s % (c.stepsPerBeat * 2) === 0 ? 1 : 0.75 });
    } else for (let i = 0; i < 3; i++) at(0, i, c.spb, 0.8);
  });
  if (strum) {
    // Down-strokes ring low to high, up-strokes high to low.
    const byStep = new Map<number, NoteEv[]>();
    for (const n of out) byStep.set(n.step, [...(byStep.get(n.step) ?? []), n]);
    for (const chord of byStep.values()) {
      chord.sort((a, b) => a.midi - b.midi);
      chord.forEach((n, i) => (n.nudge = (n.vel < UP ? chord.length - 1 - i : i) * STRING_GAP));
    }
  }
  return out;
}

// ---------------------------------------------------------------- melody

/**
 * One-bar rhythm cells: 'x' starts a note, '-' holds it, '.' rests. Phrases are built from a few of
 * them with repeats, so the rhythm is a motif rather than a coin toss per step. Cadence cells end on
 * a long note and a breath.
 */
const CELLS: Record<3 | 4, { body: string[]; cadence: string[] }> = {
  4: {
    body: [
      'x-------x-------',
      'x-------x---x---',
      'x-----x-x-------',
      'x---x---x---x---',
      'x---x---x-x-x---',
      'x-x-x---x---x---',
      'x--x--x-x-------',
      'x--x--x---x-x---',
      'x---x-x-x---x---',
      'x-x-x-x-x---x---',
      'x---x---x-x-x-x-',
      'x-x-x-x-x-x-x---',
      'x-xxx---x-xxx---',
    ],
    cadence: ['x-----------....', 'x-------x-----..', 'x---x---x-----..', 'x-x-x---x-----..', 'x--x--x-------..'],
  },
  3: {
    body: ['x-----x-----', 'x-----x--x--', 'x--x--x-----', 'x--x--x--x--', 'x-xx--x--x--', 'x--x-xx--x--', 'x-xx-xx--x--', 'x-xx-xx-xx--'],
    cadence: ['x---------..', 'x-----x---..', 'x--x--x---..', 'x-xx--x---..'],
  },
};

const onsetsIn = (cell: string) => cell.split('x').length - 1;

/** A cell whose note count suits the style's density (0.25 → about 2 notes a bar, 0.5 → about 6). */
function pickCell(c: Ctx, cells: string[], density: number): string {
  const want = 1 + density * (c.stepsPerBeat === 4 ? 10 : 7);
  return c.rng.weighted(cells.map((x) => [x, 1 / (0.6 + Math.abs(onsetsIn(x) - want))] as const));
}

interface Shape {
  /** Degree heights along the half-phrase: start, peak (at ~60%), end. */
  from: number;
  peak: number;
  to: number;
  /** How the last note lands: on the tonic, or on a tone of its bar's chord. */
  close: 'tonic' | 'open';
}

const LO = -3;
const HI = 9;

/** Chord-tone degrees of the triad on `chord` within the lead's range. */
function chordTones(chord: number): number[] {
  const out: number[] = [];
  for (const t of chordDegrees(chord, 3)) for (let o = -7; o <= 14; o += 7) if (t + o >= LO && t + o <= HI) out.push(t + o);
  return out;
}

/**
 * Melody over `cells.length` bars from `bar0`. Notes sounding on a beat are chord tones chosen
 * near an arc (with a little chance and a dislike of repeats and wide leaps); notes between them
 * step toward the next one. Returns degrees, not MIDI, so callers can reuse a half-phrase.
 */
function halfPhrase(c: Ctx, bar0: number, cells: string[], shape: Shape, prev: number | null): { step: number; deg: number; len: number; vel: number }[] {
  const notes: { step: number; len: number; strong: boolean; deg: number; vel: number }[] = [];
  cells.forEach((cell, b) => {
    for (let s = 0; s < cell.length; s++) {
      if (cell[s] !== 'x') continue;
      let len = 1;
      while (s + len < cell.length && cell[s + len] === '-') len++;
      const beat = c.stepsPerBeat;
      const strong = s % beat === 0 || Math.floor((s + len - 1) / beat) > Math.floor(s / beat);
      notes.push({ step: (bar0 + b) * c.spb + s, len, strong, deg: NaN, vel: s === 0 ? 0.95 : s % beat === 0 ? 0.85 : 0.66 + c.rng.next() * 0.1 });
    }
  });
  const n = notes.length;
  const height = (i: number) => {
    const f = n > 1 ? i / (n - 1) : 1;
    return f < 0.6 ? shape.from + (shape.peak - shape.from) * (f / 0.6) : shape.peak + (shape.to - shape.peak) * ((f - 0.6) / 0.4);
  };
  // Beats first: chord tones along the arc.
  let last = prev;
  let before: number | null = null;
  notes.forEach((nt, i) => {
    if (!nt.strong && i !== 0) return;
    const chord = c.chords[Math.floor(nt.step / c.spb)];
    let cands = chordTones(chord);
    if (i === n - 1 && shape.close === 'tonic') cands = [0, 7];
    const h = height(i);
    let best = cands[0];
    let bestScore = Infinity;
    for (const d of cands) {
      const leap = last === null ? 0 : Math.abs(d - last);
      const score = Math.abs(d - h) + (leap === 0 ? (d === before ? 3 : 1.5) : 0) + Math.max(0, leap - 4) * 0.7 + c.rng.next() * 1.1;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    nt.deg = best;
    before = last;
    last = best;
  });
  // Then the notes between beats: steps from the last note toward the next beat's note.
  let p = prev ?? notes[0].deg;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(notes[i].deg)) {
      p = notes[i].deg;
      continue;
    }
    let j = i;
    while (j < n && Number.isNaN(notes[j].deg)) j++;
    const q = j < n ? notes[j].deg : p;
    const gaps = j - i + 1;
    const dist = q - p;
    let d: number;
    if (dist === 0) d = p + (c.rng.chance(0.6) ? 1 : -1);
    else if (Math.abs(dist) === 1 && gaps === 1) d = q + Math.sign(dist);
    else d = p + Math.sign(dist) * Math.max(1, Math.round(Math.abs(dist) / gaps));
    notes[i].deg = Math.max(LO, Math.min(HI, d));
    p = notes[i].deg;
  }
  return notes.map(({ step, deg, len, vel }) => ({ step, deg, len, vel }));
}

function melody(c: Ctx, octave: number, density: number, legato: number): NoteEv[] {
  const base = c.root + 12 * octave;
  const body = CELLS[c.stepsPerBeat].body;
  const cadence = CELLS[c.stepsPerBeat].cadence;
  const cell = (d = density) => pickCell(c, body, d);
  const cadCell = () => pickCell(c, cadence, density);
  const lastDeg = (h: { deg: number }[]) => h[h.length - 1].deg;
  const shift = <T extends { step: number }>(h: T[], bars: number) => h.map((x) => ({ ...x, step: x.step + bars * c.spb }));

  /** An eight-bar period at `bar0`: question, then the question's opening again and an answer. */
  const period = (bar0: number, lift: number, close: Shape['close'], motif?: ReturnType<typeof halfPhrase>) => {
    const r1 = cell();
    const r2 = cell();
    const start = c.rng.pick([2, 4]) + lift;
    const peak = Math.min(HI - 2, start + c.rng.int(3, 5));
    const h1 = motif ?? halfPhrase(c, bar0, [r1, r2], { from: start, peak, to: peak - 1, close: 'open' }, null);
    const h2 = halfPhrase(c, bar0 + 2, [c.rng.chance(0.5) ? r1 : cell(), cadCell()], { from: lastDeg(h1), peak, to: start - 1, close: 'open' }, lastDeg(h1));
    const h3 = shift(h1, 4);
    const end = close === 'tonic' ? (lastDeg(h3) >= 4 ? 7 : 0) : 4;
    const h4 = halfPhrase(
      c,
      bar0 + 6,
      [cell(density * 0.8), cadCell()],
      { from: lastDeg(h3), peak: Math.max(lastDeg(h3), peak - 1), to: end, close },
      lastDeg(h3),
    );
    return { opening: h1, notes: [...h1, ...h2, ...h3, ...h4] };
  };

  const a1 = period(0, 0, 'tonic');
  // The second A keeps the opening and finds a new answer; the bridge sits higher and ends open.
  const a2 = period(SECTION_BARS, 0, 'tonic', shift(a1.opening, SECTION_BARS));
  const b = period(SECTION_BARS * 2, 1, 'open');
  const a3 = shift(a1.notes, SECTION_BARS * 3);
  const all = [...a1.notes, ...a2.notes, ...b.notes, ...a3];
  return all.map((x, i) => {
    const next = all[i + 1]?.step ?? c.total;
    // Cells already carry their rests; legato only shortens notes that run into the next one.
    const len = x.step + x.len >= next ? Math.max(1, Math.round(x.len * legato)) : x.len;
    return { step: x.step, midi: degreeToMidi(base, c.mode, x.deg), len, vel: x.vel };
  });
}

/** A harmonizing line a third below the lead on its beat notes, in the second A and the bridge, so the texture grows. */
function counterLine(c: Ctx, lead: NoteEv[], octaves: number): NoteEv[] {
  const from = SECTION_BARS * c.spb;
  const to = SECTION_BARS * 3 * c.spb;
  return lead
    .filter((n) => n.step >= from && n.step < to && n.step % c.stepsPerBeat === 0 && c.rng.chance(0.75))
    .map((n) => {
      const bar = Math.floor(n.step / c.spb);
      const third = snapToChord(degreeFromMidi(c, n.midi) - 2, c.chords[bar]);
      return { ...n, midi: degreeToMidi(c.root, c.mode, third) + 12 * octaves, vel: n.vel * 0.8 };
    });
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

function degreeFromMidi(c: Ctx, midi: number): number {
  for (let d = -21; d < 42; d++) if (degreeToMidi(c.root, c.mode, d) >= midi) return d;
  return 0;
}

/**
 * A drum part: one groove for the A sections and another for the bridge when the style has two.
 * The fill part plays a short fill every four bars and a longer one into each new section.
 */
function drumPart(c: Ctx, part: DrumPart, fills: boolean): NoteEv[] {
  const pat = c.rng.pick(part.patterns);
  const alt = part.patterns.length > 1 ? c.rng.pick(part.patterns.filter((p) => p !== pat)) : pat;
  const midi = part.tuned !== undefined ? bassRoot(c, part.tuned) : 60;
  const out: NoteEv[] = [];
  const beat = c.stepsPerBeat;
  for (let bar = 0; bar < SONG_BARS; bar++) {
    const groove = Math.floor(bar / SECTION_BARS) === 2 ? alt : pat;
    const inBar = bar % SECTION_BARS;
    const fillLen = !fills || part.layer !== 'drums' ? 0 : inBar === SECTION_BARS - 1 ? beat * 2 : inBar === 3 ? beat : 0;
    for (let s = 0; s < c.spb; s++) {
      let ch = groove[s % groove.length];
      if (fillLen && s >= c.spb - fillLen) {
        const k = s - (c.spb - fillLen);
        // Even steps (or every step in the last beat), rising to an accent.
        ch = s === c.spb - 1 ? 'X' : k % 2 === 0 || s >= c.spb - beat ? (k > fillLen / 2 ? 'x' : 'o') : '.';
      }
      const vel = ch === 'X' ? 1 : ch === 'x' ? 0.75 : ch === 'o' ? 0.4 : 0;
      if (vel) out.push({ step: bar * c.spb + s, midi, len: 1, vel: vel * (0.92 + c.rng.next() * 0.08) });
    }
  }
  return out;
}
