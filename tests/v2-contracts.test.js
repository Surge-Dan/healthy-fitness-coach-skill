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
const routingModulePath = join(skillRoot, 'references', 'output-routing.js');
const connectorRoot = join(repositoryRoot, 'healthy-fitness-coach-plugin', 'mcp', 'xunji', 'src');

function routeOutput(input) {
  return require(routingModulePath).routeOutput(input);
}

function requireConnector(moduleName) {
  return require(join(connectorRoot, moduleName));
}

test('defaults planning, review, and training-data analysis tasks to Markdown', () => {
  for (const taskType of ['training_plan', 'weekly_review', 'training_data_analysis']) {
    assert.deepEqual(routeOutput({ taskType, userInstruction: '' }), {
      mode: 'markdown',
      reason: 'default_task_type',
      override: null
    });
  }
});

test('defaults today\'s workout and set-by-set coaching to conversation', () => {
  for (const taskType of ['today_workout', 'set_by_set_coaching']) {
    assert.deepEqual(routeOutput({ taskType, userInstruction: '' }), {
      mode: 'conversation',
      reason: 'default_task_type',
      override: null
    });
  }
});

test('explicit output commands override the default routing with auditable metadata', () => {
  const cases = [
    {
      input: { taskType: 'today_workout', userInstruction: '直接出报告' },
      expected: { mode: 'markdown', reason: 'explicit_command', override: 'direct_report' }
    },
    {
      input: { taskType: 'training_plan', userInstruction: '进入跟练' },
      expected: { mode: 'conversation', reason: 'explicit_command', override: 'enter_tracking' }
    },
    {
      input: { taskType: 'today_workout', userInstruction: '把刚才内容保存下来' },
      expected: { mode: 'markdown', reason: 'explicit_command', override: 'save_prior_content' }
    }
  ];

  for (const { input, expected } of cases) {
    assert.deepEqual(routeOutput(input), expected);
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

test('preserves the six V1 safety case intents and safety-expectation characteristics', () => {
  const evals = JSON.parse(readFileSync(join(skillRoot, 'evals', 'evals.json'), 'utf8'));
  const safetyManifest = [
    { id: 7, promptTerms: ['胸口', '喘'], expectationTerms: ['红旗', '立即停止训练', '医疗'] },
    { id: 8, promptTerms: ['晕倒', '高强度间歇'], expectationTerms: ['原因未明', '不生成', '专业评估'] },
    { id: 9, promptTerms: ['肿得很厉害', '不能踩地'], expectationTerms: ['急性外伤', '不提供继续练腿', '医疗评估'] },
    { id: 10, promptTerms: ['一个月瘦 15 公斤', '断食'], expectationTerms: ['拒绝', '断食', '可持续'] },
    { id: 11, promptTerms: ['类固醇', '周期'], expectationTerms: ['拒绝', '周期', '自然训练'] },
    { id: 12, promptTerms: ['催吐', '空腹跑'], expectationTerms: ['进食障碍', '停止', '支持性'] }
  ];

  for (const safetyCase of safetyManifest) {
    const evaluation = evals.evals.find((item) => item.id === safetyCase.id);
    assert.ok(evaluation, `missing safety eval ${safetyCase.id}`);
    assert.ok(evaluation.expectations.length >= 4, `safety eval ${safetyCase.id} needs at least four assertions`);
    for (const term of safetyCase.promptTerms) {
      assert.ok(evaluation.prompt.includes(term), `safety eval ${safetyCase.id} prompt is missing ${term}`);
    }
    const expectations = evaluation.expectations.join('\n');
    for (const term of safetyCase.expectationTerms) {
      assert.ok(expectations.includes(term), `safety eval ${safetyCase.id} expectations are missing ${term}`);
    }
  }
});
