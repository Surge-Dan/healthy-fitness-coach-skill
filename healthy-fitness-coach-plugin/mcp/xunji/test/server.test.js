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

test('service scopes cache entries to the credential active for each request', async () => {
  const factories = [];
  const stores = new Map();
  const credentials = ['SYNTHETIC_ACCOUNT_A', 'SYNTHETIC_ACCOUNT_B'];
  const service = createTrainingService({
    cacheFactory: async (credential) => {
      factories.push(credential);
      if (!stores.has(credential)) stores.set(credential, memoryCache());
      return stores.get(credential);
    },
    credentialProvider: async () => credentials.shift(),
    client: { async fetchDay(date, credential) { return { records: [`id: ${credential === 'SYNTHETIC_ACCOUNT_A' ? 'account-a' : 'account-b'} train_time: ${date} 08:00 name: Press`] }; } },
    now: () => 1000
  });

  const first = await service.getTrainingDay({ date: '2026-08-01' });
  const second = await service.getTrainingDay({ date: '2026-08-01' });

  assert.equal(first.records[0].id, 'account-a');
  assert.equal(second.records[0].id, 'account-b');
  assert.deepEqual(factories, ['SYNTHETIC_ACCOUNT_A', 'SYNTHETIC_ACCOUNT_B']);
});

test('service does not merge concurrent same-date misses from distinct accounts', async () => {
  const credentials = ['SYNTHETIC_ACCOUNT_A', 'SYNTHETIC_ACCOUNT_B'];
  const calls = [];
  const service = createTrainingService({
    cacheFactory: async () => memoryCache(),
    credentialProvider: async () => credentials.shift(),
    client: { async fetchDay(date, credential) { calls.push(`${credential}:${date}`); return { records: [] }; } },
    now: () => 1000
  });

  await Promise.all([
    service.getTrainingDay({ date: '2026-08-01' }),
    service.getTrainingDay({ date: '2026-08-01' })
  ]);

  assert.deepEqual(calls.sort(), ['SYNTHETIC_ACCOUNT_A:2026-08-01', 'SYNTHETIC_ACCOUNT_B:2026-08-01']);
});

test('service creates one cache for concurrent requests from the same account', async () => {
  let factoryCalls = 0;
  let releaseFactory;
  const factoryWait = new Promise((resolve) => { releaseFactory = resolve; });
  const service = createTrainingService({
    cacheFactory: async () => { factoryCalls += 1; await factoryWait; return memoryCache(); },
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: { async fetchDay() { return { records: [] }; } },
    now: () => 1000
  });
  const first = service.getTrainingDay({ date: '2026-08-01' });
  const second = service.getTrainingDay({ date: '2026-08-01' });
  await new Promise((resolve) => setImmediate(resolve));
  releaseFactory();
  await Promise.all([first, second]);
  assert.equal(factoryCalls, 1);
});

test('day results expose fetched time and requested-date provenance on records', async () => {
  const service = createTrainingService({
    cache: memoryCache(),
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: { async fetchDay() { return { records: ['id: trace-1 train_time: 2026-08-01 08:00 name: Press'] }; } },
    now: () => 123456
  });

  const result = await service.getTrainingDay({ date: '2026-08-01' });

  assert.equal(result.date, '2026-08-01');
  assert.equal(result.fetched_at, 123456);
  assert.equal(result.records[0].record_date, '2026-08-01');
  assert.equal(result.records[0].parse_status, 'complete');
  assert.match(result.records[0].raw_text, /^id: trace-1/);
});

test('range results keep successful days grouped and return a partial result after one failure', async () => {
  const service = createTrainingService({
    cache: memoryCache(),
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: {
      async fetchDay(date) {
        if (date === '2026-08-02') throw Object.assign(new Error('offline'), { code: 'network_error' });
        return { records: [`id: range-${date} train_time: ${date} 08:00 name: Press`] };
      }
    },
    now: () => 123456
  });

  const result = await service.getTrainingRange({ start_date: '2026-08-01', end_date: '2026-08-02' });

  assert.deepEqual(result.dates, ['2026-08-01', '2026-08-02']);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].date, '2026-08-01');
  assert.equal(result.days[0].fetched_at, 123456);
  assert.deepEqual(result.missing_dates, ['2026-08-02']);
  assert.equal(result.partial, true);
  assert.equal(result.records[0].record_date, '2026-08-01');
  assert.ok(result.warnings.some((warning) => warning.includes('2026-08-02')));
});

test('service rejects invalid dates and chunks annual ranges into safe requests', async () => {
  let calls = 0;
  const service = createTrainingService({ cache: memoryCache(), client: { async fetchDay() { calls += 1; return { records: [] }; } }, credentialProvider: async () => 'FAKE_TEST_CREDENTIAL' });
  assert.equal((await service.getTrainingDay({ date: '2026-02-30' })).error.code, 'invalid_date');
  const result = await service.getTrainingRange({ start_date: '2026-01-01', end_date: '2026-05-01' });
  assert.equal(result.error, undefined);
  assert.equal(result.dates.length, 121);
  assert.equal(calls, 121);
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

test('MCP server registers read, preview, write, trend, and training DNA tools', () => {
  const { createMcpServer } = require('../src/server.js');
  const { server } = createMcpServer({ service: {
    getTrainingDay: async () => ({}),
    getTrainingRange: async () => ({}),
    getTrainingTrends: async () => ({}),
    getTrainingDNA: async () => ({}),
    previewTrainingUpsert: async () => ({}),
    upsertTrainingRecords: async () => ({})
  } });
  assert.deepEqual(Object.keys(server._registeredTools).sort(), [
    'xunji_extract_training_dna', 'xunji_get_training_day', 'xunji_get_training_range', 'xunji_get_training_trends',
    'xunji_preview_training_upsert', 'xunji_upsert_training_records'
  ]);
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

test('service previews a same-day upsert without contacting the network', async () => {
  let calls = 0;
  const service = createTrainingService({
    cache: memoryCache(),
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: { async upsertRecords() { calls += 1; return { records: [] }; } }
  });
  const result = await service.previewTrainingUpsert({ records: ['2026-08-01,id:1,胸部训练'] });
  assert.equal(result.date, '2026-08-01');
  assert.equal(result.existing_ids, 1);
  assert.equal(calls, 0);
});

test('service refuses an unconfirmed write-back', async () => {
  let calls = 0;
  const service = createTrainingService({
    cache: memoryCache(),
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: { async upsertRecords() { calls += 1; return { records: [] }; } }
  });
  const result = await service.upsertTrainingRecords({ records: ['2026-08-01,胸部训练'], confirm: false });
  assert.equal(result.error.code, 'writeback_not_confirmed');
  assert.equal(calls, 0);
});

test('service caches the server-normalized upsert response as the final result', async () => {
  let cached;
  const service = createTrainingService({
    cache: {
      async get() { return null; },
      async set(date, entry) { cached = { date, entry }; }
    },
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: { async upsertRecords(records) {
      assert.deepEqual(records, ['2026-08-01,id:1,胸部训练']);
      return { records: ['2026-08-01,id:1,胸部训练,标准化'] };
    } },
    now: () => 456789
  });
  const result = await service.upsertTrainingRecords({ records: ['2026-08-01,id:1,胸部训练'], confirm: true });
  assert.equal(result.date, '2026-08-01');
  assert.equal(result.records[0].raw_text, '2026-08-01,id:1,胸部训练,标准化');
  assert.equal(cached.date, '2026-08-01');
  assert.equal(cached.entry.fetched_at, 456789);
  assert.equal(cached.entry.records[0].raw_text, '2026-08-01,id:1,胸部训练,标准化');
});

test('service rejects a cross-date write-back response before caching it', async () => {
  let writes = 0;
  const service = createTrainingService({
    cache: { async get() { return null; }, async set() { writes += 1; } },
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: { async upsertRecords() { return { records: ['2026-08-02,id:wrong,title'] }; } }
  });
  const result = await service.upsertTrainingRecords({ records: ['2026-08-01,id:1,title'], confirm: true });
  assert.equal(result.error.code, 'invalid_upsert');
  assert.equal(writes, 0);
});

test('service returns trend metrics alongside the cached training range', async () => {
  const service = createTrainingService({
    cache: memoryCache(),
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: { async fetchDay(date) { return { records: [`${date},id:1,胸部训练,1组,60kg,10次`] }; } },
    now: () => 123456
  });
  const result = await service.getTrainingTrends({ start_date: '2026-08-01', end_date: '2026-08-02' });
  assert.equal(result.trends.training_days, 2);
  assert.equal(result.trends.record_count, 2);
  assert.equal(result.range.records[0].title, '胸部训练');
  assert.match(result.dashboard_html, /<!doctype html>/i);
  assert.ok(Array.isArray(result.visual_assets));
  assert.ok(result.visual_assets.some((asset) => asset.name === 'training-heatmap.svg'));
});

test('service persists versioned training DNA and returns an auditable diff', async () => {
  let artifact = null;
  const service = createTrainingService({
    cache: memoryCache(),
    dnaStore: { async get() { return artifact; }, async set(value) { artifact = value; } },
    credentialProvider: async () => 'SYNTHETIC_ACCOUNT_A',
    client: { async fetchDay(date) { return { records: [`${date},id:${date},卧推,1组,60kg,8次`] }; } },
    now: () => 123456
  });
  const first = await service.getTrainingDNA({ start_date: '2026-08-01', end_date: '2026-08-02' });
  assert.equal(first.training_dna.version, 1);
  assert.equal(first.training_dna.persisted, true);
  assert.equal(artifact.version, 1);
  const second = await service.getTrainingDNA({ start_date: '2026-08-01', end_date: '2026-08-02' });
  assert.equal(second.training_dna.version, 1);
  assert.equal(second.training_dna.previous_version, undefined);
  assert.deepEqual(second.training_dna.changes.changed_dimensions, []);
  assert.ok(Array.isArray(second.training_dna.changes.changed_dimensions));
});
