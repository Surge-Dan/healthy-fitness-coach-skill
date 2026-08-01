'use strict';

const { join } = require('node:path');
const { z } = require('zod');
const { FileCache, credentialFingerprint } = require('./cache.js');
const { readWindowsCredential } = require('./credentials.js');
const { connectorError, toPublicError } = require('./errors.js');
const { filterModelFacingRecords, parseTrainingRecords } = require('./parser.js');
const { assertDate } = require('./schemas.js');
const { decodeXunjiResponse, XunjiClient } = require('./xunji-client.js');

const REFRESH_WINDOW_MS = 90_000;
const MAX_RANGE_DAYS = 90;

function currentShanghaiDate(time = Date.now()) {
  const values = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(time)).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${values.year}-${values.month}-${values.day}`;
}

function dateRange(startDate, endDate) {
  assertDate(startDate);
  assertDate(endDate);
  if (startDate > endDate) throw Object.assign(new Error('invalid range'), { code: 'invalid_date' });
  const dates = [];
  for (let value = new Date(`${startDate}T00:00:00Z`), end = new Date(`${endDate}T00:00:00Z`); value <= end; value.setUTCDate(value.getUTCDate() + 1)) {
    dates.push(value.toISOString().slice(0, 10));
    if (dates.length > MAX_RANGE_DAYS) throw Object.assign(new Error('range too large'), { code: 'range_too_large' });
  }
  return dates;
}

function createTrainingService({ cache = null, cacheFactory, client = new XunjiClient(), credentialProvider = readWindowsCredential, logger = null, now = Date.now, today = null, localAppData = process.env.LOCALAPPDATA } = {}) {
  const pending = new Map();
  let activeCache = cache;
  const getCache = async (credential) => {
    if (activeCache) return activeCache;
    if (!localAppData) throw connectorError('cache_error');
    const root = join(localAppData, 'HealthyFitnessCoach', 'xunji-cache');
    activeCache = cacheFactory ? await cacheFactory(credential) : new FileCache({ root, fingerprint: credentialFingerprint(credential) });
    return activeCache;
  };

  const resultFromEntry = (date, entry, cacheHit, networkFetches) => {
    const filtered = filterModelFacingRecords(entry.records || []);
    return {
      cache_hit: cacheHit,
      cache_hits: cacheHit ? 1 : 0,
      network_fetches: networkFetches,
      dates: [date],
      records: filtered,
      warnings: [...(entry.warnings || []), ...filtered.warnings],
      data_freshness: cacheHit ? 'cached' : 'network'
    };
  };

  async function fetchMissing(date) {
    if (pending.has(date)) return pending.get(date);
    const operation = (async () => {
      let credential;
      try {
        credential = await credentialProvider();
        const store = await getCache(credential);
        const response = await client.fetchDay(date, credential);
        const decoded = response && Array.isArray(response.records) ? response : decodeXunjiResponse(response);
        const parsed = parseTrainingRecords(decoded.records);
        const filtered = filterModelFacingRecords(parsed);
        const warnings = [...filtered.warnings, ...parsed.flatMap((record) => record.warnings || [])];
        const entry = { fetched_at: now(), records: filtered, warnings };
        await store.set(date, entry);
        if (logger && typeof logger.info === 'function') logger.info('xunji_training_day_fetched', { date });
        return resultFromEntry(date, entry, false, 1);
      } catch (error) {
        return { error: toPublicError(error) };
      }
    })();
    pending.set(date, operation);
    try { return await operation; } finally { pending.delete(date); }
  }

  async function getTrainingDay({ date, refresh = false } = {}) {
    try {
      assertDate(date);
      if (!activeCache) {
        const credential = await credentialProvider();
        await getCache(credential);
      }
      if (activeCache) {
        const entry = await activeCache.get(date);
        if (entry) {
          const elapsed = now() - entry.fetched_at;
          if (refresh && elapsed >= 0 && elapsed < REFRESH_WINDOW_MS) {
            return { error: toPublicError(Object.assign(new Error('rate limited'), { code: 'rate_limited', retry_after_seconds: (REFRESH_WINDOW_MS - elapsed) / 1000 })) };
          }
          if (!refresh) return resultFromEntry(date, entry, true, 0);
          const refreshed = await fetchMissing(date);
          if (refreshed.error) {
            const fallback = resultFromEntry(date, entry, true, 0);
            fallback.warnings = [...fallback.warnings, 'refresh_failed_using_cache'];
            return fallback;
          }
          return refreshed;
        }
      }
      return await fetchMissing(date);
    } catch (error) {
      return { error: toPublicError(error) };
    }
  }

  async function getTrainingRange({ start_date, end_date, refresh_today = false } = {}) {
    let dates;
    try { dates = dateRange(start_date, end_date); } catch (error) { return { error: toPublicError(error) }; }
    const aggregate = { cache_hits: 0, network_fetches: 0, dates, records: [], warnings: [], data_freshness: 'mixed' };
    const todayDate = today ? today() : currentShanghaiDate(now());
    for (const date of dates) {
      const day = await getTrainingDay({ date, refresh: refresh_today && date === todayDate });
      if (day.error) return { error: day.error };
      aggregate.cache_hits += day.cache_hits;
      aggregate.network_fetches += day.network_fetches;
      aggregate.records.push(...day.records);
      aggregate.warnings.push(...day.warnings);
    }
    if (aggregate.network_fetches === 0) aggregate.data_freshness = 'cached';
    if (aggregate.cache_hits === 0) aggregate.data_freshness = 'network';
    return aggregate;
  }

  return { getTrainingDay, getTrainingRange };
}

function createMcpServer(options = {}) {
  const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
  const service = options.service || createTrainingService(options);
  const server = new McpServer({ name: 'healthy-fitness-xunji', version: '1.0.0' });
  const result = async (promise) => {
    const value = await promise;
    return value.error
      ? { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: value.error }) }] }
      : { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  };
  server.registerTool('xunji_get_training_day', {
    description: 'Read one day of local Xunji training data.',
    inputSchema: { date: z.string(), refresh: z.boolean().optional() },
    annotations: { readOnlyHint: true }
  }, ({ date, refresh }) => result(service.getTrainingDay({ date, refresh })));
  server.registerTool('xunji_get_training_range', {
    description: 'Read a local-date range of Xunji training data.',
    inputSchema: { start_date: z.string(), end_date: z.string(), refresh_today: z.boolean().optional() },
    annotations: { readOnlyHint: true }
  }, ({ start_date, end_date, refresh_today }) => result(service.getTrainingRange({ start_date, end_date, refresh_today })));
  return { server, service };
}

async function startStdioServer() {
  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
  const { server } = createMcpServer();
  await server.connect(new StdioServerTransport());
}

if (require.main === module) {
  startStdioServer().catch(() => { process.exitCode = 1; });
}

module.exports = { createMcpServer, createTrainingService, currentShanghaiDate, dateRange, startStdioServer };
