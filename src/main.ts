import { parseSeed, randomSeed } from './core/rng';
import { installDebug } from './debug';
import { Match } from './game/match';
import { InputManager } from './input/input';
import { Renderer } from './render/renderer';
import { DT } from './sim/constants';
import { THEME_IDS } from './themes';

const glCanvas = document.getElementById('game') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud') as HTMLCanvasElement;
glCanvas.focus();

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const themeParam = params.get('theme');
const match = new Match(
  seedParam ? parseSeed(seedParam) : randomSeed(),
  THEME_IDS.find((t) => t === themeParam),
);
const input = new InputManager(window);
const renderer = new Renderer(glCanvas, hudCanvas);

const loop = { paused: false };
installDebug(match, renderer, loop);

// Fixed-timestep simulation, render as fast as the display allows.
let acc = 0;
let last = performance.now();
function frame(now: number) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  if (loop.paused) {
    acc = 0;
    requestAnimationFrame(frame);
    return;
  }
  while (acc >= DT) {
    match.step(input.sample());
    acc -= DT;
  }
  renderer.render(match, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
