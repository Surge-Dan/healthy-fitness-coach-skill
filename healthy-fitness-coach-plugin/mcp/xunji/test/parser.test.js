'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { filterModelFacingRecords, parseTrainingRecords } = require('../src/parser.js');

test('parser retains raw text, tokens, and comma-containing notes', () => {
  const [record] = parseTrainingRecords([
    'id: alpha-1 train_time: 2026-08-01 18:30, name: Squat, 3 sets x 5 reps, note: slow, controlled descent'
  ]);

  assert.equal(record.id, 'alpha-1');
  assert.equal(record.train_time, '2026-08-01 18:30');
  assert.equal(record.parse_status, 'complete');
  assert.match(record.raw_text, /slow, controlled descent/);
  assert.ok(record.notes.some((note) => note.includes('slow, controlled descent')));
});

test('parser identifies raw Garmin source markers case-insensitively', () => {
  const records = parseTrainingRecords([
    'id: raw-1 train_time: 2026-08-01 08:00, source: Garmin, note: imported',
    'id: raw-2 train_time: 2026-08-01 09:00 | data_source=GARMIN'
  ]);
  assert.equal(records[0].data_source, 'Garmin');
  assert.equal(records[1].data_source, 'GARMIN');
  assert.deepEqual(filterModelFacingRecords(records).map((record) => record.id), []);
});

test('parser preserves unrecognized comma fragments in notes', () => {
  const [record] = parseTrainingRecords(['id: note-1 train_time: 2026-08-01 08:00, mystery_fragment: keep this, another unknown detail']);
  assert.ok(record.notes.some((note) => note.includes('mystery_fragment: keep this')));
  assert.ok(record.notes.some((note) => note.includes('another unknown detail')));
});

test('parser preserves unknown fragments and flags extreme weights', () => {
  const [record] = parseTrainingRecords(['id: beta-2 | lift=Deadlift | 1 x 1 @ 999kg | device=unknown']);

  assert.equal(record.parse_status, 'partial');
  assert.ok(record.warnings.some((warning) => warning.includes('extreme_weight')));
  assert.ok(record.notes.some((note) => note.includes('device=unknown')));
});

test('parser keeps multiple records and raw-only format drift', () => {
  const records = parseTrainingRecords(['id: one train_time: 2026-08-01 08:00 name: Press', 'unstructured format drift']);

  assert.equal(records.length, 2);
  assert.equal(records[1].parse_status, 'raw_only');
  assert.equal(records[1].raw_text, 'unstructured format drift');
});

test('model-facing filter removes Garmin records and warns on unknown sources', () => {
  const input = [
    { id: 'allowed', data_source: 'xunji_user' },
    { id: 'restricted', data_source: 'garmin' },
    { id: 'unknown' }
  ];
  const result = filterModelFacingRecords(input);

  assert.deepEqual(result.map((item) => item.id), ['allowed', 'unknown']);
  assert.equal(result.warnings.length, 1);
});

test('parser understands official Xunji dated training rows and preserves write-back tokens', () => {
  const [record] = parseTrainingRecords([
    '2026-08-01,id:123456,胸部训练,train_time:1744010000000-1744013600000,状态不错,1.卧推,1组,60kg,10次,2组,60kg,8次'
  ]);
  assert.equal(record.record_date, '2026-08-01');
  assert.equal(record.id, '123456');
  assert.equal(record.title, '胸部训练');
  assert.equal(record.train_time, '1744010000000-1744013600000');
  assert.equal(record.sets, 3);
  assert.equal(record.total_reps, 26);
  assert.equal(record.volume, 1560);
  assert.equal(record.parse_status, 'complete');
});

test('parser extracts official aerobic metrics without treating them as resistance sets', () => {
  const [record] = parseTrainingRecords([
    '2026-08-02,id:987,有氧,2.跑步,5km,300kcal,time:1800s,140bpm'
  ]);

  assert.equal(record.record_date, '2026-08-02');
  assert.equal(record.title, '有氧');
  assert.equal(record.duration_min, 30);
  assert.equal(record.distance_km, 5);
  assert.equal(record.avg_hr, 140);
  assert.equal(record.kind, 'aerobic');
  assert.equal(record.sets, undefined);
});

test('parser recognizes official rest days, invalid calendar dates, minutes, and weight units', () => {
  const [rest] = parseTrainingRecords(['2026-08-03,id:rest,休息日']);
  assert.equal(rest.kind, 'rest_day');
  const [bad] = parseTrainingRecords(['2026-02-30,id:bad,press,1组,100lb,5次']);
  assert.ok(bad.warnings.includes('invalid_date'));
  const [run] = parseTrainingRecords(['2026-08-04,id:run,有氧,跑步,30分钟']);
  assert.equal(run.duration_min, 30);
  const [lift] = parseTrainingRecords(['2026-08-05,id:lb,press,1组,100lb,5次']);
  assert.equal(lift.volume_unit, 'lb');
});
