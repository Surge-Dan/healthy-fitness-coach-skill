# Task 2 实施报告：统一任务编排层

## STATUS

COMPLETE

## 变更

- 新增 `healthy-fitness-coach/references/training-orchestrator.js`：提供纯函数 `classifyTrainingTask`、`requiredFieldsForTask`、`evaluateInformationState` 和 `buildWorkflowDecision`。
- 固定红旗优先级，并将复盘、训练系统、训记分析映射到既有 `output-routing.js` 的 Markdown 任务约定；显式输出命令继续生效，但不能越过安全路由。
- 新增 `healthy-fitness-coach/references/training-orchestration.md`：记录优先级、决策契约、信息状态与字段边界。
- 新增 `healthy-fitness-coach/tests/training-orchestrator.test.js`：覆盖八类任务、红旗覆盖、知识问答无追问/无文件、完整计划不重复询问、结构性缺口、执行假设和显式命令。
- 未改动 `dist/`；其现存改动未纳入本任务。

## RED 证据

命令：

```powershell
node --test healthy-fitness-coach/tests/training-orchestrator.test.js
```

摘要：退出码 `1`，Node 报 `Cannot find module '../references/training-orchestrator.js'`；失败原因是目标实现尚不存在，符合新增行为的 RED 阶段。

审查修复 RED：同一命令在新增“建立训练DNA”与空红旗回归测试后，先后如预期断言失败：前者实际为 `xunji_analysis`（期望 `training_system`），后者实际为 `safety_routing`（期望 `training_plan`）。

## GREEN 证据

目标测试命令：

```powershell
node --test healthy-fitness-coach/tests/training-orchestrator.test.js
```

摘要：初次实现的 `7` 个子测试全部通过，`0` 失败；审查修复后的最终目标测试见下一项。

全量测试命令：

```powershell
node --test healthy-fitness-coach/tests
```

摘要：最终目标测试为 `10` 个子测试全部通过，`0` 失败；全量为 `83` 个测试全部通过，`0` 失败，耗时约 `11.8s`。

## 提交

提交消息：`feat: add training task orchestrator`。提交只包含本报告、编排实现、编排说明和对应测试。

## 自审

- `git diff --check` 无输出，未发现空白错误。
- CommonJS，无外部依赖、I/O 或时间/随机性；所有返回值仅由输入决定。
- 所有决策均含 `task_type`、`interaction_mode`、`required_fields`、`missing_fields`、`information_state`、`artifact_mode`、`artifacts`、`reason_codes`。
- `today_workout` 不强制收集画像字段；缺少执行上下文时以 `assume` 明示安全执行假设。
- 独立审查发现并已修复“建立训练DNA”与训记分析关键词冲突；并补充了最终安全覆盖路径和空红旗数组的回归测试。

## concerns

- 本层返回的是资产计划而不是文件写入结果；实际创建 Markdown、HTML 或 PNG 仍由后续执行层负责。
- 红旗正则只负责确定性路由，不能替代完整的健康风险评估或医疗诊断。
