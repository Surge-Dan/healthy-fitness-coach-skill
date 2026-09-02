'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  deriveReviewFacts,
  buildReviewJudgments,
  selectProgramChanges,
  buildDecisionLogEntry
} = require('../references/review-decision-engine.js');
const { summarizeTrainingRange } = require('../references/training-summary.js');

function record(date, id, value, overrides = {}) {
  return {
    date,
    source_record_id: id,
    exercise: 'Bench press',
    metric: 'load',
    value,
    unit: 'kg',
    rir: 2,
    sets: 3,
    completed: true,
    ...overrides
  };
}

test('training summary exposes review adherence, evidence provenance, and unit quality', () => {
  const result = summarizeTrainingRange({
    training_days: 2,
    record_count: 2,
    adherence: 0.5,
    warnings: [{ code: 'mixed_units' }],
    evidence_ledger: [{ date: '2026-08-01', source_record_id: 'a' }],
    training_dna: { data_quality: { warning_count: 1 }, metrics: {} }
  });
  assert.deepEqual(result.adherence, { rate: 0.5, known: true });
  assert.deepEqual(result.evidence_ledger, [{ date: '2026-08-01', source_record_id: 'a' }]);
  assert.equal(result.data_quality.status, 'partial');
  assert.equal(result.data_quality.mixed_units, true);
});

test('derives comparable facts without turning one decline into a plateau', () => {
  const facts = deriveReviewFacts({
    date_start: '2026-08-01',
    date_end: '2026-08-21',
    completion_rate_series: [0.9, 0.9, 0.9],
    records: [record('2026-08-01', 'a', 60), record('2026-08-08', 'b', 57.5), record('2026-08-15', 'c', 60)]
  });

  assert.equal(facts.performance.trend_status, 'improving');
  assert.equal(facts.performance.comparisons.length, 2);
  assert.equal(facts.performance.decline_count, 1);
  assert.equal(facts.performance.plateau_status, 'not_concluded');
  assert.deepEqual(facts.performance.comparisons[1].source_record_ids, ['b', 'c']);
});

test('marks missing and mixed-unit evidence unknown instead of generating a trend', () => {
  const missing = deriveReviewFacts({ records: [] });
  assert.equal(missing.quality.status, 'unknown');
  assert.equal(missing.performance.trend_status, 'unknown');
  assert.match(missing.uncertainties.join(' '), /数据|记录/);

  const mixed = deriveReviewFacts({ records: [
    record('2026-08-01', 'a', 60),
    record('2026-08-08', 'b', 132, { unit: 'lb' })
  ] });
  assert.equal(mixed.quality.mixed_units, true);
  assert.equal(mixed.performance.trend_status, 'unknown');
  assert.equal(mixed.performance.comparisons.length, 0);

  const incomplete = deriveReviewFacts({
    missing_dates: ['2026-08-15'],
    records: [record('2026-08-01', 'a', 60), record('2026-08-08', 'b', 62.5)]
  });
  assert.equal(incomplete.quality.status, 'partial');
  assert.equal(incomplete.performance.trend_status, 'unknown');

  const missingRecordFields = deriveReviewFacts({
    records: [
      record('2026-08-01', 'a', 60),
      record(undefined, 'missing-date', 61),
      record('2026-08-15', 'c', 62.5, { exercise: undefined })
    ]
  });
  assert.equal(missingRecordFields.quality.status, 'unknown');
  assert.equal(missingRecordFields.performance.trend_status, 'unknown');
});

test('does not use undated recovery observations to trigger a deload', () => {
  const facts = deriveReviewFacts({
    date_start: '2026-08-01',
    date_end: '2026-08-28',
    recovery: [{ sleep_hours: 5, fatigue: 8 }, { sleep_hours: 5.5, fatigue: 8 }],
    records: [
      record('2026-08-01', 'a', 60), record('2026-08-08', 'b', 57.5),
      record('2026-08-15', 'c', 55), record('2026-08-22', 'd', 52.5)
    ]
  });
  const judgments = buildReviewJudgments(facts);
  assert.equal(facts.recovery.status, 'unknown');
  assert.equal(judgments.judgments.some((item) => item.code === 'poor_recovery_with_decline'), false);
});

test('keeps missing completion windows as placeholders and blocks sustained-low inference', () => {
  const facts = deriveReviewFacts({ completion_rate_series: [0.5, null, 0.6], records: [record('2026-08-01', 'a', 60)] });
  assert.equal(facts.adherence.rates.length, 3);
  assert.equal(facts.adherence.rates[1].known, false);
  assert.equal(facts.adherence.sustained_low, false);
  assert.equal(buildReviewJudgments(facts).judgments.some((item) => item.code === 'low_adherence'), false);
});

test('judges sustained low adherence as complexity reduction and repeated decline with poor recovery as deload', () => {
  const facts = deriveReviewFacts({
    date_start: '2026-08-01',
    date_end: '2026-08-28',
    completion_rate_series: [0.5, 0.6],
    recovery: [
      { date: '2026-08-15', sleep_hours: 5.5, fatigue: 8 },
      { date: '2026-08-22', sleep_hours: 5, fatigue: 8 }
    ],
    records: [
      record('2026-08-01', 'a', 60), record('2026-08-08', 'b', 57.5),
      record('2026-08-15', 'c', 55), record('2026-08-22', 'd', 52.5)
    ]
  });
  const judgments = buildReviewJudgments(facts);
  assert.equal(judgments.judgments.find((item) => item.code === 'low_adherence').decision.variable, 'complexity');
  assert.equal(judgments.judgments.find((item) => item.code === 'poor_recovery_with_decline').decision.variable, 'volume');
});

test('allows progression for comparable improvement and observes a single decline', () => {
  const improving = buildReviewJudgments(deriveReviewFacts({
    records: [record('2026-08-01', 'a', 60), record('2026-08-08', 'b', 62.5)]
  }));
  assert.equal(improving.judgments.find((item) => item.code === 'comparable_improvement').decision.variable, 'progression');

  const declining = buildReviewJudgments(deriveReviewFacts({
    records: [record('2026-08-01', 'a', 60), record('2026-08-08', 'b', 57.5)]
  }));
  const observed = declining.judgments.find((item) => item.code === 'single_decline');
  assert.ok(observed);
  assert.equal(observed.decision.action, 'observe');
  assert.equal(observed.decision.rewrite_plan, false);
});

test('selects at most two traceable changes and emits field-level program diff', () => {
  const currentProgram = {
    version: 'v1',
    session_budget: { movement_slots: 4, total_work_sets_max: 16 },
    progression_rule: 'progress_repetitions_before_load'
  };
  const judgments = buildReviewJudgments(deriveReviewFacts({
    date_end: '2026-08-28',
    review_date: '2026-09-11',
    completion_rate_series: [0.5, 0.6],
    recovery: [{ date: '2026-08-15', sleep_hours: 5, fatigue: 8 }, { date: '2026-08-22', sleep_hours: 5.5, fatigue: 8 }],
    records: [
      record('2026-08-01', 'a', 60), record('2026-08-08', 'b', 57.5),
      record('2026-08-15', 'c', 55), record('2026-08-22', 'd', 52.5)
    ]
  }));
  const result = selectProgramChanges(judgments, currentProgram);

  assert.equal(result.changes.length, 2);
  for (const change of result.changes) {
    assert.ok(change.expected_effect);
    assert.ok(change.rollback_condition);
    assert.equal(change.review_date, '2026-09-11');
    assert.ok(change.evidence_record_ids.length >= 1);
  }
  assert.ok(result.kept.length >= 1);
  assert.ok(result.field_diffs.some((diff) => diff.path === 'session_budget.movement_slots'));
  assert.notDeepEqual(result.proposed_program, currentProgram);
});

test('builds an auditable decision log with fixed evidence order and versions', () => {
  const entry = buildDecisionLogEntry({
    date: '2026-09-01',
    review_date: '2026-09-15',
    current_program: { version: 'v1', session_budget: { movement_slots: 3 } },
    records: [record('2026-08-25', 'a', 60), record('2026-09-01', 'b', 62.5)]
  });
  assert.equal(entry.evidence_order.join('→'), '事实→推断→不确定性→决策→验证');
  assert.equal(entry.program_version.from, 'v1');
  assert.ok(entry.program_version.to);
  assert.ok(Array.isArray(entry.decision.keep));
  assert.ok(Array.isArray(entry.decision.changes));
  assert.ok(entry.validation.review_date);
});

test('rejects a direct adjustment judgment without a known review date', () => {
  const result = selectProgramChanges({ judgments: [{
    code: 'direct_adjustment',
    result: 'adjust',
    facts: [{ source_record_ids: ['a'] }],
    decision: { action: 'deload', variable: 'volume' },
    validation: { metric: 'recovery' }
  }] }, { version: 'v1', session_budget: { total_work_sets_max: 12 } });
  assert.equal(result.changes.length, 0);
});

test('decision log drops injected changes when the per-change review date is missing', () => {
  const entry = buildDecisionLogEntry({
    date: '2026-09-01',
    review_date: '2026-09-15',
    current_program: { version: 'v1', session_budget: { total_work_sets_max: 12 } },
    records: [record('2026-08-25', 'a', 60), record('2026-09-01', 'b', 62.5)],
    decision: { kept: [], changes: [{ variable: 'volume', expected_effect: 'less fatigue', rollback_condition: 'fatigue persists' }], field_diffs: [], program_version: { from: 'v1', to: 'v2' } }
  });
  assert.deepEqual(entry.decision.changes, []);
});

test('decision log drops injected changes with an invalid per-change review date', () => {
  const entry = buildDecisionLogEntry({
    date: '2026-09-01',
    review_date: '2026-09-15',
    current_program: { version: 'v1', session_budget: { total_work_sets_max: 12 } },
    records: [record('2026-08-25', 'a', 60), record('2026-09-01', 'b', 62.5)],
    decision: { kept: [], changes: [{ variable: 'volume', review_date: '2026-02-30', expected_effect: 'less fatigue', rollback_condition: 'fatigue persists' }], field_diffs: [], program_version: { from: 'v1', to: 'v2' } }
  });
  assert.deepEqual(entry.decision.changes, []);
});

test('decision log de-duplicates and caps injected changes with traceable evidence only', () => {
  const entry = buildDecisionLogEntry({
    date: '2026-09-01',
    current_program: { version: 'v1', session_budget: { total_work_sets_max: 12 } },
    records: [record('2026-08-25', 'a', 60), record('2026-09-01', 'b', 62.5)],
    decision: {
      kept: [],
      field_diffs: [],
      program_version: { from: 'v1', to: 'v2' },
      changes: [
        { variable: 'volume', review_date: '2026-09-15', evidence_record_ids: ['a'], expected_effect: 'less fatigue', rollback_condition: 'fatigue persists' },
        { variable: 'volume', review_date: '2026-09-15', evidence_record_ids: ['b'], expected_effect: 'less fatigue', rollback_condition: 'fatigue persists' },
        { variable: 'complexity', review_date: '2026-09-15', evidence_record_ids: [], expected_effect: 'easier completion', rollback_condition: 'completion falls' },
        { variable: 'progression', review_date: '2026-09-15', evidence_record_ids: ['a'], expected_effect: 'better performance', rollback_condition: 'performance falls' }
      ]
    }
  });
  assert.ok(entry.decision.changes.length <= 2);
  assert.equal(new Set(entry.decision.changes.map((change) => change.variable)).size, entry.decision.changes.length);
  assert.ok(entry.decision.changes.every((change) => Array.isArray(change.evidence_record_ids) && change.evidence_record_ids.length > 0));
});
