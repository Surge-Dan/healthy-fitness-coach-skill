'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeTrainingRecords,
  extractTrainingDNA,
  compareTrainingDNA,
  consumeReviewEvidence,
  consumeReviewFacts,
  buildDNAChangelog
} = require('../references/training-dna-engine.js');
const { buildDecisionLogEntry, deriveReviewFacts } = require('../references/review-decision-engine.js');

function reviewWindow(id, overrides = {}) {
  return {
    window_id: id,
    facts: {
      data_range: { start: `2026-06-${id === 'w1' ? '01' : id === 'w2' ? '08' : '15'}`, end: `2026-06-${id === 'w1' ? '07' : id === 'w2' ? '14' : '21'}`, weeks_observed: 1 },
      quality: { status: 'complete', missing_dates: [], mixed_units: false, warnings: [] },
      performance: {
        points: [{ date: '2026-06-01', exercise: '卧推', metric: 'load', value: 60, unit: 'kg', rir: 2, sets: 3, source_record_id: `${id}-a` }, { date: '2026-06-07', exercise: '卧推', metric: 'load', value: 62.5, unit: 'kg', rir: 2, sets: 3, source_record_id: `${id}-b` }],
        comparisons: [{ exercise: '卧推', metric: 'load', unit: 'kg', before: 60, after: 62.5, delta: 2.5, direction: 'up', source_record_ids: [`${id}-a`, `${id}-b`] }],
        trend_status: 'improving'
      },
      recovery: { status: 'not_confirmed', observations: [{ date: '2026-06-07', sleep_hours: 7, fatigue: 4, source_record_ids: [`${id}-b`] }] },
      facts: [{ code: 'comparable_performance_comparisons', value: 1, source_record_ids: [`${id}-a`, `${id}-b`] }],
      evidence: { record_ids: [`${id}-a`, `${id}-b`], comparison_record_ids: [`${id}-a`, `${id}-b`] }
    },
    decision: { keep: ['同动作比较'], changes: [], validation: { review_date: '2026-06-28', metrics: ['负重与RIR'] } },
    ...overrides
  };
}

test('consumes one review window as an observation and does not reinterpret raw records', () => {
  const dna = consumeReviewEvidence({ windows: [reviewWindow('w1')] });
  const dimension = dna.dimensions.resistance_response;
  assert.equal(dimension.status, 'observed');
  assert.equal(dimension.confidence, 'low');
  assert.equal(dimension.evidence_stage, 'observation');
  assert.equal(dna.data_quality.raw_records_consumed, 0);
  assert.equal(Object.keys(dna.dimensions).length, 8);
});

test('routes review facts through the legacy extractor entry point without raw-record recomputation', () => {
  const dna = extractTrainingDNA({ reviewWindows: [reviewWindow('w1')] });
  assert.equal(dna.data_quality.raw_records_consumed, 0);
  assert.equal(dna.dimensions.resistance_response.evidence_stage, 'observation');
});

test('does not promote incomplete load, effort, aerobic, or recovery evidence', () => {
  const incomplete = reviewWindow('w1', {
    facts: {
      ...reviewWindow('w1').facts,
      performance: { points: [{ exercise: '卧推', metric: 'load', value: 60, unit: 'kg', sets: 3, source_record_id: 'w1-a' }], comparisons: [] },
      recovery: { status: 'unknown', observations: [] }
    }
  });
  const dna = consumeReviewEvidence({ windows: [incomplete, reviewWindow('w2')] });
  assert.notEqual(dna.dimensions.resistance_response.confidence, 'high');
  assert.ok(dna.unknowns.includes('resistance_response'));
  assert.match(dna.dimensions.resistance_response.next_validation, /RPE|RIR|负重/);
});

test('promotes comparable complete results across review windows without double counting evidence', () => {
  const dna = consumeReviewEvidence({ windows: [reviewWindow('w1'), reviewWindow('w2'), reviewWindow('w3')] });
  const dimension = dna.dimensions.resistance_response;
  assert.equal(dimension.status, 'validated');
  assert.equal(dimension.confidence, 'high');
  assert.equal(dimension.evidence_stage, 'validated_rule');
  assert.ok(dimension.counterevidence.length > 0);
  assert.ok(dimension.confounders.length > 0);
  assert.ok(dimension.next_validation);
  const ids = dna.evidence_ledger.flatMap((entry) => entry.source_record_ids);
  assert.equal(ids.length, new Set(ids).size);
});

test('gates recovery DNA on dated recovery results and preserves legacy dimensions', () => {
  const previous = { dimensions: { goal_constraints: { status: 'observed', confidence: 'low', facts: ['goal=耐力'] }, adherence: { status: 'supported', confidence: 'high' } } };
  const windows = [reviewWindow('w1'), reviewWindow('w2'), reviewWindow('w3')].map((window) => ({
    ...window,
    facts: { ...window.facts, recovery: { status: 'not_confirmed', observations: [{ date: '2026-06-07', sleep_hours: 7, fatigue: 4, source_record_ids: [`${window.window_id}-b`] }] } }
  }));
  const dna = consumeReviewEvidence({ previous, windows });
  assert.equal(dna.dimensions.recovery_response.status, 'validated');
  assert.equal(dna.dimensions.recovery_response.confidence, 'high');
  assert.equal(dna.dimensions.goal_constraints.facts[0], 'goal=耐力');
  assert.equal(dna.dimensions.adherence.status, 'supported');
});

test('marks missing ranges, duplicates, and mixed units as lower quality and blocks validation', () => {
  const duplicate = reviewWindow('w2', { facts: { ...reviewWindow('w2').facts, quality: { status: 'partial', missing_dates: ['2026-06-14'], mixed_units: true, warnings: [{ code: 'duplicate_record' }] } } });
  const dna = consumeReviewEvidence({ windows: [reviewWindow('w1'), duplicate, reviewWindow('w3')] });
  assert.notEqual(dna.dimensions.resistance_response.status, 'validated');
  assert.ok(['partial', 'unknown'].includes(dna.data_quality.status));
  assert.ok(dna.data_quality.duplicate_record_ids.length > 0);
  assert.equal(dna.data_quality.mixed_units, true);
});

test('supports demotion and revocation with reasons in the changelog while keeping legacy DNA readable', () => {
  const previous = { schema_version: '1.0', dimensions: { resistance_response: { status: 'validated', confidence: 'high', hypotheses: ['同条件下表现提升'] } } };
  const current = consumeReviewEvidence({ previous, windows: [reviewWindow('w1', { facts: { ...reviewWindow('w1').facts, quality: { status: 'unknown', missing_dates: ['2026-06-07'], mixed_units: false, warnings: [] } } })] });
  const log = buildDNAChangelog(previous, current, { reason: '新窗口缺少可比较结果', generatedAt: '2026-06-30T00:00:00Z' });
  const resistanceChange = log.changes.find((change) => change.dimension === 'resistance_response');
  assert.ok(resistanceChange);
  assert.equal(resistanceChange.action, 'demoted');
  assert.ok(resistanceChange.reason);
  assert.equal(current.schema_version, '1.0');
  assert.ok(current.compatibility.legacy_input_supported);
});

test('consumes a direct review facts object instead of silently treating its facts array as the envelope', () => {
  const facts = reviewWindow('w1').facts;
  const dna = consumeReviewFacts(facts);
  assert.equal(dna.data_quality.windows_observed, 1);
  assert.equal(dna.dimensions.resistance_response.status, 'observed');
});

test('does not validate recovery when result is unknown or its window quality is incomplete', () => {
  const windows = [reviewWindow('w1'), reviewWindow('w2'), reviewWindow('w3')].map((window, index) => ({
    ...window,
    facts: { ...window.facts, quality: index === 1 ? { status: 'partial', missing_dates: ['2026-06-14'], mixed_units: false, warnings: [] } : window.facts.quality, recovery: { status: 'unknown', observations: [{ date: '2026-06-07', status: 'unknown', source_record_ids: [`${window.window_id}-recovery`] }] } }
  }));
  const dna = consumeReviewEvidence({ windows });
  assert.notEqual(dna.dimensions.recovery_response.status, 'validated');
  assert.notEqual(dna.dimensions.recovery_response.confidence, 'high');
  assert.equal(dna.dimensions.recovery_response.unknown, true);
});

test('keeps reps-only resistance evidence at observation even across three windows', () => {
  const windows = [reviewWindow('w1'), reviewWindow('w2'), reviewWindow('w3')].map((window) => ({
    ...window,
    facts: { ...window.facts, performance: { ...window.facts.performance, points: window.facts.performance.points.map((point) => ({ ...point, value: undefined, load_kg: undefined, weight_kg: undefined, reps: 8, total_reps: 24 })), comparisons: window.facts.performance.comparisons.map((comparison) => ({ ...comparison, value: undefined, load_kg: undefined, weight_kg: undefined, reps: 8 })) } }
  }));
  const dna = consumeReviewEvidence({ windows });
  assert.equal(dna.dimensions.resistance_response.status, 'observed');
  assert.notEqual(dna.dimensions.resistance_response.confidence, 'high');
  assert.match(dna.dimensions.resistance_response.next_validation, /负重/);
});

test('normalizes nested buildDecisionLogEntry decisions and filters hypotheses by dimension evidence', () => {
  const facts = deriveReviewFacts({ records: [
    { date: '2026-08-01', source_record_id: 'a', exercise: '卧推', metric: 'load', value: 60, unit: 'kg', rir: 2, sets: 3 },
    { date: '2026-08-08', source_record_id: 'b', exercise: '卧推', metric: 'load', value: 62.5, unit: 'kg', rir: 2, sets: 3 }
  ] });
  const entry = buildDecisionLogEntry({ date: '2026-08-08', facts, current_program: { version: 'v1' }, review_date: '2026-08-22' });
  const dna = consumeReviewEvidence({ windows: [{ window_id: 'real', facts, decision: entry }] });
  assert.ok(dna.decision_ledger[0].keep.length > 0);
  assert.ok(dna.dimensions.resistance_response.decision_summary.length > 0);
  assert.ok(!dna.dimensions.resistance_response.hypotheses.some((hypothesis) => /完成率偏低|复杂度/.test(hypothesis)));
});

test('changelog records revocation reason and evidence IDs for status changes', () => {
  const previous = { dimensions: { resistance_response: { status: 'validated', confidence: 'high' } } };
  const dna = consumeReviewEvidence({ previous, windows: [reviewWindow('w1')], revoked_dimensions: { resistance_response: { reason: '用户停止该动作', evidence_record_ids: ['w1-a'] } } });
  const change = dna.changelog.changes.find((item) => item.dimension === 'resistance_response');
  assert.equal(change.action, 'revoked');
  assert.equal(change.reason, '用户停止该动作');
  assert.deepEqual(change.evidence_record_ids, ['w1-a']);
});

test('preserves old dynamic DNA dimensions when the current review updates only another dimension', () => {
  const previous = { dimensions: {
    resistance_response: { status: 'observed', confidence: 'low', hypotheses: ['旧阻力观察'] },
    aerobic_response: { status: 'validated', confidence: 'high', hypotheses: ['旧有氧规律'] },
    recovery_response: { status: 'candidate', confidence: 'medium', hypotheses: ['旧恢复候选'] }
  } };
  const current = consumeReviewEvidence({ previous, windows: [reviewWindow('w1', { facts: { ...reviewWindow('w1').facts, recovery: { status: 'unknown', observations: [] } } })] });
  assert.equal(current.dimensions.resistance_response.status, 'observed');
  assert.deepEqual(current.dimensions.aerobic_response, previous.dimensions.aerobic_response);
  assert.deepEqual(current.dimensions.recovery_response, previous.dimensions.recovery_response);
});

test('does not treat volume-only kilogram results as resistance load evidence', () => {
  const windows = [reviewWindow('w1'), reviewWindow('w2'), reviewWindow('w3')].map((window) => ({
    ...window,
    facts: { ...window.facts, performance: { ...window.facts.performance,
      points: window.facts.performance.points.map((point) => ({ ...point, metric: 'volume', value: 1000, unit: 'kg', rir: 2 })),
      comparisons: window.facts.performance.comparisons.map((comparison) => ({ ...comparison, metric: 'volume', value: 1000, unit: 'kg', before: 900, after: 1000 }))
    } }
  }));
  const dna = consumeReviewEvidence({ windows });
  assert.notEqual(dna.dimensions.resistance_response.status, 'validated');
  assert.notEqual(dna.dimensions.resistance_response.confidence, 'high');
});

test('retains decisions when direct review_facts is combined with the decision alias', () => {
  const facts = reviewWindow('w1').facts;
  const dna = consumeReviewFacts({ review_facts: facts, decision: { keep: ['保留同动作比较'], changes: [] } });
  assert.deepEqual(dna.decision_ledger[0].keep, ['保留同动作比较']);
});

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
