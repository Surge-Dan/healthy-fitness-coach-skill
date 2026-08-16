#!/usr/bin/env node
'use strict';

const { readFile, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join, resolve } = require('node:path');
const { RECIPE_CATALOG, buildVisualDNA, mapFitnessMotifs, recommendVisualRecipes, routeVisualInput, validateRatio } = require('../skills/healthy-fitness-coach/references/visual-dna.js');
const { compileDerivedLayerPrompt } = require('../skills/healthy-fitness-coach/references/visual-prompt-compiler.js');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  if (process.argv.includes('--list-recipes')) {
    process.stdout.write(JSON.stringify(RECIPE_CATALOG));
    return;
  }
  const inputPath = argument('--input');
  const outputPath = argument('--output');
  if (!inputPath || !outputPath) throw new Error('usage: compile-visual-brief.js --input INPUT.json --output MANIFEST.json');
  const payload = JSON.parse((await readFile(resolve(inputPath), 'utf8')).replace(/^\uFEFF/, ''));
  const imageInputs = payload.images || (payload.photos || []).map((path) => ({ path }));
  const images = imageInputs.map((image) => {
    if (!image?.path || !existsSync(resolve(image.path)) || image.palette?.length) return image;
    const extraction = spawnSync('python', [join(__dirname, 'extract-style.py'), resolve(image.path)], { encoding: 'utf8' });
    if (extraction.status !== 0) return { ...image, extraction_warning: String(extraction.stderr || 'style extraction failed').trim() };
    const extracted = JSON.parse(extraction.stdout);
    return { ...extracted, ...image, image: extracted.image, semantic_facts: image.semantic_facts || [], visual_facts: [...(extracted.visual_facts || []), ...(image.visual_facts || [])] };
  });
  const photos = images.map((image) => image.path || image.id).filter(Boolean);
  const route = routeVisualInput({ photos, trends: payload.trends });
  const visualDNA = buildVisualDNA({ images });
  const motifs = mapFitnessMotifs({ observedFacts: visualDNA.observed_facts, trends: payload.trends || {} });
  const ratio = validateRatio(payload.ratio || '3:4');
  const recommendations = recommendVisualRecipes({ route, visualDNA, preferred: payload.recipe }).map((recipe) => ({
    ...recipe,
    prompt: compileDerivedLayerPrompt({ recipe, visualDNA, motifs, ratio, photoCount: route.photo_count }),
    traceability: motifs.map((motif) => ({ motif: motif.id, source: motif.source }))
  }));
  const manifest = {
    schema_version: '1.0',
    generated_locally: true,
    route,
    ratio,
    title: payload.title || '',
    visual_dna: visualDNA,
    motifs,
    recommendations,
    data_contract: { generated_text: false, generated_numbers: false, original_photo_preserved: route.photo_count > 0 }
  };
  await writeFile(resolve(outputPath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(JSON.stringify({ output: resolve(outputPath), route: route.kind, recommendations: recommendations.map((item) => item.id) }));
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
