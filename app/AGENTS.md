# app: Next.js App Router shell

This Next.js version may differ from your training data: read the relevant guide in `node_modules/next/dist/docs/01-app/` before writing route code, and heed deprecation notices.

- Routes: `/` (`page.tsx`) is the main menu: server-rendered markup plus `MainMenu.tsx` (client; Play → fresh `/r/<code>` keeping query params, Join validates with `roomFromPath`), with the character stage (`HomeStage` → `HomeStageMount`) and Settings (`HomeSettings`) loaded `ssr: false`; `/r/[room]` validates the code with `roomFromPath` and renders the lobby shell with per-lobby metadata; `/codex` is the parts catalog; `not-found.tsx`.
- Pages stay thin. They validate params, render a shell, and load the game through `next/dynamic(..., { ssr: false })`: `r/[room]/GameClient.tsx` → `GameMount.tsx` → `bootGame`, and `codex/CodexClient.tsx` → `CodexMount.tsx`. Nothing in `src/` should end up in the server bundle; `src/game-client.ts` and `src/codex/main.ts` start with `import 'client-only'`, so a server import fails the build.
- Server code (server components, route handlers) may import only tiny pure helpers such as `src/game/room.ts`. Keep it small, stateless, and free to run on Vercel.
- `api/net/[op]/route.ts` is signaling and presence for online play; logic and the store are in `api/net/_server/`, shared wire types in `src/net/signal-protocol.ts`. Every Redis key gets a TTL and every command is billed: read `docs/NETCODE.md` → Budget before adding one.
- Sentry is host code: `sentry-browser.ts` and `sentry-options.ts` here, plus `instrumentation*.ts` at the repo root (see Hosting in the root `AGENTS.md`). Route handlers need no setup, because `onRequestError` covers anything they throw. A handler that catches an error and answers 500 itself won't be reported unless it reports explicitly. `global-error.tsx` is what catches a failed `bootGame`.
- UI look and copy rules (palette, type, casing, input prompts): `docs/ART.md`.
- React lives only here; `src/` has no React or Next imports.
- `next.config.ts` skips type errors in `next build` because `pnpm check` runs `tsc`.

Verify: `pnpm build` must pass (CI runs it), then `pnpm shot lobby` (or `codex`) and look at the PNG.
