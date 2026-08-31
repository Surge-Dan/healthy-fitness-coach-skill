'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildWorkflowDecision,
  classifyTrainingTask,
  evaluateInformationState,
  requiredFieldsForTask
} = require('../references/training-orchestrator.js');

const REQUIRED_DECISION_FIELDS = [
  'task_type',
  'interaction_mode',
  'required_fields',
  'missing_fields',
  'information_state',
  'artifact_mode',
  'artifacts',
  'reason_codes'
];

const COMPLETE_PROFILE = {
  goal: 'build strength',
  experience_level: 'intermediate',
  training_days_per_week: 3,
  available_equipment: ['barbell', 'bench'],
  injury_or_medical_constraints: 'none'
};

test('routes each supported training task to an auditable decision', () => {
  const cases = [
    ['knowledge_question', { instruction: 'What is progressive overload?' }, 'conversation', 'none'],
    ['safety_routing', { instruction: 'I have chest pain during a set.' }, 'conversation', 'none'],
    ['training_plan', { taskType: 'training_plan', profile: COMPLETE_PROFILE }, 'markdown', 'single_markdown'],
    ['today_workout', { taskType: 'today_workout', profile: {} }, 'conversation', 'none'],
    ['training_review', { taskType: 'training_review', records: [{ date: '2026-08-30' }] }, 'markdown', 'single_markdown'],
    ['training_system', { taskType: 'training_system', profile: COMPLETE_PROFILE }, 'markdown', 'system_bundle'],
    ['xunji_analysis', { taskType: 'xunji_analysis', records: [{ date: '2026-08-30' }] }, 'markdown', 'analysis_bundle'],
    ['share_output', { taskType: 'share_output', currentState: { source_assets: ['progress.jpg'] } }, 'conversation', 'share_card']
  ];

  for (const [expectedTask, input, expectedInteraction, expectedArtifactMode] of cases) {
    const decision = buildWorkflowDecision(input);
    assert.equal(decision.task_type, expectedTask);
    assert.equal(decision.interaction_mode, expectedInteraction);
    assert.equal(decision.artifact_mode, expectedArtifactMode);
    for (const field of REQUIRED_DECISION_FIELDS) assert.ok(Object.hasOwn(decision, field), `${expectedTask} includes ${field}`);
    assert.ok(Array.isArray(decision.required_fields));
    assert.ok(Array.isArray(decision.missing_fields));
    assert.ok(Array.isArray(decision.artifacts));
    assert.ok(Array.isArray(decision.reason_codes));
  }
});

test('classifies red flags before explicit commands or requested training work', () => {
  assert.equal(classifyTrainingTask({
    taskType: 'training_plan',
    instruction: '直接出报告；我深蹲时胸痛和呼吸困难',
    currentState: { red_flags: ['chest_pain'] }
  }), 'safety_routing');
});

test('classifies an instruction to establish training DNA as a training system, not a Xunji analysis', () => {
  assert.equal(classifyTrainingTask({ instruction: '帮我建立训练DNA和长期训练体系' }), 'training_system');
});

test('red flags suppress report, share and plan artifacts in final workflow decisions', () => {
  for (const input of [
    { taskType: 'training_plan', instruction: '直接出报告，我胸痛', currentState: { red_flags: ['chest_pain'] } },
    { taskType: 'share_output', instruction: '做分享图，我呼吸困难', currentState: { red_flags: ['shortness_of_breath'] } },
    { taskType: 'training_plan', instruction: '给我训练计划，我晕厥过', currentState: { red_flags: ['fainting'] } }
  ]) {
    const decision = buildWorkflowDecision(input);
    assert.equal(decision.task_type, 'safety_routing');
    assert.equal(decision.interaction_mode, 'conversation');
    assert.equal(decision.artifact_mode, 'none');
    assert.deepEqual(decision.artifacts, []);
  }
});

test('nested safety red flags override plan, explicit report and share routes', () => {
  const cases = [
    { taskType: 'training_plan', safety: { red_flags: ['chest_pain'] } },
    { taskType: 'today_workout', instruction: '直接出报告', currentState: { safety: { red_flags: ['recent_surgery'] } } },
    { taskType: 'share_output', currentState: { safety: { red_flags: ['acute_injury'] } } }
  ];

  for (const input of cases) {
    const decision = buildWorkflowDecision(input);
    assert.equal(decision.task_type, 'safety_routing');
    assert.equal(decision.interaction_mode, 'conversation');
    assert.equal(decision.artifact_mode, 'none');
    assert.deepEqual(decision.artifacts, []);
  }
});

test('ignores empty red-flag entries instead of creating a false safety route', () => {
  assert.equal(classifyTrainingTask({
    taskType: 'training_plan',
    currentState: { red_flags: [false, ''] }
  }), 'training_plan');
});

test('does not create profile questions or file artifacts for a simple knowledge question', () => {
  const decision = buildWorkflowDecision({ instruction: 'How much protein should I eat after training?' });
  assert.deepEqual(decision.required_fields, []);
  assert.deepEqual(decision.missing_fields, []);
  assert.equal(decision.information_state, 'ready');
  assert.deepEqual(decision.artifacts, []);
});

test('classifies explicit hypertrophy, multi-week and next-week requests as plans without misclassifying a knowledge question', () => {
  for (const instruction of ['给我制定一个增肌计划', '帮我做 8 周力量方案', '安排下周训练']) {
    assert.equal(classifyTrainingTask({ instruction }), 'training_plan');
  }
  assert.equal(classifyTrainingTask({ instruction: '增肌训练有哪些基本原则？' }), 'knowledge_question');
});

test('uses existing complete plan fields without repeating questions', () => {
  const decision = buildWorkflowDecision({ taskType: 'training_plan', profile: COMPLETE_PROFILE });
  assert.deepEqual(decision.missing_fields, []);
  assert.equal(decision.information_state, 'ready');
});

test('asks only structural or safety-changing gaps and otherwise permits execution assumptions', () => {
  const plan = buildWorkflowDecision({
    taskType: 'training_plan',
    profile: { goal: 'build strength', experience_level: 'beginner' }
  });
  assert.deepEqual(plan.missing_fields, ['training_days_per_week', 'available_equipment', 'injury_or_medical_constraints']);
  assert.equal(plan.information_state, 'ask');

  const workout = buildWorkflowDecision({ taskType: 'today_workout', profile: {} });
  assert.deepEqual(workout.missing_fields, []);
  assert.equal(workout.information_state, 'assume');
  assert.ok(workout.reason_codes.includes('safe_execution_assumption'));
});

test('reuses output-routing explicit commands unless safety has already won', () => {
  const decision = buildWorkflowDecision({
    taskType: 'today_workout',
    instruction: '直接出报告'
  });
  assert.equal(decision.interaction_mode, 'markdown');
  assert.ok(decision.reason_codes.includes('explicit_command'));
});

test('exposes stable field requirements and information-state evaluation', () => {
  assert.deepEqual(requiredFieldsForTask('training_review'), ['records']);
  assert.equal(evaluateInformationState({ taskType: 'training_review', records: [] }).state, 'ask');
  assert.equal(evaluateInformationState({ taskType: 'today_workout', profile: {} }).state, 'assume');
});
