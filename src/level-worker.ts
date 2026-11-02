import { generateLevel } from './gen/level';
import type { LevelRequest } from './gen/level/pregen';

/** Generates levels off the main thread, one request at a time (see ./level-ahead.ts). */
interface WorkerScope {
  onmessage: ((e: MessageEvent<{ key: string; req: LevelRequest }>) => void) | null;
  postMessage(data: unknown, transfer: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = ({ data: { key, req } }) => {
  const level = generateLevel(req.seed, req.theme, req.profile);
  scope.postMessage({ key, level }, [level.tiles.buffer]);
};
