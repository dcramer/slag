import * as THREE from 'three';
import { BOX, type Clip, type Key, type Prop, type Settings } from '../settings';
import { ballFrames } from './ball';
import { loadModel } from './load';
import { classify } from './roles';
import { shaped } from './shapes';
import { centreOf, steady, trace, type Traced } from './trace';
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
out vec3 vBind;
out float vDepth;
void main() {
  vUv = uv;
  #include <skinbase_vertex>
  #include <begin_vertex>
  vBind = transformed;
  #include <skinning_vertex>
  #include <project_vertex>
  vDepth = -mvPosition.z;
}`;

const FRAG = /* glsl */ `
precision highp float;
precision highp usampler2D;
uniform usampler2D roles;
uniform int fixedRole;
// Regions: texels of role \`from\` inside a box of the bind pose's bounds (fractions) become role \`to\`.
uniform int regionFrom[4];
uniform int regionTo[4];
uniform vec3 regionMin[4];
uniform vec3 regionMax[4];
uniform vec3 bindMin;
uniform vec3 bindSize;
in vec3 vBind;
in vec2 vUv;
in float vDepth;
out vec4 color;
void main() {
  uint r = fixedRole >= 0 ? uint(fixedRole) : texture(roles, vUv).r;
  vec3 u = (vBind - bindMin) / bindSize;
  for (int i = 0; i < 4; i++)
    if (fixedRole < 0 && regionFrom[i] == int(r) && all(greaterThanEqual(u, regionMin[i])) && all(lessThanEqual(u, regionMax[i]))) r = uint(regionTo[i]);
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
  if (s.shape) return shaped(s, only);
  const model = await loadModel(url);
  const names = Object.keys(s.roles);
  if (!model.texture) throw new Error('the model has no colour texture to read roles from');
  const roleTex = classify(model.texture, s.roles, names);
  const bindBox = new THREE.Box3();
  for (const m of model.meshes) {
    m.geometry.computeBoundingBox();
    bindBox.union(m.geometry.boundingBox!);
  }
  // Up to four regions; unused ones match no role.
  const regions = Array.from({ length: 4 }, (_, i) => {
    const r = s.regions?.[i];
    if (!r) return { from: -2, to: 0, min: new THREE.Vector3(), max: new THREE.Vector3() };
    const from = names.indexOf(r.from);
    const to = names.indexOf(r.to);
    if (from < 0 || to < 0) throw new Error(`region ${r.from} → ${r.to}: no such role`);
    return { from, to, min: new THREE.Vector3(r.box[0], r.box[1], r.box[2]), max: new THREE.Vector3(r.box[3], r.box[4], r.box[5]) };
  });
  const material = (fixed: number) =>
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      glslVersion: THREE.GLSL3,
      uniforms: {
        roles: { value: roleTex },
        fixedRole: { value: fixed },
        regionFrom: { value: regions.map((r) => r.from) },
        regionTo: { value: regions.map((r) => r.to) },
        regionMin: { value: regions.map((r) => r.min) },
        regionMax: { value: regions.map((r) => r.max) },
        bindMin: { value: bindBox.min },
        bindSize: { value: bindBox.getSize(new THREE.Vector3()) },
      },
      side: THREE.DoubleSide,
    });
  const body = material(-1);

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
  // Accessory slots: each slot's options in order, and the roles that are theirs.
  const slotNames = Object.keys(s.slots ?? {});
  const options: THREE.Group[][][] = slotNames.map(() => []);
  const optionRoles: Set<number>[][] = slotNames.map(() => []);
  for (const p of s.props ?? []) {
    const holders = addProp(p);
    if (!p.slot) continue;
    const si = slotNames.indexOf(p.slot);
    if (si < 0) throw new Error(`prop slot "${p.slot}" isn't in slots`);
    options[si].push(holders);
    optionRoles[si].push(new Set(p.parts.map((q) => names.indexOf(q.role))));
  }
  /** Shows option `k` of slot `si` and hides its others. */
  const show = (si: number, k: number) => options[si].forEach((hs, i) => hs.forEach((h) => (h.visible = i === k)));
  options.forEach((_, si) => show(si, 0));
  /** A group on bone `name` that undoes its turn and scale: its children are placed in the figure's rest axes, in world px. */
  function holderOn(name: string): THREE.Group {
    const b = bone(name);
    const holder = new THREE.Group();
    holder.quaternion.copy(inModel(b, rootQ()).invert());
    holder.scale.setScalar(1 / b.getWorldScale(new THREE.Vector3()).x);
    b.add(holder);
    return holder;
  }
  /** The prop on its bone, and a holder of its own for each part on another bone (a wear option's marks). */
  function addProp(p: Prop): THREE.Group[] {
    const holder = holderOn(p.bone);
    const holders = [holder];
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
            : part.shape === 'box'
              ? new THREE.BoxGeometry(a, h, c)
              : new THREE.SphereGeometry(1, 16, 12).scale(a, h, c);
      const mesh = new THREE.Mesh(geo, material(names.indexOf(part.role)));
      if (part.at) mesh.position.set(...part.at);
      if (part.rot) mesh.rotation.set(rad(part.rot[0]), rad(part.rot[1]), rad(part.rot[2]));
      mesh.frustumCulled = false;
      if (part.bone) {
        const own = holderOn(part.bone);
        own.add(mesh);
        holders.push(own);
        if (part.face) stick(own, mesh, part.at ?? [0, 0, 0], part.face, part.rot?.[2] ?? 0);
      } else rig.add(mesh);
    }
    return holders;
  }
  /**
   * A wear mark stuck on the skin: from \`at\` (inside the limb, from the joint) out along \`face\` to where
   * the model's surface is, at rest, and turned flat against it, spun \`spin\` degrees about the way it faces.
   * Half of it sinks into the body, so what shows is a flat cap the outline of the mark.
   */
  function stick(holder: THREE.Group, mesh: THREE.Mesh, at: [number, number, number], face: [number, number, number], spin: number) {
    holder.updateMatrixWorld(true);
    const dir = new THREE.Vector3(...face).normalize();
    const from = holder.localToWorld(new THREE.Vector3(...at));
    const out = holder
      .localToWorld(new THREE.Vector3(...at).addScaledVector(dir, 1))
      .sub(from)
      .normalize();
    const ray = new THREE.Raycaster(from.clone().addScaledVector(out, 200), out.clone().negate());
    const hit = ray.intersectObjects(model.meshes, false)[0];
    if (!hit) throw new Error(`a wear mark on ${holder.parent?.name} along ${face.join(',')} meets no skin`);
    mesh.position.copy(holder.worldToLocal(hit.point.clone()));
    mesh.quaternion
      .setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rad(spin)));
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

  // Where the face kit draws the eyes, the model's own eye roles are drawn as what they sit on (`covers`),
  // inside the head only (a white eye and a white shoe strap are one role), so a traced white doesn't show
  // round the drawn eye.
  const covers = Object.entries(s.face?.covers ?? {}).map(([from, to]) => {
    const a = names.indexOf(from);
    const b = names.indexOf(to);
    if (a < 0 || b < 0) throw new Error(`face.covers ${from} → ${to}: no such role`);
    return [a, b] as const;
  });
  /** Renders and traces the pose; `face` (x, y, radius) is where `covers` applies. */
  const shoot = (face?: readonly number[]): Traced => {
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
    if (face && covers.length) {
      const [hx, hy, hr] = face;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const c = covers.find(([a]) => a === role[i]);
          if (c && Math.hypot((x + 0.5) / R + BOX.x0 - hx, (y + 0.5) / R - BOX.y1 - hy) < hr) role[i] = c[1];
        }
    }
    return trace(role, depth, W, H, R, s, names);
  };

  /** The pixel at a traced point (world px, y down), or -1 off the frame. */
  const pixelAt = (x: number, y: number) => {
    const px = Math.floor((x - BOX.x0) * R);
    const py = Math.floor((y + BOX.y1) * R);
    return px < 0 || py < 0 || px >= W || py >= H ? -1 : py * W + px;
  };

  /**
   * The eyes the tracer or the anchor finds on a frame, near first (x, y, radius in world px): the eye
   * role's parts, or, for a kind whose eyes are too small to trace, set from its nose, turned with a
   * rolled pose (`roll`, radians).
   */
  const foundEyes = (tr: Traced, facing: 'r' | 'l', roll = 0): number[] => {
    const a = s.face?.anchor;
    if (!a) return tr.eyes;
    const ri = names.indexOf(a.role);
    let best: number[] | null = null;
    for (const p of tr.parts) if (p.role === ri && (!best || p.ring.length > best.length)) best = p.ring;
    if (!best) return [];
    const [cx, cy] = centreOf(best);
    const f = facing === 'r' ? 1 : -1;
    // Turned with a rolled figure (y down here, so the screen's turn the other way).
    const t = facing === 'r' ? -roll : roll;
    const at = (o: readonly [number, number]) => [cx + f * o[0] * Math.cos(t) + o[1] * Math.sin(t), cy - f * o[0] * Math.sin(t) + o[1] * Math.cos(t)];
    return [...at(a.near), s.face!.r, ...at(a.far ?? a.near), s.face!.r];
  };

  /**
   * The face rides the head. The eyes are found once, on the rest pose facing right, and lifted onto the
   * head in 3D: the near eye onto the surface the camera sees there, the far one its mirror across the
   * head's middle. Every frame then projects them through its own pose, turn and roll, so they stay on
   * the face however the head moves, and an eye turned away or hidden behind something nearer isn't
   * drawn. A kind without a head bone (a generated ball) keeps the eyes the tracer finds per frame.
   */
  const rig = (() => {
    const head = s.face
      ? (bones.find((b) => b.name === (s.face?.bone ?? 'head')) ?? bones.find((b) => /head/i.test(b.name) && !/end|top|nub/i.test(b.name)))
      : undefined;
    if (!head || !s.face) return null;
    rest();
    shift.position.set(0, 0, 0);
    shift.rotation.set(0, 0, 0);
    turn.rotation.y = rad(90 - s.yaw);
    scene.updateMatrixWorld(true);
    // The head's own shape: the skin weighted most to it or a bone below it.
    const under = new Set<THREE.Object3D>();
    head.traverse((o) => under.add(o));
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const m of skinned) {
      const idx = m.geometry.getAttribute('skinIndex');
      const wt = m.geometry.getAttribute('skinWeight');
      for (let i = 0; i < idx.count; i++) {
        let bi = 0;
        let bw = -1;
        for (let c = 0; c < 4; c++)
          if (wt.getComponent(i, c) > bw) {
            bw = wt.getComponent(i, c);
            bi = idx.getComponent(i, c);
          }
        if (!under.has(m.skeleton.bones[bi])) continue;
        m.getVertexPosition(i, v);
        box.expandByPoint(m.localToWorld(v));
      }
    }
    if (box.isEmpty()) throw new Error(`the head bone "${head.name}" carries no skin`);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const tr = shoot();
    const eyes = foundEyes(tr, 'r');
    if (!eyes.length) throw new Error('no eyes on the rest pose: give the eye role `glint`, or set face.anchor');
    // The near eye, on the surface the camera sees at that spot (or the nearest the figure covers).
    let at = -1;
    const [ex, ey] = eyes;
    for (let ring = 0; ring <= 6 && at < 0; ring++)
      for (let dy = -ring; dy <= ring && at < 0; dy++)
        for (let dx = -ring; dx <= ring && at < 0; dx++) {
          const j = pixelAt(ex + dx / R, ey + dy / R);
          if (j >= 0 && role[j] >= 0) at = j;
        }
    if (at < 0) throw new Error(`the rest pose's eye at ${ex.toFixed(1)}, ${ey.toFixed(1)} isn't on the figure`);
    const near = new THREE.Vector3(ex, -ey, 100 - depth[at]);
    // Its mirror across the head's middle, in the model's own axes (x across the figure).
    const nearM = model.root.worldToLocal(near.clone());
    const midM = model.root.worldToLocal(centre.clone());
    // `spread` sets them further apart than the model's own (a model's small close-set eyes, drawn as the
    // cartoon's), each about the head's middle.
    const half = (nearM.x - midM.x) * (s.face.spread ?? 1);
    const near3 = model.root.localToWorld(new THREE.Vector3(midM.x + half, nearM.y, nearM.z));
    const far = model.root.localToWorld(new THREE.Vector3(midM.x - half, nearM.y, nearM.z));
    const q = head.getWorldQuaternion(new THREE.Quaternion());
    const turnOf = (p: THREE.Vector3) => p.clone().sub(centre).normalize().z;
    return {
      head,
      eyes: [near3, far].map((p) => head.worldToLocal(p.clone())),
      centre: head.worldToLocal(centre.clone()),
      /** Up, in the head's own axes: its tilt on screen each frame. */
      up: new THREE.Vector3(0, 1, 0).applyQuaternion(q.clone().invert()),
      /** Every point of the head is inside this sphere, however it turns. */
      r: size.length() / 2,
      /** The face's reach on screen at rest, from the head's middle: where `covers` applies. */
      face: Math.max(size.x, size.y) / 2,
      scale: head.getWorldScale(new THREE.Vector3()).x,
      /** How squarely the near eye faces the camera at rest: the turn the face's size is set at. */
      turn: turnOf(near3),
    };
  })();
  /** Least that an eye faces the camera to be drawn; and how far behind the surface in front it may sit (world px). */
  const TURNED_AWAY = 0.12;
  const HIDDEN = 1.2;
  /** How far round an eye the figure must reach (world px): it sits in the face, never on the outline. */
  const AROUND = [
    [0.6, 0],
    [-0.6, 0],
    [0, 0.6],
    [0, -0.6],
  ] as const;
  /** The furthest an eye at the face's edge is moved in to sit on it (world px). */
  const NUDGE = 1.25;
  const free = names.map((n) => !!s.roles[n].free);
  const solid = (j: number) => j >= 0 && role[j] >= 0 && !free[role[j]];

  /** The head through this frame's pose: its middle, radius and tilt on screen, and its scale against rest. */
  const headNow = () => {
    if (!rig) return null;
    const { head } = rig;
    const hs = head.getWorldScale(new THREE.Vector3()).x / rig.scale;
    const c = head.localToWorld(rig.centre.clone());
    const up = rig.up.clone().applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
    return { c, hs, at: [c.x, -c.y, rig.r * hs, Math.atan2(up.x, up.y)], face: [c.x, -c.y, rig.face * hs] };
  };

  /** The eyes that show on this frame (near first), and its head, from the render just shot. */
  const faceNow = (tr: Traced, h: NonNullable<ReturnType<typeof headNow>>) => {
    if (!rig || !s.face) return;
    const shown: { x: number; y: number; r: number; d: number }[] = [];
    for (const p of rig.eyes) {
      const w = rig.head.localToWorld(p.clone());
      const turned = w.clone().sub(h.c).normalize().z;
      if (turned < TURNED_AWAY) continue;
      const d = 100 - w.z;
      const j = pixelAt(w.x, -w.y);
      if (j < 0 || role[j] < 0 || depth[j] < d - HIDDEN) continue;
      // Well inside the outline, not on its edge where the traced line may cut in past it: an eye at the
      // face's front edge (the far eye of a turned head) is drawn a little in from it, toward the head's middle.
      const toward = Math.hypot(h.c.x - w.x, h.c.y - w.y) || 1;
      let x = w.x;
      let y = -w.y;
      for (let k = 0; k <= NUDGE / 0.25; k++) {
        x = w.x + ((h.c.x - w.x) / toward) * k * 0.25;
        y = -(w.y + ((h.c.y - w.y) / toward) * k * 0.25);
        if (AROUND.every(([dx, dy]) => solid(pixelAt(x + dx, y + dy)))) break;
        x = NaN;
      }
      if (Number.isNaN(x)) continue;
      // Foreshortened as it turns away: the far eye of a three-quarter head is the smaller.
      const r = s.face.r * h.hs * Math.min(1.1, Math.max(0.7, 0.7 + (0.3 * turned) / rig.turn));
      shown.push({ x, y, r, d });
    }
    shown.sort((a, b) => a.d - b.d);
    tr.eyes = shown.flatMap((e) => [e.x, e.y, e.r]);
    tr.head = [...h.at];
  };

  const out: Record<string, TracedClip> = {};
  for (const [name, c] of Object.entries(s.clips)) {
    if (only && !only.includes(name)) continue;
    const tc: TracedClip = { r: [], l: [] };
    for (const facing of ['r', 'l'] as const) {
      if (c.ball) {
        if (!s.ball) throw new Error(`clip ${name} is a ball, but the settings have no ball`);
        tc[facing] = ballFrames(s.ball, names, c.frames, facing);
        continue;
      }
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
        const h = headNow();
        const tr = shoot(h?.face);
        // Before the accessory passes reuse the depth buffer the eyes are checked against.
        if (h) faceNow(tr, h);
        else tr.eyes = foundEyes(tr, facing, roll);
        // Accessories: option 0 of every slot is in this pass; each other option gets a pass of its own, and
        // only its parts are kept. Every option's parts are tagged with their slot and option.
        for (let si = 0; si < slotNames.length; si++) {
          for (const p of tr.parts) if (optionRoles[si][0].has(p.role)) p.option = [si, 0];
          for (let k = 1; k < options[si].length; k++) {
            show(si, k);
            scene.updateMatrixWorld(true);
            const alt = shoot(h?.face);
            for (const p of alt.parts)
              if (optionRoles[si][k].has(p.role)) {
                p.option = [si, k];
                tr.parts.push(p);
              }
          }
          show(si, 0);
          scene.updateMatrixWorld(true);
        }
        tr.parts.sort((a, b) => b.depth - a.depth);
        for (const p of tr.parts) {
          const grow = s.roles[names[p.role]].grow;
          if (!grow) continue;
          // Bigger about its back edge, so a bill or a nose reaches further forward from where it starts:
          // forward as the head faces, so on a head tipped over (a fall, a lean) it doesn't swell over the face.
          const a = tr.head?.[3] ?? 0;
          const [ox, oy] = centreOf(p.ring);
          const turnBy = (ring: number[], by: number) => {
            const cs = Math.cos(by);
            const sn = Math.sin(by);
            for (let i = 0; i < ring.length; i += 2) {
              const dx = ring[i] - ox;
              const dy = ring[i + 1] - oy;
              ring[i] = ox + dx * cs - dy * sn;
              ring[i + 1] = oy + dx * sn + dy * cs;
            }
          };
          if (a) turnBy(p.ring, -a);
          let x0 = Infinity;
          let x1 = -Infinity;
          let cy = 0;
          for (let i = 0; i < p.ring.length; i += 2) {
            x0 = Math.min(x0, p.ring[i]);
            x1 = Math.max(x1, p.ring[i]);
            cy += p.ring[i + 1];
          }
          cy /= p.ring.length / 2;
          const ax = facing === 'r' ? x0 : x1;
          p.ring = p.ring.map((v, i) => (i % 2 ? cy + (v - cy) * grow[1] : ax + (v - ax) * grow[0]));
          if (a) turnBy(p.ring, a);
        }
        const girth = c.girth ?? s.girth ?? 1;
        if (girth !== 1) {
          // The figure drawn wider than the model, about the feet: a stout build reads at race size.
          const g = girth;
          const wide = (r: number[]) => r.forEach((v, i) => i % 2 === 0 && (r[i] = v * g));
          tr.sil.forEach(wide);
          tr.parts.forEach((p) => wide(p.ring));
          for (let i = 0; i < tr.eyes.length; i += 3) tr.eyes[i] *= g;
          if (tr.head) {
            tr.head[0] *= g;
            tr.head[2] *= Math.max(1, g);
          }
        }
        if (c.center) {
          // A figure lying down is as long as it was tall: centred on the spot, it stays inside the runner's box.
          let x0 = Infinity;
          let x1 = -Infinity;
          for (const ring of [...tr.sil, ...tr.parts.map((p) => p.ring)])
            for (let i = 0; i < ring.length; i += 2) {
              x0 = Math.min(x0, ring[i]);
              x1 = Math.max(x1, ring[i]);
            }
          const dx = (x0 + x1) / 2;
          const by = (r: number[]) => r.forEach((v, i) => i % 2 === 0 && (r[i] = v - dx));
          tr.sil.forEach(by);
          tr.parts.forEach((p) => by(p.ring));
          for (let i = 0; i < tr.eyes.length; i += 3) tr.eyes[i] -= dx;
          if (tr.head) tr.head[0] -= dx;
        }
        if (c.pin !== 'hips') {
          // A grounded clip stands on the floor: a sole it rolls under (a heel-toe walk, the camera's tilt)
          // lifts the figure instead of sinking the runner.
          let low = -Infinity;
          // Grown parts count: a nose drawn bigger on a head lying down mustn't sink through the floor.
          for (const ring of [...tr.sil, ...tr.parts.filter((p) => !free[p.role]).map((p) => p.ring)])
            for (let i = 1; i < ring.length; i += 2) low = Math.max(low, ring[i]);
          // The soles sit just above the floor line, where the pen's ink round them lands on it.
          const lift = low > -FLOOR ? low + FLOOR : 0;
          if (lift) {
            const up = (r: number[]) => r.forEach((v, i) => i % 2 && (r[i] = v - lift));
            tr.sil.forEach(up);
            tr.parts.forEach((p) => up(p.ring));
            for (let i = 1; i < tr.eyes.length; i += 3) tr.eyes[i] -= lift;
            if (tr.head) tr.head[1] -= lift;
          }
        }
        // Shapes that only moved keep their lines from the frame before.
        const before = tc[facing].at(-1);
        if (before) steady(before, tr, 0.12);
        tc[facing].push(tr);
      }
    }
    out[name] = tc;
  }
  rt.dispose();
  renderer.dispose();
  return { clips: out, roles: names };
}
