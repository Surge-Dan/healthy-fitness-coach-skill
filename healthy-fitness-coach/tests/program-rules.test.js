'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const {
  selectProgramStructure,
  buildSessionBudget,
  defaultIntensityRules,
  selectCycleMetrics,
  compileProgramRules
} = require('../references/program-rules.js');

test('selects full-body A/B for a two-day standardized profile', () => {
  const structure = selectProgramStructure({
    training_days_per_week: 2,
    goal: 'build strength'
  });

  assert.equal(structure.kind, 'full_body_ab');
  assert.equal(structure.sessions_per_week, 2);
  assert.equal(structure.session_slots.length, 2);
  assert.deepEqual(structure.session_slots.map((slot) => slot.focus), ['full_body_a', 'full_body_b']);
});

test('selects an alternating full-body structure for three training days', () => {
  const structure = selectProgramStructure({ training_days_per_week: 3 });

  assert.equal(structure.kind, 'full_body_alternating');
  assert.equal(structure.session_slots.length, 3);
  assert.deepEqual(structure.session_slots.map((slot) => slot.focus), ['full_body_a', 'full_body_b', 'full_body_a']);
});

test('selects upper-lower structure for four training days', () => {
  const structure = selectProgramStructure({ training_days_per_week: 4, goal: 'hypertrophy' });

  assert.equal(structure.kind, 'upper_lower');
  assert.deepEqual(structure.session_slots.map((slot) => slot.focus), ['upper', 'lower', 'upper', 'lower']);
});

test('builds a bounded beginner session budget that fits declared time', () => {
  const budget = buildSessionBudget({ durationMinutes: 30, experience: 'beginner' });

  assert.ok(budget.planned_minutes <= 30);
  assert.ok(budget.movement_slots >= 2 && budget.movement_slots <= 4);
  assert.ok(budget.sets_per_slot.min >= 1);
  assert.ok(budget.sets_per_slot.max <= 3);
  assert.equal(budget.unknown_duration, false);
});

test('marks a duration below the minimum session as infeasible instead of overflowing its time budget', () => {
  for (const durationMinutes of [1, 5, 7]) {
    const budget = buildSessionBudget({ durationMinutes, experience: 'beginner' });
    assert.equal(budget.feasible, false);
    assert.equal(budget.movement_slots, 0);
    assert.ok(Object.values(budget.allocation).reduce((total, minutes) => total + minutes, 0) <= durationMinutes);
  }

  const plan = compileProgramRules({
    training_days_per_week: 2,
    available_time_min: 5,
    available_equipment: ['dumbbells'],
    injury_or_medical_constraints: 'none reported'
  });
  assert.equal(plan.status, 'needs_input');
  assert.ok(plan.reason_codes.includes('duration_too_short_for_minimum_session'));
  assert.deepEqual(plan.session_slots, []);
});

test('constrains short feasible sessions to a time-fitting total work-set capacity', () => {
  for (const experience of ['beginner', 'intermediate']) {
    const budget = buildSessionBudget({ durationMinutes: 15, experience });
    assert.equal(budget.feasible, true);
    assert.deepEqual(budget.sets_per_slot, { min: 1, max: 1 });
    assert.equal(budget.total_work_sets_max, 2);
    assert.ok(budget.total_work_sets_max <= budget.allocation.work_minutes);
  }
});

test('uses a lower movement-slot cap for beginners than intermediates at the same duration', () => {
  const beginner = buildSessionBudget({ durationMinutes: 60, experience: 'beginner' });
  const intermediate = buildSessionBudget({ durationMinutes: 60, experience: 'intermediate' });

  assert.ok(beginner.movement_slots < intermediate.movement_slots);
  assert.ok(beginner.movement_slots <= 3);
});

test('keeps novice resistance work at 2 to 3 RIR and does not invent an exact load', () => {
  const intensity = defaultIntensityRules({ experience: 'beginner', goal: 'build strength' });

  assert.deepEqual(intensity.resistance.rir_target, { min: 2, max: 3 });
  assert.equal(Object.hasOwn(intensity.resistance, 'load_kg'), false);
  assert.equal(intensity.resistance.failure_policy, 'avoid_routine_failure');
});

test('keeps cardio and resistance cycle metrics distinct and capped at three', () => {
  const metrics = selectCycleMetrics({ goal: 'improve cardio', trackingPreference: ['time', 'load'] });

  assert.ok(metrics.length >= 1 && metrics.length <= 3);
  assert.ok(metrics.some((metric) => metric.domain === 'cardio'));
  assert.ok(metrics.some((metric) => metric.domain === 'resistance'));
  assert.ok(metrics.every((metric) => metric.reason_code));
});

test('compiles structural slots, equipment filters, minimum version and adaptation rules without a hardcoded exercise library', () => {
  const plan = compileProgramRules({
    goal: 'build strength',
    experience_level: 'beginner',
    training_days_per_week: 2,
    available_time_min: 30,
    available_equipment: ['dumbbells', 'bench'],
    injury_or_medical_constraints: 'none reported',
    sex: 'female'
  });

  assert.equal(plan.status, 'ready');
  assert.equal(plan.structure.kind, 'full_body_ab');
  assert.equal(plan.session_budget.planned_minutes <= 30, true);
  assert.equal(plan.exercise_library, undefined);
  assert.ok(plan.session_slots.every((slot) => slot.movement_slots.length > 0));
  assert.ok(plan.session_slots.every((slot) => slot.minimum_version));
  assert.ok(plan.session_slots.every((slot) => slot.equipment_filter.includes('dumbbells')));
  assert.ok(plan.session_slots.every((slot) => slot.substitution_boundary));
  assert.ok(plan.progression_rule);
  assert.ok(plan.regression_rule);
  assert.equal(plan.reason_codes.includes('sex_based_restriction'), false);
});

test('current program template can represent a four-day compiled structure', () => {
  const template = readFileSync(join(__dirname, '..', 'assets', 'current-program-template.md'), 'utf8');

  assert.match(template, /\{\{day_4\}\}/u);
  assert.match(template, /\{\{substitution_boundary\}\}/u);
});

test('safety-blocks extreme or danger-flagged requests without executable sessions', () => {
  for (const profile of [
    { goal: 'lose 10 kg in one week', training_days_per_week: 7 },
    { goal: 'build strength', red_flags: ['chest pain'] },
    { goal: 'build strength', injury_or_medical_constraints: 'acute injury' }
  ]) {
    const plan = compileProgramRules(profile);
    assert.equal(plan.status, 'blocked');
    assert.ok(plan.reason_codes.includes('safety_block'));
    assert.equal(Object.hasOwn(plan, 'session_slots'), false);
  }
});

test('honors an explicit boolean red flag from an upstream safety screen', () => {
  const plan = compileProgramRules({
    goal: 'build strength',
    training_days_per_week: 3,
    red_flags: true
  });

  assert.equal(plan.status, 'blocked');
  assert.ok(plan.reason_codes.includes('danger_flag'));
  assert.equal(Object.hasOwn(plan, 'session_slots'), false);
});

test('honors a non-empty upstream safety code even when it is not prose', () => {
  const plan = compileProgramRules({
    goal: 'build strength',
    training_days_per_week: 3,
    red_flags: ['medical_clearance_required']
  });

  assert.equal(plan.status, 'blocked');
  assert.ok(plan.reason_codes.includes('danger_flag'));
});

test('does not mark unsupported or invalid frequencies as executable defaults', () => {
  for (const training_days_per_week of [0, 5, 7]) {
    const plan = compileProgramRules({
      training_days_per_week,
      available_time_min: 45,
      available_equipment: ['dumbbells'],
      injury_or_medical_constraints: 'none reported'
    });
    assert.equal(plan.status, 'needs_input');
    assert.equal(plan.session_slots.length, 0);
    assert.ok(plan.reason_codes.some((code) => code === 'invalid_training_frequency' || code === 'frequency_requires_custom_structure'));
  }
});

test('does not emit an empty session minimum when duration is unknown', () => {
  const plan = compileProgramRules({
    training_days_per_week: 2,
    available_equipment: ['dumbbells'],
    injury_or_medical_constraints: 'none reported'
  });

  assert.equal(plan.status, 'needs_input');
  assert.deepEqual(plan.session_slots, []);
  assert.ok(plan.reason_codes.includes('duration_unknown_no_exact_budget'));
});

test('blocks equivalent extreme-loss timeline wording', () => {
  const plan = compileProgramRules({ goal: 'lose 20 lb in 7 days', training_days_per_week: 3 });

  assert.equal(plan.status, 'blocked');
  assert.ok(plan.reason_codes.includes('extreme_request'));
});
