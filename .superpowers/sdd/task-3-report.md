# Task 3: Skill V2 behavior layer

## Status

Completed the `healthy-fitness-coach` V2 behavior layer without renaming the Skill, using real training data, reading credentials, calling a live 迅疾 service, adding a plugin manifest, or running Task 5 paired evals. `SKILL.md` is 103 lines and keeps V1 safety routing intact.

## RED → GREEN evidence

1. Before production changes, `node --test tests/v2-contracts.test.js` produced the expected RED baseline: 9 passing connector/V1 checks and 3 failing routing contracts because `references/output-routing.js` did not exist.
2. Added focused contract tests for spacing/punctuation normalization and non-overmatch, required V2 resources/entrypoint navigation, eight-dimensional matrix, report sections, bounded adjustments, and safety/evidence labels. The expanded suite was RED at 9 pass / 6 fail because the future helper and documents were absent.
3. Added the smallest routing helper and behavior resources, then fixed the focused RED for `save the prior content` by recognizing the English-equivalent command. The V2 contract suite is GREEN at 15 pass / 0 fail.
4. Read-only review found that substring matching could misroute `indirect report`, `reenter tracking`, and `autosave prior content`. Added those cases first (RED: `indirect report` incorrectly selected `direct_report`), then replaced English substring checks with boundary-aware command patterns. The focused suite returned GREEN at 15 pass / 0 fail.

## Delivered behavior

- `references/output-routing.js` is a deterministic CommonJS `routeOutput({taskType,userInstruction})` helper returning exactly `{mode, reason, override}`. It supports default conversation/Markdown routes and explicit Chinese/English override commands while normalizing reasonable whitespace and punctuation.
- Markdown output instructions create a collision-safe `.md` file in the current workspace when write tools exist; otherwise they return complete Markdown and state that no file was created. Mode questions are not used by default.
- 迅疾 guidance is optional and capability-aware: read-only, cache-first, minimal range, DPAPI local interactive setup rather than chat credentials, evidence preservation, Garmin exclusion, and paste/manual-log degradation.
- The eight-dimensional matrix defines inputs, method, comparison window, confidence downgrade, limits, and allowed action for every required dimension. It preserves the 2–3/4/8-week evidence limits, one-session rule, one-to-two-variable adjustment cap, and safety precedence.
- Web research is opt-in by need, grades evidence, and never bypasses login, CAPTCHA, robots, or anti-scraping controls. The report template puts conclusions and evidence boundaries first, contains all eight dimensions, and limits adjustments to two.

## V1 snapshot transition

`tests/verify_v1_snapshot.ps1` now defaults to proving that the frozen V1 snapshot exactly matches its metadata manifest. `-RequireSourceMatch` preserves the historical strict mode and intentionally fails after V2 source additions; this expected failure was exercised. The V1 snapshot/metadata and `dist` package were not modified. `tests/validate_skill.ps1` validates the current source while checking the legacy V1 package against the frozen snapshot, so Task 4 remains responsible for repackaging.

## Verification

- `node --test tests/v2-contracts.test.js` — 15 pass / 0 fail, including all six V1 safety manifest checks.
- `npm --prefix healthy-fitness-coach-plugin/mcp/xunji test` — 29 pass / 0 fail.
- `powershell -NoProfile -File tests/verify_v1_snapshot.ps1` — pass; optional `-RequireSourceMatch` expected failure verified.
- `powershell -NoProfile -File tests/validate_skill.ps1` — pass.
- Credential-shape scan over `healthy-fitness-coach` and `tests` — pass; `git diff --check` — clean.

## Scope notes

The Skill describes browser/search/MCP behavior only as available capabilities, never guaranteed dependencies. No real API, credential, training record, cloud storage, write-back, crawler, or Task 5 evaluation was used.
