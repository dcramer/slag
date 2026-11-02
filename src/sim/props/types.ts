import type { Cell, Vec } from '../../core/geom';

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
export type Ammo = 'bolt' | 'arrow' | 'cannonball' | 'fireball' | 'plasma' | 'shuriken';
export type LauncherStyle = 'crossbow' | 'ballista' | 'cannon' | 'totem' | 'turret' | 'thrower';
export type Head = 'saw' | 'mace' | 'axe';
export type Aim = 'fixed' | 'sweep' | 'track';
/** Set-piece looks (art only; the sim treats every look the same). */
export type RotorLook = 'windmill' | 'cog' | 'chandelier' | 'hay' | 'log' | 'slab' | 'crane' | 'bucket' | 'gondola';
export type RotorSupport = 'tower' | 'ceiling' | 'mast' | 'none';
export type VehicleLook = 'tractor' | 'forklift' | 'ram' | 'boulder' | 'minecart' | 'drill';
export type CannonLook = 'castle' | 'ship' | 'totem' | 'spitter';
export type GeyserLook = 'lava' | 'steam';
export type DecoKind = 'press' | 'ac' | 'antenna';

export interface AmmoSpec {
  gravity: number;
  radius: number;
  /** Lateral wobble amplitude in px/frame. */
  wobble: number;
  emissive: boolean;
}

export const AMMO: Record<Ammo, AmmoSpec> = {
  bolt: { gravity: 0, radius: 2.5, wobble: 0, emissive: false },
  arrow: { gravity: 260, radius: 2.5, wobble: 0, emissive: false },
  cannonball: { gravity: 520, radius: 5, wobble: 0, emissive: false },
  fireball: { gravity: 0, radius: 4, wobble: 0.9, emissive: true },
  plasma: { gravity: 0, radius: 3, wobble: 0, emissive: true },
  shuriken: { gravity: 40, radius: 3.5, wobble: 0, emissive: false },
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
  | { type: 'bomb'; radius: number }
  /**
   * Attachment on the faces of existing solids: `cells` are the HOST cells
   * (terrain or a static placed block), `angle` is the outward face normal.
   * Spikes add a lethal strip; ice/slime add a thin coat that changes the
   * surface (floors and walls). See canPlace for the mounting rule.
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
  | 'bomb';
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
  /** Cells that must be free to place it (rot 0, normalized). For `mount: 'face'` these are the host cells instead. */
  footprint: Cell[];
  /** 'face': an attachment that must be mounted flush on exposed faces of solids (rotation picks the face). */
  mount?: 'face';
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
