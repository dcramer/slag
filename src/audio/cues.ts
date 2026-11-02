import type { LiquidKind } from '../gen/theme';
import type { GameEvent, ItemEventKind } from '../sim/types';
import type { ThemeId } from '../themes';
import type { SurfaceTone } from './actions';
import type { SfxName } from './sfx';

/**
 * Pure mapping from sim events to sound cues (what to play, where, how).
 * Kept free of WebAudio so the mapping can be unit-tested; `AudioEngine`
 * turns cues into voices.
 */

export interface Cue {
  name: SfxName;
  /** World position (px) for panning/attenuation; omit for non-positional (UI) sounds. */
  x?: number;
  y?: number;
  gain?: number;
  pitch?: number;
  variant?: string;
  amount?: number;
  notes?: readonly number[];
  /** Seconds after "now". */
  delay?: number;
}

export interface CueEnv {
  theme: ThemeId;
  liquid: LiquidKind;
  /** Pitch ratio that gives each player slot its own voice. */
  pitchOf(slot: number): number;
  /** MIDI note for a scale degree of the current song (degree 0 = tonic), so musical cues are in key. */
  note(degree: number, octave?: number): number;
  /** Material of the prop a player just placed ('wood' | 'metal' | 'magic'). */
  placedVariant(slot: number): string;
  /** World centre of a prop by uid (crumble events carry only the uid). */
  propPos(uid: number): { x: number; y: number } | null;
}

/** Default floor sound per theme. */
export const GROUND_TONE: Record<ThemeId, SurfaceTone> = {
  farm: 'soft',
  factory: 'metal',
  castle: 'stone',
  jungle: 'soft',
  volcano: 'stone',
  harbor: 'wood',
  mine: 'stone',
  rooftops: 'metal',
};

/** Distinct, consonant pitch offsets (semitones) per player slot. */
const SLOT_SEMIS = [0, 4, 7, -3, 2, 9, -5, 5];
export const slotPitch = (slot: number) => 2 ** ((SLOT_SEMIS[slot % SLOT_SEMIS.length] ?? 0) / 12);

/** Finish flourish: 1st place gets a full rising arpeggio, later finishers fewer, lower notes. */
export function finishNotes(place: number, note: CueEnv['note']): number[] {
  if (place <= 1) return [note(0, 1), note(2, 1), note(4, 1), note(0, 2)];
  if (place === 2) return [note(0, 1), note(2, 1), note(4, 1)];
  if (place === 3) return [note(0, 1), note(4, 1)];
  return [note(4, 0)];
}

export function cuesForEvent(e: GameEvent, env: CueEnv): Cue[] {
  switch (e.type) {
    case 'death':
      if (e.cause === 'fall') return [{ name: 'splash', x: e.x, y: e.y, variant: env.liquid }];
      if (e.cause === 'crush') return [{ name: 'death-crush', x: e.x, y: e.y, pitch: env.pitchOf(e.slot) }];
      if (e.cause === 'pop') return [{ name: 'death-pop', x: e.x, y: e.y, pitch: env.pitchOf(e.slot) }];
      if (e.cause === 'timeout') return [{ name: 'death-timeout', x: e.x, y: e.y, pitch: env.pitchOf(e.slot) }];
      return [{ name: 'death-hazard', x: e.x, y: e.y, pitch: env.pitchOf(e.slot) }];
    case 'finish':
      return [{ name: 'finish', x: e.x, y: e.y, notes: finishNotes(e.place, env.note), gain: e.place <= 1 ? 1 : 0.8 }];
    case 'spring':
      return [{ name: 'spring', x: e.x, y: e.y }];
    case 'pop':
      return [{ name: popName(e.ammo), x: e.x, y: e.y }];
    case 'fire':
      return [{ name: fireName(e.style), x: e.x, y: e.y }];
    case 'explosion':
      return [{ name: 'explosion', x: e.x, y: e.y, amount: Math.min(1, e.r / 64) }];
    case 'prop': {
      const name = PROP_CUE[e.kind];
      if (!name) return [];
      return [{ name, x: e.x, y: e.y, ...(e.kind === 'drill' ? { amount: 0.5 } : {}) }];
    }
    case 'crumble-start':
    case 'crumble-break':
      return [{ name: e.type, ...env.propPos(e.uid) }];
    case 'place':
      return [{ name: 'place', x: e.x, y: e.y, variant: env.placedVariant(e.slot), notes: [env.note(0), env.note(4)] }];
    case 'claim':
      return [{ name: 'claim', pitch: 1, notes: [env.note(0, 1), env.note(4, 1)].map((n) => n + Math.round(12 * Math.log2(env.pitchOf(e.slot)))) }];
    case 'phase':
      if (e.phase === 'pick' || e.phase === 'score') return [{ name: 'whoosh' }];
      if (e.phase === 'place') return [{ name: 'ui-toggle', variant: 'on' }];
      return [];
    case 'item': {
      const name = itemName(e.what, e.kind);
      return name ? [{ name, x: e.x, y: e.y }] : [];
    }
  }
}

const POP: Record<string, SfxName> = {
  bolt: 'pop-bolt',
  arrow: 'pop-arrow',
  cannonball: 'pop-cannonball',
  fireball: 'pop-fireball',
  plasma: 'pop-plasma',
  shuriken: 'pop-shuriken',
  seeker: 'pop-cannonball',
  boomerang: 'pop-shuriken',
  rubber: 'pop-arrow',
  cluster: 'pop-cannonball',
  shrapnel: 'pop-bolt',
  goo: 'pop-arrow',
  frost: 'pop-plasma',
  ricochet: 'pop-plasma',
  puck: 'pop-arrow',
  smokebomb: 'pop-cannonball',
};
/** Sounds for generic prop moments (teleports, bumps, thuds...). Unlisted kinds are silent. */
const PROP_CUE: Record<string, SfxName> = {
  teleport: 'whoosh',
  bump: 'spring',
  thud: 'piston-slam',
  'dropper-warn': 'piston-hiss',
  'snap-arm': 'ui-tick',
  bounce: 'pop-bolt',
  'splat-goo': 'pop-arrow',
  'splat-frost': 'pop-plasma',
  emp: 'tesla-arc',
  drill: 'explosion',
};
const FIRE: Record<string, SfxName> = {
  crossbow: 'fire-crossbow',
  ballista: 'fire-ballista',
  cannon: 'fire-cannon',
  totem: 'fire-totem',
  turret: 'fire-turret',
  thrower: 'fire-thrower',
  rocket: 'fire-cannon',
  glaive: 'fire-thrower',
  gumball: 'fire-totem',
  mortar: 'fire-cannon',
  gooper: 'fire-totem',
  cryo: 'fire-turret',
  prism: 'fire-turret',
};
/** Held-item moments borrow existing sounds until they get their own. Unlisted moments are silent. */
const ITEM_CUE: Partial<Record<ItemEventKind, SfxName>> = {
  pop: 'spring',
  pickup: 'ui-tick',
  drop: 'drop',
  block: 'pop-plasma',
  catch: 'ui-tick',
  smoke: 'pop-cannonball',
  hit: 'land',
};
const ITEM_USE_CUE: Record<string, SfxName> = {
  sword: 'walljump',
  puck: 'fire-thrower',
  boomerang: 'fire-thrower',
  rocket: 'fire-cannon',
  smoke: 'fire-totem',
};
export const itemName = (what: ItemEventKind, kind: string): SfxName | undefined => (what === 'use' ? ITEM_USE_CUE[kind] : ITEM_CUE[what]);
export const popName = (ammo: string): SfxName => POP[ammo] ?? 'pop-bolt';
export const fireName = (style: string): SfxName => FIRE[style] ?? 'fire-crossbow';
