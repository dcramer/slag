/**
 * World units are pixels. Levels are tile grids of varying size (Level.w/h,
 * rolled per level by gen/level/profile.ts); LEVEL_W×LEVEL_H is the
 * "classic" size, which exactly fills the logical view. The view (screen,
 * HUD, pointer coords) is always VIEW_W×VIEW_H logical px; a camera maps the
 * world into it (render/camera.ts, game/view.ts).
 */
export const TILE = 16;
export const LEVEL_W = 48;
export const LEVEL_H = 27;
export const VIEW_W = LEVEL_W * TILE; // 768
export const VIEW_H = LEVEL_H * TILE; // 432

export const FPS = 60;
export const DT = 1 / FPS;

/** Every character shares this hitbox; procedural looks are cosmetic only. */
export const PLAYER_W = 10;
export const PLAYER_H = 14;

/**
 * Player controller tuning. Units: px, px/s, px/s², frames (60 Hz).
 * Target feel: a fast, tight precision platformer — instant-feeling run,
 * snappy turns, short hang at the apex, heavy falls, wall slides and
 * wall hops as a core verb, and generous forgiveness windows.
 * Measured results live in `jumpMetrics()` (src/sim/physics.ts) and are
 * pinned by tests/physics.test.ts. Worldgen must ask reach.ts, never these.
 */
export const PHYS = {
  // --- Walk vs run ----------------------------------------------------------
  // Walking is slow, precise and gives short jumps. Holding RUN is fast with
  // real momentum: it takes a moment to build, skids when you let go or turn,
  // and carries you past ledges if you're careless. Long gaps need a run-up.
  /** Walk top speed: ~6.6 tiles/s. A walking jump clears ~3.5 tiles. */
  walkSpeed: 106,
  /** Run top speed: ~13.4 tiles/s. A running jump clears ~8 tiles. */
  runSpeed: 215,
  /** 0 → walk speed in ~0.06 s: walking is crisp. */
  groundAccel: 1800,
  /** Walk → run top speed in ~0.2 s: a run needs a short run-up. */
  runAccel: 560,
  /** At/below walk speed, releasing the stick stops you in ~0.05 s. */
  groundDecel: 2200,
  /** Above walk speed (run momentum) you skid: run speed → walk speed takes ~0.25 s. */
  runDecel: 450,
  /** Reversing at walk speed: instant-feeling turn-arounds. */
  groundTurnAccel: 3800,
  /** Reversing with run momentum: a visible skid before you turn. */
  runTurnAccel: 1100,

  // --- Air control ---------------------------------------------------------
  /** Steering toward the target speed in the air. */
  airAccel: 1000,
  /** No input in the air: momentum mostly carries (overshoot is on you). */
  airDecel: 260,
  /** Reversing mid-air: strong enough to correct a jump and steer back to a wall. */
  airTurnAccel: 1700,
  /** Above the current top speed in the held direction (run momentum after letting go of run, springs, kicks): decays slowly. */
  airOverspeedDecel: 240,

  // --- Jump --------------------------------------------------------------
  /** Rising gravity. With jumpVel this gives a ~3.7-tile full jump with a ~0.27 s rise. */
  gravity: 1600,
  /** Take-off speed. */
  jumpVel: 422,
  /** Releasing jump clamps upward speed to this: a tap hops ~1.5 tiles. */
  jumpCutVel: 200,
  /** Gravity multiplier while |vy| < apexVelBand and jump is held: a brief hang to aim the landing. */
  apexGravityMult: 0.5,
  apexVelBand: 55,
  /** Falling is heavier than rising: jumps feel punchy, not floaty. */
  fallGravityMult: 1.75,
  /** Terminal velocity (~28 tiles/s). */
  maxFall: 450,
  /** Holding down in the air: extra gravity and a higher terminal velocity for committed drops. */
  fastFallGravityMult: 1.6,
  fastFallMax: 660,
  /** Grace frames to still jump after running off a ledge. */
  coyoteFrames: 6,
  /** A jump pressed this many frames before landing (or touching a wall) still fires. */
  jumpBufferFrames: 8,

  // --- Walls ---------------------------------------------------------------
  /** Falling speed cap while pressing into a normal wall (~49% of terminal): clearly slowed, but quick enough to stay snappy. */
  wallSlideMax: 220,
  /** Cap while pressing into a sticky (goo/slime) wall: you nearly cling. */
  wallStickySlideMax: 22,
  /**
   * Wall jump horizontal kick depends on the held direction:
   *  - into the wall: a tiny kick, so tapping jump while holding toward a wall climbs straight up it;
   *  - neutral: a moderate hop off;
   *  - away from the wall: a strong kick (shaft zig-zags, leaving a wall at speed).
   */
  wallJumpVxInto: 55,
  wallJumpVxNeutral: 170,
  wallJumpVxAway: 250,
  /** Wall jump lift (a bit less than a ground jump: ~3.3 tiles). */
  wallJumpVy: 375,
  /** Sticky walls still let you jump, but weaker (both components scaled). */
  stickyWallJumpMult: 0.78,
  /** Brief reduced air control after a wall jump so the kick reads; short so it never fights the player. Into-wall jumps use 2 frames to re-stick fast. */
  wallJumpLockFrames: 4,
  wallJumpLockFramesInto: 2,
  wallJumpLockAccelMult: 0.35,
  /**
   * Frames before you can wall-jump off the *same* side again (just past the apex). Mashing jump
   * against one wall therefore climbs at a steady ~3 tiles per hop instead of flying; the jump
   * buffer keeps an early press. The opposite wall (shaft) is never on cooldown.
   */
  wallJumpCooldownFrames: 16,
  /** Frames after leaving a wall during which you can still wall-jump off it. */
  wallCoyoteFrames: 6,
  /** How far (px) from the hitbox a wall still counts as touching. */
  wallProbe: 2,

  // --- Forgiveness -------------------------------------------------------
  /** Jumping into a ceiling corner overlapping ≤ this many px nudges you around it. */
  cornerCorrect: 4,
  /** Moving sideways into a ledge whose top is ≤ this many px above your feet pops you onto it. */
  ledgeLip: 3,

  // --- Misc ----------------------------------------------------------------
  /** Down + jump on a one-way platform ignores one-ways for this many frames (drop-through). */
  dropFrames: 6,
  /** Minimum landing speed for bouncy surfaces (jelly) to bounce. */
  bounceMinVy: 140,
  /** How hard a belt on a wall grabs a runner clinging to it, px/s²: well past gravity, so it catches a fall in a few frames and holds them at belt speed. */
  beltGrip: 3600,
  /** A head bonking a belt from below leaves at this many times the belt's speed: up to about a run. */
  beltShoveMult: 2,
} as const;

/** Sinking this far into the pool at the bottom of a classic-size level kills (use level.killY() for any size). */
export const KILL_Y = LEVEL_H * TILE - 2;

export const MAX_PLAYERS = 8;
export const RUN_COUNTDOWN = FPS; // frozen frames before GO
