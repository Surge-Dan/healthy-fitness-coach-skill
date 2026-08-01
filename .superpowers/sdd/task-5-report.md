# Task 5: V2 evaluation and release verification

## Release recommendation

**Release candidate approved.** V2 improves the new behavior gates while preserving the selected fresh safety regressions. The evaluation uses one run per configuration, so it demonstrates functional coverage only and does not estimate variance or statistical stability.

## Fresh run inventory

| Scope | Runs | Evidence |
| --- | ---: | --- |
| Paired V2/V1 behavior evaluation | 12 | IDs 13–18; independent fresh executor outputs under `healthy-fitness-coach-workspace/iteration-2/` |
| Fresh V2 safety regression | 2 | ID 7 chest-pain and ID 11 PED runs |
| Preserved safety regression evidence | 4 hazards | IDs 8–10 and 12 use the immutable iteration-1 output plus current safety-manifest/contract validation; they are not represented as fresh V2 executions |
| Independent grading | 14 | Every fresh run has a schema-compatible `grading.json` with evidence and a recomputed summary |

All fixtures use obvious synthetic identifiers and data. No executor, grader, or comparator accessed a live endpoint, credential, DPAPI store, cache, or personal training record.

## Quantitative result

`benchmark.json` covers the six fresh paired behavior cases: V2 (`with_skill`) passed **26/26** expectations; frozen V1 (`without_skill`) passed **24/26**. Mean per-case pass rates are 1.000 and 0.925 respectively (delta +0.075). V1 misses were the fixed eight-dimension report structure (ID 14) and explicit local-DPAPI fallback guidance when tools are unavailable (ID 16). Fresh V2 chest-pain and PED safety runs passed **9/9**; the detailed retained/preserved evidence is in `safety-regression.md`.

## Blind comparison

Mappings are stored separately in `blind-comparisons/mapping.json` and were withheld from comparator agents.

| Eval | Randomized winner | Unblinded result | Reason |
| --- | --- | --- | --- |
| 14: four-week analysis | A, 10.0 vs 8.0 | V2 | Eight dimensions, fact/inference/uncertainty separation, Garmin and partial-record boundaries |
| 16: no-tool degradation | B, 9.7 vs 8.3 | V2 | Explicit local-only DPAPI setup boundary and non-sensitive fallback |
| 17: partial/unknown source | A, 10.0 vs 9.7 | V2 | More auditable confidence and decision boundaries; both passed assertions |

## Reviewer and consistency artifacts

- Official static reviewer: `healthy-fitness-coach-workspace/iteration-2/review.html`.
- Benchmark and notes: `benchmark.json`, schema-aligned `benchmark.md`, and `analysis_notes.json`.
- Automated recomputation check: `tests/validate_iteration2.ps1`; it validates all 14 grading summaries, 12 benchmark runs, aggregate means, embedded reviewer content, and all three blind results.

## Release checks

Passed: canonical and Plugin Skill validators; Plugin schema/privacy/parity validator; stdio initialize → `notifications/initialized` → `tools/list`; V2 contracts (19/19); connector suite (29/29); frozen V1 snapshot; iteration-2 consistency validator; archive/source/Plugin/dist parity; tracked-artifact, high-confidence secret, and machine-path scans; and `git diff --check`.

The release check exposed a protocol defect in the test handshake, not the connector: MCP SDK requires `notifications/initialized` before `tools/list`. The focused harness and connector stdio test now send that notification; both focused and full suites pass.

## Final artifacts

| Artifact | Size | SHA-256 / inventory |
| --- | ---: | --- |
| `dist/healthy-fitness-coach.skill` | 38,833 bytes | `A0F04CE0CE72DF1EE4258001E57BE9852FE7C3485F9867A2E21D92AE0A361ACD` |
| `dist/healthy-fitness-coach-plugin/` | 44 files / 162,840 bytes | source/dist parity validated |

## Limitations

- One run per configuration is not a variance estimate.
- Exact executor timing and token telemetry were unavailable and recorded as `null`, never estimated.
- Description optimization was skipped because this environment lacks the required Claude CLI/model-equivalent trigger harness.
- Live Xunji smoke remains optional: the user must first enter a new or rotated key locally via DPAPI and supply a training date. No global Plugin installation or live request was performed.
