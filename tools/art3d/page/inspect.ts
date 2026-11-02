import * as THREE from 'three';
import type { Model } from './load';

/**
 * A turnaround of the raw model for judging it before anything else is spent on it: front, side, back
 * and three-quarter, each as Tripo painted it (unlit) and as clay under one light, so proportions,
 * silhouette and surface read on their own.
 */
export function turnaround(model: Model, size: number): string {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(size * 4, size * 2);
  r.setClearColor(0xe8e4dc, 1);
  r.autoClear = false;
  r.clear();
  const box = new THREE.Box3().setFromObject(model.root, true);
  const c = box.getCenter(new THREE.Vector3());
  const h = Math.max(box.max.y - box.min.y, box.max.x - box.min.x, box.max.z - box.min.z) * 0.56;
  const cam = new THREE.OrthographicCamera(-h, h, h, -h, -100, 100);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-1, 1.4, 1.2);
  scene.add(sun);
  const pivot = new THREE.Group();
  pivot.add(model.root);
  model.root.position.sub(c);
  scene.add(pivot);
  const lit = new Map<THREE.Mesh, THREE.Material>();
  const clay = new THREE.MeshLambertMaterial({ color: 0xc8b8a4 });
  for (const m of model.meshes) lit.set(m, m.material as THREE.Material);
  const views = [0, 90, 180, 35];
  for (let row = 0; row < 2; row++) {
    for (const m of model.meshes) {
      const src = lit.get(m) as THREE.MeshStandardMaterial;
      m.material = row === 0 ? new THREE.MeshBasicMaterial({ map: src.map ?? null, color: src.map ? 0xffffff : src.color }) : clay;
    }
    views.forEach((deg, i) => {
      pivot.rotation.y = (deg * Math.PI) / 180;
      r.setViewport(i * size, (1 - row) * size, size, size);
      r.render(scene, cam);
    });
  }
  for (const [m, mat] of lit) m.material = mat;
  model.root.position.add(c);
  return r.domElement.toDataURL('image/png');
}
