'use strict';

const { planOutputAssets } = require('./output-routing.js');

const SUPPORTED_TASKS = new Set([
  'knowledge_question',
  'safety_routing',
  'training_plan',
  'today_workout',
  'training_review',
  'training_system',
  'xunji_analysis',
  'share_output'
]);

const REQUIRED_FIELDS = {
  knowledge_question: [],
  safety_routing: [],
  training_plan: ['goal', 'experience_level', 'training_days_per_week', 'available_equipment', 'injury_or_medical_constraints'],
  today_workout: [],
  training_review: ['records'],
  training_system: ['goal', 'experience_level', 'training_days_per_week', 'available_equipment', 'injury_or_medical_constraints'],
  xunji_analysis: ['records'],
  share_output: ['source_assets']
};

const INSTRUCTION_TASKS = [
  ['share_output', /(?:分享图|分享卡|海报|晒训练|share\s*(?:card|image|output)?)/iu],
  ['training_system', /(?:训练系统|建立.*训练dna|建立.*训练体系|长期训练)/iu],
  ['xunji_analysis', /(?:训记|xunji|训练数据分析)/iu],
  ['training_review', /(?:训练复盘|周复盘|月复盘|训练回顾|review)/iu],
  ['today_workout', /(?:今天.*(?:练|训练)|今日.*(?:练|训练)|today.*workout)/iu],
  ['training_plan', /(?:训练计划|计划.*训练|(?:给我|帮我|为我|请).{0,6}(?:制定|做|设计|生成|安排).{0,20}(?:计划|方案|训练)|(?:制定|做|设计|生成).{0,20}(?:计划|方案)|(?:安排|规划|排).{0,12}(?:下周|下星期|下个星期|未来).{0,12}(?:训练|锻炼)|program(?:me)?\b)/iu]
];

const RED_FLAG_PATTERN = /(?:胸痛|胸部压迫感|呼吸困难|异常气短|晕厥|昏厥|明显头晕|异常心悸|突发.*(?:疼痛|麻木|无力)|剧烈.*(?:疼痛|头痛)|近期手术|急性外伤|妊娠|产后|chest\s*pain|shortness\s+of\s+breath|faint(?:ing)?|severe\s+pain|numbness)/iu;
const EXPLANATORY_PLAN_QUESTION_PATTERN = /(?:(?:训练计划|计划|方案).{0,12}(?:怎么制定|如何制定|包含哪些(?:内容)?|哪些内容|是什么|有哪些原则)|(?:怎么制定|如何制定|包含哪些(?:内容)?|哪些内容|是什么|有哪些原则).{0,12}(?:训练计划|计划|方案))/iu;
const DIRECT_PLAN_REQUEST_PATTERN = /(?:给我|帮我|为我|请).{0,6}(?:制定|做|设计|生成|安排)/iu;

function normalizeTaskType(value) {
  const taskType = String(value || '').trim().toLowerCase();
  return SUPPORTED_TASKS.has(taskType) ? taskType : null;
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function isMeaningfulRedFlag(value) {
  if (value === true) return true;
  if (typeof value === 'string') return value.trim() !== '';
  return Boolean(value && typeof value === 'object' && Object.keys(value).length > 0);
}

function hasRedFlag(input = {}) {
  const state = input.currentState || input.current_state || {};
  const flagSources = [
    input.red_flags,
    input.redFlags,
    input.safety?.red_flags,
    input.safety?.redFlags,
    state.red_flags,
    state.redFlags,
    state.safety?.red_flags,
    state.safety?.redFlags
  ];
  const entries = flagSources.flatMap((flags) => Array.isArray(flags) ? flags : [flags]);
  return entries.some(isMeaningfulRedFlag) || RED_FLAG_PATTERN.test(String(input.instruction || input.userInstruction || ''));
}

function classifyTrainingTask(input = {}) {
  if (hasRedFlag(input)) return 'safety_routing';

  const explicitTask = normalizeTaskType(input.taskType || input.task_type);
  if (explicitTask) return explicitTask;

  const instruction = String(input.instruction || input.userInstruction || '');
  if (EXPLANATORY_PLAN_QUESTION_PATTERN.test(instruction) && !DIRECT_PLAN_REQUEST_PATTERN.test(instruction)) {
    return 'knowledge_question';
  }
  for (const [taskType, pattern] of INSTRUCTION_TASKS) {
    if (pattern.test(instruction)) return taskType;
  }
  return 'knowledge_question';
}

function requiredFieldsForTask(taskType) {
  const normalized = normalizeTaskType(taskType) || 'knowledge_question';
  return [...REQUIRED_FIELDS[normalized]];
}

function valueForField(field, { profile = {}, currentState = {}, records, source_assets, sourceAssets } = {}) {
  if (field === 'records') return records;
  if (field === 'source_assets') return source_assets || sourceAssets || currentState.source_assets || currentState.sourceAssets;
  return currentState[field] !== undefined ? currentState[field] : profile[field];
}

function evaluateInformationState({ taskType, profile = {}, currentState = {}, records, source_assets, sourceAssets } = {}) {
  const normalized = normalizeTaskType(taskType) || 'knowledge_question';
  const fields = requiredFieldsForTask(normalized);
  const missing_fields = fields.filter((field) => !hasValue(valueForField(field, { profile, currentState, records, source_assets, sourceAssets })));

  if (normalized === 'today_workout' && missing_fields.length === 0) {
    const hasExecutionContext = hasValue(profile.available_time_min) || hasValue(currentState.available_time_min)
      || hasValue(profile.available_equipment) || hasValue(currentState.available_equipment);
    return { state: hasExecutionContext ? 'ready' : 'assume', missing_fields };
  }
  return { state: missing_fields.length > 0 ? 'ask' : 'ready', missing_fields };
}

function classificationReason(input, taskType) {
  if (taskType === 'safety_routing' && hasRedFlag(input)) return 'red_flag_detected';
  if (normalizeTaskType(input.taskType || input.task_type)) return 'explicit_task_type';
  return taskType === 'knowledge_question' ? 'simple_knowledge_question' : 'instruction_classification';
}

function defaultArtifact(taskType) {
  switch (taskType) {
    case 'training_plan': return { mode: 'single_markdown', artifacts: ['TRAINING_PLAN.md'] };
    case 'training_review': return { mode: 'single_markdown', artifacts: ['TRAINING_REVIEW.md'] };
    case 'training_system': return { mode: 'system_bundle', artifacts: ['ATHLETE_PROFILE.md', 'TRAINING_DNA.md', 'CURRENT_PROGRAM.md', 'DECISION_LOG.md'] };
    case 'xunji_analysis': return { mode: 'analysis_bundle', artifacts: ['TRAINING_DNA.md', 'DECISION_LOG.md'] };
    case 'share_output': return { mode: 'share_card', artifacts: ['SHARE_CARD.png'] };
    default: return { mode: 'none', artifacts: [] };
  }
}

function artifactModeForPlan(taskType, assetPlan) {
  if (assetPlan.mode === 'dashboard') return 'dashboard';
  if (assetPlan.artifacts.length === 0) return 'none';
  const defaultMode = defaultArtifact(taskType).mode;
  return defaultMode === 'none' ? 'single_markdown' : defaultMode;
}

function buildWorkflowDecision(input = {}) {
  const task_type = classifyTrainingTask(input);
  const currentState = input.currentState || input.current_state || {};
  const information = evaluateInformationState({
    taskType: task_type,
    profile: input.profile || {},
    currentState,
    records: input.records,
    source_assets: input.source_assets,
    sourceAssets: input.sourceAssets
  });
  const assetPlan = planOutputAssets({
    taskType: task_type,
    userInstruction: input.instruction || input.userInstruction,
    outputDirectory: input.outputDirectory,
    existingPaths: input.existingPaths
  });
  const artifact_mode = artifactModeForPlan(task_type, assetPlan);
  const reason_codes = [classificationReason(input, task_type), assetPlan.reason];
  if (information.state === 'assume') reason_codes.push('safe_execution_assumption');
  if (information.missing_fields.length > 0) reason_codes.push('structural_information_missing');

  return {
    task_type,
    interaction_mode: assetPlan.mode,
    required_fields: requiredFieldsForTask(task_type),
    missing_fields: information.missing_fields,
    information_state: information.state,
    artifact_mode,
    artifacts: assetPlan.artifacts,
    index: assetPlan.index,
    paths: assetPlan.paths,
    reason_codes: [...new Set(reason_codes)]
  };
}

module.exports = {
  classifyTrainingTask,
  requiredFieldsForTask,
  evaluateInformationState,
  buildWorkflowDecision
};
