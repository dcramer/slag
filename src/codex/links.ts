import type { Kind } from '../gen/character';
import type { Ammo } from '../sim/props';
import type { PartEntry } from './parts';
import type { MapJob } from './shots';

/**
 * Every codex card's permalink, `/codex/<section>/<card>`: the section's id, then the card's registry key (a
 * part's def name, a `Kind`, an `Ammo`, a concept id, a recipe name), never its title, since parody names change.
 * Pure, so tests read the same links the page writes.
 */

/** A key as a path segment: lower case, anything but letters and digits a dash. */
export const slug = (key: string): string =>
  key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const link = (section: string, key: string) => `${section}/${slug(key)}`;

export const partLink = (section: string, e: PartEntry): string => link(section, e.id ?? e.def.name);
export const projectileLink = (ammo: Ammo): string => link('projectiles', ammo);
export const castLink = (kind: Kind): string => link('cast', kind);
/** A theme's look is its section's `look`; a landmark and a hazard say which they are, so neither registry can collide with the other. */
export const mapLink = (section: string, job: MapJob): string => link(section, job.kind === 'theme' ? 'look' : `${job.kind}-${job.id}`);
