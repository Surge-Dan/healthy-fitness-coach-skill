# Task 6 Report: Final release remediation

## Status

Implemented release-blocker remediation without using a live endpoint, real credential, DPAPI store, cache, or training data. V1 snapshot and frozen iteration-1 evaluator evidence were not modified.

## RED evidence

1. `node --test test/server.test.js` from `healthy-fitness-coach-plugin/mcp/xunji` failed as expected for credential rotation (A cache returned for B), date-only in-flight merging, missing `date`/`fetched_at`/`record_date`, and range partial success.
2. `node --test tests/v2-contracts.test.js` failed as expected for absent per-day grouping and the report-artifact helper.
3. `powershell -NoProfile -ExecutionPolicy Bypass -File tests/secret-scan.test.ps1` failed as expected because manifest-hashed explicit Xunji-shaped text was skipped.
4. `node --test test/server.test.js` then failed as expected for two concurrent same-account cache factories; this closed the creation-race gap.
5. `powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate_iteration2.ps1` failed as expected for missing comparison provenance before it was added.
6. `node --test tests/v2-contracts.test.js` failed as expected for a real temporary-directory collision: with an existing `fitness-reports/fitness-weekly-review.md`, the helper still recommended that occupied path.

## GREEN implementation

- The connector obtains the current credential before every lookup, maps account caches and in-flight work by one-way credential fingerprint plus date, and keeps `cache` as documented test-only injection.
- Day responses now expose `date`, `fetched_at`, cache/network counts, freshness, warnings and date-provenanced parsed records. Range responses retain ordered dates and successful `days`, return flattened date-provenanced records, and provide partial success with `missing_dates`; all-failed ranges preserve the first stable public error.
- Markdown defaults to workspace `fitness-reports/`, non-PII names and numeric collision suffixes. `.gitignore`, Skill, routing guide, template, Plugin, dist and archive are synchronized.
- Verified immutable text now runs explicit Xunji/Bearer/labelled/query detectors after hash validation; only generic entropy skips. Bearer matching accepts RFC 6750 `+`, `/`, `=` characters.
- Fresh neutral comparators completed comparisons 14/16/17 from only `comparator-prompt.md` and neutral candidate files. Each `provenance.json` records UTC time, surfaced canonical comparator task, permitted list, candidate and result hashes, and mapping-withheld declaration. The validator verifies structure, hashes, neutral paths, ban list, results and unblinding. This is auditable process provenance, not cryptographic proof of a comparator's private context.

## GREEN verification

Exact successful commands:

```powershell
node --test tests/v2-contracts.test.js
Push-Location healthy-fitness-coach-plugin/mcp/xunji; npm test; Pop-Location
powershell -NoProfile -ExecutionPolicy Bypass -File tests/verify_v1_snapshot.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate_iteration2.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/validate_plugin.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tests/secret-scan.test.ps1
.\tests\secret-scan.ps1 -Roots $roots -ImmutableManifest $manifests
git diff --check
```

- The focused real-directory collision test passes: it preserves the pre-existing synthetic file, creates nothing, and recommends `fitness-weekly-review-2.md`.
- Connector `npm test`: 34/34 pass; V2 contracts: 21/21 pass.
- Frozen V1 snapshot, iteration-2 consistency/provenance validator, Plugin validator and stdio handshake: pass.
- Focused and full canonical/Plugin/dist/V1/iteration/archive secret scans pass; archive parity is 21/21 non-eval canonical files.

## Current artifacts and limits

- `dist/healthy-fitness-coach.skill`: 39,926 bytes; SHA-256 `BD931E118AC364774134441D5403D7CFFBBB385E67D832E9BB858CA31EFC51A4`.
- `dist/healthy-fitness-coach-plugin`: 45 files / 170,286 bytes; source/dist parity pass.
- Local production MCP remains Plugin `.mcp.json` stdio. `agents/openai.yaml` was intentionally not given unsupported streamable-HTTP dependency metadata.
- One execution per comparison/configuration is functional evidence, not variance estimation; no live Xunji smoke was run.
