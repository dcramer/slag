# TODO agenda

These are the open work items, ordered by priority. Each one is sized for one agent. Several have unfinished work on a `wip/*` branch: those agents were stopped mid-task, and their work was saved as-is, **unreviewed**. Read the branch diff before reusing it. Every `wip/*` branch is behind `main`, so merge `origin/main` first.

Limit agents by file overlap first. On a small machine, also run at most 3–4 at once. While iterating, run only the test files you touch (`pnpm vitest run tests/x.test.ts`) plus `pnpm check:fast`. Run the full `pnpm check` once, before committing. Test behavior and invariants, not every tunable.

Design intent for everything below is in `docs/DESIGN.md`.

---

## 2. Online follow-ups
Online play is on `main`, verified by 139 real-browser checks in `pnpm online-test` and the Upstash-compatible `pnpm test:store`. See `docs/NETCODE.md`.

- **Owner:** connect `slag-upstash-kv` to the Vercel project for Production and Preview, then redeploy.
- **Not verified:** real Upstash, real NAT traversal, TURN, Firefox, Safari, real phones, and cross-engine determinism. dmath has only run on V8.
- **Decide:** two-peer host loss takes about 7.7 s, against about 4 s with three or more peers. Lowering `PROBE_MS` to about 3 s for two-peer rooms saves about 1 s but risks two hosts when the store is slow.
- **Bug, being fixed:** in a double host failure, three peers each declared themselves host at the same frame, and the room took 31 s to settle on the wrong host.
- A double host failure (the new host dies at once) takes 11–18 s to recover, and that varies a lot.

## 3. Level follow-ups
- **Ink bake stall:** the first render after a level change bakes ink terrain on the main thread: 27–176 ms on most levels, about 550–600 ms on a large factory, and once 2.5 s. Generation itself is now off the main thread.
- The winnability proof assumes timed hazards can be passed in their 30-frame openings, and only uses 2-bridge plans.

## 6. Real phones
Phone support (follow camera, pinch, scaled HUD, settings sheet) is on `main` but has only run in Chromium emulation. Try iOS Safari and a real Android phone: `:has()` in the sheet CSS, safe-area insets, pinch feel, and frame rate.

## 8. Render polish
- **Impact words** can hide a hazard for most of a second; `?lettering=0` turns them off. Decide whether they stay. Big plain walls are a taste call. Try a real phone.
- In pits the liquid surface sits 9 px above the kill line, so the waterline steps where a column meets the pool.

## 10. Housekeeping
- Enable GitHub Actions and make `ci.yml` a required check. This must be done on GitHub by the repo owner.
- Delete the old remote branch `claude/scaffold-procgen-platformer`, and the `wip/*` branches once they're merged.
- Consider stricter TS flags: `noUncheckedIndexedAccess` gives about 600 errors, so it's a project of its own.

## 11. Screen follow-ups
Every screen now runs from `src/` through one router (`src/main.ts`, `src/router.ts`). The codex, 404 and error screens behave like game screens but haven't been restyled up to the home look yet.

## 13. Playtest and tune the new parts
Nothing from the content, held-items or grab-props work has been played by hand, so the tuning is test-level only: magnet drift, bumper power, slow and freeze durations, item strength. Gamepad `use` (Y and LT) hasn't been tried on a real pad, and item sounds borrow existing cues and haven't been heard. Trackers can no longer see runners through terrain, which changes how lobbed trackers feel.

Size tiers for parts are a mapping of the old rolled ranges, so check them too; bumper and spike strip changed most. Confirm the Match Length values (Short 30 points / 10 rounds, Normal 50 / 15, Long 80 / 25). They come from a Monte Carlo model of scoring with a fixed finish rate, and real finish rates probably fall as props pile up. The limit decides about 25% of 2-player Normal matches at typical finish rates and about 60% at very low or very high ones.

**Undecided: character height.** Characters fit a one-block gap today. The owner wondered about a 1.5- or 2-block gap, since one block feels less interesting, then leaned back toward one. Decide in playtest. Changing it means redoing level design and `reach.ts` tuning.

**Fast crushers** can pass through a lone runner standing on the floor and pop them on top instead of crushing them. The same happens with one runner, before collision.

## 14. Clear the lint warnings
`pnpm check` prints 7 warnings, in `src/ui/touch/overlay.ts`, `src/ui/touch/device.ts`, `src/input/input.ts`, `src/render/props/modules/vehicle.ts` and `src/audio/system.ts`. AGENTS.md treats warnings as real findings. Do it with or after item 6, which also touches the touch code.

## 21. Ink art leftovers
- On wide space levels a few tall rock pillars from the surroundings show inside the play area without outlines (seed `sheet4`). It's a `surround.ts` question.
- Small cog lifts and small spin bars stay small on crate cards, because small parts draw at 0.6 scale.

## 15. Parody names: decide on sound-alikes
Names now parody genre tropes (`docs/PARODY.md`). A few are deliberate sound-alikes of trademarked names: Chain Chump, Thwunk, the -omb suffix, Master Noodle, Yolo Blocks, Coil Pup. Decide whether to keep them.

## 23. Check link previews on a deploy
Icons, manifest, Open Graph and Twitter tags, and oEmbed are on `main`, regenerated with `pnpm brand`. These need a deployed URL to check:

- Real unfurls in Slack, Discord, iMessage, X and LinkedIn.
- Add to Home Screen on iOS and Android.
- Whether a 16 px tab shows the pixel S.
- Vercel Deployment Protection blocks unfurl bots on preview URLs.

## 17. Finish Sentry setup
Some steps need the owner. Run after setting the Vercel env vars.

- Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` in Vercel (Production and Preview). An organization auth token is best.
- On the first deploy, confirm source maps upload and client frames resolve to source. Only the failure path has been tested.
- Install the Sentry GitHub integration for suspect commits.
- Move `app/global-error.tsx` into `src/` with item 11.

## 22. Glacier and space follow-ups
Both themes are on `main`. Their set pieces reuse existing module art, so they need their own looks. Space has no weather. Ice skids and 0.55 space gravity are measured, not played by hand.

## 20. Cleanup pass
Run this once the current agents have landed, so it doesn't fight them. A lot arrived fast.

- **Code:** dead exports, leftovers from merged branches, duplicated helpers, oversized files (`src/render/hud.ts`, `src/ui/menus.ts`, `tools/shot.ts`).
- **Docs:** AGENTS.md files, `docs/DESIGN.md`, `docs/ART.md`, `docs/NETCODE.md`, `docs/MOBILE.md`, `README.md`, so each says what's true now and nothing else.
- **Tooling:** `pnpm format`'s `oxlint --fix` broke `tests/roster.test.ts` by turning an array into a `Set`. Find the rule and fix it.
- **Repo:** merged `wip/*` branches and worktree branches, the 7 lint warnings (item 14), and `netcode-merge-wip`.

