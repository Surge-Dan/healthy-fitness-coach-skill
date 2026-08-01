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

function hasUnnegatedChineseCommand(normalized, commands) {
  for (const command of commands) {
    let index = normalized.indexOf(command);
    while (index !== -1) {
      const prefix = normalized.slice(Math.max(0, index - 4), index);
      if (!/(?:不想|不要|不必|别|勿)(?:再)?$/u.test(prefix)) return true;
      index = normalized.indexOf(command, index + command.length);
    }
  }
  return false;
}

function hasUnnegatedEnglishCommand(instruction, pattern) {
  const text = String(instruction || '');
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const commandStart = match.index + match[0].lastIndexOf(match[1]);
    const prefix = text.slice(0, commandStart).replace(/[\s\p{P}\p{S}_-]+$/gu, '');
    if (!/(?:\bdo\s+not|\bdon'?t|\bdont|\bnever)$/iu.test(prefix)) return true;
  }
  return false;
}

function explicitOverride(instruction) {
  const normalized = normalizeInstruction(instruction);
  if (hasUnnegatedChineseCommand(normalized, ['直接出报告', '直接输出报告']) || hasUnnegatedEnglishCommand(instruction, /(?:^|[^a-z0-9])(direct(?:ly)?[\s\p{P}\p{S}_-]+report)(?=$|[^a-z0-9])/giu)) {
    return { mode: 'markdown', reason: 'explicit_command', override: 'direct_report' };
  }
  if (hasUnnegatedChineseCommand(normalized, ['进入跟练', '开始跟练']) || hasUnnegatedEnglishCommand(instruction, /(?:^|[^a-z0-9])(enter[\s\p{P}\p{S}_-]+tracking)(?=$|[^a-z0-9])/giu)) {
    return { mode: 'conversation', reason: 'explicit_command', override: 'enter_tracking' };
  }
  if (hasUnnegatedChineseCommand(normalized, ['保存刚才内容', '把刚才内容保存下来']) || hasUnnegatedEnglishCommand(instruction, /(?:^|[^a-z0-9])(save[\s\p{P}\p{S}_-]+(?:the[\s\p{P}\p{S}_-]+)?prior[\s\p{P}\p{S}_-]+content)(?=$|[^a-z0-9])/giu)) {
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
