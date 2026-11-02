import type { Match } from '../game/match';
import type { GameEvent } from '../sim/types';

/**
 * Audio contract. The game loop drains sim events once per frame and hands
 * them to both the renderer and the audio system. Audio is presentation
 * only: it may read Match state but must never mutate it.
 *
 * TODO(sound owner): implement procedural SFX + per-theme music.
 */
export interface Volumes {
  master: number;
  music: number;
  sfx: number;
}

export interface AudioSystem {
  /** Sim events produced since the last call. */
  handle(events: readonly GameEvent[], match: Match): void;
  /** Called every rendered frame (music, ambience, continuous loops). */
  update(match: Match, nowMs: number): void;
  volumes: Volumes;
  setVolumes(v: Partial<Volumes>): void;
  /** Must be called from a user gesture before audio can play (browser autoplay rules). */
  unlock(): void;
}

class Silent implements AudioSystem {
  volumes: Volumes = { master: 0.8, music: 0.6, sfx: 0.9 };
  handle() {}
  update() {}
  setVolumes(v: Partial<Volumes>) {
    this.volumes = { ...this.volumes, ...v };
  }
  unlock() {}
}

export function createAudio(): AudioSystem {
  return new Silent();
}
