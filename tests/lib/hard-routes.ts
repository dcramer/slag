import { expect } from 'vitest';
import type { SizeClass } from '../../src/sim/level';
import { THEME_IDS } from '../../src/themes';
import { botRace } from './bot-race';

/**
 * A Hard bot over every theme at every size its theme rolls, racing over the
 * parts three Hard bots picked and placed in a round of their own: what
 * a match throws at it, not just the plan. Before the motor looked a move
 * ahead, timed gusts and moving parts, counted waiting as time and ran along
 * the ground, these 280 races gave 238 finishes in 555 race frames on average;
 * with it, 250 in 526. Once it knew a ledge's lip as the ledge (it had hopped
 * in place under overhangs there until it gave up), traced moves in the parts'
 * winds and kept a walk-speed way onto each cell beside the quickest (for
 * ground a run can't stop on): 257 in 541, the extra finishes long levels (on
 * races both finish, seeds 1–20, 515 frames became 518). Levels that ask for
 * precision (more jumpable crossings, stepping stones, full-range jumps) made
 * the same 257 finishes take 555 frames; taking the least bad move when it
 * lands at a run on a ledge too short to stop on or wait (it had coasted off):
 * 259 in 556. Foreseeing parts a runner sets off (a dropper it walked under
 * looked idle until it slammed) and looking past every clear move while
 * where it stands is about to hurt: 261 in 555. The misses left are
 * mostly routes into places it can't leave (it gives up), shots and timed
 * hazards past the one move it looks ahead, and low-gravity falls. Since
 * bots make mistakes at every level, it runs them with steady hands (no
 * fumbles, pauses, wrong turns or lag), so it keeps measuring the motor and
 * the route rather than a player's lapses. Taking a safe move over a tight
 * jump that costs little more, and braking while it looks: 254 in 546.
 * Since Hard bots put their hazards where they make the way hardest, short
 * of sealing it: 249 in 549, most misses now a hazard in the way. Split by
 * size so the three run in parallel (one file took over 400 s on CI): classic
 * 91 of 100 in 500, wide 86 of 100 in 543, tall 71 of 80 in 624. Since a
 * bot's keepsWay only keeps the plan everyone is building (it no longer
 * searches for another), tall went from 71 in 633 to 72 in 637: the new
 * finish is a long one (space/3, 885 frames), and the races both finish
 * are no slower. Since the motor plays its hops and leaps out before taking
 * them (a leap off the map or into a hazard it waits out or goes round),
 * stops where coasting would carry it off, and lines up only where nothing
 * reaches it meanwhile: classic 91 in 482, wide 92 in 559, tall 74 in 644,
 * every new finish a long one (jungle/3, space/8) and the races both finish
 * as quick as before (479, 554, 638 frames).
 */

/** The seeds each theme races at every size. */
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

/** One size's hard races: every theme at that size, each level once, held to its own band. */
export function expectHardRoutes(size: SizeClass, band: { finished: number; frames: number }) {
  let races = 0;
  let finished = 0;
  let frames = 0;
  const misses: string[] = [];
  for (const theme of THEME_IDS)
    for (const seed of SEEDS) {
      // A size the theme never rolls falls back to one it does: count each level once.
      if (size === 'tall' && (theme === 'farm' || theme === 'harbor')) continue;
      const r = botRace(seed, { theme, size: size === 'classic' ? undefined : size, level: 'hard', parts: 3, steady: true });
      races++;
      if (r.finished) {
        finished++;
        frames += r.frames;
      } else misses.push(`${theme}/${seed}:${r.cause}`);
    }
  console.log(`hard ${size}: finished ${finished} of ${races} in ${Math.round(frames / finished)} frames on average; missed ${misses.join(' ')}`);
  expect(finished / races).toBeGreaterThanOrEqual(band.finished);
  expect(frames / finished).toBeLessThan(band.frames);
}
