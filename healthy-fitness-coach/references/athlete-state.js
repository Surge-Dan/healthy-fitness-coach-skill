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
  'temporary_equipment'
];

const UNKNOWN_MARKERS = new Set(['unknown', 'n/a', 'not provided', '未知', '不清楚', '未提供']);
const SENSITIVE_FIELD_PATTERN = /(?:api[_-]?key|token|authorization|password|secret|e-?mail|phone|contact|address|bank|id[_-]?number|passport|credential|身份证(?:号|号码)?|手机(?:号|号码)?|电话(?:号码)?|邮箱|电子邮件|住址|地址|账号|帐户|账户|密码|密钥|令牌|授权|银行卡|银行账户|联系方式|护照|姓名)/iu;

function hasExplicitValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return !UNKNOWN_MARKERS.has(value.trim().toLowerCase()) && value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function sanitizeValue(value) {
  if (typeof value === 'string') return hasExplicitValue(value) ? value.trim() : undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const sanitized = value.map(sanitizeValue).filter((entry) => entry !== undefined);
    return sanitized.length > 0 ? sanitized : undefined;
  }
  if (value && typeof value === 'object') {
    const sanitized = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_FIELD_PATTERN.test(key)) continue;
      const cleanEntry = sanitizeValue(entry);
      if (cleanEntry !== undefined) sanitized[key] = cleanEntry;
    }
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }
  return undefined;
}

function metadataFrom(input) {
  const source = sanitizeValue(input.source);
  const date = sanitizeValue(input.date);
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
  const source = sanitizeValue(supplied.source);
  const date = sanitizeValue(supplied.date);
  return {
    source: source === undefined ? fallback.source : source,
    date: date === undefined ? fallback.date : date,
    persisted: typeof supplied.persisted === 'boolean' ? supplied.persisted : fallback.persisted
  };
}

function normalizedFields(input, fields, aliases = {}) {
  const metadata = metadataFrom(input);
  const values = {};
  const field_provenance = {};
  for (const field of fields) {
    let cleanValue = sanitizeValue(input[field]);
    if (cleanValue === undefined && aliases[field]) cleanValue = sanitizeValue(input[aliases[field]]);
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

function normalizeContainer(input, fields, aliases) {
  const source = input && typeof input === 'object' ? input : {};
  const normalized = normalizedFields(source, fields, aliases);
  return normalizedResult(fields, normalized.values, normalized.field_provenance, normalized.metadata);
}

function normalizeAthleteProfile(input = {}) {
  return normalizeContainer(input, STABLE_PROFILE_FIELDS);
}

function normalizeCurrentState(input = {}) {
  return normalizeContainer(input, CURRENT_STATE_FIELDS, { temporary_equipment: 'available_equipment' });
}

function normalizeEvidenceState(input = {}) {
  return normalizeContainer(input, EVIDENCE_FIELDS);
}

function mergeAthleteProfile(previous = {}, update = {}) {
  const prior = normalizeAthleteProfile(previous);
  const patch = normalizeAthleteProfile(update);
  const values = {};
  const fieldProvenance = {};

  for (const field of STABLE_PROFILE_FIELDS) {
    if (Object.hasOwn(patch, field)) {
      values[field] = patch[field];
      fieldProvenance[field] = patch.field_provenance[field];
    } else if (Object.hasOwn(prior, field)) {
      values[field] = prior[field];
      fieldProvenance[field] = prior.field_provenance[field];
    }
  }

  const metadata = Object.keys(prior.field_provenance).length > 0
    ? { source: prior.source, date: prior.date, persisted: prior.persisted }
    : { source: patch.source, date: patch.date, persisted: patch.persisted };
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
