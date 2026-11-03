import * as THREE from 'three';
import type { Key, Limb, Turn } from '../settings';

/**
 * Keyed poses (README → sprite.json → Keys). Keys work in the figure's own axes (x to its left, y up,
 * z forward), never a bone's local ones: Tripo's rigs roll each bone their own way (a right upper arm's
 * local z points down, the left's up), so bone axes would mean something different on every bone of every rig.
 *
 * A bone's entry is either
 * - a turn, `[x, y, z]` degrees about the figure's axes through the bone's joint, on top of the base pose
 *   and of its parents' turns (a turn on the clavicle carries the arm, and the arm's own turn adds to it), or
 * - an aim, a `Limb`: where the bone points, in the figure's space, and how it's rolled, from the rig's
 *   rest pose, whatever the base pose and the bones above it do. It reads the same on either side of the
 *   figure, so `_near` and `_far` keys mean the same.
 * Either way the bones below follow.
 */

export type Facing = 'r' | 'l';
/** +1 for the figure's right side, -1 for its left. */
type Side = 1 | -1;

const rad = (d: number) => (d * Math.PI) / 180;

/** A key's entry for one bone of the rig, for one facing. */
export interface BoneTurn {
  bone: string;
  /** A turn: Euler degrees about the figure's axes, mirrored for the facing as the key's name says... */
  euler?: [number, number, number];
  /** ...or an aim, for a bone on the figure's side `side`. */
  limb?: Limb;
  side: Side;
}

/**
 * The bone a key names, on a facing, and the side of the figure it's on. `_near` and `_far` are the
 * camera's side and the other, authored facing right (near is the figure's right): `upperarm_near` is
 * `upperarm_r` facing right; a rig that names its sides first (Tripo's biped `--type other`: `L_Thigh`) is
 * keyed `near_Thigh`. A bone named for its side outright (`hand_l`, `L_Thigh`) is that side's on both
 * facings; a bone on the centre line counts as near.
 */
export function boneOf(name: string, facing: Facing): { bone: string; side: Side; by: 'near' | 'far' | 'named' | 'centre' } {
  const near = facing === 'r' ? 'r' : 'l';
  const far = facing === 'r' ? 'l' : 'r';
  const side = (s: string): Side => (s.toLowerCase() === 'r' ? 1 : -1);
  let m = /^(.*)_(near|far)$/.exec(name);
  if (m) {
    const s = m[2] === 'near' ? near : far;
    return { bone: `${m[1]}_${s}`, side: side(s), by: m[2] as 'near' | 'far' };
  }
  m = /^(near|far)_(.*)$/.exec(name);
  if (m) {
    const s = m[1] === 'near' ? near : far;
    return { bone: `${s.toUpperCase()}_${m[2]}`, side: side(s), by: m[1] as 'near' | 'far' };
  }
  m = /_([lr])$/.exec(name) ?? /^([LR])_/.exec(name);
  if (m) return { bone: name, side: side(m[1]), by: 'named' };
  return { bone: name, side: side(near), by: 'centre' };
}

/**
 * A key's entries, resolved for a facing. Facing left is facing right's mirror image: a turn on a `_near`,
 * `_far` or centre-line bone has y and z negated there (a turn about x mirrors to itself), and a bone named
 * for its side outright keeps its turn, so the figure strikes the same pose from the other side. An aim
 * mirrors by the side its bone is on.
 */
export function turnsOf(key: Pick<Key, 'bones'>, facing: Facing): BoneTurn[] {
  return Object.entries(key.bones ?? {}).map(([name, t]: [string, Turn]) => {
    const { bone, side, by } = boneOf(name, facing);
    if (!Array.isArray(t)) return { bone, limb: t, side };
    const mirror = facing === 'l' && by !== 'named';
    return { bone, euler: mirror ? [t[0], -t[1], -t[2]] : t, side };
  });
}

/**
 * Where an aim points, in the figure's axes: `raise` degrees up from straight down, in the plane `out`
 * degrees round from straight ahead toward the bone's own side (the figure's right is -x).
 */
export function aimOf(limb: Limb, side: Side): THREE.Vector3 {
  const r = rad(limb.raise ?? 0);
  const o = rad(limb.out ?? 0);
  return new THREE.Vector3(-side * Math.sin(r) * Math.sin(o), -Math.cos(r), Math.sin(r) * Math.cos(o));
}

/** Each bone's turn in the figure and the way it points (to its child joint), in the rig's rest pose. */
export type Rest = Map<string, { q: THREE.Quaternion; dir: THREE.Vector3 | null }>;

const figureOf = (root: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  const rq = root.getWorldQuaternion(new THREE.Quaternion()).invert();
  return {
    turn: (o: THREE.Object3D) => rq.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion())),
    at: (o: THREE.Object3D) => root.worldToLocal(o.getWorldPosition(new THREE.Vector3())),
  };
};

/** Reads the rest pose an aim is measured from: call it with the rig at rest. */
export function restOf(root: THREE.Object3D, bones: readonly THREE.Bone[]): Rest {
  const f = figureOf(root);
  return new Map(
    bones.map((b) => {
      const child = b.children.find((c) => (c as THREE.Bone).isBone);
      return [b.name, { q: f.turn(b), dir: child ? f.at(child).sub(f.at(b)).normalize() : null }] as const;
    }),
  );
}

/**
 * Poses the bones, parents first (`bones` in that order), each about its joint in the axes of `root`
 * (the figure). Bones the key doesn't name follow their parents. An aim sets its bone's whole turn in the
 * figure, roll and all, from `rest`: the rest pose swung the shortest way onto the aim, then twisted, so
 * the same aim gives the same limb whatever the base pose was holding, and mirror-image limbs on either side.
 */
export function applyTurns(root: THREE.Object3D, bones: readonly THREE.Bone[], turns: readonly BoneTurn[], rest: Rest) {
  const byBone = new Map(turns.map((t) => [t.bone, t]));
  for (const t of turns)
    if (!bones.some((b) => b.name === t.bone)) throw new Error(`no bone "${t.bone}"; the skeleton has ${bones.map((b) => b.name).join(', ')}`);
  const f = figureOf(root);
  for (const b of bones) {
    const t = byBone.get(b.name);
    if (!t) continue;
    let turned: THREE.Quaternion;
    if (t.euler) turned = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(t.euler[0]), rad(t.euler[1]), rad(t.euler[2]), 'XYZ')).multiply(f.turn(b));
    else {
      const r = rest.get(b.name);
      if (!r?.dir) throw new Error(`"${b.name}" has no child bone, so nothing to aim: turn it with [x, y, z]`);
      const aim = aimOf(t.limb!, t.side);
      // Positive twist turns the limb's front out toward its own side.
      const twist = new THREE.Quaternion().setFromAxisAngle(aim, rad(t.side * (t.limb!.twist ?? 0)));
      turned = twist.multiply(new THREE.Quaternion().setFromUnitVectors(r.dir, aim)).multiply(r.q);
    }
    const parent = b.parent ? f.turn(b.parent) : new THREE.Quaternion();
    b.quaternion.copy(parent.invert().multiply(turned));
    b.updateMatrixWorld(true);
  }
}

/**
 * Holds a humanoid rig (one with `upperarm_l`/`_r`, `lowerarm_l`/`_r`, `hand_l`/`_r` and `head`) to what keys
 * promise, from `reset` (a pose with the arms hanging): on both facings, either arm aimed 150° up and out
 * to its side ends with the hand above the head's joint and out on its own side, and aimed level in front,
 * with the hand ahead of the shoulder. A rig whose figure axes aren't x to its left, y up and z forward, or
 * whose sides are swapped, fails here before any frame is drawn. Returns what failed: empty when it keys
 * as the README says.
 */
export function checkArms(root: THREE.Object3D, bones: readonly THREE.Bone[], rest: Rest, reset: () => void): string[] {
  const named = (n: string) => bones.find((b) => b.name === n);
  if (!['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'head'].every(named)) return [];
  const at = (n: string) => root.worldToLocal(named(n)!.getWorldPosition(new THREE.Vector3()));
  const failed: string[] = [];
  for (const facing of ['r', 'l'] as const)
    for (const which of ['near', 'far'] as const) {
      const pose = (limb: Limb) => {
        reset();
        const turns = turnsOf({ bones: { [`upperarm_${which}`]: limb, [`lowerarm_${which}`]: limb } }, facing);
        applyTurns(root, bones, turns, rest);
        const s = turns[0].bone.slice(-1);
        return { shoulder: at(`upperarm_${s}`), hand: at(`hand_${s}`), head: at('head'), side: turns[0].side };
      };
      const where = `facing ${facing}, the ${which} arm`;
      const up = pose({ raise: 150, out: 90 });
      if (up.hand.y <= up.head.y)
        failed.push(`${where} aimed 150° up: the hand (y ${up.hand.y.toFixed(2)}) isn't above the head's joint (${up.head.y.toFixed(2)})`);
      // The figure's right is -x: a right arm's shoulder is there, and its raised hand further out.
      if (up.shoulder.x * -up.side <= 0) failed.push(`${where}: the shoulder isn't on its side of the figure (are its sides swapped?)`);
      else if ((up.hand.x - up.shoulder.x) * -up.side <= 0) failed.push(`${where} aimed 150° up and out: the hand isn't out on its own side`);
      const ahead = pose({ raise: 90 });
      if (ahead.hand.z - ahead.shoulder.z < ahead.hand.distanceTo(ahead.shoulder) / 2)
        failed.push(`${where} aimed level in front: the hand isn't ahead of the shoulder`);
    }
  reset();
  return failed;
}
