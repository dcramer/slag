import { describe, expect, it } from 'vitest';
import { ALT_HOLD_FRAMES, DRAG_OFFSET_CSS, RUN_AT, TouchInput, touchLayout, touchModeFor } from '../src/input/touch';
import { Match } from '../src/game/match';
import { FrameBudget, pickTier } from '../src/ui/touch/device';

// iPhone-13-ish landscape viewport; the 768×432 view is letterboxed to 693×390 in the middle.
const W = 844;
const H = 390;
const scale = Math.min(W / 768, H / 432);
const left = (W - 768 * scale) / 2;
const toView = (cx: number, cy: number) => ({ x: (cx - left) / scale, y: cy / scale });

function make(mode: Parameters<TouchInput['setMode']>[0]) {
  const t = new TouchInput();
  t.layout = touchLayout(W, H);
  t.toView = toView;
  t.setMode(mode);
  return t;
}

describe('touch layout', () => {
  it('keeps every control on screen and inside the safe area', () => {
    const ins = { top: 0, right: 47, bottom: 21, left: 47 };
    const L = touchLayout(W, H, ins);
    for (const c of [L.primary, L.secondary, L.menu]) {
      expect(c.x - c.r).toBeGreaterThanOrEqual(ins.left);
      expect(c.x + c.r).toBeLessThanOrEqual(W - ins.right);
      expect(c.y - c.r).toBeGreaterThanOrEqual(ins.top);
      expect(c.y + c.r).toBeLessThanOrEqual(H - ins.bottom);
    }
    expect(L.stickHome.x - L.stickR).toBeGreaterThanOrEqual(ins.left);
    // Thumb-sized: big jump ≥ ~1.5 cm, secondary ≥ 44 px Apple minimum.
    expect(L.primary.r * 2).toBeGreaterThanOrEqual(88);
    expect(L.secondary.r * 2).toBeGreaterThanOrEqual(44);
    // Buttons don't overlap.
    expect(Math.hypot(L.primary.x - L.secondary.x, L.primary.y - L.secondary.y)).toBeGreaterThan(L.primary.r + L.secondary.r);
  });
});

describe('touch → InputFrame (race)', () => {
  it('multi-touch: run with the left thumb while holding jump with the right', () => {
    const t = make('race');
    const R = t.layout.stickR;
    t.down(1, 150, 300);
    t.move(1, 150 + R * 0.4, 300); // walk right
    let f = t.sample();
    expect(f).toMatchObject({ right: true, left: false, run: false, jump: false, jumpPressed: false });
    t.down(2, 700, 320); // right half → jump
    t.move(1, 150 + R * (RUN_AT + 0.1), 300); // push past 70% → run
    f = t.sample();
    expect(f).toMatchObject({ right: true, run: true, jump: true, jumpPressed: true });
    f = t.sample();
    expect(f.jump).toBe(true);
    expect(f.jumpPressed).toBe(false); // press is an edge, hold is a level
    t.up(2, 700, 320);
    f = t.sample();
    expect(f).toMatchObject({ right: true, jump: false });
  });

  it('hold duration = jump hold (variable jump height), and sub-frame taps still press', () => {
    const t = make('race');
    t.down(5, 700, 300);
    const held: boolean[] = [];
    for (let i = 0; i < 6; i++) held.push(t.sample().jump);
    t.up(5, 700, 300);
    held.push(t.sample().jump);
    expect(held).toEqual([true, true, true, true, true, true, false]);
    t.down(6, 700, 300);
    t.up(6, 700, 300); // tap between two steps
    const f = t.sample();
    expect(f.jumpPressed).toBe(true);
    expect(f.jump).toBe(false);
  });

  it('follow stick: reversing after a hard push is a short move, and down needs a real downward pull', () => {
    const t = make('race');
    const R = t.layout.stickR;
    t.down(1, 200, 280);
    t.move(1, 200 + R * 2, 280); // way past the rim: anchor follows
    expect(t.sample()).toMatchObject({ right: true, run: true });
    t.move(1, 200 + R * 2 - R * 1.3, 280); // back 1.3R → now left of the dragged anchor
    expect(t.sample()).toMatchObject({ left: true, right: false });
    // Slight thumb sag while running is not "down".
    t.move(1, 200 + R * 2 - R * 1.3 - R * 0.6, 280 + R * 0.25);
    expect(t.sample().down).toBe(false);
    t.move(1, 200 + R * 2 - R * 1.3 - R * 0.6, 280 + R * 0.9);
    expect(t.sample().down).toBe(true); // down + JUMP = drop through one-ways
  });

  it('ALT self-destructs only after a deliberate hold, once', () => {
    const t = make('race');
    const s = t.layout.secondary;
    t.down(3, s.x, s.y);
    const fired: number[] = [];
    for (let i = 0; i < ALT_HOLD_FRAMES + 20; i++) if (t.sample().altPressed) fired.push(i);
    expect(fired).toEqual([ALT_HOLD_FRAMES - 1]);
    t.up(3, s.x, s.y);
    // A quick tap does nothing.
    t.down(4, s.x, s.y);
    t.sample();
    t.up(4, s.x, s.y);
    expect(t.sample().altPressed).toBe(false);
  });

  it('a touch keeps its role: a jump thumb sliding left never steers, and only one stick thumb counts', () => {
    const t = make('race');
    t.down(1, 700, 300);
    t.move(1, 100, 300);
    expect(t.sample()).toMatchObject({ jump: true, left: false, right: false });
    t.down(2, 150, 300);
    t.down(3, 160, 300);
    t.move(3, 60, 300); // second left thumb is ignored
    expect(t.sample().left).toBe(false);
  });
});

describe('touch → InputFrame (menus)', () => {
  it('pick: tap snaps the cursor to the finger and confirms on lift', () => {
    const t = make('pick');
    t.down(1, 400, 200);
    let f = t.sample();
    expect(f.pointer).toEqual(toView(400, 200));
    expect(f.confirmPressed).toBe(false);
    t.up(1, 402, 201);
    f = t.sample();
    expect(f.confirmPressed).toBe(true);
    expect(f.pointer).toEqual(toView(402, 201));
  });

  it('place: ghost sits a fingertip above the finger, buttons rotate/place, lifting a drag never places', () => {
    const t = make('place');
    t.down(1, 400, 150);
    let f = t.sample();
    const v = toView(400, 150);
    expect(f.pointer!.x).toBeCloseTo(v.x);
    expect(v.y - f.pointer!.y).toBeCloseTo(DRAG_OFFSET_CSS / scale, 3);
    t.move(1, 430, 160);
    f = t.sample();
    expect(f.pointer!.x).toBeCloseTo(toView(430, 160).x);
    t.up(1, 430, 160);
    f = t.sample();
    expect(f.confirmPressed).toBe(false);
    expect(f.pointer).toBeUndefined();
    // Near the bottom edge the offset fades so the lowest rows are reachable.
    t.down(2, 400, H - 1);
    f = t.sample();
    expect(f.pointer!.y).toBeGreaterThan(425);
    t.up(2, 400, H - 1);
    // Rotate is a tap; place fires when the finger lifts on PLACE, not if it slides off.
    const { primary: P, secondary: S } = t.layout;
    t.down(3, S.x, S.y);
    expect(t.sample().altPressed).toBe(true);
    t.up(3, S.x, S.y);
    t.down(4, P.x, P.y);
    expect(t.sample().confirmPressed).toBe(false);
    t.move(4, P.x - P.r * 3, P.y);
    t.up(4, P.x - P.r * 3, P.y);
    expect(t.sample().confirmPressed).toBe(false);
    t.down(5, P.x, P.y);
    t.up(5, P.x + 3, P.y);
    expect(t.sample().confirmPressed).toBe(true);
  });

  it('lobby taps go to the HUD hit-test (in view coords), continue screens confirm on tap', () => {
    const t = make('lobby');
    const hits: { x: number; y: number }[] = [];
    t.onUiTap = (x, y) => (hits.push({ x, y }), true);
    t.down(1, 300, 200);
    t.up(1, 300, 200);
    expect(hits).toEqual([toView(300, 200)]);
    expect(t.sample().confirmPressed).toBe(false); // never a raw confirm in the lobby
    t.down(2, 300, 200);
    t.up(2, 380, 200); // a swipe is not a tap
    expect(hits.length).toBe(1);
    t.setMode('continue');
    t.down(3, 500, 300);
    t.up(3, 500, 300);
    expect(t.sample().confirmPressed).toBe(true);
  });

  it('mode switches drop held touches so nothing leaks into the next phase', () => {
    const t = make('race');
    t.down(1, 700, 300);
    expect(t.sample().jump).toBe(true);
    t.setMode('continue');
    t.up(1, 700, 300); // lift after the switch: unknown touch, no confirm
    expect(t.sample()).toMatchObject({ jump: false, confirmPressed: false });
  });
});

describe('touch player in a match', () => {
  it('joins as its own device and the mode follows the phase', () => {
    const m = new Match(7);
    expect(touchModeFor(m)).toBe('lobby');
    m.join('kb1');
    m.join('touch');
    m.startMatch();
    expect(touchModeFor(m)).toBe('pick');
    m.player(1)!.claim = 0;
    expect(touchModeFor(m)).toBe('off');
    m.startRun();
    expect(touchModeFor(m)).toBe('race');
  });

  it('touch frames drive the sim deterministically (same taps → same match)', () => {
    const run = () => {
      const m = new Match(11);
      const t = make('lobby');
      t.onUiTap = () => true;
      m.join('touch');
      m.startMatch();
      for (let i = 0; i < 400; i++) {
        t.setMode(touchModeFor(m));
        if (i === 20) t.down(1, 380, 200);
        if (i === 22) t.up(1, 380, 200);
        m.step({ touch: t.sample() });
      }
      return JSON.stringify(m.players.map((p) => [p.claim, p.cursor, p.placed]));
    };
    const a = run();
    expect(a).toBe(run());
    expect(JSON.parse(a)[0][0]).toBeGreaterThanOrEqual(0); // the tap claimed a crate card
  });
});

describe('mobile quality', () => {
  it('desktop stays high; phones drop to mid/low', () => {
    expect(pickTier({ coarse: false, shortSide: 1080, cores: 8 })).toBe('high');
    expect(pickTier({ coarse: true, shortSide: 390, cores: 6, memoryGB: 6 })).toBe('mid');
    expect(pickTier({ coarse: true, shortSide: 360, cores: 4 })).toBe('low');
  });
  it('steps down only after sustained slow frames, and ignores pauses', () => {
    const b = new FrameBudget(22, 30);
    let n = 0;
    for (let i = 0; i < 200; i++) if (b.push(16.7)) n++;
    for (let i = 0; i < 20; i++) if (b.push(1000)) n++; // tab hidden / paused
    expect(n).toBe(0);
    for (let i = 0; i < 120; i++) if (b.push(40)) n++;
    expect(n).toBe(1);
  });
});
