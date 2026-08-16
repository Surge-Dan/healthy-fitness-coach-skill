'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildVisualDNA,
  mapFitnessMotifs,
  recommendVisualRecipes,
  routeVisualInput
} = require('../references/visual-dna.js');
const { compileDerivedLayerPrompt } = require('../references/visual-prompt-compiler.js');

test('visual router distinguishes the four supported input contracts', () => {
  assert.equal(routeVisualInput({ photos: ['one.jpg'] }).kind, 'single-photo');
  assert.equal(routeVisualInput({ photos: ['one.jpg', 'two.jpg'] }).kind, 'multi-photo');
  assert.equal(routeVisualInput({ trends: { weekly: [{ training_days: 2 }] } }).kind, 'data-only');
  assert.equal(routeVisualInput({ photos: ['one.jpg'], trends: { weekly: [{ training_days: 2 }] } }).kind, 'photo-data');
});

test('visual DNA keeps observed facts, safe zones and non-biometric boundaries', () => {
  const dna = buildVisualDNA({
    images: [{
      width: 1080,
      height: 1440,
      palette: ['#111111', '#D8A15B', '#F4F0E8'],
      region_palettes: { top: ['#111111'], middle: ['#D8A15B'], bottom: ['#F4F0E8'] },
      visual_facts: ['ring_light:top_center', 'mirror:background'],
      safe_zones: [{ id: 'top-left', score: 0.88 }],
      focal_region: 'center-left'
    }]
  });
  assert.equal(dna.schema_version, '2.0');
  assert.equal(dna.images[0].aspect_ratio, '3:4');
  assert.deepEqual(dna.images[0].safe_zones[0], { id: 'top-left', score: 0.88 });
  assert.ok(dna.observed_facts.includes('ring_light:top_center'));
  assert.ok(!JSON.stringify(dna).match(/face_identity|attractiveness|body_score/i));
});

test('fitness motifs are traceable and never invent an unobserved photo symbol', () => {
  const motifs = mapFitnessMotifs({
    observedFacts: ['ring_light:top_center', 'mirror:background', 'barbell_plate:foreground'],
    trends: { weekly: [{ training_days: 2, estimated_volume: 1800 }] }
  });
  assert.deepEqual(motifs.map((item) => item.id), ['halo-cycle', 'mirror-diptych', 'concentric-load', 'frequency-rhythm', 'volume-density']);
  assert.ok(motifs.every((item) => item.source && item.source.type));
  assert.ok(!motifs.some((item) => item.id === 'motion-trajectory'));
});

test('recipe recommendations are structurally distinct for single, multi and data-only inputs', () => {
  const single = recommendVisualRecipes({ route: { kind: 'single-photo' }, visualDNA: { observed_facts: ['mirror:background'], images: [{ texture: 'fine_grain' }] } });
  const multi = recommendVisualRecipes({ route: { kind: 'multi-photo', photo_count: 3 }, visualDNA: { observed_facts: [], images: [] } });
  const data = recommendVisualRecipes({ route: { kind: 'data-only' }, visualDNA: { observed_facts: [], images: [] } });
  assert.equal(single.length, 3);
  assert.equal(new Set(single.map((item) => item.grammar)).size, 3);
  assert.equal(multi[0].id, 'multi-photo-storyboard');
  assert.ok(data.some((item) => item.id === 'data-atlas'));
  assert.ok(data.every((item) => item.requires_photo === false));
});

test('derived layer prompt preserves the original and forbids generated text or fake data', () => {
  const prompt = compileDerivedLayerPrompt({
    recipe: { id: 'sketch-diptych', name: '原图×运动速写', derived_style: 'ink sketch' },
    visualDNA: { observed_facts: ['ring_light:top_center'], palette: ['#111111', '#D8A15B'] },
    motifs: [{ id: 'halo-cycle', source: { type: 'photo_fact', value: 'ring_light:top_center' } }],
    ratio: '3:4'
  });
  assert.match(prompt.prompt, /derived art layer/i);
  assert.match(prompt.prompt, /no text/i);
  assert.match(prompt.prompt, /no numbers/i);
  assert.match(prompt.prompt, /ring_light:top_center/);
  assert.equal(prompt.preservation.original_photo, 'high');
  assert.equal(prompt.output.transparent_or_plain_background, true);
});

