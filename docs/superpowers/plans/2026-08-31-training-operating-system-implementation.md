# Healthy Fitness Coach训练操作系统实施计划

- 日期：2026-08-31
- 对应规格：`docs/superpowers/specs/2026-08-30-training-operating-system-redesign.md`
- 实施原则：测试先行、增量改造、保留现有安全与数据边界、独立Skill与Plugin副本同步

## 1. 交付目标

本次改造完成后，Skill应从请求中先判断用户需要的是简单回答、训练执行、计划编排、数据复盘、长期系统还是分享输出，再决定是否补充画像、调用确定性规则和生成本地资产。

验收结果不是“回答更长”，而是以下闭环可以实际运行：

> 建档→计划→今日训练→记录→复盘→调整→下一周期

简单知识问题仍直接回答；需要执行或留存的任务默认生成Markdown资产。

## 2. 现有能力复用

以下模块保留并纳入新编排层：

- `references/output-routing.js`：输出模式和显式命令；
- `references/training-guidance.js`：安全、数据质量和方向性行动；
- `references/training-summary.js`：训练范围摘要；
- `references/training-dna-engine.js`：DNA指标与证据结构；
- `references/report-artifact.js`：报告文件路径和防覆盖；
- 现有训记读取、缓存、趋势、写回与凭据安全逻辑；
- 现有视觉编译器和分享图渲染器；
- 现有Markdown资产模板。

本次不重写训记协议、图片渲染器或知识库。

## 3. 任务一：建立改造前基线

### 文件

- 新建同级评测工作区：`healthy-fitness-coach-workspace/training-os-redesign/`
- 保存当前Skill快照：`skill-snapshot/`
- 扩展：`healthy-fitness-coach/evals/evals.json`

### 测试先行

新增六个能区分新旧版本的核心评测：

1. 简单问“RIR是什么意思”，不得强制建档；
2. 信息不全的新手计划请求，应集中询问关键缺口；
3. 信息完整的新手计划请求，应直接生成画像与当前计划；
4. 已有档案用户说“今天练胸”，只补今日状态；
5. 四周日志复盘，只调整1～2个变量并生成决策记录；
6. 单次记录要求训练DNA，必须保持低置信度或未知。

### 实施

- 保留现有12个安全和训练质量评测；
- 为新增评测写清预期资产、内容边界和禁止行为；
- 在改代码前保存旧版Skill，作为后续成对比较基线。

### 完成条件

- 快照不包含API Key、缓存、个人报告或用户照片；
- 新增评测同时覆盖“应追问”和“不应追问”；
- 所有预期结果可以人工检查或确定性断言。

## 4. 任务二：实现统一任务编排层

### 文件

- 新建：`healthy-fitness-coach/references/training-orchestrator.js`
- 新建：`healthy-fitness-coach/references/training-orchestration.md`
- 新建：`healthy-fitness-coach/tests/training-orchestrator.test.js`

### 测试先行

为下列任务路由写失败测试：

- `knowledge_question`
- `safety_routing`
- `training_plan`
- `today_workout`
- `training_review`
- `training_system`
- `xunji_analysis`
- `share_output`

断言输出包含：

- `task_type`
- `interaction_mode`
- `required_fields`
- `missing_fields`
- `information_state`
- `artifact_mode`
- `artifacts`
- `reason_codes`

### 实施

提供以下确定性函数：

- `classifyTrainingTask(input)`：从显式任务类型和用户指令分类；
- `requiredFieldsForTask(taskType)`：返回场景必要字段；
- `evaluateInformationState({ taskType, profile, currentState, records })`：返回`ready`、`ask`或`assume`；
- `buildWorkflowDecision(input)`：合并任务、信息状态、输出模式和资产清单。

路由优先级固定为：

1. 红旗和即时安全；
2. 用户显式命令；
3. 训练执行和数据任务；
4. 简单知识问答。

### 完成条件

- 简单知识问题不产生画像问题或文件；
- 完整计划请求不重复询问已提供字段；
- 信息不足时只返回会改变安全或方案结构的缺口；
- 红旗永远覆盖报告、图片和训练计划路由。

## 5. 任务三：实现渐进画像与状态合并

### 文件

- 新建：`healthy-fitness-coach/references/athlete-state.js`
- 新建：`healthy-fitness-coach/tests/athlete-state.test.js`
- 更新：`healthy-fitness-coach/references/assessment.md`
- 更新：`healthy-fitness-coach/assets/athlete-profile-template.md`

### 测试先行

覆盖：

- 只接受用户明确提供的值；
- 未知项保持未知；
- 新陈述覆盖旧背景时记录变更；
- 当前睡眠、疲劳和疼痛不写成长期偏好；
- API Key、联系方式和无关隐私字段不会进入画像；
- 用户拒绝保存时仍能在本轮使用临时状态。

### 实施

提供：

- `normalizeAthleteProfile(input)`：标准化稳定画像；
- `normalizeCurrentState(input)`：标准化当日状态；
- `mergeAthleteProfile(previous, update)`：仅合并明确更新；
- `profileChangeSet(previous, next)`：输出字段级变化，供决策日志使用。

画像字段划分：

- 稳定画像：目标、经验、频率、时长、场地、器械、安全限制、长期偏好；
- 当前状态：睡眠、压力、疲劳、疼痛、可用时间、临时器械；
- 证据状态：训练记录、完成率、表现和恢复结果。

### 完成条件

- 同一稳定字段不重复追问；
- 当前状态不会污染长期画像；
- 档案明确标注来源、日期、未知项和是否持久化；
- 不声称Agent具有未验证的永久记忆。

## 6. 任务四：扩展输出路由和资产契约

### 文件

- 更新：`healthy-fitness-coach/references/output-routing.js`
- 更新：`healthy-fitness-coach/references/output-routing.md`
- 新建：`healthy-fitness-coach/assets/today-workout-template.md`
- 新建：`healthy-fitness-coach/assets/training-system-index-template.md`
- 更新：`healthy-fitness-coach/tests/render-assets.test.js`
- 新建或扩展：`healthy-fitness-coach/tests/output-routing.test.js`

### 测试先行

断言：

- 简单问答和即时安全分流默认`conversation`；
- 周期计划、复盘、数据分析和平台诊断默认`markdown`；
- 长期系统默认返回多资产清单；
- 今日训练默认对话，但用户要求保存时生成`TODAY_WORKOUT.md`；
- 显式命令继续覆盖默认路由；
- 文件路径不覆盖已有文件。

### 实施

扩展任务集合和资产映射：

- `training_plan`→`ATHLETE_PROFILE.md`＋`CURRENT_PROGRAM.md`；
- `today_workout`→对话，按需`TODAY_WORKOUT.md`；
- `training_review`→`WEEKLY_REVIEW.md`＋`DECISION_LOG.md`；
- `training_system`→默认四个核心资产；
- `xunji_analysis`→Markdown报告＋按需dashboard；
- `share_output`→图片＋简短事实说明。

### 完成条件

- 生成模式和文件清单由确定性规则给出；
- 多文件交付包含索引，不让用户自行猜测文件关系；
- 普通用户不需要运行Node命令才能获得Markdown结果。

## 7. 任务五：实现计划规则编译器

### 文件

- 新建：`healthy-fitness-coach/references/program-rules.js`
- 新建：`healthy-fitness-coach/tests/program-rules.test.js`
- 更新：`healthy-fitness-coach/references/programming.md`
- 更新：`healthy-fitness-coach/assets/current-program-template.md`

### 测试先行

覆盖：

- 每周2次默认全身；
- 每周3次默认全身交替或简单分化；
- 每周4次默认上下肢或与目标匹配的等价结构；
- 训练内容能放入声明时长；
- 新手默认保留2～3RIR并控制动作数量；
- 计划包含最低任务、替代动作、进阶和降级；
- 有氧和阻力指标分开；
- 不根据性别自动限制动作或训练目标。

### 实施

提供：

- `selectProgramStructure(profile)`；
- `buildSessionBudget({ durationMinutes, experience })`；
- `defaultIntensityRules({ experience, goal })`；
- `selectCycleMetrics({ goal, trackingPreference })`；
- `compileProgramRules(profile)`。

该模块只输出可解释的结构和边界，动作选择仍结合器械、限制和知识库完成，避免把复杂训练编排伪装成精确公式。

### 完成条件

- 计划频率、时长和器械约束一致；
- 每个计划只验证1～3个主要指标；
- 规则输出可以直接填充`CURRENT_PROGRAM.md`；
- 极端目标和危险要求不能绕过安全门。

## 8. 任务六：实现今日状态与最低任务引擎

### 文件

- 新建：`healthy-fitness-coach/references/readiness-engine.js`
- 新建：`healthy-fitness-coach/tests/readiness-engine.test.js`
- 更新：`healthy-fitness-coach/references/training-guidance.js`
- 更新：`healthy-fitness-coach/references/exercise-coaching.md`

### 测试先行

覆盖：

- 红旗→停止处方；
- 一般疼痛→保守变式和24～48小时复评；
- 单晚睡眠较差→优先降级，不自动判断过度训练；
- 时间减少→压缩为最低任务；
- 疲劳较高但无红旗→减少组数或强度中的一个变量；
- 正常状态→按当前计划执行。

### 实施

输出三种状态：

- `proceed`
- `regress`
- `stop`

每个结果包含：事实、原因码、调整变量、最低任务、停止条件和训练后记录字段。避免输出医学诊断或无法解释的“恢复分数”。

### 完成条件

- 今日训练能直接执行；
- 降级只改变少量变量；
- 所有结果明确要求回填完成情况、RPE/RIR、疼痛或有氧时长中的相关项。

## 9. 任务七：实现复盘决策与计划版本差异

### 文件

- 新建：`healthy-fitness-coach/references/review-decision-engine.js`
- 新建：`healthy-fitness-coach/tests/review-decision-engine.test.js`
- 更新：`healthy-fitness-coach/references/review-adjustment.md`
- 更新：`healthy-fitness-coach/references/training-summary.js`
- 更新：`healthy-fitness-coach/assets/decision-log-template.md`
- 更新：`healthy-fitness-coach/assets/weekly-review-template.md`

### 测试先行

覆盖：

- 完成率持续偏低时先降低复杂度；
- 同动作在相近条件下表现提升时允许进阶；
- 多次表现下降且恢复较差时建议减量；
- 单次表现下降不重写计划；
- 数据缺失或单位混合时不生成趋势结论；
- 一次最多输出两个主要调整；
- 每个调整包含预期、回退条件和复核日期。

### 实施

提供：

- `deriveReviewFacts(input)`；
- `buildReviewJudgments(facts)`；
- `selectProgramChanges(judgments, currentProgram)`；
- `buildDecisionLogEntry(input)`。

所有输出保持“事实→推断→不确定性→决策→验证”的固定证据结构。

### 完成条件

- 调整可追溯到训练记录；
- 保留项与修改项同时输出；
- 没有数据时明确未知；
- 新计划版本可以和旧版本做字段级差异比较。

## 10. 任务八：串联训练DNA与长期资产

### 文件

- 更新：`healthy-fitness-coach/references/training-dna.md`
- 更新：`healthy-fitness-coach/references/training-dna-engine.js`
- 更新：`healthy-fitness-coach/tests/training-dna.test.js`
- 更新：相关DNA资产模板

### 测试先行

新增断言：

- 单次训练最多为观察；
- 缺少负重、RPE、时长、距离或恢复结果时不能升级为高置信度；
- 多个窗口存在可比较结果才允许升级；
- 范围缺失、重复记录和混合单位降低数据质量；
- DNA结论包含反证、混杂因素和下一次验证；
- 规律可以降级或撤销。

### 实施

- 让DNA消费复盘引擎产生的标准事实和决策，而不是重新解释原始记录；
- 在`TRAINING_DNA.md`中区分观察、候选规律和已验证规律；
- 在变更日志中记录升级、降级和撤销原因。

### 完成条件

- DNA是训练闭环的结果，不是首次建档输出的营销标签；
- 同一证据不会被重复计入；
- 旧版DNA文件保持兼容。

## 11. 任务九：更新Skill入口和知识路由

### 文件

- 更新：`healthy-fitness-coach/SKILL.md`
- 更新：`healthy-fitness-coach/agents/openai.yaml`
- 更新：`healthy-fitness-coach/references/assessment.md`
- 更新：`README.md`

### 实施

重写入口工作流为：

1. 识别简单问题或训练任务；
2. 执行安全门；
3. 读取已有画像和当前计划；
4. 运行信息充分度判断；
5. 进入对应场景引擎；
6. 默认生成匹配资产；
7. 收集最少反馈并更新决策记录。

README只描述已实现能力、用户使用方式和隐私边界，不写内部迭代计划。

### 测试

- Skill行数和渐进披露检查；
- 关键引用文件存在；
- README示例与实际路由一致；
- 触发描述覆盖计划、今日训练、复盘、训记、训练DNA和分享场景；
- 与普通医学问诊、竞技备赛和药物指导保持边界。

### 完成条件

- 新用户可以用一句自然语言启动；
- Agent不会把所有请求都变成长问卷；
- 用户无需了解内部引擎名称；
- 核心场景默认产生可继续使用的资产。

## 12. 任务十：同步独立Skill与Plugin副本

### 文件

- 同步：`healthy-fitness-coach-plugin/skills/healthy-fitness-coach/`
- 按需更新：Plugin README和脚本说明

### 测试

- Canonical与Plugin Skill文件逐项哈希一致；
- Plugin公开CLI烟雾测试；
- 训记MCP完整测试；
- 独立复制Plugin后仍能解析引用路径。

### 完成条件

- 两份Skill无行为漂移；
- 普通用户不安装Plugin仍可使用手工日志和Markdown闭环；
- Plugin用户可继续使用加密凭据、缓存、趋势、DNA和确认写回。

## 13. 任务十一：运行成对评测和人工审查

### 执行

使用任务一保存的旧版快照，对六个核心场景分别运行：

- 新版Skill；
- 旧版Skill。

比较维度：

- 是否正确决定追问或直接执行；
- 是否复用已有画像；
- 是否生成正确资产；
- 是否提供可解释的规则和验证条件；
- 是否避免重复盘问、伪精确和无依据结论；
- Token和完成时间变化。

生成Skill Creator静态评审页，供用户查看新版与旧版输出及量化断言。人工反馈进入下一轮修正。

### 完成条件

- 新版在核心闭环场景明显优于旧版；
- 简单问答没有因系统化而变慢或变长；
- 人工评审没有安全、隐私或明显体验阻塞项。

## 14. 任务十二：完整质量门禁和发布包

### 自动测试

```powershell
node --test healthy-fitness-coach\tests
npm test --prefix healthy-fitness-coach-plugin\mcp\xunji
node quality-tests\run-gherkin.js
node quality-tests\run-mutation-smoke.js
node quality-tests\run-knowledge-base.js
node quality-tests\run-training-system.js
node quality-tests\run-visual-system.js
node quality-tests\run-visual-png-smoke.js
```

额外检查：

- Python脚本逐文件编译；
- Skill快速校验；
- Node覆盖率；
- Plugin覆盖率；
- Git差异检查；
- API Key和个人数据扫描；
- Canonical/Plugin哈希一致性；
- 最终ZIP条目检查；
- 从最终ZIP解压后重新运行关键烟雾测试。

### 发布验收

- `dist/healthy-fitness-coach.skill`
- `dist/healthy-fitness-coach.zip`

包内必须包含新编排、画像、计划、今日状态、复盘和资产模板；不得包含缓存、个人报告、用户照片、API Key、`node_modules`、评测工作区或临时文件。

## 15. 提交策略

按可回滚边界拆分提交：

1. 测试与基线；
2. 编排与画像；
3. 计划与今日状态；
4. 复盘与DNA；
5. Skill入口、文档与Plugin同步；
6. 发布包和最终验证。

每次只暂存本任务文件，不使用`git add .`。测试失败时停在对应边界修复，不把失败状态带入下一阶段。

## 16. 最终完成定义

以下条件全部满足才算完成：

1. 简单问答不被强制建档；
2. 需要计划或分析时，系统能识别缺口并一次性追问必要信息；
3. 信息充分后默认生成正确Markdown资产；
4. 今日训练会读取既有计划并根据当前状态调整；
5. 训练复盘只根据真实、可比较数据调整1～2个变量；
6. 训练DNA遵守多窗口证据门槛；
7. 训记、手工日志和无数据场景均有明确降级路径；
8. 分享图不篡改训练事实；
9. 新旧版成对评测显示闭环能力有实质提升；
10. 全部自动测试、人工审查、安全扫描和最终包验证通过。
