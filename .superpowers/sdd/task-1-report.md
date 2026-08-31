# Task 1 实施报告：改造前基线

## STATUS

COMPLETE

## 变更

- 新建 `healthy-fitness-coach-workspace/training-os-redesign/skill-snapshot/`：以起点提交 `180549f30a7579d5f4c2733ee662f64229531e78` 为来源，保存 62 个受版本控制的旧版 Skill 文件。
- 快照清单 `snapshot-manifest.json` 为每个文件记录 SHA-256；确定性校验逐文件对照起点 Git blob。
- 快照排除 `fitness-reports/`、缓存目录/`.pyc` 与图片文件；不含 API Key、缓存、个人报告或用户照片。
- 保留 `healthy-fitness-coach/evals/evals.json` 原有 12 条评测，追加 ID 13–18 的六条差异化评测：术语解释、信息缺口追问、信息完整直接建档、已有档案的今日状态、四周复盘决策记录、单次记录的低置信度训练 DNA。
- 新增 `quality-tests/run-training-os-baseline.js`，确定性验证评测数量/字段/追问边界、快照排除规则、哈希和旧版 Git 内容。

## RED

命令：

```powershell
node quality-tests\run-training-os-baseline.js
```

输出摘要：失败，断言 `评测总数必须是保留的12条加6条训练操作系统差异评测`；实际为 12，预期为 18。该失败发生在追加评测与创建快照之前。

## GREEN

命令与输出摘要：

```powershell
node quality-tests\run-training-os-baseline.js
# PASS training-os baseline: 62 snapshot files; 12 legacy evals + 6 redesign evals

$env:PYTHONUTF8='1'; python "$env:USERPROFILE\.codex\skills\skill-creator\scripts\quick_validate.py" healthy-fitness-coach
# Skill is valid!

node quality-tests\run-training-system.js
# Training system quality gate passed (8 assets, routing and evidence markers verified).
```

## 提交哈希

- 实现提交：`018013c` (`test: add training operating system baseline`)

## 自审

- 旧 12 条评测由快照与主评测前 12 项的结构化深比较锁定，新增项只能追加为 ID 13–18。
- 六项均具备 `expected_assets`、`content_boundaries`、`prohibited_behaviors` 和 `requires_follow_up`；覆盖“应追问”和“不应追问”。
- 快照校验会逐文件验证 SHA-256 和起点提交内容，防止后续工作意外改写比较基线。
- `dist/healthy-fitness-coach.skill` 与 `dist/healthy-fitness-coach.zip` 未被暂存或提交。

## concerns

- `git diff --cached --check` 对快照内两个起点文件报告 EOF 空白行：`references/visual-prompt-compiler.js`、`tests/visual-dna.test.js`。它们是旧版 blob 的既有字节；为保持快照可审计且逐字节等同起点，未作修改。
