# 输出路由

先按 `output-routing.js` 的 `routeOutput({ taskType, userInstruction })` 确定输出。返回值始终是 `{ mode, reason, override }`，便于审计默认行为和显式命令。

| 模式 | 适用场景 |
| --- | --- |
| `conversation` | 今日训练、逐组跟练、动作/姿势调整、即时症状或安全分流 |
| `markdown` | 周期计划、周/月复盘、结构化分析、可复用报告 |
| `dashboard` | 用户要求读取训记范围并生成趋势面板 |

显式命令包括：

- `直接出报告` / `direct report`：强制 Markdown；
- `进入跟练` / `enter tracking`：强制对话；
- `生成趋势面板` / `查看训练趋势` / `dashboard`：强制趋势面板；
- `保存刚才内容` / `save prior content`：将刚才内容保存为 Markdown。

用户没有明确要求时沿用任务默认模式。只有多个产物都合理且需要用户选择时，才用一条简短对话提供三种模式，不阻断安全分流。

## 趋势面板交付

趋势模式调用 `xunji_get_training_trends`，把返回的 `dashboard_html` 保存到当前工作区 `fitness-reports/`。使用非 PII 文件名和碰撞后缀，不覆盖既有报告；没有写入工具时，直接返回 HTML 内容并说明未创建文件。

## Markdown 交付

Markdown 模式且具备写入工具时，默认在 `fitness-reports/` 创建完整 `.md` 文件，使用 `references/report-artifact.js` 生成不覆盖的确定性路径；没有写入工具时直接返回完整 Markdown，并说明未创建文件。
