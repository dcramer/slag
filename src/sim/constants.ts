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

export const PHYS = {
  gravity: 1500,
  fallGravityMult: 1.35,
  maxFall: 560,
  jumpVel: 440,
  jumpCutMult: 0.45,
  runSpeed: 140,
  groundAccel: 1400,
  groundDecel: 1800,
  airAccel: 950,
  airDecel: 450,
  coyoteFrames: 6,
  jumpBufferFrames: 7,
  wallSlideMax: 90,
  wallJumpVx: 170,
  wallJumpVy: 400,
  wallJumpLockFrames: 9,
} as const;

/** Falling this far below the level kills. */
export const KILL_Y = LEVEL_H * TILE + 32;

export const MAX_PLAYERS = 4;
export const TARGET_SCORE = 50;
export const RUN_TIME_LIMIT = FPS * 45;
export const RUN_COUNTDOWN = FPS; // frozen frames before GO
