'use strict';

const STABLE_PROFILE_FIELDS = [
  'goal',
  'experience_level',
  'training_days_per_week',
  'available_time_min',
  'training_venue',
  'available_equipment',
  'injury_or_medical_constraints',
  'long_term_preferences'
];

const EVIDENCE_FIELDS = [
  'training_records',
  'completion_rate',
  'performance',
  'recovery_results'
];

const CURRENT_STATE_FIELDS = [
  'sleep',
  'stress',
  'fatigue',
  'pain',
  'available_time_min',
  'temporary_equipment',
  'available_equipment'
];

const PROFILE_FIELDS = [...STABLE_PROFILE_FIELDS, ...EVIDENCE_FIELDS];
const SENSITIVE_FIELD_PATTERN = /(?:api[_-]?key|token|authorization|password|secret|e-?mail|phone|contact|address|bank|id[_-]?number|passport|credential)/iu;

function hasExplicitValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized !== '' && !['unknown', 'n/a', 'not provided', '未知', '不清楚', '未提供'].includes(normalized);
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !SENSITIVE_FIELD_PATTERN.test(key))
      .map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function metadataFrom(input, fields) {
  const persisted = typeof input.persisted === 'boolean' ? input.persisted : 'unknown';
  return {
    source: hasExplicitValue(input.source) ? cloneValue(input.source) : 'unknown',
    date: hasExplicitValue(input.date) ? cloneValue(input.date) : 'unknown',
    persisted,
    unknown_fields: fields.filter((field) => !hasExplicitValue(input[field]))
  };
}

function normalizedFields(input, fields) {
  const normalized = {};
  for (const field of fields) {
    if (hasExplicitValue(input[field])) normalized[field] = cloneValue(input[field]);
  }
  return normalized;
}

function normalizeAthleteProfile(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    ...normalizedFields(source, PROFILE_FIELDS),
    ...metadataFrom(source, PROFILE_FIELDS),
    storage_scope: source.persisted === true ? 'persistent' : source.persisted === false ? 'current_turn_only' : 'not_confirmed'
  };
}

function normalizeCurrentState(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    ...normalizedFields(source, CURRENT_STATE_FIELDS),
    ...metadataFrom(source, CURRENT_STATE_FIELDS),
    storage_scope: source.persisted === true ? 'persistent' : source.persisted === false ? 'current_turn_only' : 'not_confirmed'
  };
}

function explicitMetadata(input, key) {
  if (key === 'persisted') return typeof input.persisted === 'boolean';
  return hasExplicitValue(input[key]);
}

function mergeAthleteProfile(previous = {}, update = {}) {
  const prior = previous && typeof previous === 'object' ? previous : {};
  const patch = update && typeof update === 'object' ? update : {};
  const merged = {};

  for (const field of PROFILE_FIELDS) {
    if (hasExplicitValue(patch[field])) merged[field] = cloneValue(patch[field]);
    else if (hasExplicitValue(prior[field])) merged[field] = cloneValue(prior[field]);
  }

  for (const key of ['source', 'date', 'persisted']) {
    if (explicitMetadata(patch, key)) merged[key] = cloneValue(patch[key]);
    else if (explicitMetadata(prior, key) && prior[key] !== 'unknown') merged[key] = cloneValue(prior[key]);
  }

  return normalizeAthleteProfile(merged);
}

function profileChangeSet(previous = {}, next = {}) {
  const prior = previous && typeof previous === 'object' ? previous : {};
  const candidate = next && typeof next === 'object' ? next : {};
  const changes = [];

  for (const field of PROFILE_FIELDS) {
    const before = prior[field];
    const after = candidate[field];
    if (hasExplicitValue(before) && hasExplicitValue(after) && JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ field, from: cloneValue(before), to: cloneValue(after) });
    }
  }
  return changes;
}

module.exports = {
  mergeAthleteProfile,
  normalizeAthleteProfile,
  normalizeCurrentState,
  profileChangeSet
};
