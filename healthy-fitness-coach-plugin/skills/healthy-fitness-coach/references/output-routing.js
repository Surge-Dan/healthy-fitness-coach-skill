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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/gu, "'")
    .replace(/[\u2010-\u2015\u2212]/gu, '-')
    .replace(/-/g, ' ');
}

function splitClauses(instruction) {
  return normalizeText(instruction)
    .replace(/[?？]/gu, '?|')
    .replace(/[;；。！!\r\n]+/gu, '|')
    .replace(/(但是|不过|然后|之后|接着|随后|后来|现在|但)/gu, '|')
    .replace(/\b(then|but|however)\b/giu, '|')
    .split('|')
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function stripChineseAffirmativeDecorations(clause) {
  let value = clause.replace(/[\s\u3000\p{P}\p{S}_]+/gu, '');
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of ['请', '帮我', '麻烦', '我要', '我想', '现在', '那就', '还是']) {
      if (value.startsWith(prefix)) {
        value = value.slice(prefix.length);
        changed = true;
      }
    }
  }
  for (const suffix of ['谢谢', '一下', '好吗', '吧', '呀', '啊']) {
    if (value.endsWith(suffix)) value = value.slice(0, -suffix.length);
  }
  return value;
}

function stripEnglishAffirmativeDecorations(clause) {
  let value = clause.replace(/[^a-z0-9']+/giu, ' ').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of ['please ', 'can you ', 'could you ', 'i want ', "let's ", 'then ', 'now ']) {
      if (value.startsWith(prefix)) {
        value = value.slice(prefix.length);
        changed = true;
      }
    }
  }
  for (const suffix of [' please', ' now', ' for me', ' thanks', ' thank you']) {
    if (value.endsWith(suffix)) value = value.slice(0, -suffix.length);
  }
  return value;
}

function explicitOverrideForClause(clause) {
  if (/[?？]|(?:吗|么|是否|如何|怎么)/u.test(clause) || /^(?:can|could|do|does|did|would|will|are|is)\s+you\b/iu.test(clause)) return null;
  if (/[\u4E00-\u9FFF]/u.test(clause)) {
    const value = stripChineseAffirmativeDecorations(clause);
    if (value === '直接出报告' || value === '直接输出报告') return 'direct_report';
    if (value === '进入跟练' || value === '开始跟练') return 'enter_tracking';
    if (value === '保存刚才内容' || value === '把刚才内容保存下来') return 'save_prior_content';
    return null;
  }
  const value = stripEnglishAffirmativeDecorations(clause);
  if (value === 'direct report' || value === 'directly report' || value === 'a direct report') return 'direct_report';
  if (value === 'enter tracking') return 'enter_tracking';
  if (value === 'save prior content' || value === 'save the prior content') return 'save_prior_content';
  return null;
}

function explicitOverride(instruction) {
  const matches = new Set();
  for (const clause of splitClauses(instruction)) {
    const override = explicitOverrideForClause(clause);
    if (override) matches.add(override);
  }
  const override = ['direct_report', 'enter_tracking', 'save_prior_content'].find((candidate) => matches.has(candidate));
  return override ? {
    mode: override === 'enter_tracking' ? 'conversation' : 'markdown',
    reason: 'explicit_command',
    override
  } : null;
}

function routeOutput({ taskType, userInstruction } = {}) {
  const override = explicitOverride(userInstruction);
  if (override) return override;
  if (MARKDOWN_TASKS.has(taskType)) return { mode: 'markdown', reason: 'default_task_type', override: null };
  return { mode: 'conversation', reason: 'default_task_type', override: null };
}

module.exports = { routeOutput };
