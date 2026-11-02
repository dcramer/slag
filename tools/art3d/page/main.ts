import type * as THREE from 'three';
import { turnaround } from './inspect';
import { loadModel } from './load';
import { swatches } from './roles';
import { renderSprites } from './render';
import { contact } from './sheet';

/**
 * The page the art3d command drives in headless Chromium (tools/art3d/sprites.ts). Everything it can do
 * is on `window.art3d`, called with plain data and answering with plain data, so the command holds no
 * state the page doesn't hand back.
 */
const api = {
  async inspect(url: string, size: number, k: number) {
    const model = await loadModel(url);
    return {
      sheet: turnaround(model, size),
      clips: model.clips.map((c) => ({ name: c.name, seconds: c.duration })),
      swatches: model.texture
        ? swatches(model.texture, k, model.meshes[0].geometry.getAttribute('uv') as THREE.BufferAttribute, model.meshes[0].geometry.index)
        : [],
    };
  },
  renderSprites,
  contact,
};

(window as unknown as { art3d: typeof api }).art3d = api;
document.title = 'art3d ready';
