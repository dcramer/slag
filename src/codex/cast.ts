import { deriveSeed } from '../core/rng';
import { CAST, type CharacterDef, generateCharacter, KIND_NAMES, type Kind, PLAYER_COLORS, withColor } from '../gen/character';
import { Rig } from '../render/character';
import { drawInkAccessory, drawInkRunner, ropeAnchor, ropeOf, type RunnerPose } from '../render/ink-character';
import type { RC } from '../render/kit';
import { rosterLook, spritesOf } from '../render/cast/sprites';

/**
 * The codex's cast: every kind in `CAST`, by its sound-alike name, standing on its card and running
 * through its moves up close. Keyed by `Kind`, so a new kind without a line here fails `tsc`.
 */

/** One-line jokes, never the original's name (docs/CHARACTERS.md). */
export const CAST_NOTES: Record<Kind, string> = {
  plumber: 'Never once fixed a sink.',
  hedgehog: 'Rings not included.',
  elf: 'Breaks your pots.',
  hunter: 'Curls into a ball when nervous.',
  zapmouse: 'Shocking, honestly.',
  impostor: 'Definitely did tasks.',
  puffball: 'Ate the last guy.',
  jelly: 'Clingy.',
  goose: 'Has your keys.',
  engineer: 'Hard hat, soft heart.',
  chomper: 'Ghosts owe him money.',
  miner: 'Punches trees for a living.',
  ape: 'Barrel enthusiast.',
  merc: 'Hair: load-bearing.',
  king: 'Runs a shell company.',
  dino: 'Tongue first, questions later.',
  robot: 'Copies your homework.',
  sneak: "It's just a box.",
  cuptoon: "Signed something he shouldn't have.",
  horse: 'Placed that saw. Regrets it.',
  rapper: 'Two-dimensional. Proudly.',
  limbless: 'Arms are overrated.',
  worm: 'Launched a cow once.',
  dragon: 'Small-batch hoarder.',
  hopper: '@!#?@!',
};

export interface CastEntry {
  kind: Kind;
  title: string;
  note: string;
  def: CharacterDef;
}

/** Every kind, in cast order, each in a player color of its own around the palette. */
export function castEntries(): CastEntry[] {
  return CAST.map((kind, i) => ({
    kind,
    title: KIND_NAMES[kind],
    note: CAST_NOTES[kind],
    def: withColor(generateCharacter(deriveSeed(0xc0de, kind), kind), (i * 4) % PLAYER_COLORS.length),
  }));
}

/** The moves the close-up runs through, a beat each. */
const MOVES: Partial<RunnerPose>[] = [
  { grounded: true },
  { grounded: true, vx: 100 },
  { grounded: true, vx: 260 },
  { grounded: false, vy: -320 },
  { grounded: false, vy: 420 },
  { grounded: false, vy: 60, wall: 1 },
  { grounded: true, celebrate: true },
];
const BEAT = 1.3;

/**
 * A card's drawing for one kind: standing on a card, its moves in turn up close. Holds the kind's tail
 * rig, and swaps in its roster look once a rendered kind's frames are in, so it reads as the homage.
 */
export function castDrawer(e: CastEntry): (rc: RC, w: number, h: number, moves: boolean) => void {
  let c = e.def;
  let rostered = false;
  const rig = new Rig();
  let last = -1;
  return (rc, w, h, moves) => {
    if (!rostered && spritesOf(c)) {
      c = rosterLook(e.def);
      rostered = true;
    }
    const dt = last < 0 ? 1 / 60 : Math.min(1 / 30, Math.max(0, rc.t - last));
    last = rc.t;
    const p = moves ? MOVES[Math.floor(rc.t / BEAT) % MOVES.length] : MOVES[0];
    const k = Math.min(w, h) / 34;
    const fy = h * 0.8;
    const air = p.grounded ? 0 : h * 0.1;
    const s = rc.s;
    s.fillStyle = 'rgba(0,0,0,0.35)';
    s.beginPath();
    s.ellipse(w / 2, fy, 8 * k, 1.8 * k, 0, 0, Math.PI * 2);
    s.fill();
    // In world units at the feet, scaled to the card, so a tail hangs as it does in a race. The runner's x
    // sets its stride phase: run it forward and pull it back by as much.
    const stride = rc.t * (p.vx ?? 0);
    s.save();
    s.translate(w / 2, fy - air);
    s.scale(k, k);
    s.translate(-stride, 0);
    const rope = ropeOf(c);
    if (rope) {
      const at = ropeAnchor(c, 1);
      rig.step(rope, at.x + stride, at.y, dt, -(p.vx ?? 0) * 0.6 - 8, air / k);
      drawInkAccessory(s, c, rig);
    }
    drawInkRunner({ s, g: null }, c, stride, 0, { facing: 1, vx: 0, vy: 0, t: rc.t, ...p, grounded: p.grounded ?? true });
    s.restore();
  };
}
