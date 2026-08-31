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

## 审查修复（I1、I2、M1）

### 修复内容

- I1：ID 15 的 prompt 现在明确给出年龄（28 岁）、每周训练天数（3 天）、单次训练时长（30 分钟）和动作限制（无），并把这些已知前提写入计划边界；该条仍为 `requires_follow_up: false`。
- I2：基线门禁现在递归枚举快照实际文件，要求其（除清单自身）与 manifest 路径集合完全一致，拒绝符号链接与清单外文件。它同时拒绝 API Key/secret/access token/private key 的疑似赋值内容、`.cache`、`.pytest_cache`、`node_modules`、`__pycache__`、个人报告目录/文件名，以及 PNG、JPEG、GIF、WebP、HEIC、HEIF、AVIF、TIFF 等照片格式。
- M1：上述实际文件枚举、路径拒绝与内容拒绝已由确定性校验覆盖；原报告对快照排除门禁的表述因此有对应实现证据。

### 修复 RED

命令：

```powershell
node quality-tests\run-training-os-baseline.js
```

输出摘要：失败，断言 `信息完整的新手计划必须给出年龄范围`；ID 15 的原 prompt 没有年龄输入。这是在新增完整输入与快照实际文件集门禁后、修复前得到的预期失败。

### 修复 GREEN

命令与输出摘要：

```powershell
node quality-tests\run-training-os-baseline.js
# PASS training-os baseline: 62 snapshot files; 12 legacy evals + 6 redesign evals

$env:PYTHONUTF8='1'; python "$env:USERPROFILE\.codex\skills\skill-creator\scripts\quick_validate.py" healthy-fitness-coach
# Skill is valid!

node quality-tests\run-training-system.js
# Training system quality gate passed (8 assets, routing and evidence markers verified).
```

### 修复提交哈希

- `3ed9b62` (`test: harden training baseline audit gates`)

## 二次复审修复（manifest 内容与前缀型 API Key）

### 修复内容

- 完整快照安全扫描现在使用递归得到的**全部**实际文件，明确包含 `snapshot-manifest.json`；每个实际文件都经过路径和内容拒绝，再以“实际文件（不含 manifest 本身）= manifest.files”验证可审计清单。
- 秘密标识符检测不再依赖 `\bapi` 的左侧词边界，支持 `OPENAI_API_KEY=...`、其他大写前缀加下划线的 API Key/secret/access token/private key 变量名。
- 新增负向断言：将 `OPENAI_API_KEY=sk-example-12345678` 作为 manifest 内容传给安全断言，必须被拒绝；因此前缀变量识别与 manifest 内容扫描都由同一确定性门禁覆盖。

### 修复 RED

命令：

```powershell
node quality-tests\run-training-os-baseline.js
```

输出摘要：失败，`Missing expected exception: 秘密门禁必须拒绝 manifest 中的前缀型 API Key 环境变量`。这复现了旧 `\b` 词边界无法命中 `OPENAI_API_KEY` 的缺口。

### 修复 GREEN

命令：

```powershell
node quality-tests\run-training-os-baseline.js
```

输出摘要：`PASS training-os baseline: 62 snapshot files; 12 legacy evals + 6 redesign evals`。

### 修复提交哈希

- `02c0331` (`test: scan baseline manifest for secrets`)
