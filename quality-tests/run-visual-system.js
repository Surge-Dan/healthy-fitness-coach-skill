'use strict';

const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { RECIPE_CATALOG, recommendVisualRecipes, routeVisualInput } = require('../healthy-fitness-coach/references/visual-dna.js');
const { renderCompiledVisualSvg } = require('../healthy-fitness-coach/references/visual-composer.js');

const root = resolve(__dirname, '..');
const canonical = join(root, 'healthy-fitness-coach');
const pluginSkill = join(root, 'healthy-fitness-coach-plugin', 'skills', 'healthy-fitness-coach');
const required = [
  'references/visual-dna.js',
  'references/visual-prompt-compiler.js',
  'references/visual-composer.js',
  'scripts/extract-style.py',
  'scripts/compile-visual-brief.js',
  'scripts/render-visual-composition.py'
];

assert.equal(RECIPE_CATALOG.length, 11);
assert.equal(new Set(RECIPE_CATALOG.map((recipe) => recipe.grammar)).size, 11);
for (const ratio of ['1:1', '3:4', '9:16']) {
  for (const recipe of RECIPE_CATALOG) {
    const svg = renderCompiledVisualSvg({
      ratio,
      recipe: recipe.id,
      photos: recipe.requires_photo ? ['local-photo.jpg', 'second-photo.jpg'] : [],
      trends: { weekly: [{ training_days: 2, estimated_volume: 1000 }], exercise_frequency: [{ name: '背', count: 4 }] }
    });
    assert.match(svg, new RegExp(`data-recipe="${recipe.id}"`));
    assert.match(svg, new RegExp(`width="${ratio === '1:1' ? 2048 : ratio === '3:4' ? 1800 : 1440}"`));
  }
}

const single = recommendVisualRecipes({ route: routeVisualInput({ photos: ['one.jpg'] }), visualDNA: { images: [], observed_facts: [] } });
assert.equal(single.length, 3);
assert.equal(new Set(single.map((recipe) => recipe.grammar)).size, 3);

for (const relative of required) {
  assert.ok(existsSync(join(canonical, relative)), `missing canonical visual file: ${relative}`);
  if (relative.startsWith('references/')) {
    assert.ok(existsSync(join(pluginSkill, relative)), `missing plugin visual file: ${relative}`);
    assert.equal(readFileSync(join(canonical, relative), 'utf8'), readFileSync(join(pluginSkill, relative), 'utf8'), `plugin visual reference out of sync: ${relative}`);
  } else {
    assert.ok(existsSync(join(root, 'healthy-fitness-coach-plugin', relative)), `missing plugin visual script: ${relative}`);
  }
}

process.stdout.write('Visual system quality gate passed (11 recipes × 3 ratios, traceable recommendations, canonical/plugin sync).\n');

