# Task 7 报告：复盘决策与计划版本差异

## STATUS

GREEN。以起点提交 `2f7f010` 完成任务7；`dist/` 中已有改动保持原样，未触碰、未暂存。

## 实现

- 新增 `healthy-fitness-coach/references/review-decision-engine.js`，提供四个 CommonJS 纯函数：`deriveReviewFacts`、`buildReviewJudgments`、`selectProgramChanges`、`buildDecisionLogEntry`。
- 复盘消费训练范围摘要和标准化记录，保留来源记录 ID；比较同动作、同指标、同单位及相近 RIR/RPE/组数条件。
- 连续两个窗口完成率低于 70% 才建议降低复杂度；同条件表现提升允许下一小步进阶；多次下降且恢复较差建议减量；单次下降仅观察。
- 缺失日期、解析警告、混合单位或记录不足时标记未知，不生成趋势或平台期结论；平台候选要求完整数据、至少 8 个观察周和多次比较。
- 计划变更最多两个主要变量，每项带证据记录 ID、预期影响、回退条件和复核日期；同时输出保留项、旧/新版本和字段级差异。
- 更新 `training-summary.js` 暴露依从性、证据台账、警告数和单位质量；同步更新复盘规则及决策日志/周复盘模板。

## RED / GREEN

- RED 1：`node --test healthy-fitness-coach/tests/review-decision-engine.test.js` 在引擎不存在时按预期以 `MODULE_NOT_FOUND` 失败。
- GREEN 1：引擎首轮目标测试 6/6 通过。
- RED 2：摘要契约测试先因缺少 `adherence`、证据台账和单位质量字段失败；实现后通过。
- RED 3：缺失日期仍产生表现趋势的回归测试失败；实现质量门后通过。
- 任务测试：`node --test healthy-fitness-coach/tests/review-decision-engine.test.js`，7/7 通过。
- 全量回归：`node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`，164/164 通过。
- `git diff --check`：通过。

## COMMIT

`task-7: add review decision engine`（最终精确提交）。提交只包含本任务的代码、测试、文档、模板和本报告。

## CONCERNS

- 复盘引擎不是医疗评估；恢复差、疼痛升级或红旗应由上游安全门处理。
- 直接传入完成率窗口时，完成率本身仍需调用方保留计划/实际次数来源；引擎不会从缺少计划分母的记录臆造完成率。
- 复杂度/训练量变更优先作用于现有计划的 `session_budget` 数值字段；计划结构缺少这些字段时，保留可审计的 `review_adjustments` 差异，不伪造动作或负重。
- `dist/` 未重新打包，符合本任务约束；后续发布流程需单独处理。

## 复审修订（F1–F3）

### STATUS

GREEN。针对 `task-7-review.md` 的 F1、F2、F3 及无效复核日期观察完成修订。

### RED / GREEN

- RED：新增实际记录缺失日期/关键比较字段、无日期恢复、`[0.5, null, 0.6]` 完成率窗口和无复核日期 judgment 测试；目标测试 10 项中 6 项通过、4 项按预期失败。
- GREEN：`node --test healthy-fitness-coach/tests/review-decision-engine.test.js`，10/10 通过。
- 全量回归：`node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`，167/167 通过。
- `git diff --check`：通过。

### 修订内容

- 实际记录缺失日期、动作、测量值、单位、RIR/RPE 或组数时将质量置为 `unknown`，禁止表现趋势；相近条件比较要求关键字段完整。
- 恢复证据必须有日期且能落在复盘范围/训练窗口附近；无法关联时恢复状态为 `unknown`，不触发减量。
- 完成率缺失项保留为 `known: false` 的窗口占位，不跨缺失窗口判断连续低完成率。
- `selectProgramChanges` 拒绝没有有效复核日期的直接调整 judgment；正常路径仍从已知范围末日推导复核日期。
- 本次修订不触碰 `dist/`；提交仅包含任务7代码、测试和报告追加内容。

## 最终复审修订（D1）

### STATUS

GREEN。修复 `buildDecisionLogEntry(input.decision)` 绕过逐项复核日期校验的问题。

### RED / GREEN

- RED：新增缺失及非法逐项复核日期的决策日志测试；目标测试 12 项中 10 项通过、2 项失败，均显示注入 adjustment 未被排除。
- GREEN：`node --test healthy-fitness-coach/tests/review-decision-engine.test.js`，12/12 通过。
- 全量回归：`node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`，169/169 通过。
- `git diff --check`：通过。

### 修订内容

- `buildDecisionLogEntry` 对外部预构造 `decision.changes` 逐项复用有效日期门，并要求预期影响与回退条件存在。
- 缺失或非法日期的注入调整不进入最终日志 `decision.changes`，同时写入不确定性说明；有效调整仍保留。
- 生成路径不变，`selectProgramChanges` 仍负责正常 judgment 的最多两个变量与日期推导。
- 本次修订不触碰 `dist/`。

## 最终复审修订（D2–D3）

### STATUS

GREEN。封闭外部预构造 `decision.changes` 绕过数量、变量去重和证据来源校验的路径。

### RED / GREEN

- RED：新增外部决策注入四项变更（重复变量、无证据项、超过两项）的回归测试；目标测试 13 项中 12 项通过、1 项失败，证明注入变更未受上限约束。
- GREEN：`node --test healthy-fitness-coach/tests/review-decision-engine.test.js`，13/13 通过。
- 全量回归：`node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`，170/170 通过。
- `git diff --check`：通过。

### 修订内容

- `sanitizeDecision` 逐项要求非空 `evidence_record_ids`，并规范化、去重来源 ID。
- 外部变更按变量去重，最多保留两个唯一变量；重复项、无证据项和超出上限项均排除。
- 所有排除原因写入决策日志不确定性，最终 `decision.changes` 仅保留可追溯调整。
- 本次修订不触碰 `dist/`。
