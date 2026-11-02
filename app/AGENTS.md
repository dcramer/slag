# app: Next.js App Router shell

This Next.js version may differ from your training data: read the relevant guide in `node_modules/next/dist/docs/01-app/` before writing route code, and heed deprecation notices.

- Routes: `/` (`page.tsx`) redirects to a fresh `/r/<code>`, keeping query params; `/r/[room]` validates the code with `roomFromPath` and renders the lobby shell with per-lobby metadata; `/codex` is the parts catalog; `not-found.tsx`.
- Pages stay thin. They validate params, render a shell, and load the game through `next/dynamic(..., { ssr: false })`: `r/[room]/GameClient.tsx` → `GameMount.tsx` → `bootGame`, and `codex/CodexClient.tsx` → `CodexMount.tsx`. Nothing in `src/` should end up in the server bundle; `src/game-client.ts` and `src/codex/main.ts` start with `import 'client-only'`, so a server import fails the build.
- Server code (server components, route handlers) may import only tiny pure helpers such as `src/game/room.ts`. Keep it small, stateless, and free to run on Vercel.
- React lives only here; `src/` has no React or Next imports.
- `next.config.ts` skips type errors in `next build` because `npm run check` runs `tsc`.

Verify: `npx next build` must pass (CI runs it), then `npm run shot -- lobby` (or `codex`) and look at the PNG.
