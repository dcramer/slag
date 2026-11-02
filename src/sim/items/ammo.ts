import { pointInRect } from '../../core/geom';
import { DT, TILE } from '../constants';
import { T_ONEWAY, tileAt } from '../level';
import { defineAmmo, type ProjWorld, solidAt } from '../props/ammo';
import { AMMO } from '../props/types';
import { PUCK } from './roster';

/**
 * Shots only held items fire. They live in RunWorld.projectiles and plug into
 * AMMO_SIM like any launcher ammo; the boomerang is the launcher's own ammo,
 * extended in place in props/ammo.ts.
 */

/** Does a falling point land on something, one-way floors included? `from` is its y last frame. */
function landsOn(w: ProjWorld, x: number, y: number, from: number, age: number): boolean {
  if (solidAt(w, x, y, age)) return true;
  const ty = Math.floor(y / TILE);
  if (tileAt(w.level, Math.floor(x / TILE), ty) === T_ONEWAY && from <= ty * TILE) return true;
  return w.solids.some((s) => s.oneWay && from <= s.y && pointInRect(x, y, s));
}

/** Slides along floors under gravity and banks off walls until it runs out of bounces. */
defineAmmo('puck', {
  init(p) {
    p.n = PUCK.bounces;
  },
  move(p, w) {
    const r = AMMO.puck.radius;
    const age = w.frame - p.born;
    p.vy = Math.min(p.vy + AMMO.puck.gravity * w.gravity * DT, PUCK.maxFall);
    const dx = p.vx * DT;
    if (solidAt(w, p.x + dx + (dx > 0 ? r : -r), p.y, age)) {
      if (p.n-- <= 0) return false;
      p.vx = -p.vx;
      w.emit({ type: 'prop', kind: 'bounce', x: p.x, y: p.y });
    } else p.x += dx;
    const dy = p.vy * DT;
    if (dy > 0 && landsOn(w, p.x, p.y + dy + r, p.y + r, age)) p.vy = 0;
    else if (dy < 0 && solidAt(w, p.x, p.y + dy - r, age)) p.vy = 0;
    else p.y += dy;
    return true;
  },
});

/** Lobbed; whatever ends it, it bursts into a smoke cloud there. */
defineAmmo('smokebomb', {
  end(p, w) {
    w.items?.burst(p.x, p.y);
  },
});
