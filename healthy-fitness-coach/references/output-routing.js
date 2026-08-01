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
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u3000\p{P}\p{S}_-]+/gu, '');
}

function normalizeCommandText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/gu, "'")
    .replace(/[\u2010-\u2015\u2212]/gu, '-')
    .replace(/-/g, ' ');
}

function hasUnnegatedChineseCommand(normalized, commands) {
  for (const command of commands) {
    let index = normalized.indexOf(command);
    while (index !== -1) {
      const prefix = normalized.slice(Math.max(0, index - 12), index);
      if (!/(?:不想|不要|不需要|无需|不必|别|拒绝|勿)(?:再)?(?:给我)?$/u.test(prefix)) return true;
      index = normalized.indexOf(command, index + command.length);
    }
  }
  return false;
}

function isNegatedEnglishContext(prefix) {
  const context = prefix
    .replace(/[\u2018\u2019\u02bc]/gu, "'")
    .replace(/[\u2010-\u2015\u2212]/gu, ' ')
    .replace(/[^a-z0-9']+/giu, ' ')
    .trim()
    .split(/\s+/u)
    .slice(-8)
    .join(' ');
  return /(?:^|\s)(?:do not|don't|dont)(?:\s+(?:want|need)(?:\s+(?:a|to))?)?$/iu.test(context)
    || /(?:^|\s)not\s+want(?:\s+(?:a|to))?$/iu.test(context)
    || /(?:^|\s)(?:no need(?:\s+to)?|refuse(?:\s+to)?|never)$/iu.test(context);
}

function hasUnnegatedEnglishCommand(text, pattern) {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const commandStart = match.index + match[0].lastIndexOf(match[1]);
    if (!isNegatedEnglishContext(text.slice(0, commandStart))) return true;
  }
  return false;
}

function explicitOverride(instruction) {
  const normalized = normalizeInstruction(instruction);
  const commandText = normalizeCommandText(instruction);
  if (hasUnnegatedChineseCommand(normalized, ['直接出报告', '直接输出报告']) || hasUnnegatedEnglishCommand(commandText, /(?:^|[^a-z0-9])(direct(?:ly)?[\s\p{P}\p{S}_-]+report)(?=$|[^a-z0-9])/giu)) {
    return { mode: 'markdown', reason: 'explicit_command', override: 'direct_report' };
  }
  if (hasUnnegatedChineseCommand(normalized, ['进入跟练', '开始跟练']) || hasUnnegatedEnglishCommand(commandText, /(?:^|[^a-z0-9])(enter[\s\p{P}\p{S}_-]+tracking)(?=$|[^a-z0-9])/giu)) {
    return { mode: 'conversation', reason: 'explicit_command', override: 'enter_tracking' };
  }
  if (hasUnnegatedChineseCommand(normalized, ['保存刚才内容', '把刚才内容保存下来']) || hasUnnegatedEnglishCommand(commandText, /(?:^|[^a-z0-9])(save[\s\p{P}\p{S}_-]+(?:the[\s\p{P}\p{S}_-]+)?prior[\s\p{P}\p{S}_-]+content)(?=$|[^a-z0-9])/giu)) {
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
