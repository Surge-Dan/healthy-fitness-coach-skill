'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('extract-style returns adaptive palette and visual signals from an image', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-style-'));
  const image = join(root, 'sample.ppm');
  writeFileSync(image, 'P3\n4 2\n255\n 245 232 208  245 232 208  18 35 63  18 35 63\n 245 232 208  237 90 74  18 35 63  18 35 63\n');
  const result = spawnSync('python', ['scripts/extract-style.py', image], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const token = JSON.parse(result.stdout);
  assert.equal(token.visual_dna_version, '2.0');
  assert.equal(token.source, 'image');
  assert.deepEqual(token.image, { width: 4, height: 2, aspect_ratio: '2:1', orientation: 'landscape' });
  assert.ok(Array.isArray(token.palette) && token.palette.length >= 3);
  assert.ok(token.region_palettes && token.region_palettes.top && token.region_palettes.center);
  assert.ok(token.luminance);
  assert.ok(token.contrast);
  assert.ok(token.visual_facts && Array.isArray(token.visual_facts));
  assert.ok(token.edge_rhythm);
  assert.ok(token.negative_space);
  assert.ok(Array.isArray(token.safe_zones) && token.safe_zones.length >= 1);
  assert.ok(token.focal_region);
  assert.doesNotMatch(JSON.stringify(token), /face_identity|attractiveness|body_score/i);
  rmSync(root, { recursive: true, force: true });
});
