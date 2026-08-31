'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  mergeAthleteProfile,
  normalizeAthleteProfile,
  normalizeCurrentState,
  normalizeEvidenceState,
  profileChangeSet
} = require('../references/athlete-state.js');

test('normalizes only explicit stable-profile values and labels unknowns', () => {
  const profile = normalizeAthleteProfile({
    goal: 'build strength',
    experience_level: 'beginner',
    training_days_per_week: 3,
    available_time_min: 45,
    training_venue: 'gym',
    available_equipment: ['barbell', 'bench'],
    injury_or_medical_constraints: 'none reported',
    long_term_preferences: ['track main lifts'],
    source: 'user message',
    date: '2026-08-31',
    persisted: true
  });

  assert.equal(profile.goal, 'build strength');
  assert.equal(profile.available_time_min, 45);
  assert.deepEqual(profile.available_equipment, ['barbell', 'bench']);
  assert.deepEqual(profile.unknown_fields, []);
  assert.equal(profile.source, 'user message');
  assert.equal(profile.date, '2026-08-31');
  assert.equal(profile.persisted, true);
});

test('keeps omitted stable values unknown instead of inventing defaults', () => {
  const profile = normalizeAthleteProfile({ goal: 'improve health' });

  assert.equal(profile.goal, 'improve health');
  assert.equal(Object.hasOwn(profile, 'training_days_per_week'), false);
  assert.ok(profile.unknown_fields.includes('training_days_per_week'));
  assert.equal(profile.source, 'unknown');
  assert.equal(profile.date, 'unknown');
  assert.equal(profile.persisted, 'unknown');
});

test('treats an explicit unknown marker as unknown rather than profile data', () => {
  const profile = normalizeAthleteProfile({
    goal: 'unknown',
    experience_level: '不清楚'
  });

  assert.equal(Object.hasOwn(profile, 'goal'), false);
  assert.equal(Object.hasOwn(profile, 'experience_level'), false);
  assert.ok(profile.unknown_fields.includes('goal'));
  assert.ok(profile.unknown_fields.includes('experience_level'));
});

test('records an explicit replacement of a stable profile fact as a field change', () => {
  const previous = normalizeAthleteProfile({
    goal: 'build strength',
    training_days_per_week: 3,
    source: 'intake',
    date: '2026-08-01',
    persisted: true
  });
  const next = mergeAthleteProfile(previous, {
    goal: 'improve cardio',
    source: 'follow-up',
    date: '2026-08-31'
  });

  assert.equal(next.goal, 'improve cardio');
  assert.equal(next.training_days_per_week, 3);
  assert.deepEqual(profileChangeSet(previous, next), [
    {
      field: 'goal',
      from: 'build strength',
      to: 'improve cardio',
      previous_provenance: { source: 'intake', date: '2026-08-01', persisted: true },
      next_provenance: { source: 'follow-up', date: '2026-08-31', persisted: true }
    }
  ]);
});

test('keeps transient sleep fatigue and pain out of the long-term profile', () => {
  const profile = normalizeAthleteProfile({
    goal: 'build strength',
    sleep: '4 hours',
    fatigue: 'high',
    pain: 'left knee sore'
  });
  const currentState = normalizeCurrentState({
    sleep: '4 hours',
    stress: 'high',
    fatigue: 'high',
    pain: 'left knee sore',
    available_time_min: 20,
    temporary_equipment: ['resistance band']
  });

  assert.equal(Object.hasOwn(profile, 'sleep'), false);
  assert.equal(Object.hasOwn(profile, 'fatigue'), false);
  assert.equal(Object.hasOwn(profile, 'pain'), false);
  assert.equal(currentState.sleep, '4 hours');
  assert.equal(currentState.fatigue, 'high');
  assert.equal(currentState.pain, 'left knee sore');
});

test('rejects sensitive and unrelated fields from both profile and current state', () => {
  const profile = normalizeAthleteProfile({
    goal: 'build strength',
    api_key: 'secret',
    phone: '13800000000',
    email: 'person@example.com',
    bank_account: '123456',
    favorite_color: 'blue'
  });
  const currentState = normalizeCurrentState({
    fatigue: 'moderate',
    authorization: 'Bearer secret',
    contact: 'person@example.com',
    id_number: '1234567890'
  });

  for (const forbidden of ['api_key', 'phone', 'email', 'bank_account', 'favorite_color']) {
    assert.equal(Object.hasOwn(profile, forbidden), false);
  }
  for (const forbidden of ['authorization', 'contact', 'id_number']) {
    assert.equal(Object.hasOwn(currentState, forbidden), false);
  }
});

test('removes sensitive nested properties from whitelisted evidence values', () => {
  const evidence = normalizeEvidenceState({
    training_records: [{ date: '2026-08-30', completed: true, email: 'person@example.com' }],
    performance: [{ date: '2026-08-30', exercise: 'squat', value: 100, unit: 'kg', api_key: 'secret' }]
  });

  assert.deepEqual(evidence.training_records, [{ date: '2026-08-30', completed: true }]);
  assert.deepEqual(evidence.performance, [{ date: '2026-08-30', exercise: 'squat', value: 100, unit: 'kg' }]);
});

test('keeps stable, current and evidence state in separate normalized containers', () => {
  const profile = normalizeAthleteProfile({
    goal: 'build strength',
    fatigue: 'high',
    training_records: [{ date: '2026-08-30' }]
  });
  const currentState = normalizeCurrentState({
    fatigue: 'high',
    goal: 'build strength',
    completion_rate: 0.8
  });
  const evidence = normalizeEvidenceState({
    training_records: [{ date: '2026-08-30' }],
    completion_rate: 0.8,
    goal: 'build strength'
  });
  const merged = mergeAthleteProfile(profile, {
    training_records: [{ date: '2026-08-31' }],
    recovery_results: 'normal'
  });

  assert.equal(Object.hasOwn(profile, 'training_records'), false);
  assert.equal(Object.hasOwn(profile, 'fatigue'), false);
  assert.equal(Object.hasOwn(currentState, 'goal'), false);
  assert.equal(Object.hasOwn(currentState, 'completion_rate'), false);
  assert.equal(Object.hasOwn(evidence, 'goal'), false);
  assert.equal(Object.hasOwn(merged, 'training_records'), false);
  assert.deepEqual(evidence.training_records, [{ date: '2026-08-30' }]);
});

test('drops nested Chinese and English sensitive values and returns emptied evidence fields to unknown', () => {
  const evidence = normalizeEvidenceState({
    training_records: [{ 手机号: '13800000000', nested: { 邮箱: 'person@example.com' } }],
    performance: { 身份证号: '110101...', api_key: 'secret' },
    recovery_results: [{ 住址: 'Beijing', 密码: 'secret' }]
  });

  assert.equal(Object.hasOwn(evidence, 'training_records'), false);
  assert.equal(Object.hasOwn(evidence, 'performance'), false);
  assert.equal(Object.hasOwn(evidence, 'recovery_results'), false);
  assert.ok(evidence.unknown_fields.includes('training_records'));
  assert.ok(evidence.unknown_fields.includes('performance'));
  assert.ok(evidence.unknown_fields.includes('recovery_results'));
});

test('preserves unchanged field provenance while auditing only the updated profile field', () => {
  const previous = normalizeAthleteProfile({
    goal: 'build strength',
    training_days_per_week: 3,
    source: 'intake',
    date: '2026-08-01',
    persisted: true
  });
  const next = mergeAthleteProfile(previous, {
    goal: 'improve cardio',
    source: 'follow-up',
    date: '2026-08-31',
    persisted: false
  });

  assert.deepEqual(next.field_provenance.goal, { source: 'follow-up', date: '2026-08-31', persisted: false });
  assert.deepEqual(next.field_provenance.training_days_per_week, { source: 'intake', date: '2026-08-01', persisted: true });
  assert.equal(next.source, 'intake');
  assert.equal(next.date, '2026-08-01');
  assert.equal(next.persisted, false);
  assert.equal(next.storage_scope, 'current_turn_only');
  assert.deepEqual(profileChangeSet(previous, next), [
    {
      field: 'goal',
      from: 'build strength',
      to: 'improve cardio',
      previous_provenance: { source: 'intake', date: '2026-08-01', persisted: true },
      next_provenance: { source: 'follow-up', date: '2026-08-31', persisted: false }
    }
  ]);
});

test('maps current-state available_equipment into temporary_equipment only', () => {
  const currentState = normalizeCurrentState({ available_equipment: ['hotel dumbbells'] });

  assert.deepEqual(currentState.temporary_equipment, ['hotel dumbbells']);
  assert.equal(Object.hasOwn(currentState, 'available_equipment'), false);
  assert.ok(currentState.unknown_fields.includes('available_time_min'));
});

test('keeps only explicit nested evidence schema fields and rejects account-data bypasses', () => {
  const evidence = normalizeEvidenceState({
    training_records: [{
      date: '2026-08-30',
      completed: true,
      duration_min: 45,
      account_number: '123456',
      credit_card: '4111111111111111',
      nested: { ssn: '123-45-6789' }
    }],
    performance: [{
      date: '2026-08-30',
      exercise: 'squat',
      value: 100,
      unit: 'kg',
      driver_license: 'D1234567'
    }],
    recovery_results: [{ date: '2026-08-31', fatigue: 'low', social_security_number: '123-45-6789' }]
  });

  assert.deepEqual(evidence.training_records, [{ date: '2026-08-30', completed: true, duration_min: 45 }]);
  assert.deepEqual(evidence.performance, [{ date: '2026-08-30', exercise: 'squat', value: 100, unit: 'kg' }]);
  assert.deepEqual(evidence.recovery_results, [{ date: '2026-08-31', fatigue: 'low' }]);
});

test('returns an all-temporary merge candidate when any update rejects persistence', () => {
  const previous = normalizeAthleteProfile({
    goal: 'build strength',
    training_days_per_week: 3,
    persisted: true
  });
  const candidate = mergeAthleteProfile(previous, {
    goal: 'improve cardio',
    persisted: false
  });

  assert.equal(candidate.persisted, false);
  assert.equal(candidate.storage_scope, 'current_turn_only');
  assert.equal(candidate.field_provenance.training_days_per_week.persisted, true);
  assert.equal(candidate.field_provenance.goal.persisted, false);
});

test('keeps refused persistence as temporary current-turn state', () => {
  const currentState = normalizeCurrentState({
    sleep: '5 hours',
    fatigue: 'high',
    persisted: false,
    source: 'user message',
    date: '2026-08-31'
  });

  assert.equal(currentState.sleep, '5 hours');
  assert.equal(currentState.fatigue, 'high');
  assert.equal(currentState.persisted, false);
  assert.equal(currentState.storage_scope, 'current_turn_only');
});
