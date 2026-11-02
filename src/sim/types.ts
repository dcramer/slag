/** One sim frame of input for one device/player. */
export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  jumpPressed: boolean;
  /** Held: run instead of walk (faster, longer jumps, more momentum). Touch sets it past 70% stick. */
  run?: boolean;
  confirmPressed: boolean;
  altPressed: boolean;
  downPressed: boolean;
  /** Edge: use the held item (down + use tosses it). Optional so older callers and recorded inputs stay valid. */
  usePressed?: boolean;
  /**
   * Mouse pointer in logical view coords (0..768 × 0..432), present only on
   * frames where the pointer moved or clicked. Menus snap the cursor to it.
   */
  pointer?: { x: number; y: number };
}

export const NO_INPUT: InputFrame = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  jumpPressed: false,
  confirmPressed: false,
  altPressed: false,
  downPressed: false,
});

/** Things that happened this frame, for audio/fx. Never read back by the sim. */
export type GameEvent =
  | { type: 'death'; slot: number; x: number; y: number; cause: string; vx: number; vy: number }
  | { type: 'finish'; slot: number; place: number; x: number; y: number }
  | { type: 'spring'; x: number; y: number }
  | { type: 'pop'; x: number; y: number; ammo: string }
  | { type: 'fire'; x: number; y: number; angle: number; style: string }
  | { type: 'crumble-start'; uid: number }
  | { type: 'crumble-break'; uid: number }
  | { type: 'explosion'; x: number; y: number; r: number }
  /** Generic prop moment for fx/audio (pipe, bump, thud, snap, bounce, splat…). (x2, y2): a second point, e.g. a pipe's far mouth. */
  | { type: 'prop'; kind: string; x: number; y: number; x2?: number; y2?: number; r?: number }
  | { type: 'place'; slot: number; x: number; y: number }
  /** A placement the match turned down because it would leave no way to the flag (gen/level/winnable.ts). */
  | { type: 'refuse'; slot: number; x: number; y: number }
  | { type: 'claim'; slot: number }
  | { type: 'phase'; phase: string }
  /** Held items (src/sim/items). `kind` is the item, or the ammo for a swatted shot; `slot` is the runner involved, or -1. */
  | { type: 'item'; what: ItemEventKind; kind: string; slot: number; x: number; y: number };

export type ItemEventKind = 'pop' | 'pickup' | 'use' | 'drop' | 'block' | 'catch' | 'smoke' | 'hit' | 'fizzle';
