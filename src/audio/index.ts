import type { Match } from '../game/match';
import type { GameEvent } from '../sim/types';
import { WebAudioSystem } from './system';
import { loadVolumes, sanitizeVolumes, saveVolumes, type Volumes } from './volumes';

/**
 * Audio contract. The game loop drains sim events once per frame and hands
 * them to both the renderer and the audio system. Audio is presentation
 * only: it may read Match state but must never mutate it.
 *
 * Everything is synthesized with WebAudio (no audio files):
 *   mixer.ts     buses, compressor/limiter, reverb/echo, voice limiting
 *   synth.ts     Voice + envelopes/noise + patch helpers
 *   sfx.ts       one-shot palette;  cues.ts  sim event → cue mapping
 *   actions.ts   player actions from runner state diffs
 *   emitters.ts  hazard loops + prop cycle transients;  loops.ts  loop patches
 *   spatial.ts   panning / distance attenuation
 *   music/       seeded per-theme composer, instruments, lookahead sequencer
 *   system.ts    the Match-facing glue (this interface)
 */
export type { Volumes } from './volumes';

/** UI feedback cues (DOM menus / HUD buttons). */
export type UiCue = 'hover' | 'click' | 'open' | 'close';

export interface AudioSystem {
  /** Sim events produced since the last call. */
  handle(events: readonly GameEvent[], match: Match): void;
  /** Called every rendered frame (music, ambience, continuous loops). */
  update(match: Match, nowMs: number): void;
  volumes: Volumes;
  setVolumes(v: Partial<Volumes>): void;
  /** Must be called from a user gesture before audio can play (browser autoplay rules). */
  unlock(): void;
  /** Optional: UI feedback for menus and HUD buttons. */
  ui?(cue: UiCue): void;
  /** Does this player device play on this screen? Only its self-destruct countdown ticks. Absent: everyone does. */
  isLocal?: (device: string) => boolean;
  /** Optional: stop every sound and release the audio device; the game that owned it is gone. */
  dispose?(): void;
}

/** No-op fallback (no WebAudio). Still persists volume settings. */
export class Silent implements AudioSystem {
  volumes: Volumes = loadVolumes();
  handle() {}
  update() {}
  setVolumes(v: Partial<Volumes>) {
    this.volumes = sanitizeVolumes({ ...this.volumes, ...v });
    saveVolumes(this.volumes);
  }
  unlock() {}
  ui() {}
}

export function createAudio(): AudioSystem {
  const g = globalThis as { AudioContext?: unknown; webkitAudioContext?: unknown };
  return g.AudioContext || g.webkitAudioContext ? new WebAudioSystem() : new Silent();
}
