# 统一训练任务编排

`training-orchestrator.js` 是一个无副作用的 CommonJS 决策层。它只返回工作流决策，不读取文件、不调用工具，也不创建交付物。

## 优先级

1. 红旗或即时安全信号：固定路由到 `safety_routing`；它覆盖显式报告、图片分享和训练计划。
2. 显式 `taskType` / `task_type`：在没有红旗时直接使用支持的任务类型。
3. 用户指令中的训练、数据或分享意图：识别计划、今日训练、复盘、训练系统、训记分析和分享输出。
4. 其余输入：`knowledge_question`。

## 决策契约

`buildWorkflowDecision(input)` 始终返回：

```js
{
  task_type,
  interaction_mode,
  required_fields,
  missing_fields,
  information_state, // ready | ask | assume
  artifact_mode,
  artifacts,
  reason_codes
}
```

`interaction_mode` 复用 `output-routing.js`：对话、Markdown 和 dashboard 的显式命令仍然有效；只有安全路由不可被覆盖。`artifact_mode` 是计划中的交付物类型，不代表文件已经写入。

## 信息状态

| 任务 | 必要信息 | 缺失时行为 |
| --- | --- | --- |
| `knowledge_question`、`safety_routing` | 无 | `ready`；安全任务先给出即时分流 |
| `training_plan`、`training_system` | 目标、经验、每周天数、器械、伤病/医疗约束 | `ask`，仅列会改变安全或方案结构的字段 |
| `training_review`、`xunji_analysis` | `records` | `ask` |
| `today_workout` | 无强制结构字段 | 缺少执行上下文时 `assume`，并记录安全执行假设 |
| `share_output` | `source_assets` | `ask` |

训练计划和系统会从已给出的 `profile`、`currentState` 和 `records` 合并检查，已提供的信息不会重复提问。简单知识问题不产生画像缺口或文件资产。
