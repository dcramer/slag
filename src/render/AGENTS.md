# src/render: presentation only

- Read sim state, never write it. Render-side state (particles, verlet rigs, caches) must never influence the sim. `Math.random` is fine here: it's cosmetic.
- `Renderer.render` (`renderer.ts`) paints world-space Canvas2D layers through the camera: **background**, **foreground** (transparent; the world pass draws to it through `rc.s`), **emissive** (additive), **light map** (0.5 = neutral). `post.ts` composites them through the cel pass (`cel-shader.ts`: light bands, ink, hard shadows) in WebGL2, with a Canvas2D fallback that has none of that. The HUD (`hud.ts`) is its own canvas.
- Everything on `rc.s` gets ink along its edges. Thin or soft things (grass, smoke, dust, motes, afterimages) turn into black scrub or solid discs there, so draw them on the background layer, `rc.bg`.
- Everything draws in logical view coordinates, and the window is `ViewFrame` (`frame.ts`): the VIEW_W×VIEW_H play view sits inside it at a fixed aspect, and a layer's job is to fill the frame, not the view. Full-screen fills use the frame (`Hud.wash`). The camera's only inputs are `setBounds` (world size, from the level) and `setFrame`.
- Past the world's edge is `surround.ts`: scenery built from the level, painted by `TerrainPainter`, one recipe per theme in `SIDES`. Below the world, bottom-row columns just run on down and are drawn through the pool (`drawSunken`).
- Prop art is a registry: one file per module type in `props/modules/<type>.ts` registering `ModuleArt` (`props/common.ts`), imported from `props/modules/index.ts`. A type may register several arts on different layers. Don't add per-type `switch`es elsewhere.
- Art on the `BACKDROP` layer paints before the terrain, which hides it: use it for the scenery half of a set piece (towers, masts, gantries), never for anything a player can touch or read a warning from. `tests/render-layers.test.ts` holds the list of module types allowed to use it.
- Shared drawing helpers, materials and lights are in `kit.ts`; reuse them before writing new ones.
- Art never casts rays. Read how far a beam, column or lane reaches with `beamOf` (`props/common.ts`): the sim hurts with that same number, so what you draw stops where it stops hurting.
- Keep per-frame allocation low: the game targets 60 fps with up to 8 players and ~100 lights.

Verify every visual change by looking at it: `pnpm shot race --race all`, `pnpm shot levels --themes all`, `pnpm shot props`, or the scenario closest to your change, then open the printed PNG. The harness fails on page errors.
