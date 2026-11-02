import { assignCast, CAST_KINDS, type CastMode, rollCast } from '../../gen/cast';
import type { CharacterDef } from '../../gen/character';
import type { Rig } from '../character';
import type { InkTarget, RunnerPose } from '../ink-character';
import { type Art, drawCast, drawCastRope } from './draw';
import { PRINT_ART } from './prints';
import { SPECIES_ART } from './species';
import { TOY_ART } from './toys';

/**
 * Character-direction prototypes, on only with `?cast=a|b|c` (docs/CHARACTERS.md). A: creature prints
 * on today's blob. B: a cast of species. C: foundry toys. Off, nothing here runs and every runner draws
 * exactly as before.
 */

let mode: CastMode | null | undefined;

export function castMode(): CastMode | null {
  if (mode === undefined) {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('cast') : null;
    mode = q === 'a' || q === 'b' || q === 'c' ? q : null;
  }
  return mode;
}

/** For the catalog page, which draws all three directions in one document. */
export function setCastMode(m: CastMode | null) {
  mode = m;
}

function arts(m: CastMode): readonly Art[] {
  const reg: Record<string, Art> = m === 'a' ? PRINT_ART : m === 'b' ? SPECIES_ART : TOY_ART;
  return CAST_KINDS[m].map((k) => reg[k]);
}

/** Kinds handed out to the seated lobby, by look seed. Seeds not seated keep their own roll. */
const seated = new Map<string, number>();
let lastLobby = '';

/** Keep a lobby on distinct kinds, as Phase 2's match would. Cheap to call every frame. */
export function castLobby(seeds: readonly number[]) {
  const m = castMode();
  if (!m) return;
  const key = m + seeds.join(',');
  if (key === lastLobby) return;
  lastLobby = key;
  seated.clear();
  assignCast(seeds, m).forEach((k, i) => seated.set(`${m}:${seeds[i]}`, k));
}

/** Pin a seed to a kind (the catalog shows every kind). */
export function pinCast(m: CastMode, seed: number, kind: number) {
  seated.set(`${m}:${seed}`, kind);
}

export function castKind(c: CharacterDef, m: CastMode): number {
  return seated.get(`${m}:${c.seed}`) ?? rollCast(c.seed, m).kind;
}

export function castName(c: CharacterDef, m: CastMode): string {
  return CAST_KINDS[m][castKind(c, m)];
}

function artOf(c: CharacterDef, m: CastMode) {
  const kind = castKind(c, m);
  const art = arts(m)[kind];
  const v = rollCast(c.seed, m).vary;
  return { art, v, key: `${m}:${kind}:${c.seed}` };
}

/** The def the renderer's rig should run: the kind decides whether it trails a tail, a scarf or nothing. */
const ropes = new Map<string, CharacterDef>();
export function castDef(c: CharacterDef): CharacterDef {
  const m = castMode();
  if (!m) return c;
  const { art, key } = artOf(c, m);
  // Prints keep the blob's own scarf or cape unless the print brings a tail; species and toys trail only their own.
  const rope = art.rope ?? (m === 'a' ? null : { kind: 'none' as const, len: 2 });
  if (!rope) return c;
  let have = ropes.get(key);
  if (!have || have.body !== c.body) {
    have = { ...c, accessory: rope.kind, accessoryLength: rope.len };
    ropes.set(key, have);
  }
  return have;
}

export function drawCastRunner(rc: InkTarget, c: CharacterDef, x: number, y: number, p: RunnerPose): boolean {
  const m = castMode();
  if (!m) return false;
  const { art, v, key } = artOf(c, m);
  drawCast(rc, c, x, y, p, art, v, key);
  return true;
}

export function drawCastAccessory(s: CanvasRenderingContext2D, c: CharacterDef, rig: Rig): boolean {
  const m = castMode();
  if (!m) return false;
  const { art, v, key } = artOf(c, m);
  return drawCastRope(s, c, rig, art, v, key);
}
