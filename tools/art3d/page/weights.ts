import * as THREE from 'three';
import type { Rebind } from '../settings';

/**
 * A weight fix the auto-rig needs, by reach (terra's rig check calls the fault `reach`): skin weighted to
 * a bone it's far from. Gear strapped to the back (the plumber's plunger) is fused into one mesh with the
 * body and gets painted to the nearest limb in the T-pose, a finger, so it swings with the arm. Any weight
 * on a bone matching `from` held by a vertex farther than `max` (a share of the figure's height) from
 * that bone's joint moves to `to`, as a rigger would repaint it. A vertex whose weight is mostly such
 * moves to `to` entirely, so the piece stays rigid instead of tearing between two bones.
 */
export function rebind(mesh: THREE.SkinnedMesh, r: Rebind, height: number): number {
  const geo = mesh.geometry;
  const bones = mesh.skeleton.bones;
  const to = bones.findIndex((b) => b.name === r.to);
  if (to < 0) throw new Error(`rebind: no bone "${r.to}"; the skeleton has ${bones.map((b) => b.name).join(', ')}`);
  const from = new RegExp(r.from);
  // Joints where they stand in the bind pose, in the mesh's bind space.
  const joints = mesh.skeleton.boneInverses.map((inv) => new THREE.Vector3().setFromMatrixPosition(inv.clone().invert()));
  const max = r.max * height;
  const pos = geo.getAttribute('position');
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  const p = new THREE.Vector3();
  let moved = 0;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
    const idx = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
    const wt = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)];
    let far = 0;
    for (let j = 0; j < 4; j++) if (wt[j] > 0 && from.test(bones[idx[j]].name) && p.distanceTo(joints[idx[j]]) > max) far += wt[j];
    if (far <= 0) continue;
    moved++;
    if (far >= 0.3) {
      si.setXYZW(i, to, 0, 0, 0);
      sw.setXYZW(i, 1, 0, 0, 0);
      continue;
    }
    for (let j = 0; j < 4; j++) if (wt[j] > 0 && from.test(bones[idx[j]].name) && p.distanceTo(joints[idx[j]]) > max) idx[j] = to;
    si.setXYZW(i, idx[0], idx[1], idx[2], idx[3]);
  }
  si.needsUpdate = true;
  sw.needsUpdate = true;
  return moved;
}
