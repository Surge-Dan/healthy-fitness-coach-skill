# ATHLETE_PROFILE

- 资料来源：{{source_or_unknown}}
- 日期：{{date_or_unknown}}
- 是否同意持久化：{{persisted_or_unknown}}
- 未知项：{{unknown_fields}}

## 稳定画像

- 主目标：{{goal}}
- 训练经验：{{experience_level}}
- 每周可稳定训练次数：{{training_days_per_week}}
- 通常单次时长（分钟）：{{available_time_min}}
- 常用场地：{{training_venue}}
- 常用器械：{{available_equipment}}
- 安全限制/伤病医疗约束：{{injury_or_medical_constraints}}
- 长期偏好：{{long_term_preferences}}

## 当前状态（仅本轮训练）

- 睡眠：{{sleep}}
- 压力：{{stress}}
- 疲劳：{{fatigue}}
- 疼痛或不适：{{pain}}
- 当天可用时间（分钟）：{{current_available_time_min}}
- 临时器械：{{temporary_equipment}}

## 证据状态（用于复盘）

- 训练记录：{{training_records}}
- 完成率：{{completion_rate}}
- 表现：{{performance}}
- 恢复结果：{{recovery_results}}

## 使用说明

只填写用户明确提供的白名单字段；未知项保持未知。当前状态不写入稳定画像，拒绝持久化时仅在当前对话使用。稳定字段被用户明确更新时，在 `DECISION_LOG.md` 记录旧值、新值、来源和日期。此模板不代表 Agent 已获得永久记忆，也不保存 API Key、联系方式、证件信息、账号口令或无关隐私。
