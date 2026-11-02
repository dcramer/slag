import * as THREE from 'three';
import { BOX, type Clip, type Settings } from '../settings';
import { compose, frameBox, type Layer, palette } from './ink';
import { loadModel } from './load';
import { classify } from './roles';
import { rebind } from './weights';

/**
 * Renders a kind's clips into sprite atlases. A fixed orthographic camera looks at the figure side on;
 * one pass writes, per pixel, the role (from the classified texture), N·L from smoothed normals in view
 * space, and depth; `compose` (ink.ts) turns that into toned, inked pixels and recolour masks.
 */

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
out vec2 vUv;
out vec3 vN;
out float vDepth;
void main() {
  vUv = uv;
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vN = normalize(transformedNormal);
  vDepth = -mvPosition.z;
}`;

const FRAG = /* glsl */ `
precision highp float;
precision highp usampler2D;
uniform usampler2D roles;
uniform vec3 light;
in vec2 vUv;
in vec3 vN;
in float vDepth;
out vec4 color;
void main() {
  uint r = texture(roles, vUv).r;
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float l = dot(n, normalize(light));
  float d = clamp(vDepth / 200.0, 0.0, 1.0) * 65535.0;
  float hi = floor(d / 256.0);
  color = vec4(float(r + 1u) / 255.0, l * 0.5 + 0.5, hi / 255.0, (d - hi * 256.0) / 255.0);
}`;

/** Shading normals averaged over a radius, so the toon bands follow big forms and not the mesh's lumps. */
function smoothNormals(geo: THREE.BufferGeometry, radius: number) {
  const pos = geo.getAttribute('position');
  const n = pos.count;
  geo.computeVertexNormals();
  const nor = geo.getAttribute('normal');
  const cell = radius;
  const grid = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < n; i++) {
    const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
    let list = grid.get(k);
    if (!list) grid.set(k, (list = []));
    list.push(i);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    const cz = Math.floor(z / cell);
    let ax = 0;
    let ay = 0;
    let az = 0;
    const own = [nor.getX(i), nor.getY(i), nor.getZ(i)];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!list) continue;
          for (const j of list) {
            const d = Math.hypot(pos.getX(j) - x, pos.getY(j) - y, pos.getZ(j) - z);
            if (d > radius) continue;
            const nx = nor.getX(j);
            const ny = nor.getY(j);
            const nz = nor.getZ(j);
            // Only surfaces facing the same way blend: a thin part's far side, or a hand on a belly, stays out.
            const dot = nx * own[0] + ny * own[1] + nz * own[2];
            if (dot < 0.2) continue;
            const wgt = (1 - d / radius) * dot;
            ax += nx * wgt;
            ay += ny * wgt;
            az += nz * wgt;
          }
        }
    const l = Math.hypot(ax, ay, az) || 1;
    out[i * 3] = ax / l;
    out[i * 3 + 1] = ay / l;
    out[i * 3 + 2] = az / l;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

/**
 * Shelf packing, tallest first, into a width near the square root of the area: frames of one figure are
 * near one size, so shelves waste little. Deterministic for the same frames, so rerenders diff cleanly.
 */
function shelfPack(boxes: { w: number; h: number; x: number; y: number }[]): { w: number; h: number } {
  const area = boxes.reduce((a, b) => a + b.w * b.h, 0);
  const width = Math.max(Math.ceil(Math.sqrt(area) * 1.05), ...boxes.map((b) => b.w));
  const order = boxes.map((b, i) => ({ b, i })).sort((p, q) => q.b.h - p.b.h || p.i - q.i);
  let x = 0;
  let y = 0;
  let shelf = 0;
  let w = 0;
  for (const { b } of order) {
    if (x + b.w > width) {
      y += shelf;
      x = 0;
      shelf = 0;
    }
    b.x = x;
    b.y = y;
    x += b.w;
    w = Math.max(w, x);
    shelf = Math.max(shelf, b.h);
  }
  return { w, h: y + shelf };
}

export interface FrameRect {
  /** In the atlas. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The feet's position inside this frame's rect. */
  ax: number;
  ay: number;
}

export interface AtlasOut {
  scale: number;
  png: string;
  masks: string;
  w: number;
  h: number;
  /** clip → facing ('r' | 'l') → frames. */
  clips: Record<string, Record<'r' | 'l', FrameRect[]>>;
}

function findClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip {
  // A preset is named for itself; a motion made from a description is named by the description's start.
  const c =
    clips.find((c) => c.name === name) ??
    clips.find((c) => c.name.startsWith(name)) ??
    clips.find((c) =>
      c.name
        .toLowerCase()
        .split(/[:_ |]/)
        .includes(name.toLowerCase()),
    );
  if (!c) throw new Error(`no animation "${name}" in the model: it has ${clips.map((c) => c.name).join(', ')}`);
  return c;
}

/** Every clip's sample times, in seconds of its source. */
export function sampleTimes(c: Clip, duration: number): number[] {
  const from = (c.from ?? 0) * duration;
  const to = (c.to ?? 1) * duration;
  const n = c.frames;
  const div = c.loop ? n : Math.max(1, n - 1);
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / div);
}

export async function renderSprites(url: string, s: Settings, only?: string[]) {
  const model = await loadModel(url);
  const pal = palette(s);
  if (!model.texture) throw new Error('the model has no colour texture to read roles from');
  const roleTex = classify(model.texture, s.roles, pal.names);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    glslVersion: THREE.GLSL3,
    uniforms: { roles: { value: roleTex }, light: { value: new THREE.Vector3(...s.light).normalize() } },
    side: THREE.DoubleSide,
  });

  const bindBox = new THREE.Box3();
  for (const m of model.meshes) {
    m.geometry.computeBoundingBox();
    bindBox.union(m.geometry.boundingBox!);
  }
  const modelHeight = bindBox.max.y - bindBox.min.y;
  for (const m of model.meshes)
    if ((m as THREE.SkinnedMesh).isSkinnedMesh)
      for (const r of s.rebind ?? []) console.log(`rebind ${r.from} → ${r.to}: ${rebind(m as THREE.SkinnedMesh, r, modelHeight)} vertices`);
  // Stand the figure on the origin, scaled to its height in world px, centred on its hips.
  const restBox = new THREE.Box3().setFromObject(model.root, true);
  const k = s.height / (restBox.max.y - restBox.min.y);
  for (const m of model.meshes) {
    smoothNormals(m.geometry, (s.smooth * s.height) / k);
    m.material = mat;
    m.frustumCulled = false;
  }
  let hips: THREE.Object3D | undefined;
  model.root.traverse((o) => {
    if (!hips && /pelvis|hips/i.test(o.name)) hips = o;
  });
  const centre = new THREE.Vector3();
  if (hips) hips.getWorldPosition(centre);
  else restBox.getCenter(centre);
  const fit = new THREE.Group();
  fit.add(model.root);
  model.root.position.set(-centre.x, -restBox.min.y, -centre.z);
  fit.scale.setScalar(k);
  const turn = new THREE.Group();
  turn.add(fit);
  const tilt = new THREE.Group();
  tilt.add(turn);
  tilt.rotation.x = (s.pitch * Math.PI) / 180;
  // Outermost, in screen axes: holds the hips over the feet's spot (and, for an airborne clip, at rest height).
  const shift = new THREE.Group();
  shift.add(tilt);
  const scene = new THREE.Scene();
  scene.add(shift);
  const cam = new THREE.OrthographicCamera(BOX.x0, BOX.x1, BOX.y1, BOX.y0, 0.1, 200);
  cam.position.set(0, 0, 100);
  cam.lookAt(0, 0, 0);

  scene.updateMatrixWorld(true);
  const restHip = hips ? hips.getWorldPosition(new THREE.Vector3()).y : 0;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  const mixer = new THREE.AnimationMixer(model.root);
  const pin = new THREE.Vector3();

  const renderLayer = (scale: number, rt: THREE.WebGLRenderTarget, buf: Uint8Array): Layer => {
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
    renderer.setRenderTarget(null);
    return compose(buf, rt.width, rt.height, s, pal, scale);
  };

  const atlas = (scale: number, card: boolean): AtlasOut => {
    const fb = frameBox(scale);
    const rt = new THREE.WebGLRenderTarget(fb.w * s.ss, fb.h * s.ss, { depthBuffer: true, type: THREE.UnsignedByteType });
    rt.texture.minFilter = THREE.NearestFilter;
    rt.texture.magFilter = THREE.NearestFilter;
    const buf = new Uint8Array(rt.width * rt.height * 4);
    const frames: { clip: string; facing: 'r' | 'l'; layer: Layer; x0: number; y0: number; w: number; h: number; x: number; y: number }[] = [];
    for (const [name, c] of Object.entries(s.clips)) {
      if (card && !c.card) continue;
      if (only && !only.includes(name)) continue;
      const src = findClip(model.clips, c.src);
      for (const facing of ['r', 'l'] as const) {
        // Forward is +z in the model; a right-facing figure turns it to screen right, then a little toward us.
        turn.rotation.y = ((facing === 'r' ? 1 : -1) * (90 - s.yaw) * Math.PI) / 180;
        for (const t of sampleTimes(c, src.duration)) {
          mixer.stopAllAction();
          mixer.clipAction(src).play();
          mixer.setTime(t);
          shift.position.set(0, 0, 0);
          scene.updateMatrixWorld(true);
          if (hips) {
            // Every clip runs in place: the sim moves the body, so the hips stay over the spot the game draws at.
            // An airborne clip lifts the body too, and the sim already does that: hold the hips at rest height.
            hips.getWorldPosition(pin);
            shift.position.x = -pin.x;
            if (c.pin === 'hips') shift.position.y = restHip - pin.y;
            scene.updateMatrixWorld(true);
          }
          const layer = renderLayer(scale, rt, buf);
          // Trim to what's drawn.
          let x0 = layer.w;
          let y0 = layer.h;
          let x1 = -1;
          let y1 = -1;
          for (let y = 0; y < layer.h; y++)
            for (let x = 0; x < layer.w; x++)
              if (layer.rgba[(y * layer.w + x) * 4 + 3]) {
                x0 = Math.min(x0, x);
                x1 = Math.max(x1, x);
                y0 = Math.min(y0, y);
                y1 = Math.max(y1, y);
              }
          if (x1 < 0) x0 = y0 = x1 = y1 = 0;
          frames.push({ clip: name, facing, layer, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, x: 0, y: 0 });
        }
      }
    }
    rt.dispose();
    // One pixel of clear gutter round each frame, so filtering never bleeds a neighbour in.
    const boxes = frames.map((f) => ({ w: f.w + 2, h: f.h + 2, f, x: 0, y: 0 }));
    const { w, h } = shelfPack(boxes);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(w, h);
    const mk = document.createElement('canvas');
    mk.width = w;
    mk.height = h;
    const mg = mk.getContext('2d')!;
    const mimg = mg.createImageData(w, h);
    for (let i = 0; i < w * h; i++) mimg.data[i * 4 + 3] = 255;
    const out: AtlasOut['clips'] = {};
    for (const b of boxes) {
      const f = b.f;
      f.x = b.x + 1;
      f.y = b.y + 1;
      for (let y = 0; y < f.h; y++)
        for (let x = 0; x < f.w; x++) {
          const si = (f.y0 + y) * f.layer.w + f.x0 + x;
          const di = (f.y + y) * w + f.x + x;
          for (let c = 0; c < 4; c++) img.data[di * 4 + c] = f.layer.rgba[si * 4 + c];
          mimg.data[di * 4] = f.layer.masks.paint[si];
          mimg.data[di * 4 + 1] = f.layer.masks.player[si];
        }
    }
    for (const f of frames) {
      // A grounded clip stands on the floor: a sole the clip rolls under it (a heel-toe walk, the camera's
      // tilt) lifts the frame instead of sinking the runner, leaving at most half a world px of antialiasing.
      const ay = s.clips[f.clip].pin === 'hips' ? fb.ay - f.y0 : Math.max(fb.ay - f.y0, f.h - scale * 0.5);
      const rect: FrameRect = { x: f.x, y: f.y, w: f.w, h: f.h, ax: fb.ax - f.x0, ay };
      ((out[f.clip] ??= { r: [], l: [] })[f.facing] as FrameRect[]).push(rect);
    }
    g.putImageData(img, 0, 0);
    mg.putImageData(mimg, 0, 0);
    return { scale, png: cv.toDataURL('image/png'), masks: mk.toDataURL('image/png'), w, h, clips: out };
  };

  const play = atlas(s.scales.play, false);
  const card = Object.values(s.clips).some((c) => c.card) ? atlas(s.scales.card, true) : null;
  renderer.dispose();
  return { play, card, roles: pal.names };
}
