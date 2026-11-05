import { GRUDGE, type Slight, type Temperament } from './temperament';

/**
 * Who a bot has it in for, from what it saw happen: a rival's part killing
 * it, a rival's part on the way it ran, a rival leading on points, a rival
 * taking the card it reached for. Each slight heats the rival by what the
 * bot's temperament makes of it; heat cools between rounds by how long the
 * temperament remembers. Plain data: a brain started fresh on a new host
 * starts with no grudges, as a stranger would.
 */
export class Grudges {
  private heat: Record<number, number> = {};

  constructor(private readonly mood: Temperament) {}

  /** `slot` did `slight` to it, `times` over. */
  feel(slot: number, slight: Slight, times = 1): void {
    this.heat[slot] = (this.heat[slot] ?? 0) + this.mood.heat[slight] * times;
  }

  /** A round has passed. */
  cool(): void {
    for (const k of Object.keys(this.heat)) this.heat[+k] *= this.mood.memory;
  }

  of(slot: number): number {
    return this.heat[slot] ?? 0;
  }

  /** The rival it most has it in for, if any is past a grudge, of those still at the table. */
  target(present: readonly number[]): number {
    let best = -1;
    let most = GRUDGE;
    for (const s of present) if (this.of(s) >= most) [best, most] = [s, this.of(s)];
    return best;
  }
}
