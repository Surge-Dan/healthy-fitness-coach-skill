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

## Evidence integrity and reviewer artifacts

- Official static reviewer: `healthy-fitness-coach-workspace/iteration-2/review.html`.
- All iteration-2 `eval_metadata.json` files are UTF-8 without BOM; the official viewer now embeds the exact ID and prompt for each of the 12 paired runs.
- `baseline-evidence-manifest.json` proves the three specifically restored files equal their `7b0db7a` Git blobs and SHA-256 values. `iteration-1/frozen-evaluator-evidence-manifest.json` separately covers the exact 17 frozen evaluator output/static-review files; missing, extra, changed, or hash-mismatched entries fail validation before scanner exemption.
- Benchmark and notes: `benchmark.json`, schema-aligned `benchmark.md`, and `analysis_notes.json`. These were regenerated after metadata normalization; no raw output or expectation changed, so executor/grader results were not rerun.
- Automated recomputation check: `tests/validate_iteration2.ps1`; it validates all 14 grading summaries, 12 benchmark runs, aggregate means, reviewer IDs/prompts, frozen evidence manifests, and all three blind results.

## Release checks

Passed: canonical and Plugin Skill validators; Plugin schema/privacy/parity validator; stdio initialize → `notifications/initialized` → `tools/list`; V2 contracts (19/19); connector suite (29/29); frozen V1 snapshot; iteration-2 consistency validator; archive/source/Plugin/dist parity; `tests/secret-scan.test.ps1`; full source/Plugin/dist/V1/iteration-2/archive secret scan; and `git diff --check`.

The scanner has RED/GREEN fixtures for Xunji, Bearer, quoted/unquoted API-key, and bare high-entropy patterns; it also rejects unknown URLs, query-string token/signature values, traversal/absolute/nonexistent repository paths, and tampered frozen evidence. Its narrowly allowed contexts are exact verified frozen hashes, package integrity attributes, exact known public source hosts with path-only identifiers, structured evaluator run IDs, and existing lowercase `assets/` or `references/` Markdown paths. It emits only location and detector category, never the matched value.

The release check exposed a protocol defect in the test handshake, not the connector: MCP SDK requires `notifications/initialized` before `tools/list`. The focused harness and connector stdio test now send that notification; both focused and full suites pass.

## Final artifacts

| Artifact | Size | SHA-256 / inventory |
| --- | ---: | --- |
| `dist/healthy-fitness-coach.skill` | 38,815 bytes | `3D8C7ED4E5ACCCDC8CDC0E2F9C8B14E5D3CB46A17BB184077638F924E95DA7DD` |
| `dist/healthy-fitness-coach-plugin/` | 44 files / 162,829 bytes | source/dist parity validated |

## Limitations

- One run per configuration is not a variance estimate.
- Exact executor timing and token telemetry were unavailable and recorded as `null`, never estimated.
- Description optimization was skipped because this environment lacks the required Claude CLI/model-equivalent trigger harness.
- Live Xunji smoke remains optional: the user must first enter a new or rotated key locally via DPAPI and supply a training date. No global Plugin installation or live request was performed.
