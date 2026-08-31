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
