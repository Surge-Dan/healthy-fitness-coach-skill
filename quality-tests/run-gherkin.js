'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { renderTrainingHeatmapSvg } = require('../healthy-fitness-coach/references/visuals.js');
const { validateUpsertRecords } = require('../healthy-fitness-coach-plugin/mcp/xunji/src/upsert.js');
const { createTrainingService } = require('../healthy-fitness-coach-plugin/mcp/xunji/src/server.js');

const feature = readFileSync(join(__dirname, 'features', 'fitness-coach.feature'), 'utf8');

function memoryCache() {
  const values = new Map();
  return { get: async (date) => values.get(date) || null, set: async (date, value) => values.set(date, value) };
}

async function cachedReads() {
  let requests = 0;
  const service = createTrainingService({
    cache: memoryCache(),
    credentialProvider: async () => 'GHERKIN_SYNTHETIC_CREDENTIAL',
    client: { async fetchDay() { requests += 1; return { records: [] }; } },
    now: () => 1000
  });
  await Promise.all([
    service.getTrainingDay({ date: '2026-08-01' }),
    service.getTrainingDay({ date: '2026-08-01' })
  ]);
  assert.equal(requests, 1);
}

function annualHeatmap() {
  const svg = renderTrainingHeatmapSvg({ dates: ['2026-01-01', '2026-12-31'], startDate: '2026-01-01', endDate: '2026-12-31' });
  assert.match(svg, /data-heatmap="year"/);
  const cells = [...svg.matchAll(/<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)];
  assert.equal(cells.length, 365);
  assert.ok(cells.every((match) => Number(match[1]) >= 0 && Number(match[2]) >= 0 && Number(match[1]) + Number(match[3]) <= 420 && Number(match[2]) + Number(match[4]) <= 260));
}

function mixedDates() {
  assert.throws(() => validateUpsertRecords(['2026-08-01,id:1,胸部训练', '2026-08-02,id:2,背部训练']), /same datestr|same date|one date/i);
}

async function main() {
  assert.match(feature, /Feature: Healthy Fitness Coach quality gates/);
  const scenarios = [
    ['Cached Xunji reads do not duplicate a same-day request', cachedReads],
    ['Annual heatmap stays inside its SVG viewport', annualHeatmap],
    ['Write-back rejects mixed training dates', mixedDates]
  ];
  for (const [name, run] of scenarios) {
    await run();
    process.stdout.write(`PASS ${name}\n`);
  }
  process.stdout.write(`Gherkin: ${scenarios.length}/${scenarios.length} scenarios passed\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
