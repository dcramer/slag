import { generateLevel, lastGenInfo } from './gen/level';
import type { LevelRequest } from './gen/level/pregen';

/** Generates levels off the main thread, one request at a time (see ./level-ahead.ts). */
interface WorkerScope {
  onmessage: ((e: MessageEvent<{ key: string; req: LevelRequest }>) => void) | null;
  postMessage(data: unknown, transfer: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = ({ data: { key, req } }) => {
  const level = generateLevel(req.seed, req.theme, req.profile);
  // How the generator got there, for monitoring: the main thread can't see this worker's lastGenInfo.
  const { fallback, conceptFallback, attempts } = lastGenInfo;
  scope.postMessage({ key, req, level, gen: { fallback, conceptFallback, attempts } }, [level.tiles.buffer]);
};
