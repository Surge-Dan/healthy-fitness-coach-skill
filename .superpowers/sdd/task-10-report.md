# Task 10：同步独立 Skill 与 Plugin 副本

## STATUS

GREEN。基于起点提交 `f50e8a4` 完成 canonical Skill 到 Plugin 的同步，并保留 Plugin 专属 MCP、凭据、缓存和安装/运行脚本。

## 同步范围

- 同步 `SKILL.md`、`agents/openai.yaml`、`evals/evals.json`、全部 `assets/` 与 `references/`（共 53 个 Skill 文件；评测 ID 1–18）。
- 同步 canonical `scripts/` 的 6 个 CLI 脚本到 Plugin `scripts/`；Node 脚本只保留 Plugin 必需的 `skills/healthy-fitness-coach/references` 相对导入路径。
- 保留 Plugin 专属 `mcp/`、`.mcp.json`、凭据/缓存脚本、`setup-xunji.ps1` 和脚本说明；不复制 workspace、dist 或用户数据。
- 更新 `healthy-fitness-coach-plugin/scripts/README.md`，补充 review-first 训练 DNA CLI 及 `--legacy-raw` 边界。

## RED / GREEN

- RED：新增 `quality-tests/run-plugin-sync.js`，首次运行在 Plugin `SKILL.md` 哈希不一致处失败；加入 Agent 与 eval 一致性断言后分别在 `agents/openai.yaml`、`evals/evals.json` 正确失败。
- GREEN：完成同步后通过逐文件 SHA-256、路径引用检查、独立复制后全部 references 加载和 Plugin CLI 路径烟雾测试。
- GREEN：将 `evals/evals.json` 纳入逐文件 SHA-256 门禁，并在独立复制后的 Plugin 根目录运行 review-first DNA CLI smoke（版本化输出与 decision ledger）。
- MCP 回归首轮 69/70：同步后的 summary 正确将无 source 且跨日期复用同一 ID 的夹具标为 `partial`；夹具补齐 `source:xunji` 并使用日期唯一 ID 后全套 70/70 通过。

## 验证

- `node quality-tests/run-plugin-sync.js`：通过，53 个 Skill 文件、6 个 CLI 脚本、独立复制路径烟雾测试和 DNA CLI smoke。
- Plugin CLI：`compile-visual-brief.js --list-recipes` 返回 12 个配方；`render-visual-assets.js --list-modes` 返回模式组。
- `npm test`（`healthy-fitness-coach-plugin/mcp/xunji`）：70/70 通过。
- `node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`：193/193 通过。
- `node quality-tests/run-training-system.js`、`run-visual-system.js`、`run-knowledge-base.js`：全部通过。
- `git diff --check`：通过。

## CONCERNS

- Plugin CLI 的 Node 脚本位于 Plugin 根 `scripts/`，因此其相对导入路径与 canonical 根脚本不同；一致性门禁会先按 canonical 内容替换该路径后再比较，避免复制后运行失败。
- `dist/healthy-fitness-coach.skill` 的既有修改和未跟踪 `dist/healthy-fitness-coach.zip` 未触碰、未暂存。
