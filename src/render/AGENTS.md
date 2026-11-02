# src/render: presentation only

- Read sim state, never write it. Render-side state (particles, verlet rigs, caches) must never influence the sim. `Math.random` is fine here: it's cosmetic.
- `Renderer.render` (`renderer.ts`) paints three world-space Canvas2D layers through the camera: **albedo**, **emissive** (additive), **light map** (0.5 = neutral). `post.ts` composites them in WebGL2 (lighting, bloom, tonemap, grade) with a Canvas2D fallback. The HUD (`hud.ts`) is its own canvas.
- Prop art is a registry: one file per module type in `props/modules/<type>.ts` registering `ModuleArt` (`props/common.ts`), imported from `props/modules/index.ts`. A type may register several arts on different layers. Don't add per-type `switch`es elsewhere.
- Shared drawing helpers, materials and lights are in `kit.ts`; reuse them before writing new ones.
- Keep per-frame allocation low: the game targets 60 fps with up to 8 players and ~100 lights.

Verify every visual change by looking at it: `npm run shot -- race --race all`, `npm run shot -- levels --themes all`, `npm run shot -- props`, or the scenario closest to your change, then open the printed PNG. The harness fails on page errors.
