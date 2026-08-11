# Healthy Fitness Coach Skill

面向 18～55 岁、无重大疾病的健身新手与普通进阶者的通用健康健身 Skill。它覆盖安全筛查、训练计划、今日训练辅助、饮食与恢复、日志复盘、趋势分析和长期调整；不提供医疗诊断、PED、竞技备赛或极端减重方案。

## 两种使用方式

### 独立 Skill

- 源码：[`healthy-fitness-coach/`](healthy-fitness-coach/)
- 必需入口：[`healthy-fitness-coach/SKILL.md`](healthy-fitness-coach/SKILL.md)
- 可安装包：[`dist/healthy-fitness-coach.skill`](dist/healthy-fitness-coach.skill)

独立 Skill 不要求训记账号。没有连接器时，可以使用用户粘贴的导出文本或手工训练日志，并明确数据边界。

### 可选 Codex Plugin

[`healthy-fitness-coach-plugin/`](healthy-fitness-coach-plugin/) 在 Skill 之外提供本地 Xunji MCP 连接器：

- 按日/按范围读取训记数据，并按凭据隔离本地缓存；
- 生成训练趋势和本地自包含 HTML 面板；
- 写回前预览，按训练 ID upsert，显式确认后才写入；
- 使用 Windows DPAPI 保存凭据，不把 key 写入项目、日志或聊天。

安装 MCP 依赖并配置本机凭据：

```powershell
cd .\healthy-fitness-coach-plugin
npm --prefix .\mcp\xunji ci --omit=dev --ignore-scripts
.\mcp\xunji\scripts\set-credential.ps1
```

配置完成后刷新或重启 Codex，再使用类似“分析训记最近四周训练”或“生成训记最近 30 天趋势面板”的请求。

## 仓库边界

仓库只保留可复用的 Skill、可选 Plugin 源码、必要的插件测试和最终 Skill 包。个人训练数据、API key、缓存、报告、内部评测输出、任务过程记录和未经整理的研究原稿不应提交。

## 安全与健康边界

连接器只在用户明确要求时访问训记；写回不是整天覆盖删除。出现胸痛、晕厥、异常心悸、进行性无力等红旗症状时，Skill 会停止生成训练处方并建议获得专业评估。

## 发布前检查

当前仓库还没有选定开源许可证；在将 GitHub 仓库改为 Public 前，请明确选择 MIT、Apache-2.0 或其他许可证，并补充根目录 `LICENSE` 文件。
