/**
 * Screenshot harness. Builds (if sources changed) and boots a production Next.js server
 * (`SHOT_DEV=1` uses `next dev` instead), drives the game through
 * window.slagDebug in headless Chromium, writes PNGs and exits. A run with no
 * progress for SHOT_TIMEOUT seconds (default 180) fails instead of hanging.
 * Scenarios live in tools/shot/, grouped by what they look at; tools/shot/ctx.ts has the shared setup.
 *
 *   pnpm shot race --seed abc              → a bare race: the level and its set pieces, no parts
 *   pnpm shot race --seed abc --race saw,laser --frames 200
 *   pnpm shot race --race all
 *   pnpm shot lobby|pick|place --seed abc
 *   pnpm shot pick --claim 2,5             → with those cards already taken
 *   pnpm shot pick|place --secret          → Secret Parts rule on: role cards, and the parts they rolled
 *   pnpm shot pick|place --parts block,saw → with those parts already in the level, as from earlier rounds
 *   pnpm shot place --card spikestrip --cursor 296,184 --then-race 90 → aim the first ghost, place it, shoot the race
 *   pnpm shot score --players 4            → round-score screen with every award, mid-fill and settled (`--nobody`: a scoreless round)
 *   pnpm shot levels --seeds a,b,c,d      (or --count 12) → contact sheet
 *   pnpm shot props --count 24            → prop gallery (crate cards)
 *   pnpm shot cards --arch saw,block       → crate cards of those parts at every size (`platform:tetra`: only parts with that body look)
 *   pnpm shot parts --arch saw,flail       → those parts placed and raced, shot close up (`--styles all`: every launcher style; `--material conveyor`: platforms of that block; `--bait`: a runner in front of each; `--rot 1`: every part turned)
 *   pnpm shot parody --seed abc            → Launch Plate, Boost Strip, Panic Button, Fuse Crate, Y-Fling and Four-Square each worked by a runner
 *   pnpm shot looks [--only spikes,geysers,droppers] → set-piece looks: spikes on every face, geysers every way, droppers mid-drop
 *   pnpm shot buildparts                   → every building part in a race, on crate cards, and as place ghosts
 *   pnpm shot riders --seed abc            → a lift and a cog wheel with blocks and coats riding them: the place ghost sticking on, then the race at three moments
 *   pnpm shot pipes [--propseed 3]         → warp pipes facing every way: placing (with the pair tether), close up, and mid-trip
 *   pnpm shot belts [--propseed 1]         → a conveyor at every rotation: as place ghosts, and placed with a runner on each belt face
 *   pnpm shot items --seed abc             → held items: in hand, loose, and each one used (`--give bat,tax` picks them)
 *   pnpm shot blood --theme farm --players 4 --noletters → staged deaths over four rounds: ooze, settled, place phase, expiry
 *   pnpm shot stack --seed abc             → stepped frames of runners stacking, walking as a stack, and a head-bounce
 *   pnpm shot grabs                        → stepped frames of a rope swing, a keg shot and a backfire
 *   pnpm shot lineup [--seeds a,b]         → eight runners in a spread of poses, at play scale and close up
 *   pnpm shot cast [--only catalog]       → the toy cast (docs/CHARACTERS.md): lineups on farm and mine, close-up, deaths, lobby, catalog
 *   pnpm shot codex                        → /codex: full page, top, a part up close, and on a phone
 *   pnpm shot screens                      → the 404 and error screens, desktop and phone
 *   pnpm shot webgl                        → a race through a lost and restored WebGL context, then with shaders that won't build and with no WebGL2
 *   pnpm shot inkdraw                      → times the cel pass alone
 *   pnpm shot inkblast --seed S --theme T  → craters bitten out of a level, each partial redraw checked against a full bake
 *                                           (`--skin planks [--shell facade]`: into a test landmark in that skin)
 *   pnpm shot landmarks [--theme T] [--concept id] [--count N] → one level per stage concept at three phases, on a contact sheet
 *                                           (themes with none: a test landmark per skin and shell; --concept filters those by skin or shell)
 *   pnpm shot flood [--look lava|toxic|water] [--low 2] [--high 5] → a tide let into the level, at warn, rise and high water
 *   pnpm shot home                         → main menu (desktop + 390×844 mobile)
 *   pnpm shot rules                        → the match rules card (fails if it doesn't fit the window)
 *   pnpm shot settings                     → every settings tab over the lobby, driven by keys and a fake pad,
 *                                           then over the main menu on a phone (portrait and landscape), by tap
 *   pnpm shot mobile [--device "Pixel 7 landscape"]  → phone emulation driven by real
 *                                           multi-touch: lobby/join, pick, place, race, portrait
 *
 * Options: --out shots  --size 1280x720 (window)  --world classic|wide|tall (level size)  --players 2  --frames N (sim frames to advance)
 *          --theme farm (force a theme; `levels --themes all` renders one level per theme)
 *          --weather rain (force the weather: clear|wind|mist|rain|snow)
 *          --concept id (force a stage concept of the theme's, or plain; src/gen/stage)
 *          --noui (hide the HUD, e.g. to review level shapes)
 *          --q high (pin the quality tier: slow software GL otherwise reads as a slow device and drops it)
 *          --runframe N (race: stop on exact sim frame N)  --campin x,y,zoom (race: pin the view, for before/after sheets)
 *          --spread (race: stand the runners on open ground)
 *          --mode keyboard|gamepad|touch (footer prompt glyphs)  --net (fake online-lobby info)
 *          --noletters (no impact words)
 * Software GL is slow; frames are advanced deterministically via slagDebug.step().
 */

import { shots as cast } from './shot/cast';
import { browser, errors, scenario, server } from './shot/ctx';
import { shots as flood } from './shot/flood';
import { shots as landmarks } from './shot/landmarks';
import { shots as motion } from './shot/motion';
import { shots as mobile } from './shot/mobile';
import { shots as pages } from './shot/pages';
import { shots as parts } from './shot/parts';
import { shots as phases } from './shot/phases';
import { shots as renderer } from './shot/renderer';
import { shots as riders } from './shot/riders';

const SCENARIOS = { ...phases, ...renderer, ...motion, ...parts, ...pages, ...mobile, ...landmarks, ...cast, ...flood, ...riders };

try {
  const run = SCENARIOS[scenario];
  if (!run) throw new Error(`unknown scenario ${scenario}`);
  await run();
  if (errors.length) {
    console.error('page errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await server.close();
}
