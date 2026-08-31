'use strict';

const { existsSync } = require('node:fs');
const { basename, join, parse } = require('node:path');

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
  'training_review',
  'training_system',
  'xunji_analysis',
  'weekly_review',
  'monthly_review',
  'training_data_analysis',
  'reusable_plan',
  'reusable_report',
  'user_profile'
]);

const TASK_ASSETS = {
  training_plan: ['ATHLETE_PROFILE.md', 'CURRENT_PROGRAM.md'],
  training_review: ['WEEKLY_REVIEW.md', 'DECISION_LOG.md'],
  training_system: ['ATHLETE_PROFILE.md', 'TRAINING_DNA.md', 'CURRENT_PROGRAM.md', 'DECISION_LOG.md'],
  xunji_analysis: ['TRAINING_ANALYSIS.md'],
  share_output: ['SHARE_CARD.png', 'SHARE_FACTS.md']
};

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
    if (value === '生成趋势面板' || value === '查看训练趋势' || value === '趋势面板') return 'dashboard';
    if (value === '保存刚才内容' || value === '把刚才内容保存下来') return 'save_prior_content';
    return null;
  }
  const value = stripEnglishAffirmativeDecorations(clause);
  if (value === 'direct report' || value === 'directly report' || value === 'a direct report') return 'direct_report';
  if (value === 'enter tracking') return 'enter_tracking';
  if (value === 'dashboard' || value === 'training dashboard' || value === 'trend dashboard') return 'dashboard';
  if (value === 'save prior content' || value === 'save the prior content') return 'save_prior_content';
  return null;
}

function explicitOverride(instruction) {
  const matches = new Set();
  for (const clause of splitClauses(instruction)) {
    const override = explicitOverrideForClause(clause);
    if (override) matches.add(override);
  }
  const override = ['direct_report', 'enter_tracking', 'dashboard', 'save_prior_content'].find((candidate) => matches.has(candidate));
  return override ? {
    mode: override === 'enter_tracking' ? 'conversation' : (override === 'dashboard' ? 'dashboard' : 'markdown'),
    reason: 'explicit_command',
    override
  } : null;
}

function routeOutput({ taskType, userInstruction } = {}) {
  if (taskType === 'safety_routing') return { mode: 'conversation', reason: 'safety_override', override: null };
  const override = explicitOverride(userInstruction);
  if (override) return override;
  if (MARKDOWN_TASKS.has(taskType)) return { mode: 'markdown', reason: 'default_task_type', override: null };
  return { mode: 'conversation', reason: 'default_task_type', override: null };
}

function resolveNonOverwritingPath(filename, { outputDirectory = 'fitness-reports', existingPaths = new Set(), reservedPaths = new Set() } = {}) {
  const existing = new Set(existingPaths);
  const parsed = parse(filename);
  let suffix = 1;
  let candidate = join(outputDirectory, filename);
  const collides = (path) => existing.has(path) || existing.has(basename(path)) || reservedPaths.has(path) || existsSync(path);
  while (collides(candidate)) {
    suffix += 1;
    const candidateName = `${parsed.name}-${suffix}${parsed.ext}`;
    candidate = join(outputDirectory, candidateName);
  }
  return candidate;
}

function planOutputAssets({ taskType, userInstruction, outputDirectory = 'fitness-reports', existingPaths = new Set() } = {}) {
  const route = routeOutput({ taskType, userInstruction });
  let artifacts = [];
  let index = null;

  if (taskType === 'today_workout' && route.override === 'save_prior_content') {
    artifacts = ['TODAY_WORKOUT.md'];
  } else if (taskType !== 'safety_routing' && route.mode === 'dashboard') {
    artifacts = taskType === 'xunji_analysis'
      ? [...TASK_ASSETS.xunji_analysis, 'training-dashboard.html']
      : ['training-dashboard.html'];
  } else if (taskType !== 'safety_routing' && taskType !== 'knowledge_question') {
    artifacts = TASK_ASSETS[taskType] ? [...TASK_ASSETS[taskType]] : [];
    if (taskType === 'training_system') index = 'TRAINING_SYSTEM_INDEX.md';
  }

  if (route.mode === 'conversation' && taskType !== 'share_output') {
    artifacts = [];
    index = null;
  }

  const reservedPaths = new Set();
  const paths = [...(index ? [index] : []), ...artifacts].map((filename) => {
    const path = resolveNonOverwritingPath(filename, { outputDirectory, existingPaths, reservedPaths });
    reservedPaths.add(path);
    return path;
  });

  return {
    task_type: taskType || 'knowledge_question',
    mode: route.mode,
    reason: route.reason,
    override: route.override,
    artifacts,
    index,
    paths
  };
}

module.exports = { routeOutput, planOutputAssets, resolveNonOverwritingPath };
