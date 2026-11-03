# TODO agenda

These are the open work items, ordered by priority. Each one is sized for one agent.

Limit agents by file overlap first. On a small machine, also run at most 3–4 at once. While iterating, run only the test files you touch (`pnpm vitest run tests/x.test.ts`) plus `pnpm check:fast`. Run the full `pnpm check` once, before committing. Test behavior and invariants, not every tunable.

Design intent for everything below is in `docs/DESIGN.md`.

---

## 29. Character art: the rest of the roster
Every rendered kind is drawn flat now (`tools/art3d/`, playbook in its README and CHECKLIST), and the roster of twenty is in `docs/CHARACTERS.md` → Roster, with the production order there. Done: plumber, speedster, chomper, puffball, zapmouse and elf. The flat route costs no Tripo credits (images are free, about thirty a kind), so the credit pause that held the 3D route no longer applies. Each kind is one agent: a `design` and `worn` brief in `style.ts`, an entry in `FLAT_KINDS`, and the checklist. Put a kind's signature props first in its brief: the image generator ignores roughly everything past the first ~1,800 characters. Add the five kinds not yet in `CAST` (miner, merc, sneak, robot, king) in one change, so saved looks re-roll once.

## 27. AI players and player scripts (future)
Brains that fill seats by producing inputs, built in or written by players. Design: `docs/DESIGN.md` → AI players. Native AI first (phases 1–2); scripts after. Each phase is one agent, in order.

1. **Brain and motor, racing only.** The `Brain` interface, `BrainView` v1, a `BRAINS` registry and a motor that replays `src/sim/reach.ts` policies as intents. A built-in brain follows the reach route and replans around hazards. Bots fill local seats. A test runs a headless match and checks a bot finishes a few solvable levels; finish rates over many seeds go in `tests/stats/`.
2. **Pick, place and personality.** Pick by role and the round's state; place to trap rivals without stranding itself; parts may seal the level, so a bot should avoid sealing its own way unless it holds a bomb. Personality rolled from a seed (reaction, precision, risk, spite), with a generated name. Host-owned bot seats online, moving with host migration.
3. **Player scripts.** A Web Worker sandbox with a per-frame deadline, the published `brain-api.d.ts`, the Workshop screen (load, trial over seeds, report, replays) and `pnpm brain trial`.
4. **Copy for Your AI.** The prompt pack: API, current script, worst failures from the last trial.

- Decide with the owner: player scripts in online rooms and the lobby list, whether bots and scripts score, how far the lookahead sees, and whether senses name prop kinds.

## 2. Online follow-ups
Online play is on `main`, verified by real-browser checks in `pnpm online-test` and the Upstash-compatible `pnpm test:store`. See `docs/NETCODE.md`.

- **Owner:** connect `slag-upstash-kv` to the Vercel project for Production and Preview, then redeploy.
- **Not verified:** real Upstash, real NAT traversal, TURN, Firefox, Safari, real phones, and cross-engine determinism. dmath has only run on V8.
- **Decide:** two-peer host loss takes about 7.7 s, against about 4 s with three or more peers. Lowering `PROBE_MS` to about 3 s for two-peer rooms saves about 1 s but risks two hosts when the store is slow.
- Two guests that lose a live host at the same moment still move the room to the next peer, as if the host had died. The brief second host steps down within about 3 s.

## 3. Level follow-ups
- The winnability proof assumes timed hazards can be passed in their 30-frame openings, and only uses 2-bridge plans.

## 6. Real phones
Phone support (follow camera, pinch, scaled HUD, settings sheet) is on `main` but has only run in Chromium emulation. Try iOS Safari and a real Android phone: `:has()` in the sheet CSS, safe-area insets, pinch feel, and frame rate.


**Regression to check first:** `pnpm shot mobile --device "iPhone SE landscape"` fails its two-runner camera check ("a live runner left the screen", `[true,false]`, the same on two runs) since the perch physics and pass-through landed (`src/sim/collide.ts`, `src/sim/physics.ts`). It passed before. The iPhone 13 run and the lobby part pass.
## 8. Render polish
- **Impact words** can hide a hazard for most of a second; `?lettering=0` turns them off. Decide whether they stay. Big plain walls are a taste call. Try a real phone.

## 10. Housekeeping
- Enable GitHub Actions and make `ci.yml` a required check. This must be done on GitHub by the repo owner.
- Consider stricter TS flags: `noUncheckedIndexedAccess` gives about 600 errors, so it's a project of its own.

## 13. Playtest and tune the new parts
Nothing from the content, held-items or grab-props work has been played by hand, so the tuning is test-level only: magnet drift, bumper power, slow and freeze durations, item strength. Gamepad `use` (Y and LT) hasn't been tried on a real pad, and item sounds borrow existing cues and haven't been heard. Trackers can no longer see runners through terrain, which changes how lobbed trackers feel.

Size tiers for parts are a mapping of the old rolled ranges, so check them too; bumper and spike strip changed most. Confirm the Match Length values (Short 30 points / 10 rounds, Normal 50 / 15, Long 80 / 25). They come from a Monte Carlo model of scoring with a fixed finish rate, and real finish rates probably fall as props pile up. The limit decides about 25% of 2-player Normal matches at typical finish rates and about 60% at very low or very high ones.

**Undecided: character height.** Characters fit a one-block gap today. The owner wondered about a 1.5- or 2-block gap, since one block feels less interesting, then leaned back toward one. Decide in playtest. Changing it means redoing level design and `reach.ts` tuning.

## 21. Ink art leftovers
- The geyser vent can't stand taller until the sim gives it a solid rim, and the reach proof and the set-piece placer both have to see that rim (`docs/ART-QA.md` → "Needs a sim change").
- The parts still under the bar are ranked in `docs/ART-QA.md` → "Next in the queue".

- **Round hulls:** Ring Station and the Planetoid (space) draw stair-stepped hull edges, because their collision is whole tiles. Following the curve needs sub-tile fairing solids in each step notch (a few hundred rects per landmark), which turns the stairs into walkable slopes, so it needs its own proof, `noFreeRide` and performance work.
- **Art that looks solid but isn't** (`pnpm shot fairplay`; the barn is fixed). Two lists wait: `PENDING_SHELLS`, 18 landmark backdrop shells that match their own walls through gaps (boiler house, starship, lavafall organ, gatehouse and more), each needing its own art pass; and `PENDING`, set-piece machines drawn in front with no collision (guns on ledges, rotor hubs, swinger hubs, ladles, carts, signs, posts, water before it floods), which the owner wants made solid ("Make them solid"): each gets a body solid matching what it draws, kept out of the solution's way and checked by `noFreeRide`, the static proof and conformance.
## 15. Parody names: decide on sound-alikes
Names now parody genre tropes (`docs/PARODY.md`). A few are deliberate sound-alikes of trademarked names: Chain Chump, Thwunk, the -omb suffix, Master Noodle, Yolo Blocks. Decide whether to keep them.

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
- Install the Sentry GitHub integration for suspect commits. The build already associates each release with `VERCEL_GIT_COMMIT_SHA` in `VERCEL_GIT_REPO_OWNER/VERCEL_GIT_REPO_SLUG`; Sentry needs the repo linked under that name.
- On the first deploy, check one real event has the tags and contexts in `docs/TELEMETRY.md`, and that `host migration` logs and `/api/net/*` traces arrive.

## 22. Glacier and space follow-ups
Both themes are on `main`. Space has no weather. Ice skids and 0.55 space gravity are measured, not played by hand.

## 25. Idea: switchable art styles
The owner called switching art styles "a fun gimmick" while making cel the only look (`docs/DECISIONS.md` → World art). It's not scheduled. If it comes back, cel stays the default and the switch is a novelty, never a setting players need.

