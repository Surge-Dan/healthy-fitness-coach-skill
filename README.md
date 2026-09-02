<div align="center">

# 🏋️ Healthy Fitness Coach

### 面向普通成年人的健康训练 Skill

[![License: MIT](https://img.shields.io/badge/License-MIT-2f80ed.svg)](LICENSE)
[![Platform: Codex](https://img.shields.io/badge/Platform-Codex-111827.svg)](healthy-fitness-coach/SKILL.md)
[![Xunji Integration](https://img.shields.io/badge/Xunji-Optional-16a34a.svg)](healthy-fitness-coach-plugin/)
[![Local-first](https://img.shields.io/badge/Data-Local--first-f97316.svg)](#隐私与安全)

**把计划、执行、恢复和复盘串成一个可验证的训练闭环。**

</div>

Healthy Fitness Coach 面向 18～55 岁、无重大疾病的健身新手与普通进阶者。它会先识别简单问题或训练任务，执行安全门，再按已有画像、当前计划和信息充分度进入相应场景；普通请求不会被强制变成长问卷。

## 直接开始

安装 [`healthy-fitness-coach/SKILL.md`](healthy-fitness-coach/SKILL.md) 后，直接用自然语言说一句话即可：

```text
帮我制定训练计划
今天怎么练
帮我做一次周复盘
建立我的训练DNA
做一张训练分享图
```

用户不需要了解内部引擎名称。已有画像和当前周期会被优先复用；只有会改变安全性或方案结构的缺口才会被追问。今日训练缺少非关键上下文时，会明确保守假设并给出可执行的最低任务。

## 已实现的任务路由

| 你可以说 | 默认处理 | 默认交付 |
| --- | --- | --- |
| “帮我制定训练计划” | 读取目标、经验、时间、器械和安全约束，生成周期安排 | `ATHLETE_PROFILE.md`、`CURRENT_PROGRAM.md`、`TRAINING_PLAN_INDEX.md` |
| “今天怎么练” | 先判断红旗、疼痛、疲劳、睡眠和可用时间，再给当天训练 | 对话；说“保存刚才内容”才生成 `TODAY_WORKOUT.md` |
| “帮我做一次周复盘” | 根据训练记录区分事实、判断、不确定性和少量调整 | `WEEKLY_REVIEW.md`、`DECISION_LOG.md`、`TRAINING_REVIEW_INDEX.md` |
| “建立我的训练DNA” | 建立或更新画像、训练DNA、当前周期和决策记录 | 四份长期训练资产与 `TRAINING_SYSTEM_INDEX.md` |
| “分析最近4周训记，生成趋势面板” | 读取最小日期范围，优先缓存，生成分析和趋势面板 | `TRAINING_ANALYSIS.md` 与 `training-dashboard.html` |
| “做一张训练分享图” | 以真实照片或训练数据为来源，先生成事实层再生成视觉资产 | `SHARE_FACTS.md`、`SHARE_CARD.png` 与 `SHARE_OUTPUT_INDEX.md` |

简单的训练知识问题直接回答，不创建画像或文件资产。多文件交付会提供索引并使用 `-2`、`-3` 等后缀避开已有文件；不会覆盖无关报告。

## 训练闭环

1. **安全门**：红旗症状固定进入安全分流；一般不适只在无红旗时小幅调整，并安排 24～48 小时复评。
2. **画像与计划**：只记录用户明确提供、会改变决策的字段；稳定画像、当天状态和训练证据彼此隔离。
3. **场景引擎**：计划、今日训练、复盘、训记分析、训练DNA和分享分别读取对应知识参考，不复制整套引擎实现。
4. **可执行资产**：计划包含动作、组次/时长、强度、休息、替代、最低任务和进阶/降级条件；报告保留数据范围和事实/推断边界。
5. **反馈决策**：记录完成情况、RPE/RIR、疼痛或有氧时长、恢复等最少指标，每轮最多调整 1～2 个变量，并记录理由、回退条件和下一次验证。

## 训练DNA与复盘

训练DNA不是根据一次对话或一张截图猜出的标签，而是从标准化复盘事实与决策中逐步形成的可审计假设。结果会保留证据范围、来源记录、支持事实、反证、混杂因素、置信度和下一次验证条件：

- 一个复盘窗口只能形成观察假设；至少两个可比较窗口才进入候选规律；数据完整、单位一致且证据不重复时才提高置信度。
- 缺失日期、混合单位、记录不足或恢复结果不可关联时标记未知，不生成平台期或身体结论。
- 默认长期资产为 `ATHLETE_PROFILE.md`、`TRAINING_DNA.md`、`CURRENT_PROGRAM.md` 和 `DECISION_LOG.md`；动作库、流水账和完整周期文件按用户需要生成。

不连接训记时，也可粘贴手工日志、导出文本或标准化 JSON。连接训记后，读取与训练DNA提取优先消费复盘 facts + decision；原始训练行不是默认 DNA 上游。

## 来源与证据边界

知识库当前维护 25 张中外专业来源卡、71 条公开链接，覆盖训练启动、动作执行、阻力/无氧、肌肥大、力量、有氧/耐力、疼痛回归、营养和行为改变。来源卡只提炼可复用原则，不复制个人课表，也不把名气当作证据。

裁决顺序是：**健康指南与安全边界 → 原始研究和系统综述 → 专业团队与研究转译 → 创作者执行体验**。人物专属问题先经过“可回答 / 需要检索 / 未知人物”证据门；最新观点、卡片外细节和受限页面不会被猜测或绕过登录、验证码、robots、反爬限制。完整记录见 [`creator-cards.md`](healthy-fitness-coach/references/creator-cards.md)、[`creator-query-protocol.md`](healthy-fitness-coach/references/creator-query-protocol.md)、[`research-ledger.md`](healthy-fitness-coach/references/research-ledger.md) 和 [`evidence-rules.md`](healthy-fitness-coach/references/evidence-rules.md)。

## 训记与本地使用

说“我想连接训记”后，提供训记官方导入/导出说明、截图或接口文档，并在需要时提供 Open API Key。Skill 只按说明识别接口和返回格式：

- 读取使用最小日期范围和缓存优先；分析保留训练 ID 与训练时间。
- 写回前先预览，确认日期、记录数量、字符长度和已有 ID；只有用户明确确认后才写回。
- 没有连接器或有效凭据时，降级为手工日志或粘贴导出文本，不要求普通用户安装 Node 或运行命令。

不需要训记时，独立 Skill 可直接通过对话生成计划、今日训练、复盘 Markdown 和训练分享图。希望在本机长期读取训记时，可选使用 [`healthy-fitness-coach-plugin/`](healthy-fitness-coach-plugin/)。

## 隐私与安全

- 画像只接收与训练决策相关的明确字段；未知项保持未知，不把联系方式、证件、账号口令或无关隐私写入训练资产。
- API Key 只用于当前本地连接，不写入代码、README、Markdown、报告或回复；不在日志中回显。用户拒绝持久化时，结果仅限本轮候选状态。
- 训练缓存、报告和运行日志默认保存在本地，不提交到 GitHub；分析报告默认不嵌入原图，照片分享图仅在用户明确要求时保留照片像素。
- 本 Skill 不提供普通医学问诊、疾病诊断或专项康复，不提供竞技备赛、PED/药物指导、脱水减重或极端减脂方案。
- 出现胸痛、呼吸困难、晕厥、异常心悸、进行性麻木无力、急性严重外伤等红旗症状时，停止自动训练处方并寻求合适的医疗评估。

本项目不能替代医生、康复师或营养师的诊断与治疗。训练建议应结合自身健康状况，由用户对最终决定负责。

## 项目文件

```text
healthy-fitness-coach/            # 独立 Skill，入口为 SKILL.md
healthy-fitness-coach/references/ # 编排、画像、训练领域、证据与输出规则
healthy-fitness-coach/assets/     # 画像、周期、日志与长期训练资产模板
healthy-fitness-coach/scripts/    # 训练DNA、视觉编译和本地渲染工具
healthy-fitness-coach-plugin/     # 可选训记连接器与本地 MCP
quality-tests/                    # 知识库、行为、视觉和发布质量门禁
dist/                             # 可分发的独立 Skill 包
LICENSE                           # MIT License
```

## 许可证

本项目采用 [MIT License](LICENSE)。第三方依赖、字体、图标、图片和外部数据仍需遵守各自许可证或服务条款。
