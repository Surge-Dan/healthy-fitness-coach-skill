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
  assert.equal(result.exercise_performance_exercise, '背部训练');
  assert.deepEqual(result.exercise_performance, [{ label: '2026-07-28', value: 1800, exercise: '背部训练', value_type: 'volume' }]);
});

test('trend analysis exposes dated main-exercise performance without inventing values', () => {
  const result = analyzeTrainingRange({
    dates: ['2026-08-01', '2026-08-02'],
    records: [
      { record_date: '2026-08-01', title: '卧推', sets: 3, reps: 8, weight: '60kg', volume: 1440 },
      { record_date: '2026-08-02', title: '卧推', sets: 3, reps: 8, weight: '62.5kg', volume: 1500 },
      { record_date: '2026-08-02', title: '拉力器', sets: 2, reps: 12 }
    ]
  });
  assert.equal(result.exercise_performance_exercise, '卧推');
  assert.deepEqual(result.exercise_performance.map(({ label, value, value_type }) => ({ label, value, value_type })), [
    { label: '2026-08-01', value: 60, value_type: 'weight' },
    { label: '2026-08-02', value: 62.5, value_type: 'weight' }
  ]);
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

test('trend analysis exposes conservative training DNA with separate aerobic and resistance evidence', () => {
  const result = analyzeTrainingRange({
    dates: ['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14'],
    records: [
      { record_date: '2026-01-05', title: '卧推', sets: 3, reps: 8, weight: '60kg', volume: 1440 },
      { record_date: '2026-01-07', title: '跑步', raw_text: '2026-01-07,跑步,time:1800s,4.5km,140bpm' },
      { record_date: '2026-01-12', title: '卧推', sets: 3, reps: 8, weight: '62.5kg', volume: 1500 },
      { record_date: '2026-01-14', title: '跑步', raw_text: '2026-01-14,跑步,time:1920s,4.9km,141bpm' }
    ]
  });

  assert.equal(result.training_dna.schema_version, '1.0');
  assert.equal(result.training_dna.metrics.resistance.sessions, 2);
  assert.equal(result.training_dna.metrics.aerobic.sessions, 2);
  assert.equal(result.training_dna.dimensions.resistance_response.status, 'emerging');
  assert.equal(result.training_dna.dimensions.aerobic_response.status, 'emerging');
  assert.ok(result.training_dna.evidence_ledger.length >= 4);
});

test('trend analysis excludes records outside the requested date list and unknown rows', () => {
  const result = analyzeTrainingRange({
    dates: ['2026-08-01', '2026-08-02'],
    records: [
      { record_date: '2026-07-31', title: '卧推', sets: 3, reps: 8, volume: 1440 },
      { record_date: '2026-08-01', title: '状态记录' },
      { record_date: '2026-08-02', title: '卧推', sets: 3, reps: 8, volume: 1500 }
    ]
  });

  assert.equal(result.training_days, 1);
  assert.equal(result.record_count, 1);
  assert.equal(result.estimated_volume, 1500);
  assert.deepEqual(result.training_dates, ['2026-08-02']);
});
