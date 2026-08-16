'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { renderTrainingHeatmapSvg } = require('../healthy-fitness-coach/references/visuals.js');
const { validateUpsertRecords } = require('../healthy-fitness-coach-plugin/mcp/xunji/src/upsert.js');
const { createTrainingService } = require('../healthy-fitness-coach-plugin/mcp/xunji/src/server.js');
const { buildVisualDNA, mapFitnessMotifs, recommendVisualRecipes, routeVisualInput } = require('../healthy-fitness-coach/references/visual-dna.js');
const { compileDerivedLayerPrompt } = require('../healthy-fitness-coach/references/visual-prompt-compiler.js');
const { renderCompiledVisualSvg } = require('../healthy-fitness-coach/references/visual-composer.js');

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

function distinctRecipes() {
  const route = routeVisualInput({ photos: ['local.jpg'] });
  const visualDNA = buildVisualDNA({ images: [{ width: 1080, height: 1440, visual_facts: ['mirror:background', 'ring_light:top_center'] }] });
  const recipes = recommendVisualRecipes({ route, visualDNA });
  assert.equal(recipes.length, 3);
  assert.equal(new Set(recipes.map((recipe) => recipe.grammar)).size, 3);
}

function safeDerivedPrompt() {
  const visualDNA = buildVisualDNA({ images: [{ visual_facts: ['ring_light:top_center'] }] });
  const motifs = mapFitnessMotifs({ observedFacts: visualDNA.observed_facts });
  const compiled = compileDerivedLayerPrompt({ recipe: { id: 'sketch-diptych' }, visualDNA, motifs });
  assert.match(compiled.prompt, /No text\. No letters\. No numbers/);
  assert.match(compiled.prompt, /No logos\. No watermarks\. No invented/);
  assert.equal(compiled.output.contains_metrics, false);
}

function multiPhotoPreservation() {
  const svg = renderCompiledVisualSvg({ ratio: '3:4', recipe: 'multi-photo-storyboard', photos: ['one.jpg', 'two.jpg', 'three.jpg'] });
  assert.equal((svg.match(/data-role="original-photo"/g) || []).length, 3);
  assert.equal((svg.match(/class="story-panel/g) || []).length, 3);
}

async function main() {
  assert.match(feature, /Feature: Healthy Fitness Coach quality gates/);
  const scenarios = [
    ['Cached Xunji reads do not duplicate a same-day request', cachedReads],
    ['Annual heatmap stays inside its SVG viewport', annualHeatmap],
    ['Write-back rejects mixed training dates', mixedDates],
    ['A single photo receives three structurally different recipes', distinctRecipes],
    ['A derived art layer cannot invent training facts', safeDerivedPrompt],
    ['Multiple photos remain present in the training storyboard', multiPhotoPreservation]
  ];
  for (const [name, run] of scenarios) {
    await run();
    process.stdout.write(`PASS ${name}\n`);
  }
  process.stdout.write(`Gherkin: ${scenarios.length}/${scenarios.length} scenarios passed\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
