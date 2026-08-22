'use strict';

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function list(value) { return Array.isArray(value) ? value.filter(Boolean).map(String) : []; }

function buildTrainingGuidance(input = {}) {
  const trends = input.trends && typeof input.trends === 'object' ? input.trends : {};
  const goal = String(input.goal || input.profile?.goal || 'general_fitness').toLowerCase();
  const flags = list(input.red_flags || input.safety?.red_flags);
  const pain = list(input.pain || input.symptoms);
  const missing = list(trends.missing_dates);
  const hasRecords = (finite(trends.record_count) || 0) > 0 || (finite(trends.training_days) || 0) > 0;
  const dataQuality = !hasRecords ? 'empty' : (missing.length || ['mixed', 'unknown'].includes(trends.data_freshness) ? 'partial' : 'complete');
  const safety = flags.length ? { level: 'stop', reason_code: 'red_flag', message: '出现需要线下评估的危险信号，先停止训练建议。' } : pain.length ? { level: 'caution', reason_code: 'pain_feedback', message: '存在疼痛或不适，先降低负荷并观察，不把疼痛当成训练效果。' } : { level: 'proceed', reason_code: 'no_red_flag', message: '未提供需要立即转介的危险信号。' };
  const facts = [{ code: 'training_days', value: finite(trends.training_days) || 0, label: '有效训练天数' }, { code: 'record_count', value: finite(trends.record_count) || 0, label: '可分析记录数' }];
  if (finite(trends.total_sets) !== undefined) facts.push({ code: 'total_sets', value: trends.total_sets, label: '总组数' });
  if (finite(trends.aerobic_minutes) !== undefined) facts.push({ code: 'aerobic_minutes', value: trends.aerobic_minutes, label: '有氧分钟数' });
  const judgments = []; const actions = []; const nextValidation = [];
  if (dataQuality !== 'complete') judgments.push({ code: 'insufficient_data', confidence: 'low', text: '数据不完整，只能做方向性建议，不能判断长期效果。' });
  if (safety.level === 'stop') { actions.push({ code: 'seek_professional_assessment', priority: 'urgent', text: '停止自动训练处方，按危险信号寻求专业评估。' }); nextValidation.push({ code: 'clear_safety_screen', text: '重新开始前确认症状已由专业人员评估。' }); }
  else if (safety.level === 'caution') {
    actions.push({ code: 'reduce_load_and_range', priority: 'high', text: '先降低负荷和动作幅度，避开诱发疼痛的动作，不追求加重或增加训练量。' });
    actions.push({ code: 'choose_pain_free_variant', priority: 'medium', text: '只保留无痛或明显更舒适的动作变式；若疼痛加重，停止该动作并寻求专业评估。' });
    nextValidation.push({ code: 'reassess_in_24_to_48_hours', text: '观察24–48小时的疼痛、活动范围和日常功能，再决定是否逐步恢复。' });
  }
  else {
    const frequency = finite(input.frequency_per_week) ?? finite(input.planned_sessions_per_week) ?? 2;
    if (['hypertrophy', 'strength', 'upper_body', 'general_fitness'].some((term) => goal.includes(term))) { if ((finite(trends.training_days) || 0) < 2 || frequency <= 2) actions.push({ code: 'minimum_effective_dose', priority: 'high', text: '先安排每周2次全身或上下肢交替训练，每次保留1–3次余力，连续记录4周。' }); actions.push({ code: 'progressive_overload', priority: 'medium', text: '在动作稳定且目标次数完成时，只增加一个变量：小幅加重、增加次数或增加一组。' }); nextValidation.push({ code: 'log_rpe_or_rir', text: '每个主动作记录RPE或RIR、完成情况和疼痛评分。' }); }
    if (['aerobic', 'endurance', 'cardio'].some((term) => goal.includes(term))) { actions.push({ code: 'easy_aerobic_progression', priority: 'high', text: '以能完整说短句的轻中等强度为主，每周增加时长或频率中的一个变量。' }); nextValidation.push({ code: 'log_duration_and_heart_rate', text: '记录时长、距离和平均心率，避免只用主观疲劳判断进步。' }); }
    if (goal.includes('fat') || goal.includes('weight')) actions.push({ code: 'daily_activity_baseline', priority: 'medium', text: '先稳定力量训练和日常活动，再用2–3周体重趋势调整饮食，不采用极端节食。' });
    if (dataQuality !== 'complete') actions.push({ code: 'complete_missing_log', priority: 'medium', text: '先补齐缺失日期或标记休息日，再比较训练量和依从性。' });
    if (!actions.length) actions.push({ code: 'start_small', priority: 'medium', text: '从可持续的每周2次、每次30–60分钟开始，逐步增加而不是一次堆满计划。' });
    nextValidation.push({ code: 'review_after_two_to_four_weeks', text: '连续2–4周后复盘训练频率、表现、恢复和不适，再调整计划。' });
  }
  if (safety.level === 'proceed' && dataQuality === 'complete') judgments.push({ code: 'usable_baseline', confidence: hasRecords ? 'medium' : 'low', text: '当前记录可用于制定下一步行动，但不等于已经证明某种训练对你长期有效。' });
  return { goal, safety, data_quality: dataQuality, facts, judgments, actions, next_validation: nextValidation };
}

module.exports = { buildTrainingGuidance };
