# Task 9：更新 Skill 入口和知识路由

## STATUS

完成。基于起点提交 `0835db2` 更新独立 Skill 入口、Agent 元数据、画像评估说明和根 README；按 brief 未修改插件副本或 `dist/`。

## 变更

- `healthy-fitness-coach/SKILL.md` 重写为渐进披露入口：识别简单问题/训练任务 → 安全门 → 读取已有画像与当前计划 → 信息充分度判断 → 场景引擎 → 默认资产 → 最少反馈与决策记录。
- 入口直接引用当前编排、画像、计划、就绪度、复盘、训练DNA和训练域参考，且不复制引擎实现。
- `healthy-fitness-coach/agents/openai.yaml` 的触发描述覆盖计划、今日训练、复盘、训记、训练DNA和分享，默认提示允许用户直接使用自然语言。
- `healthy-fitness-coach/references/assessment.md` 增加按任务分层的最少字段、已有画像复用、当前状态隔离和渐进追问规则。
- `README.md` 收敛为已实现能力、自然语言用法、实际资产路由、来源证据和隐私/安全边界；移除内部迭代计划式内容。

## RED / GREEN

- RED：临时确定性静态校验首次运行，入口流程与元数据触发覆盖按预期失败（入口缺少“识别简单问题或训练任务”，Agent 元数据缺少“今日训练”）。
- GREEN：实现后临时静态校验 3/3 通过；随后删除临时测试文件，未扩大提交文件范围。

## 验证

- `node --test healthy-fitness-coach/tests/*.test.js`（PowerShell 显式文件列表）：191/191 通过。
- `node quality-tests/run-knowledge-base.js`：通过（25 张来源卡、6 个训练域和证据账本）。
- `python -X utf8 C:\Users\Daniel\.codex\skills\skill-creator\scripts\quick_validate.py healthy-fitness-coach`：`Skill is valid!`。
- `git diff --check`：通过。

## COMMIT

提交信息：`task-9: update skill entry and routing`；精确包含 brief 的 4 个文件和本报告。

## 自审

- 工作树中的 `dist/healthy-fitness-coach.skill` 修改和 `dist/healthy-fitness-coach.zip` 未跟踪文件均未触碰、未暂存。
- 入口仍明确普通医学问诊、疾病专项康复、竞技备赛、PED/药物指导和极端减重边界；红旗固定走安全分流。
- README 资产名称与 `references/output-routing.md` 的当前契约一致，示例不要求用户知道内部引擎名称。

## concerns

- `node quality-tests/run-training-system.js` 当前按既有门禁失败：`healthy-fitness-coach-plugin/skills/healthy-fitness-coach/SKILL.md` 与独立 Skill 不同步。brief 明确“只改 4 个文件”，因此本任务没有修改插件副本；若发布门禁要求同步，应由上层任务明确授权并单独处理。
- `run-training-system.js` 的同步断言之外，独立 Skill 格式、知识库门禁和 191 项现有测试均通过。
