import { parseSeed, randomSeed } from './core/rng';
import { Match } from './game/match';
import { InputManager } from './input/input';
import { Renderer } from './render/renderer';
import { DT } from './sim/constants';

const glCanvas = document.getElementById('game') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud') as HTMLCanvasElement;
glCanvas.focus();

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const match = new Match(seedParam ? parseSeed(seedParam) : randomSeed());
const input = new InputManager(window);
const renderer = new Renderer(glCanvas, hudCanvas);

// Debug handle for poking at state from the console.
(window as unknown as { slag: unknown }).slag = { match, renderer };

// Fixed-timestep simulation, render as fast as the display allows.
let acc = 0;
let last = performance.now();
function frame(now: number) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  while (acc >= DT) {
    match.step(input.sample());
    acc -= DT;
  }
  renderer.render(match, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug: drop one of each listed archetype into the level and jump straight to a race.
import { Rng } from './core/rng';
import { generateProp, type Archetype } from './gen/props';
import { canPlace } from './sim/props';
(window as unknown as { slagShowcase: unknown }).slagShowcase = (kinds: Archetype[], seed = 1) => {
  const m = match as unknown as { placed: import('./sim/props').PlacedProp[]; level: import('./sim/level').Level; startRunDebug(): void };
  kinds.forEach((k, i) => {
    const def = generateProp(new Rng(seed * 977 + i * 131), k, `dbg-${i}`);
    for (let n = 0; n < 4000; n++) {
      const tx = 6 + ((i * 7 + n * 13) % (m.level.w - 12));
      const ty = 3 + ((i * 5 + n * 7) % (m.level.h - 6));
      if (canPlace(m.level, m.placed, def, 0, tx, ty)) {
        m.placed.push({ uid: 500 + i, def, owner: 1, tx, ty, rot: 0 });
        break;
      }
    }
  });
};
