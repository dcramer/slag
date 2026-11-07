# One kind: run sheet and done list

For a production agent taking one kind's entry (`docs/characters/<kind>.md`) to a kind the game draws. The how is in [README.md](README.md). Copy this list into your report and tick it.

## Run sheet

- [ ] **Worktree.** `pnpm install`. Read AGENTS.md, src/render/AGENTS.md, docs/ART.md → World art, your kind's entry (`docs/characters/<kind>.md`) and docs/CHARACTERS.md → Rules for every kind, docs/CHARACTERS.md → Decisions 4 and 9 and Rendered kinds → What the blind reads taught, and `tools/art3d/flat/kinds/plumber.ts` and `zapmouse.ts` as worked examples (`king.ts` or `dragon.ts` side on, `chomper.ts` with no limbs, `limbless.ts` with floating parts).
- [ ] **Brief.** `BRIEFS[kind].design` in `style.ts` from the entry (fill in its stub, if it has one): the nod and the twist as big shapes, the palette hex, the signature prop first; `worn`: two to four big worn changes, off the face. Its comment lists the nod with why each stays, and the twist. Never a real name.
- [ ] **Design** (four; 2 credits an image past the free 100 a month; `tripo.ts` bare, by its full path, the prompt a literal string: README) → pick one. **Twist pass:** if it reads as the original redrawn, redo it from the kind's concept as the reference, or push the twist in the wear edit. **Design read:** its black silhouette at play size to one or two fresh readers before any pose is drawn (README → 1. Design). An idea that only moves, cuts or adds a part can be mocked on the existing design's mask and read for free before Tripo draws it (the assistant dog's fourth round).
- [ ] **Wear edit** (two or three) → `art/sprites/<kind>/design.png`, and the prompt in your report.
- [ ] **Entry.** `tools/art3d/flat/kinds/<kind>.ts` (copy a worked example): `poses` (the eleven in the README), then `map.families` from `swatch.py`, `roles` (the costume `slot: 'player'`, every other coloured part a tone of it, the rest neutral: README → 5. Roles), `face`, `eyes`, `wear`, `accessories`, `gait`, `clips`. `build.ts body KIND HEIGHT` for `body`.
- [ ] **Poses** (three to a 16:9 image, two of each image, cut apart with `build.ts cut <kind> SHEET NAME… --design`: README → 3. Poses) → `art/sprites/<kind>/flat/`. Whiten a floor shadow, an off-white background and a drawn wall line first. Reject a lost prop, a new limb, a changed colour, a pose that hides a shape the read needs.
- [ ] **Register:** the kind in `LOADERS` (`src/render/cast/sprites/index.ts`), if it isn't there.
- [ ] **Build** and iterate: `pnpm exec tsx tools/art3d/flat/build.ts <kind>` until every pose has its eyes (`FLAT_DEBUG`) and its wear ("no room for" gone), and `pnpm vitest run tests/sprite-cast.test.ts` passes.
- [ ] **Shoot:** `pnpm shot variety --kinds <kind>` on a light theme and `--theme mine`, and `pnpm shot sprites --kind <kind>`. Look at all of it: eight at play scale and 3×, the cast lineup, the run cycle, the six-rolls lobby, `sprites-<kind>-variety.png`.
- [ ] **Blind read:** run `tools/art3d/blind-read.sh shots/sprites-blind-colour.png` twice (the colour sheet `pnpm shot sprites` writes beside the black one, the read a player makes; owner, 2026-11-06): each run is a fresh reader, a `claude -p` in an empty folder outside any repository, given the prompt below and the image alone. Never use a subagent as a reader: one started inside a worktree sees the git status, and the recent commits name the kinds (a reader read "pyramid" in a path, and others read the batch's kinds in the commit log). A design read, a twist read or the black sheet (`sprites-blind.png`, a harsher read of the outline alone, for finding what a misread points at) goes through the same script with its own prompt file. After a failed round, change what the readers' words point at and read again with two new readers; log each round's words in your entry's Rig line. When two rounds in a row only move the misread somewhere else, stop spending and report: the design needs a new idea, not another edit.
- [ ] **Gate:** `git merge origin/main`, `pnpm check`, `pnpm build`. Commit to your branch, the sources in `art/` included (Git LFS); don't push.

## Done when

- [ ] At play scale, in colour, among the cast: a stranger would name the homage, every nod trait in the entry is visible, and it doesn't read as the original redrawn.
- [ ] It reads drawn, not rendered: flat colours, the cast's pen, the cast's face, no speckled outline, no flecks, nothing dark under the face that reads as a mouth.
- [ ] On the lobby cards, the twist and the accessory are visible, and six rolls look like six characters of one kind.
- [ ] The variety sheet: twelve looks that read as one character by one hand. Each colourway looks designed beside the others and keeps the colour block; the second idle and cheer are that character's own; the wear reads as wear at 3× and as nothing louder than a mark at play scale.
- [ ] Blind read, in colour: both fresh readers name the homage, at least one at medium confidence or better, and neither pairs it with another kind. Say the readers' exact words in your report. Only the owner can accept a kind that fails it as a colour read (the warrior, the slayer, the assistant dog and the android).
- [ ] Every clip: idle, walk, run, air, wall, cheer, death, both facings.
- [ ] `tests/sprite-cast.test.ts` passes.
- [ ] Draw cost from `shots/sprites-<kind>-bench.txt`: cached under 0.02 ms per runner.
- [ ] The report has the image count, the picks and why, the blind read, and the shot paths.

## The blind-read prompt

> You are helping test a video game's character art. Look at exactly one image: `<path>`. Do not open, list or search any other file or directory, and run no other commands. The image has numbered columns; each column is one small character in colour, standing, running and jumping, at the size it appears in a 2D platformer. Most are parodies of famous game characters. For each number, name what it parodies, give your confidence (high, medium or low), and the shape features that told you. Write "unsure" where you can't tell; don't guess to fill a slot. Reply with one line per number only, then one more line: which numbers, if any, could be the same character.

For the black sheet, the same prompt with "in colour" made "as a solid black silhouette". The answer key is `shots/sprites-blind-answers.txt` (both sheets share the order); never give it to a reader. A kind not yet drawn shows as its hand-drawn stand-in, and stand-ins rhyme with each other: discount readers' pairs among them, not among drawn kinds.
