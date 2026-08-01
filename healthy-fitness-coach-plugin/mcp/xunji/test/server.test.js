'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createTrainingService } = require('../src/server.js');

function memoryCache(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { get: (date) => values.get(date) || null, set: (date, value) => values.set(date, value) };
}

test('service merges concurrent same-date misses into one fetch', async () => {
  const calls = [];
  const service = createTrainingService({
    cache: memoryCache(),
    client: { async fetchDay(date) { calls.push(date); return { records: ['id: merge-1 train_time: 2026-08-01 08:00 name: Press'] }; } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL',
    now: () => 1000
  });
  const [first, second] = await Promise.all([
    service.getTrainingDay({ date: '2026-08-01' }),
    service.getTrainingDay({ date: '2026-08-01' })
  ]);
  assert.equal(calls.length, 1);
  assert.equal(first.records[0].id, 'merge-1');
  assert.deepEqual(second.records, first.records);
});

test('service returns stable invalid-date and oversized-range errors', async () => {
  const service = createTrainingService({ cache: memoryCache(), client: {}, credentialProvider: async () => 'FAKE_TEST_CREDENTIAL' });
  assert.equal((await service.getTrainingDay({ date: '2026-02-30' })).error.code, 'invalid_date');
  assert.equal((await service.getTrainingRange({ start_date: '2026-01-01', end_date: '2026-05-01' })).error.code, 'range_too_large');
});

test('failed refresh preserves and returns the existing valid cache entry', async () => {
  const service = createTrainingService({
    cache: memoryCache({ '2026-08-01': { fetched_at: 0, records: [{ id: 'cached-safe' }], warnings: [] } }),
    client: { async fetchDay() { throw Object.assign(new Error('offline'), { code: 'network_error' }); } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL',
    now: () => 100_000
  });
  const result = await service.getTrainingDay({ date: '2026-08-01', refresh: true });
  assert.equal(result.cache_hit, true);
  assert.equal(result.records[0].id, 'cached-safe');
  assert.ok(result.warnings.includes('refresh_failed_using_cache'));
});

test('MCP server registers exactly the two read-only training tools', () => {
  const { createMcpServer } = require('../src/server.js');
  const { server } = createMcpServer({ service: { getTrainingDay: async () => ({}), getTrainingRange: async () => ({}) } });
  assert.deepEqual(Object.keys(server._registeredTools).sort(), ['xunji_get_training_day', 'xunji_get_training_range']);
});

test('service uses a lazily fingerprinted production cache before fetching', async () => {
  const cache = memoryCache({ '2026-08-01': { fetched_at: 1, records: [{ id: 'disk-cache' }], warnings: [] } });
  let fetches = 0;
  const service = createTrainingService({
    cacheFactory: async () => cache,
    client: { async fetchDay() { fetches += 1; return { records: [] }; } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL',
    now: () => 2
  });
  const result = await service.getTrainingDay({ date: '2026-08-01' });
  assert.equal(result.cache_hit, true);
  assert.equal(fetches, 0);
});

test('service re-filters Garmin records from a cache hit before model output', async () => {
  const service = createTrainingService({
    cache: memoryCache({ '2026-08-01': { fetched_at: 1, records: [{ id: 'tampered', data_source: 'GaRmIn' }, { id: 'safe', data_source: 'xunji' }], warnings: [] } }),
    client: { async fetchDay() { throw new Error('should not fetch'); } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL',
    now: () => 2
  });
  const result = await service.getTrainingDay({ date: '2026-08-01' });
  assert.deepEqual(result.records.map((record) => record.id), ['safe']);
});

test('refresh_today does not refresh a historical range end', async () => {
  const calls = [];
  const service = createTrainingService({
    cache: memoryCache({
      '2026-08-01': { fetched_at: 0, records: [], warnings: [] },
      '2026-08-02': { fetched_at: 0, records: [], warnings: [] }
    }),
    client: { async fetchDay(date) { calls.push(date); return { records: [] }; } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL',
    now: () => 100_000,
    today: () => '2026-08-03'
  });
  await service.getTrainingRange({ start_date: '2026-08-01', end_date: '2026-08-02', refresh_today: true });
  assert.deepEqual(calls, []);
});

test('refresh_today refreshes only the injected Asia Shanghai current date', async () => {
  const calls = [];
  const service = createTrainingService({
    cache: memoryCache({
      '2026-08-01': { fetched_at: 0, records: [], warnings: [] },
      '2026-08-02': { fetched_at: 0, records: [], warnings: [] }
    }),
    client: { async fetchDay(date) { calls.push(date); return { records: [] }; } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL',
    now: () => 100_000,
    today: () => '2026-08-02'
  });
  await service.getTrainingRange({ start_date: '2026-08-01', end_date: '2026-08-02', refresh_today: true });
  assert.deepEqual(calls, ['2026-08-02']);
});

test('refresh_today keeps the 90-second limit for the injected current date', async () => {
  let fetches = 0;
  const service = createTrainingService({
    cache: memoryCache({ '2026-08-02': { fetched_at: 99_950, records: [], warnings: [] } }),
    client: { async fetchDay() { fetches += 1; return { records: [] }; } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL',
    now: () => 100_000,
    today: () => '2026-08-02'
  });
  const result = await service.getTrainingRange({ start_date: '2026-08-02', end_date: '2026-08-02', refresh_today: true });
  assert.equal(result.error.code, 'rate_limited');
  assert.equal(fetches, 0);
});

test('missing LocalAppData fails with cache_error instead of creating a relative cache', async () => {
  const service = createTrainingService({
    client: { async fetchDay() { throw new Error('should not fetch'); } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL',
    localAppData: ''
  });
  const result = await service.getTrainingDay({ date: '2026-08-01' });
  assert.equal(result.error.code, 'cache_error');
});

test('cache read errors return cache_error without a network overwrite', async () => {
  let fetches = 0;
  const service = createTrainingService({
    cache: { async get() { throw Object.assign(new Error('corrupt'), { code: 'cache_error' }); }, async set() {} },
    client: { async fetchDay() { fetches += 1; return { records: [] }; } },
    credentialProvider: async () => 'FAKE_TEST_CREDENTIAL'
  });
  const result = await service.getTrainingDay({ date: '2026-08-01' });
  assert.equal(result.error.code, 'cache_error');
  assert.equal(fetches, 0);
});
