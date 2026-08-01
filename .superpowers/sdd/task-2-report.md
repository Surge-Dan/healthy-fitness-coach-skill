# Task 2: Secure read-only Xunji MCP connector

## Status

Implemented `healthy-fitness-coach-plugin/mcp/xunji/` as a Node 18 CommonJS package. It exposes only `xunji_get_training_day` and `xunji_get_training_range` over MCP stdio. No Skill behavior-layer files or manifest files were changed.

## Security design

- Credentials are created interactively with `Read-Host -AsSecureString`, encrypted with Windows DPAPI (`ConvertFrom-SecureString`), and stored below `%LOCALAPPDATA%\HealthyFitnessCoach\credentials\`.
- The Node reader invokes narrowly scoped non-interactive PowerShell and keeps the decrypted value only in process memory. It never accepts command-line or environment credential values and never logs request headers.
- Cache paths use a SHA-256 one-way credential fingerprint; writes are schema-validated and atomic. Cache, logs, and tool results exclude credential values.
- Production requests are fixed POSTs to the documented endpoint with a body containing only `datestr`; all HTTP tests inject a localhost server and clearly fake credential values. No real endpoint, credential store, or training data was read or used.
- Garmin-tagged records are removed before model-facing output. Unknown sources remain with a warning.

## TDD evidence

The pre-existing V2 contract baseline was 1 pass / 11 fail: the V1 safety check passed while Task 2 connector and Task 3 routing modules were absent. Focused connector tests were added first and observed module-missing RED. Subsequent RED/GREEN slices covered parser behavior, DPAPI script shape, cache atomicity, localhost HTTP/gzip/auth/rate/non-JSON/timeout/success-false cases, same-date promise merging, refresh fallback, and MCP tool registration.

Final connector package suite: 17 pass / 0 fail. The V2 contract suite is 9 pass / 3 fail; all eight connector contracts are GREEN, while the three intentional Task 3 `output-routing.js` contracts remain RED.

## Verification

- `npm test` in the connector package: 17/17 passed.
- MCP stdio initialize then `tools/list`: passed; listed exactly the two read-only tool names and made no tool/network call.
- `tests/verify_v1_snapshot.ps1` and `tests/validate_skill.ps1`: passed.
- Credential-shape scan and `git diff --check`: clean.
- SDK 1.30.0 and stdio modules load on Node 18.19.0. An exact npm override pins transitive `@hono/node-server` to 1.19.17, avoiding the Node 20 engine warning produced by the semver-resolved 2.x version.

## Residual review item

`npm audit --omit=dev` reports GHSA-frvp-7c67-39w9 (moderate, CVSS 5.9): Windows encoded-backslash traversal in Hono `serve-static`, affecting `@hono/node-server <2.0.5` through the SDK. The connector uses stdio only; its stdio imports did not load Hono and it does not start Hono/static HTTP serving. A fixed Hono 2.x release requires Node 20, so no compatible non-breaking Node 18 override removes the advisory. No `npm audit fix` was run.
