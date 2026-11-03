import { type MapJob, planShot } from './shots';

/** Plans the codex's map pictures off the main thread, one job at a time (see ./map-view.ts). */
interface WorkerScope {
  onmessage: ((e: MessageEvent<{ key: string; job: MapJob }>) => void) | null;
  postMessage(data: unknown, transfer: Transferable[]): void;
}

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = ({ data: { key, job } }) => {
  const shot = planShot(job);
  scope.postMessage({ key, shot }, shot ? [shot.level.tiles.buffer] : []);
};
