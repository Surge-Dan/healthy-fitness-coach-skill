# 输出路由

先按 `output-routing.js` 的 `routeOutput({ taskType, userInstruction })` 确定输出。返回值始终是 `{ mode, reason, override }`，便于审计默认行为和显式命令。

再调用 `planOutputAssets({ taskType, userInstruction, outputDirectory, existingPaths })` 取得确定性的资产计划。它只返回计划，不写入文件；返回的 `artifacts` 是交付物文件名，`paths` 是不会覆盖现有文件的候选路径。多文件计划还会以 `index` 指明索引文件，避免用户自行猜测资产关系。

| 模式 | 适用场景 |
| --- | --- |
| `conversation` | 今日训练、逐组跟练、动作/姿势调整、即时症状或安全分流 |
| `markdown` | 周期计划、周/月复盘、结构化分析、可复用报告 |
| `dashboard` | 用户要求读取训记范围并生成趋势面板 |

## 长期训练资产

当用户要“建立训练系统”“提炼训练DNA”“生成下一周期并保留决策记录”时，仍以 Markdown 为主，但可以一次交付一组互相关联的本地文件，而不是把所有内容塞进一份长报告。默认资产为 `ATHLETE_PROFILE.md`、`TRAINING_DNA.md`、`CURRENT_PROGRAM.md`、`DECISION_LOG.md`；动作库、流水账和周复盘按需追加。每个资产必须保留数据范围、生成日期、事实/推断边界和下一次更新条件，便于后续增量更新与审计。

连接训记时，优先调用只读的 `xunji_extract_training_dna` 获取复盘 facts + decision，再消费八维DNA、证据台账、未知项和版本变更；它只在本机按账号fingerprint保存DNA状态，不向训记写回任何分析结论。不得让原始训练行直接成为默认DNA证据。

显式命令包括：

- `直接出报告` / `direct report`：强制 Markdown；
- `进入跟练` / `enter tracking`：强制对话；
- `生成趋势面板` / `查看训练趋势` / `dashboard`：强制趋势面板；复合中文指令可以先说明数据范围，再用逗号连接该命令（例如“分析最近4周训记，生成趋势面板”）。只有明确的命令 clause 才会触发，普通“趋势面板是什么意思？”仍按知识问题处理；
- `保存刚才内容` / `save prior content`：将刚才内容保存为 Markdown。

用户没有明确要求时沿用任务默认模式。只有多个产物都合理且需要用户选择时，才用一条简短对话提供三种模式，不阻断安全分流。

## 训练任务资产契约

| `taskType` | 默认模式 | 资产计划 |
| --- | --- | --- |
| `knowledge_question`、`safety_routing` | `conversation` | 无文件；安全分流不能被显式命令覆盖 |
| `training_plan` | `markdown` | `ATHLETE_PROFILE.md`、`CURRENT_PROGRAM.md`；索引为 `TRAINING_PLAN_INDEX.md` |
| `today_workout` | `conversation` | 仅在“保存刚才内容”时生成 `TODAY_WORKOUT.md` |
| `training_review` | `markdown` | `WEEKLY_REVIEW.md`、`DECISION_LOG.md`；索引为 `TRAINING_REVIEW_INDEX.md` |
| `training_system` | `markdown` | 四个核心资产：`ATHLETE_PROFILE.md`、`TRAINING_DNA.md`、`CURRENT_PROGRAM.md`、`DECISION_LOG.md`；索引为 `TRAINING_SYSTEM_INDEX.md` |
| `xunji_analysis` | `markdown` | `TRAINING_ANALYSIS.md`；显式趋势面板时追加 `training-dashboard.html` 并使用 `XUNJI_ANALYSIS_INDEX.md` |
| `share_output` | `conversation` | `SHARE_CARD.png`、`SHARE_FACTS.md`；索引为 `SHARE_OUTPUT_INDEX.md` |

任一计划最终包含两个或以上资产时，`index` 必定存在且其路径位于 `paths` 首位。索引可复用 `assets/training-system-index-template.md` 的内容结构；模板只提供保存时的内容骨架，不代表系统已自动持久化健康数据。

## 趋势面板交付

趋势模式调用 `xunji_get_training_trends`，把返回的 `dashboard_html` 保存到当前工作区 `fitness-reports/`。使用非 PII 文件名和碰撞后缀，不覆盖既有报告；没有写入工具时，直接返回 HTML 内容并说明未创建文件。

## Markdown 交付

Markdown 模式且具备写入工具时，默认在 `fitness-reports/` 创建完整 `.md` 文件，使用 `references/report-artifact.js` 生成不覆盖的确定性路径；没有写入工具时直接返回完整 Markdown，并说明未创建文件。

资产计划的路径也使用相同的非覆盖原则：先尝试原文件名，存在冲突时按 `-2`、`-3` 递增。调用者应在实际写入前保留计划中的 `paths`，而不是重新拼接文件名。
