'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { assessTodayReadiness } = require('../references/readiness-engine.js');
const { normalizeCurrentState } = require('../references/athlete-state.js');
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

test('keeps nested red flags when current state is normalized before readiness assessment', () => {
  const currentState = normalizeCurrentState({ safety: { red_flags: ['chest pain'] } });
  const result = assessTodayReadiness({ currentState, program });

  assert.deepEqual(currentState.safety.red_flags, ['chest pain']);
  assert.equal(result.status, 'stop');
  assert.equal(result.minimum_task, null);
});

test('honors the camelCase redFlags alias in nested safety data', () => {
  const result = assessTodayReadiness({
    currentState: { safety: { redFlags: ['recent_surgery'] } },
    program
  });

  assert.equal(result.status, 'stop');
  assert.ok(result.reason_codes.includes('red_flag'));
});

test('stops for every natural-language red flag listed by safety screening', () => {
  for (const symptoms of ['接近晕厥', '大小便功能异常', '明显畸形', '无法负重', '严重肿胀']) {
    const result = assessTodayReadiness({ currentState: { symptoms }, program });

    assert.equal(result.status, 'stop', symptoms);
    assert.equal(result.minimum_task, null, symptoms);
  }
});

test('does not treat an explicitly negative chest-pain answer as a red flag', () => {
  const result = assessTodayReadiness({ currentState: { symptoms: '没有胸痛' }, program });

  assert.equal(result.status, 'proceed');
});

test('keeps top-level red flag aliases when current state is normalized before readiness assessment', () => {
  for (const field of ['red_flags', 'redFlags']) {
    const currentState = normalizeCurrentState({ [field]: ['chest pain'] });
    const result = assessTodayReadiness({ currentState, program });

    assert.deepEqual(currentState[field], ['chest pain']);
    assert.equal(result.status, 'stop');
  }
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

test('routes an ordinary symptoms report through the conservative pain branch', () => {
  const result = assessTodayReadiness({
    currentState: { symptoms: 'shoulder tightness' },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('pain_feedback'));
  assert.equal(result.adjustment.variable, 'movement_variant');
  assert.ok(result.stop_conditions.some((item) => item.code === 'reassess_pain_in_24_to_48_hours'));
});

test('routes an array of ordinary symptoms through the conservative pain branch', () => {
  const result = assessTodayReadiness({
    currentState: { symptoms: ['肩部紧', '膝盖酸'] },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('pain_feedback'));
  assert.equal(result.adjustment.variable, 'movement_variant');
  assert.ok(result.stop_conditions.some((item) => item.code === 'reassess_pain_in_24_to_48_hours'));
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

test('gives time compression priority over fatigue while changing one primary variable', () => {
  const result = assessTodayReadiness({
    currentState: { fatigue: 'high', available_time_min: 15 },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('time_constrained'));
  assert.equal(result.adjustment.variable, 'session_scope');
  assert.equal(result.adjustment.primary_variables_changed, 1);
  assert.deepEqual(result.minimum_task, {
    source: 'program_minimum_version',
    session_id: 'session_1',
    instruction: 'keep_first_two_movement_slots_with_one_to_2_work_sets_each'
  });
});

test('gives time compression priority over one poor sleep report', () => {
  const result = assessTodayReadiness({
    currentState: { sleep: 'poor', available_time_min: 15 },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('time_constrained'));
  assert.equal(result.adjustment.variable, 'session_scope');
  assert.equal(result.adjustment.primary_variables_changed, 1);
  assert.ok(result.minimum_task);
});

test('keeps pain as the sole adjustment while marking a time minimum as plan baseline', () => {
  const result = assessTodayReadiness({
    currentState: { pain: 'shoulder discomfort', available_time_min: 15 },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('pain_feedback'));
  assert.equal(result.adjustment.variable, 'movement_variant');
  assert.equal(result.adjustment.primary_variables_changed, 1);
  assert.equal(result.minimum_task.instruction, 'keep_first_two_movement_slots_with_one_to_2_work_sets_each');
  assert.equal(result.minimum_task_semantics, 'plan_baseline_not_additional_adjustment');
});

test('normalizes numeric strings for time and sleep instead of proceeding silently', () => {
  const shortTime = assessTodayReadiness({
    currentState: { available_time_min: '15' },
    program
  });
  const poorSleep = assessTodayReadiness({
    currentState: { sleep: '5' },
    program
  });

  assert.equal(shortTime.status, 'regress');
  assert.ok(shortTime.reason_codes.includes('time_constrained'));
  assert.equal(poorSleep.status, 'regress');
  assert.ok(poorSleep.reason_codes.includes('single_night_poor_sleep'));
});

test('marks an invalid numeric time value unknown rather than treating it as normal', () => {
  const result = assessTodayReadiness({
    currentState: { available_time_min: 'fifteen' },
    program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('current_state_unknown'));
  assert.equal(result.minimum_task, null);
  assert.equal(result.adjustment.variable, 'state_confirmation');
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

test('today guidance adapts a top-level symptoms alias into the readiness current state', () => {
  const result = buildTodayReadinessGuidance({
    symptoms: 'shoulder tightness',
    current_program: program
  });

  assert.equal(result.status, 'regress');
  assert.ok(result.reason_codes.includes('pain_feedback'));
  assert.ok(result.stop_conditions.some((item) => item.code === 'reassess_pain_in_24_to_48_hours'));
});
