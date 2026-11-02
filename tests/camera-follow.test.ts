import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { overview, viewToWorld } from '../src/game/view';
import { hashMatch } from '../src/net/snapshot';
import { Camera } from '../src/render/camera';
import { DEAD_ZONE_Y, EDGE_BAND, FollowCam, MAX_PHONE_ZOOM, MIN_TILE_CSS, PhoneCam, phoneView, phoneZoom, soloRunner } from '../src/render/camera-follow';
import { viewFrame } from '../src/render/frame';
import { PHYS, RUN_COUNTDOWN, TILE, VIEW_H, VIEW_W } from '../src/sim/constants';

const DT = 1 / 60;
const NO_INSETS = { left: 0, right: 0, top: 0 };
/** Landscape windows, CSS px. */
const PHONES = {
  'iPhone SE': [568, 320],
  'iPhone 13': [750, 342],
  'Pixel 7': [863, 360],
} as const;

/** A camera on a level `ww`×`wh` px, in a phone's window. */
function camera(ww = 960, wh = 864, [w, h]: readonly [number, number] = PHONES['iPhone 13'], floor = 0.4) {
  const cam = new Camera();
  cam.setFrame(viewFrame(w, h, NO_INSETS));
  cam.setBounds(ww, wh, floor);
  return cam;
}

const standing = (x: number, y: number, vx = 0) => ({ x, y, vx, facing: 1, onGround: true });

/** Runs `n` frames, moving a runner along with each one. */
function chase(f: FollowCam, cam: Camera, t: ReturnType<typeof standing>, zoom: number, n: number) {
  let v = { cx: cam.x, cy: cam.y, zoom: cam.zoom };
  for (let i = 0; i < n; i++) {
    t.x += t.vx * DT;
    v = f.update(t, zoom, DT, cam, v);
  }
  return v;
}

describe('phone zoom', () => {
  it('gives a tile at least the target on every phone, and leaves a desktop alone', () => {
    for (const [w, h] of Object.values(PHONES)) {
      const k = viewFrame(w, h, NO_INSETS).width / VIEW_W;
      expect(TILE * k * phoneZoom(k)).toBeGreaterThanOrEqual(MIN_TILE_CSS - 1e-9);
    }
    expect(phoneZoom(1280 / VIEW_W)).toBe(1);
    expect(phoneZoom(0.1)).toBe(MAX_PHONE_ZOOM);
  });

  it('turns on for small or touch-first screens, and the URL overrides that', () => {
    expect(phoneView('', 320, false, 0.74).enabled).toBe(true);
    expect(phoneView('', 800, true, 1.3).enabled).toBe(true);
    expect(phoneView('', 1080, false, 2).enabled).toBe(false);
    expect(phoneView('?zoom=0', 320, true, 0.74).enabled).toBe(false);
    const forced = phoneView('?zoom=1', 1080, false, 2);
    expect(forced.enabled).toBe(true);
    expect(forced.zoom).toBeGreaterThan(1); // or a desktop couldn't tell it was on
    expect(phoneView('?zoom=2.4', 1080, false, 2).zoom).toBe(2.4);
  });
});

describe('follow camera', () => {
  it('looks ahead of a run, and swings round when the run reverses', () => {
    const cam = camera(4000, 864);
    const f = new FollowCam();
    const t = standing(1200, 500, PHYS.runSpeed);
    let v = chase(f, cam, t, 2, 120);
    expect(v.cx).toBeGreaterThan(t.x + 30);
    t.vx = -PHYS.runSpeed;
    v = chase(f, cam, t, 2, 120);
    expect(v.cx).toBeLessThan(t.x - 30);
  });

  it('holds still for a hop inside the dead zone and follows a climb past it', () => {
    const cam = camera(960, 2000);
    const f = new FollowCam();
    const zoom = 2;
    const y0 = 1000;
    const ground = { x: 480, y: y0, vx: 0, facing: 1, onGround: true };
    let v = chase(f, cam, ground, zoom, 300);
    const rest = v.cy;
    const dz = DEAD_ZONE_Y * (cam.frame.h / zoom);
    v = chase(f, cam, { ...ground, y: y0 - dz * 0.8, onGround: false }, zoom, 30);
    expect(v.cy).toBeCloseTo(rest, 5);
    v = chase(f, cam, { ...ground, y: y0 - dz * 3, onGround: false }, zoom, 60);
    expect(v.cy).toBeLessThan(rest - 20);
  });

  it('keeps a runner in the window however fast they move, and stops at the level', () => {
    const cam = camera(2000, 864);
    const f = new FollowCam();
    const t = { x: 300, y: 300, vx: 0, facing: 1, onGround: false };
    let v = chase(f, cam, t, 2, 30);
    for (let i = 0; i < 120; i++) {
      t.y += 18; // much faster than the chase
      v = f.update(t, 2, DT, cam, v);
      cam.snap(v);
      cam.update(DT, false);
      const s = cam.worldToView(t.x, Math.min(t.y, 864));
      expect(s.y).toBeLessThanOrEqual(cam.frame.y1 + 1e-6);
      expect(s.y).toBeGreaterThanOrEqual(cam.frame.y0 - 1e-6);
    }
    expect(cam.visible().y + cam.visible().h).toBeLessThanOrEqual(864 + 1e-6);
    const corner = chase(new FollowCam(), cam, { x: 0, y: 0, vx: -PHYS.runSpeed, facing: -1, onGround: true }, 2, 60);
    cam.snap(corner);
    cam.update(DT, false);
    expect(cam.visible().x).toBeGreaterThanOrEqual(-1e-6);
    expect(cam.visible().y).toBeGreaterThanOrEqual(-1e-6);
  });
});

/** A match in the race, past the countdown. */
function race(...devices: string[]) {
  const m = new Match(7);
  for (const d of devices) m.join(d);
  m.startMatch();
  m.startRun();
  m.run!.frame = RUN_COUNTDOWN;
  return m;
}

function phone(m: Match, device: readonly [number, number] = PHONES['iPhone SE']) {
  const ov = overview(m.level);
  const cam = camera(m.level.w * TILE, m.level.h * TILE, device, ov.zoom * 0.92);
  const k = cam.frame.width / VIEW_W;
  const p = new PhoneCam(cam);
  p.enabled = true;
  p.zoom = phoneZoom(k);
  return { cam, p, k };
}

const onScreen = (cam: Camera, x: number, y: number) => {
  const v = cam.visible();
  return x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
};

describe('race camera', () => {
  it('closes in on a solo player: tile size on target, after a look at the whole level', () => {
    const m = race('touch');
    const { cam, p, k } = phone(m);
    m.run!.frame = 0;
    for (let i = 0; i < 60; i++) p.frameRace(m, DT);
    expect(cam.zoom).toBeLessThan(p.zoom - 0.3);
    m.run!.frame = RUN_COUNTDOWN;
    for (let i = 0; i < 300; i++) p.frameRace(m, DT);
    expect(TILE * k * cam.zoom).toBeGreaterThan(MIN_TILE_CSS - 0.5);
    const b = m.run!.runners[0].body;
    expect(onScreen(cam, b.x, b.y)).toBe(true);
  });

  it('stays out of the way off phones', () => {
    const m = race('kb1');
    const { cam, p } = phone(m);
    p.enabled = false;
    for (let i = 0; i < 300; i++) p.frameRace(m, DT);
    expect(cam.zoom).toBeLessThanOrEqual(1.45);
  });

  it('only ever follows with exactly one player in the match', () => {
    expect(soloRunner(race('touch'))).not.toBeNull();
    expect(soloRunner(race('touch', 'kb1'))).toBeNull();
    expect(soloRunner(race('peer-a:touch', 'peer-b:touch'))).toBeNull();
    const m = race('touch', 'kb1');
    m.run!.runners[1].alive = false;
    expect(soloRunner(m)).toBeNull(); // a match of two stays framed, even with one left standing
  });

  for (const [name, device] of Object.entries(PHONES)) {
    it(`the all-players rule beats the tile target, local or remote (${name})`, () => {
      for (const devices of [
        ['touch', 'kb1'],
        ['peer-a:touch', 'peer-b:touch'],
      ]) {
        const m = race(...devices);
        const { cam, p, k } = phone(m, device);
        const [a, b] = m.run!.runners;
        const ww = m.level.w * TILE;
        a.body.x = 40;
        b.body.x = ww - 60;
        for (let i = 0; i < 240; i++) {
          // Far apart and moving, so the smoothing alone would lose someone.
          a.body.x = Math.min(ww / 2, a.body.x + 3);
          b.body.x = Math.max(ww / 2, b.body.x - 2);
          p.frameRace(m, DT);
          expect(onScreen(cam, a.body.x, a.body.y)).toBe(true);
          expect(onScreen(cam, b.body.x, b.body.y)).toBe(true);
          if (i === 0) expect(TILE * k * cam.zoom).toBeLessThan(MIN_TILE_CSS);
        }
      }
    });
  }

  it('lets a tight pack get close: the rule costs zoom only when it has to', () => {
    const m = race('touch', 'kb1');
    const { cam, p } = phone(m);
    const [a, b] = m.run!.runners;
    b.body.x = a.body.x;
    b.body.y = a.body.y;
    for (let i = 0; i < 600; i++) p.frameRace(m, DT);
    expect(cam.zoom).toBeGreaterThan(1.45);
    expect(onScreen(cam, a.body.x, a.body.y)).toBe(true);
  });

  it('is render-only: a framed race hashes the same as one nobody watches', () => {
    const play = (watch: boolean) => {
      const m = race('touch');
      const { p } = phone(m);
      for (let i = 0; i < 120; i++) {
        m.step({});
        if (watch) p.frameRace(m, DT);
      }
      return hashMatch(m);
    };
    expect(play(true)).toBe(play(false));
  });
});

describe('camera pose', () => {
  it('forgets the runners it was keeping in view once a pose is snapped', () => {
    const cam = camera();
    cam.frameAll(
      [
        { x: 20, y: 20 },
        { x: 940, y: 840 },
      ],
      1.4,
      120,
    );
    cam.update(DT);
    cam.snap({ cx: 480, cy: 432, zoom: 2 });
    cam.update(DT, false);
    expect(cam.zoom).toBe(2); // a stale frameAll would drag this back out
  });
});

/** A match in the place phase, driven by a real pose. */
function placing() {
  // Pinned to the level this was written against: a short, wide level can't keep the point under the fingers, it sits centered.
  const m = new Match(7, 'mine');
  m.join('touch');
  m.startMatch();
  m.phase = 'place';
  const ctx = phone(m);
  const ov = ctx.p.board(m, DT);
  ctx.cam.snap(ov);
  return { m, ...ctx, ov };
}

describe('pick and place camera', () => {
  it('starts on the overview, and a pinch keeps what is under the fingers there', () => {
    const { m, p, ov } = placing();
    expect(p.board(m, DT)).toEqual(ov);
    const mid = { x: 400, y: 200 };
    const anchor = viewToWorld(ov, mid.x, mid.y);
    p.pinch(1.6, mid, { x: 0, y: 0 });
    const v = p.board(m, DT);
    expect(v.zoom).toBeCloseTo(ov.zoom * 1.6);
    const after = viewToWorld(v, mid.x, mid.y);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });

  it('pans with two fingers, stops at the level, and pinches back out to the exact overview', () => {
    const { m, p, cam, ov } = placing();
    p.pinch(4, { x: 400, y: 200 }, { x: 0, y: 0 });
    const v0 = p.board(m, DT);
    p.pinch(1, { x: 300, y: 200 }, { x: -100, y: 0 }); // both fingers move left: the view moves right
    expect(p.board(m, DT).cx).toBeGreaterThan(v0.cx);
    for (let i = 0; i < 40; i++) p.pinch(1, { x: 300, y: 200 }, { x: -100, y: 0 });
    cam.snap(p.board(m, DT));
    cam.update(DT, false);
    const seen = cam.visible();
    expect(seen.x + seen.w).toBeLessThanOrEqual(m.level.w * TILE + 1e-6);
    for (let i = 0; i < 40; i++) p.pinch(0.7, { x: 400, y: 200 }, { x: 0, y: 0 });
    expect(p.board(m, DT)).toEqual(ov);
    expect(p.toBoard({ x: 123, y: 45 })).toEqual({ x: 123, y: 45 });
  });

  it('caps a pinch, and a phone can never pinch past it', () => {
    const { m, p } = placing();
    for (let i = 0; i < 40; i++) p.pinch(1.5, { x: 400, y: 200 }, { x: 0, y: 0 });
    expect(p.board(m, DT).zoom).toBeLessThanOrEqual(Math.max(2, p.zoom * 1.25) + 1e-9);
  });

  it('auto-pans only while a ghost is held near an edge, and faster the closer it gets', () => {
    const { m, p, cam } = placing();
    p.pinch(3, { x: 300, y: 200 }, { x: 0, y: 0 });
    const f = cam.frame;
    const mid = { x: (f.safeX0 + f.safeX1) / 2, y: 200 };
    const start = p.board(m, DT).cx;
    p.dragPoint = mid;
    expect(p.board(m, DT).cx).toBe(start);
    p.dragPoint = { x: f.safeX1 - EDGE_BAND / 2, y: 200 };
    const near = p.board(m, DT).cx - start;
    expect(near).toBeGreaterThan(0);
    p.dragPoint = { x: f.safeX1 - 1, y: 200 };
    const c1 = p.board(m, DT).cx;
    p.dragPoint = { x: f.safeX1 - 1, y: 200 };
    expect(p.board(m, DT).cx - c1).toBeGreaterThan(near);
    p.dragPoint = null;
    const c2 = p.board(m, DT).cx;
    expect(p.board(m, DT).cx).toBe(c2);
  });

  it('never auto-pans on the overview, and resets for the next phase', () => {
    const { m, p, ov } = placing();
    p.dragPoint = { x: 0, y: 0 };
    expect(p.board(m, DT)).toEqual(ov);
    p.pinch(2, { x: 300, y: 200 }, { x: 0, y: 0 });
    m.phase = 'pick';
    expect(p.board(m, DT)).toEqual(ov);
  });

  it('a finger lands the same world cursor on every peer, whatever each one has zoomed to', () => {
    const { m, p } = placing();
    p.pinch(3, { x: 300, y: 200 }, { x: 0, y: 0 });
    const v = p.board(m, DT);
    const finger = { x: 500, y: 180 };
    const world = viewToWorld(v, finger.x, finger.y);
    // What crosses the network is the overview pointer; a peer on its own overview reads the same world px.
    const peer = new Match(7, 'mine');
    peer.join('touch');
    peer.startMatch();
    peer.phase = 'place';
    for (const q of [m, peer]) {
      const pl = q.players[0];
      q.moveCursor(pl, { ...NO_BUTTONS, pointer: p.toBoard(finger) });
      expect(pl.cursor.x).toBeCloseTo(world.x, 3);
      expect(pl.cursor.y).toBeCloseTo(world.y, 3);
      expect(q.cursorScreen(pl).x).toBeLessThan(VIEW_W);
      expect(q.cursorScreen(pl).y).toBeLessThan(VIEW_H);
    }
  });
});

const NO_BUTTONS = {
  left: false,
  right: false,
  up: false,
  down: false,
  run: false,
  jump: false,
  jumpPressed: false,
  confirmPressed: false,
  altPressed: false,
  downPressed: false,
  usePressed: false,
};
