import * as THREE from 'three';
import type { Model } from './load';

/**
 * The puffball's body, generated rather than modelled: a ball is the one shape image-to-3D can only make
 * worse, and a rig built here has exactly the bones its keyed poses need. It's a cheap vinyl squeeze toy
 * (docs/CHARACTERS.md → The pink puffball): a ball moulded in two halves, front and back, with the seam
 * standing proud between them, a squeaker valve out of its back, stubby arms, and two big oval feet (the
 * mould number under one is left off: no pose the game draws shows a sole). Every part is painted in a flat key colour that `sprite.json`'s roles
 * pick out, as they would from a model's texture; the mouth is painted on the ball, and the face kit sets the
 * eyes and blush by it.
 *
 * Units: the ball's radius is 1; the renderer scales the figure to `height` world px. Axes as a model's:
 * x the figure's left, y up, z forward. Bones: `hips` at the ball's centre; `body` (the ball, seam and
 * valve) and the feet under it; the arms under `body`, so the ball puffs up with its arms on. Every bone
 * sits at the ball's centre, so a turn swings an arm or a foot round the ball, as the toy's own would.
 */

/** The key colours the texture is painted in (`swatches` in sprite.json). */
export const PUFFBALL_KEYS = {
  body: '#f2a0b8',
  arm: '#e890aa',
  mouth: '#2a1f1a',
  seam: '#a04a68',
  foot: '#c9473f',
  valve: '#f4efe6',
} as const;

const C = 1.22;
/** The valve's elevation on the back, degrees above the ball's middle. */
const VALVE = 38;
const SIZE = 1024;
/** Solid cells along the texture's lower half, one per key, for the parts that are one colour. */
const CELLS = ['arm', 'seam', 'foot', 'valve'] as const;

/**
 * The mouth: a small smile on the front of the ball, the lower rim of an oval (azimuth from the front and
 * elevation, half-width and half-height, degrees) less the same oval lifted by `lip`.
 */
const MOUTH = { az: 0, el: -1, w: 8, h: 4.5, lip: 3 };

function paint(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = SIZE;
  cv.height = SIZE;
  const g = cv.getContext('2d')!;
  // The ball, in the upper half: texel row r at θ = r / (SIZE / 2) × π from the top, as its UVs are set.
  const img = g.createImageData(SIZE, SIZE / 2);
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const body = rgb(PUFFBALL_KEYS.body);
  const mouth = rgb(PUFFBALL_KEYS.mouth);
  const deg = 180 / Math.PI;
  for (let r = 0; r < SIZE / 2; r++)
    for (let c = 0; c < SIZE; c++) {
      const th = ((r + 0.5) / (SIZE / 2)) * Math.PI;
      const ph = ((c + 0.5) / SIZE) * Math.PI * 2;
      const x = -Math.cos(ph) * Math.sin(th);
      const y = Math.cos(th);
      const z = Math.sin(ph) * Math.sin(th);
      const az = Math.atan2(x, z) * deg;
      const el = Math.asin(y) * deg;
      const inOval = (lift: number) => ((az - MOUTH.az) / MOUTH.w) ** 2 + ((el - MOUTH.el - lift) / MOUTH.h) ** 2 <= 1;
      const col = inOval(0) && !inOval(MOUTH.lip) ? mouth : body;
      const i = (r * SIZE + c) * 4;
      img.data.set([...col, 255], i);
    }
  g.putImageData(img, 0, 0);
  CELLS.forEach((k, i) => {
    g.fillStyle = PUFFBALL_KEYS[k];
    g.fillRect(i * 128, SIZE / 2, 128, SIZE / 2);
  });
  return cv;
}

/** A cell's centre, as a UV. */
const cell = (k: (typeof CELLS)[number]): [number, number] => [(CELLS.indexOf(k) * 128 + 64) / SIZE, 0.75];

function solid(geo: THREE.BufferGeometry, k: (typeof CELLS)[number]): THREE.BufferGeometry {
  const [u, v] = cell(k);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  return geo;
}

export function puffballModel(): Model {
  const root = new THREE.Group();
  root.name = 'puffball';
  const bone = (name: string, parent: THREE.Object3D, y = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.y = y;
    parent.add(b);
    return b;
  };
  const hips = bone('hips', root, C);
  const body = bone('body', hips);
  const arms = { arm_l: bone('arm_l', body), arm_r: bone('arm_r', body) };
  const feet = { foot_l: bone('foot_l', hips), foot_r: bone('foot_r', hips) };
  root.updateMatrixWorld(true);
  const bones = [hips, body, arms.arm_l, arms.arm_r, feet.foot_l, feet.foot_r];
  const skeleton = new THREE.Skeleton(bones);

  const tex = new THREE.CanvasTexture(paint());
  tex.flipY = false;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const meshes: THREE.Mesh[] = [];
  const add = (geo: THREE.BufferGeometry, on: THREE.Bone) => {
    const n = geo.getAttribute('position').count;
    const bi = bones.indexOf(on);
    geo.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(
        new Array(n * 4).fill(0).map((_, i) => (i % 4 ? 0 : bi)),
        4,
      ),
    );
    geo.setAttribute(
      'skinWeight',
      new THREE.Float32BufferAttribute(
        new Array(n * 4).fill(0).map((_, i) => (i % 4 ? 0 : 1)),
        4,
      ),
    );
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = on.name;
    root.add(m);
    m.bind(skeleton, new THREE.Matrix4());
    meshes.push(m);
  };

  // The ball: its UVs moved into the texture's upper half, top row first.
  const ball = new THREE.SphereGeometry(1, 64, 40);
  const uv = ball.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (1 - uv.getY(i)) * 0.5);
  ball.translate(0, C, 0);
  add(ball, body);
  // The moulding seam between the front and back halves: a ridge standing proud all the way round.
  add(solid(new THREE.TorusGeometry(1.0, 0.045, 8, 96).translate(0, C, 0), 'seam'), body);
  // The squeaker valve: a stubby nozzle and its round cap, high on its back on the seam's far side, where
  // it stands clear of the ball's outline from either side.
  const up = (VALVE * Math.PI) / 180;
  const along = (d: number, geo: THREE.BufferGeometry) =>
    geo.rotateX(up - Math.PI / 2).translate(0, C + Math.sin(up) * d, -Math.cos(up) * d);
  add(solid(along(1.12, new THREE.CylinderGeometry(0.12, 0.14, 0.34, 16)), 'valve'), body);
  add(solid(along(1.3, new THREE.CylinderGeometry(0.21, 0.21, 0.1, 18)), 'valve'), body);
  // Stubby arms, half sunk into the ball low on its sides.
  for (const [name, s] of [
    ['arm_l', 1],
    ['arm_r', -1],
  ] as const)
    add(
      solid(
        new THREE.SphereGeometry(1, 20, 14)
          .scale(0.4, 0.27, 0.3)
          .rotateZ(s * 0.35)
          .translate(s * 0.92, C - 0.22, 0.08),
        'arm',
      ),
      arms[name],
    );
  // Big oval feet, longer than they're wide, standing a little forward.
  for (const [name, s] of [
    ['foot_l', 1],
    ['foot_r', -1],
  ] as const) {
    add(solid(new THREE.SphereGeometry(1, 28, 16).scale(0.38, 0.22, 0.6).translate(s * 0.44, 0.22, 0.16), 'foot'), feet[name]);
  }
  return { root, meshes, clips: [], texture: tex };
}
