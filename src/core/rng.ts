/**
 * Deterministic PRNG utilities. Everything in the simulation and the
 * generators must draw randomness from here (never Math.random) so that a
 * seed + an input stream fully reproduces a match. That property is what
 * makes lockstep / rollback netcode possible later.
 */

/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix two 32-bit ints into a well-distributed 32-bit int (murmur3 finalizer). */
function mix32(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Derive an independent sub-seed from a base seed and a label. */
export function deriveSeed(seed: number, label: string | number): number {
  return mix32(seed >>> 0, typeof label === 'number' ? label >>> 0 : hashString(label));
}

/** Cheap stateless hash of integer coords, returns [0, 1). Handy for render noise. */
export function hash2(x: number, y: number, seed = 0): number {
  return mix32(mix32(seed, x | 0), y | 0) / 4294967296;
}

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }

  /** mulberry32 — returns [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  sign(): 1 | -1 {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of items) total += w;
    let r = this.next() * total;
    for (const [v, w] of items) {
      r -= w;
      if (r < 0) return v;
    }
    return items[items.length - 1][0];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export function seedToString(seed: number): string {
  return (seed >>> 0).toString(36).padStart(7, '0');
}

export function parseSeed(s: string): number {
  const t = s.trim().toLowerCase();
  if (/^[0-9a-z]{1,7}$/.test(t)) {
    const n = parseInt(t, 36);
    if (Number.isFinite(n) && n <= 0xffffffff) return n >>> 0;
  }
  return hashString(t);
}
