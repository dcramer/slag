import { afterEach, describe, expect, it, vi } from 'vitest';
import { Match } from '../src/game/match';
import { hashMatch } from '../src/net/snapshot';
import { blendPose, drawnMatch, MAX_GAP, type Sample, SNAP_STEP_PX, StepBlend } from '../src/render/blend';
import { Camera } from '../src/render/camera';
import { PhoneCam } from '../src/render/camera-follow';
import { DT, RUN_COUNTDOWN } from '../src/sim/constants';
import type { Runner } from '../src/sim/run';
import { NO_INPUT } from '../src/sim/types';

const at = (x: number, y: number, more: Partial<Sample> = {}): Sample => ({ x, y, lap: 0, alive: true, held: false, ...more });

/** Just enough of a runner for the blend to read. */
function runner(slot: number, x: number, y: number, more: { alive?: boolean; grip?: boolean; lap?: number } = {}): Runner {
  return { slot, body: { x, y }, alive: more.alive ?? true, lap: more.lap ?? 0, attach: { grip: more.grip ? {} : null } } as unknown as Runner;
}

describe('blendPose', () => {
  it('draws a runner the given fraction of the way between its last two steps', () => {
    expect(blendPose(at(0, 0), at(4, -2), 0.25, 1, 0)).toEqual({ x: 1, y: -0.5 });
    expect(blendPose(at(0, 0), at(4, -2), 1, 1, 0)).toEqual({ x: 4, y: -2 });
  });

  it('snaps to the newer pose for a spawn, a respawn, a hold and a teleport', () => {
    const cur = at(10, 10);
    expect(blendPose(undefined, cur, 0.5, 1, 0)).toEqual({ x: 10, y: 10 });
    expect(blendPose(at(0, 0, { alive: false }), cur, 0.5, 1, 0)).toEqual({ x: 10, y: 10 });
    expect(blendPose(at(8, 8, { held: true }), cur, 0.5, 1, 0)).toEqual({ x: 10, y: 10 });
    expect(blendPose(at(8, 8), at(10, 10, { held: true }), 0.5, 1, 0)).toEqual({ x: 10, y: 10 });
    expect(blendPose(at(10 - SNAP_STEP_PX - 1, 10), cur, 0.5, 1, 0)).toEqual({ x: 10, y: 10 });
    // Two steps apart may cover twice the ground and still be moving.
    expect(blendPose(at(10 - SNAP_STEP_PX - 1, 10), cur, 0.5, 2, 0).x).toBeLessThan(10);
  });

  it('crosses a loop’s lap line without a jump', () => {
    const lap = 400;
    // One step: 3 px up, across the line, where y wraps by a lap and the lap count goes up.
    const p = blendPose(at(0, 1, { lap: 0 }), at(0, 1 - 3 + lap, { lap: 1 }), 0.5, 1, lap);
    expect(p.y).toBeCloseTo(lap - 0.5);
  });
});

describe('StepBlend', () => {
  it('draws a step behind the newest plus the banked fraction, and the latest step when given none', () => {
    const b = new StepBlend();
    b.observe(10, [runner(0, 0, 0)], 0.5, DT);
    b.observe(11, [runner(0, 6, 0)], 0.5, DT);
    expect(b.pose(runner(0, 6, 0), 0).x).toBe(3);
    expect(b.at).toBe(10.5);
    // Two steps landed on one drawn frame: the picture is still a step behind the newest.
    b.observe(13, [runner(0, 18, 0)], 0.5, DT);
    expect(b.pose(runner(0, 18, 0), 0).x).toBeCloseTo(6 + 12 * 0.75);
    expect(b.at).toBe(12.5);
    // No fraction (stepped screenshots, the codex): exactly the step.
    b.observe(14, [runner(0, 24, 0)], undefined, DT);
    expect(b.pose(runner(0, 24, 0), 0).x).toBe(24);
    expect(b.at).toBe(14);
  });

  it('runs on to the newest pose and waits there when the sim stalls, instead of swinging back each tick', () => {
    const b = new StepBlend();
    b.observe(10, [runner(0, 0, 0)], 0, DT);
    b.observe(11, [runner(0, 6, 0)], 0.2, DT);
    const xs: number[] = [];
    // Two steps' worth of drawn frames at 144 Hz with no new step: the accumulator's fraction wraps, the picture mustn't.
    for (let i = 0; i < 6; i++) {
      b.observe(11, [runner(0, 6, 0)], (0.2 + (i + 1) * (60 / 144)) % 1, 1 / 144);
      xs.push(b.pose(runner(0, 6, 0), 0).x);
    }
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1]);
    expect(xs.at(-1)).toBe(6);
  });

  it('forgets the older poses when the race starts over or was last seen too long ago', () => {
    const b = new StepBlend();
    b.observe(500, [runner(0, 0, 0)], 0.5, DT);
    b.observe(0, [runner(0, 30, 0)], 0.5, DT);
    expect(b.pose(runner(0, 30, 0), 0).x).toBe(30);
    b.observe(MAX_GAP + 1, [runner(0, 36, 0)], 0.5, DT);
    expect(b.pose(runner(0, 36, 0), 0).x).toBe(36);
  });

  it('moves at the same pace on a 144 Hz screen as on a 60 Hz one', () => {
    /** Where the runner is drawn over `ms` of wall clock at `hz`, the sim walking it 2 px a step. */
    const drawn = (hz: number, ms: number) => {
      const b = new StepBlend();
      let acc = 0;
      let frame = 0;
      const out: number[] = [];
      for (let t = 0; t < ms; t += 1000 / hz) {
        acc += 1 / hz;
        while (acc >= DT - 1e-9) {
          acc -= DT;
          frame++;
        }
        b.observe(frame, [runner(0, frame * 2, 0)], acc / DT, 1 / hz);
        out.push(b.pose(runner(0, frame * 2, 0), 0).x);
      }
      return out;
    };
    const fast = drawn(144, 500);
    const steps = fast.slice(1).map((x, i) => x - fast[i]);
    // Every drawn frame moves it (no 0-px frames between steps), by about the same amount.
    for (const d of steps.slice(2)) expect(d).toBeCloseTo((2 * 60) / 144, 5);
  });
});

describe('drawnMatch', () => {
  it('is render-only: a race drawn between steps hashes the same as one nobody draws', () => {
    const play = (watch: boolean) => {
      const m = new Match(7);
      m.join('kb1');
      m.join('kb2');
      m.startMatch();
      m.startRun();
      m.run!.frame = RUN_COUNTDOWN;
      const b = new StepBlend();
      const cam = new PhoneCam(new Camera());
      let behind = 0;
      for (let i = 0; i < 90; i++) {
        m.step({ kb1: { ...NO_INPUT, right: true, run: true, jump: i % 30 < 10 } });
        if (!watch) continue;
        b.observe(m.run!.frame, m.run!.runners, 0.4, DT);
        const shown = drawnMatch(m, b);
        cam.frameRace(shown, DT);
        // While it moves, the drawn race is a step behind: the runner shows where the sim no longer has it.
        if (shown.run!.runners[0].body.x !== m.run!.runners[0].body.x) behind++;
        expect(shown.run!.frame).toBe(m.run!.frame);
      }
      if (watch) expect(behind).toBeGreaterThan(5);
      return hashMatch(m);
    };
    expect(play(true)).toBe(play(false));
  });
});

describe('camera shake', () => {
  afterEach(() => vi.restoreAllMocks());

  /** How far the shake moves the view over a second of wall clock at `hz`, held at one strength. */
  function travel(hz: number) {
    let s = 12345;
    vi.spyOn(Math, 'random').mockImplementation(() => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296) % 1);
    const cam = new Camera();
    cam.setBounds(4000, 4000, 1);
    cam.x = cam.y = 2000;
    let path = 0;
    let last: number | null = null;
    for (let i = 0; i < hz; i++) {
      cam.shake = 8;
      cam.update(1 / hz, false);
      const x = (cam as unknown as { sx: number }).sx;
      if (last !== null) path += Math.abs(x - last);
      last = x;
    }
    vi.restoreAllMocks();
    return path;
  }

  it('jolts as hard at 144 Hz as at 60, not harder for redrawing more often', () => {
    const r = travel(144) / travel(60);
    expect(r).toBeGreaterThan(0.8);
    expect(r).toBeLessThan(1.25);
  });
});
