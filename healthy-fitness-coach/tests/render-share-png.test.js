'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('render-share-card creates a PNG at the requested social ratio', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-png-'));
  const input = join(root, 'share.json');
  const output = join(root, 'card.png');
  writeFileSync(input, JSON.stringify({ title: '训练月报', subtitle: '稳定出现', metrics: [{ label: '训练日', value: '10' }] }));
  const result = spawnSync('python', ['scripts/render-share-card.py', '--input', input, '--output', output, '--ratio', '1:1'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const png = readFileSync(output);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 2048);
  assert.equal(png.readUInt32BE(20), 2048);
  rmSync(root, { recursive: true, force: true });
});
