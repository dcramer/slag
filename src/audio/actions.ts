import type { RunWorld } from '../sim/run';
import type { Cue } from './cues';

/**
 * Player-action sounds aren't sim events: they're derived by diffing each
 * runner's body between rendered frames (the sim may step 0..n times per
 * frame, so every test is written to survive skipped frames):
 *
 *  - jump:      `jumping` rises, or we left the ground with a strong upward kick (not a spring)
 *  - wall jump: the monotonic `wallJumps` counter increased
 *  - land:      airborne → onGround, loudness from the fall speed just before
 *  - bounce:    jelly — falling fast, now rising, without jumping or a spring
 *  - drop:      drop-through (`dropFrames` rose)
 *  - footsteps: every ~22 px of ground travel at speed
 */

interface Snap {
  onGround: boolean;
  jumping: boolean;
  vy: number;
  wallJumps: number;
  dropFrames: number;
  x: number;
  stride: number;
}

export type SurfaceTone = 'soft' | 'stone' | 'metal' | 'wood' | 'ice' | 'goo';

export class RunnerTracker {
  private prev = new Map<number, Snap>();
  private run: RunWorld | null = null;

  /** Cues for everything the runners did since the last call. `ground` is the theme's default floor tone. */
  update(run: RunWorld, ground: SurfaceTone, pitchOf: (slot: number) => number): Cue[] {
    if (run !== this.run) {
      this.run = run;
      this.prev.clear();
    }
    const out: Cue[] = [];
    for (const r of run.runners) {
      const b = r.body;
      const p = this.prev.get(r.slot);
      const snap: Snap = {
        onGround: b.onGround,
        jumping: b.jumping,
        vy: b.vy,
        wallJumps: b.wallJumps,
        dropFrames: b.dropFrames,
        x: b.x,
        stride: p?.stride ?? 0,
      };
      this.prev.set(r.slot, snap);
      if (!p || !r.alive || r.finished) continue;
      const x = b.x + b.w / 2;
      const y = b.y + b.h;
      const pitch = pitchOf(r.slot);
      const sprung = r.springCooldown >= 7;
      const tone = surfaceTone(b.surface, ground);

      if (b.wallJumps > p.wallJumps) out.push({ name: 'walljump', x, y, pitch });
      else if (!sprung && ((b.jumping && !p.jumping) || (p.onGround && !b.onGround && b.vy < -200))) out.push({ name: 'jump', x, y, pitch });

      if (b.onGround && !p.onGround && p.vy > 60) {
        out.push({ name: 'land', x, y, variant: tone, amount: Math.min(1, (p.vy - 60) / 420) });
      } else if (!b.onGround && !p.onGround && !sprung && !b.jumping && p.vy > 140 && b.vy < -60 && b.wallJumps === p.wallJumps) {
        out.push({ name: 'bounce', x, y, pitch });
      }
      if (b.dropFrames > p.dropFrames) out.push({ name: 'drop', x, y });

      if (b.onGround && p.onGround && Math.abs(b.vx) > 90) {
        snap.stride += Math.abs(b.x - p.x);
        if (snap.stride > 22) {
          snap.stride = 0;
          out.push({ name: 'step', x, y, variant: tone });
        }
      } else snap.stride = 14; // first step lands soon after starting to run
    }
    return out;
  }
}

/** Floor tone for a surface: coats override the theme's terrain default. */
function surfaceTone(s: { friction: number; speedMult: number; bounce: number }, ground: SurfaceTone): SurfaceTone {
  if (s.friction < 0.5) return 'ice';
  if (s.speedMult < 0.8) return 'goo';
  return ground;
}
