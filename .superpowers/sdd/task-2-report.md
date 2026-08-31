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

## 独立审查修复（34db393 后）

### 变更

- `hasRedFlag` 现统一读取顶层、`safety`、`currentState` 及 `currentState.safety` 的 `red_flags` / `redFlags`，并继续过滤空/`false` 条目。
- 红旗文本识别补齐异常心悸、近期手术、急性外伤、妊娠和产后等现有安全筛查条件。
- 训练计划指令补齐“给我制定一个增肌计划”“帮我做 8 周力量方案”“安排下周训练”等明确意图；普通“增肌训练有哪些基本原则？”仍为知识问答。

### RED 证据

命令：

```powershell
node --test healthy-fitness-coach/tests/training-orchestrator.test.js
```

摘要：退出码 `1`，新增嵌套 `safety.red_flags` 用例错误返回 `training_plan`（期望 `safety_routing`）；新增计划意图用例错误返回 `knowledge_question`（期望 `training_plan`）。

### GREEN 证据

命令：

```powershell
node --test healthy-fitness-coach/tests/training-orchestrator.test.js
```

摘要：`12` 个子测试全部通过，`0` 失败。嵌套红旗覆盖计划、显式报告和分享三条最终决策路径，且三类明确计划请求与知识问答反例均通过。

### 提交与自审

- 本次将仅提交 `training-orchestrator.js`、`training-orchestrator.test.js` 和本报告；不包含 `dist/` 的现存改动。
- 已保留纯函数/CommonJS 约束；嵌套来源按固定顺序扁平化，决策仍无 I/O 或外部依赖。

## 解释型计划问句修复（3443674 后）

### 变更

- 在红旗和显式 `taskType` 判定之后、训练意图匹配之前，识别“训练计划怎么制定”“训练计划包含哪些内容”等解释型问句并路由到 `knowledge_question`。
- 保留“给我制定训练计划”等直接交付请求的 `training_plan` 路由。

### RED 证据

命令：

```powershell
node --test healthy-fitness-coach/tests/training-orchestrator.test.js
```

摘要：退出码 `1`；新增“训练计划怎么制定？”用例实际得到 `training_plan`，期望 `knowledge_question`，证明该边界在修复前未覆盖。

### GREEN 证据

命令：

```powershell
node --test healthy-fitness-coach/tests/training-orchestrator.test.js
```

摘要：`13` 个子测试全部通过，`0` 失败。两种解释型问句均无必填画像、无缺口、无资产；直接“给我制定训练计划”仍进入计划路由。

### 提交与自审

- 本次只提交编排实现、回归测试和本报告；不包含 `dist/` 的现存改动。
- 红旗和显式 `taskType` 优先级保持在解释型问句之前，未改变安全覆盖语义。
