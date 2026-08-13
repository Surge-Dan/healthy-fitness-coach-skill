'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('render-visual-assets CLI writes report SVGs and one selected share ratio', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-visuals-'));
  const input = join(root, 'input.json');
  const output = join(root, 'assets');
  writeFileSync(input, JSON.stringify({
    trends: { weekly: [{ week_start: '2026-07-06', training_days: 2, estimated_volume: 1000 }], exercise_frequency: [{ name: '肩', count: 4 }] },
    share: { title: '训练月报', subtitle: '稳定出现', metrics: [{ label: '训练日', value: '10' }] }
  }));
  const result = spawnSync(process.execPath, ['scripts/render-visual-assets.js', '--input', input, '--output', output, '--ratio', '1:1'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(output, 'weekly-frequency.svg'), 'utf8'), /<svg/);
  assert.match(readFileSync(join(output, 'share-card-1-1.svg'), 'utf8'), /width="2048"/);
  rmSync(root, { recursive: true, force: true });
});
