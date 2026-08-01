# Task 6: Final release remediation

## Goal

Fix the Important findings from the whole-branch release review, prove them with focused RED/GREEN tests, re-synchronize affected Plugin/dist artifacts, and produce a clean final release candidate. This task is remediation only; do not expand to Keep, Xiaohongshu scraping, live Xunji calls, global Plugin installation, or real credentials/data.

## 1. Account-scoped Xunji cache isolation (release blocker)

`createTrainingService` must choose cache and in-flight work by the **current credential fingerprint**, never by first credential seen.

- Each `getTrainingDay` and range iteration obtains the current credential before cache lookup, derives a one-way fingerprint, then selects/creates that account cache.
- Cache factory receives the credential only in memory; no fingerprint/key is returned to MCP, logs, errors, or cache entry.
- In-flight merge keys include account fingerprint plus date so account A and B never coalesce.
- Preserve injected `cache` test compatibility only if it cannot cause cross-account production behavior; document its test-only semantics or replace it with a keyed injection.
- Add RED/GREEN tests: synthetic credential provider changes A -> B for the same date; B must not return A's cache entry, cache factory must see both credential identities, and pending same-date requests for distinct accounts must not merge. Existing same-account merge must remain.

## 2. Production result traceability and partial range behavior (release blocker)

Make the MCP result contain the evidence fields the Skill/report is instructed to explain. Do not rely on a prompt injecting artificial cache metadata.

### Day result

Successful `xunji_get_training_day` result must include:

- `date`, `fetched_at`, `cache_hit`, `cache_hits`, `network_fetches`, `records`, `warnings`, `data_freshness`;
- parsed/model-facing records must preserve `raw_text`, `id`, `train_time`, parse status, and a `record_date` equal to requested date;
- errors remain public/redacted and stable.

### Range result

Successful or partial range result must include:

- inclusive requested `dates` in order;
- `days`: one result per successful date, retaining each day’s `date`, `fetched_at`, records, warnings and freshness;
- flattened `records` may remain for convenience, but each must retain `record_date`;
- `cache_hits`, `network_fetches`, `missing_dates`, `warnings`, `data_freshness`, and `partial` boolean;
- if one/more dates fail after at least one success, return a **partial success** with warnings and `missing_dates` rather than throwing away successes; if all dates fail, return public error;
- do not expose provider headers, credentials, stack or internal paths.

Add RED/GREEN tests for `fetched_at`, record date provenance, two-day range groupings, and one-day failure yielding partial data/missing date. Update the existing V2 contract tests accordingly. If execution eval fixtures currently hand-inject fields now provided by the connector, add a mock-MCP/service integration assertion to demonstrate the actual structure is consumable; do not falsely claim a real API run.

## 3. Privacy-preserving Markdown report path

- Default generated Markdown artifact directory is `fitness-reports/` under the current workspace, using a concise non-PII filename with collision suffixes; never overwrite unrelated files.
- Add `fitness-reports/` to repository `.gitignore`.
- Update `SKILL.md`, `references/output-routing.md`, report template/instructions, Plugin Skill copy, and relevant tests. If user explicitly gives a safe destination, it may override the default; otherwise use this directory.
- Test default path and absence of PII in recommended filenames.

## 4. Secret scan hardening without hiding frozen evidence

- Immutable historical files must first satisfy their exact base hash manifest; **then still run explicit credential detectors** (`xunji_token`, `bearer_token`, `labelled_secret`, `query_secret`) over their text. Only the generic `bare_high_entropy` detector may skip exact immutable historical content, and only after hash verification.
- Expand Bearer matching to realistic RFC 6750 token characters including `+`, `/`, and `=`. Add a synthetic fixture; never use a real key.
- Preserve the narrow source URL and relative-Markdown exceptions only for generic entropy; URL/query specific detectors must still run.
- Add RED/GREEN tests proving a manifest-hashed immutable fixture containing a synthetic Xunji/Bearer/labelled/query secret fails, while a benign frozen public URL hash path remains permitted only for generic entropy.

## 5. Honest blind-comparison provenance

- Re-run eval 14/16/17 comparisons in fresh isolated agents using neutral `candidate-a/submission.md` and `candidate-b/submission.md` only.
- Persist `provenance.json` for each comparison with: generated UTC timestamp, canonical subagent task name/ID as surfaced by the orchestrator, neutral input SHA-256 hashes, permitted file list, comparator result SHA-256, and a declaration that mapping was not supplied to the comparator.
- Mapping remains separate and is used only by the controller after comparator completion. Prompt/audit/provenance must contain no V1/V2/with_skill/without_skill identity or source paths.
- Validator checks provenance structure, hash equality, prompt/audit ban list, neutral inputs, unblinding, and each result. Do not claim cryptographic proof of the agent's private context; task report must call this auditable process provenance, not independent proof of internal state.

## 6. Cleanup and metadata boundary

- Fix all `git diff --check` errors and update SDD progress Task 6 status only after its task review approval.
- Keep `agents/openai.yaml` standards-compliant. The official Codex documentation supports skill MCP dependency metadata with `streamable_http` URL fields, while this connector is packaged local stdio through Plugin `.mcp.json`; document this compatibility boundary in README/Task report instead of adding unsupported YAML fields.
- Update current artifact hashes/sizes in Task 5/6 report after any package change.

## TDD, verification, and commit

1. Add focused failing tests before production changes; capture RED evidence.
2. Implement minimal fixes, make focused tests GREEN, then run connector `npm test`, V2 contracts, Skill/Plugin validators, Plugin stdio handshake, V1 snapshot, iteration-2 consistency, secret scanner tests/full roots/archive, artifact parity, and `git diff --check`.
3. Re-sync canonical Skill to Plugin/dist and repackage `.skill` only when Skill files change; validate output archive contents and report final SHA/size.
4. No real API/key/DPAPI/cache access during tests.
5. Commit focused product fixes separately from evidence/provenance fixes if practical; write `.superpowers/sdd/task-6-report.md` with exact RED/GREEN commands, semantic changes, tests, artifact values, and remaining limitations.
