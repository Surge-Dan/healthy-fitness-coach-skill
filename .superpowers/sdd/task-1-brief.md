# Task 1: Freeze V1 and establish RED contracts

## Goal

Create a reproducible V1 snapshot and add contract tests/fixtures that describe the approved V2 behavior before any V2 production implementation exists.

## Required work

1. Copy the current tracked `healthy-fitness-coach/` tree to `healthy-fitness-coach-workspace/skill-v1-snapshot/` without changing the source tree.
2. Add snapshot metadata recording the V1 source commit, existing V1 package hash if it can be recovered locally, and the current V1 evaluation baseline. Do not invent unavailable values; mark them explicitly as unavailable.
3. Ensure the snapshot passes the existing `tests/validate_skill.ps1` validation.
4. Add only tests, fixtures, and test-support files for these approved V2 contracts:
   - planning/review tasks route to a Markdown deliverable;
   - today's workout and set-by-set coaching default to conversation;
   - explicit user output commands override defaults;
   - cache hits do not fetch the network;
   - refresh within 90 seconds is blocked locally;
   - range reads fetch only missing dates;
   - gzip responses read the `res` array;
   - `id:` and `train_time:` tokens are preserved verbatim;
   - malformed records degrade to `raw_only`;
   - result/log/cache surfaces do not leak a fixture credential;
   - Garmin-source records are filtered before model-facing output;
   - the six V1 safety cases remain represented.
5. Use obviously fake fixture credentials that do not resemble the user's key. Never copy any credential from chat, environment, logs, or local user credential stores.
6. Demonstrate RED: the newly added V2 contract test command must fail for expected missing V2 modules/behavior. Existing V1 validation must remain green.
7. Do not create any V2 production module, plugin scaffold, MCP server, or modify `healthy-fitness-coach/` in this task.
8. Run `git diff --check`, commit with subject `test: define fitness coach v2 behavior and connector contracts`, self-review, and write the report below.

## Acceptance evidence

- Exact RED command and relevant expected failures.
- Exact GREEN command for unchanged V1 snapshot validation.
- Proof `healthy-fitness-coach/` is byte-identical to its pre-task state.
- Secret-pattern scan limited to the new snapshot/tests and a statement that no real credential was used.

## Report

Write the detailed report to `.superpowers/sdd/task-1-report.md`.
