'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const {
  assertNoFixtureCredential,
  createFixtureClient,
  createMemoryCache,
  createMemoryLogger,
  fixtureCredential,
  readFixture
} = require('./v2-contract-support');

const repositoryRoot = join(__dirname, '..');
const skillRoot = join(repositoryRoot, 'healthy-fitness-coach');
const connectorRoot = join(repositoryRoot, 'healthy-fitness-coach-plugin', 'mcp', 'xunji', 'src');

function readOutputRouting() {
  return readFileSync(join(skillRoot, 'references', 'output-routing.md'), 'utf8');
}

function requireConnector(moduleName) {
  return require(join(connectorRoot, moduleName));
}

test('routes planning and review tasks to Markdown deliverables', () => {
  const routing = readOutputRouting();
  assert.match(routing, /(?:4～8 周计划|周期复盘|训记周报|月报|趋势分析).*Markdown/s);
});

test('defaults today\'s workout and set-by-set coaching to conversation', () => {
  const routing = readOutputRouting();
  assert.match(routing, /(?:今日训练|逐组调整|动作反馈).*对话/s);
});

test('honors explicit output commands over automatic routing defaults', () => {
  const routing = readOutputRouting();
  for (const command of ['直接出报告', '进入跟练', '把刚才内容保存下来']) {
    assert.match(routing, new RegExp(command));
  }
});

test('uses a cache hit without fetching the network', async () => {
  const { createTrainingService } = requireConnector('server.js');
  const cache = createMemoryCache({
    '2026-07-26': { fetched_at: 1000, records: [{ id: 'cached-001' }] }
  });
  const client = createFixtureClient(readFixture('gzip-success-response.json.gz'));
  const service = createTrainingService({ cache, client, credentialProvider: () => fixtureCredential, now: () => 2000 });

  const result = await service.getTrainingDay({ date: '2026-07-26' });

  assert.equal(result.cache_hit, true);
  assert.deepEqual(client.calls, []);
});

test('blocks a refresh for the same date locally within 90 seconds', async () => {
  const { createTrainingService } = requireConnector('server.js');
  const cache = createMemoryCache({
    '2026-07-27': { fetched_at: 119_950, records: [{ id: 'recent-001' }] }
  });
  const client = createFixtureClient(readFixture('gzip-success-response.json.gz'));
  const service = createTrainingService({ cache, client, credentialProvider: () => fixtureCredential, now: () => 120_000 });

  const result = await service.getTrainingDay({ date: '2026-07-27', refresh: true });

  assert.equal(result.error.code, 'rate_limited');
  assert.ok(result.error.retry_after_seconds > 0);
  assert.deepEqual(client.calls, []);
});

test('fetches only missing dates for a range read', async () => {
  const { createTrainingService } = requireConnector('server.js');
  const cache = createMemoryCache({
    '2026-07-25': { fetched_at: 1000, records: [{ id: 'cached-002' }] }
  });
  const client = createFixtureClient(readFixture('gzip-success-response.json.gz'));
  const service = createTrainingService({ cache, client, credentialProvider: () => fixtureCredential, now: () => 200_000 });

  const result = await service.getTrainingRange({ start_date: '2026-07-25', end_date: '2026-07-27' });

  assert.deepEqual(client.calls, ['2026-07-26', '2026-07-27']);
  assert.equal(result.cache_hits, 1);
  assert.equal(result.network_fetches, 2);
});

test('reads records from the res array of a gzip response', () => {
  const { decodeXunjiResponse } = requireConnector('xunji-client.js');
  const result = decodeXunjiResponse(readFixture('gzip-success-response.json.gz'));

  assert.equal(result.records.length, 2);
  assert.match(result.records[0], /^id: session-001/);
});

test('preserves id and train_time tokens verbatim during parsing', () => {
  const { parseTrainingRecords } = requireConnector('parser.js');
  const fixture = JSON.parse(readFixture('parser-records.json').toString('utf8'));
  const [record] = parseTrainingRecords([fixture.valid]);

  assert.equal(record.id, 'alpha-001');
  assert.equal(record.train_time, '2026-07-27 18:30');
  assert.match(record.raw_text, /id: alpha-001 train_time: 2026-07-27 18:30/);
});

test('degrades malformed records to raw_only without discarding the source text', () => {
  const { parseTrainingRecords } = requireConnector('parser.js');
  const fixture = JSON.parse(readFixture('parser-records.json').toString('utf8'));
  const [record] = parseTrainingRecords([fixture.malformed]);

  assert.equal(record.parse_status, 'raw_only');
  assert.equal(record.raw_text, fixture.malformed);
});

test('does not leak the fixture credential through results, logs, or cache', async () => {
  const { createTrainingService } = requireConnector('server.js');
  const cache = createMemoryCache();
  const logger = createMemoryLogger();
  const client = createFixtureClient(readFixture('gzip-success-response.json.gz'));
  const service = createTrainingService({ cache, client, logger, credentialProvider: () => fixtureCredential, now: () => 200_000 });

  const result = await service.getTrainingDay({ date: '2026-07-27' });

  assertNoFixtureCredential(assert, { result, logs: logger.entries, cache: cache.values() });
});

test('filters Garmin-source records before model-facing output', () => {
  const { filterModelFacingRecords } = requireConnector('parser.js');
  const fixture = JSON.parse(readFixture('parser-records.json').toString('utf8'));
  const result = filterModelFacingRecords([
    { id: 'xunji-004', data_source: 'xunji_user' },
    fixture.garmin
  ]);

  assert.deepEqual(result.map((record) => record.id), ['xunji-004']);
});

test('keeps all six V1 safety cases represented in the current evaluation set', () => {
  const evals = JSON.parse(readFileSync(join(skillRoot, 'evals', 'evals.json'), 'utf8'));
  const expectedSafetyIds = [7, 8, 9, 10, 11, 12];
  assert.deepEqual(evals.evals.filter((item) => expectedSafetyIds.includes(item.id)).map((item) => item.id), expectedSafetyIds);
});
