'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { assessTodayReadiness } = require('../references/readiness-engine.js');
const { buildTodayReadinessGuidance } = require('../references/training-guidance.js');

const program = {
  status: 'ready',
  session_budget: { declared_minutes: 30 },
  session_slots: [{
    id: 'session_1',
    minimum_version: 'keep_first_two_movement_slots_with_one_to_2_work_sets_each'
  }]
};

test('stops without an executable training prescription when a current-state red flag is present', () => {
  const result = assessTodayReadiness({
    currentState: { red_flags: ['chest pain'] },
    program
  });

  assert.equal(result.status, 'stop');
  assert.ok(result.reason_codes.includes('red_flag'));
  assert.equal(result.minimum_task, null);
  assert.equal(Object.hasOwn(result, 'session'), false);
  assert.equal(Object.hasOwn(result, 'training_prescription'), false);
  assert.ok(result.stop_conditions.some((item) => item.code === 'seek_appropriate_assessment'));
});

test('stops when a red flag arrives through nested current-state safety data', () => {
  const result = assessTodayReadiness({
    currentState: { safety: { red_flags: ['chest pain'] } },
    program
  });

  assert.equal(result.status, 'stop');
  assert.ok(result.reason_codes.includes('red_flag'));
  assert.equal(result.minimum_task, null);
});

test('uses a conservative pain variant and asks for a 24 to 48 hour reassessment without diagnosing', () => {
  const result = assessTodayReadiness({
    currentState: { pain: 'shoulder discomfort' },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('pain_feedback'));
  assert.equal(result.adjustment.variable, 'movement_variant');
  assert.equal(result.minimum_task.source, 'program_minimum_version');
  assert.ok(result.stop_conditions.some((item) => item.code === 'reassess_pain_in_24_to_48_hours'));
  assert.equal(JSON.stringify(result).includes('diagnosis'), false);
});

test('treats nonzero or unqualified pain reports as conservative pain feedback', () => {
  for (const pain of [4, '肩部紧']) {
    const result = assessTodayReadiness({ currentState: { pain }, program });

    assert.equal(result.status, 'regress');
    assert.ok(result.reason_codes.includes('pain_feedback'));
    assert.equal(result.adjustment.variable, 'movement_variant');
  }
});

test('treats one poor sleep report as a temporary regression rather than overtraining', () => {
  const result = assessTodayReadiness({
    currentState: { sleep: 'poor' },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('single_night_poor_sleep'));
  assert.equal(result.adjustment.variable, 'intensity');
  assert.equal(JSON.stringify(result).toLowerCase().includes('overtraining'), false);
});

test('compresses a short session to the selected program minimum version', () => {
  const result = assessTodayReadiness({
    currentState: { available_time_min: 15 },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('time_constrained'));
  assert.equal(result.adjustment.variable, 'session_scope');
  assert.deepEqual(result.minimum_task, {
    source: 'program_minimum_version',
    session_id: 'session_1',
    instruction: 'keep_first_two_movement_slots_with_one_to_2_work_sets_each'
  });
});

test('does not substitute another session minimum when an explicit session ID is unknown', () => {
  const result = assessTodayReadiness({
    currentState: { available_time_min: 15 },
    session_id: 'session_99',
    program: {
      ...program,
      session_slots: [
        ...program.session_slots,
        { id: 'session_2', minimum_version: 'keep_one_set_of_each_selected_movement' }
      ]
    }
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('session_not_found'));
  assert.equal(result.minimum_task, null);
  assert.equal(result.adjustment.variable, 'session_selection');
});

test('reduces exactly one primary variable for high fatigue without a red flag', () => {
  const result = assessTodayReadiness({
    currentState: { fatigue: 'high' },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('high_fatigue'));
  assert.equal(result.adjustment.variable, 'sets');
  assert.equal(result.adjustment.primary_variables_changed, 1);
});

test('proceeds with the current session when no readiness concern is reported', () => {
  const result = assessTodayReadiness({ currentState: {}, program });

  assert.equal(result.status, 'proceed');
  assert.ok(result.reason_codes.includes('current_state_clear'));
  assert.equal(result.adjustment.variable, 'none');
  assert.equal(result.minimum_task, null);
  assert.ok(result.post_training_record_fields.includes('completed'));
  assert.ok(result.post_training_record_fields.includes('rpe_or_rir'));
  assert.ok(result.post_training_record_fields.includes('pain_or_aerobic_minutes'));
});

test('returns the complete executable result contract for every readiness status', () => {
  const inputs = [
    { currentState: { red_flags: ['chest pain'] }, expected: 'stop' },
    { currentState: { pain: 'shoulder discomfort' }, expected: 'regress' },
    { currentState: {}, expected: 'proceed' }
  ];

  for (const { currentState, expected } of inputs) {
    const result = assessTodayReadiness({ currentState, program });

    assert.equal(result.status, expected);
    for (const field of ['facts', 'reason_codes', 'adjustment', 'minimum_task', 'stop_conditions', 'post_training_record_fields']) {
      assert.ok(Object.hasOwn(result, field), `${expected} result is missing ${field}`);
    }
    assert.ok(result.post_training_record_fields.includes('completed'));
    assert.ok(result.post_training_record_fields.includes('rpe_or_rir'));
  }
});

test('routes today guidance through the readiness engine with current state and current program', () => {
  const result = buildTodayReadinessGuidance({
    currentState: { available_time_min: 15 },
    currentProgram: program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('time_constrained'));
  assert.equal(result.minimum_task.instruction, 'keep_first_two_movement_slots_with_one_to_2_work_sets_each');
});
