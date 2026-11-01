import { parseSeed, randomSeed } from './core/rng';
import { Match } from './game/match';
import { InputManager } from './input/input';
import { Renderer } from './render/renderer';
import { DT } from './sim/constants';

const canvas = document.getElementById('game') as HTMLCanvasElement;
canvas.focus();

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const match = new Match(seedParam ? parseSeed(seedParam) : randomSeed());
const input = new InputManager(window);
const renderer = new Renderer(canvas);

// Debug handle for poking at state from the console.
(window as unknown as { slag: unknown }).slag = { match };

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
