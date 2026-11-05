import { DT } from '../sim/constants';
import { mergePeerFrames, type PeerFrame } from './codec';

/**
 * The host's jitter buffer for one guest, and the clock feedback that keeps it at the right depth.
 *
 * The host plays one queued guest frame per tick, and the guest predicts that its next frame lands on the next
 * bundle. That holds while the queue neither runs dry nor overflows. How deep it sits is set by how early the
 * guest's frames arrive, so the guest sets it: the host measures how long each frame waited before it was played
 * (its slack; negative for one that came after its slot) and sends back how far that is from what the guest's link
 * needs, and the guest runs its ticks a few percent fast or slow until it's there.
 *
 * Slack in ms rather than queue depth in frames: depth is whole frames, so an arrival time drifting across a tick
 * boundary would look like a dip of a whole frame.
 *
 * What a link needs is enough slack to cover how far its arrivals dip below their running mean, all but the rarest
 * dips: a frame later than that is played with held buttons (NetSession.consume), which costs a frame of correction,
 * while every frame of buffer costs everyone watching that guest 17 ms. A queue that stays well past the depth it
 * needs (a guest's stalled tab catching up all at once) is folded down; a burst that drains as fast as it came (the
 * host catching up after its own stall) is not, since every frame in it lands where its guest predicted.
 */

const TICK_MS = DT * 1000;
/** Frames of history the dip estimate covers: two seconds. */
const WINDOW = 120;
/** The dip this many from the deepest in the window sizes the buffer: about one frame in forty dips further. */
const DIP_RANK = 3;
/** What's left of the running mean after one frame: a time constant of about 20 frames. */
const MEAN_KEEP = 0.95;
/** Frames between estimates of the error. */
const EVERY = 10;
/** Slack beyond the dips, for the host's own timer. */
const MARGIN_MS = 2;
/** The most slack any link gets: 100 ms. A link worse than this gets corrected instead. */
const SLACK_MAX_MS = 6 * TICK_MS;
/** A late frame counts as no later than this: a stalled guest is not a link that needs a deeper buffer. */
const LATE_MAX_MS = 2 * TICK_MS;
/** Frames past the needed depth a queue may sit without being folded, and for how long past that. */
const FOLD_SLACK = 3;
const FOLD_AFTER_MS = 250;
/** Frames a queue never exceeds however its guest sends: past it the oldest fold at once. */
export const QUEUE_HARD = 90;
/** Tick-rate change per frame of error, its limit, and an error too small to act on. */
const GAIN = 0.01;
const PACE_MAX = 0.03;
const DEADBAND = 0.25;

/** A guest frame waiting on the host, with the host time it arrived. */
export interface Queued {
  seq: number;
  f: PeerFrame;
  at: number;
}

export interface Depth {
  /** Running mean of the slack, ms. */
  mean: number;
  /** How far below the running mean each recent frame's slack was (a ring of WINDOW). */
  dips: number[];
  samples: number;
  /** The slack this guest's link needs, ms. */
  target: number;
  /** The mean minus the target, in frames: positive, the guest should slow down. */
  err: number;
  /** Host clock when the queue went past the fold cap, -1 while it's under. */
  overSince: number;
}

export function newDepth(): Depth {
  return { mean: MARGIN_MS, dips: [], samples: 0, target: MARGIN_MS, err: 0, overSince: -1 };
}

/** One frame's slack: ms from its arrival to the tick that played it, negative if it came after. */
export function sampleSlack(d: Depth, ms: number) {
  const s = Math.max(-LATE_MAX_MS, ms);
  d.mean = d.mean * MEAN_KEEP + s * (1 - MEAN_KEEP);
  d.dips[d.samples++ % WINDOW] = d.mean - s;
  if (d.samples % EVERY) return;
  const deepest = [...d.dips].sort((a, b) => b - a);
  const dip = Math.max(0, deepest[Math.min(DIP_RANK, deepest.length) - 1]);
  d.target = Math.min(SLACK_MAX_MS, MARGIN_MS + dip);
  d.err = (d.mean - d.target) / TICK_MS;
}

/** Frames the queue holds, as a tick takes one, when its slack is on target. */
function needed(d: Depth): number {
  return 1 + Math.ceil(d.target / TICK_MS);
}

/**
 * Folds the queue (oldest first, edges kept) once it has sat past the fold cap for FOLD_AFTER_MS of host time.
 * Returns the frames folded away.
 */
export function relieve(d: Depth, frames: Queued[], now: number): number {
  if (frames.length <= needed(d) + FOLD_SLACK) {
    d.overSince = -1;
    return 0;
  }
  if (d.overSince < 0) d.overSince = now;
  if (now - d.overSince < FOLD_AFTER_MS) return 0;
  d.overSince = -1;
  return foldTo(frames, needed(d));
}

/** Folds the oldest frames together until `keep` are left: the latest held state, every edge. */
export function foldTo(frames: Queued[], keep: number): number {
  const n = frames.length - Math.max(1, keep);
  if (n <= 0) return 0;
  let f = frames[0].f;
  for (let i = 1; i <= n; i++) f = mergePeerFrames(f, frames[i].f);
  frames.splice(0, n + 1, { ...frames[n], f });
  return n;
}

/** Guest: how fast to tick for the host's reported error. */
export function paceFor(err: number): number {
  if (!(Math.abs(err) >= DEADBAND)) return 1; // NaN too
  return 1 - Math.max(-PACE_MAX, Math.min(PACE_MAX, err * GAIN));
}
