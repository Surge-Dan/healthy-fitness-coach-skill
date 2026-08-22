'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildTrainingGuidance } = require('../references/training-guidance.js');

test('guidance stops and refers when a red flag is present', () => {
  const result = buildTrainingGuidance({ goal: 'strength', red_flags: ['chest_pain'] });
  assert.equal(result.safety.level, 'stop');
  assert.equal(result.safety.reason_code, 'red_flag');
  assert.equal(result.actions[0].code, 'seek_professional_assessment');
});

test('guidance turns sparse resistance data into a minimum viable next session', () => {
  const result = buildTrainingGuidance({
    goal: 'hypertrophy',
    frequency_per_week: 2,
    equipment: ['gym'],
    trends: { training_days: 1, record_count: 3, total_sets: 8, missing_dates: [] }
  });
  assert.equal(result.safety.level, 'proceed');
  assert.ok(result.actions.some((action) => action.code === 'minimum_effective_dose'));
  assert.ok(result.next_validation.some((item) => item.code === 'log_rpe_or_rir'));
});

test('guidance recommends sustainable aerobic progression without inventing a prescription', () => {
  const result = buildTrainingGuidance({
    goal: 'aerobic_base',
    frequency_per_week: 3,
    trends: { training_days: 2, record_count: 2, aerobic_minutes: 40, missing_dates: [] }
  });
  assert.ok(result.actions.some((action) => action.code === 'easy_aerobic_progression'));
  assert.ok(result.judgments.every((judgment) => judgment.confidence !== 'high'));
});

test('guidance labels incomplete data instead of overstating adherence', () => {
  const result = buildTrainingGuidance({
    goal: 'fat_loss',
    trends: { training_days: 4, record_count: 4, missing_dates: ['2026-08-03'], data_freshness: 'mixed' }
  });
  assert.equal(result.data_quality, 'partial');
  assert.ok(result.judgments.some((judgment) => judgment.code === 'insufficient_data'));
});
