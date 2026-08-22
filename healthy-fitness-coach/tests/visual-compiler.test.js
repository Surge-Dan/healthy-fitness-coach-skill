'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { renderCompiledVisualSvg } = require('../references/visual-composer.js');

test('single-photo split composition has independent original and derived slots', () => {
  const svg = renderCompiledVisualSvg({
    ratio: '3:4',
    recipe: 'sketch-diptych',
    photos: ['data:image/jpeg;base64,AAAA'],
    derivedImage: 'data:image/png;base64,BBBB',
    title: '今天也在变强',
    motifs: [{ id: 'halo-cycle' }]
  });
  assert.match(svg, /data-recipe="sketch-diptych"/);
  assert.match(svg, /data-role="original-photo"/);
  assert.match(svg, /data-role="derived-art"/);
  assert.match(svg, /class="motif-halo-cycle"/);
});

test('compiled SVG refuses remote or executable image references', () => {
  const svg = renderCompiledVisualSvg({ ratio: '1:1', recipe: 'sketch-diptych', photos: ['javascript:alert(1)'], derivedImage: 'https://example.com/private.jpg' });
  assert.doesNotMatch(svg, /javascript:|https:\/\//i);
});

test('multi-photo storyboard renders each supplied image in a narrative grid', () => {
  const svg = renderCompiledVisualSvg({
    ratio: '9:16',
    recipe: 'multi-photo-storyboard',
    photos: ['one.jpg', 'two.jpg', 'three.jpg'],
    title: 'PUSH / PULL / LEGS'
  });
  assert.equal((svg.match(/data-role="original-photo"/g) || []).length, 3);
  assert.match(svg, /class="story-panel/);
});

test('no-photo recipes use different SVG grammars rather than recoloring one layout', () => {
  const common = { ratio: '1:1', title: '八月训练', trends: { weekly: [{ training_days: 2, estimated_volume: 1200 }, { training_days: 4, estimated_volume: 2800 }] } };
  const rings = renderCompiledVisualSvg({ ...common, recipe: 'training-rings' });
  const terrain = renderCompiledVisualSvg({ ...common, recipe: 'strength-terrain' });
  const fingerprint = renderCompiledVisualSvg({ ...common, recipe: 'action-fingerprint' });
  assert.match(rings, /class="training-rings"/);
  assert.match(terrain, /class="strength-terrain"/);
  assert.match(fingerprint, /class="action-fingerprint"/);
  assert.notEqual(rings, terrain);
  assert.notEqual(terrain, fingerprint);
});

test('every public visual recipe renders its own declared composition', () => {
  const photoRecipes = ['star-trail-collage', 'sketch-diptych', 'motion-comic', 'risograph-zine', 'symbol-lab', 'minimal-trajectory', 'multi-photo-storyboard'];
  const dataRecipes = ['data-atlas', 'training-rings', 'muscle-constellation', 'strength-terrain', 'action-fingerprint'];
  for (const recipe of photoRecipes) {
    const svg = renderCompiledVisualSvg({ ratio: '1:1', recipe, photos: ['one.jpg', 'two.jpg'], title: recipe, motifs: [{ id: 'halo-cycle' }] });
    assert.match(svg, new RegExp(`data-recipe="${recipe}"`));
    assert.match(svg, /data-role="original-photo"/);
  }
  for (const recipe of dataRecipes) {
    const svg = renderCompiledVisualSvg({ ratio: '1:1', recipe, title: recipe, trends: { weekly: [{ training_days: 2, estimated_volume: 1000 }], exercise_frequency: [{ name: '背', count: 4 }] } });
    assert.match(svg, new RegExp(`data-recipe="${recipe}"`));
    assert.doesNotMatch(svg, /data-role="original-photo"/);
  }
});

test('star-trail collage is a photo-first social composition with layered accents', () => {
  const svg = renderCompiledVisualSvg({
    ratio: '3:4',
    recipe: 'star-trail-collage',
    photos: ['hero.jpg'],
    title: '今天也在变强',
    metrics: [{ label: '训练天数', value: '74' }]
  });
  assert.match(svg, /data-recipe="star-trail-collage"/);
  assert.match(svg, /class="star-trail-hero"/);
  assert.match(svg, /class="star-trail-inset"/);
  assert.match(svg, /class="star-sticker /);
  assert.match(svg, /hand-note/);
});

test('star-trail collage adapts its collage grammar and typography to visual DNA', () => {
  const torn = renderCompiledVisualSvg({
    ratio: '3:4',
    recipe: 'star-trail-collage',
    photos: ['hero.jpg'],
    title: '今天也在变强',
    visualDNA: { images: [{ orientation: 'portrait', focal_region: 'center', negative_space: 'right', luminance: 'dark', contrast: 'high' }] }
  });
  const burst = renderCompiledVisualSvg({
    ratio: '3:4',
    recipe: 'star-trail-collage',
    photos: ['hero.jpg'],
    title: '胸肩训练完成',
    visualDNA: { images: [{ orientation: 'landscape', focal_region: 'left', negative_space: 'top', luminance: 'bright', contrast: 'high' }] }
  });
  assert.match(torn, /data-layout="torn-vertical"/);
  assert.match(burst, /data-layout="burst-poster"/);
  assert.notEqual(torn, burst);
  assert.match(torn, /class="type-lockup"/);
  assert.match(torn, /data-type-safe-zone=/);
  assert.match(torn, /font-family="Noto Serif CJK SC/);
  assert.match(torn, /class="torn-edge|class="burst-lines/);
  const contact = renderCompiledVisualSvg({ ratio: '3:4', recipe: 'star-trail-collage', photos: ['one.jpg', 'two.jpg', 'three.jpg'], title: '本周训练片段' });
  assert.match(contact, /data-layout="contact-offset"/);
  assert.equal((contact.match(/class="contact-card/g) || []).length, 3);
  assert.match(contact, /class="washi-tape"/);
});

test('visual compiler CLI emits three recommendations and an auditable manifest', () => {
  const root = mkdtempSync(join(tmpdir(), 'fitness-visual-compiler-'));
  const input = join(root, 'input.json');
  const output = join(root, 'manifest.json');
  const image = join(root, 'one.ppm');
  writeFileSync(image, 'P3\n4 2\n255\n245 232 208  245 232 208  18 35 63  18 35 63\n245 232 208  237 90 74  18 35 63  18 35 63\n');
  writeFileSync(input, JSON.stringify({
    images: [{ path: image, semantic_facts: ['mirror:background'] }],
    ratio: '3:4',
    title: '今日训练'
  }));
  const result = spawnSync(process.execPath, ['scripts/compile-visual-brief.js', '--input', input, '--output', output], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(manifest.schema_version, '1.0');
  assert.equal(manifest.route.kind, 'single-photo');
  assert.equal(manifest.visual_dna.images[0].aspect_ratio, '2:1');
  assert.ok(manifest.visual_dna.palette.length >= 3);
  assert.equal(manifest.recommendations.length, 3);
  assert.ok(manifest.recommendations.every((item) => item.prompt && item.traceability));
  rmSync(root, { recursive: true, force: true });
});

test('plugin visual compiler is independently runnable from the plugin root', () => {
  const root = mkdtempSync(join(tmpdir(), 'fitness-plugin-visual-compiler-'));
  const input = join(root, 'input.json');
  const output = join(root, 'manifest.json');
  writeFileSync(input, JSON.stringify({ trends: { weekly: [{ training_days: 2 }] }, ratio: '1:1', title: '训练月报' }));
  const result = spawnSync(process.execPath, ['scripts/compile-visual-brief.js', '--input', input, '--output', output], { cwd: join(__dirname, '..', '..', 'healthy-fitness-coach-plugin'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(manifest.route.kind, 'data-only');
  assert.equal(manifest.recommendations.length, 3);
  const choices = spawnSync(process.execPath, ['scripts/compile-visual-brief.js', '--list-recipes'], { cwd: join(__dirname, '..', '..', 'healthy-fitness-coach-plugin'), encoding: 'utf8' });
  assert.equal(choices.status, 0, choices.stderr);
  assert.equal(JSON.parse(choices.stdout).length, 12);
  rmSync(root, { recursive: true, force: true });
});
