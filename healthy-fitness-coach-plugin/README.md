# 健康健身教练 Plugin

## MCP metadata compatibility

This package declares its production Xunji connector as local stdio in `.mcp.json`. Codex skill MCP dependency metadata is documented for `streamable_http` URL servers; this local stdio connector does not add unsupported dependency fields to `agents/openai.yaml`.

本地 Codex Plugin：提供健康边界优先的训练、营养、恢复指导，并可通过 MCP 查询、分析和按 ID 安全写回训记训练数据。

## 环境与安装

- 支持 **Windows** 和 **Node.js 18.14.1+**。在 Node 18 上，依赖树使用已锁定的 `@hono/node-server` **1.19.17 override**。
- 从本 Plugin 根目录安装 MCP 运行时依赖：

```powershell
npm --prefix .\mcp\xunji ci --omit=dev --ignore-scripts
```

- 本任务未在此机器上验证 Codex 的本地 Plugin 添加命令，因此具体的本地市场/命令步骤属于**产品版本相关**行为。请使用当前 Codex 的本地 Plugin UI 或命令选择本目录 `healthy-fitness-coach-plugin`；不要创建或修改全局 marketplace。
- 配置凭据时，使用当前 Windows 用户的 **DPAPI** 在本机交互执行：

```powershell
.\mcp\xunji\scripts\set-credential.ps1
```

  **不要把密钥粘贴到聊天中。**完成后刷新或重启 Codex，并测试：`分析训记最近四周训练`。

## 数据与隐私边界

- 凭据和缓存仅保存在 `%LOCALAPPDATA%\HealthyFitnessCoach\`；缓存按日期存储。
- MCP 提供按日/按范围读取、趋势分析、写回预览和显式确认写回；读取工具仍为**只读**，写回不是整天覆盖删除。
- 写回前先调用预览工具，确认所有记录属于同一天、最多 12 条且每条不超过 1500 字符；更新已有记录时保留 `id:`，有 `train_time:` 时原样带回。
- 成功写回后，以训记返回的最新 `res` 作为最终结果并更新当天缓存。
- 趋势工具返回本地自包含 HTML，可保存到工作区 `fitness-reports/`；不加载外部 CDN，也不上传用户数据。
- 标记为 Garmin 的记录会在面向模型的输出前被过滤；不会新增云数据库。
- 插件不会随源码或 `dist` 打包 `node_modules`、凭据、缓存、个人报告或真实训练数据。

## 删除本地数据

以下脚本先解析绝对路径并只允许删除 `HealthyFitnessCoach` 子目录；递归删除使用 PowerShell 确认语义。先使用 `-WhatIf` 预演，确认后去掉该参数：

```powershell
# 仅删加密凭据
.\mcp\xunji\scripts\remove-credential.ps1 -WhatIf

# 仅删日期缓存
.\mcp\xunji\scripts\remove-cache.ps1 -WhatIf

# 两者都删
.\mcp\xunji\scripts\remove-credential.ps1 -WhatIf
.\mcp\xunji\scripts\remove-cache.ps1 -WhatIf
```

## 已知依赖风险

Node 18 依赖树中仍存在已知的 Hono static-server advisory。该 Plugin 只启动 MCP stdio，绝不创建 Hono HTTP 或静态文件服务，因此该路径不暴露；这不是隐藏审计项。建议未来版本迁移到 Node 20，并在升级后重新审计依赖树。
