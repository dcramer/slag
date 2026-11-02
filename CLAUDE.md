@AGENTS.md

## Claude Code

- `.claude/settings.json` pre-approves the commands above and runs `oxfmt` on every file you edit under `src/`, `tests/`, `tools/`, `app/` (PostToolUse hook), so don't reformat by hand.
- For an independent check before you report done, delegate to the `verifier` subagent (`.claude/agents/verifier.md`): it runs the gate, takes the relevant screenshots, looks at them, and reports evidence without editing anything.
