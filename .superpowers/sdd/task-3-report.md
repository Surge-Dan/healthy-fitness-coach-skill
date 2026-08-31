# Task 3：渐进画像与状态合并

## STATUS

完成。新增无副作用 CommonJS 状态层，并与既有 `profile` / `currentState` 命名兼容；未改动训练任务分类逻辑或 `dist`。

## 变更

- `references/athlete-state.js`：提供 `normalizeAthleteProfile`、`normalizeCurrentState`、`mergeAthleteProfile`、`profileChangeSet`。
- 仅复制稳定画像、当前状态和证据状态的白名单字段；未知、空值和敏感/无关顶层字段不进入结果。
- 稳定字段的明确更新覆盖旧值，`profileChangeSet` 以字段级 `from` / `to` 供决策日志使用。
- 当前睡眠、压力、疲劳、疼痛、当天时长和临时器械独立于长期画像；拒绝持久化时标记为 `current_turn_only`，不声称永久记忆。
- 更新评估说明和档案模板，要求输出来源、日期、未知项与持久化状态。

## RED / GREEN

- RED 1：新增测试先因 `../references/athlete-state.js` 不存在而报 `MODULE_NOT_FOUND`。
- GREEN 1：实现最小状态模块后，6/6 通过。
- RED 2：加入 `unknown` / `不清楚` 不得成为档案事实的测试，预期失败。
- GREEN 2：将这些标记归为未知后，任务测试 7/7 通过。
- RED 3：加入白名单证据对象仍不得保留嵌套邮箱/API Key 的测试，预期失败。
- GREEN 3：递归复制时剔除敏感键后，任务测试 8/8 通过。

## 验证

- `node --test healthy-fitness-coach/tests/athlete-state.test.js`：8/8 通过。
- `node --test <healthy-fitness-coach/tests/*.test.js>`（PowerShell 显式文件列表）：94/94 通过。
- `node --check healthy-fitness-coach/references/athlete-state.js`：通过。
- `git diff --check`：通过。

## 提交

- `9dcf0586785b70cccf992c4744726345f97d63f6 task-3: add athlete state normalization`

## 自审

- 只操作白名单字段；没有将 API Key、联系方式、证件/账号字段或无关隐私加入返回值。
- 不用默认训练频率、时长或恢复数据填补未知项。
- 合并函数不读取或写入外部存储；所有函数保持纯函数。
- 未暂存或修改 `dist/healthy-fitness-coach.skill` 与 `dist/healthy-fitness-coach.zip`。

## concerns

- 该模块仅表达数据契约和持久化意图；未来接入实际存储时，调用方仍必须在写入前执行用户同意校验，并将变更写入 `DECISION_LOG.md`。

## 审查修复（2026-08-31）

### STATUS

已处理独立审查的 C1、C2、I1、I2 和 M1。

### 修复内容

- `normalizeAthleteProfile` 仅处理稳定字段；新增并导出 `normalizeEvidenceState`，使稳定、当前、证据三类状态互不进入或互相合并。
- 嵌套净化改为先净化后判定：中英文敏感键、深层对象和数组元素中的敏感内容都会删除；净化后为空的字段重新列入 `unknown_fields`。
- 每个已知稳定字段都有 `field_provenance`（来源、日期、持久化意图）；`profileChangeSet` 输出旧/新值及其各自溯源。局部更新保留未变化字段及档案原始元数据。
- 当前状态只输出 `temporary_equipment`；旧输入 `available_equipment` 仅作兼容映射。

### RED / GREEN

- RED：先新增状态隔离、中文/英文嵌套敏感值、净化后未知、字段级溯源和器械映射用例；旧实现 12 项中 7 项失败。
- GREEN：目标测试 12/12 通过；完整测试 98/98 通过。

### 验证与提交

- `node --test healthy-fitness-coach/tests/athlete-state.test.js`：12/12 通过。
- `node --test <healthy-fitness-coach/tests/*.test.js>`（PowerShell 显式文件列表）：98/98 通过。
- `node --check healthy-fitness-coach/references/athlete-state.js` 与 `git diff --check`：通过。
- 修复提交：`3f9a2bfcc35667460b1d8b4e78aaf4ff24ebf296 task-3: isolate athlete state containers`。

## 复审 Critical 修复（2026-08-31）

### STATUS

已处理复审 C1 与 C2。

### 修复内容

- 证据状态不再递归接受任意嵌套对象或依赖敏感词黑名单。训练记录、表现和恢复结果现在各自只接收明确的扁平允许字段；`account_number`、`credit_card`、`ssn`、`social_security_number`、`driver_license` 和任何未列字段都不会进入结果。
- 已持久化档案接收 `persisted: false` 更新时，合并结果的 `persisted` 强制为 `false`、`storage_scope` 为 `current_turn_only`。旧字段仍保留其字段级同意记录，但该候选容器不能作为持久化写入对象。

### RED / GREEN

- RED：新增账户数据绕过与拒绝持久化合并用例；旧实现 14 项中 3 项失败。
- GREEN：目标测试 14/14 通过；语法与 `git diff --check` 通过。

### 提交

- `43da611ed2379360bb038886e7bc347190127aee task-3: enforce evidence schema and consent scope`。
