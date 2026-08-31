'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  mergeAthleteProfile,
  normalizeAthleteProfile,
  normalizeCurrentState,
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
    training_records: [{ date: '2026-08-30', completed: true }],
    completion_rate: 0.9,
    performance: 'squat improving',
    recovery_results: 'normal after 24 hours',
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
    { field: 'goal', from: 'build strength', to: 'improve cardio' }
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
  const profile = normalizeAthleteProfile({
    training_records: [{ date: '2026-08-30', completed: true, email: 'person@example.com' }],
    performance: { squat: '100kg', api_key: 'secret' }
  });

  assert.deepEqual(profile.training_records, [{ date: '2026-08-30', completed: true }]);
  assert.deepEqual(profile.performance, { squat: '100kg' });
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
