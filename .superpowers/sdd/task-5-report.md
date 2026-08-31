# Task 5 Report: 计划规则编译器

## STATUS

COMPLETE — 新增 CommonJS 纯函数规则编译器；输出仅为可解释的计划结构、动作模式槽位和筛选边界，不含完整动作库、具体动作、重量或最大力量推断。

## RED / GREEN

- RED 1：`program-rules.test.js` 在模块尚不存在时以 `MODULE_NOT_FOUND` 失败。
- GREEN 1：实现五个公开函数后，首批 9 条规则测试通过。
- RED 2：上游 `red_flags: true` 未阻断，测试返回 `needs_input` 而非 `blocked`。
- GREEN 2：布尔和非空上游红旗代码统一进入安全阻断；极端时间线、急性损伤和危险症状均不生成 `session_slots`。
- RED 3：替代边界字段未对齐模板、四练日模板缺少第 4 行。
- GREEN 3：增加 `substitution_boundary`，模板支持 `{{day_4}}`。
- RED 4：短时训练的组数容量超过可用工作时间、未知时长仍产生空日程。
- GREEN 4：少于 15 分钟标为不可执行；15 分钟为 2 个槽位、最多 2 个有效组；未知时长不输出会被误用的最低任务。

## IMPLEMENTED

- `selectProgramStructure(profile)`：2 / 3 / 4 天分别为全身 A/B、交替全身、上下肢；5～7 天要求额外编排信息，非法频率不生成日程。
- `buildSessionBudget({ durationMinutes, experience })`：时长、动作槽位、有效组容量和新手上限一致；不确定时长不伪造预算。
- `defaultIntensityRules({ experience, goal })`：新手默认 2～3 RIR，避免常规力竭；无精确负重处方。
- `selectCycleMetrics({ goal, trackingPreference })`：1～3 个带原因码的指标，阻力训练和有氧分域。
- `compileProgramRules(profile)`：输出最低版本、同模式替代边界、进阶/降级规则、器械和限制过滤边界；性别不参与动作或目标限制。

## VERIFICATION

### 初始实现阶段（历史记录）

- 任务测试：`node --test healthy-fitness-coach\\tests\\program-rules.test.js` — 17/17 通过。
- 全量测试：显式传入 `healthy-fitness-coach/tests/*.test.js` — 131/131 通过。

### 最终修复后（交付证据）

- 任务测试：`node --test healthy-fitness-coach\\tests\\program-rules.test.js` — 19/19 通过。
- 全量测试：显式传入 `healthy-fitness-coach/tests/*.test.js` — 133/133 通过。
- 独立审查：初审发现红旗、短时预算、频率、新手动作上限和极端表述边界；均已按 RED→GREEN 修复。最终复核确认 P1 已关闭。

## COMMIT

提交信息：`task-5: add program rules compiler`（只包含本任务的 5 个文件，含本报告）。

## SELF-AUDIT

- 未触碰 `dist/`；已有 `dist/healthy-fitness-coach.skill` 修改和未跟踪 ZIP 保持未暂存。
- 不硬编码完整动作库；动作仅为模式槽位，具体选择留给知识库与器械/限制筛选。
- 已覆盖标准化 athlete-state 画像、未知字段、红旗、极端目标、短时长、4 天模板、新手 RIR 和性别非限制。

## CONCERNS

- 5～7 天训练不是被默认拒绝，而是要求目标肌群、恢复和日程信息后走自定义结构；本编译器不擅自选分化。
- 安全阻断是编排前门，不替代医疗评估或后续知识库对具体动作的限制筛选。

## REVIEW REMEDIATION

- 独立审查的两个 P1 均已关闭。
- 安全门由措辞正则升级为 `classifySafetyRisk`：分别记录 `target_change`、`time_window`、`unsafe_methods` 和原因码；覆盖“两周减10公斤”、“lose 10 kg in 14 days”、“drop 10 kg in 14 days”、“lose 12 kg in one month”与“crash diet for two weeks”。达到极端变化速度或包含不安全手段时，在编排前阻断。
- 编译结果新增 `current_program` 同构 view model，`renderCurrentProgram(plan, template)` 直接渲染实际 session 行；`CURRENT_PROGRAM` 周表改为 `{{weekly_schedule_rows}}`，2 / 3 / 4 天分别输出准确行数，无空余日或未解析逐日占位符。
- 本轮 RED：新增分类与端到端渲染测试因接口不存在而失败；GREEN：目标测试 19/19、全量测试 133/133 通过。只读复核确认 P1 已关闭。
