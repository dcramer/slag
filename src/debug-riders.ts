import { Rng } from './core/rng';
import type { Match } from './game/match';
import { type Archetype, generateProp } from './gen/props';
import { TILE } from './sim/constants';
import { canPlace, type Module, type PlacedProp, type PropDef, previewProps, resolveProp, spotAt } from './sim/props';

/**
 * Shot staging for parts that ride movers (sim/props/ride.ts), behind
 * `slagDebug.riders`, `topOf` and `still`: tools/shot/riders.ts drives them.
 */

const LIFT_CELLS: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
];

/** A crate card of `kind` with no motion of its own, so it can ride. */
export function stillPart(kind: Archetype, seed = 1): PropDef {
  for (let i = 0; i < 400; i++) {
    const d = generateProp(new Rng(seed * 977 + i), kind, `dbg-still-${i}`);
    if (d.motion.type === 'none') return d;
  }
  throw new Error(`no still ${kind}`);
}

/** World px of the top middle of part `uid`'s `part`th solid on the frame on screen, or null. */
export function topOf(match: Match, uid: number, part = 0): { x: number; y: number } | null {
  const pp = [...match.level.setPieces, ...match.placed].find((p) => p.uid === uid);
  if (!pp) return null;
  const f = match.phase === 'run' && match.run ? match.run.frame : match.frame;
  const s = previewProps(match.level, [resolveProp(pp)], f).solids.filter((x) => x.propUid === uid)[part];
  return s ? { x: s.x + s.w / 2, y: s.y } : null;
}

/**
 * A player's lift and cog wheel at open spots, each with a block and a coat
 * stuck on as of this frame. Returns the uids of the lift, its block and coat,
 * the wheel, its block and coat; shorter if the level has no room.
 */
export function stageRiders(match: Match, uid: number): number[] {
  const { level } = match;
  const owner = match.players[0]?.slot ?? 0;
  const lift: PropDef = {
    ...stillPart('platform'),
    key: 'dbg-lift',
    name: 'Lift',
    motion: { type: 'rail', angle: -Math.PI / 2, range: 4, period: 160, dwell: 40 },
    modules: [{ type: 'body', cells: LIFT_CELLS, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 }],
    footprint: LIFT_CELLS,
  };
  const wheel = generateProp(new Rng(5), 'wheel', 'dbg-wheel');
  const block = stillPart('mystery');
  // A plain block on the wheel, so a coat can ride it in turn.
  const brick = stillPart('platform', 2);
  const slime = stillPart('slimecoat');
  const ice = stillPart('icecoat');
  const free = (x: number, y: number) => x > 0 && y > 0 && x < level.w - 1 && y < level.h && level.tiles[y * level.w + x] === 0;
  const out: number[] = [];
  const put = (pp: PlacedProp) => (match.placed.push(pp), pp);
  // The lift: three across with seven rows of air over it.
  outer: for (let ty = level.h - 3; ty > 8; ty--)
    for (let tx = 6; tx < level.w - 9; tx++) {
      let ok = canPlace(level, match.placed, lift, 0, tx, ty);
      for (let dy = -6; dy <= 0 && ok; dy++) for (let dx = -1; dx <= 3 && ok; dx++) ok = free(tx + dx, ty + dy);
      if (!ok) continue;
      const n = match.placed.length;
      const lp = put({ uid: uid++, def: lift, owner, tx, ty, rot: 0 });
      const top = topOf(match, lp.uid)!;
      const row = Math.round(top.y / TILE);
      if (!stick(match, uid++, block, tx + 2, row - 1) || !stick(match, uid++, slime, tx, row)) {
        match.placed.length = n;
        continue;
      }
      out.push(...match.placed.slice(n).map((p) => p.uid));
      break outer;
    }
  // The wheel, somewhere else with room for its disk.
  outer: for (let ty = 4; ty < level.h - 6; ty++)
    for (let tx = level.w - 12; tx > 6; tx--) {
      if (!canPlace(level, match.placed, wheel, 0, tx, ty)) continue;
      const wp = put({ uid: uid++, def: wheel, owner, tx, ty, rot: 0 });
      const n = match.placed.length;
      const rotor = resolveProp(wp).mods[0] as Extract<Module, { type: 'rotor' }>;
      // A block on one car and ice on another, found by trying the cells round the hub.
      const R = Math.ceil(rotor.arm / TILE) + 2;
      const hx = Math.floor(rotor.hub[0] / TILE);
      const hy = Math.floor(rotor.hub[1] / TILE);
      let got = 0;
      for (const def of [brick, ice])
        for (let y = hy - R; y <= hy + R && got < (def === brick ? 1 : 2); y++)
          for (let x = hx - R; x <= hx + R && got < (def === brick ? 1 : 2); x++)
            if (stick(match, uid, def, x, y, wp.uid)) {
              uid++;
              got++;
            }
      if (got < 2) {
        match.placed.length = n - 1;
        continue;
      }
      out.push(...match.placed.slice(n - 1).map((p) => p.uid));
      break outer;
    }
  return out;
}

/** Place `def` at (tx, ty) if it rides something there on this frame (only `parent`, if given). */
function stick(match: Match, uid: number, def: PropDef, tx: number, ty: number, parent?: number): boolean {
  const s = spotAt(match.level, match.placed, def, 0, tx, ty, match.frame);
  if (!s.ok || !s.ride || (parent !== undefined && s.ride.uid !== parent)) return false;
  match.placed.push({ uid, def: s.def, owner: match.players[0]?.slot ?? 0, tx, ty, rot: 0, ride: s.ride });
  return true;
}
