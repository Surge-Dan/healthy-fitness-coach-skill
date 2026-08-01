# 输出路由

先按 `output-routing.js` 的 `routeOutput({ taskType, userInstruction })` 确定输出。它返回且只返回 `{ mode, reason, override }`，用于让默认行为和显式命令可审计。

| 任务 | 默认模式 |
| --- | --- |
| `today_workout`、`set_by_set_coaching`、动作/姿势调整、即时症状或安全分流 | conversation |
| `training_plan`、`weekly_review`、`monthly_review`、`training_data_analysis`、可复用计划/报告/档案 | markdown |

去除合理的空格和标点后，`直接出报告` / `direct report` 强制 Markdown，`进入跟练` / `enter tracking` 强制对话，`保存刚才内容` / `save prior content` 强制 Markdown。不要把包含“直接性”“报告”等无关表述误判为命令；罕见的多命令同句按 `直接出报告`、`进入跟练`、`保存刚才内容` 的固定优先级执行。

命令自身被否定时不触发覆盖，例如“不要进入跟练”或 “don't enter tracking”仍按任务默认模式路由。只拒绝紧邻该命令的否定上下文：同一句后续出现的独立、肯定命令仍可生效。

Markdown 模式下，若有写入工具，在当前工作区创建完整、可读的 `.md` 文件。使用简短安全的文件名（如 `fitness-weekly-review-2026-08-01.md`）；若同名文件存在，追加日期时间或数字后缀，绝不覆盖无关文件。若没有写入工具，在对话中返回完整 Markdown，并明确说明“未创建文件”。

默认不要用弹窗、模态问题或“请选择模式”打断用户。只有用户明确要求选择模式，或安全地无法判断所需产物时，才提一个最小澄清问题。安全分流始终优先于本路由。
