import type { Cell, Vec } from '../../core/geom';
import type { ItemKind } from '../items/types';

/**
 * Prop data model. A PropDef is a bag of modules (bodies, spikes, swinging
 * heads, launchers, emitters, ...). Coordinates in a PropDef are in tiles,
 * relative to the top-left of the footprint's bounding box; angles are
 * radians in screen space (y down). `resolveProp` turns a placed def into
 * world space (pixels, world tile cells, rotated angles).
 *
 * Adding a module type: extend `Module` here, implement a ModuleSim in
 * ./modules/<type>.ts, register it in ./index.ts, and add art in
 * src/render/props/modules/<type>.ts.
 */

export type Material = 'stone' | 'metal' | 'wood' | 'ice' | 'conveyor' | 'goo' | 'jelly' | 'crumble';
export type MetalStyle = 'steel' | 'brass' | 'copper' | 'rust' | 'obsidian' | 'bone' | 'jade' | 'gold';
export type Trim = 'none' | 'stripes' | 'rivets' | 'runes' | 'gems';
export type Ammo =
  | 'bolt'
  | 'arrow'
  | 'cannonball'
  | 'fireball'
  | 'plasma'
  | 'shuriken'
  | 'seeker'
  | 'boomerang'
  | 'rubber'
  | 'cluster'
  | 'shrapnel'
  | 'goo'
  | 'frost'
  | 'ricochet'
  | 'glider'
  // Held-item shots (src/sim/items): never loaded in a launcher.
  | 'puck'
  | 'smokebomb';
export type LauncherStyle =
  | 'crossbow'
  | 'ballista'
  | 'cannon'
  | 'totem'
  | 'turret'
  | 'thrower'
  | 'rocket'
  | 'glaive'
  | 'gumball'
  | 'mortar'
  | 'gooper'
  | 'cryo'
  | 'prism'
  | 'hangar';
export type Head = 'saw' | 'mace' | 'axe';
export type Aim = 'fixed' | 'sweep' | 'track';
/** Set-piece looks (art only; the sim treats every look the same). */
export type RotorLook = 'windmill' | 'cog' | 'chandelier' | 'hay' | 'log' | 'slab' | 'crane' | 'bucket' | 'gondola';
export type RotorSupport = 'tower' | 'ceiling' | 'mast' | 'none';
export type VehicleLook = 'tractor' | 'forklift' | 'ram' | 'boulder' | 'minecart' | 'drill';
export type CannonLook = 'castle' | 'ship' | 'totem' | 'spitter';
export type GeyserLook = 'lava' | 'steam';
export type DecoKind = 'press' | 'ac' | 'antenna';
export type MysteryLook = 'crate' | 'chest' | 'gift';
/** Blast footprints: a filled disk, a line (bore) in the rotation direction, a plus, or a hollow ring. */
export type BlastShape = 'disk' | 'line' | 'cross' | 'ring';
/** What a blast removes: terrain and props, placed props only (EMP), or terrain only (drill). */
export type BlastTarget = 'all' | 'props' | 'terrain';
export type BombLook = 'bomb' | 'emp' | 'drill' | 'charge' | 'clock';

/** What a shot does to a runner it reaches. Only 'kill' is lethal; see HIT in ./ammo.ts. */
export type HitEffect = 'kill' | 'freeze' | 'slow' | 'knock' | 'bonk' | 'none';

export interface AmmoSpec {
  gravity: number;
  radius: number;
  /** Lateral wobble amplitude in px/frame. */
  wobble: number;
  emissive: boolean;
  /** What touching a runner does (default 'kill'). */
  effect?: HitEffect;
  /** Max flight time in frames (default 8 s). */
  life?: number;
}

export const AMMO: Record<Ammo, AmmoSpec> = {
  bolt: { gravity: 0, radius: 2.5, wobble: 0, emissive: false },
  arrow: { gravity: 260, radius: 2.5, wobble: 0, emissive: false },
  cannonball: { gravity: 520, radius: 5, wobble: 0, emissive: false },
  fireball: { gravity: 0, radius: 4, wobble: 0.9, emissive: true },
  plasma: { gravity: 0, radius: 3, wobble: 0, emissive: true },
  shuriken: { gravity: 40, radius: 3.5, wobble: 0, emissive: false },
  // Behaviors for these live in ./ammo.ts (homing, returning, bouncing, splitting, sticking).
  seeker: { gravity: 0, radius: 3.5, wobble: 0, emissive: true, life: 300 },
  boomerang: { gravity: 0, radius: 4, wobble: 0, emissive: false, life: 240 },
  rubber: { gravity: 480, radius: 4.5, wobble: 0, emissive: false, life: 420, effect: 'knock' },
  cluster: { gravity: 380, radius: 4.5, wobble: 0, emissive: false },
  shrapnel: { gravity: 420, radius: 2, wobble: 0, emissive: true, life: 75 },
  goo: { gravity: 340, radius: 4, wobble: 0, emissive: false, effect: 'slow' },
  frost: { gravity: 0, radius: 3, wobble: 0, emissive: true, effect: 'freeze' },
  ricochet: { gravity: 0, radius: 2.5, wobble: 0, emissive: true, life: 300 },
  // A rideable flying plank (ammo.ts: platform projectile). Radius is only its art/pop size.
  glider: { gravity: 0, radius: 8, wobble: 0, emissive: false, life: 420, effect: 'none' },
  // Held-item shots; src/sim/items/ammo.ts registers their behavior.
  puck: { gravity: 1200, radius: 4, wobble: 0, emissive: false, life: 360, effect: 'bonk' },
  smokebomb: { gravity: 700, radius: 3.5, wobble: 0, emissive: false, life: 180, effect: 'none' },
};

export interface PropStyle {
  metal: MetalStyle;
  trim: Trim;
  hue: number;
  glowHue: number;
  woodHue: number;
}

export type Module =
  | { type: 'body'; cells: Cell[]; material: Material; conveyor: number; breakFrames: number; respawnFrames: number }
  | { type: 'spikes'; cells: Cell[]; angle: number }
  | {
      type: 'swinger';
      head: Head;
      hub: Vec;
      /** Arm length (tiles); 0 = head sits on the hub. */
      arm: number;
      angle0: number;
      period: number;
      /** Pendulum amplitude in radians; 0 = full rotation. */
      swing: number;
      dir: 1 | -1;
      radius: number;
      count: number;
      link: 'none' | 'rod' | 'chain';
    }
  | {
      type: 'launcher';
      style: LauncherStyle;
      ammo: Ammo;
      at: Vec;
      angle: number;
      aim: Aim;
      sweep: number;
      sweepPeriod: number;
      interval: number;
      burst: number;
      spread: number;
      spreadAngle: number;
      speed: number;
    }
  | { type: 'flame'; at: Vec; angle: number; length: number; on: number; off: number; warn: number }
  | { type: 'laser'; at: Vec; angle: number; charge: number; fire: number; off: number; sweep: number; sweepPeriod: number }
  | { type: 'tesla'; a: Vec; b: Vec; on: number; off: number; warn: number }
  | { type: 'piston'; at: Vec; angle: number; reach: number; width: number; period: number }
  | { type: 'spring'; at: Vec; angle: number; power: number }
  /** Always-on wind column along `angle` (`length` tiles); air speed = windSpeed(strength) (src/sim/wind.ts). */
  | { type: 'fan'; at: Vec; angle: number; length: number; strength: number }
  /**
   * Demolition charge. Not placed: Match detonates it at placement time (or,
   * with `delay`, sits ticking and detonates when the race starts, catching
   * whatever was placed this round). `shape`/`target` pick the blast; see
   * blastCells/detonate in transform.ts. Defaults: a disk that hits terrain and props.
   */
  | { type: 'bomb'; radius: number; shape?: BlastShape; target?: BlastTarget; width?: number; look?: BombLook; delay?: boolean }
  /**
   * Attachment on the faces of existing solids: `cells` are the HOST cells
   * (terrain or a static placed block), `angle` is the outward face normal.
   * Spikes add a lethal strip; ice/slime add a thin coat that changes the
   * surface (floors and walls). See mountCells for the mounting rule.
   */
  | { type: 'coat'; cells: Cell[]; angle: number; kind: CoatKind }
  | {
      /**
       * Platforms carried around a hub: full rotation (windmill, cog wheel)
       * or a pendulum (chandelier, crane hook) when `swing` > 0. Platforms
       * stay level and are solids with correct dx/dy, so riders are carried.
       */
      type: 'rotor';
      look: RotorLook;
      support: RotorSupport;
      /** Mast x (tiles) for support 'mast'; ignored otherwise. */
      mastX: number;
      hub: Vec;
      /** Hub → platform-center distance (tiles). */
      arm: number;
      /** Number of platforms (full rotation); pendulums use 1. */
      count: number;
      angle0: number;
      /** Frames per revolution, or per full swing for pendulums. */
      period: number;
      /** Pendulum amplitude (rad) around angle0; 0 = continuous rotation. */
      swing: number;
      dir: 1 | -1;
      /** Platform size (tiles). */
      width: number;
      thick: number;
      material: Material;
      /** Cosmetic variation seed. */
      seed: number;
    }
  | {
      /**
       * A body that drives back and forth along +x (tractor, minecart,
       * boulder). Columns of `cols` heights are rideable solids; the
       * leading face is lethal while it moves (hurt 'lead').
       */
      type: 'vehicle';
      look: VehicleLook;
      /** Bottom-left of the body at the start (left end) of its route (tiles). */
      at: Vec;
      /** Height (tiles) of each column, left to right. */
      cols: number[];
      /** Column width (tiles). */
      colW: number;
      /** Travel distance (tiles). */
      span: number;
      /** Cruise speed (tiles/s). */
      speed: number;
      /** Frames parked at each end. */
      pause: number;
      hurt: 'lead' | 'none';
      /** Art faces left instead of right. */
      flip: boolean;
      seed: number;
    }
  | {
      /** Big set-piece gun: fires `ammo` from `length` tiles out along `angle` every `interval` frames. */
      type: 'cannon';
      look: CannonLook;
      at: Vec;
      angle: number;
      ammo: Ammo;
      interval: number;
      burst: number;
      speed: number;
      /** Muzzle distance from `at` (tiles). */
      length: number;
      seed: number;
    }
  | {
      /** Timed column erupting from `at` along `angle` (lethal lava, or a launching steam updraft). */
      type: 'geyser';
      look: GeyserLook;
      at: Vec;
      angle: number;
      /** Column width and max length (tiles). */
      width: number;
      length: number;
      off: number;
      warn: number;
      on: number;
      lethal: boolean;
      /** Updraft strength for non-lethal geysers (air speed = windSpeed(strength), src/sim/wind.ts). */
      strength: number;
    }
  /** Two linked pads: touching one moves you to the other with your velocity intact (both ways). */
  | { type: 'portal'; a: Vec; b: Vec }
  /** Pinball bumper: kicks runners straight away from its center at `power` px/s. */
  | { type: 'bumper'; at: Vec; radius: number; power: number }
  /**
   * Radial force field: polarity 1 pulls toward the core, -1 pushes away.
   * Force falls off linearly to 0 at `radius` (tiles). `off` 0 = always on,
   * otherwise it cycles off → warn → on like a flame jet.
   */
  | { type: 'magnet'; at: Vec; radius: number; strength: number; polarity: 1 | -1; on: number; off: number; warn: number }
  /** Sticky web over some cells: heavy drag while inside (it can catch a fall), weak jumps just after. */
  | { type: 'web'; cells: Cell[]; drag: number }
  /** Blink blocks: solid for `on` frames, gone for `off`, shifted by `offset` (pairs alternate). */
  | { type: 'phase'; cells: Cell[]; on: number; off: number; offset: number }
  /**
   * Proximity crusher: a solid head (cells) that watches the lane in
   * direction `angle`; when a runner enters it shakes for `warn` frames,
   * slams until it hits terrain (≤ `reach` tiles), rests, then slowly
   * returns (rideable on the way back).
   */
  | { type: 'dropper'; cells: Cell[]; angle: number; reach: number; warn: number; rest: number }
  /** Face-mounted spike plate that pops when someone comes near: click (warn) → spikes (up) → cooldown. */
  | { type: 'snapper'; cells: Cell[]; angle: number; warn: number; up: number; cool: number }
  | {
      /**
       * Mystery crate: a solid block that pops a random held item from `pool`
       * out of its top when someone hits it from below or bumps its side.
       * Standing on it does nothing.
       */
      type: 'mystery';
      cells: Cell[];
      pool: ItemKind[];
      /** Pops before it's spent (then it's a plain block); 0 = refills forever. */
      uses: number;
      /** Frames before it can pop again. */
      refill: number;
      look: MysteryLook;
      /** Cosmetic variation seed. */
      seed: number;
    }
  /**
   * A swing that hangs `length` tiles from a ceiling (`mount: 'hang'`); `at` is
   * the hook. It holds one runner for `strain` frames, then snaps and takes
   * `regrow` frames to come back.
   */
  | { type: 'rope'; at: Vec; length: number; strain: number; regrow: number }
  /**
   * A cask that stuffs in whoever touches it and ticks through compass
   * directions `dirs` (0 right, 2 down, 4 left, 6 up), `step` frames on each.
   * Jump locks the aim and fires `delay` frames later at `power` px/s. Nobody
   * firing for `burn` frames backfires out of the rear.
   */
  | { type: 'keg'; at: Vec; dirs: number[]; step: number; power: number; delay: number; burn: number }
  | {
      /** Pure scenery dressing for a set piece (press gantry, AC housing, antenna masts). No sim behavior. */
      type: 'deco';
      kind: DecoKind;
      at: Vec;
      w: number;
      h: number;
      seed: number;
    };

export type Motion =
  | { type: 'none' }
  | { type: 'rail'; angle: number; range: number; period: number }
  | { type: 'loop'; radius: number; period: number; dir: 1 | -1 };

export type CoatKind = 'spikes' | 'ice' | 'slime';

export type Archetype =
  | 'platform'
  | 'spikestrip'
  | 'icecoat'
  | 'slimecoat'
  | 'crumble'
  | 'spikeblock'
  | 'saw'
  | 'flail'
  | 'launcher'
  | 'flamer'
  | 'laser'
  | 'tesla'
  | 'crusher'
  | 'spring'
  | 'fan'
  | 'bomb'
  | 'emp'
  | 'drill'
  | 'charge'
  | 'timebomb'
  | 'hangar'
  | 'portal'
  | 'bumper'
  | 'magnet'
  | 'web'
  | 'blinker'
  | 'dropper'
  | 'snapper'
  | 'wheel'
  | 'mystery'
  | 'rope'
  | 'keg';
export type Role = 'build' | 'hazard' | 'utility' | 'demolish';

export interface PropDef {
  key: string;
  name: string;
  maker: string;
  archetype: Archetype;
  role: Role;
  style: PropStyle;
  motion: Motion;
  modules: Module[];
  /** Cells that must be free to place it (rot 0, normalized). For `mount: 'face'` these are the host cells instead: once placed, only the ones that mounted. */
  footprint: Cell[];
  /** Size (w, h) of the box rotation turns cells in, when the footprint no longer spans it: a trimmed attachment keeps its original box so its cells stay put. */
  box?: [number, number];
  /**
   * 'face': an attachment that must be mounted flush on exposed faces of solids (rotation picks the face).
   * 'hang': the footprint hangs under something solid and rotation does nothing, because a rope only points one way.
   */
  mount?: 'face' | 'hang';
}

export interface PlacedProp {
  uid: number;
  def: PropDef;
  /** Player slot that placed it (trap credit), or -1 for level set pieces. */
  owner: number;
  tx: number;
  ty: number;
  rot: number;
}

/** A placed prop with every module in world space (points/lengths in px, cells in world tiles, angles rotated). */
export interface Resolved {
  pp: PlacedProp;
  mods: Module[];
  motion: Motion;
  phase: number;
}

/** Mutable per-prop runtime state during a race. */
export interface PropState {
  /** Crumble: frame it was first stood on, -1 if idle. */
  triggerFrame: number;
  brokenUntil: number;
  /** Spring/launcher: last activation frame (for animation). */
  lastFire: number;
  /** Tracking launchers: current aim angle per module index. */
  aim: Map<number, number>;
  /** Free-form numeric state for modules: key `${moduleIndex}:${name}`. */
  vars: Map<string, number>;
}

export type ModuleOf<T extends Module['type']> = Extract<Module, { type: T }>;
