---
description: Verify, review and prepare a commit for the current changes
agent: build
---

Current changes:

!`git status --short`
!`git diff --stat`

Run the ship workflow in this order and stop at the first failure.

1. Run `npm run verify`. If it fails, fix the cause in the code (never weaken a check, delete a test, or add a lint-disable comment), then run it again. If you cannot fix it, stop and report why.
2. Ask the @reviewer subagent to review the current diff against AGENTS.md. Fix every high-severity finding, then run `npm run verify` again. List any lower-severity findings without acting on them.
3. Propose a commit message in the imperative mood: a subject line under 72 characters, and a short body if the change needs explaining. Extra context from the user: $ARGUMENTS
4. Stage the relevant files and commit with that message. Do not use `--no-verify`. Do not push.

Finish with a short summary: what changed, the verify result, the reviewer's remaining notes, and the commit hash.
