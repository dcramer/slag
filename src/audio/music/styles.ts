import type { ThemeId } from '../../themes';
import type { InstId } from './instruments';
import type { ModeName } from './theory';

/**
 * Per-theme musical identity: tempo, meter, modes, progressions,
 * instrumentation and groove templates. The composer rolls concrete
 * songs from these with the level seed.
 *
 * Pattern strings have one char per step of a bar:
 *   drums  'X' accent, 'x' hit, 'o' ghost, '.' rest
 *   bass   'R' root, 'F' fifth, 'O' octave, 'T' third, 'A' approach (step into next chord), '.' rest, '-' hold
 */

export type HarmonyPattern = 'roll' | 'arp' | 'alberti' | 'stab' | 'oompah' | 'sustain' | 'pulse';
export type Layer = 'pad' | 'bass' | 'harmony' | 'lead' | 'drums' | 'perc';

export interface DrumPart {
  inst: InstId;
  layer: 'drums' | 'perc';
  gain: number;
  /** One of these bar patterns is rolled per song. */
  patterns: string[];
  /** Tuned drums play this scale degree (relative to the bass octave). */
  tuned?: number;
  pan?: number;
}

export interface MusicStyle {
  bpm: [number, number];
  /** 4 = straight 16ths, 3 = compound (12/8 shanty / triplet feel). */
  stepsPerBeat: 3 | 4;
  swing: [number, number];
  /** Tonic (MIDI) of the bass octave. */
  roots: number[];
  modes: ModeName[];
  /** 4-bar progressions as 0-based scale degrees. */
  progressions: number[][];
  /** The chord that leads home at the end of a phrase (default 4, the dominant): bII in phrygian, bVII in mixolydian. */
  cadence?: number;
  lead: { inst: InstId; octave: number; density: number; gain: number; legato: number };
  /** Optional answering voice that echoes the lead's phrase an octave down, on the off-phrases. */
  counter?: { inst: InstId; octave: number; gain: number };
  /** `every`: steps between harmony notes for roll/arp/alberti (default 2 = 8ths). */
  harmony: { inst: InstId; pattern: HarmonyPattern; octave: number; gain: number; every?: number };
  bass: { inst: InstId; patterns: string[]; gain: number };
  pad?: { inst: InstId; octave: number; gain: number };
  drums: DrumPart[];
  /** Mixer space: reverb return, echo amount, echo time. */
  space: [number, number, number];
  /** Song level trim (measured offline so themes sit at similar loudness). */
  level?: number;
}

const FOUR = 'X...x...X...x...';

export const STYLES: Record<ThemeId, MusicStyle> = {
  // Banjo rolls, upright bass two-feel, tin whistle, brushes + shaker. Sunny major.
  farm: {
    bpm: [112, 128],
    stepsPerBeat: 4,
    swing: [0.08, 0.16],
    roots: [43, 45, 48, 50],
    modes: ['ionian', 'mixolydian', 'ionian'],
    progressions: [
      [0, 3, 4, 0],
      [0, 0, 3, 4],
      [0, 4, 5, 3],
      [0, 3, 0, 4],
    ],
    lead: { inst: 'whistle', octave: 2, density: 0.45, gain: 0.13, legato: 0.85 },
    harmony: { inst: 'banjo', pattern: 'roll', octave: 1, gain: 0.254 },
    bass: { inst: 'upright', patterns: ['R...F...R...F...', 'R.....F.R...F.A.', 'R...F...O...F...'], gain: 0.217 },
    drums: [
      { inst: 'softkick', layer: 'drums', gain: 0.549, patterns: ['X.......x.......', 'X.......X...x...'] },
      { inst: 'brush', layer: 'drums', gain: 0.206, patterns: ['....X.......X...', '....X..o....X..o'] },
      { inst: 'shaker', layer: 'perc', gain: 0.12, patterns: ['x.o.x.o.x.o.x.o.', 'xoxoxoxoxoxoxoxo'], pan: 0.3 },
    ],
    space: [0.18, 0, 0.25],
    level: 1.06,
  },
  // Acid bass, offbeat stabs, square lead, anvil + steam hits. Driving minor.
  factory: {
    bpm: [118, 132],
    stepsPerBeat: 4,
    swing: [0, 0.03],
    roots: [40, 41, 43, 45],
    modes: ['aeolian', 'phrygian', 'dorian'],
    progressions: [
      [0, 0, 5, 4],
      [0, 1, 0, 6],
      [0, 5, 3, 4],
      [0, 0, 6, 5],
    ],
    cadence: 6,
    lead: { inst: 'squarelead', octave: 2, density: 0.5, gain: 0.07, legato: 0.6 },
    harmony: { inst: 'stab', pattern: 'stab', octave: 1, gain: 0.0773 },
    bass: { inst: 'acid', patterns: ['R.RR.R.RR.R.O.R.', 'R..R..R.R..R..O.', 'RRR.RR.RRRR.RO.R'], gain: 0.0671 },
    drums: [
      { inst: 'kick', layer: 'drums', gain: 0.225, patterns: [FOUR.replace(/x/g, 'X'), 'X...X...X...X..x', 'X..xX...X..xX...'] },
      { inst: 'snare', layer: 'drums', gain: 0.0964, patterns: ['....X.......X...', '....X.......X..o'] },
      { inst: 'hat', layer: 'drums', gain: 0.0321, patterns: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'] },
      { inst: 'anvil', layer: 'perc', gain: 0.0482, patterns: ['......x.......x.', '...x.......x....'], pan: -0.35 },
      { inst: 'steam', layer: 'perc', gain: 0.0375, patterns: ['x...............', '........x.......'], pan: 0.4 },
    ],
    space: [0.24, 0.08, 0.19],
    level: 1.84,
  },
  // Harpsichord alberti, organ lead + pad, timpani & march snare. Baroque minor.
  castle: {
    bpm: [96, 112],
    stepsPerBeat: 4,
    swing: [0, 0.02],
    roots: [38, 40, 43, 45],
    modes: ['harmonicMinor', 'aeolian', 'dorian'],
    progressions: [
      [0, 3, 4, 0],
      [0, 5, 3, 4],
      [0, 6, 5, 4],
      [0, 3, 6, 4],
    ],
    lead: { inst: 'organ', octave: 2, density: 0.4, gain: 0.08, legato: 0.95 },
    counter: { inst: 'harpsichord', octave: 1, gain: 0.108 },
    harmony: { inst: 'harpsichord', pattern: 'alberti', octave: 1, gain: 0.124 },
    bass: { inst: 'organbass', patterns: ['R.......F.......', 'R...R...F...A...', 'R...O...F...R...'], gain: 0.0545 },
    pad: { inst: 'organ', octave: 1, gain: 0.0152 },
    drums: [
      { inst: 'timpani', layer: 'drums', gain: 0.221, patterns: ['X...........x...', 'X.......x...x...'], tuned: 0 },
      { inst: 'snare', layer: 'drums', gain: 0.0662, patterns: ['....x.......xoxo', '....x.oo....x...'] },
      { inst: 'tambourine', layer: 'perc', gain: 0.0368, patterns: ['....x.......x...'], pan: 0.3 },
    ],
    space: [0.42, 0.06, 0.28],
    level: 1.59,
  },
  // Marimba arps, wooden bass, flute, congas/bongos/shaker. Swinging dorian.
  jungle: {
    bpm: [104, 120],
    stepsPerBeat: 4,
    swing: [0.12, 0.2],
    roots: [41, 43, 45, 46],
    modes: ['dorian', 'mixolydian', 'ionian'],
    progressions: [
      [0, 3, 0, 4],
      [0, 6, 3, 0],
      [0, 3, 5, 4],
      [0, 1, 3, 0],
    ],
    cadence: 3,
    lead: { inst: 'flute', octave: 2, density: 0.42, gain: 0.11, legato: 0.8 },
    harmony: { inst: 'marimba', pattern: 'arp', octave: 1, gain: 0.151 },
    bass: { inst: 'woodbass', patterns: ['R..F..R...R.F..A', 'R...F.R...O.F...', 'R..R..F...R..A..'], gain: 0.285 },
    drums: [
      { inst: 'softkick', layer: 'drums', gain: 0.457, patterns: ['X......x..X.....', 'X.....x...X.....'] },
      { inst: 'conga', layer: 'drums', gain: 0.244, patterns: ['...x..x....x.xx.', '..x..x.x..x..x..'], pan: -0.3 },
      { inst: 'bongo', layer: 'perc', gain: 0.183, patterns: ['x.oxo.x.x.oxo.xo', '.x.x..x..x.x..xx'], pan: 0.35 },
      { inst: 'shaker', layer: 'perc', gain: 0.0915, patterns: ['xoxoxoxoxoxoxoxo'], pan: 0.15 },
    ],
    space: [0.26, 0, 0.25],
    level: 1.27,
  },
  // Low fifth drones, brass calls, sub bass, taiko. Phrygian menace.
  volcano: {
    bpm: [88, 104],
    stepsPerBeat: 4,
    swing: [0, 0.02],
    roots: [36, 38, 40, 41],
    modes: ['phrygian', 'phrygianDominant', 'aeolian'],
    progressions: [
      [0, 1, 0, 6],
      [0, 0, 1, 0],
      [0, 5, 1, 0],
      [0, 6, 5, 1],
    ],
    cadence: 1,
    lead: { inst: 'brass', octave: 2, density: 0.3, gain: 0.08, legato: 0.95 },
    harmony: { inst: 'drone', pattern: 'sustain', octave: 1, gain: 0.044 },
    bass: { inst: 'sub', patterns: ['R.......R...R...', 'R-------R.....F.', 'R.....R.R.......'], gain: 0.0606 },
    drums: [
      { inst: 'taiko', layer: 'drums', gain: 0.255, patterns: ['X.....x.X...x...', 'X..x..X.X.....x.', 'X.......X.x.x...'], tuned: 0 },
      { inst: 'rim', layer: 'drums', gain: 0.0403, patterns: ['..x...x...x...x.', '....x.......x.x.'] },
      { inst: 'tom', layer: 'perc', gain: 0.0941, patterns: ['..............xx', '.........x....x.'], tuned: 4, pan: 0.3 },
    ],
    space: [0.34, 0.05, 0.37],
    level: 1.56,
  },
  // Accordion oompah in 12/8, tuba bass, stomps + tambourine. Sea-shanty dorian.
  harbor: {
    bpm: [76, 88],
    stepsPerBeat: 3,
    swing: [0, 0],
    roots: [41, 43, 45, 46],
    modes: ['dorian', 'aeolian', 'ionian'],
    progressions: [
      [0, 6, 0, 4],
      [0, 3, 6, 0],
      [0, 0, 6, 4],
      [0, 5, 6, 4],
    ],
    cadence: 6,
    lead: { inst: 'accordion', octave: 2, density: 0.5, gain: 0.07, legato: 0.85 },
    harmony: { inst: 'accordion', pattern: 'oompah', octave: 1, gain: 0.0312 },
    bass: { inst: 'tuba', patterns: ['R.....F.....', 'R.....F..A..', 'R..R..F.....'], gain: 0.0263 },
    drums: [
      { inst: 'stomp', layer: 'drums', gain: 0.224, patterns: ['X.....x.....', 'X.....X..x..'] },
      { inst: 'clap', layer: 'drums', gain: 0.0841, patterns: ['...x.....x..', '...x.....x.x'] },
      { inst: 'tambourine', layer: 'perc', gain: 0.0491, patterns: ['x..x..x..x..', 'x.ox.ox.ox.o'], pan: 0.3 },
    ],
    space: [0.22, 0.04, 0.3],
    level: 4.01,
  },
  // Glassy FM bells, dark pads, plucked bass, echoing pickaxe clanks and drips. Minor.
  mine: {
    bpm: [84, 100],
    stepsPerBeat: 4,
    swing: [0.04, 0.1],
    roots: [38, 40, 41, 43],
    modes: ['aeolian', 'phrygian', 'dorian'],
    progressions: [
      [0, 5, 3, 4],
      [0, 6, 5, 6],
      [0, 3, 0, 5],
      [0, 0, 5, 6],
    ],
    cadence: 6,
    lead: { inst: 'bell', octave: 2, density: 0.28, gain: 0.07, legato: 0.6 },
    harmony: { inst: 'darkpad', pattern: 'sustain', octave: 1, gain: 0.0189 },
    bass: { inst: 'pluckbass', patterns: ['R.......F.......', 'R.....R...F.....', 'R...R.......A...'], gain: 0.117 },
    drums: [
      { inst: 'softkick', layer: 'drums', gain: 0.151, patterns: ['X.........x.....', 'X.......X.......'] },
      { inst: 'rim', layer: 'drums', gain: 0.0303, patterns: ['....x.......x...', '....x.....x.x...'] },
      { inst: 'clank', layer: 'perc', gain: 0.0353, patterns: ['......x.......x.', '..x.......x.....'], pan: -0.4 },
      { inst: 'drip', layer: 'perc', gain: 0.0252, patterns: ['.........x......', '...x...........x'], pan: 0.45 },
    ],
    space: [0.42, 0.24, 0.38],
    level: 5.13,
  },
  // Synthwave: gated snares, 8th-note octave bass, saw lead, square arps, wide pads.
  rooftops: {
    bpm: [96, 112],
    stepsPerBeat: 4,
    swing: [0, 0],
    roots: [40, 41, 43, 45],
    modes: ['aeolian', 'dorian', 'lydian'],
    progressions: [
      [0, 5, 2, 6],
      [0, 3, 5, 4],
      [5, 3, 0, 4],
      [0, 6, 5, 6],
    ],
    cadence: 6,
    lead: { inst: 'synthlead', octave: 2, density: 0.38, gain: 0.065, legato: 0.9 },
    harmony: { inst: 'syntharp', pattern: 'arp', octave: 2, gain: 0.0547, every: 1 },
    bass: { inst: 'synthbass', patterns: ['R.R.R.R.R.R.R.O.', 'R.RRR.RRR.RRR.RO', 'O.R.R.R.O.R.R.R.'], gain: 0.0375 },
    pad: { inst: 'synthpad', octave: 1, gain: 0.0158 },
    drums: [
      { inst: 'kick', layer: 'drums', gain: 0.143, patterns: ['X.......X.......', 'X...X...X...X...', 'X.......X.x.....'] },
      { inst: 'gatedsnare', layer: 'drums', gain: 0.0639, patterns: ['....X.......X...'] },
      { inst: 'hat', layer: 'drums', gain: 0.0188, patterns: ['x.x.x.x.x.x.x.x.', '..x...x...x...x.'] },
      { inst: 'clap', layer: 'perc', gain: 0.0263, patterns: ['....x.......x...', '............x...'], pan: 0.2 },
    ],
    space: [0.38, 0.1, 0.375],
    level: 3.34,
  },
  // Thin air: glassy bell arps, a breathy flute, a slow plucked bass, icicle plinks and a shaker. Lydian sparkle.
  glacier: {
    bpm: [86, 100],
    stepsPerBeat: 4,
    swing: [0.02, 0.08],
    roots: [40, 42, 43, 45],
    modes: ['lydian', 'ionian', 'dorian'],
    progressions: [
      [0, 4, 5, 3],
      [0, 1, 0, 4],
      [0, 5, 1, 4],
      [3, 4, 0, 0],
    ],
    cadence: 1,
    lead: { inst: 'flute', octave: 2, density: 0.32, gain: 0.07, legato: 0.85 },
    harmony: { inst: 'bell', pattern: 'arp', octave: 2, gain: 0.0555, every: 2 },
    bass: { inst: 'pluckbass', patterns: ['R.......R.......', 'R.......F.......', 'R...........A...'], gain: 0.254 },
    pad: { inst: 'synthpad', octave: 1, gain: 0.0357 },
    drums: [
      { inst: 'softkick', layer: 'drums', gain: 0.285, patterns: ['X.......X.......', 'X...........x...'] },
      { inst: 'shaker', layer: 'drums', gain: 0.0508, patterns: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'] },
      { inst: 'drip', layer: 'perc', gain: 0.061, patterns: ['.......x.......x', '...x.......x....'], pan: 0.4 },
    ],
    space: [0.46, 0.18, 0.42],
    level: 2.16,
  },
  // Retro sci-fi: a square-wave lead over arpeggios, a pulsing sub, a wide pad, dry kick and hats. Mixolydian wonder.
  space: {
    bpm: [100, 116],
    stepsPerBeat: 4,
    swing: [0, 0.03],
    roots: [38, 40, 41, 43],
    modes: ['mixolydian', 'lydian', 'dorian'],
    progressions: [
      [0, 6, 3, 0],
      [0, 3, 6, 4],
      [0, 1, 6, 0],
      [5, 6, 0, 0],
    ],
    cadence: 6,
    lead: { inst: 'squarelead', octave: 2, density: 0.36, gain: 0.055, legato: 0.8 },
    counter: { inst: 'bell', octave: 1, gain: 0.0774 },
    harmony: { inst: 'syntharp', pattern: 'arp', octave: 2, gain: 0.0774, every: 1 },
    bass: { inst: 'sub', patterns: ['R...R...R...R...', 'R.R...R.R...R.F.', 'R.......R...O...'], gain: 0.0419 },
    pad: { inst: 'synthpad', octave: 1, gain: 0.0254 },
    drums: [
      { inst: 'kick', layer: 'drums', gain: 0.19, patterns: ['X.......X.......', 'X.....X.X.......'] },
      { inst: 'hat', layer: 'drums', gain: 0.0251, patterns: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'] },
      { inst: 'rim', layer: 'perc', gain: 0.039, patterns: ['....x.......x...', '....x.....x.x...'], pan: -0.3 },
    ],
    space: [0.44, 0.26, 0.45],
    level: 2.15,
  },
};

/**
 * The title tune: what plays on the main menu, the lobby list, the codex and Settings, before any
 * level has a theme. Belongs to no theme, so it borrows from several: a bright square hook over
 * marimba arpeggios, a plucked bass and a light kit. Major and bouncy.
 */
export const TITLE_STYLE: MusicStyle = {
  bpm: [116, 116],
  stepsPerBeat: 4,
  swing: [0.06, 0.06],
  roots: [41],
  modes: ['ionian'],
  progressions: [
    [0, 4, 5, 3],
    [5, 3, 0, 4],
  ],
  lead: { inst: 'squarelead', octave: 2, density: 0.42, gain: 0.06, legato: 0.75 },
  harmony: { inst: 'marimba', pattern: 'arp', octave: 2, gain: 0.096 },
  bass: { inst: 'pluckbass', patterns: ['R.....R...R.F...', 'R...F...O...F.A.'], gain: 0.252 },
  pad: { inst: 'synthpad', octave: 1, gain: 0.029 },
  drums: [
    { inst: 'softkick', layer: 'drums', gain: 0.261, patterns: ['X.......X.....x.', 'X.....x.X.......'] },
    { inst: 'snare', layer: 'drums', gain: 0.07, patterns: ['....X.......X...', '....X.......X..o'] },
    { inst: 'shaker', layer: 'perc', gain: 0.052, patterns: ['x.o.x.o.x.o.x.o.'], pan: 0.25 },
  ],
  space: [0.3, 0.08, 0.26],
  level: 2.04,
};

/** The title tune's seed: one fixed tune, so the menu always sounds like the same game. */
export const TITLE_SEED = 2;

/** A song's identity: a level theme, or the title tune. */
export type SongId = ThemeId | 'title';

export const songStyle = (id: SongId): MusicStyle => (id === 'title' ? TITLE_STYLE : STYLES[id]);
