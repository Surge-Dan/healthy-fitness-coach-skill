# Task 11：成对评测与静态审查页

## STATUS

GREEN。基于旧版快照 `180549f30a7579d5f4c2733ee662f64229531e78`，为评测 ID 13–18 新增可复现的静态成对审查产物；没有调用模型，也没有伪造新版或旧版自然语言输出。

## 交付

- `healthy-fitness-coach/evals/paired-evaluation.js`：仅用 Node 内置模块读取当前 Skill、旧版快照和评测定义，生成结构化静态断言与离线 HTML。
- `healthy-fitness-coach/evals/paired-evaluation-results.json`：六个场景的可机读结果。每项显式为 `static_source_contract`、`model_outputs_recorded: false`，并列出源码路径、哈希和人工审查清单。
- `healthy-fitness-coach/evals/paired-evaluation-review.html`：自包含中文审查页；显示新版/旧版静态证据、边界说明和不持久化的人工粘贴框。
- `healthy-fitness-coach/tests/paired-evaluation.test.js`：锁定 ID 13–18、快照提交、无模型输出字段、人工项、页面存在和零密钥/照片内容门禁。

## 静态结果

- ID 13：新版明确“简单知识问题不建档”；旧快照无任务编排契约。
- ID 14：新版声明训练计划的结构化缺口和追问状态；旧快照无该模块。
- ID 15：新版有画像/当前计划模板，并规定已知稳定字段不重复追问。
- ID 16：新版隔离稳定画像与今日状态，并有准备度模块。
- ID 17：新版复盘引擎输出事实、推断、不确定性、验证，且调整上限为两个。
- ID 18：对同一条合成记录，新旧 DNA 引擎都保留低置信度和未知维度；这是正确性对照，不能声称新版优于旧版。

## RED / GREEN

- RED：先新增测试并运行 `node --test healthy-fitness-coach/tests/paired-evaluation.test.js`；因 `paired-evaluation.js` 不存在而以 `MODULE_NOT_FOUND` 失败。
- GREEN：实现最小生成器后，修正测试夹具的项目根目录，专用测试 2/2 通过；再生成结果和审查页。

## 验证

- `node healthy-fitness-coach/evals/paired-evaluation.js`：生成 JSON 与 HTML。
- `node --test (Get-ChildItem 'healthy-fitness-coach/tests' -Filter '*.test.js').FullName`：195/195 通过。
- `node quality-tests/run-training-os-baseline.js`：通过，62 个快照文件；12 条旧评测 + 6 条新增评测。
- `node quality-tests/run-training-system.js`、`node quality-tests/run-knowledge-base.js`：通过。
- `python -X utf8 C:\Users\Daniel\.codex\skills\skill-creator\scripts\quick_validate.py healthy-fitness-coach`：`Skill is valid!`。
- 结果 JSON 与 HTML 的静态扫描：未发现密钥标识、图片数据 URI 或图片标签；页面不引用外部资源。
- `git diff --check`：通过。

## concerns

- 任务约束禁止伪造模型输出，因此本次不能证明“新版自然语言输出明显优于旧版”，也不能给出真实 Token/耗时结论。页面已经把相同模型/设置/隔离会话下的完整输出、Token 和耗时记录为人工审查项。
- ID 18 的确定性 DNA 引擎在新旧版本均正确保持低置信度；它是安全回归而不是新版优势证据。
- 生成脚本是开发期评测工具，只使用 Node 内置模块，不接入 Skill 运行时，不引入依赖。
- 工作树已有 `dist/healthy-fitness-coach.skill` 修改和未跟踪 `dist/healthy-fitness-coach.zip`；本任务未读取、修改或暂存它们。
