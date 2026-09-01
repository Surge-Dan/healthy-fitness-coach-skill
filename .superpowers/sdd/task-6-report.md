# Task 6 报告：今日状态与最低任务引擎

## STATUS

GREEN。以有效起点 `be8ff9f` 为基准完成任务6；dist 中已有改动未触碰、未暂存。

## 变更

- 新增 `healthy-fitness-coach/references/readiness-engine.js`：消费标准化 `currentState` 与当前计划，按安全红旗优先输出 `stop`、`regress`、`proceed` 三种状态。
- 红旗覆盖顶层与嵌套 safety 数据；`stop` 不返回最低任务或可执行训练处方。
- 一般疼痛只切换到更耐受的动作变式，并要求 24～48 小时复评；不输出医学诊断。
- 单晚睡眠较差只临时降低强度，不推断过度训练；时间不足复用选中训练日的 `minimum_version`。
- 高疲劳仅减少组数这一项主要变量；正常状态按当前计划执行；未知训练日不会静默回退到第一天。
- 所有结果包含事实、原因码、调整、最低任务、停止条件与训练后记录字段。
- `training-guidance.js` 新增 `buildTodayReadinessGuidance` 适配入口；`exercise-coaching.md` 同步状态灯、最低版本和记录边界。
- 测试覆盖上述行为及完整结果契约，共 11 项。

## RED

命令：`node --test healthy-fitness-coach/tests/readiness-engine.test.js`

现状草稿首次运行：10 项中 7 pass、3 fail。失败均为预期行为缺失：嵌套 safety 红旗返回 `proceed`；数值 `4` 与中文“肩部紧”疼痛返回 `proceed`；未知 `session_id` 未返回 `session_not_found` 且错误回退首个训练日。

补充结果契约测试后再次运行：11 项中 8 pass、3 fail，失败原因不变，证明新增测试确实先经历 RED。

## GREEN

- `node --test healthy-fitness-coach/tests/readiness-engine.test.js`：11/11 pass。
- `node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`：144/144 pass。
- `git diff --check`：通过。

## 提交

- 代码提交：`b9a6c2e52ca3dcdb2cb2b4c8cab8a8007bc7cdee`（`feat: add today readiness engine`）。
- 报告随后单独精确暂存提交；dist 未纳入。

## 自审

- CommonJS、无外部依赖；本轮首版改动覆盖任务6的四个代码/文档文件。
- 红旗分支在所有普通训练判断之前；`stop.minimum_task === null`，且没有 `session` 或 `training_prescription` 字段。
- 降级分支均标记 `primary_variables_changed: 1`，没有把多个变量合并调整。
- 记录字段统一保留 `completed`、`rpe_or_rir`、`pain_or_aerobic_minutes`。
- guidance 入口复用 readiness engine，而不是复制判断逻辑。

## concerns

- 红旗、疼痛、睡眠和疲劳的文本/数值识别是保守启发式，不是医学评估；未知或症状恶化仍应停止相关训练并获得合适评估。
- 当前契约要求调用方传入已有计划的 `minimum_version`；若计划没有该字段，降级结果会明确返回 `minimum_task: null`，不会临时编造动作。
- dist 尚未重新打包，符合本任务“不可触碰 dist”的约束；发布包需由后续任务单独处理。

## 复审修订（C1/I1/I2/I3）

### STATUS

GREEN。针对 `task-6-review.md` 的 C1、I1、I2、I3 与适配器边界已完成修订。

### RED/GREEN 命令摘要

- RED：新增标准化后 `safety.red_flags`、顶层 `red_flags/redFlags`、普通 `symptoms`、高疲劳/睡眠差与时间组合、数字字符串及非法时间、适配器 symptoms 等测试；首轮 20 项中 14 项通过、6 项失败，均对应复审缺口。
- 修复后目标测试：`node --test healthy-fitness-coach/tests/readiness-engine.test.js`，20/20 pass。
- 全量回归：`node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`，153/153 pass。
- `git diff --check`：通过。

### 变更与自审

- `normalizeCurrentState` 保留经过白名单清洗的 `safety.red_flags`、`safety.redFlags`、顶层 `red_flags/redFlags` 与 `symptoms`，避免标准化后安全信息丢失；红旗文本扩展至现有安全筛查表达。
- `buildTodayReadinessGuidance` 将顶层 `pain`、`symptoms`、红旗别名和 `safety` 兼容映射到当前状态。
- 固定优先级为红旗 → 疼痛/不适 → 未知训练日 → 时间不足 → 高疲劳 → 单晚睡眠差；组合状态仍只声明一个主调整变量，时间不足明确复用 `minimum_version`。
- 可解析数字字符串（如 `'15'`、`'5'`）按数值处理；非法可用时间返回 `regress/current_state_unknown`，不会静默 `proceed`。
- 本轮代码提交：`3ab067f304676fd29cd8924647eb6a8668db4942`（`fix: close readiness safety and input boundaries`）；报告与代码仅精确暂存任务相关文件，dist 未触碰。

### concerns

- 为修复 C1，本轮必要地更新了 `references/athlete-state.js` 的 current-state 白名单与安全字段清洗；未改动其他非任务6逻辑。
- 安全字段只保留红旗及其 code，避免把未经审查的嵌套对象直接带入状态；复杂安全筛查仍应由上游标准化为红旗码。

## 最终复审修订：安全词、数组 symptoms 与疼痛时间组合

### STATUS

GREEN。补齐安全筛查文档列出的自然语言红旗，并明确疼痛优先组合下最低任务的基线语义。

### RED/GREEN 命令摘要

- RED：新增安全词、否定胸痛、数组 symptoms、疼痛+时间最低任务语义测试；24 项中 20 项通过、4 项失败，失败与复审缺口一致。
- GREEN：`node --test healthy-fitness-coach/tests/readiness-engine.test.js`，24/24 pass。
- 全量：`node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`，157/157 pass。
- `git diff --check`：通过。

### 变更与自审

- 红旗模式覆盖接近晕厥、大小便功能异常、明显畸形、无法负重、严重肿胀及对应英文表达；症状文本中的明确否定胸痛不会误判为红旗或疼痛。
- `symptoms` 支持字符串和数组，数组项逐一进入普通疼痛/不适分支，并保留 24～48 小时复评。
- 疼痛+时间不足仍固定只调整 `movement_variant`；`minimum_task_semantics` 明确最低任务是计划基线，不计作第二个调整变量。
- 本轮代码提交：`8ae4db12b50c3c181639dbafc06e9d7be3ce871d`（`fix: close readiness safety language boundaries`）；报告提交随后精确暂存，dist 未触碰。

### concerns

- 当前自然语言否定处理针对安全/疼痛整句的常见表达；复杂多句语义仍应由上游安全筛查标准化为红旗码。
