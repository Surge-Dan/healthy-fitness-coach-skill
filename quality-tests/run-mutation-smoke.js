'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-mutants-'));
const mutants = [
  {
    name: 'annual heatmap threshold',
    source: join(__dirname, '..', 'healthy-fitness-coach', 'references', 'visuals.js'),
    mutation: (source) => source.replace('if (totalDays > 90)', 'if (totalDays > 0)'),
    probe: (path) => `const { renderTrainingHeatmapSvg } = require(${JSON.stringify(path)}); const svg = renderTrainingHeatmapSvg({ dates: ['2026-01-01'], startDate: '2026-01-01', endDate: '2026-01-07' }); if (svg.includes('data-heatmap="year"')) process.exit(1);`
  },
  {
    name: 'main exercise performance value',
    source: join(__dirname, '..', 'healthy-fitness-coach-plugin', 'mcp', 'xunji', 'src', 'trends.js'),
    mutation: (source) => source.replace("const value = weight > 0 ? weight : volume > 0 ? volume : 0;", 'const value = 0;'),
    probe: (path) => `const { analyzeTrainingRange } = require(${JSON.stringify(path)}); const result = analyzeTrainingRange({ dates: ['2026-08-01'], records: [{ record_date: '2026-08-01', title: '卧推', weight: '60kg', volume: 1000 }] }); if (!result.exercise_performance.length) process.exit(1);`
  },
  {
    name: 'visual input multi-photo routing',
    source: join(__dirname, '..', 'healthy-fitness-coach', 'references', 'visual-dna.js'),
    mutation: (source) => source.replace('if (photoCount > 1)', 'if (photoCount > 99)'),
    probe: (path) => `const { routeVisualInput } = require(${JSON.stringify(path)}); if (routeVisualInput({ photos: ['a','b'] }).kind !== 'multi-photo') process.exit(1);`
  },
  {
    name: 'derived prompt forbids generated numbers',
    source: join(__dirname, '..', 'healthy-fitness-coach', 'references', 'visual-prompt-compiler.js'),
    mutation: (source) => source.replace('No text. No letters. No numbers.', 'No text. No letters.'),
    probe: (path) => `const { compileDerivedLayerPrompt } = require(${JSON.stringify(path)}); if (!compileDerivedLayerPrompt({}).prompt.includes('No numbers.')) process.exit(1);`
  }
];

let killed = 0;
for (const mutant of mutants) {
  const original = readFileSync(mutant.source, 'utf8');
  const mutated = mutant.mutation(original);
  assert.notEqual(mutated, original, `${mutant.name}: mutation was not applied`);
  const path = join(root, `${mutants.indexOf(mutant)}.js`);
  writeFileSync(path, mutated, 'utf8');
  const result = spawnSync(process.execPath, ['-e', mutant.probe(path)], { encoding: 'utf8' });
  if (result.status !== 0) killed += 1;
  process.stdout.write(`${result.status !== 0 ? 'KILLED' : 'SURVIVED'} ${mutant.name}\n`);
}
rmSync(root, { recursive: true, force: true });
const score = killed / mutants.length;
process.stdout.write(`Mutation smoke score: ${killed}/${mutants.length} (${Math.round(score * 100)}%)\n`);
if (score < 1) process.exitCode = 1;
