import { AMMO, type Module, type PropDef } from '../sim/props';

/** Human descriptions of every module type ("parts") for the codex. */
export const PART_INFO: Record<Module['type'], { title: string; blurb: string }> = {
  body: {
    title: 'Body',
    blurb:
      'Solid cells of a material. Stone/metal/wood are plain; ice is slippery, goo is slow and sticky, jelly bounces you, conveyors carry you, crumble breaks after you stand on it and respawns later.',
  },
  spikes: { title: 'Spikes', blurb: 'A lethal strip along one face of a body. Rotation decides which side is pointy.' },
  swinger: { title: 'Swinger', blurb: 'A saw, mace or axe on an arm. Static, orbiting a hub (1–3 heads), or swinging like a pendulum on a rod or chain.' },
  launcher: {
    title: 'Launcher',
    blurb:
      'Fires projectiles on a schedule: fixed aim, sweeping, or tracking the nearest runner it can see (lobbed ammo solves a ballistic arc). Bursts and spreads vary.',
  },
  flame: { title: 'Flame jet', blurb: 'Off → sputtering warning → roaring flame for a while. Stops at walls.' },
  laser: { title: 'Laser', blurb: 'Charges with a flickering telegraph, then fires a beam to the first solid thing in its way. Some sweep back and forth.' },
  tesla: { title: 'Tesla gate', blurb: 'Two pylons that periodically arc lightning between them.' },
  piston: { title: 'Crusher', blurb: 'A solid head that slams out (deadly leading edge), holds, then slowly retracts. Can crush you against walls.' },
  spring: { title: 'Spring', blurb: 'Launches whoever touches it in the direction it faces.' },
  fan: {
    title: 'Fan',
    blurb:
      'Blows a steady wind column until it hits a wall. Up-fans carry you up at a steady speed and let you float at the top (you can still jump in them); side fans push you along — walk and you drift back, run to beat a weak one.',
  },
  rotor: { title: 'Rotor', blurb: 'Platforms on arms turning around a hub (windmills, cog lifts) or swinging as a pendulum (chandeliers, hoists). Ride them.' },
  vehicle: {
    title: 'Vehicle',
    blurb: 'A rideable machine that drives back and forth along the ground, pausing at each end. Its leading face is deadly while it moves.',
  },
  cannon: { title: 'Fixed cannon', blurb: 'A big emplacement firing on a steady rhythm, with a visible fuse telegraph before each shot.' },
  geyser: {
    title: 'Geyser',
    blurb:
      'A vent that sits still, rumbles and hisses as a warning, then erupts. Lava geysers kill; steam geysers carry you up to float at the plume tip until it dies down.',
  },
  deco: { title: 'Scenery', blurb: 'Big static set dressing (presses, AC units, antennas) that you can stand on.' },
  coat: {
    title: 'Attachment',
    blurb:
      'Mounted flush on an exposed face of a block (rotation picks the face). Spikes kill; ice coats make floors slippery and walls un-jumpable; slime makes floors slow and walls sticky.',
  },
  mystery: { title: 'Mystery crate', blurb: 'A solid block with a glowing porthole and something inside.' },
  bomb: {
    title: 'Demolition',
    blurb:
      'Not placed but detonated. The blast shape (disk, line bore, cross, hollow ring) and target (terrain and props, props only, terrain only) vary; time bombs wait and go off as the race starts, catching whatever was placed that round. Spawn and goal zones are protected.',
  },
  portal: {
    title: 'Warp pads',
    blurb:
      'Two linked pads. Step into one and you come out of the other with your speed and direction intact. Handy shortcut, or a misdirection straight into trouble.',
  },
  bumper: {
    title: 'Bumper',
    blurb: 'Kicks you straight away from its center, hard. The angle you hit it at is the angle you leave at: a launch you can aim, or a shove off a ledge.',
  },
  magnet: {
    title: 'Gravity well',
    blurb: 'A field that pulls you toward its core (or pushes you away), strongest at the middle. Bends jumps and drags you off course; some pulse on and off.',
  },
  web: {
    title: 'Web',
    blurb: 'Sticky strands: catches falls and lets you hop up through it slowly, but you crawl while inside and stay sluggish a moment after.',
  },
  phase: {
    title: 'Blink blocks',
    blurb: 'Solid on a timer. They flicker before vanishing and fill in before returning. Pairs take turns, so you cross in rhythm. Never reappear inside you.',
  },
  dropper: {
    title: 'Dropstone',
    blurb:
      'Watches the lane under it. When you enter, it glares and shakes, then slams down until it lands on something, and slowly rises again. You can ride it back up.',
  },
  snapper: {
    title: 'Snap trap',
    blurb:
      'A plate mounted on a block face. Step in front of it and it clicks, then fires spikes for a moment and needs a cooldown. Keep moving and you are fine.',
  },
  rope: { title: 'Sausage Vine', blurb: 'Fresh from the hook.' },
  keg: { title: 'Kegapult', blurb: 'XXX.' },
};

const AIM_TAG: Record<string, string> = { fixed: 'FIXED', sweep: 'SWEEPS', track: 'TRACKS' };

/** A short tag for a crate card (aim mode for launchers, etc.), or null. */
export function propTag(def: PropDef): string | null {
  for (const m of def.modules) {
    if (m.type === 'launcher') return m.ammo === 'seeker' ? 'HOMING' : m.ammo === 'glider' ? 'RIDEABLE' : AIM_TAG[m.aim];
    if (m.type === 'bomb') return m.delay ? 'AT RACE START' : m.target === 'props' ? 'PROPS ONLY' : m.target === 'terrain' ? 'TERRAIN ONLY' : null;
    if (m.type === 'keg') return m.dirs.length > 1 ? AIM_TAG.sweep : AIM_TAG.fixed;
  }
  return null;
}

const fmt = (n: number, d = 0) => (Number.isInteger(n) && d === 0 ? String(n) : n.toFixed(d || 1));
const secs = (frames: number) => `${(frames / 60).toFixed(1)}s`;

/** One-line stat summaries per module, for codex cards. */
export function summarize(def: PropDef): string[] {
  const out: string[] = [];
  for (const m of def.modules) {
    switch (m.type) {
      case 'body':
        out.push(
          `${m.material} body · ${m.cells.length} cell${m.cells.length > 1 ? 's' : ''}${m.conveyor ? ` · belt ${fmt(Math.abs(m.conveyor))}px/s` : ''}${m.material === 'crumble' ? ` · breaks ${secs(m.breakFrames)}, back ${secs(m.respawnFrames)}` : ''}`,
        );
        break;
      case 'spikes':
        out.push(`spikes on ${m.cells.length} face${m.cells.length > 1 ? 's' : ''}`);
        break;
      case 'swinger':
        out.push(
          `${m.count > 1 ? `${m.count}× ` : ''}${m.head} r${fmt(m.radius, 1)} · ${m.arm === 0 ? 'static' : m.swing > 0 ? `pendulum ±${fmt((m.swing * 180) / Math.PI)}°` : 'orbit'}${m.arm ? ` · arm ${fmt(m.arm, 1)} ${m.link}` : ''} · ${secs(m.period)} cycle`,
        );
        break;
      case 'launcher':
        out.push(
          `${m.style} → ${m.ammo}${AMMO[m.ammo].gravity > 200 ? ' (lobbed)' : ''} · ${{ fixed: 'Fixed', sweep: 'Sweeps', track: 'Tracks' }[m.aim]} · every ${secs(m.interval)}${m.burst > 1 ? ` ×${m.burst} burst` : ''}${m.spread > 1 ? ` · ${m.spread}-way` : ''} · ${fmt(m.speed)}px/s`,
        );
        break;
      case 'flame':
        out.push(`flame ${fmt(m.length)} tiles · on ${secs(m.on)} / off ${secs(m.off)}`);
        break;
      case 'laser':
        out.push(`laser · charge ${secs(m.charge)} · fire ${secs(m.fire)}${m.sweep ? ` · sweeps ±${fmt((m.sweep * 180) / Math.PI)}°` : ''}`);
        break;
      case 'tesla':
        out.push(`tesla gap ${fmt(Math.abs(m.b[0] - m.a[0]))} tiles · arc ${secs(m.on)} / rest ${secs(m.off)}`);
        break;
      case 'piston':
        out.push(`crusher ${fmt(m.width)} wide · reach ${fmt(m.reach, 1)} · ${secs(m.period)} cycle`);
        break;
      case 'spring':
        out.push(`spring power ${fmt(m.power)}`);
        break;
      case 'fan':
        out.push(`fan ${fmt(m.length)} tiles · strength ${fmt(m.strength)}`);
        break;
      case 'coat':
        out.push(`${m.kind} on ${m.cells.length} face${m.cells.length > 1 ? 's' : ''} · mounts on blocks`);
        break;
      case 'bomb': {
        const shape = m.shape ?? 'disk';
        const what = { all: 'terrain + props', props: 'props only', terrain: 'terrain only' }[m.target ?? 'all'];
        out.push(
          `${shape === 'line' ? `bores ${fmt(m.radius)} tiles${(m.width ?? 1) > 1 ? ` × ${fmt(m.width ?? 1)}` : ''}` : shape === 'cross' ? `cross ${fmt(m.radius)} each way` : `${shape} r${fmt(m.radius, 1)}`} · ${what}${m.delay ? ' · at race start' : ''}`,
        );
        break;
      }
      case 'portal':
        out.push(`warp pads ${fmt(Math.abs(m.b[0] - m.a[0]))}×${fmt(Math.abs(m.b[1] - m.a[1]))} tiles apart · keeps your speed`);
        break;
      case 'bumper':
        out.push(`bumper r${fmt(m.radius, 2)} · kick ${fmt(m.power)}px/s`);
        break;
      case 'magnet':
        out.push(
          `${m.polarity > 0 ? 'pulls' : 'pushes'} · r${fmt(m.radius, 1)} · ${fmt(m.strength)}px/s²${m.off ? ` · on ${secs(m.on)} / off ${secs(m.off)}` : ' · always on'}`,
        );
        break;
      case 'web':
        out.push(`web ${m.cells.length} cells · drag ${Math.round(m.drag * 100)}%/frame`);
        break;
      case 'phase':
        out.push(
          `blink ${m.cells.length} cell${m.cells.length > 1 ? 's' : ''} · solid ${secs(m.on)} / gone ${secs(m.off)}${m.offset ? ' · alternate set' : ''}`,
        );
        break;
      case 'dropper':
        out.push(`dropstone ${m.cells.length} cells · warns ${secs(m.warn)} · falls ≤${fmt(m.reach)} tiles · rests ${secs(m.rest)}`);
        break;
      case 'snapper':
        out.push(`snap trap ${m.cells.length} wide · click ${secs(m.warn)} · spikes ${secs(m.up)} · reset ${secs(m.cool)}`);
        break;
      case 'mystery':
        out.push(
          `items: ${m.pool.join(', ')} · ${m.uses ? `${m.uses} pop${m.uses > 1 ? 's' : ''} then spent` : 'refills forever'}${m.uses === 1 ? '' : ` · refill ${secs(m.refill)}`}`,
        );
        break;
      case 'rotor':
        out.push(`${m.count} platforms on a ${fmt(m.arm, 1)}-tile wheel · ${secs(m.period)} per turn`);
        break;
      case 'rope':
        out.push(`${fmt(m.length)} tiles · ${secs(m.strain)} shelf life`);
        break;
      case 'keg':
        out.push(`${fmt(m.power)} proof · ${secs(m.burn)} fuse`);
        break;
    }
  }
  const mo = def.motion;
  if (mo.type === 'rail') out.push(`rides a rail · ${fmt(mo.range)} tiles · ${secs(mo.period)}`);
  if (mo.type === 'loop') out.push(`loops r${fmt(mo.radius, 1)} · ${secs(mo.period)}`);
  return out;
}
