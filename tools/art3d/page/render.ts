import * as THREE from 'three';
import { BOX, type Clip, type Key, type Prop, type Settings } from '../settings';
import { loadModel } from './load';
import { classify } from './roles';
import { trace, type Traced } from './trace';
import { rebind } from './weights';

/**
 * Renders a kind's clips into traced frames. A fixed orthographic camera looks at the figure side on;
 * one pass writes each pixel's role (from the classified texture, or a prop's own) and depth, and
 * `trace` (trace.ts) cuts that into the flat parts the game inks. Poses come from the model's animations
 * or are keyed here from the pose sheet; the figure is caricatured (bone scales) and carries its
 * signature prop (built from primitives) before any of it is rendered.
 */

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
out vec2 vUv;
out float vDepth;
void main() {
  vUv = uv;
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vDepth = -mvPosition.z;
}`;

const FRAG = /* glsl */ `
precision highp float;
precision highp usampler2D;
uniform usampler2D roles;
uniform int fixedRole;
in vec2 vUv;
in float vDepth;
out vec4 color;
void main() {
  uint r = fixedRole >= 0 ? uint(fixedRole) : texture(roles, vUv).r;
  float d = clamp(vDepth / 200.0, 0.0, 1.0) * 65535.0;
  float hi = floor(d / 256.0);
  color = vec4(float(r + 1u) / 255.0, hi / 255.0, (d - hi * 256.0) / 255.0, 1.0);
}`;

export interface TracedClip {
  r: Traced[];
  l: Traced[];
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

/** Every clip's sample times, as fractions of its source (or of its key sequence). */
export function sampleTimes(c: Clip): number[] {
  const from = c.from ?? 0;
  const to = c.to ?? 1;
  const n = c.frames;
  const div = c.loop ? n : Math.max(1, n - 1);
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / div);
}

const rad = (d: number) => (d * Math.PI) / 180;
/** How far above the floor a grounded frame's lowest outline point may sit (world px): the pen's mass reaches below it. */
const FLOOR = 0.6;

export async function renderSprites(url: string, s: Settings, only?: string[]) {
  const model = await loadModel(url);
  const names = Object.keys(s.roles);
  if (!model.texture) throw new Error('the model has no colour texture to read roles from');
  const roleTex = classify(model.texture, s.roles, names);
  const material = (fixed: number) =>
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      glslVersion: THREE.GLSL3,
      uniforms: { roles: { value: roleTex }, fixedRole: { value: fixed } },
      side: THREE.DoubleSide,
    });
  const body = material(-1);

  const bindBox = new THREE.Box3();
  for (const m of model.meshes) {
    m.geometry.computeBoundingBox();
    bindBox.union(m.geometry.boundingBox!);
  }
  const modelHeight = bindBox.max.y - bindBox.min.y;
  const skinned = model.meshes.filter((m) => (m as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh[];
  for (const m of skinned) for (const r of s.rebind ?? []) console.log(`rebind ${r.from} → ${r.to}: ${rebind(m, r, modelHeight)} vertices`);
  for (const m of model.meshes) {
    m.material = body;
    m.frustumCulled = false;
  }

  // Bones parents first, by name.
  const bones: THREE.Bone[] = [];
  model.root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
  });
  const bone = (n: string) => {
    const b = bones.find((b) => b.name === n);
    if (!b) throw new Error(`no bone "${n}"; the skeleton has ${bones.map((b) => b.name).join(', ')}`);
    return b;
  };
  const scaled = Object.entries(s.scale ?? {}).map(([n, f]) => [bone(n), f] as const);
  const caricature = () => {
    for (const [b, f] of scaled) b.scale.setScalar(f);
  };
  const rest = () => {
    for (const m of skinned) m.skeleton.pose();
    caricature();
  };
  rest();

  // Stand the figure on the origin, scaled to its height in world px, centred on its hips.
  model.root.updateMatrixWorld(true);
  const restBox = new THREE.Box3().setFromObject(model.root, true);
  const k = s.height / (restBox.max.y - restBox.min.y);
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
  tilt.rotation.x = rad(s.pitch);
  // Outermost, in screen axes: holds the hips over the feet's spot, at rest height when pinned, and rolls.
  const shift = new THREE.Group();
  shift.add(tilt);
  const scene = new THREE.Scene();
  scene.add(shift);
  scene.updateMatrixWorld(true);

  // The figure's own axes, as a quaternion from the model root: bones are turned in these.
  const rootQ = () => model.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const inModel = (o: THREE.Object3D, rq: THREE.Quaternion) => rq.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));

  // Props, on their bones, in the rest pose's axes and world px.
  for (const p of s.props ?? []) addProp(p);
  function addProp(p: Prop) {
    const b = bone(p.bone);
    const rq = rootQ();
    const holder = new THREE.Group();
    holder.quaternion.copy(inModel(b, rq).invert());
    const ws = b.getWorldScale(new THREE.Vector3()).x;
    holder.scale.setScalar(1 / ws);
    const rig = new THREE.Group();
    rig.position.set(...p.at);
    rig.rotation.set(rad(p.rot[0]), rad(p.rot[1]), rad(p.rot[2]));
    holder.add(rig);
    for (const part of p.parts) {
      const [a, h, c] = part.size;
      const geo =
        part.shape === 'cylinder'
          ? new THREE.CylinderGeometry(a, a, h, 14)
          : part.shape === 'cup'
            ? new THREE.SphereGeometry(a, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / a, 1)
            : new THREE.SphereGeometry(1, 16, 12).scale(a, h, c);
      const mesh = new THREE.Mesh(geo, material(names.indexOf(part.role)));
      if (part.at) mesh.position.set(...part.at);
      mesh.frustumCulled = false;
      rig.add(mesh);
    }
    b.add(holder);
  }

  scene.updateMatrixWorld(true);
  const restHip = hips ? hips.getWorldPosition(new THREE.Vector3()).y : 0;
  // The hips' turn in the model's own space at rest, for clips that keep the figure facing its way.
  const restTurn = hips ? inModel(hips, rootQ()).invert() : null;
  const fwd = new THREE.Vector3();
  const cam = new THREE.OrthographicCamera(BOX.x0, BOX.x1, BOX.y1, BOX.y0, 0.1, 200);
  cam.position.set(0, 0, 100);
  cam.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  const mixer = new THREE.AnimationMixer(model.root);
  const pin = new THREE.Vector3();

  /**
   * Poses the figure as `key` for a facing. `_near` and `_far` name the limbs on the camera's side and the
   * other, authored as the figure faces right (near is its right); facing left they swap sides and mirror,
   * so a turn about y or z changes sign.
   */
  const poseKey = (key: Key, facing: 'r' | 'l') => {
    const near = facing === 'r' ? '_r' : '_l';
    const far = facing === 'r' ? '_l' : '_r';
    const mirror = (n: string, e: [number, number, number]): [number, number, number] => (facing === 'l' && /_(near|far)$/.test(n) ? [e[0], -e[1], -e[2]] : e);
    const turns = new Map(Object.entries(key.bones ?? {}).map(([n, e]) => [n.replace(/_near$/, near).replace(/_far$/, far), mirror(n, e)] as const));
    mixer.stopAllAction();
    if (key.from === 'rest') rest();
    else {
      const [clip, at] = key.from.split('@');
      const src = findClip(model.clips, clip);
      mixer.clipAction(src).play();
      mixer.setTime(Number(at ?? 0) * src.duration);
      caricature();
    }
    scene.updateMatrixWorld(true);
    const rq = rootQ();
    for (const b of bones) {
      const e = turns.get(b.name);
      if (!e) continue;
      const turnBy = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(e[0]), rad(e[1]), rad(e[2]), 'XYZ'));
      const now = turnBy.multiply(inModel(b, rq));
      const parent = b.parent ? inModel(b.parent, rq) : new THREE.Quaternion();
      b.quaternion.copy(parent.invert().multiply(now));
      b.updateMatrixWorld(true);
      b.updateMatrixWorld(true);
    }
    for (const [n, f] of Object.entries(key.scale ?? {})) {
      // A stretch, on top of the caricature: a fist punched up past a big head.
      const b = bone(n.replace(/_near$/, near).replace(/_far$/, far));
      b.scale.multiplyScalar(f);
      b.updateMatrixWorld(true);
    }
  };
  /** Every bone's local turn, to blend two keys by. */
  const snapshot = () => bones.map((b) => ({ q: b.quaternion.clone(), s: b.scale.x }));

  /** Poses the figure for sample `u` of clip `c`; returns the roll to apply about the hips. */
  const poseAt = (c: Clip, u: number, facing: 'r' | 'l'): { roll: number; yaw: number } => {
    if (c.keys) {
      const keys = c.keys.map((n) => {
        const key = s.keys?.[n];
        if (!key) throw new Error(`clip keys "${n}", which isn't in keys`);
        return key;
      });
      const span = c.loop ? keys.length : keys.length - 1;
      const at = Math.max(0, u * span);
      const i = Math.min(keys.length - 1, Math.floor(at));
      const j = c.loop ? (i + 1) % keys.length : Math.min(keys.length - 1, i + 1);
      const f = at - Math.floor(at);
      poseKey(keys[j], facing);
      const b = snapshot();
      poseKey(keys[i], facing);
      if (f > 0 && i !== j) {
        bones.forEach((bn, n) => {
          bn.quaternion.slerp(b[n].q, f);
          bn.scale.setScalar(bn.scale.x + (b[n].s - bn.scale.x) * f);
        });
        scene.updateMatrixWorld(true);
      }
      const lerp = (a = 0, b = 0) => rad(a * (1 - f) + b * f);
      return { roll: lerp(keys[i].roll, keys[j].roll), yaw: lerp(keys[i].yaw, keys[j].yaw) };
    }
    const src = findClip(model.clips, c.src!);
    mixer.stopAllAction();
    mixer.clipAction(src).play();
    mixer.setTime(u * src.duration);
    caricature();
    return { roll: 0, yaw: 0 };
  };

  const R = s.trace.res;
  const W = (BOX.x1 - BOX.x0) * R;
  const H = (BOX.y1 - BOX.y0) * R;
  const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true, type: THREE.UnsignedByteType });
  rt.texture.minFilter = THREE.NearestFilter;
  rt.texture.magFilter = THREE.NearestFilter;
  const buf = new Uint8Array(W * H * 4);
  const role = new Int16Array(W * H);
  const depth = new Float32Array(W * H);

  const shoot = (): Traced => {
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    renderer.setRenderTarget(null);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const j = (src + x) * 4;
        role[y * W + x] = buf[j] - 1;
        depth[y * W + x] = ((buf[j + 1] * 256 + buf[j + 2]) / 65535) * 200;
      }
    }
    return trace(role, depth, W, H, R, s, names);
  };

  const out: Record<string, TracedClip> = {};
  for (const [name, c] of Object.entries(s.clips)) {
    if (only && !only.includes(name)) continue;
    const tc: TracedClip = { r: [], l: [] };
    for (const facing of ['r', 'l'] as const) {
      // Forward is +z in the model; a right-facing figure turns it to screen right, then a little toward us.
      const base = rad((facing === 'r' ? 1 : -1) * (90 - s.yaw));
      for (const u of sampleTimes(c)) {
        shift.position.set(0, 0, 0);
        shift.rotation.set(0, 0, 0);
        turn.rotation.y = base;
        const { roll, yaw } = poseAt(c, u, facing);
        // A keyed pose may turn further toward us, as a 2D artist cheats a pose round to show it.
        turn.rotation.y = base - (facing === 'r' ? yaw : -yaw);
        scene.updateMatrixWorld(true);
        if (c.face && hips && restTurn) {
          // A motion that turns the whole body round (a spin made from a description) is turned back, so
          // the figure keeps facing its way: only its turn about the vertical goes, a flip or a tuck stays.
          fwd.set(0, 0, 1).applyQuaternion(inModel(hips, rootQ()).multiply(restTurn));
          turn.rotation.y = base - Math.atan2(fwd.x, fwd.z);
          scene.updateMatrixWorld(true);
        }
        if (hips) {
          // Every clip runs in place: the sim moves the body, so the hips stay over the spot the game draws at.
          // An airborne clip lifts the body too, and the sim already does that: hold the hips at rest height.
          hips.getWorldPosition(pin);
          shift.position.x = -pin.x;
          if (c.pin === 'hips') shift.position.y = restHip - pin.y;
          scene.updateMatrixWorld(true);
          if (roll) {
            // A spin about the hips, in the screen's plane, facing the way the figure faces.
            hips.getWorldPosition(pin);
            const a = facing === 'r' ? -roll : roll;
            const sp = shift.position
              .clone()
              .sub(pin)
              .applyAxisAngle(new THREE.Vector3(0, 0, 1), a);
            shift.position.copy(pin).add(sp);
            shift.rotation.z = a;
            scene.updateMatrixWorld(true);
          }
        }
        const tr = shoot();
        if (c.center) {
          // A figure lying down is as long as it was tall: centred on the spot, it stays inside the runner's box.
          let x0 = Infinity;
          let x1 = -Infinity;
          for (const ring of tr.sil)
            for (let i = 0; i < ring.length; i += 2) {
              x0 = Math.min(x0, ring[i]);
              x1 = Math.max(x1, ring[i]);
            }
          const dx = (x0 + x1) / 2;
          const by = (r: number[]) => r.forEach((v, i) => i % 2 === 0 && (r[i] = v - dx));
          tr.sil.forEach(by);
          tr.parts.forEach((p) => by(p.ring));
          for (let i = 0; i < tr.glints.length; i += 3) tr.glints[i] -= dx;
        }
        if (c.pin !== 'hips') {
          // A grounded clip stands on the floor: a sole it rolls under (a heel-toe walk, the camera's tilt)
          // lifts the figure instead of sinking the runner.
          let low = -Infinity;
          for (const ring of tr.sil) for (let i = 1; i < ring.length; i += 2) low = Math.max(low, ring[i]);
          // The soles sit just above the floor line, where the pen's ink round them lands on it.
          const lift = low > -FLOOR ? low + FLOOR : 0;
          if (lift) {
            const up = (r: number[]) => r.forEach((v, i) => i % 2 && (r[i] = v - lift));
            tr.sil.forEach(up);
            tr.parts.forEach((p) => up(p.ring));
            for (let i = 1; i < tr.glints.length; i += 3) tr.glints[i] -= lift;
          }
        }
        tc[facing].push(tr);
      }
    }
    out[name] = tc;
  }
  rt.dispose();
  renderer.dispose();
  return { clips: out, roles: names };
}
