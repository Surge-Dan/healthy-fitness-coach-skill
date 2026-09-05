'use strict';

const { join } = require('node:path');
const { z } = require('zod');
const { FileCache, credentialFingerprint } = require('./cache.js');
const { FileDNAStore } = require('./dna-store.js');
const { readWindowsCredential } = require('./credentials.js');
const { connectorError, toPublicError } = require('./errors.js');
const { filterModelFacingRecords, parseTrainingRecords } = require('./parser.js');
const { assertDate } = require('./schemas.js');
const { renderTrainingDashboardHtml } = require('./dashboard.js');
const { buildVisualReportAssets } = require('./visual-report.js');
const { analyzeTrainingRange, buildReviewFirstTrainingDNA } = require('./trends.js');
const { compareTrainingDNA } = require('./training-dna.js');
const { validateUpsertRecords } = require('./upsert.js');
const { decodeXunjiResponse, XunjiClient } = require('./xunji-client.js');

const REFRESH_WINDOW_MS = 90_000;
const MAX_RANGE_DAYS = 90;
const MAX_TOTAL_RANGE_DAYS = 366 * 5;

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

function dateRangeChunks(startDate, endDate) {
  assertDate(startDate); assertDate(endDate);
  if (startDate > endDate) throw Object.assign(new Error('invalid range'), { code: 'invalid_date' });
  const totalDays = Math.floor((new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000) + 1;
  if (totalDays > MAX_TOTAL_RANGE_DAYS) throw Object.assign(new Error('range too large'), { code: 'range_too_large' });
  const chunks = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    const finishDate = new Date(`${cursor}T00:00:00Z`);
    finishDate.setUTCDate(finishDate.getUTCDate() + MAX_RANGE_DAYS - 1);
    const finish = finishDate.toISOString().slice(0, 10) < endDate ? finishDate.toISOString().slice(0, 10) : endDate;
    chunks.push(dateRange(cursor, finish));
    const next = new Date(`${finish}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); cursor = next.toISOString().slice(0, 10);
  }
  return chunks;
}

function createTrainingService({ cache = null, cacheFactory, dnaStore = null, client = new XunjiClient(), credentialProvider = readWindowsCredential, logger = null, now = Date.now, today = null, localAppData = process.env.LOCALAPPDATA } = {}) {
  const pending = new Map();
  const accountCaches = new Map();
  const accountDnaStores = new Map();
  const dnaPending = new Map();
  const getCache = async (credential) => {
    // `cache` is a test-only single-store injection. Production always keys its
    // stores by the one-way credential fingerprint below.
    if (cache) return cache;
    if (!localAppData) throw connectorError('cache_error');
    const fingerprint = credentialFingerprint(credential);
    if (accountCaches.has(fingerprint)) return accountCaches.get(fingerprint);
    const root = join(localAppData, 'HealthyFitnessCoach', 'xunji-cache');
    const storePromise = cacheFactory ? Promise.resolve().then(() => cacheFactory(credential)) : Promise.resolve(new FileCache({ root, fingerprint }));
    accountCaches.set(fingerprint, storePromise);
    try {
      return await storePromise;
    } catch (error) {
      if (accountCaches.get(fingerprint) === storePromise) accountCaches.delete(fingerprint);
      throw error;
    }
  };

  const getDNAStore = async (credential) => {
    if (dnaStore) return dnaStore;
    if (!localAppData) return null;
    const fingerprint = credentialFingerprint(credential);
    if (accountDnaStores.has(fingerprint)) return accountDnaStores.get(fingerprint);
    const store = new FileDNAStore({ root: join(localAppData, 'HealthyFitnessCoach', 'training-dna'), fingerprint });
    accountDnaStores.set(fingerprint, store);
    return store;
  };

  const resultFromEntry = (date, entry, cacheHit, networkFetches) => {
    const filtered = filterModelFacingRecords(entry.records || []);
    const records = filtered.filter((record) => !record.warnings?.includes('invalid_date') && record.record_date === date);
    const crossDate = filtered.length - records.length;
    return {
      date,
      fetched_at: entry.fetched_at,
      cache_hit: cacheHit,
      cache_hits: cacheHit ? 1 : 0,
      network_fetches: networkFetches,
      dates: [date],
      records,
      warnings: [...(entry.warnings || []), ...filtered.warnings, ...(crossDate ? [`cross_date_records_dropped:${crossDate}`] : [])],
      data_freshness: cacheHit ? 'cached' : 'network'
    };
  };

  async function fetchMissing(date, credential, store) {
    const pendingKey = `${credentialFingerprint(credential)}:${date}`;
    if (pending.has(pendingKey)) return pending.get(pendingKey);
    const operation = (async () => {
      try {
        const response = await client.fetchDay(date, credential);
        const decoded = response && Array.isArray(response.records) ? response : decodeXunjiResponse(response);
        const parsed = parseTrainingRecords(decoded.records);
        const filtered = filterModelFacingRecords(parsed);
        const safeRecords = filtered.filter((record) => !record.warnings?.includes('invalid_date') && record.record_date === date);
        const warnings = [...filtered.warnings, ...parsed.flatMap((record) => record.warnings || []), ...(safeRecords.length !== filtered.length ? [`cross_date_records_dropped:${filtered.length - safeRecords.length}`] : [])];
        const entry = { fetched_at: now(), records: safeRecords, warnings };
        await store.set(date, entry);
        if (logger && typeof logger.info === 'function') logger.info('xunji_training_day_fetched', { date });
        return resultFromEntry(date, entry, false, 1);
      } catch (error) {
        return { error: toPublicError(error) };
      }
    })();
    pending.set(pendingKey, operation);
    try { return await operation; } finally { pending.delete(pendingKey); }
  }

  async function getTrainingDay({ date, refresh = false, credentialOverride = null } = {}) {
    try {
      assertDate(date);
      const credential = credentialOverride || await credentialProvider();
      const store = await getCache(credential);
      const entry = await store.get(date);
      if (entry) {
        const elapsed = now() - entry.fetched_at;
        if (refresh && elapsed >= 0 && elapsed < REFRESH_WINDOW_MS) {
          return { error: toPublicError(Object.assign(new Error('rate limited'), { code: 'rate_limited', retry_after_seconds: (REFRESH_WINDOW_MS - elapsed) / 1000 })) };
        }
        if (!refresh) return resultFromEntry(date, entry, true, 0);
        const refreshed = await fetchMissing(date, credential, store);
        if (refreshed.error) {
          if (['missing_credentials', 'invalid_credentials', 'membership_required'].includes(refreshed.error.code)) return refreshed;
          const fallback = resultFromEntry(date, entry, true, 0);
          fallback.warnings = [...fallback.warnings, 'refresh_failed_using_cache'];
          return fallback;
        }
        return refreshed;
      }
      return await fetchMissing(date, credential, store);
    } catch (error) {
      return { error: toPublicError(error) };
    }
  }

  async function getTrainingRange({ start_date, end_date, refresh_today = false, credentialOverride = null } = {}) {
    let dates;
    try { dates = dateRangeChunks(start_date, end_date).flat(); } catch (error) { return { error: toPublicError(error) }; }
    let credential;
    try { credential = credentialOverride || await credentialProvider(); } catch (error) { return { error: toPublicError(error) }; }
    const aggregate = { cache_hits: 0, network_fetches: 0, dates, days: [], records: [], missing_dates: [], warnings: [], data_freshness: 'mixed', partial: false };
    let firstError = null;
    const todayDate = today ? today() : currentShanghaiDate(now());
    for (const date of dates) {
      const day = await getTrainingDay({ date, refresh: refresh_today && date === todayDate, credentialOverride: credential });
      if (day.error) {
        if (!firstError) firstError = day.error;
        aggregate.missing_dates.push(date);
        aggregate.warnings.push(`missing_date:${date}:${day.error.code}`);
        continue;
      }
      aggregate.cache_hits += day.cache_hits;
      aggregate.network_fetches += day.network_fetches;
      aggregate.days.push(day);
      aggregate.records.push(...day.records);
      aggregate.warnings.push(...day.warnings);
    }
    if (aggregate.days.length === 0) return { error: firstError };
    aggregate.partial = aggregate.missing_dates.length > 0;
    if (aggregate.network_fetches === 0) aggregate.data_freshness = 'cached';
    if (aggregate.cache_hits === 0) aggregate.data_freshness = 'network';
    return aggregate;
  }

  async function previewTrainingUpsert({ records } = {}) {
    try {
      const validated = validateUpsertRecords(records);
      return {
        date: validated.date,
        record_count: validated.records.length,
        existing_ids: validated.existing_ids,
        new_records: validated.new_records,
        records: validated.records,
        parsed: validated.parsed,
        requires_confirmation: true
      };
    } catch (error) {
      return { error: toPublicError(error) };
    }
  }

  async function upsertTrainingRecords({ records, confirm = false } = {}) {
    if (confirm !== true) return { error: toPublicError(connectorError('writeback_not_confirmed')) };
    let validated;
    try {
      validated = validateUpsertRecords(records);
      const credential = await credentialProvider();
      const store = await getCache(credential);
      const response = await client.upsertRecords(validated.records, credential);
      const decoded = response && Array.isArray(response.records) ? response : decodeXunjiResponse(response);
      const parsed = parseTrainingRecords(decoded.records);
      const filtered = filterModelFacingRecords(parsed);
      if (!parsed.length || parsed.some((record) => !record.record_date || record.record_date !== validated.date || record.warnings?.includes('invalid_date'))) throw Object.assign(new Error('invalid same-day server result'), { code: 'invalid_upsert' });
      const safeRecords = filtered;
      const warnings = [...filtered.warnings, ...parsed.flatMap((record) => record.warnings || [])];
      const entry = { fetched_at: now(), records: safeRecords, warnings, last_operation: 'upsert' };
      await store.set(validated.date, entry);
      return {
        ...resultFromEntry(validated.date, entry, false, 1),
        writeback: true,
        upserted_records: validated.records.length,
         server_records: safeRecords
      };
    } catch (error) {
      return { error: toPublicError(error) };
    }
  }

  async function getTrainingTrends({ start_date, end_date, refresh_today = false, planned_sessions_per_week, profile } = {}) {
    const range = await getTrainingRange({ start_date, end_date, refresh_today });
    if (range.error) return range;
    const trends = analyzeTrainingRange({ ...range, planned_sessions_per_week, profile });
    return { range, trends, dashboard_html: renderTrainingDashboardHtml({ range, trends }), visual_assets: buildVisualReportAssets({ trends }) };
  }

  async function getTrainingDNAUnlocked({ start_date, end_date, refresh_today = false, planned_sessions_per_week, profile } = {}, credentialOverride = null) {
    let credential;
    try { credential = credentialOverride || await credentialProvider(); } catch (error) { return { error: toPublicError(error) }; }
    const range = await getTrainingRange({ start_date, end_date, refresh_today, credentialOverride: credential });
    if (range.error) return range;
    const trends = analyzeTrainingRange({ ...range, planned_sessions_per_week, profile });
    const current = buildReviewFirstTrainingDNA({ range, planned_sessions_per_week, profile, previous_dna: null });
    let persisted = false;
    let version = 1;
    let previousVersion;
    let changes = { changed_dimensions: [], changes: [] };
    try {
      const store = await getDNAStore(credential);
      const previous = store ? await store.get() : null;
      const comparable = (value) => JSON.stringify({ data_range: value?.data_range, data_quality: value?.data_quality, metrics: value?.metrics, dimensions: value?.dimensions, unknowns: value?.unknowns, warnings: value?.warnings });
      const unchanged = Boolean(previous && comparable(previous.training_dna) === comparable(current));
      if (previous && !unchanged) {
        version = Number(previous.version || 0) + 1;
        previousVersion = previous.version;
        changes = compareTrainingDNA(previous.training_dna, current);
      }
      if (store) {
        const history = Array.isArray(previous?.history) ? previous.history.slice(-11) : [];
        if (!unchanged) {
          await store.set({ version, updated_at: now(), training_dna: current, changes, history: [...history, { version, updated_at: now(), data_range: current.data_range, changes }] });
        }
        persisted = true;
      }
    } catch (error) {
      current.warnings = [...(current.warnings || []), 'training_dna_persistence_failed'];
    }
    return { range, training_dna: { ...current, version, ...(previousVersion ? { previous_version: previousVersion } : {}), changes, persisted } };
  }

  async function getTrainingDNA(args = {}) {
    let credential = null;
    try { credential = await credentialProvider(); } catch (_) { /* getTrainingDNAUnlocked will return the public error */ }
    const lockKey = credential ? `account:${credentialFingerprint(credential)}` : 'account:unknown';
    const previous = dnaPending.get(lockKey) || Promise.resolve();
    const operation = previous.catch(() => {}).then(() => getTrainingDNAUnlocked(args, credential));
    dnaPending.set(lockKey, operation);
    try { return await operation; } finally { if (dnaPending.get(lockKey) === operation) dnaPending.delete(lockKey); }
  }

  return { getTrainingDay, getTrainingRange, getTrainingTrends, getTrainingDNA, previewTrainingUpsert, upsertTrainingRecords };
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
  server.registerTool('xunji_preview_training_upsert', {
    description: 'Validate and preview same-day Xunji training updates without writing.',
    inputSchema: { records: z.array(z.string()) },
    annotations: { readOnlyHint: true }
  }, ({ records }) => result(service.previewTrainingUpsert({ records })));
  server.registerTool('xunji_upsert_training_records', {
    description: 'Write confirmed same-day Xunji training records by ID and cache the server result.',
    inputSchema: { records: z.array(z.string()), confirm: z.boolean() },
    annotations: { readOnlyHint: false }
  }, ({ records, confirm }) => result(service.upsertTrainingRecords({ records, confirm })));
  server.registerTool('xunji_get_training_trends', {
    description: 'Analyze cached Xunji training range trends.',
    inputSchema: { start_date: z.string(), end_date: z.string(), refresh_today: z.boolean().optional(), planned_sessions_per_week: z.number().finite().nonnegative().max(14).optional(), profile: z.record(z.string(), z.unknown()).optional() },
    annotations: { readOnlyHint: true }
  }, ({ start_date, end_date, refresh_today, planned_sessions_per_week, profile }) => result(service.getTrainingTrends({ start_date, end_date, refresh_today, planned_sessions_per_week, profile })));
  server.registerTool('xunji_extract_training_dna', {
    description: 'Extract an evidence-bounded training DNA from cached Xunji records without writing or changing training data.',
    inputSchema: { start_date: z.string(), end_date: z.string(), refresh_today: z.boolean().optional(), planned_sessions_per_week: z.number().finite().nonnegative().max(14).optional(), profile: z.record(z.string(), z.unknown()).optional() },
    annotations: { readOnlyHint: true }
  }, ({ start_date, end_date, refresh_today, planned_sessions_per_week, profile }) => result(service.getTrainingDNA({ start_date, end_date, refresh_today, planned_sessions_per_week, profile })));
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

module.exports = { createMcpServer, createTrainingService, currentShanghaiDate, dateRange, dateRangeChunks, startStdioServer };
