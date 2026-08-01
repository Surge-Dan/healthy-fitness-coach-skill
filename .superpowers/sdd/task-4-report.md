# Task 4 — Plugin assembly, validation, and packaging

## Result

`healthy-fitness-coach-plugin/` is a local, validation-ready Codex Plugin. It contains the V2 Skill byte-for-byte under `skills/healthy-fitness-coach/`, the read-only Xunji stdio MCP, concise Windows/privacy instructions, and no marketplace mutation.

## Scaffold and assembly

The official scaffold baseline was recreated in the ignored local directory with the same command used for this task:

```powershell
python %USERPROFILE%\.codex\skills\.system\plugin-creator\scripts\create_basic_plugin.py healthy-fitness-coach-plugin --path %USERPROFILE%\Documents\健身Skill\tmp\plugin-scaffold --with-skills --with-mcp --with-scripts --with-assets --force
```

The source Skill was deterministically copied into the Plugin. The first copy was intentionally caught by validation because PowerShell flattened it into `skills/`; the content was then moved to the required `skills/healthy-fitness-coach/` directory and the clean dist copy was mirrored from that corrected source.

## RED → GREEN evidence

1. Added `tests/validate_plugin.ps1` and `tests/plugin-stdio-handshake.js` before creating the final manifest/config/Skill copy.
2. RED: `powershell -NoProfile -File tests\validate_plugin.ps1 -SkipStdio` exited 1; the official validator reported `missing .codex-plugin/plugin.json`, which is the intended pre-assembly failure.
3. First GREEN attempt caught the flattened Skill layout (`skill agents/assets/evals/references is missing SKILL.md`) and an MCP handshake timeout. Correcting the nested copy fixed both causes.
4. GREEN: `tests/validate_plugin.ps1` passes official schema validation, declared stdio initialize/tools-list, source/Plugin Skill SHA-256 parity, privacy/path checks, README boundaries, and source-to-dist parity.

## Portability follow-up

The validator test originally defaulted `-PluginValidator` to a machine-specific user path. A focused static RED test rejected that default. GREEN keeps the optional override but resolves the default from `$env:CODEX_HOME` when present, otherwise from the current Windows user profile plus `.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`; it validates that resolved file and gives an actionable override/install error when absent. Static coverage now rejects machine-absolute user paths in validation tooling, Plugin source, and dist. This test-only portability fix does not change either packaged artifact or the hashes below.

## Validation executed

```powershell
$env:PYTHONIOENCODING='utf-8'; $env:PYTHONUTF8='1'
python %USERPROFILE%\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py healthy-fitness-coach-plugin
python %USERPROFILE%\.codex\skills\skill-creator\scripts\quick_validate.py healthy-fitness-coach
python %USERPROFILE%\.codex\skills\skill-creator\scripts\quick_validate.py healthy-fitness-coach-plugin\skills\healthy-fitness-coach
powershell -NoProfile -ExecutionPolicy Bypass -File tests\validate_plugin.ps1
node --test tests\v2-contracts.test.js
npm --prefix healthy-fitness-coach-plugin\mcp\xunji test
powershell -NoProfile -ExecutionPolicy Bypass -File tests\verify_v1_snapshot.ps1
```

Results: official Plugin validator pass; both Skill validators pass; Plugin stdio lists exactly `xunji_get_training_day` and `xunji_get_training_range`; V2 contracts 19/19; connector tests 29/29; frozen V1 snapshot pass. The archive was also read directly and hash-compared with the canonical Skill: 20 files match exactly, with only root `evals/` excluded by the official packager. `git diff --check` passes.

## Artifacts

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `dist/healthy-fitness-coach.skill` | 38,833 bytes | `A0F04CE0CE72DF1EE4258001E57BE9852FE7C3485F9867A2E21D92AE0A361ACD` |
| `dist/healthy-fitness-coach-plugin/` | 44 files / 162,719 bytes | source hash parity verified |
| Plugin manifest | 838 bytes | `AC45AE22A48ED4C4F8150CBA894CFEE2009BC411B9B409F3511AA8538BE0C2F1` |
| MCP config | 149 bytes | `B2041006F46C488EDCAD8F189BA77EE6C0660413B8A56BE655BEB0001FDED58E` |

The standalone archive was produced with the required official module command:

```powershell
$env:PYTHONIOENCODING='utf-8'; $env:PYTHONUTF8='1'
Set-Location %USERPROFILE%\.codex\skills\skill-creator
python -m scripts.package_skill %USERPROFILE%\Documents\健身Skill\healthy-fitness-coach %USERPROFILE%\Documents\健身Skill\dist
```

`PYTHONUTF8=1` is additionally required on this Windows host because the official packager calls `Path.read_text()` without an explicit encoding and otherwise inherits the GBK default.

## Exclusions and boundaries

- `node_modules` is installed only locally with `npm ci --omit=dev --ignore-scripts`, is ignored/untracked, and is explicitly excluded from `dist`.
- No credentials, DPAPI payloads, caches, personal reports, or real training records were created, read, or packaged.
- No real Xunji endpoint was called. The only runtime protocol check was stdio `initialize` plus `tools/list`.
- No global marketplace or install state was changed.
- Credential/cache deletion helpers were not executed; their absolute-path, strict-child, literal-path, and `ShouldProcess` guards were statically verified.

## Residual risk

The Node 18 dependency tree retains the known Hono static-server advisory. The Plugin starts only MCP stdio and does not create a Hono HTTP/static server, so the advisory path is not exposed by this Plugin. Keep it disclosed and plan a Node 20 migration plus dependency audit in a future release.
