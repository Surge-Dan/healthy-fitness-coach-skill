# 训记闭环接入与训练报告设计

## 背景与目标

当前 Skill 已具备训记按日/按范围读取、gzip JSON 解析、凭据隔离和本地缓存，但默认仍是“只读连接器”。本次迭代只扩展训记，不接入 Keep，目标是让用户能够安全完成：

1. 从训记读取训练数据并复用本地缓存；
2. 在对话中选择跟练、Markdown 报告或趋势面板输出模式；
3. 查看本地自包含的训练趋势报告；
4. 预览并确认后，按训练 ID 将整理后的记录 upsert 回训记。

## 非目标

- 不接入 Keep 或其他平台；
- 不实现整天覆盖、批量删除或隐式修改；
- 不在仓库、日志、报告或测试 fixture 中保存真实 API key；
- 不把 Skill 伪装成原生 GUI 应用；在 Codex 中使用明确的对话模式选择，本地 HTML 作为趋势面板。

## 方案与组件

### 1. 训记客户端

扩展现有 `XunjiClient`：

- `fetchDay(date, credential)` 调用 `/api_trains_for_llm`；
- `upsertRecords(records, credential)` 调用 `/api_upsert_trains_for_llm`；
- 两个接口都使用 `Authorization: Bearer <本机凭据>`、gzip 解码、超时和公开错误映射；
- 写回客户端不接受日期参数，日期由服务层从每一条记录严格解析并校验“全部同一天”。

### 2. 服务层与缓存

保留当前按凭据 fingerprint 隔离的 `FileCache`，新增：

- `previewTrainingUpsert({ records })`：只校验和解析，不联网、不写缓存；
- `upsertTrainingRecords({ records, confirm })`：要求 `confirm === true`，校验通过后调用写回接口；
- 成功后只使用服务端返回的 `res` 重新解析并写入对应日期缓存；
- 缓存条目增加操作来源/写回时间等可审计元数据，但不保存凭据；
- 写回失败时保留原缓存，返回明确错误，不伪造成功结果。

写回校验规则：

- `res` 必须是非空字符串数组，最多 12 条；
- 每条最长 1500 个字符；
- 所有记录必须属于同一日期，支持 `YYYY-MM-DD` 和 `YYMMDD`；
- 更新记录时保留 `id:`，存在 `train_time:` 时原样保留；
- 不在本次 `res` 中的旧记录不删除；
- 预览结果列出日期、记录数、已有 ID、新建记录数、格式警告和将写回的原文。

### 3. MCP 工具

保留：

- `xunji_get_training_day`
- `xunji_get_training_range`

新增：

- `xunji_preview_training_upsert`
- `xunji_upsert_training_records`
- `xunji_get_training_trends`

写回工具使用 `readOnlyHint: false`，要求显式 `confirm: true`；预览工具和趋势工具保持只读。

### 4. 交互模式选择

扩展输出路由，支持三种显式模式：

- `conversation`：今日训练、逐组跟练、动作/症状即时处理；
- `markdown`：周期计划、周/月复盘、结构化分析；
- `dashboard`：读取训记范围并生成本地趋势面板。

用户没有明确指定时沿用现有任务默认值；首次请求需要在多个产物都合理时，用一条简短对话提供三项选择，不阻断安全分流。模式选择应写入结果元数据，便于审计。

### 5. 趋势分析与本地面板

新增纯函数趋势分析模块，输入已解析的日期范围结果，输出：

- 训练日数、训练次数、缺失日期、缓存/网络来源；
- 按周训练频率；
- 可解析时的总组数、总次数和估算训练量；
- 动作/标题出现频次和最近训练日期；
- 无法结构化解析的原文数量及警告。

新增本地自包含 HTML 报告生成器：

- 默认写入工作区 `fitness-reports/`；
- 不加载外部 CDN 或用户数据上传；
- 图表使用内嵌 SVG/原生 HTML；
- 文件名碰撞时追加后缀，不覆盖既有报告；
- 页面包含日期范围、数据新鲜度、缺失日期、趋势卡片、表格和证据边界。

## 错误与安全处理

- 凭据缺失/无效、90 秒限流、会员限制、格式错误分别映射为可读错误；
- 红旗症状仍优先于任何训记读取或写回；
- 写回前后保留 `id:`、`train_time:`、日期和原始行；
- 不把真实凭据写入错误、结构化输出、HTML、Markdown 或日志；
- 真实 smoke test 只在用户本机已通过 DPAPI 配置凭据后进行，不进入自动化测试。

## 测试策略

按 TDD 分阶段：

1. 先为写回请求、gzip 响应、同日校验、ID/时间保留和缓存回写增加失败测试；
2. 再为趋势统计、模式路由和 HTML 报告碰撞保护增加失败测试；
3. 实现最小代码使新增测试通过；
4. 运行现有 connector、V2 contract、secret scan、MCP handshake 和插件校验；
5. 使用 mock/fixture 验证全流程，真实账号只做手动 smoke test。

## 兼容性与交付

- 现有只读工具和缓存格式保持向后兼容；
- Skill canonical、Plugin、dist 和 `.skill` 重新同步并通过归档一致性检查；
- README 增加 DPAPI 配置、读取、预览、确认写回和趋势报告的使用说明；
- 不把真实训练数据或本地报告打包进发布物。
