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
  assert.equal(token.source, 'image');
  assert.ok(Array.isArray(token.palette) && token.palette.length >= 3);
  assert.ok(token.luminance);
  assert.ok(token.contrast);
  rmSync(root, { recursive: true, force: true });
});
