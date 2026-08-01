# Task 1 Report: V1 snapshot and RED contracts

## Scope completed

- Copied the tracked `healthy-fitness-coach/` tree at repository commit `7207fac80e351928e43c3dee8400ebd4b9947237` to `healthy-fitness-coach-workspace/skill-v1-snapshot/` using `git archive`.
- Recorded V1 provenance, package hash, evaluation baseline, and a byte-level 15-file manifest in `healthy-fitness-coach-workspace/skill-v1-snapshot.metadata.json`.
- Added test-only fixtures and the V2 contract suite. No V2 production module, plugin scaffold, MCP server, or V1 source file was added or changed.

## V1 baseline

- Last commit affecting the V1 source tree: `547c2dd003ee5c6b9b433aa364074f5c07617f28`.
- Tracked V1 tree object: `798648f9c65ae30271dccc033fdfd7a73f40f574`.
- Recovered local package: `dist/healthy-fitness-coach.skill` with SHA-256 `B85315D541D87964F510F04A7033C4944695F28EBEE6A5B296E667E5D14A68F5`.
- Existing evaluation baseline (`iteration-1/benchmark.json`): cases `1,4,7,8,9,10,11,12`; one run per configuration; with-skill mean pass rate `1.0`; without-skill mean pass rate `0.95`; V1 safety cases passed `25/25` assertions. The single-run baseline is not statistical-stability evidence.

## RED evidence

Command:

```powershell
node --test tests/v2-contracts.test.js
```

Observed result: 12 tests ran; 1 passed (the unchanged V1 safety-case representation check) and 11 failed as intended. The three routing tests fail with `ENOENT` for the future `healthy-fitness-coach/references/output-routing.md`; connector tests fail with `MODULE_NOT_FOUND` for the future `healthy-fitness-coach-plugin/mcp/xunji/src/{server,xunji-client,parser}.js` modules. These are the intended missing-V2-behavior failures, not test setup failures.

The contracts cover Markdown/conversation routing and overrides; cache-hit, 90-second refresh, and range-fetch behavior; gzip `res`; verbatim `id:`/`train_time:`; `raw_only`; credential redaction; Garmin filtering; and all six V1 safety cases.

## GREEN and integrity evidence

Commands:

```powershell
powershell -NoProfile -File tests/verify_v1_snapshot.ps1
powershell -NoProfile -File tests/validate_skill.ps1 -SkillRoot healthy-fitness-coach-workspace/skill-v1-snapshot
powershell -NoProfile -File tests/validate_skill.ps1
```

All three passed. The byte-manifest checker verifies both the V1 source and snapshot against the same recorded hashes and lengths. `git diff --exit-code -- healthy-fitness-coach` also passed, proving no source-tree change relative to the task start.

## Credential handling

- The only credential-like test value is the explicit fake fixture `TEST_ONLY_DO_NOT_USE`.
- No credential store, environment value, chat-supplied credential, network endpoint, or live training data was read.
- A credential-shape scan limited to `tests` and `healthy-fitness-coach-workspace/skill-v1-snapshot` returned no credential-shaped values.

## Follow-up boundary

The RED suite remains intentionally failing until Tasks 2 and 3 add the approved connector and output-routing behavior. Its tests define the expected exported interfaces and observable behavior for that work.
