# Task 2: Build the secure read-only Xunji MCP connector

## Goal

Implement the Windows/Node 18+ read-only Xunji connector so all connector contracts turn GREEN, with unit and mock-integration coverage for credentials, HTTP, caching, parsing, and the two MCP tools. Do not modify the Skill behavior layer in this task.

## Runtime and source layout

- Root: `healthy-fitness-coach-plugin/mcp/xunji/`
- Node.js 18+, CommonJS or ESM as long as the committed package is runnable and the existing CommonJS tests can load its public interfaces.
- Use the official `@modelcontextprotocol/sdk` 1.x package and `zod`; pin exact dependency versions in `package.json` and commit the lockfile. The official npm package showed `1.30.0` as current on 2026-08-01; if installation proves incompatible with Node 18 or registry metadata differs, stop and report rather than silently changing architecture.
- Use `node:test`, built-in `fetch`, stdio transport, and the approved file layout: `src/server.js`, `credentials.js`, `xunji-client.js`, `cache.js`, `parser.js`, `schemas.js`, `errors.js`; PowerShell scripts under `scripts/`; tests under `test/`.

## Security invariants

1. Never read, search for, echo, use, persist, or commit any real API key or user training data. Never invoke the real Xunji host in tests.
2. Production credentials are accepted only from the Windows DPAPI file written interactively by `set-credential.ps1`; no plaintext CLI flag, environment variable, source literal, test fixture, log field, cache field, or tool result.
3. `set-credential.ps1` uses `Read-Host -AsSecureString` and stores encrypted data below `%LOCALAPPDATA%\HealthyFitnessCoach\credentials\`; `remove-credential.ps1` removes only the resolved credential file after verifying it is inside that directory.
4. Node obtains the credential through a narrowly scoped PowerShell child process, keeps plaintext only in memory, never includes it in thrown/displayed errors, and does not log request headers.
5. Tests inject fake credential providers and temporary directories. They must not call the production credential reader or inspect the user's credential store.
6. Cache, logs, and MCP results must be scanned/redacted so secrets are not surfaced.
7. Garmin-source data must be removed from model-facing records. If source cannot be identified, keep a warning and lower confidence rather than asserting it is safe Garmin-free data.

## API client

- Fixed request: `POST https://trains.xunjiapp.cn/api_trains_for_llm`.
- Header: `Authorization: Bearer <in-memory credential>` and `Content-Type: application/json`.
- Body contains only `datestr` in strict `YYYY-MM-DD`.
- Add connection/response timeout with `AbortController`; inject fetch/base URL for local mock tests only.
- Node fetch may transparently decompress gzip; `decodeXunjiResponse` must also accept a gzipped Buffer for deterministic fixtures.
- Validate HTTP status, JSON, `success === true`, and `res` array.
- Map errors to only: `missing_credentials`, `invalid_credentials`, `invalid_date`, `range_too_large`, `rate_limited`, `network_error`, `invalid_response`, `parse_partial`, `cache_error`.
- Stable error objects contain a user explanation and recovery action, but never headers, raw credential, full response, stack, or internal path.
- Do not automatically retry authentication or same-day rate-limit errors.

## Cache and concurrency

- Default root: `%LOCALAPPDATA%\HealthyFitnessCoach\xunji-cache\<one-way-fingerprint>\YYYY\MM\<date>.json`; allow a temporary root in tests.
- Fingerprint is a one-way digest and never contains the key.
- Validate schema before atomic write. Support read, atomic write, single-date delete, and scoped delete-all.
- Merge simultaneous in-process reads for the same date using a promise map.
- Valid cache hits do not call the network. A failed refresh never overwrites a valid cache entry.
- Enforce a local 90-second same-date refresh window.
- Range reads are inclusive, sequential, use local dates, max 90 calendar days, and fetch only missing dates. Default timezone semantics are Asia/Shanghai; keep the time source injectable.

## Parser and model-facing data

- Preserve every original record string as `raw_text`.
- Preserve `id:` and `train_time:` token values verbatim. Recognize date/name/exercise/set-rep fields conservatively.
- Do not rely on naive comma splitting as the only parser; preserve unknown fragments as notes/warnings.
- Emit `complete`, `partial`, or `raw_only`; malformed input must not fabricate structure.
- Preserve weight units; flag extreme numbers rather than deleting or converting them.
- Cover standard record, no time, no ID, commas in notes, empty array, unknown token, format drift, and multiple records.

## MCP/service surface

- Production MCP exposes exactly two read-only tools:
  - `xunji_get_training_day(date, refresh=false)`
  - `xunji_get_training_range(start_date, end_date, refresh_today=false)`
- Export `createTrainingService` for tests with injected cache/client/credentialProvider/logger/clock.
- Tool/service results include stable fields as applicable: `cache_hits`, `network_fetches`, `dates`, `records`, `warnings`, `data_freshness`; day results may also expose `cache_hit`.
- Preserve raw record, ID, and train-time tokens. Filter restricted source records before the returned `records` field.
- Do not expose credential-management or cache-deletion as MCP tools.

## TDD and verification

1. Start from the intentional RED contracts. Add focused unit/mock-integration tests before each production slice; capture failing output.
2. Use a local mock HTTP server for gzip success, empty day, missing/invalid key mapping, 90-second limit, non-JSON, `success=false`, timeout, cache-hit/failure fallback, and same-date promise merging.
3. Make connector-related tests GREEN; Task 3 routing tests remain intentionally RED.
4. Verify the MCP initializes over stdio and lists exactly the two tool names without making network calls.
5. Run `npm test`, the V2 contract suite, V1 source/snapshot validation, a credential-shape scan, `git diff --check`, and inspect Git status for caches/user data.
6. Commit with subject `feat: add secure read-only xunji connector` and write the detailed report to `.superpowers/sdd/task-2-report.md`, including RED/GREEN evidence and any environment limitation.

## Out of scope

- No real API smoke test.
- No write-back endpoint.
- No Keep integration, browser scraping, cloud database, or non-Windows credential adapter.
- No edits to `healthy-fitness-coach/` or Plugin manifest/packaging beyond what is strictly necessary for the MCP package root.
