# 训记训练数据：读取、趋势与安全写回

训记是可选的数据连接器。用户首次提到训记时，先询问是否确认连接。用户确认后，可以直接提供官方导入/导出说明、截图或接口文档和 API Key；优先使用当前运行环境可用的 HTTPS/shell 能力按用户提供的官方规则临时调用，不要求普通用户安装 Node 或 Plugin。没有确认、接口规则、网络能力或有效凭据时，降级为用户粘贴的导出文本/手工日志，并明确证据来源。

## 普通用户连接流程

1. 先问：“是否确认连接训记？”未确认时不访问训记。
2. 用户确认后，接收官方说明文本、截图或文档，以及 API Key。截图中的 Key 只用于解析和本次请求，绝不在回复中复述。
3. 从官方材料提取 Base URL、路径、方法、鉴权方式、必填参数、gzip/JSON 解码和错误规则；只调用用户明确提供的训记接口。
4. 读取成功后保留 `res` 中的原始训练行、`id:` 和 `train_time:`，按日期缓存；同一天 90 秒内不重复刷新。
5. 若当前环境没有可用的 HTTPS/shell 工具，立即说明限制并请求用户粘贴导出结果，不要让用户安装开发依赖来完成一次性分析。

Key 只存在于当前调用过程或受运行环境保护的凭据存储中，不写入项目、日志、Markdown、HTML、报告、缓存内容或 Git。

## 工具路由

- `xunji_get_training_day`：读取一个日期，优先使用本地缓存。
- `xunji_get_training_range`：读取最小必要日期范围，返回成功日期、缺失日期、缓存/网络来源和原始记录 ID。
- `xunji_get_training_trends`：读取范围并返回结构化趋势与本地自包含 HTML 面板内容。
- `xunji_extract_training_dna`：读取缓存训练范围并先生成标准复盘 facts + decision，再消费它们分别分析阻力与有氧反应，生成带证据范围和置信度的训练DNA，并在本机按账号指纹保存版本与变更记录；原始训练行不得绕过复盘层直接成为默认DNA证据。
- `xunji_preview_training_upsert`：只校验和展示写回预览，不联网、不修改记录。
- `xunji_upsert_training_records`：仅在用户明确确认后调用，按训练 ID upsert。

## 读取规则

连接器调用 `/api_trains_for_llm`，使用 `datestr: YYYY-MM-DD` 和本机 DPAPI 凭据。响应可能是 gzip JSON，核心数据在 `res` 数组中。保留每条记录的原始文本、`id:`、`train_time:`、`record_date`、`fetched_at`、缓存命中状态和警告。

同一训练日 90 秒内不要重复刷新。历史日期默认读取缓存；只在用户明确要求刷新或分析当前日期时传 `refresh`/`refresh_today`。缓存按凭据 fingerprint 隔离，不能跨账号复用。

## 趋势模式

用户请求趋势面板时调用 `xunji_get_training_trends`，再把返回的 `dashboard_html` 保存为工作区 `fitness-reports/` 下的非 PII 文件。报告必须说明：

- 日期范围与数据新鲜度；
- 训练日数、记录数、组数、次数和可解析训练量；
- 每周训练频率和训练量；
- 动作/训练主题频次；
- 缺失日期、解析警告和无法结构化的原文数量。

HTML 不得加载外部 CDN，不得上传用户数据。文件名冲突时使用 `references/report-artifact.js` 追加后缀，不覆盖既有文件。

## 训练DNA模式

用户要求“提炼训练DNA”“建立训练系统”或“更新下一周期”时调用 `xunji_extract_training_dna`。它先复用训练日缓存，生成标准复盘 facts + decision，再由DNA消费层读取，不在DNA层重新解释原始记录；最后返回八类DNA维度、事实/推断边界、未知项、证据台账和版本变更。首次样本只标记为观察中；连续2～3个复盘窗口且条件可比时，才允许提升置信度。

DNA版本只保存在本机`HealthyFitnessCoach/training-dna/`，文件名使用账号单向fingerprint，不保存API Key或原始凭据。读取失败时可以继续返回当前分析，但必须标记未持久化；不得为了生成完整DNA而填补缺失训练数据。

## 写回规则

写回使用 `/api_upsert_trains_for_llm`，不是整天覆盖删除：

1. 先调用 `xunji_preview_training_upsert`；
2. 确认 `res` 是非空字符串数组、最多 12 条、每条不超过 1500 字符；
3. 确认所有记录都属于同一天，支持 `YYYY-MM-DD` 或 `YYMMDD`；
4. 修改已有记录必须保留原导出中的 `id:...`；有 `train_time:...` 时原样带回；
5. 只有用户明确确认后，调用 `xunji_upsert_training_records` 并传 `confirm: true`；
6. 写入成功后，以服务端返回的 `res` 作为最终结果并更新当天缓存；
7. 不在本次 `res` 中的旧训练不会被删除。

写回工具是唯一的非只读工具。写回前后保留日期、训练 ID、时间 token 和原始行；失败时不伪造成功结果。

## 隐私与安全

- 不在聊天内容、日志、Markdown、HTML、结构化输出或 Git 中保存 API key；
- 使用本机 `set-credential.ps1` 通过 Windows DPAPI 保存和读取凭据，不要求用户在对话中粘贴 key；
- Garmin 来源记录在面向模型输出前过滤；来源未知时降低置信度；
- 红旗症状或数据不完整时，安全分流优先于读取、趋势分析和写回；
- 真实账号 smoke test 只在用户本机配置凭据后手动触发，自动化测试使用 mock/fixture。
