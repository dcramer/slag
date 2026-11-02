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
      'Fires projectiles on a schedule: fixed aim, sweeping, or tracking the nearest runner (lobbed ammo solves a ballistic arc). Bursts and spreads vary.',
  },
  flame: { title: 'Flame jet', blurb: 'Off → sputtering warning → roaring flame for a while. Stops at walls.' },
  laser: { title: 'Laser', blurb: 'Charges with a flickering telegraph, then fires a beam to the first wall. Some sweep back and forth.' },
  tesla: { title: 'Tesla gate', blurb: 'Two pylons that periodically arc lightning between them.' },
  piston: { title: 'Crusher', blurb: 'A solid head that slams out (deadly leading edge), holds, then slowly retracts. Can crush you against walls.' },
  spring: { title: 'Spring', blurb: 'Launches whoever touches it in the direction it faces.' },
  fan: { title: 'Fan', blurb: 'Pushes runners along a wind column until it hits a wall. Strong upward fans let you float.' },
  bomb: { title: 'Bomb', blurb: 'Not placed — detonated. Clears terrain and props in a radius (spawn and goal zones are protected).' },
};

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
          `${m.style} → ${m.ammo}${AMMO[m.ammo].gravity > 200 ? ' (lobbed)' : ''} · aim ${m.aim} · every ${secs(m.interval)}${m.burst > 1 ? ` ×${m.burst} burst` : ''}${m.spread > 1 ? ` · ${m.spread}-way` : ''} · ${fmt(m.speed)}px/s`,
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
      case 'bomb':
        out.push(`blast radius ${fmt(m.radius, 1)} tiles`);
        break;
    }
  }
  const mo = def.motion;
  if (mo.type === 'rail') out.push(`rides a rail · ${fmt(mo.range)} tiles · ${secs(mo.period)}`);
  if (mo.type === 'loop') out.push(`loops r${fmt(mo.radius, 1)} · ${secs(mo.period)}`);
  return out;
}
