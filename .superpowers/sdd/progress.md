# Healthy Fitness Coach V2 - SDD Progress

- Branch: `codex/fitness-coach-v2`
- Plan: `docs/superpowers/plans/2026-08-01-healthy-fitness-coach-v2.md`
- Spec: `docs/superpowers/specs/2026-08-01-healthy-fitness-coach-v2-design.md`

| Task | Status | Implementer | Review | Commit |
|---|---|---|---|---|
| 1. V1 snapshot and RED contracts | Complete | `task1_implementer` | Approved after fixes | `0db2f38`, `da64323`, `638bab2` |
| 2. Secure read-only Xunji MCP | Complete | `task2_implementer` | Approved after security fixes | `031f094`, `29b6fda` |
| 3. Skill V2 behavior layer | Complete | `task3_implementer` | Approved after routing redesign | `ce4a742`, `953b4f0`, `c97fa29`, `6616376`, `9c29bd0` |
| 4. Plugin packaging | Complete | `task4_implementer` | Approved after portability fix | `8258556`, `c847d28` |
| 5. Evaluation and release verification | Complete with final hardening | `task5_implementer` | Approved after evidence fixes | `f581162`, `1202e71`, `f3d5efd` |
| 6. Final release remediation | Complete | `task6_implementer` | Approved after collision hardening | `3f34bb3`, `6752484`, `4633b10` |

## Non-negotiable constraints

- Never use, echo, persist, test with, or commit any API key supplied in chat.
- No live Xunji request until the user records a new key locally via DPAPI and supplies a training date.
- Connector V1 is read-only and exposes exactly two training-read tools.
- Cache and user reports stay outside Git.
- Preserve V1 safety behavior and the `healthy-fitness-coach` skill name.

## Task 1 notes

- Intentional RED: 12 tests total, 1 V1 safety-manifest check passes and 11 V2 contracts fail on absent production modules.
- Formal task review approved after routing semantics, safety assertions, and RED evidence were corrected.

## Task 2 notes

- Connector package tests: 29/29 passing; real stdio initialize and tools/list returns exactly two read-only tools.
- V2 contracts: 9 passing, only three Task 3 routing contracts remain intentionally RED.
- Node 18 compatibility requires an exact `@hono/node-server` 1.19.17 override. Its documented static-server advisory is not reachable through the stdio-only connector path; retain this residual-risk note.
- Future polish: source matching is intentionally fail-closed for any source label containing `garmin`; unknown-source warnings may be deduplicated.

## Task 3 notes

- V2 behavior/static contracts: 19/19 passing; connector remains 29/29.
- Output override boundary is conservative: only complete affirmative command clauses match; negations, questions, and descriptive uses fall back to task defaults.
- Fixed mixed-command priority: `direct_report` > `enter_tracking` > `save_prior_content`.
- Frozen V1 snapshot remains immutable; current-source equality is now an opt-in historical check.

## Task 4 notes

- Official Plugin and Skill validators pass; `.mcp.json` handshake lists exactly two Xunji tools.
- Canonical/Plugin Skill and source/dist Plugin SHA-256 parity pass; `.skill` contains the 20 expected non-eval files.
- Validation tooling derives the official validator from `CODEX_HOME` or the current user's `.codex` directory; no user-specific absolute default remains.
- No marketplace or global installation state was changed.

## Final review remediation

- Whole-branch review found account-cache isolation, production result traceability, report privacy path, and release-evidence issues that require fixes before merge.
- `agents/openai.yaml` supports MCP dependency metadata for documented streamable-HTTP servers; the packaged local stdio MCP remains declared through the Plugin `.mcp.json`. Do not add unsupported metadata fields solely to silence a review finding.

## Task 6 approval

- Final task review approved after real-filesystem collision checks were made non-bypassable.
- Final release values: connector 34/34, V2 contracts 21/21, standalone archive 39,922 bytes with SHA-256 `FA0FA12582E218839249C16922B1C04DACB42ED5CF5FD77200B1C2F2177EB934`, Plugin dist 45 files / 170,261 bytes.
