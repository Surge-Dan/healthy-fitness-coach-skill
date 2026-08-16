'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { RECIPE_CATALOG } = require('../healthy-fitness-coach/references/visual-dna.js');

const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-png-recipes-'));
const photo = join(root, 'photo.ppm');
writeFileSync(photo, 'P3\n3 3\n255\n245 232 208 18 35 63 237 90 74\n18 35 63 245 232 208 18 35 63\n237 90 74 18 35 63 245 232 208\n');

try {
  const ratios = ['1:1', '3:4', '9:16'];
  const dimensions = { '1:1': [2048, 2048], '3:4': [1800, 2400], '9:16': [1440, 2560] };
  for (const [index, recipe] of RECIPE_CATALOG.entries()) {
    const input = join(root, `${recipe.id}.json`);
    const output = join(root, `${recipe.id}.png`);
    writeFileSync(input, JSON.stringify({
      recipe: recipe.id,
      title: recipe.name,
      photos: recipe.requires_photo ? [photo, photo] : [],
      motifs: [{ id: 'halo-cycle' }],
      metrics: [{ label: '训练日', value: '2' }],
      trends: { weekly: [{ training_days: 2, estimated_volume: 1000 }, { training_days: 3, estimated_volume: 1600 }], exercise_frequency: [{ name: '背', count: 4 }, { name: '胸', count: 3 }] }
    }));
    const ratio = ratios[index % ratios.length];
    const result = spawnSync('python', [resolve(__dirname, '..', 'healthy-fitness-coach', 'scripts', 'render-visual-composition.py'), '--input', input, '--output', output, '--ratio', ratio], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${recipe.id}: ${result.stderr}`);
    const png = readFileSync(output);
    assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${recipe.id}: invalid PNG`);
    assert.equal(png.readUInt32BE(16), dimensions[ratio][0], `${recipe.id}: wrong width`);
    assert.equal(png.readUInt32BE(20), dimensions[ratio][1], `${recipe.id}: wrong height`);
  }
  process.stdout.write(`PNG recipe smoke passed (${RECIPE_CATALOG.length}/${RECIPE_CATALOG.length}).\n`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
