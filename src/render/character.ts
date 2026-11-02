interface Pt {
  x: number;
  y: number;
  px: number;
  py: number;
}

/**
 * Cosmetic per-character state that lives in the renderer: a verlet ribbon for a tail (`ropeOf` in
 * ink-character.ts), an afterimage trail, and landing detection.
 */
export class Rig {
  rope: Pt[] = [];
  trail: { x: number; y: number; a: number }[] = [];
  wasGrounded = true;
  lastVy = 0;

  /** `floor`: world y the ribbon may not sink below (a tail brushes the ground, never through it). */
  step(rope: { kind: string; len: number }, ax: number, ay: number, dt: number, wind = 0, floor = Infinity) {
    const n = rope.len;
    // A long frame (a hitch, or a stepped screenshot) would fling the ribbon: it's cosmetic, so it just runs slow.
    dt = Math.min(dt, 1 / 40);
    if (this.rope.length !== n) this.rope = Array.from({ length: n }, (_, i) => ({ x: ax, y: ay + i, px: ax, py: ay + i }));
    const seg = 1.7;
    // A bushy tail is carried up and back; a ringed one hangs a little.
    const grav = rope.kind === 'tail' ? -260 : 90;
    const p0 = this.rope[0];
    p0.x = p0.px = ax;
    p0.y = p0.py = ay;
    for (let i = 1; i < n; i++) {
      const p = this.rope[i];
      const vx = (p.x - p.px) * 0.94;
      const vy = (p.y - p.py) * 0.94;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + wind * dt * dt * 40;
      p.y += vy + grav * dt * dt;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < n; i++) {
        const a = this.rope[i - 1];
        const b = this.rope[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-4;
        const diff = (d - seg) / d;
        if (i === 1) {
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
          b.x -= dx * diff * 0.5;
          b.y -= dy * diff * 0.5;
        }
      }
      for (let i = 1; i < n; i++) if (this.rope[i].y > floor) this.rope[i].y = floor;
    }
  }
}
