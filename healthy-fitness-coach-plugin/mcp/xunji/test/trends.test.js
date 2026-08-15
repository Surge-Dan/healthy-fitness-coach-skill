'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { analyzeTrainingRange } = require('../src/trends.js');

test('trend analysis aggregates sessions, volume, weekly frequency, and exercises', () => {
  const result = analyzeTrainingRange({
    dates: ['2026-07-27', '2026-07-28', '2026-07-29'],
    missing_dates: ['2026-07-29'],
    data_freshness: 'mixed',
    records: [
      { record_date: '2026-07-27', title: '胸部训练', sets: 3, total_reps: 26, volume: 1560 },
      { record_date: '2026-07-27', title: '三头训练', sets: 2, total_reps: 20, volume: 400 },
      { record_date: '2026-07-28', title: '背部训练', sets: 4, total_reps: 32, volume: 1800, parse_status: 'partial' }
    ]
  });
  assert.equal(result.training_days, 2);
  assert.deepEqual(result.training_dates, ['2026-07-27', '2026-07-28']);
  assert.equal(result.record_count, 3);
  assert.equal(result.total_sets, 9);
  assert.equal(result.total_reps, 78);
  assert.equal(result.estimated_volume, 3760);
  assert.deepEqual(result.missing_dates, ['2026-07-29']);
  assert.equal(result.data_freshness, 'mixed');
  assert.equal(result.weekly[0].week_start, '2026-07-27');
  assert.equal(result.weekly[0].training_days, 2);
  assert.deepEqual(result.daily, [
    { date: '2026-07-27', volume: 1960, sets: 5, record_count: 2 },
    { date: '2026-07-28', volume: 1800, sets: 4, record_count: 1 }
  ]);
  assert.equal(result.exercise_frequency[0].name, '背部训练');
  assert.equal(result.parse_warnings, 1);
});

test('trend analysis reports an empty range without inventing metrics', () => {
  const result = analyzeTrainingRange({ dates: ['2026-08-01'], records: [], missing_dates: [], data_freshness: 'cached' });
  assert.equal(result.training_days, 0);
  assert.equal(result.record_count, 0);
  assert.equal(result.estimated_volume, 0);
  assert.deepEqual(result.weekly, []);
  assert.deepEqual(result.daily, []);
  assert.deepEqual(result.exercise_frequency, []);
});
