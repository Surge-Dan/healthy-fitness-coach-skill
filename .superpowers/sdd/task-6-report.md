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

- CommonJS、无外部依赖；只改任务6的四个代码/文档文件。
- 红旗分支在所有普通训练判断之前；`stop.minimum_task === null`，且没有 `session` 或 `training_prescription` 字段。
- 降级分支均标记 `primary_variables_changed: 1`，没有把多个变量合并调整。
- 记录字段统一保留 `completed`、`rpe_or_rir`、`pain_or_aerobic_minutes`。
- guidance 入口复用 readiness engine，而不是复制判断逻辑。

## concerns

- 红旗、疼痛、睡眠和疲劳的文本/数值识别是保守启发式，不是医学评估；未知或症状恶化仍应停止相关训练并获得合适评估。
- 当前契约要求调用方传入已有计划的 `minimum_version`；若计划没有该字段，降级结果会明确返回 `minimum_task: null`，不会临时编造动作。
- dist 尚未重新打包，符合本任务“不可触碰 dist”的约束；发布包需由后续任务单独处理。
