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

## P1 follow-up: negated routing commands

Added Chinese and English regressions for every explicit command: `不想/不要直接出报告`, `不要进入跟练`, `不要保存刚才内容`, `Do not direct report`, `Don't enter tracking`, and `Do not save prior content`. The new test was RED because a negated command selected `direct_report`. The helper now evaluates each command occurrence independently, accepts only unnegated Chinese commands and token-bounded English commands, and therefore keeps a negated command on the task-type default route without suppressing a later independent positive command. Focused and full V2 contracts are GREEN at 16 pass / 0 fail; connector, snapshot/Skill validators, credential scan, and diff check were rerun before the follow-up commit.

## P1 follow-up 2: bounded negation grammar

Review added exact RED regressions for `我不需要直接出报告`, `请不要给我直接出报告`, `无需直接出报告`, `Don’t direct report`, `Do-not direct report`, `I do not want a direct report`, and `I not want a direct report`, plus equivalent `enter tracking` / `save prior content` cases. The first failing assertion again showed an incorrect `direct_report` override rather than `{ mode: 'conversation', reason: 'default_task_type', override: null }`.

GREEN replaces the previous narrow suffix checks with a bounded, per-occurrence context grammar. It normalizes Unicode apostrophes, hyphens/dashes, punctuation, and spacing; Chinese accepts only a nearby explicit negation/intention (`不想/不要/不需要/无需/不必/别/拒绝`, optional `再/给我`), and English accepts only nearby `do not/don't/dont/do-not/not want/no need/refuse/never` forms. It never performs a global `not` rejection, so later independent positive commands remain effective. Focused ordinary-language probes covered `I do not want to direct report`, `I refuse to save prior content`, `I have no need to enter tracking`, `Never save prior content`, and a distant unrelated `not` followed by a positive command. Full V2 contracts are GREEN at 17 pass / 0 fail before this commit.

## P1/P2 redesign: conservative positive command grammar

The bounded-negation approach was intentionally replaced rather than extended. New RED examples were `暂时不直接出报告`, `请不要让我进入跟练`, `我不愿意保存刚才内容`, `I don't really want a direct report`, and `Do you directly report training data?`; each must retain the task default with `override: null`. Tests also added ordinary positive requests (`请直接出报告`, `I want a direct report`, `帮我进入跟练`, `Please save prior content`) and retained the later-independent-affirmative behavior.

GREEN now normalizes Unicode apostrophes/dashes and whitespace, splits on strong punctuation plus explicit contrast/sequence connectors, then only accepts a complete approved command after stripping a short allowlist of polite/affirmative prefixes and suffixes. Questions and clauses with residual negative or descriptive words cannot override because they do not exactly equal an approved command. This is a positive allowlist boundary, not an expanded negation dictionary. The focused suite is GREEN at 18 pass / 0 fail before the redesign commit.

## Allowlist review follow-up

Read-only review found two RED gaps: unpunctuated `Can you direct report` / `Could you please enter tracking` were interpreted as commands, and `不要直接出报告，然后直接出报告` did not preserve the later Chinese affirmative. The fixes reject English interrogative openings (`can/could/do/does/did/would/will/are/is you`) before prefix stripping and extend the explicit Chinese sequence connectors to `然后/之后/接着/随后`. The review also added a Unicode full-width-space/em-dash positive command regression. Focused contracts returned GREEN at 18 pass / 0 fail; final connector, validator, credential-scan, and diff checks are recorded below the follow-up commit.
