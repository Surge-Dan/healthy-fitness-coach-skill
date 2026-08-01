# Healthy Fitness Coach V2 - SDD Progress

- Branch: `codex/fitness-coach-v2`
- Plan: `docs/superpowers/plans/2026-08-01-healthy-fitness-coach-v2.md`
- Spec: `docs/superpowers/specs/2026-08-01-healthy-fitness-coach-v2-design.md`

| Task | Status | Implementer | Review | Commit |
|---|---|---|---|---|
| 1. V1 snapshot and RED contracts | Complete | `task1_implementer` | Approved after fixes | `0db2f38`, `da64323`, `638bab2` |
| 2. Secure read-only Xunji MCP | Complete | `task2_implementer` | Approved after security fixes | `031f094`, `29b6fda` |
| 3. Skill V2 behavior layer | In progress | Pending | Pending | Pending |
| 4. Plugin packaging | Pending | Pending | Pending | Pending |
| 5. Evaluation and release verification | Pending | Pending | Pending | Pending |

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

