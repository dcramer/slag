import type * as THREE from 'three';
import type { SpriteSet } from '../../../src/render/cast/sprites/types';
import type { Settings } from '../settings';
import { turnaround } from './inspect';
import { loadModel } from './load';
import { renderSprites } from './render';
import { swatches } from './roles';
import { contact, rolls } from './sheet';

/**
 * The page the art3d command drives in headless Chromium (tools/art3d/sprites.ts). Everything it can do
 * is on `window.art3d`, called with plain data and answering with plain data, so the command holds no
 * state the page doesn't hand back.
 */

/** Rendered clips as the game's data: outlines in eighths of a world px, roles by index. */
async function render(url: string, s: Settings, kind: string, only?: string[]): Promise<SpriteSet> {
  const got = await renderSprites(url, s, only);
  const enc = (r: number[]) => {
    const a = new Int16Array(r.map((v) => Math.round(v * 8)));
    let s = '';
    for (const b of new Uint8Array(a.buffer)) s += String.fromCharCode(b);
    return btoa(s);
  };
  const clips: Record<string, SpriteSet['clips'][string]> = {};
  for (const [name, tc] of Object.entries(got.clips)) {
    const c = s.clips[name];
    const frames = (fs: typeof tc.r) =>
      fs.map((f) => ({
        sil: f.sil.map(enc),
        parts: f.parts.map((p) => (p.option ? ([p.role, enc(p.ring), p.option[0], p.option[1]] as const) : ([p.role, enc(p.ring)] as const))),
        ...(f.eyes.length ? { eyes: f.eyes.map((v) => Math.round(v * 8)) } : {}),
        ...(f.head ? { head: [...f.head.slice(0, 3).map((v) => Math.round(v * 8)), Math.round((f.head[3] * 180) / Math.PI)] } : {}),
        ...(f.marks?.length ? { marks: f.marks.map(enc) } : {}),
      }));
    clips[name] = {
      loop: c.loop,
      ...(c.fps ? { fps: c.fps } : {}),
      ...(c.stride ? { stride: c.stride } : {}),
      ...(c.vy ? { vy: c.vy } : {}),
      ...(c.holds ? { holds: c.holds } : {}),
      r: frames(tc.r),
      l: frames(tc.l),
    };
  }
  const roles = got.roles.map((n) => {
    const r = s.roles[n];
    return { color: r.color, ...(r.slot ? { slot: r.slot } : {}), ...(r.alts ? { alts: r.alts, vary: r.vary ?? 0 } : {}) };
  });
  const face = s.face ? { r: s.face.r, iris: s.face.iris, ...(s.face.mouth ? { mouth: s.face.mouth } : {}) } : null;
  const slots = Object.entries(s.slots ?? {}).map(([name, vary]) => ({ vary, options: (s.props ?? []).filter((p) => p.slot === name).length }));
  return { kind, height: s.height, roles, ...(slots.length ? { slots } : {}), ...(face ? { face } : {}), clips };
}

const api = {
  async inspect(url: string, size: number, k: number) {
    const model = await loadModel(url);
    return {
      sheet: turnaround(model, size),
      clips: model.clips.map((c) => ({ name: c.name, seconds: c.duration })),
      bones: (() => {
        const names: string[] = [];
        model.root.traverse((o) => (o as THREE.Bone).isBone && names.push(o.name));
        return names;
      })(),
      swatches: model.texture
        ? swatches(model.texture, k, model.meshes[0].geometry.getAttribute('uv') as THREE.BufferAttribute, model.meshes[0].geometry.index)
        : [],
    };
  },
  render,
  contact,
  rolls,
};

(window as unknown as { art3d: typeof api }).art3d = api;
document.title = 'art3d ready';
