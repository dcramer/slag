import { type InputFrame, NO_INPUT } from '../sim/types';

/**
 * Compact wire form of an InputFrame: 9 button bits, plus the pointer when
 * it moved this frame (`[bits, x, y]`). Frames with no buttons and no pointer
 * are simply omitted from bundles.
 */
export type Enc = number | [number, number, number];

const KEYS = ['left', 'right', 'up', 'down', 'jump', 'jumpPressed', 'confirmPressed', 'altPressed', 'downPressed'] as const;
/** Bits that are one-frame edges: they must be OR-merged, never repeated. */
const PRESSED = (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8);

export function encode(f: InputFrame): Enc {
  let bits = 0;
  for (let i = 0; i < KEYS.length; i++) if (f[KEYS[i]]) bits |= 1 << i;
  return f.pointer ? [bits, f.pointer.x, f.pointer.y] : bits;
}

export function decode(e: Enc | undefined): InputFrame {
  if (e === undefined || e === 0) return NO_INPUT;
  const bits = typeof e === 'number' ? e : e[0];
  const f: InputFrame = { ...NO_INPUT };
  for (let i = 0; i < KEYS.length; i++) if (bits & (1 << i)) f[KEYS[i]] = true;
  if (typeof e !== 'number') f.pointer = { x: e[1], y: e[2] };
  return f;
}

/** Same buttons held, no edges, no pointer: what a device does on a frame we have no input for. */
export function held(e: Enc | undefined): Enc {
  if (e === undefined) return 0;
  return (typeof e === 'number' ? e : e[0]) & ~PRESSED;
}

/** Merge two consecutive frames into one: latest held state, any edge from either, latest pointer. */
export function merge(a: Enc | undefined, b: Enc | undefined): Enc {
  if (a === undefined) return b ?? 0;
  if (b === undefined) return a;
  const ab = typeof a === 'number' ? a : a[0];
  const bb = typeof b === 'number' ? b : b[0];
  const bits = (bb & ~PRESSED) | ((ab | bb) & PRESSED);
  const p = typeof b !== 'number' ? b : typeof a !== 'number' ? a : null;
  return p ? [bits, p[1], p[2]] : bits;
}

/** One local tick of a peer: local device name → input (empty devices omitted). */
export type PeerFrame = Record<string, Enc>;

export function mergePeerFrames(a: PeerFrame, b: PeerFrame): PeerFrame {
  const out: PeerFrame = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const m = merge(a[k] ?? 0, b[k] ?? 0);
    if (m !== 0) out[k] = m;
  }
  return out;
}

export function heldPeerFrame(f: PeerFrame | undefined): PeerFrame {
  const out: PeerFrame = {};
  if (f) for (const [k, e] of Object.entries(f)) if (held(e) !== 0) out[k] = held(e);
  return out;
}
