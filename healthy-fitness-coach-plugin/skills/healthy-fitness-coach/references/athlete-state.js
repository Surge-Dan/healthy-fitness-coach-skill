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
  'symptoms',
  'available_time_min',
  'temporary_equipment',
  'red_flags',
  'redFlags',
  'safety'
];

const UNKNOWN_MARKERS = new Set(['unknown', 'n/a', 'not provided', '未知', '不清楚', '未提供']);
const LIST_FIELDS = new Set(['available_equipment', 'temporary_equipment', 'long_term_preferences']);
const EVIDENCE_RECORD_SCHEMA = {
  training_records: new Set(['date', 'kind', 'name', 'completed', 'duration_min', 'sets', 'reps', 'load_kg', 'distance_km', 'rir', 'rpe', 'source_record_id']),
  performance: new Set(['date', 'exercise', 'metric', 'value', 'unit', 'trend']),
  recovery_results: new Set(['date', 'sleep_hours', 'stress', 'fatigue', 'pain', 'readiness', 'symptom_trend'])
};

function hasExplicitValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return !UNKNOWN_MARKERS.has(value.trim().toLowerCase()) && value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function sanitizeScalar(value) {
  if (typeof value === 'string') return hasExplicitValue(value) ? value.trim() : undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  return undefined;
}

function sanitizeSimpleValue(field, value) {
  if (!LIST_FIELDS.has(field)) return sanitizeScalar(value);
  if (!Array.isArray(value)) return sanitizeScalar(value);
  const sanitized = value.map(sanitizeScalar).filter((entry) => entry !== undefined);
  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeSafetyFlags(value) {
  if (Array.isArray(value)) {
    const sanitized = value.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return sanitizeScalar(entry);
      const code = sanitizeScalar(entry.code);
      return code === undefined ? undefined : { code };
    }).filter((entry) => entry !== undefined);
    return sanitized.length > 0 ? sanitized : undefined;
  }
  if (value && typeof value === 'object') {
    const code = sanitizeScalar(value.code);
    return code === undefined ? undefined : { code };
  }
  return sanitizeScalar(value);
}

function sanitizeSafetyValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const sanitized = {};
  for (const key of ['red_flags', 'redFlags']) {
    if (Object.hasOwn(value, key)) {
      const flags = sanitizeSafetyFlags(value[key]);
      if (flags !== undefined) sanitized[key] = flags;
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeCurrentStateValue(field, value) {
  if (field === 'red_flags' || field === 'redFlags') return sanitizeSafetyFlags(value);
  if (field === 'symptoms' && Array.isArray(value)) {
    const sanitized = value.map(sanitizeScalar).filter((entry) => entry !== undefined);
    return sanitized.length > 0 ? sanitized : undefined;
  }
  return field === 'safety' ? sanitizeSafetyValue(value) : sanitizeSimpleValue(field, value);
}

function sanitizeEvidenceRecord(record, allowedFields) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined;
  const sanitized = {};
  for (const field of allowedFields) {
    const value = sanitizeScalar(record[field]);
    if (value !== undefined) sanitized[field] = value;
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeEvidenceValue(field, value) {
  if (field === 'completion_rate') return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const allowedFields = EVIDENCE_RECORD_SCHEMA[field];
  if (!allowedFields || !Array.isArray(value)) return undefined;
  const sanitized = value.map((record) => sanitizeEvidenceRecord(record, allowedFields)).filter((record) => record !== undefined);
  return sanitized.length > 0 ? sanitized : undefined;
}

function metadataFrom(input) {
  const source = sanitizeScalar(input.source);
  const date = sanitizeScalar(input.date);
  return {
    source: source === undefined ? 'unknown' : source,
    date: date === undefined ? 'unknown' : date,
    persisted: typeof input.persisted === 'boolean' ? input.persisted : 'unknown'
  };
}

function storageScope(persisted) {
  return persisted === true ? 'persistent' : persisted === false ? 'current_turn_only' : 'not_confirmed';
}

function provenanceForField(input, field, fallback) {
  const fieldProvenance = input.field_provenance && typeof input.field_provenance === 'object'
    ? input.field_provenance[field]
    : null;
  const supplied = fieldProvenance && typeof fieldProvenance === 'object' ? fieldProvenance : {};
  const source = sanitizeScalar(supplied.source);
  const date = sanitizeScalar(supplied.date);
  return {
    source: source === undefined ? fallback.source : source,
    date: date === undefined ? fallback.date : date,
    persisted: typeof supplied.persisted === 'boolean' ? supplied.persisted : fallback.persisted
  };
}

function normalizedFields(input, fields, aliases = {}, sanitizer = sanitizeSimpleValue) {
  const metadata = metadataFrom(input);
  const values = {};
  const field_provenance = {};
  for (const field of fields) {
    let cleanValue = sanitizer(field, input[field]);
    if (cleanValue === undefined && aliases[field]) cleanValue = sanitizer(field, input[aliases[field]]);
    if (cleanValue === undefined) continue;
    values[field] = cleanValue;
    field_provenance[field] = provenanceForField(input, field, metadata);
  }
  return { values, field_provenance, metadata };
}

function normalizedResult(fields, values, fieldProvenance, metadata) {
  return {
    ...values,
    source: metadata.source,
    date: metadata.date,
    persisted: metadata.persisted,
    unknown_fields: fields.filter((field) => !Object.hasOwn(values, field)),
    field_provenance: fieldProvenance,
    storage_scope: storageScope(metadata.persisted)
  };
}

function normalizeContainer(input, fields, aliases, sanitizer) {
  const source = input && typeof input === 'object' ? input : {};
  const normalized = normalizedFields(source, fields, aliases, sanitizer);
  return normalizedResult(fields, normalized.values, normalized.field_provenance, normalized.metadata);
}

function normalizeAthleteProfile(input = {}) {
  return normalizeContainer(input, STABLE_PROFILE_FIELDS);
}

function normalizeCurrentState(input = {}) {
  return normalizeContainer(input, CURRENT_STATE_FIELDS, { temporary_equipment: 'available_equipment' }, sanitizeCurrentStateValue);
}

function normalizeEvidenceState(input = {}) {
  return normalizeContainer(input, EVIDENCE_FIELDS, {}, sanitizeEvidenceValue);
}

function mergeAthleteProfile(previous = {}, update = {}) {
  const prior = normalizeAthleteProfile(previous);
  const patch = normalizeAthleteProfile(update);
  const values = {};
  const fieldProvenance = {};

  for (const field of STABLE_PROFILE_FIELDS) {
    if (Object.hasOwn(patch, field)) {
      values[field] = patch[field];
      fieldProvenance[field] = {
        ...patch.field_provenance[field],
        persisted: patch.field_provenance[field].persisted === 'unknown' && Object.hasOwn(prior.field_provenance, field)
          ? prior.field_provenance[field].persisted
          : patch.field_provenance[field].persisted
      };
    } else if (Object.hasOwn(prior, field)) {
      values[field] = prior[field];
      fieldProvenance[field] = prior.field_provenance[field];
    }
  }

  const persistence = Object.values(fieldProvenance).map((provenance) => provenance.persisted);
  const metadata = {
    source: Object.keys(prior.field_provenance).length > 0 ? prior.source : patch.source,
    date: Object.keys(prior.field_provenance).length > 0 ? prior.date : patch.date,
    persisted: persistence.includes(false) ? false : persistence.length > 0 && persistence.every((intent) => intent === true) ? true : 'unknown'
  };
  return normalizedResult(STABLE_PROFILE_FIELDS, values, fieldProvenance, metadata);
}

function equivalent(valueA, valueB) {
  return JSON.stringify(valueA) === JSON.stringify(valueB);
}

function profileChangeSet(previous = {}, next = {}) {
  const prior = normalizeAthleteProfile(previous);
  const candidate = normalizeAthleteProfile(next);
  const changes = [];

  for (const field of STABLE_PROFILE_FIELDS) {
    const beforeKnown = Object.hasOwn(prior, field);
    const afterKnown = Object.hasOwn(candidate, field);
    if (beforeKnown === afterKnown && (!beforeKnown || equivalent(prior[field], candidate[field]))) continue;
    changes.push({
      field,
      from: beforeKnown ? prior[field] : 'unknown',
      to: afterKnown ? candidate[field] : 'unknown',
      previous_provenance: beforeKnown ? prior.field_provenance[field] : null,
      next_provenance: afterKnown ? candidate.field_provenance[field] : null
    });
  }
  return changes;
}

module.exports = {
  mergeAthleteProfile,
  normalizeAthleteProfile,
  normalizeCurrentState,
  normalizeEvidenceState,
  profileChangeSet
};
