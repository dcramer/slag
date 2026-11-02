/** Tiny music-theory kit: modes as semitone offsets, scale-degree → MIDI. */

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
} as const;
export type ModeName = keyof typeof MODES;

/** MIDI note of scale degree `deg` (any integer; wraps octaves) above `root`. */
export function degreeToMidi(root: number, mode: ModeName, deg: number): number {
  const s = MODES[mode];
  const n = s.length;
  const oct = Math.floor(deg / n);
  return root + oct * 12 + s[((deg % n) + n) % n];
}

/** Scale degrees of the triad (or 7th chord) built on `deg`. */
export function chordDegrees(deg: number, size = 3): number[] {
  return Array.from({ length: size }, (_, i) => deg + i * 2);
}

/** Is `midi` a member of the scale? */
export function inScale(root: number, mode: ModeName, midi: number): boolean {
  const pc = (((midi - root) % 12) + 12) % 12;
  return (MODES[mode] as readonly number[]).includes(pc);
}
