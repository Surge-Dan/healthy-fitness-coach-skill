# Task 4: Assemble, validate, and package the Codex Plugin

## Goal

Turn the approved Skill V2 and read-only Xunji MCP into a validation-ready local Codex Plugin plus updated standalone `.skill` artifact. Provide short Windows install, credential setup, privacy, cache, and deletion instructions. Do not install it into the user's global marketplace in this task.

## Official scaffold and manifest

- The controller already ran the official `plugin-creator` scaffold generator in ignored `tmp/plugin-scaffold/healthy-fitness-coach-plugin` with `--with-skills --with-mcp --with-scripts --with-assets`. Use that generated structure as the baseline; do not invent unsupported manifest fields.
- Final root: `healthy-fitness-coach-plugin/` with `.codex-plugin/plugin.json`, `.mcp.json`, `skills/healthy-fitness-coach/`, existing `mcp/xunji/`, `scripts/`, and `README.md`.
- Manifest name: `healthy-fitness-coach-plugin`; strict semver `0.2.0`; real author name `梅乃丹`; no fabricated email, repository, homepage, privacy URL, or terms URL.
- Required interface metadata: Chinese display/short/long descriptions, developer name, a truthful Health/Fitness category, non-empty capabilities, and one concise default prompt. Keep capabilities limited to implemented behavior.
- `skills` points to `./skills/`; `mcpServers` points to `./.mcp.json`. Do not declare hooks/apps/assets that do not exist or optional WebSearch/browser/Xiaohongshu connectors as bundled capabilities.

## MCP configuration

- `.mcp.json` contains exactly one server entry for the local Xunji connector.
- Use `command: node`, `cwd: ./mcp/xunji`, and a relative arg for `src/server.js`; no machine-absolute paths, secrets, environment credential injection, shell wrappers, HTTP listener, or write tools.
- Validate by launching from the Plugin root using the declared cwd/command/args and performing initialize + tools/list. It must return exactly the two read-only Xunji tool names.
- Runtime dependencies are installed explicitly with `npm ci --omit=dev --ignore-scripts` under `mcp/xunji`; do not bundle `node_modules` in source or dist.

## Skill copy and reproducibility

- Copy the complete current `healthy-fitness-coach/` into `healthy-fitness-coach-plugin/skills/healthy-fitness-coach/`.
- Add a deterministic validation/build script or PowerShell test that compares relative file lists and SHA-256 hashes, so Plugin Skill drift fails validation.
- Plugin Skill must retain `name: healthy-fitness-coach` and pass the same Skill validator.
- The source Skill remains canonical. Do not edit only the Plugin copy.

## Installation, privacy, and deletion

`README.md` must state, concisely:

1. Supported platform: Windows, Node.js 18.14.1+; Node 18 uses the committed Hono 1.19.17 override.
2. Run the dependency install command/script from the Plugin root.
3. Install/add the local Plugin using the current Codex local-plugin workflow only if verified on this machine; otherwise label the exact local-marketplace step as product-version dependent and tell the user to use Codex's local Plugin UI/command.
4. Run the interactive DPAPI credential script locally. Explicitly say never paste a key into chat.
5. Restart/refresh Codex and test with “分析训记最近四周训练”.
6. Data stays under `%LOCALAPPDATA%\HealthyFitnessCoach\`; cache is date-scoped; MCP is read-only; Garmin-marked records are filtered; no cloud database is added.
7. How to delete encrypted credential only, cache only, or both.
8. The known Hono static-server advisory is present in the Node 18 dependency tree but the Plugin starts only MCP stdio and never creates Hono HTTP/static serving. Recommend Node 20 migration in a future release rather than hiding the residual audit item.

Add safe deletion helpers only if needed:

- Resolve `%LOCALAPPDATA%\HealthyFitnessCoach` to an absolute path and verify every deletion target is a strict child before deleting.
- Use PowerShell `SupportsShouldProcess`/confirmation semantics for recursive cache deletion; do not use unresolved env/glob targets.
- Never execute deletion helpers during tests; tests inspect behavior/path guards with temporary roots or static assertions.

## Tests first

Before creating the manifest/copy, add `tests/validate_plugin.ps1` and/or Node tests that initially fail for the missing manifest/config/Skill copy. They must validate:

- Official Plugin validator succeeds (`plugin-creator/scripts/validate_plugin.py`).
- JSON schema/required fields/strict semver; no unsupported or fake fields.
- Exactly one MCP server and its declared runtime resolves inside Plugin root.
- Plugin stdio lists exactly two tools.
- Plugin Skill and canonical Skill file lists/hashes are identical.
- No API keys, absolute user paths, `node_modules`, caches, personal reports, or real training data are included.
- README contains install, DPAPI, privacy, deletion, read-only, Garmin, and residual-advisory boundaries.
- Dist contents equal the validated source Plugin, excluding only intentional build metadata if documented.

## Packaging

- Use the official Skill packager from `C:\Users\Daniel\.codex\skills\skill-creator` with `PYTHONIOENCODING=utf-8` and `python -m scripts.package_skill <skill-root> <dist-root>` to replace `dist/healthy-fitness-coach.skill`.
- Create `dist/healthy-fitness-coach-plugin/` as a clean copy of the validated Plugin source, excluding `node_modules`, coverage/temp files, caches, credentials, and user reports.
- Optionally create a ZIP only if tests verify it; the required deliverable is the dist directory.
- Validate package archive contents against source (not just successful command exit).

## Verification and commit

- Run Task 4 focused RED/GREEN, official Plugin validator, `tests/validate_plugin.ps1`, Skill validator, V2 19 tests, connector 29 tests, real stdio handshake from `.mcp.json`, V1 snapshot validation, secret/path scan, dist parity, and `git diff --check`.
- Do not call the real Xunji API or access any user credential store.
- Commit with subject `feat: package fitness coach plugin` and write `.superpowers/sdd/task-4-report.md` with scaffold command, RED/GREEN evidence, validation commands, artifact hashes/sizes, exclusions, and residual risk.

## Out of scope

- Global Plugin installation/marketplace mutation.
- Real Xunji smoke test.
- Task 5 paired Skill evaluations or description optimization.
- Keep API, browser connector, Xiaohongshu crawler, write-back, cloud storage.
