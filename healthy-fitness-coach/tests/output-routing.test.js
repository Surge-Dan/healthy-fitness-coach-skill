'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const {
  planOutputAssets,
  routeOutput
} = require('../references/output-routing.js');

test('routes supported orchestrator task names to their default interaction modes', () => {
  for (const taskType of ['knowledge_question', 'safety_routing', 'today_workout', 'share_output']) {
    assert.equal(routeOutput({ taskType }).mode, 'conversation', taskType);
  }
  for (const taskType of ['training_plan', 'training_review', 'training_system', 'xunji_analysis']) {
    assert.equal(routeOutput({ taskType }).mode, 'markdown', taskType);
  }
});

test('keeps safety routing conversational even when the instruction asks for a report', () => {
  const route = routeOutput({ taskType: 'safety_routing', userInstruction: '直接出报告' });
  assert.deepEqual(route, { mode: 'conversation', reason: 'safety_override', override: null });
});

test('plans deterministic task assets and includes an index for a multi-file system', () => {
  assert.deepEqual(planOutputAssets({ taskType: 'training_plan' }).artifacts, [
    'ATHLETE_PROFILE.md',
    'CURRENT_PROGRAM.md'
  ]);
  assert.deepEqual(planOutputAssets({ taskType: 'training_review' }).artifacts, [
    'WEEKLY_REVIEW.md',
    'DECISION_LOG.md'
  ]);
  assert.deepEqual(planOutputAssets({ taskType: 'training_system' }).artifacts, [
    'ATHLETE_PROFILE.md',
    'TRAINING_DNA.md',
    'CURRENT_PROGRAM.md',
    'DECISION_LOG.md'
  ]);
  assert.equal(planOutputAssets({ taskType: 'training_system' }).index, 'TRAINING_SYSTEM_INDEX.md');
  assert.deepEqual(planOutputAssets({ taskType: 'xunji_analysis' }).artifacts, ['TRAINING_ANALYSIS.md']);
  assert.deepEqual(planOutputAssets({ taskType: 'share_output' }).artifacts, ['SHARE_CARD.png', 'SHARE_FACTS.md']);
});

test('adds a task-specific first index path for every multi-file delivery without overwriting it', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-index-routing-'));
  const outputDirectory = join(root, 'fitness-reports');
  mkdirSync(outputDirectory);
  const cases = [
    ['training_plan', 'TRAINING_PLAN_INDEX.md'],
    ['training_review', 'TRAINING_REVIEW_INDEX.md'],
    ['share_output', 'SHARE_OUTPUT_INDEX.md']
  ];

  for (const [taskType, index] of cases) {
    writeFileSync(join(outputDirectory, index), 'existing');
    const plan = planOutputAssets({ taskType, outputDirectory });
    assert.equal(plan.index, index, taskType);
    assert.equal(plan.paths[0], join(outputDirectory, index.replace('.md', '-2.md')), taskType);
    assert.equal(plan.paths.length, plan.artifacts.length + 1, taskType);
  }

  rmSync(root, { recursive: true, force: true });
});

test('keeps today workout conversational unless the user explicitly asks to save it', () => {
  assert.deepEqual(planOutputAssets({ taskType: 'today_workout' }).artifacts, []);
  const saved = planOutputAssets({ taskType: 'today_workout', userInstruction: '保存刚才内容' });
  assert.equal(saved.mode, 'markdown');
  assert.deepEqual(saved.artifacts, ['TODAY_WORKOUT.md']);
});

test('adds dashboard to xunji analysis only for an explicit dashboard command', () => {
  const plan = planOutputAssets({ taskType: 'xunji_analysis', userInstruction: '生成趋势面板' });
  assert.equal(plan.mode, 'dashboard');
  assert.deepEqual(plan.artifacts, ['TRAINING_ANALYSIS.md', 'training-dashboard.html']);
});

test('recognizes the README composite Xunji command as a dashboard request', () => {
  const plan = planOutputAssets({
    taskType: 'xunji_analysis',
    userInstruction: '分析最近4周训记，生成趋势面板'
  });
  assert.equal(plan.mode, 'dashboard');
  assert.deepEqual(plan.artifacts, ['TRAINING_ANALYSIS.md', 'training-dashboard.html']);
});

test('does not turn a comma-separated trend question into a dashboard command', () => {
  const plan = planOutputAssets({
    taskType: 'xunji_analysis',
    userInstruction: '趋势面板，是什么意思？'
  });
  assert.equal(plan.mode, 'markdown');
  assert.deepEqual(plan.artifacts, ['TRAINING_ANALYSIS.md']);
});

test('lets an explicit dashboard command replace a plan bundle with its dashboard asset', () => {
  const plan = planOutputAssets({ taskType: 'training_plan', userInstruction: '生成趋势面板' });
  assert.equal(plan.mode, 'dashboard');
  assert.deepEqual(plan.artifacts, ['training-dashboard.html']);
});

test('returns predictable suffixed paths without overwriting existing files', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-routing-'));
  const outputDirectory = join(root, 'fitness-reports');
  mkdirSync(outputDirectory);
  writeFileSync(join(outputDirectory, 'TODAY_WORKOUT.md'), 'existing');
  writeFileSync(join(outputDirectory, 'TODAY_WORKOUT-2.md'), 'existing');

  const plan = planOutputAssets({
    taskType: 'today_workout',
    userInstruction: '保存刚才内容',
    outputDirectory
  });

  assert.deepEqual(plan.paths, [join(outputDirectory, 'TODAY_WORKOUT-3.md')]);
  rmSync(root, { recursive: true, force: true });
});
