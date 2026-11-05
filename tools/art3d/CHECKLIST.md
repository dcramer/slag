# One kind: run sheet and done list

For a production agent taking one Roster entry (docs/CHARACTERS.md → Roster) to a kind the game draws. The how is in [README.md](README.md). Copy this list into your report and tick it.

## Run sheet

- [ ] **Worktree.** `pnpm install`. Read AGENTS.md, src/render/AGENTS.md, docs/ART.md → World art, your Roster entry and its "Rules for every kind", docs/CHARACTERS.md → Decisions 9, and `tools/art3d/flat/kinds/plumber.ts` and `zapmouse.ts` as worked examples (`chomper.ts` for a limbless kind).
- [ ] **Brief.** `BRIEFS[kind].design` in `style.ts` from the entry (fill in its stub, if it has one): the nod and the twist as big shapes, the palette hex, the signature prop first; `worn`: two to four big worn changes, off the face. Its comment lists the nod with why each stays, and the twist. Never a real name.
- [ ] **Design** (four; 2 credits an image past the free 100 a month) → pick one. **Twist pass:** if it reads as the original redrawn, redo it from the kind's concept as the reference, or push the twist in the wear edit.
- [ ] **Wear edit** (two or three) → `art/sprites/<kind>/design.png`, and the prompt in your report.
- [ ] **Entry.** `tools/art3d/flat/kinds/<kind>.ts` (copy a worked example): `poses` (the eleven in the README), then `map.families` from `swatch.py`, `roles` and the costume slot, `face`, `eyes`, `wear`, `accessories`, `gait`, `clips`. `build.ts body KIND HEIGHT` for `body`.
- [ ] **Poses** (three to a 16:9 image, two of each image, cut apart with `build.ts cut <kind> SHEET NAME…`, `--design` for the design's size: README → 3. Poses) → `art/sprites/<kind>/flat/`. Reject a lost prop, a new limb, a changed colour; whiten a drawn wall line out.
- [ ] **Register:** the kind in `LOADERS` (`src/render/cast/sprites/index.ts`), if it isn't there.
- [ ] **Build** and iterate: `pnpm exec tsx tools/art3d/flat/build.ts <kind>` until every pose has its eyes (`FLAT_DEBUG`) and its wear ("no room for" gone), and `pnpm vitest run tests/sprite-cast.test.ts` passes.
- [ ] **Shoot:** `pnpm shot variety --kinds <kind>` on a light theme and `--theme mine`, and `pnpm shot sprites --kind <kind>`. Look at all of it: eight at play scale and 3×, the cast lineup, the run cycle, the six-rolls lobby, `sprites-<kind>-variety.png`.
- [ ] **Blind read:** give `shots/sprites-blind.png` (copy it out of the repo first) to two fresh agents with the prompt below. Nothing else in their brief.
- [ ] **Gate:** `git merge origin/main`, `pnpm check`, `pnpm build`. Commit to your branch, the sources in `art/` included (Git LFS); don't push.

## Done when

- [ ] At play scale, in colour, among the cast: a stranger would name the homage, every nod trait in the entry is visible, and it doesn't read as the original redrawn.
- [ ] It reads drawn, not rendered: flat colours, the cast's pen, the cast's face, no speckled outline, no flecks, nothing dark under the face that reads as a mouth.
- [ ] On the lobby cards, the twist and the accessory are visible, and six rolls look like six characters of one kind.
- [ ] The variety sheet: twelve looks that read as one character by one hand. Each colourway looks designed beside the others and keeps the colour block; the second idle and cheer are that character's own; the wear reads as wear at 3× and as nothing louder than a mark at play scale.
- [ ] Blind read: both fresh readers name the homage, at least one at medium confidence or better. Say the readers' exact words in your report.
- [ ] Every clip: idle, walk, run, air, wall, cheer, death, both facings.
- [ ] `tests/sprite-cast.test.ts` passes.
- [ ] Draw cost from `shots/sprites-<kind>-bench.txt`: cached under 0.02 ms per runner.
- [ ] The report has the image count, the picks and why, the blind read, and the shot paths.

## The blind-read prompt

> You are helping test a video game's character art. Look at exactly one image: `<path>`. Do not open, list or search any other file or directory, and run no other commands. The image has numbered columns; each column is one small character as a solid black silhouette, standing, running and jumping, at the size it appears in a 2D platformer. Most are parodies of famous game characters; a few may be plain animals. For each number, name what it parodies, give your confidence (high, medium or low), and the shape features that told you. Write "unsure" where you can't tell; don't guess to fill a slot. Reply with one line per number only.

The answer key is `shots/sprites-blind-answers.txt`; never give it to a reader.
