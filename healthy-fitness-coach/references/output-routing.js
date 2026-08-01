'use strict';

const CONVERSATION_TASKS = new Set([
  'today_workout',
  'set_by_set_coaching',
  'exercise_adjustment',
  'form_adjustment',
  'immediate_symptom',
  'safety_routing'
]);

const MARKDOWN_TASKS = new Set([
  'training_plan',
  'weekly_review',
  'monthly_review',
  'training_data_analysis',
  'reusable_plan',
  'reusable_report',
  'user_profile'
]);

function normalizeInstruction(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\u3000\p{P}\p{S}_-]+/gu, '');
}

function hasEnglishCommand(instruction, pattern) {
  return pattern.test(String(instruction || ''));
}

function explicitOverride(instruction) {
  const normalized = normalizeInstruction(instruction);
  if (normalized.includes('直接出报告') || normalized.includes('直接输出报告') || hasEnglishCommand(instruction, /(?:^|[^a-z0-9])direct[\s\p{P}\p{S}_-]+report(?=$|[^a-z0-9])/iu)) {
    return { mode: 'markdown', reason: 'explicit_command', override: 'direct_report' };
  }
  if (normalized.includes('进入跟练') || normalized.includes('开始跟练') || hasEnglishCommand(instruction, /(?:^|[^a-z0-9])enter[\s\p{P}\p{S}_-]+tracking(?=$|[^a-z0-9])/iu)) {
    return { mode: 'conversation', reason: 'explicit_command', override: 'enter_tracking' };
  }
  if (normalized.includes('保存刚才内容') || normalized.includes('把刚才内容保存下来') || hasEnglishCommand(instruction, /(?:^|[^a-z0-9])save[\s\p{P}\p{S}_-]+(?:the[\s\p{P}\p{S}_-]+)?prior[\s\p{P}\p{S}_-]+content(?=$|[^a-z0-9])/iu)) {
    return { mode: 'markdown', reason: 'explicit_command', override: 'save_prior_content' };
  }
  return null;
}

function routeOutput({ taskType, userInstruction } = {}) {
  const override = explicitOverride(userInstruction);
  if (override) return override;
  if (MARKDOWN_TASKS.has(taskType)) return { mode: 'markdown', reason: 'default_task_type', override: null };
  return { mode: 'conversation', reason: 'default_task_type', override: null };
}

module.exports = { routeOutput };
