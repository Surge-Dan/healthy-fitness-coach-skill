# Task 4：输出路由与资产契约

## STATUS

完成。路由层现在直接支持 `training-orchestrator.js` 的全部任务名；资产计划保持无副作用、确定性且不覆盖已有文件。未修改 `dist`。

## 变更

- `references/output-routing.js`：新增任务名默认路由、不可越过的 `safety_routing`、`planOutputAssets` 和 `resolveNonOverwritingPath`。
- `training_plan`、`training_review`、`training_system`、`xunji_analysis`、`share_output` 有确定的资产清单；训练系统另外返回 `TRAINING_SYSTEM_INDEX.md`。
- 今日训练默认对话，只有“保存刚才内容”才计划 `TODAY_WORKOUT.md`；显式趋势面板对训记追加分析报告与 HTML 面板，对其他任务以面板资产替换默认包。
- 新增今日训练和训练系统索引模板；文档写明任务—模式—资产契约与 `-2`、`-3` 非覆盖后缀策略。

## RED / GREEN

- RED 1：新增 `output-routing.test.js` 和模板断言后，7 项中 7 项失败：任务名默认路由缺失、安全命令可被报告覆盖、资产规划 API/模板不存在。
- GREEN 1：最小实现后，输出路由、模板渲染和编排器定向回归 25/25 通过。
- RED 2：新增“周期计划显式趋势面板替换默认资产包”断言；旧实现返回画像与周期文件，1/7 失败。
- GREEN 2：将显式 dashboard 作为统一资产计划分支后，目标测试通过。

## 验证

- `node --test tests/output-routing.test.js tests/render-assets.test.js tests/training-orchestrator.test.js`：25/25 通过。
- `node --test <tests/*.test.js>`（PowerShell 显式文件列表）：108/108 通过。
- `git diff --check`：通过。

## 提交

- `5be9ffc1d270479397eb6ebc30325f0db5fd490a task-4: add output asset routing`

## 自审

- `planOutputAssets` 不创建目录或写入文件；只计划文件名和路径。
- 冲突同时检查调用方提供的占用路径、当次计划中的保留路径与真实文件系统，并按固定整数后缀递增。
- `safety_routing` 在路由层即固定为对话，显式报告命令无法绕过；编排器的安全优先行为仍由完整回归覆盖。
- 仅暂存任务 4 的六个文件；`dist/healthy-fitness-coach.skill` 和 `dist/healthy-fitness-coach.zip` 未被修改或暂存。

## concerns

- 资产计划是文件名/路径契约，不承担实际写入、权限检查或用户同意；接入真实写入工具时，调用方仍需在写入前复核路径、展示待保存资产并取得必要同意。
