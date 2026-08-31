'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeTrainingRecords,
  extractTrainingDNA,
  compareTrainingDNA
} = require('../references/training-dna-engine.js');

test('normalizes resistance and aerobic records without dropping provenance', () => {
  const result = normalizeTrainingRecords([
    { record_date: '2026-01-05', id: 'r1', title: '卧推', sets: 3, reps: 8, weight: '60kg', volume: 1440, rpe: 8 },
    { record_date: '2026-01-07', id: 'r2', title: '跑步', duration_min: 32, distance_km: 5.1, avg_hr: 142 },
    { id: 'bad', title: '未知记录' }
  ]);

  assert.equal(result.sessions.length, 2);
  assert.equal(result.sessions[0].kind, 'resistance');
  assert.equal(result.sessions[0].weight_kg, 60);
  assert.equal(result.sessions[0].source_record_id, 'r1');
  assert.equal(result.sessions[1].kind, 'aerobic');
  assert.equal(result.sessions[1].duration_min, 32);
  assert.equal(result.quality.records_total, 3);
  assert.equal(result.quality.valid_records, 2);
  assert.ok(result.warnings.some((warning) => warning.code === 'missing_date'));
});

test('extracts a conservative DNA with separate resistance and aerobic dimensions', () => {
  const records = [
    { record_date: '2026-01-05', title: '卧推', sets: 3, reps: 8, weight: '60kg', volume: 1440, rpe: 8 },
    { record_date: '2026-01-07', title: '跑步', duration_min: 30, distance_km: 4.5, avg_hr: 140 },
    { record_date: '2026-01-12', title: '卧推', sets: 3, reps: 8, weight: '62.5kg', volume: 1500, rpe: 8 },
    { record_date: '2026-01-14', title: '跑步', duration_min: 32, distance_km: 4.9, avg_hr: 141 }
  ];
  const dna = extractTrainingDNA({ records, dateStart: '2026-01-01', dateEnd: '2026-01-18', generatedAt: '2026-01-19T00:00:00Z' });

  assert.equal(dna.schema_version, '1.0');
  assert.equal(dna.data_range.date_start, '2026-01-01');
  assert.equal(dna.metrics.resistance.sessions, 2);
  assert.equal(dna.metrics.aerobic.sessions, 2);
  assert.equal(Object.keys(dna.dimensions).length, 8);
  assert.equal(dna.dimensions.resistance_response.status, 'emerging');
  assert.equal(dna.dimensions.aerobic_response.status, 'emerging');
  assert.match(dna.dimensions.resistance_response.hypotheses[0], /卧推|负重|阻力/);
  assert.ok(dna.dimensions.resistance_response.evidence.length >= 2);
  assert.ok(dna.unknowns.includes('recovery_response'));
});

test('does not promote a one-session observation to a stable DNA rule', () => {
  const dna = extractTrainingDNA({
    records: [{ record_date: '2026-02-01', title: '深蹲', sets: 4, reps: 6, weight: '80kg', volume: 1920 }],
    dateStart: '2026-02-01',
    dateEnd: '2026-02-07'
  });

  assert.equal(dna.dimensions.resistance_response.status, 'observed');
  assert.equal(dna.dimensions.resistance_response.confidence, 'low');
  assert.ok(dna.dimensions.resistance_response.next_validation.includes('2'));
});

test('compares DNA versions and records changed hypotheses only', () => {
  const previous = {
    dimensions: {
      resistance_response: { status: 'emerging', confidence: 'medium', hypotheses: ['维持中等训练量时表现稳定'] },
      aerobic_response: { status: 'observed', confidence: 'low', hypotheses: [] }
    }
  };
  const current = {
    dimensions: {
      resistance_response: { status: 'supported', confidence: 'high', hypotheses: ['维持中等训练量时表现稳定'] },
      aerobic_response: { status: 'emerging', confidence: 'medium', hypotheses: ['低强度有氧完成率较高'] }
    }
  };
  const diff = compareTrainingDNA(previous, current);

  assert.deepEqual(diff.changed_dimensions, ['aerobic_response', 'resistance_response']);
  assert.equal(diff.changes[0].from.status, 'observed');
  assert.equal(diff.changes[1].to.status, 'supported');
});

test('filters range, rejects malformed dates, ignores rest days and deduplicates ids', () => {
  const result = extractTrainingDNA({
    dateStart: '2026-01-01', dateEnd: '2026-01-31',
    records: [
      { record_date: '2025-12-31', id: 'outside', title: 'press', sets: 3, reps: 8, weight: '60kg' },
      { record_date: '2026-01-05', id: 'same', title: 'press', sets: 3, reps: 8, weight: '60kg' },
      { record_date: '2026-01-05', id: 'same', title: 'press', sets: 3, reps: 8, weight: '60kg' },
      { record_date: '2026-01-06', title: 'rest', kind: 'rest_day' },
      { record_date: '2026-01-01junk', title: 'bad', sets: 1, reps: 1 }
    ]
  });
  assert.equal(result.metrics.training_days, 1);
  assert.equal(result.metrics.sessions, 1);
  assert.equal(result.metrics.resistance.sessions, 1);
  assert.ok(result.warnings.some((warning) => warning.code === 'duplicate_record'));
  assert.ok(result.warnings.some((warning) => warning.code === 'invalid_date'));
  assert.ok(result.warnings.some((warning) => warning.code === 'out_of_range'));
});

test('does not promote repeated unmeasured sessions to supported DNA', () => {
  const result = extractTrainingDNA({
    records: [1, 2, 3, 4].map((index) => ({ record_date: `2026-01-${String(index * 7).padStart(2, '0')}`, id: `r${index}`, title: 'training' }))
  });
  assert.notEqual(result.dimensions.resistance_response.status, 'supported');
  assert.notEqual(result.dimensions.resistance_response.confidence, 'high');
});

test('adherence counts calendar weeks and active completed sessions only', () => {
  const result = extractTrainingDNA({
    dateStart: '2026-01-01', dateEnd: '2026-01-31', plannedSessionsPerWeek: 2,
    records: [
      { record_date: '2026-01-02', title: 'press', kind: 'resistance', sets: 3, reps: 8, completed: true },
      { record_date: '2026-01-03', title: 'run', kind: 'aerobic', duration_min: 30, completed: false },
      { record_date: '2026-01-10', title: 'rest', kind: 'rest_day' }
    ]
  });
  assert.equal(result.metrics.adherence, 0.1);
});

test('invalid planned frequency does not produce a negative adherence score', () => {
  const result = extractTrainingDNA({
    dateStart: '2026-01-01', dateEnd: '2026-01-31', plannedSessionsPerWeek: -2,
    records: [{ record_date: '2026-01-02', title: 'press', kind: 'resistance', sets: 3, reps: 8 }]
  });
  assert.equal(result.metrics.adherence, undefined);
  assert.ok(result.warnings.some((warning) => warning.code === 'invalid_planned_frequency'));
});

test('does not estimate resistance volume when a row mixes kg and lb', () => {
  const result = extractTrainingDNA({
    dateStart: '2026-04-01', dateEnd: '2026-04-07',
    records: [{ record_date: '2026-04-02', id: 'mixed', title: '卧推', kind: 'resistance', sets: 3, reps: 8, weight: '60kg', volume_unit: 'kg', mixed_units: true }]
  });

  assert.equal(result.metrics.resistance.volume_kg, 0);
  assert.ok(result.warnings.some((warning) => warning.code === 'mixed_units'));
});

test('does not count unknown rows as training sessions or training days', () => {
  const result = extractTrainingDNA({
    dateStart: '2026-04-01', dateEnd: '2026-04-14',
    records: [
      { record_date: '2026-04-02', id: 'unknown', title: '状态记录' },
      { record_date: '2026-04-03', id: 'rest', title: '休息日', kind: 'rest_day' }
    ]
  });

  assert.equal(result.metrics.training_days, 0);
  assert.equal(result.metrics.sessions, 0);
  assert.equal(result.metrics.rest_days, 1);
  assert.ok(result.warnings.some((warning) => warning.code === 'unknown_training_kind'));
});

test('invalid aerobic and effort measurements are excluded instead of becoming training DNA', () => {
  const result = normalizeTrainingRecords([
    { record_date: '2026-04-04', title: '跑步', duration_min: -30, distance_km: -5, avg_hr: -100 },
    { record_date: '2026-04-05', title: '卧推', sets: 3, reps: 8, weight: '60kg', rpe: 15, rir: -2 }
  ]);

  assert.ok(result.warnings.some((warning) => warning.code === 'invalid_measurement'));
  assert.equal(result.sessions[0].duration_min, undefined);
  assert.equal(result.sessions[0].distance_km, undefined);
  assert.equal(result.sessions[0].avg_hr, undefined);
  assert.equal(result.sessions[1].rpe, undefined);
  assert.equal(result.sessions[1].rir, undefined);
});
