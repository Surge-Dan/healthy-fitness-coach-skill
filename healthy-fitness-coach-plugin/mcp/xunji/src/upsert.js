'use strict';

const { connectorError } = require('./errors.js');
const { assertDate } = require('./schemas.js');

function normalizeRecordDate(line) {
  const first = String(line).trim().split(',')[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    return assertDate(first);
  }
  if (/^\d{6}$/.test(first)) {
    const expanded = `20${first.slice(0, 2)}-${first.slice(2, 4)}-${first.slice(4, 6)}`;
    return assertDate(expanded);
  }
  throw connectorError('invalid_upsert');
}

function parseUpsertLine(line) {
  const raw = String(line);
  const date = normalizeRecordDate(raw);
  const tokens = raw.split(',').slice(1).map((token) => token.trim());
  const idToken = tokens.find((token) => /^id:.+/i.test(token));
  const timeToken = tokens.find((token) => /^train_time:.+/i.test(token));
  return {
    raw,
    date,
    ...(idToken ? { id: idToken.slice(3).trim() } : {}),
    ...(timeToken ? { train_time: timeToken.slice('train_time:'.length).trim() } : {})
  };
}

function validateUpsertRecords(records) {
  if (!Array.isArray(records) || records.length === 0) throw connectorError('invalid_upsert');
  if (records.length > 12) throw connectorError('record_limit');
  if (records.some((record) => typeof record !== 'string' || record.length > 1500)) throw connectorError('record_too_long');
  const parsed = records.map(parseUpsertLine);
  const date = parsed[0].date;
  if (parsed.some((record) => record.date !== date)) throw connectorError('mixed_dates');
  return {
    date,
    records: records.slice(),
    parsed,
    existing_ids: parsed.filter((record) => record.id).length,
    new_records: parsed.filter((record) => !record.id).length
  };
}

module.exports = { normalizeRecordDate, parseUpsertLine, validateUpsertRecords };
