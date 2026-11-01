/** World units are pixels. The level is a fixed-size tile grid that fills the view. */
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
  // --- Run ---------------------------------------------------------------
  /** Ground top speed: 12 tiles/s. Fast enough that a 48-tile level crosses in ~4 s. */
  runSpeed: 192,
  /** 0 → top speed in ~0.11 s: responsive without being a teleport. */
  groundAccel: 1750,
  /** Releasing the stick stops you in ~0.08 s: precise landings on small ledges. */
  groundDecel: 2400,
  /** Used instead of accel while input opposes velocity: turn-arounds feel instant. */
  groundTurnAccel: 4200,

  // --- Air control ---------------------------------------------------------
  /** Strong but slightly weaker than the ground so jumps commit a little. */
  airAccel: 1450,
  /** No input in the air: drift bleeds off, but momentum carries a jump. */
  airDecel: 900,
  /** Reversing mid-air: high so you can correct a jump and steer back to a wall. */
  airTurnAccel: 2600,
  /** Faster than run speed (springs, kicks) in the held direction decays gently, keeping launches fun. */
  airOverspeedDecel: 500,

  // --- Jump --------------------------------------------------------------
  /** Rising gravity. With jumpVel this gives a ~4.5-tile full jump with a ~0.3 s rise. */
  gravity: 1600,
  /** Take-off speed. */
  jumpVel: 465,
  /** Releasing jump clamps upward speed to this: a tap hops ~1.5 tiles. */
  jumpCutVel: 215,
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
  /** Falling speed cap while pressing into a normal wall: a controllable slide. */
  wallSlideMax: 100,
  /** Cap while pressing into a sticky (goo/slime) wall: you nearly cling. */
  wallStickySlideMax: 22,
  /** Wall jump kick away from the wall; slightly above run speed so it reads as a kick. */
  wallJumpVx: 210,
  /** Wall jump lift (a bit less than a ground jump). */
  wallJumpVy: 410,
  /** Sticky walls still let you jump, but weaker (both components scaled). */
  stickyWallJumpMult: 0.78,
  /** After a wall jump horizontal accel is scaled by wallJumpLockAccelMult for this long, so the kick can't be cancelled instantly but holding back toward the wall returns you to it (single-wall climbs). */
  wallJumpLockFrames: 7,
  wallJumpLockAccelMult: 0.3,
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
} as const;

/** Sinking this far into the pool at the bottom kills. */
export const KILL_Y = LEVEL_H * TILE - 2;

export const MAX_PLAYERS = 4;
export const TARGET_SCORE = 50;
export const RUN_TIME_LIMIT = FPS * 45;
export const RUN_COUNTDOWN = FPS; // frozen frames before GO
