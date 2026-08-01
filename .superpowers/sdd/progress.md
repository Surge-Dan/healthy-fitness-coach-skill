# Healthy Fitness Coach V2 - SDD Progress

- Branch: `codex/fitness-coach-v2`
- Plan: `docs/superpowers/plans/2026-08-01-healthy-fitness-coach-v2.md`
- Spec: `docs/superpowers/specs/2026-08-01-healthy-fitness-coach-v2-design.md`

| Task | Status | Implementer | Review | Commit |
|---|---|---|---|---|
| 1. V1 snapshot and RED contracts | Complete | `task1_implementer` | Approved after fixes | `0db2f38`, `da64323`, `638bab2` |
| 2. Secure read-only Xunji MCP | In progress | Pending | Pending | Pending |
| 3. Skill V2 behavior layer | Pending | Pending | Pending | Pending |
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

