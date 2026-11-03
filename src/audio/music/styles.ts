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

/** `strum`: guitar down/up strokes. `chug`: the chord's root on every eighth (power chords). */
export type HarmonyPattern = 'roll' | 'arp' | 'alberti' | 'stab' | 'oompah' | 'sustain' | 'pulse' | 'strum' | 'chug';
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
  /** What this arrangement is, for renders and diagnostics. */
  name: string;
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
  /** `every`: steps between harmony notes for roll/arp/alberti (default 2 = 8ths). `strum`: a chord's notes roll across ~35 ms like a pick across strings. */
  harmony: { inst: InstId; pattern: HarmonyPattern; octave: number; gain: number; every?: number; strum?: boolean };
  bass: { inst: InstId; patterns: string[]; gain: number };
  pad?: { inst: InstId; octave: number; gain: number };
  drums: DrumPart[];
  /** Mixer space: reverb return, echo amount, echo time. */
  space: [number, number, number];
  /** Song level trim (measured offline so themes sit at similar loudness). */
  level?: number;
  /**
   * Other ways the same theme can sound, each as true to it as the first: the seed picks one of these
   * or the style itself, so two farms needn't share a band. Fields left out come from the style.
   */
  arrangements?: Arrangement[];
}

/** A theme's other arrangement: overrides on its style. `counter: undefined` or `pad: undefined` drops that part. */
export type Arrangement = Partial<Omit<MusicStyle, 'arrangements'>> & { name: string };

const FOUR = 'X...x...X...x...';

export const STYLES: Record<ThemeId, MusicStyle> = {
  // Banjo rolls, upright bass two-feel, tin whistle, brushes + shaker. Sunny major.
  farm: {
    name: 'reel',
    bpm: [112, 128],
    stepsPerBeat: 4,
    swing: [0.08, 0.16],
    roots: [43, 45, 48, 50],
    modes: ['mixolydian', 'dorian', 'ionian'],
    progressions: [
      [0, 3, 4, 0],
      [0, 0, 3, 4],
      [0, 4, 5, 3],
      [0, 3, 0, 4],
    ],
    lead: { inst: 'harmonica', octave: 2, density: 0.45, gain: 0.13, legato: 0.85 },
    harmony: { inst: 'banjo', pattern: 'roll', octave: 1, gain: 0.045 },
    bass: { inst: 'upright', patterns: ['R...F...R...F...', 'R.....F.R...F.A.', 'R...F...O...F...'], gain: 0.101 },
    drums: [
      { inst: 'softkick', layer: 'drums', gain: 0.177, patterns: ['X.......x.......', 'X.......X...x...'] },
      { inst: 'brush', layer: 'drums', gain: 0.0664, patterns: ['....X.......X...', '....X..o....X..o'] },
      { inst: 'shaker', layer: 'perc', gain: 0.0387, patterns: ['x.o.x.o.x.o.x.o.', 'xoxoxoxoxoxoxoxo'], pan: 0.3 },
    ],
    space: [0.18, 0, 0.25],
    level: 2.51,
    arrangements: [
      // A 12/8 barn-dance jig: fiddle over strummed guitar and a bodhrán.
      {
        name: 'jig',
        bpm: [100, 112],
        stepsPerBeat: 3,
        swing: [0, 0],
        modes: ['dorian', 'mixolydian'],
        lead: { inst: 'fiddle', octave: 2, density: 0.55, gain: 0.06, legato: 0.9 },
        harmony: { inst: 'guitar', pattern: 'strum', octave: 1, gain: 0.0177, strum: true },
        bass: { inst: 'upright', patterns: ['R.....F.....', 'R..F..R..F..', 'R.....F..A..'], gain: 0.0482 },
        drums: [
          { inst: 'bodhran', layer: 'drums', gain: 0.0658, patterns: ['X..x..X..x..', 'X.xx..X.xx..'] },
          { inst: 'brush', layer: 'drums', gain: 0.022, patterns: ['...x.....x..', '...x..o..x..'] },
          { inst: 'shaker', layer: 'perc', gain: 0.0132, patterns: ['x.ox.ox.ox.o'], pan: 0.3 },
        ],
        level: 6.24,
      },
    ],
  },
  // Acid bass, offbeat stabs, square lead, anvil + steam hits. Driving minor.
  factory: {
    name: 'acid',
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
    harmony: { inst: 'stab', pattern: 'stab', octave: 1, gain: 0.0753 },
    bass: { inst: 'acid', patterns: ['R.RR.R.RR.R.O.R.', 'R..R..R.R..R..O.', 'RRR.RR.RRRR.RO.R'], gain: 0.0664 },
    drums: [
      { inst: 'kick', layer: 'drums', gain: 0.211, patterns: [FOUR.replace(/x/g, 'X'), 'X...X...X...X..x', 'X..xX...X..xX...'] },
      { inst: 'snare', layer: 'drums', gain: 0.0903, patterns: ['....X.......X...', '....X.......X..o'] },
      { inst: 'hat', layer: 'drums', gain: 0.0301, patterns: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'] },
      { inst: 'anvil', layer: 'perc', gain: 0.0452, patterns: ['......x.......x.', '...x.......x....'], pan: -0.35 },
      { inst: 'steam', layer: 'perc', gain: 0.0351, patterns: ['x...............', '........x.......'], pan: 0.4 },
    ],
    space: [0.24, 0.08, 0.19],
    level: 1.93,
    arrangements: [
      // Clockwork: a toy factory of celesta arpeggios, plucked bass, ticking rims and a brass tune.
      {
        name: 'clockwork',
        bpm: [104, 116],
        swing: [0, 0.02],
        modes: ['aeolian', 'dorian', 'harmonicMinor'],
        cadence: 4,
        lead: { inst: 'brass', octave: 2, density: 0.36, gain: 0.07, legato: 0.8 },
        harmony: { inst: 'celesta', pattern: 'arp', octave: 2, gain: 0.0349, every: 1 },
        bass: { inst: 'pluckbass', patterns: ['R...F...R...F...', 'R.R.F...R.R.F.A.'], gain: 0.0598 },
        drums: [
          { inst: 'softkick', layer: 'drums', gain: 0.106, patterns: ['X.......X.......', 'X.....x.X.......'] },
          { inst: 'rim', layer: 'drums', gain: 0.0212, patterns: ['x.x.x.x.x.x.x.x.', 'x...x...x...x...'] },
          { inst: 'clank', layer: 'perc', gain: 0.0212, patterns: ['....x.......x...'], pan: -0.3 },
          { inst: 'steam', layer: 'perc', gain: 0.0177, patterns: ['..............x.'], pan: 0.4 },
        ],
        space: [0.22, 0.05, 0.2],
        level: 3.6,
      },
    ],
  },
  // Harpsichord alberti, organ lead + pad, timpani & march snare. Baroque minor.
  castle: {
    name: 'baroque',
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
    counter: { inst: 'harpsichord', octave: 1, gain: 0.0334 },
    harmony: { inst: 'harpsichord', pattern: 'alberti', octave: 1, gain: 0.0383 },
    bass: { inst: 'organbass', patterns: ['R.......F.......', 'R...R...F...A...', 'R...O...F...R...'], gain: 0.0713 },
    pad: { inst: 'organ', octave: 1, gain: 0.017 },
    drums: [
      { inst: 'timpani', layer: 'drums', gain: 0.105, patterns: ['X...........x...', 'X.......x...x...'], tuned: 0 },
      { inst: 'snare', layer: 'drums', gain: 0.0315, patterns: ['....x.......xoxo', '....x.oo....x...'] },
      { inst: 'tambourine', layer: 'perc', gain: 0.0175, patterns: ['....x.......x...'], pan: 0.3 },
    ],
    space: [0.42, 0.06, 0.28],
    level: 3.44,
    arrangements: [
      // Minstrels in the great hall: recorder over lute triplets, a frame drum and a tambourine, in 12/8.
      {
        name: 'minstrel',
        bpm: [84, 96],
        stepsPerBeat: 3,
        swing: [0, 0],
        modes: ['dorian', 'aeolian'],
        lead: { inst: 'recorder', octave: 2, density: 0.5, gain: 0.1, legato: 0.85 },
        counter: undefined,
        harmony: { inst: 'lute', pattern: 'roll', octave: 1, gain: 0.0453, every: 1 },
        bass: { inst: 'woodbass', patterns: ['R.....F.....', 'R.....R..F..'], gain: 0.109 },
        pad: undefined,
        drums: [
          { inst: 'bodhran', layer: 'drums', gain: 0.216, patterns: ['X.....x..x..', 'X..x..X.....'] },
          { inst: 'tambourine', layer: 'drums', gain: 0.036, patterns: ['...x.....x..', '...x..x..x.x'] },
        ],
        level: 2.41,
      },
    ],
  },
  // Marimba arps, wooden bass, flute, congas/bongos/shaker. Swinging dorian.
  jungle: {
    name: 'marimba',
    bpm: [104, 120],
    stepsPerBeat: 4,
    swing: [0.12, 0.2],
    roots: [41, 43, 45, 46],
    modes: ['dorian', 'aeolian', 'mixolydian'],
    progressions: [
      [0, 3, 0, 4],
      [0, 6, 3, 0],
      [0, 3, 5, 4],
      [0, 1, 3, 0],
    ],
    cadence: 3,
    lead: { inst: 'flute', octave: 2, density: 0.42, gain: 0.11, legato: 0.8 },
    harmony: { inst: 'marimba', pattern: 'arp', octave: 1, gain: 0.0304 },
    bass: { inst: 'woodbass', patterns: ['R..F..R...R.F..A', 'R...F.R...O.F...', 'R..R..F...R..A..'], gain: 0.076 },
    drums: [
      { inst: 'softkick', layer: 'drums', gain: 0.148, patterns: ['X......x..X.....', 'X.....x...X.....'] },
      { inst: 'conga', layer: 'drums', gain: 0.0792, patterns: ['...x..x....x.xx.', '..x..x.x..x..x..'], pan: -0.3 },
      { inst: 'bongo', layer: 'perc', gain: 0.0594, patterns: ['x.oxo.x.x.oxo.xo', '.x.x..x..x.x..xx'], pan: 0.35 },
      { inst: 'shaker', layer: 'perc', gain: 0.0297, patterns: ['xoxoxoxoxoxoxoxo'], pan: 0.15 },
    ],
    space: [0.26, 0, 0.25],
    level: 2.54,
    arrangements: [
      // Exotica: kalimba arpeggios, an ocarina, a talking drum and bongos.
      {
        name: 'exotica',
        bpm: [96, 108],
        swing: [0.1, 0.16],
        modes: ['dorian', 'mixolydian'],
        lead: { inst: 'ocarina', octave: 2, density: 0.38, gain: 0.1, legato: 0.85 },
        harmony: { inst: 'kalimba', pattern: 'arp', octave: 2, gain: 0.0797 },
        bass: { inst: 'woodbass', patterns: ['R...R.F...R.F...', 'R..R..F.R..R..F.'], gain: 0.0932 },
        drums: [
          { inst: 'talkdrum', layer: 'drums', gain: 0.156, patterns: ['X..x..x.X..x....', 'X.x...x.X.x..x..'], tuned: 0 },
          { inst: 'shaker', layer: 'drums', gain: 0.0465, patterns: ['xoxoxoxoxoxoxoxo'] },
          { inst: 'bongo', layer: 'perc', gain: 0.0774, patterns: ['...x.x.....x.x..'], pan: 0.35 },
        ],
        level: 2.23,
      },
    ],
  },
  // Low fifth drones, brass calls, sub bass, taiko. Phrygian menace.
  volcano: {
    name: 'taiko',
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
    harmony: { inst: 'drone', pattern: 'sustain', octave: 1, gain: 0.0268 },
    bass: { inst: 'sub', patterns: ['R.......R...R...', 'R-------R.....F.', 'R.....R.R.......'], gain: 0.0374 },
    drums: [
      { inst: 'taiko', layer: 'drums', gain: 0.159, patterns: ['X.....x.X...x...', 'X..x..X.X.....x.', 'X.......X.x.x...'], tuned: 0 },
      { inst: 'rim', layer: 'drums', gain: 0.0252, patterns: ['..x...x...x...x.', '....x.......x.x.'] },
      { inst: 'tom', layer: 'perc', gain: 0.0588, patterns: ['..............xx', '.........x....x.'], tuned: 4, pan: 0.3 },
    ],
    space: [0.34, 0.05, 0.37],
    level: 2.74,
    arrangements: [
      // The boss fight: chugging overdriven power chords, a screaming lead, eighth-note kicks.
      {
        name: 'boss',
        bpm: [136, 150],
        swing: [0, 0],
        modes: ['phrygian', 'phrygianDominant', 'harmonicMinor'],
        lead: { inst: 'synthlead', octave: 2, density: 0.4, gain: 0.06, legato: 0.9 },
        harmony: { inst: 'powerchord', pattern: 'chug', octave: 0, gain: 0.0279 },
        bass: { inst: 'sub', patterns: ['R.R.R.R.R.R.R.R.', 'R.RRR.RRR.RRR.R.'], gain: 0.0248 },
        drums: [
          { inst: 'kick', layer: 'drums', gain: 0.091, patterns: ['X.x.X.x.X.x.X.x.', 'X.xxX.x.X.xxX...'] },
          { inst: 'snare', layer: 'drums', gain: 0.0454, patterns: ['....X.......X...'] },
          { inst: 'hat', layer: 'drums', gain: 0.0121, patterns: ['x.x.x.x.x.x.x.x.'] },
          { inst: 'tom', layer: 'perc', gain: 0.0303, patterns: ['............xxxx', '..............xx'], tuned: 4, pan: 0.3 },
        ],
        space: [0.24, 0.04, 0.3],
        level: 3.61,
      },
    ],
  },
  // Accordion oompah in 12/8, tuba bass, stomps + tambourine. Sea-shanty dorian.
  harbor: {
    name: 'shanty',
    bpm: [76, 88],
    stepsPerBeat: 3,
    swing: [0, 0],
    roots: [41, 43, 45, 46],
    modes: ['dorian', 'aeolian'],
    progressions: [
      [0, 6, 0, 4],
      [0, 3, 6, 0],
      [0, 0, 6, 4],
      [0, 5, 6, 4],
    ],
    cadence: 6,
    lead: { inst: 'accordion', octave: 2, density: 0.5, gain: 0.07, legato: 0.85 },
    harmony: { inst: 'accordion', pattern: 'oompah', octave: 1, gain: 0.0408 },
    bass: { inst: 'tuba', patterns: ['R.....F.....', 'R.....F..A..', 'R..R..F.....'], gain: 0.112 },
    drums: [
      { inst: 'stomp', layer: 'drums', gain: 0.391, patterns: ['X.....x.....', 'X.....X..x..'] },
      { inst: 'clap', layer: 'drums', gain: 0.147, patterns: ['...x.....x..', '...x.....x.x'] },
      { inst: 'tambourine', layer: 'perc', gain: 0.0858, patterns: ['x..x..x..x..', 'x.ox.ox.ox.o'], pan: 0.3 },
    ],
    space: [0.22, 0.04, 0.3],
    level: 2.9,
    arrangements: [
      // The other end of the shipping lane: steel drums, offbeat guitar, congas, calypso.
      {
        name: 'calypso',
        bpm: [104, 116],
        stepsPerBeat: 4,
        swing: [0.04, 0.1],
        modes: ['mixolydian', 'dorian'],
        cadence: 4,
        lead: { inst: 'steeldrum', octave: 2, density: 0.45, gain: 0.09, legato: 0.8 },
        harmony: { inst: 'guitar', pattern: 'stab', octave: 1, gain: 0.0173, strum: true },
        bass: { inst: 'woodbass', patterns: ['R..R..F.R..R..F.', 'R...R.F.R...O.F.'], gain: 0.0338 },
        drums: [
          { inst: 'softkick', layer: 'drums', gain: 0.0596, patterns: ['X..x....X..x....'] },
          { inst: 'conga', layer: 'drums', gain: 0.0278, patterns: ['...x..x....x.xx.', '..x..x.x..x..x..'], pan: -0.3 },
          { inst: 'shaker', layer: 'perc', gain: 0.0119, patterns: ['xoxoxoxoxoxoxoxo'], pan: 0.2 },
          { inst: 'clap', layer: 'perc', gain: 0.0119, patterns: ['....x.......x...'] },
        ],
        space: [0.2, 0.04, 0.25],
        level: 6.32,
      },
    ],
  },
  // Glassy FM bells, dark pads, plucked bass, echoing pickaxe clanks and drips. Minor.
  mine: {
    name: 'cavern',
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
    lead: { inst: 'chimes', octave: 2, density: 0.28, gain: 0.07, legato: 0.6 },
    harmony: { inst: 'darkpad', pattern: 'sustain', octave: 1, gain: 0.0179 },
    bass: { inst: 'pluckbass', patterns: ['R.......F.......', 'R.....R...F.....', 'R...R.......A...'], gain: 0.0323 },
    drums: [
      { inst: 'softkick', layer: 'drums', gain: 0.0864, patterns: ['X.........x.....', 'X.......X.......'] },
      { inst: 'rim', layer: 'drums', gain: 0.0173, patterns: ['....x.......x...', '....x.....x.x...'] },
      { inst: 'clank', layer: 'perc', gain: 0.0202, patterns: ['......x.......x.', '..x.......x.....'], pan: -0.4 },
      { inst: 'drip', layer: 'perc', gain: 0.0144, patterns: ['.........x......', '...x...........x'], pan: 0.45 },
    ],
    space: [0.42, 0.24, 0.38],
    level: 5.19,
    arrangements: [
      // The minecart: a twangy echoing lead over a strummed train beat.
      {
        name: 'minecart',
        bpm: [120, 134],
        swing: [0.04, 0.08],
        modes: ['aeolian', 'dorian', 'harmonicMinor'],
        cadence: 4,
        lead: { inst: 'twang', octave: 2, density: 0.4, gain: 0.08, legato: 0.9 },
        harmony: { inst: 'guitar', pattern: 'pulse', octave: 1, gain: 0.027, strum: true },
        bass: { inst: 'upright', patterns: ['R...F...R...F...', 'R...F...O...F.A.'], gain: 0.0532 },
        drums: [
          { inst: 'softkick', layer: 'drums', gain: 0.12, patterns: ['X.......X.......'] },
          { inst: 'brush', layer: 'drums', gain: 0.043, patterns: ['xoxXxoxXxoxXxoxX', 'xoxXxoxXxoxXxxxX'] },
          { inst: 'clank', layer: 'perc', gain: 0.0216, patterns: ['..............x.'], pan: -0.4 },
        ],
        space: [0.3, 0.2, 0.3],
        level: 2.79,
      },
    ],
  },
  // Synthwave: gated snares, 8th-note octave bass, saw lead, square arps, wide pads.
  rooftops: {
    name: 'synthwave',
    bpm: [96, 112],
    stepsPerBeat: 4,
    swing: [0, 0],
    roots: [40, 41, 43, 45],
    modes: ['aeolian', 'dorian'],
    progressions: [
      [0, 5, 2, 6],
      [0, 3, 5, 4],
      [5, 3, 0, 4],
      [0, 6, 5, 6],
    ],
    cadence: 6,
    lead: { inst: 'synthlead', octave: 2, density: 0.38, gain: 0.065, legato: 0.9 },
    harmony: { inst: 'syntharp', pattern: 'arp', octave: 2, gain: 0.0568, every: 1 },
    bass: { inst: 'synthbass', patterns: ['R.R.R.R.R.R.R.O.', 'R.RRR.RRR.RRR.RO', 'O.R.R.R.O.R.R.R.'], gain: 0.0381 },
    pad: { inst: 'synthpad', octave: 1, gain: 0.0165 },
    drums: [
      { inst: 'kick', layer: 'drums', gain: 0.177, patterns: ['X.......X.......', 'X...X...X...X...', 'X.......X.x.....'] },
      { inst: 'gatedsnare', layer: 'drums', gain: 0.0792, patterns: ['....X.......X...'] },
      { inst: 'hat', layer: 'drums', gain: 0.0233, patterns: ['x.x.x.x.x.x.x.x.', '..x...x...x...x.'] },
      { inst: 'clap', layer: 'perc', gain: 0.0326, patterns: ['....x.......x...', '............x...'], pan: 0.2 },
    ],
    space: [0.38, 0.1, 0.375],
    level: 3.3,
    arrangements: [
      // Lo-fi at 3 a.m.: electric piano, a lazy swung kit, a warm sub.
      {
        name: 'lofi',
        bpm: [78, 88],
        swing: [0.16, 0.24],
        modes: ['dorian', 'aeolian'],
        lead: { inst: 'sax', octave: 1, density: 0.32, gain: 0.08, legato: 0.9 },
        harmony: { inst: 'epiano', pattern: 'sustain', octave: 1, gain: 0.0561 },
        bass: { inst: 'sub', patterns: ['R.......R..R....', 'R.....R...F.....'], gain: 0.0272 },
        pad: { inst: 'synthpad', octave: 1, gain: 0.018 },
        drums: [
          { inst: 'softkick', layer: 'drums', gain: 0.121, patterns: ['X.....x...X.....', 'X.......x.X.....'] },
          { inst: 'rim', layer: 'drums', gain: 0.0244, patterns: ['....x.......x...'] },
          { inst: 'hat', layer: 'drums', gain: 0.0121, patterns: ['x.x.x.x.x.x.x.x.', 'x.xxx.x.x.xxx.x.'] },
        ],
        space: [0.3, 0.08, 0.35],
        level: 3.24,
      },
    ],
  },
  // Thin air: glassy bell arps, a breathy flute, a slow plucked bass, icicle plinks and a shaker. Lydian sparkle.
  glacier: {
    name: 'aurora',
    bpm: [86, 100],
    stepsPerBeat: 4,
    swing: [0.02, 0.08],
    roots: [40, 42, 43, 45],
    modes: ['dorian', 'aeolian', 'lydian'],
    progressions: [
      [0, 4, 5, 3],
      [0, 1, 0, 4],
      [0, 5, 1, 4],
      [3, 4, 0, 0],
    ],
    cadence: 1,
    lead: { inst: 'flute', octave: 2, density: 0.32, gain: 0.07, legato: 0.85 },
    harmony: { inst: 'bell', pattern: 'arp', octave: 2, gain: 0.0114, every: 2 },
    bass: { inst: 'pluckbass', patterns: ['R.......R.......', 'R.......F.......', 'R...........A...'], gain: 0.0853 },
    pad: { inst: 'synthpad', octave: 1, gain: 0.0184 },
    drums: [
      { inst: 'softkick', layer: 'drums', gain: 0.0948, patterns: ['X.......X.......', 'X...........x...'] },
      { inst: 'shaker', layer: 'drums', gain: 0.0169, patterns: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'] },
      { inst: 'drip', layer: 'perc', gain: 0.0203, patterns: ['.......x.......x', '...x.......x....'], pan: 0.4 },
    ],
    space: [0.46, 0.18, 0.42],
    level: 4.31,
    arrangements: [
      // A snow globe: celesta over a harp-like lute, sleigh bells, in a slow 12/8.
      {
        name: 'snowglobe',
        bpm: [60, 72],
        stepsPerBeat: 3,
        swing: [0, 0],
        modes: ['aeolian', 'dorian'],
        lead: { inst: 'celesta', octave: 2, density: 0.45, gain: 0.09, legato: 0.8 },
        harmony: { inst: 'lute', pattern: 'roll', octave: 1, gain: 0.0203, every: 1 },
        bass: { inst: 'pluckbass', patterns: ['R.....F.....', 'R.....R.....'], gain: 0.0669 },
        pad: { inst: 'synthpad', octave: 1, gain: 0.0103 },
        drums: [
          { inst: 'softkick', layer: 'drums', gain: 0.0868, patterns: ['X.....x.....'] },
          { inst: 'sleigh', layer: 'drums', gain: 0.0174, patterns: ['x..x..x..x..', 'x.xx.xx.xx.x'] },
        ],
        level: 6.47,
      },
    ],
  },
  // Retro sci-fi: a square-wave lead over arpeggios, a pulsing sub, a wide pad, dry kick and hats. Mixolydian wonder.
  space: {
    name: 'retro',
    bpm: [100, 116],
    stepsPerBeat: 4,
    swing: [0, 0.03],
    roots: [38, 40, 41, 43],
    modes: ['dorian', 'aeolian', 'mixolydian'],
    progressions: [
      [0, 6, 3, 0],
      [0, 3, 6, 4],
      [0, 1, 6, 0],
      [5, 6, 0, 0],
    ],
    cadence: 6,
    lead: { inst: 'squarelead', octave: 2, density: 0.36, gain: 0.055, legato: 0.8 },
    counter: { inst: 'bell', octave: 1, gain: 0.0797 },
    harmony: { inst: 'syntharp', pattern: 'arp', octave: 2, gain: 0.0797, every: 1 },
    bass: { inst: 'sub', patterns: ['R...R...R...R...', 'R.R...R.R...R.F.', 'R.......R...O...'], gain: 0.0417 },
    pad: { inst: 'synthpad', octave: 1, gain: 0.0262 },
    drums: [
      { inst: 'kick', layer: 'drums', gain: 0.196, patterns: ['X.......X.......', 'X.....X.X.......'] },
      { inst: 'hat', layer: 'drums', gain: 0.0259, patterns: ['..x...x...x...x.', 'x.x.x.x.x.x.x.x.'] },
      { inst: 'rim', layer: 'perc', gain: 0.0402, patterns: ['....x.......x...', '....x.....x.x...'], pan: -0.3 },
    ],
    space: [0.44, 0.26, 0.45],
    level: 2.24,
    arrangements: [
      // The B-movie saucer: a theremin over celesta, a slow sub and blips.
      {
        name: 'saucer',
        bpm: [78, 90],
        swing: [0, 0.04],
        modes: ['harmonicMinor', 'aeolian', 'phrygianDominant'],
        cadence: 4,
        lead: { inst: 'theremin', octave: 2, density: 0.28, gain: 0.08, legato: 1 },
        counter: undefined,
        harmony: { inst: 'celesta', pattern: 'arp', octave: 2, gain: 0.106 },
        bass: { inst: 'sub', patterns: ['R.......F.......', 'R...........R...'], gain: 0.0577 },
        pad: { inst: 'synthpad', octave: 1, gain: 0.0348 },
        drums: [
          { inst: 'softkick', layer: 'drums', gain: 0.238, patterns: ['X.......X.......', 'X.........x.....'] },
          { inst: 'rim', layer: 'drums', gain: 0.0475, patterns: ['....x.......x...'] },
          { inst: 'drip', layer: 'perc', gain: 0.0475, patterns: ['......x.......x.', '...x.......x....'], pan: 0.4 },
        ],
        space: [0.5, 0.3, 0.5],
        level: 1.79,
      },
    ],
  },
};

/**
 * The title tune: what plays on the main menu, the lobby list, the codex and Settings, before any
 * level has a theme. The foundry at night: a horn over low strings, a plucked bass walking under
 * it, a slow kick and the anvil on the backbeat. Harmonic minor.
 */
export const TITLE_STYLE: MusicStyle = {
  name: 'title',
  bpm: [88, 88],
  stepsPerBeat: 4,
  swing: [0, 0],
  roots: [38],
  modes: ['harmonicMinor'],
  progressions: [
    [0, 5, 3, 4],
    [0, 3, 5, 4],
  ],
  lead: { inst: 'brass', octave: 1, density: 0.34, gain: 0.08, legato: 0.95 },
  harmony: { inst: 'cello', pattern: 'sustain', octave: 1, gain: 0.0421 },
  bass: { inst: 'pluckbass', patterns: ['R..R..R.R..R..F.', 'R.....R.R...F.A.'], gain: 0.0396 },
  drums: [
    { inst: 'taiko', layer: 'drums', gain: 0.137, patterns: ['X.......X..x....', 'X.....x.X.......'], tuned: 0 },
    { inst: 'rim', layer: 'drums', gain: 0.0229, patterns: ['....x.......x...', '....x.....x.x...'] },
    { inst: 'anvil', layer: 'perc', gain: 0.0274, patterns: ['....x.......x...', '....x.........x.'], pan: -0.25 },
  ],
  space: [0.42, 0.08, 0.34],
  level: 3.05,
};

/** The title tune's seed: one fixed tune, so the menu always sounds like the same game. */
export const TITLE_SEED = 2;

/** A song's identity: a level theme, or the title tune. */
export type SongId = ThemeId | 'title';

export const songStyle = (id: SongId): MusicStyle => (id === 'title' ? TITLE_STYLE : STYLES[id]);

/** Every arrangement name of a song: the style's own first. */
export const arrangementNames = (id: SongId): string[] => [songStyle(id).name, ...(songStyle(id).arrangements ?? []).map((a) => a.name)];

/** The style as one of its arrangements plays it (an unknown name is the style itself). */
export function arranged(id: SongId, name: string): MusicStyle {
  const st = songStyle(id);
  return { ...st, ...st.arrangements?.find((a) => a.name === name) };
}
