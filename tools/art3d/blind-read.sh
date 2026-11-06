#!/usr/bin/env bash
# One blind reader for a sheet: a fresh `claude -p` in an empty folder outside any repository, so its
# context holds no git status or commit messages. A reader started as a subagent inside a worktree sees
# the recent commits, and a seat commit names the homages by their traits, which made those reads worthless.
#
#   tools/art3d/blind-read.sh <image.png> [prompt-file]
#
# The prompt defaults to the blind-read prompt in tools/art3d/CHECKLIST.md (the colour read, the bar); pass a file for another read
# (the twist read, a design read). `<path>` in the prompt becomes the copied image's name. Run it once per
# reader: every call is a new reader.
set -euo pipefail
img=${1:?usage: blind-read.sh <image.png> [prompt-file]}
here=$(cd "$(dirname "$0")" && pwd)
if [[ $# -ge 2 ]]; then
  prompt=$(cat "$2")
else
  prompt=$(grep '^> You are helping test' "$here/CHECKLIST.md" | sed 's/^> //')
fi
dir=$(mktemp -d "${TMPDIR:-/tmp}/r$RANDOM$RANDOM.XXXX")
cp "$img" "$dir/sheet.png"
cd "$dir"
claude -p "${prompt//<path>/sheet.png}" --allowedTools Read
