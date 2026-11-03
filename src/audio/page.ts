import { type AudioSystem, createAudio } from './index';

/**
 * The page's one audio system. Every screen shares it, so the title tune
 * plays on the menus, carries into a lobby (which crossfades to its level's
 * song) and comes back when the lobby closes, and one unlock gesture serves
 * the whole visit. `mountGame` releases it when the game is unmounted.
 */
let shared: AudioSystem | null = null;

export function pageAudio(): AudioSystem {
  return (shared ??= createAudio());
}

export function closePageAudio(): void {
  shared?.dispose?.();
  shared = null;
}
