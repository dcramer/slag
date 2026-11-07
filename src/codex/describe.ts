import { AMMO, type Module, type PropDef } from '../sim/props';

/**
 * Every module type ("part") in the codex modal: a label and a one-line joke.
 * No how-to text (docs/DESIGN.md → Discovery): the stat lines beside it
 * carry the numbers.
 */
export const PART_INFO: Record<Module['type'], { title: string; blurb: string }> = {
  body: { title: 'Body', blurb: 'Floats in midair. Nobody has ever asked why.' },
  spikes: { title: 'Spikes', blurb: 'One hit. Any angle. No refunds.' },
  swinger: { title: 'Swinger', blurb: 'Every castle has a guy who installs these.' },
  launcher: { title: 'Launcher', blurb: 'A mailman with a grudge and a schedule.' },
  sentry: { title: 'Sentry', blurb: 'Beeps once. That was your warning.' },
  flame: { title: 'Flame jet', blurb: 'Clears its throat first. Polite, for a dragon.' },
  laser: { title: 'Laser', blurb: 'Charges like a phone, rules like a judge.' },
  tesla: { title: 'Tesla gate', blurb: 'Bzzzt. You are the bug.' },
  piston: { title: 'Crusher', blurb: 'Panini press, runner filling.' },
  spring: { title: 'Spring', blurb: 'Boing.' },
  fan: { title: 'Fan', blurb: 'Hair dryer, industrial setting.' },
  rotor: { title: 'Rotor', blurb: 'Rides included with admission.' },
  vehicle: { title: 'Vehicle', blurb: 'Has right of way. Always.' },
  cannon: { title: 'Fixed cannon', blurb: 'Ye olde boom.' },
  geyser: { title: 'Geyser', blurb: 'The floor, but erupting.' },
  deco: { title: 'Scenery', blurb: 'Set dressing. Load-bearing set dressing.' },
  coat: { title: 'Attachment', blurb: 'Paint jobs with consequences.' },
  mystery: { title: 'Mystery crate', blurb: 'Contents may vary. Odds not disclosed.' },
  stand: { title: 'Weapon stand', blurb: 'Free sample. One per customer, every few seconds.' },
  surge: { title: 'Leg Day', blurb: 'Never skip it.' },
  bomb: { title: 'Demolition', blurb: 'Renovation, the fast way.' },
  pipe: { title: 'Pipe', blurb: 'Sold separately. Works in pairs.' },
  bumper: { title: 'Bumper', blurb: 'Ding ding ding. Extra ball not included.' },
  magnet: { title: 'Gravity well', blurb: 'Needy or aloof, never in between.' },
  web: { title: 'Web', blurb: 'Spider not included. Spider is somewhere.' },
  phase: { title: 'Blink blocks', blurb: 'Now you see it. Now you’re falling.' },
  dropper: { title: 'Dropstone', blurb: 'A ton of bricks with a lane to itself.' },
  snapper: { title: 'Snap trap', blurb: 'Surprise!' },
  rope: { title: 'Sausage Vine', blurb: 'Fresh from the hook.' },
  keg: { title: 'Kegapult', blurb: 'XXX.' },
  button: { title: 'Panic Button', blurb: 'The cover was taped open when we got here.' },
  fuse: { title: 'Fuse Crate', blurb: 'FRAGILE. Very.' },
  flood: { title: 'Flood', blurb: 'The tide waits for no runner.' },
  lob: { title: 'Lava lob', blurb: 'What goes up comes down hotter.' },
  shards: { title: 'Broken window', blurb: 'Seven years of bad luck, delivered all at once.' },
  cavein: { title: 'Cave-in', blurb: 'The roof was load-bearing. Was.' },
  cart: { title: 'Runaway cart', blurb: 'No brakes. Great bell, though.' },
  sign: { title: 'Falling sign', blurb: 'Under new management. Under the sign, too.' },
  neon: { title: 'Neon letters', blurb: 'Open 24 hours. Touch at your own risk.' },
  wire: { title: 'Live wire', blurb: 'Somebody forgot to pay the electric bill. The bill remembers.' },
  thaw: { title: 'Thin ice', blurb: 'Rated for one penguin.' },
  ladle: { title: 'Slag ladle', blurb: 'Pours on a schedule. The schedule is now.' },
  arm: { title: 'Robot arm', blurb: 'Programmed to weld. Not programmed to look.' },
};

const AIM_TAG: Record<string, string> = { fixed: 'FIXED', sweep: 'SWEEPS', track: 'TRACKS' };

/** A short tag for a crate card (aim mode for launchers, etc.), or null. */
export function propTag(def: PropDef): string | null {
  for (const m of def.modules) {
    if (m.type === 'launcher') return m.ammo === 'seeker' ? 'HOMING' : m.ammo === 'glider' ? 'RIDEABLE' : AIM_TAG[m.aim];
    if (m.type === 'bomb') return m.delay ? 'AT RACE START' : m.target === 'props' ? 'PROPS ONLY' : m.target === 'terrain' ? 'TERRAIN ONLY' : null;
    if (m.type === 'sentry') return AIM_TAG.track;
    if (m.type === 'keg') return m.aim === 'player' ? null : m.dirs.length > 1 ? AIM_TAG.sweep : AIM_TAG.fixed;
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
      case 'sentry':
        out.push(
          `sentry · ${fmt(m.range)} tiles · ±${fmt((m.cone * 180) / Math.PI)}° · turns ${fmt((m.turn * 60 * 180) / Math.PI)}°/s · spin-up ${secs(m.spin)} · ×${m.burst} burst · cools ${secs(m.cool)}`,
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
        out.push(m.exact && m.arc ? `launch plate ${fmt(m.arc[0])} across, ${fmt(-m.arc[1])} up · lands on its X` : `spring power ${fmt(m.power)}`);
        break;
      case 'geyser':
        out.push(`${m.lethal ? 'eruption' : 'jet'} ${fmt(m.length)} tiles · on ${secs(m.on)} / off ${secs(m.off + m.warn)}`);
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
      case 'pipe':
        out.push(`${m.look} pipe ${fmt(m.cells.length / 2)} tiles long · pairs with the next one placed`);
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
      case 'stand':
        out.push(`items: ${m.pool.join(', ')} · restocks ${secs(m.refill)} after it's taken`);
        break;
      case 'surge':
        out.push(`springier jumps for ${secs(m.frames)} · back ${secs(m.refill)} after it's taken`);
        break;
      case 'rotor':
        out.push(`${m.count} platforms on a ${fmt(m.arm, 1)}-tile wheel · ${secs(m.period)} per turn`);
        break;
      case 'rope':
        out.push(`${fmt(m.length)} tiles · ${secs(m.strain)} shelf life`);
        break;
      case 'keg':
        out.push(
          m.aim === 'player'
            ? `slingshot ${fmt(m.power)}px/s · full pull ${secs(m.charge ?? 0)} · snaps after ${secs(m.burn)}, back in ${secs(m.regrow ?? 0)}`
            : `${fmt(m.power)} proof · ${secs(m.burn)} fuse`,
        );
        break;
      case 'button':
        out.push(`${m.cells.length} blocks for ${secs(m.on)} a press`);
        break;
      case 'fuse':
        out.push(`${secs(m.count)} fuse · blast r${fmt(m.radius, 1)} · back in ${secs(m.regrow)}`);
        break;
      default:
        // The rest are set-piece modules: a set piece's codex card has its own words (`codex` on its recipe).
        break;
    }
  }
  const mo = def.motion;
  if (mo.type === 'rail') out.push(`rides a rail · ${fmt(mo.range)} tiles · ${secs(mo.period)}`);
  if (mo.type === 'loop') out.push(`loops r${fmt(mo.radius, 1)} · ${secs(mo.period)}`);
  return out;
}
