# 输出路由

先按 `output-routing.js` 的 `routeOutput({ taskType, userInstruction })` 确定输出。它返回且只返回 `{ mode, reason, override }`，用于让默认行为和显式命令可审计。

| 任务 | 默认模式 |
| --- | --- |
| `today_workout`、`set_by_set_coaching`、动作/姿势调整、即时症状或安全分流 | conversation |
| `training_plan`、`weekly_review`、`monthly_review`、`training_data_analysis`、可复用计划/报告/档案 | markdown |

去除合理的空格和标点后，`直接出报告` / `direct report` 强制 Markdown，`进入跟练` / `enter tracking` 强制对话，`保存刚才内容` / `save prior content` 强制 Markdown。不要把包含“直接性”“报告”等无关表述误判为命令；罕见的多命令同句按 `直接出报告`、`进入跟练`、`保存刚才内容` 的固定优先级执行。

覆盖命令采用保守的正向白名单，而非否定词表。先规范化 Unicode 撇号、连字符、标点和空格；再按强标点，以及 `但/但是/不过/然后/之后/接着/随后/后来/现在`、`then/but/however` 分成独立分句。每个分句只剥离批准的礼貌/肯定前缀（如“请/帮我/麻烦/我要/我想/现在/那就/还是”或 `please/i want/let's/then/now`）和礼貌后缀，然后必须完整等于一条批准命令才覆盖。问句（包括无问号的 `can/could/do you` 开头）、否定句、描述性句子或有任何剩余词的分句均不覆盖；后续独立的肯定命令仍可生效。

Markdown 模式下，若有写入工具，默认在当前工作区的 `fitness-reports/` 创建完整、可读的 `.md` 文件。使用简短、非 PII 的文件名（如 `fitness-weekly-review.md`）；若同名文件存在，追加数字后缀，绝不覆盖无关文件。用户明确给出安全目标位置时才可覆盖默认目录。`report-artifact.js` 的 `recommendReportArtifactPath` 提供默认目录和碰撞后缀的确定性建议。若没有写入工具，在对话中返回完整 Markdown，并明确说明“未创建文件”。

默认不要用弹窗、模态问题或“请选择模式”打断用户。只有用户明确要求选择模式，或安全地无法判断所需产物时，才提一个最小澄清问题。安全分流始终优先于本路由。
