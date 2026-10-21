# 健康健身教练 Plugin

## MCP metadata compatibility

This package declares its production Xunji connector as local stdio in `.mcp.json`. Codex skill MCP dependency metadata is documented for `streamable_http` URL servers; this local stdio connector does not add unsupported dependency fields to `agents/openai.yaml`.

本地 Codex Plugin：提供健康边界优先的训练、营养、恢复指导，并可通过 MCP 读取、分析、生成趋势面板、预览和按 ID 安全写回训记训练数据。

## 环境与安装

- 支持 **Windows** 和 **Node.js 18.14.1+**。在 Node 18 上，依赖树使用已锁定的 `@hono/node-server` **1.19.17 override**。
- 从本Plugin根目录运行一键初始化脚本：

```powershell
.\scripts\setup-xunji.ps1
```

脚本会检查Node.js/npm版本、安装MCP运行时依赖，并调用凭据脚本。也可以手动执行：

```powershell
npm --prefix .\mcp\xunji ci --omit=dev --ignore-scripts
.\mcp\xunji\scripts\set-credential.ps1
```

只安装Skill不会自动注册本地Plugin。完成初始化后，在Codex的Plugins界面选择“添加本地插件”，目录选择当前`healthy-fitness-coach-plugin`目录；添加后刷新或重启Codex，并新建任务测试：`分析训记最近四周训练`。

## 数据与隐私边界

- 凭据和缓存仅保存在 `%LOCALAPPDATA%\HealthyFitnessCoach\`；缓存按日期存储。
- MCP 提供按日/按范围读取、趋势分析、训练DNA提取、写回预览和显式确认写回；读取与DNA提取工具仍为**只读**，写回不是整天覆盖删除。
- 写回前先调用预览工具，确认所有记录属于同一天、最多 12 条且每条不超过 1500 字符；更新已有记录时保留 `id:`，有 `train_time:` 时原样带回。
- 成功写回后，以训记返回的最新 `res` 作为最终结果并更新当天缓存。
- 趋势工具返回本地自包含 HTML，可保存到工作区 `fitness-reports/`；不加载外部 CDN，也不上传用户数据。
- `xunji_extract_training_dna`会分别分析阻力和有氧训练，返回八维DNA、数据质量、证据台账和版本变更；DNA版本保存在`%LOCALAPPDATA%\HealthyFitnessCoach\training-dna\`，按账号单向fingerprint隔离。
- `xunji_get_training_trends`会在趋势数据旁返回`summary`和`guidance`：总结训练事实与数据质量，指导按“事实→判断→行动→验证”给出下一步，不会把稀疏数据包装成确定性结论。
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

## 连接与写回恢复

本地连接器仍仅支持 Windows，不提供手机远程服务。凭据通过本机受保护入口配置，禁止在聊天提交 Key。手机可使用独立 Skill 导入数据。

范围、趋势、DNA支持 `refresh_dates` 和 `refresh_all`。最近七天缓存满五分钟更新，90秒内不重复刷新。

写回现在必须先获得十分钟有效的 `preview_id`，确认内容后携带该ID提交。结果未知先用 `xunji_reconcile_training_upsert` 核对，不盲目重试。本地 `write-operations/` 保存提交摘要状态，服务重启仍阻止同批重发；不是服务端幂等保证。用户核对最新记录并确认未写入后才解除锁。服务端确认且本地缓存失败时依然返回 confirmed。

接续摘要由用户主动导入另一设备，没有自动云同步。
