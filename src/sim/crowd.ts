import { type Body, type CollisionWorld, firstOverlap } from './physics';

/**
 * Runner-vs-runner nudging: soft, symmetric, deterministic body contact.
 *
 * Bodies never collide like solids (no blocking walls, no standing on heads).
 * Instead, after every runner has stepped, each side-by-side pair that closed
 * in on each other this frame has that closing motion mostly cancelled, and
 * the pair moves together by a small shove:
 *
 *   a, b   = each body's own x-displacement this frame, along A→B
 *   shared = motion both already have in the same direction (the slower one's), else 0
 *   u      = shared + CROWD.shove · (a + b − 2·shared)        (both end up moving u)
 *
 * So walking into a standing runner moves both at ~12% of walk speed, two
 * runners pushing into each other nearly stand still (only the difference in
 * effort leaks through), and rear-ending a slower runner just matches their
 * speed plus a tiny shove. Only the part of the closing motion that created
 * new overlap is cancelled, so bodies already overlapping (spawn pad) stay
 * put and separate naturally as they run off.
 *
 * Vertical contact does nothing: bodies whose vertical overlap is under
 * `minOverlapY` (jumping over / landing on someone) pass through each other.
 *
 * Order-independent: pairs are evaluated from the post-step snapshot in a
 * canonical (key-sorted) order and all corrections are applied afterwards.
 * Corrections move through the collision world and stop flush at solids, so
 * nobody is ever pushed into terrain; someone pinned against a wall simply
 * lets the pusher squeeze slowly into them.
 */
export const CROWD = {
  /** Fraction of the unmatched closing motion that becomes a shared shove. */
  shove: 0.12,
  /** Minimum vertical overlap (px) for two bodies to push sideways (PLAYER_H is 14). */
  minOverlapY: 8,
} as const;

export interface CrowdMember {
  /** Stable, unique sort key (player slot) so results don't depend on array order. */
  key: number;
  body: Body;
  /** Body x before this frame's step. */
  x0: number;
}

/** Apply one frame of nudging to `members` (alive, unfinished runners). */
export function nudgeCrowd(members: readonly CrowdMember[], world: CollisionWorld): void {
  if (members.length < 2) return;
  const m = members.slice().sort((p, q) => p.key - q.key);
  const corr = m.map(() => 0);
  for (let i = 0; i < m.length; i++) {
    const A = m[i].body;
    for (let j = i + 1; j < m.length; j++) {
      const B = m[j].body;
      const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (oy < CROWD.minOverlapY) continue;
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      if (ox <= 0) continue;
      // Exact center tie: the lower key counts as the left one.
      const dir = B.x + B.w / 2 >= A.x + A.w / 2 ? 1 : -1;
      const a = (A.x - m[i].x0) * dir;
      const b = (B.x - m[j].x0) * dir;
      const closing = a - b;
      if (closing <= 0) continue;
      const shared = a > 0 && b > 0 ? Math.min(a, b) : a < 0 && b < 0 ? Math.max(a, b) : 0;
      const u = shared + CROWD.shove * (a + b - 2 * shared);
      // Cancel only the closing motion that produced new overlap this frame.
      const k = Math.min(closing, ox) / closing;
      corr[i] += (u - a) * k * dir;
      corr[j] += (u - b) * k * dir;
    }
  }
  for (let i = 0; i < m.length; i++) if (corr[i] !== 0) slideX(m[i].body, corr[i], world);
}

/** Move a body sideways by dx, stopping flush at the first solid. Never ends inside terrain. */
function slideX(b: Body, dx: number, world: CollisionWorld): void {
  if (firstOverlap(b, world)) return; // already wedged in something: leave it to stepBody's depenetration
  const steps = Math.max(1, Math.ceil(Math.abs(dx)));
  const sx = dx / steps;
  for (let i = 0; i < steps; i++) {
    const px = b.x;
    b.x += sx;
    const s = firstOverlap(b, world);
    if (!s) continue;
    b.x = sx > 0 ? s.x - b.w : s.x + s.w;
    if (firstOverlap(b, world) || (b.x - px) * sx < 0) b.x = px;
    return;
  }
}
