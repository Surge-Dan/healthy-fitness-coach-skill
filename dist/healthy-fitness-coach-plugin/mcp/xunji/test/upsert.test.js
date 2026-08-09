'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { validateUpsertRecords } = require('../src/upsert.js');

test('validates same-day records in long and compact date formats', () => {
  const result = validateUpsertRecords([
    '2026-08-01,id:123,胸部训练,train_time:1744010000000-1744013600000',
    '260801,有氧,2.跑步,5km'
  ]);
  assert.equal(result.date, '2026-08-01');
  assert.equal(result.records.length, 2);
  assert.equal(result.existing_ids, 1);
  assert.equal(result.new_records, 1);
  assert.equal(result.parsed[0].id, '123');
  assert.equal(result.parsed[0].train_time, '1744010000000-1744013600000');
});

test('rejects mixed dates before any network call', () => {
  assert.throws(() => validateUpsertRecords([
    '2026-08-01,id:1,胸部训练',
    '2026-08-02,id:2,背部训练'
  ]), { code: 'mixed_dates' });
});

test('rejects empty, oversized, and over-limit write batches', () => {
  assert.throws(() => validateUpsertRecords([]), { code: 'invalid_upsert' });
  assert.throws(() => validateUpsertRecords(['2026-08-01,' + 'x'.repeat(1500)]), { code: 'record_too_long' });
  assert.throws(() => validateUpsertRecords(Array.from({ length: 13 }, () => '2026-08-01,休息日')), { code: 'record_limit' });
});
