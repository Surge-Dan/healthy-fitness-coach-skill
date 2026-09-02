# Task 8 报告：串联训练DNA与长期资产

## STATUS

GREEN。基于起点提交 `a7716fe` 完成训练DNA复盘闭环；`dist/` 中已有改动保持原样，未触碰、未暂存。

## 实现

- 在 `healthy-fitness-coach/references/training-dna-engine.js` 增加只消费复盘引擎标准事实/决策的入口：`consumeReviewEvidence`，并提供 `consumeReviewWindows`、`consumeReviewFacts`、`buildTrainingDNAFromReviews`、`buildDNAFromReview`、`updateTrainingDNAFromReview` 兼容别名。
- 同一来源记录 ID 在证据台账和维度比较中只计一次；原始记录不进入消费路径，输出 `raw_records_consumed: 0`。
- 单窗口仅为 `observed/observation/low`；至少两个完整、可比较窗口为 `candidate/candidate_rule/medium`；至少三个窗口且关键字段齐全、单位一致、无重复证据才为 `validated/validated_rule/high`。
- 阻力比较要求负重/结果与 RPE 或 RIR；有氧比较要求时长与距离；恢复比较要求带日期的恢复结果。缺失范围、缺失日期、混合单位、重复证据或不完整比较会降质并阻止升级。
- 每条动态结论保留支持事实、复盘决策摘要、反证、混杂因素、下一次验证和来源；支持 `retired/revoked` 及撤销原因。
- 无旧DNA时仍生成八维骨架；传入旧版 `status/confidence/hypotheses` DNA 时保留未更新维度并按未知字段兼容读取。
- 更新 `training-dna.md` 及 `training-dna-template.md`、`dna-evidence-template.jsonl`、`dna-changelog-template.md`，明确观察/候选规律/已验证规律和升级、降级、撤销记录。

## RED / GREEN

- RED：新增消费入口测试初次运行因 `consumeReviewEvidence is not a function` 失败；确认旧引擎没有复盘消费闭环。
- GREEN：补齐消费层后目标测试 18/18 通过。
- RED：八维兼容测试确认无旧DNA时消费结果只有 3 个动态维度（`3 !== 8`）；补充未知占位维度后通过。
- 全量回归：`node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`，177/177 通过。
- `git diff --check`：通过。

## COMMIT

待提交：`task-8: connect training DNA to review loop`。

## CONCERNS

- 消费入口要求上游已提供标准化 `facts`、`performance.comparisons/points` 和带日期 `recovery.observations`；缺少这些结构时会返回未知或观察，不会从原始记录补算。
- `validated/high` 是可审计工作假设，不是医学结论或身体“密码”；动作变式、技术、睡眠、压力、训练间隔和测量时点仍可能混杂结果。
- `dist/` 未重新打包，符合本任务约束；CLI 默认路由和 legacy 明确开关在审查修订中已补齐。

## 审查修订（P1/P2）

基于 `task-8-review.md` 逐项修订：

- CLI 默认先消费 review facts + decision；raw 记录仅在显式 `--legacy-raw` 下进入兼容提取器，并标记 `compatibility.legacy_raw`。
- 恢复维度复用窗口日期范围、质量状态、重复来源和混合单位门；`unknown/not_confirmed` 结果不能升级。
- 阻力高置信度要求 load/weight（或明确 kg/load 结果）与 RPE/RIR；reps-only 最多观察。
- 兼容完整 `buildDecisionLogEntry` 的嵌套 `decision` 形状；直接 facts 对象可被 `consumeReviewFacts` 正确消费。
- hypothesis 按阻力/有氧证据筛选；升级、降级、撤销 changelog 均保留原因、窗口 ID 和来源记录 ID。

修订后目标测试：`node --test healthy-fitness-coach/tests/training-dna.test.js healthy-fitness-coach/tests/training-dna-cli.test.js`，26/26 通过；全量回归：`node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`，184/184 通过；`git diff --check` 通过。
