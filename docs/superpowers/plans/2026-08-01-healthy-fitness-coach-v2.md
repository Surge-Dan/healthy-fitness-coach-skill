# 健康健身教练 V2 实施计划

日期：2026-08-01

对应规格：`docs/superpowers/specs/2026-08-01-healthy-fitness-coach-v2-design.md`

## 1. 交付目标

在保留 V1 安全能力和 `healthy-fitness-coach` 名称的前提下，交付：

1. 支持自动选择对话或 Markdown 的 V2 Skill；
2. Windows 本地运行的训记只读 MCP；
3. DPAPI 凭据录入与读取流程；
4. 仓库外日期缓存和容错解析；
5. 八维训练分析与标准报告模板；
6. 按需联网、小红书/登录页面降级策略；
7. 可独立安装的更新版 Skill 和 Plugin 包；
8. V1/V2 成对评测、工具测试和安全回归报告。

## 2. 实施约束

- 不使用用户已发到聊天中的 Key；
- 不把任何真实 Key 写入命令、源码、测试、日志、缓存、报告或 Git；
- 真实接口联调必须等用户通过本机安全脚本重新录入凭据；
- 首版只读，不推测或调用未提供的训记写入接口；
- 先测试后实现，每个阶段完成后单独验证；
- 不改动与 V2 无关的 V1 内容；
- 不把缓存或个人训练报告提交到 Git；
- 不开发小红书爬虫或绕过平台访问限制。

## 3. 目录规划

```text
healthy-fitness-coach/                 # 更新后的独立 Skill
├── SKILL.md
├── agents/openai.yaml
├── references/
│   ├── output-routing.md
│   ├── xunji-integration.md
│   ├── multidimensional-analysis.md
│   └── web-research.md
├── assets/
│   └── fitness-analysis-report-template.md
└── evals/evals.json

healthy-fitness-coach-plugin/          # Plugin 安装包源目录
├── .codex-plugin/plugin.json
├── skills/healthy-fitness-coach/      # 从同一 Skill 源打包
└── mcp/xunji/
    ├── package.json
    ├── src/
    │   ├── server.js
    │   ├── credentials.js
    │   ├── xunji-client.js
    │   ├── cache.js
    │   ├── parser.js
    │   ├── schemas.js
    │   └── errors.js
    ├── scripts/
    │   ├── set-credential.ps1
    │   └── remove-credential.ps1
    └── test/
        ├── credentials.test.js
        ├── client.test.js
        ├── cache.test.js
        ├── parser.test.js
        └── server.test.js

tests/
├── validate_skill.ps1
├── validate_plugin.ps1
└── fixtures/xunji/

healthy-fitness-coach-workspace/
├── skill-v1-snapshot/
└── iteration-2/

dist/
├── healthy-fitness-coach.skill
└── healthy-fitness-coach-plugin/
```

缓存和凭据位于 `%LOCALAPPDATA%\HealthyFitnessCoach\`，不在上述仓库目录内。

## 4. 技术选择

### 4.1 MCP 运行时

- Node.js 18 或更高版本；
- 使用官方 MCP JavaScript SDK；
- HTTP 使用 Node 内置 `fetch`，由运行时处理 gzip；
- 测试使用 `node:test`，减少额外依赖；
- MCP 通过 stdio 与 Codex 通信；
- 所有工具结果使用稳定的结构化字段，不返回请求头和内部堆栈。

### 4.2 DPAPI

Node MCP 不接收明文命令行参数。凭据通过两个 PowerShell 脚本管理：

- `set-credential.ps1` 使用 `Read-Host -AsSecureString` 交互录入；
- 使用当前 Windows 用户的 DPAPI 加密后写入仓库外文件；
- `credentials.js` 调用只读 PowerShell 辅助流程，在进程内临时获取明文；
- `remove-credential.ps1` 删除加密凭据；
- 测试使用临时目录和虚假凭据，不访问用户真实凭据。

最终包只支持 Windows。跨平台凭据适配不在本次范围内。

### 4.3 日期与范围

- `datestr` 严格使用 `YYYY-MM-DD`；
- 范围工具最多读取 90 个自然日；
- 日期范围按日顺序处理，优先缓存，网络请求只覆盖缺失日期；
- 不在首版并发轰击多个日期；
- 所有时间判断使用用户本地时区，默认 `Asia/Shanghai`，并允许后续配置。

## 5. 阶段一：建立 V2 测试基线

### 5.1 冻结 V1

操作：

- 将当前 `healthy-fitness-coach/` 复制到 `healthy-fitness-coach-workspace/skill-v1-snapshot/`；
- 记录 V1 提交、包哈希和现有评测结果；
- 验证快照不包含工作区输出和真实凭据。

验收：

- 快照能通过原有 `tests/validate_skill.ps1`；
- 使用完整密钥形态规则扫描，确认不存在“训记凭据前缀＋长十六进制串”，避免普通说明文字误报；
- V1 源目录保持不变。

### 5.2 先添加失败测试

在修改 Skill 和实现 MCP 前增加以下测试：

- 计划/复盘任务必须生成 `.md`；
- 今日训练默认保持对话；
- 用户显式指令可以覆盖默认模式；
- 缓存命中不得再次请求；
- 90 秒内刷新被本地阻止；
- 范围读取只请求缺失日期；
- gzip 响应读取 `res`；
- `id:` 和 `train_time:` 原样保留；
- 异常格式退化为 `raw_only`；
- 工具结果、日志和缓存不泄露测试凭据；
- Garmin 来源记录被过滤；
- 六类 V1 安全案例无回归。

预期：新增测试在 V1/空 MCP 状态下失败，以证明测试确实覆盖新能力。

## 6. 阶段二：训记连接器

### 6.1 错误模型

先定义稳定错误类型：

- `missing_credentials`
- `invalid_credentials`
- `invalid_date`
- `range_too_large`
- `rate_limited`
- `network_error`
- `invalid_response`
- `parse_partial`
- `cache_error`

每个错误包含用户可解释信息和可恢复建议，不包含请求头、Key、完整响应或堆栈。

### 6.2 API 客户端

实现 `xunji-client.js`：

- 固定调用 `POST https://trains.xunjiapp.cn/api_trains_for_llm`；
- Key 只注入 `Authorization: Bearer`；
- Body 仅含 `datestr`；
- 设置连接与响应超时；
- 验证 HTTP 状态、JSON、`success` 和 `res` 数组；
- 将鉴权、限流和网络错误映射为稳定错误；
- 不自动重试鉴权错误或同日期限流；
- 不记录请求头。

测试使用本地 mock HTTP server，不调用真实训记。

### 6.3 缓存服务

实现 `cache.js`：

- 路径为 `%LOCALAPPDATA%\HealthyFitnessCoach\xunji-cache\<fingerprint>\YYYY\MM\date.json`；
- 指纹使用单向摘要，不保存 Key；
- 支持读取、原子写入、单日删除和全部删除；
- 写入前验证 schema；
- 使用文件锁或进程内 promise map 合并同日期请求；
- 有效旧缓存不会被失败请求覆盖；
- 今天和历史日期遵循规格中的刷新规则。

### 6.4 解析器

实现 `parser.js`：

- 先保存完整原始字符串；
- 识别日期、`id:`、`train_time:`、训练名称、动作和组次 token；
- 不使用一次性简单逗号切分作为唯一解析方式；
- 未识别片段保留为备注或警告；
- 输出 `complete`、`partial` 或 `raw_only`；
- 保留重量单位，不擅自换算；
- 对极端数字只标记异常，不直接删除。

测试夹具覆盖：标准记录、无时间、无 ID、备注含逗号、空数组、未知 token、格式变化和多训练记录。

### 6.5 MCP 工具

实现：

- `xunji_get_training_day(date, refresh=false)`；
- `xunji_get_training_range(start_date, end_date, refresh_today=false)`。

两者均为只读工具。范围工具最多 90 天，只请求缓存缺失日期，并返回：

- `cache_hits`
- `network_fetches`
- `dates`
- `records`
- `warnings`
- `data_freshness`

工具结果在返回前执行凭据和敏感字段检查。

## 7. 阶段三：Skill V2 行为层

### 7.1 输出路由

新增 `references/output-routing.md`，明确：

- 今日训练、逐组反馈和动作调整走对话模式；
- 周期计划、数据分析和周/月复盘生成 Markdown；
- “直接出报告”“进入跟练”“保存刚才内容”覆盖默认行为；
- 只追问会改变安全或报告结构的信息；
- 无写入工具时输出完整 Markdown，并明确未创建文件。

### 7.2 训记使用规则

新增 `references/xunji-integration.md`：

- 优先读缓存；
- 没有授权时引导运行本机安全设置；
- 数据范围按任务最小化；
- 不要求用户把 Key 粘贴到聊天；
- 不写回训练；
- 保留 ID、时间和原始记录；
- 过滤 Garmin 来源数据；
- 解析不完整时降低结论置信度。

### 7.3 八维分析

新增 `references/multidimensional-analysis.md`，把八维矩阵、时间窗口、可比性和最小调整原则转为可执行决策步骤。

关键要求：

- 同动作、相近条件才比较表现；
- 训练容量不等同于刺激质量；
- 单次训练不判定平台期；
- 2～3 周只给初步趋势；
- 4 周以上才做训练量与频率比较；
- 8 周以上才讨论长期平台和周期结构；
- 每次最多调整 1～2 个变量。

### 7.4 联网路由

新增 `references/web-research.md`：

- 最新研究、博主观点、产品接口变化和用户提供网页时联网；
- 个人训练分析不强制联网；
- 优先 WebFetch 已知页面，再用 WebSearch 发现来源；
- 登录页面依次尝试可选 MCP、用户授权浏览器、截图/文本降级；
- 不绕过登录、验证码和反爬；
- 博主内容标记为经验层证据，并与高等级证据交叉核对。

### 7.5 报告模板

新增 `assets/fitness-analysis-report-template.md`，包含：

- 核心结论；
- 数据范围和缓存新鲜度；
- 数据质量与置信度；
- 八维分析；
- 保留项；
- 最多两个调整项；
- 下一周期计划；
- 验证指标；
- 安全和数据来源说明。

更新 `SKILL.md` 的任务路由、输出规则和 reference 导航，保持入口文件低于 500 行。

## 8. 阶段四：Plugin 打包

### 8.1 Plugin 清单

使用 `plugin-creator` 的官方结构创建 `.codex-plugin/plugin.json`，包含：

- Plugin 名称和描述；
- `healthy-fitness-coach` Skill；
- 训记 MCP stdio 启动配置；
- Windows 和 Node.js 兼容性说明；
- 不声明不存在的 WebSearch/WebFetch 工具；
- 将浏览器和小红书 MCP 作为可选能力，而非安装前提。

### 8.2 Skill 工具依赖

更新 `agents/openai.yaml`：

- 声明训记 MCP 核心工具依赖；
- 保留 Skill 独立运行的降级路径；
- 默认提示体现自动输出和数据分析能力；
- 不包含凭据、用户数据和机器绝对路径。

### 8.3 安装与授权说明

提供最短安装流程：

1. 安装 Plugin；
2. 在本机运行凭据设置脚本；
3. 重启或刷新 Codex 工具；
4. 使用“分析训记最近四周训练”进行首次调用；
5. 需要时运行删除凭据/缓存脚本。

真实接口 smoke test 前，用户必须通过安全脚本录入一枚新 Key，并提供一个有训练记录的日期。Key 不通过聊天传递。

## 9. 阶段五：验证与评测

### 9.1 静态和单元测试

执行：

- Node 单元测试；
- PowerShell Skill/Plugin 结构验证；
- JSON/YAML/manifest 解析；
- Secret pattern 扫描；
- 缓存与报告路径检查；
- `.gitignore` 检查；
- 包内容与源目录一致性检查。

不得在测试命令、测试输出或 fixture 中使用用户真实 Key。

### 9.2 Mock 集成测试

用本地 mock server 验证：

- gzip 成功响应；
- 空训练日；
- 缺少 Key；
- 无效 Key；
- 90 秒限流；
- 非 JSON；
- `success=false`；
- 响应超时；
- 缓存命中与失败回退；
- 同日期并发合并。

### 9.3 Skill 成对评测

建立 `iteration-2`，使用 V1 快照作为 baseline。重点评测：

- 自动输出模式；
- 真实 Markdown 文件交付；
- 八维分析与证据边界；
- 缓存信息表达；
- 工具不可用时降级；
- 不泄漏凭据；
- V1 安全案例全部保持。

按 `skill-creator` 流程生成：

- `evals.json`
- 每例 `eval_metadata.json`
- with-skill 与 V1 baseline 输出；
- 逐条重算的 `grading.json`；
- `benchmark.json` / `benchmark.md`；
- 使用官方 `generate_review.py` 生成静态 `review.html`。

### 9.4 可选真实接口 smoke test

仅在以下条件同时满足时执行一次只读测试：

- 用户已用 DPAPI 脚本录入新 Key；
- 用户提供明确训练日期；
- 测试确认不会输出请求头或凭据；
- 本地缓存为空或用户允许刷新；
- 调用结果只用于验证工具和生成用户请求的报告。

测试后检查工具记录、缓存、报告和 Git diff 中不存在凭据。

## 10. 提交拆分

建议提交顺序：

1. `test: define fitness coach v2 behavior and connector contracts`
2. `feat: add secure read-only xunji connector`
3. `feat: add fitness coach v2 report and analysis workflow`
4. `feat: package fitness coach plugin`
5. `test: evaluate fitness coach v2 against v1`
6. `docs: add installation privacy and data deletion guide`

每个提交前运行相关测试和 `git diff --check`，不混入个人训练数据或缓存。

## 11. 最终验收清单

- [ ] V1 快照可复现；
- [ ] 新增测试先失败、实现后通过；
- [ ] MCP 只暴露两个只读训练读取工具；
- [ ] Key 只存在于 DPAPI 加密凭据中；
- [ ] 同日期缓存命中不产生网络请求；
- [ ] 90 秒刷新限制在客户端生效；
- [ ] 原始文本、ID 和训练时间不丢失；
- [ ] 解析失败不会生成虚假结构；
- [ ] 自动对话/Markdown 路由符合规格；
- [ ] 报告包含八维分析、置信度和最多两个调整项；
- [ ] 联网仅按需触发；
- [ ] 小红书不可访问时安全降级；
- [ ] Garmin 来源数据不进入模型分析；
- [ ] 六类安全红旗评测全部通过；
- [ ] V2 与 V1 对比审阅页可打开；
- [ ] 更新版 `.skill` 和 Plugin 均完成打包；
- [ ] Git 工作区干净，仓库中无凭据、缓存或用户报告。

## 12. 实施停点

计划获得用户批准后才开始阶段一。出现以下情况时停止并请求用户决策：

- 官方接口行为与说明明显不一致；
- 需要使用未公开写入接口；
- DPAPI 或 Plugin 环境无法在目标 Codex 表面运行；
- 返回数据无法判断 Garmin 或其他受限来源且会影响合规；
- 真实 smoke test 需要用户重新授权或提供训练日期；
- 实现需要扩大到 Keep、小红书自建 MCP 或云端数据库。
