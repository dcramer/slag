import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyTurns, boneOf, checkArms, restOf, turnsOf, type Facing } from '../tools/art3d/page/keys';
import type { Key } from '../tools/art3d/settings';

/**
 * Keyed poses in the sprite pipeline (tools/art3d/page/keys.ts): a key means the same pose whatever way
 * the rig rolls its bones, on both facings, and on either side of the figure. The rig here is a chibi
 * humanoid standing as Tripo's do after an idle: arms hanging, the head's joint above the shoulders.
 */

type V = [number, number, number];
const JOINTS: [string, string | null, V][] = [
  ['pelvis', null, [0, 0.3, 0]],
  ['spine', 'pelvis', [0, 0.4, 0]],
  ['head', 'spine', [0, 0.6, 0]],
  ['head_end', 'head', [0, 0.95, 0]],
  ['clavicle_r', 'spine', [-0.04, 0.55, 0]],
  ['upperarm_r', 'clavicle_r', [-0.13, 0.55, 0]],
  ['lowerarm_r', 'upperarm_r', [-0.13, 0.45, 0]],
  ['hand_r', 'lowerarm_r', [-0.13, 0.27, 0]],
  ['clavicle_l', 'spine', [0.04, 0.55, 0]],
  ['upperarm_l', 'clavicle_l', [0.13, 0.55, 0]],
  ['lowerarm_l', 'upperarm_l', [0.13, 0.45, 0]],
  ['hand_l', 'lowerarm_l', [0.13, 0.27, 0]],
];

/**
 * The rig, with each bone's own axes turned `roll(i)` in the figure (its bind orientation, which keys
 * must not depend on), under a parent turned for the facing as the renderer turns it.
 */
function rig(roll: (i: number) => THREE.Quaternion) {
  const turn = new THREE.Group();
  const root = new THREE.Group();
  turn.add(root);
  const bones = new Map<string, THREE.Bone>();
  const world = new Map<string, THREE.Matrix4>();
  JOINTS.forEach(([name, parent, at], i) => {
    const b = new THREE.Bone();
    b.name = name;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), roll(i), new THREE.Vector3(1, 1, 1));
    world.set(name, m);
    const local = parent ? world.get(parent)!.clone().invert().multiply(m) : m;
    local.decompose(b.position, b.quaternion, b.scale);
    (parent ? bones.get(parent)! : root).add(b);
    bones.set(name, b);
  });
  const rest = [...bones.values()].map((b) => b.quaternion.clone());
  const list = [...bones.values()];
  const reset = () => list.forEach((b, i) => b.quaternion.copy(rest[i]));
  const restPose = restOf(root, list);
  const at = (n: string) => root.worldToLocal(bones.get(n)!.getWorldPosition(new THREE.Vector3()));
  /** A bone's turn in the figure. */
  const turnOf = (n: string) => root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(bones.get(n)!.getWorldQuaternion(new THREE.Quaternion()));
  /** Poses `key` for a facing, from rest or on top of the pose it's in; where each joint ends up, in the figure's axes. */
  const pose = (key: Pick<Key, 'bones'>, facing: Facing, from: 'rest' | 'here' = 'rest') => {
    if (from === 'rest') reset();
    turn.rotation.y = ((facing === 'r' ? 1 : -1) * 50 * Math.PI) / 180;
    applyTurns(root, list, turnsOf(key, facing), restPose);
    return { at, turnOf };
  };
  return { pose, root, list, reset, restPose };
}

/** No roll; Tripo's (a right arm's local z points down, a left's up); and an arbitrary one per bone. */
const ROLLS: Record<string, (i: number) => THREE.Quaternion> = {
  none: () => new THREE.Quaternion(),
  tripo: (i) =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, JOINTS[i][0].endsWith('_r') ? -Math.PI / 2 : JOINTS[i][0].endsWith('_l') ? Math.PI / 2 : 0)),
  any: (i) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7 * i, 1.3 + 0.4 * i, -0.9 * i)),
};
const near = (f: Facing) => (f === 'r' ? 'r' : 'l');
const far = (f: Facing) => (f === 'r' ? 'l' : 'r');
/** The figure's right is -x: how far out on its own side a point is from a joint of that side. */
const outward = (side: string, p: THREE.Vector3, from: THREE.Vector3) => (side === 'r' ? from.x - p.x : p.x - from.x);

describe('keyed arms', () => {
  for (const [name, roll] of Object.entries(ROLLS))
    for (const facing of ['r', 'l'] as const)
      it(`raising an arm 150° puts the hand above the head, out on its own side (${name} roll, facing ${facing})`, () => {
        const r = rig(roll);
        for (const [which, side] of [
          ['near', near(facing)],
          ['far', far(facing)],
        ] as const) {
          const { at } = r.pose({ bones: { [`upperarm_${which}`]: { raise: 150, out: 90 } } }, facing);
          expect(at(`hand_${side}`).y).toBeGreaterThan(at('head').y);
          expect(outward(side, at(`hand_${side}`), at(`upperarm_${side}`))).toBeGreaterThan(0.05);
          // Raised in front instead: overhead and ahead of the shoulder, not out.
          const ahead = r.pose({ bones: { [`upperarm_${which}`]: { raise: 150 } } }, facing).at;
          expect(ahead(`hand_${side}`).y).toBeGreaterThan(ahead('head').y);
          expect(ahead(`hand_${side}`).z).toBeGreaterThan(ahead(`upperarm_${side}`).z + 0.1);
          expect(Math.abs(outward(side, ahead(`hand_${side}`), ahead(`upperarm_${side}`)))).toBeLessThan(0.01);
        }
      });

  it('the same key lands the same whatever the bones roll', () => {
    const key: Pick<Key, 'bones'> = {
      bones: { clavicle_near: { raise: 20, out: 90 }, upperarm_near: { raise: 140, out: 40, twist: 30 }, lowerarm_near: [-60, 10, 0], spine: [10, 15, 5] },
    };
    for (const facing of ['r', 'l'] as const) {
      const want = rig(ROLLS.none)
        .pose(key, facing)
        .at(`hand_${near(facing)}`);
      for (const roll of [ROLLS.tripo, ROLLS.any])
        expect(
          rig(roll)
            .pose(key, facing)
            .at(`hand_${near(facing)}`)
            .distanceTo(want),
        ).toBeLessThan(1e-6);
    }
  });

  it('facing left is the mirror image of facing right', () => {
    const key: Pick<Key, 'bones'> = {
      bones: { spine: [8, 20, 10], upperarm_near: { raise: 120, out: 30 }, upperarm_far: [-40, 0, 25], lowerarm_far: { raise: 50 } },
    };
    const r = rig(ROLLS.tripo).pose(key, 'r').at;
    const l = rig(ROLLS.tripo).pose(key, 'l').at;
    const mirror = (v: THREE.Vector3) => new THREE.Vector3(-v.x, v.y, v.z);
    for (const n of ['head_end', 'hand', 'lowerarm']) {
      const [a, b] = n === 'head_end' ? [n, n] : [`${n}_r`, `${n}_l`];
      expect(mirror(r(a)).distanceTo(l(b))).toBeLessThan(1e-6);
      if (n !== 'head_end') expect(mirror(r(b)).distanceTo(l(a))).toBeLessThan(1e-6);
    }
  });

  it('a limb aim reads alike on either side: near and far are mirror images', () => {
    const at = rig(ROLLS.any).pose({ bones: { upperarm_near: { raise: 130, out: 60, twist: 20 }, upperarm_far: { raise: 130, out: 60, twist: 20 } } }, 'r').at;
    expect(new THREE.Vector3(-at('hand_r').x, at('hand_r').y, at('hand_r').z).distanceTo(at('hand_l'))).toBeLessThan(1e-6);
  });

  it('a turn about x swings a hanging arm forward when negative, as `raise` does', () => {
    const r = rig(ROLLS.tripo);
    const a = r.pose({ bones: { upperarm_near: [-70, 0, 0] } }, 'r').at('hand_r');
    const b = r.pose({ bones: { upperarm_near: { raise: 70 } } }, 'r').at('hand_r');
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
    expect(a.z).toBeGreaterThan(0.1);
  });

  it('turns add down the arm; an aim is where the bone points whatever turns the bones above it', () => {
    const r = rig(ROLLS.any);
    const dir = (at: (n: string) => THREE.Vector3) => at('hand_r').sub(at('upperarm_r')).normalize();
    // A turn on the clavicle carries the arm: its 60 and the arm's 90 make 150.
    const split = r.pose({ bones: { clavicle_near: [0, 0, -60], upperarm_near: [0, 0, -90] } }, 'r').at;
    const whole = r.pose({ bones: { upperarm_near: [0, 0, -150] } }, 'r').at;
    expect(dir(split).distanceTo(dir(whole))).toBeLessThan(1e-6);
    // An aim doesn't: the spine leaning and the clavicle shrugging leave the arm pointing where it's aimed.
    const aimed = r.pose({ bones: { spine: [-25, 10, 5], clavicle_near: [0, 0, -40], upperarm_near: { raise: 150, out: 90 } } }, 'r').at;
    const plain = r.pose({ bones: { upperarm_near: { raise: 150, out: 90 } } }, 'r').at;
    expect(dir(aimed).distanceTo(dir(plain))).toBeLessThan(1e-6);
    expect(dir(plain).y).toBeCloseTo(Math.cos(Math.PI / 6), 6);
  });

  it('an aim ignores how the base pose holds the arm, roll and all', () => {
    const r = rig(ROLLS.any);
    const key = { bones: { upperarm_near: { raise: 120, out: 30, twist: 25 } } };
    const a = r.pose(key, 'r');
    const want = { at: a.at('lowerarm_r'), turn: a.turnOf('upperarm_r') };
    // From an arm already swung and rolled somewhere else (a base pose's own), the same aim lands the same.
    r.pose({ bones: { upperarm_near: [-35, 70, 10] } }, 'r');
    const b = r.pose(key, 'r', 'here');
    expect(b.at('lowerarm_r').distanceTo(want.at)).toBeLessThan(1e-6);
    expect(b.turnOf('upperarm_r').angleTo(want.turn)).toBeLessThan(1e-6);
  });

  it('names a bone by side, suffix or prefix, and mirrors it as the facing says', () => {
    expect(boneOf('upperarm_near', 'r')).toMatchObject({ bone: 'upperarm_r', side: 1 });
    expect(boneOf('upperarm_far', 'r')).toMatchObject({ bone: 'upperarm_l', side: -1 });
    expect(boneOf('near_Thigh', 'l')).toMatchObject({ bone: 'L_Thigh', side: -1 });
    expect(boneOf('far_Thigh', 'l')).toMatchObject({ bone: 'R_Thigh', side: 1 });
    expect(boneOf('L_Thigh', 'r')).toMatchObject({ bone: 'L_Thigh', by: 'named' });
    expect(boneOf('Spine01', 'l')).toMatchObject({ bone: 'Spine01', by: 'centre' });
    const turns = turnsOf({ bones: { near_Thigh: [10, 20, 30], L_Thigh: [10, 20, 30], Spine01: [10, 20, 30] } }, 'l');
    expect(turns.map((t) => t.euler)).toEqual([
      [10, -20, -30],
      [10, 20, 30],
      [10, -20, -30],
    ]);
  });

  it('an end bone has nothing to aim', () => {
    expect(() => rig(ROLLS.none).pose({ bones: { hand_near: { raise: 90 } } }, 'r')).toThrow(/no child bone/);
  });

  it('a key naming a bone the rig lacks is an error, not a pose left out', () => {
    expect(() => rig(ROLLS.none).pose({ bones: { uppperarm_near: [10, 0, 0] } }, 'r')).toThrow(/no bone "uppperarm_r"/);
  });

  for (const [name, roll] of Object.entries(ROLLS))
    it(`the renderer's own rig check passes a humanoid rig (${name} roll)`, () => {
      const r = rig(roll);
      expect(checkArms(r.root, r.list, r.restPose, r.reset)).toEqual([]);
    });

  it("the renderer's rig check fails a rig turned round inside its figure", () => {
    const r = rig(ROLLS.none);
    // The skeleton turned half round: its right arm is on the figure's left, and it faces -z.
    r.list[0].quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    const turned = r.list.map((b) => b.quaternion.clone());
    const failed = checkArms(r.root, r.list, restOf(r.root, r.list), () => r.list.forEach((b, i) => b.quaternion.copy(turned[i])));
    expect(failed.join('\n')).toMatch(/sides swapped/);
  });
});
