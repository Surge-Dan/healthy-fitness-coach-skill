'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { summarizeTrainingRange } = require('../references/training-summary.js');

test('summary produces a consistent cross-domain training snapshot', () => {
  const result = summarizeTrainingRange({
    date_start: '2026-08-01', date_end: '2026-08-31', training_days: 8, record_count: 12,
    total_sets: 96, total_reps: 720, estimated_volume: 43200,
    missing_dates: [], data_freshness: 'network', parse_warnings: 0,
    exercise_performance_exercise: 'Bench press',
    exercise_performance: [{ label: '2026-08-01', value: 60, value_type: 'weight_kg' }],
    training_dna: { metrics: { aerobic: { duration_min: 90 }, resistance: { body_distribution: { chest: 30, back: 24 } } } }
  });

  assert.equal(result.period.start, '2026-08-01');
  assert.equal(result.totals.training_days, 8);
  assert.equal(result.totals.volume_kg, 43200);
  assert.equal(result.totals.aerobic_minutes, 90);
  assert.deepEqual(result.body_distribution[0], { part: 'chest', sets: 30 });
  assert.equal(result.main_exercise.name, 'Bench press');
  assert.equal(result.data_quality.status, 'complete');
});

test('summary returns an explicit empty state without inventing metrics', () => {
  const result = summarizeTrainingRange({ dates: [], records: [], missing_dates: [] });
  assert.equal(result.data_quality.status, 'empty');
  assert.equal(result.totals.training_days, 0);
  assert.deepEqual(result.body_distribution, []);
  assert.equal(result.main_exercise, null);
});
