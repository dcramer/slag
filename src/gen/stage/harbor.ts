import { GALLEON } from './harbor-ship';
import { CONTAINER_TERMINAL, KRAKEN_LAGOON, LIGHTHOUSE, TIDAL_PIER } from './harbor-shore';
import type { Concept } from './types';

/**
 * Harbor stage concepts (docs/SETPIECES.md, Harbor). Every one owns the level's crossing: a berth of open
 * water in front of it (./harbor-kit.ts), the landmark on its far side, standing on the sea floor.
 *
 * - The Galleon at Berth (grand, ./harbor-ship.ts): a whole ship, run deck by deck.
 * - The Tidal Pier (grand), the Container Terminal, Lighthouse Rock and Kraken Lagoon (./harbor-shore.ts).
 */
export const HARBOR_CONCEPTS: Concept[] = [GALLEON, TIDAL_PIER, CONTAINER_TERMINAL, LIGHTHOUSE, KRAKEN_LAGOON];
