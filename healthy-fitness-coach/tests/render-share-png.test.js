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

test('render-share-card supports independent poster modes', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-poster-modes-'));
  const input = join(root, 'input.json');
  const abstractOutput = join(root, 'abstract.png');
  const materialOutput = join(root, 'material.png');
  writeFileSync(input, JSON.stringify({
    share: {
      title: '训练档案',
      subtitle: '2026 YTD',
      metrics: [{ label: '训练天数', value: '74天' }, { label: '训练组数', value: '3301组' }],
      styleToken: { palette: { bg: '#22252A', accent: '#D7FF4B', secondary: '#7A8BFF', text: '#F6F7F2', muted: '#A9B0AA' } }
    }
  }));
  const first = spawnSync('python', ['scripts/render-share-card.py', '--input', input, '--output', abstractOutput, '--ratio', '3:4', '--mode', 'abstract-collage'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  const second = spawnSync('python', ['scripts/render-share-card.py', '--input', input, '--output', materialOutput, '--ratio', '3:4', '--mode', 'material-poster'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.notDeepEqual(readFileSync(abstractOutput), readFileSync(materialOutput));
  rmSync(root, { recursive: true, force: true });
});

test('render-share-card keeps rich empty reports valid and accepts UTF-8 BOM input', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-rich-empty-'));
  const input = join(root, 'input.json');
  const output = join(root, 'rich.png');
  const payload = {
    trends: { date_start: '2026-01-01', date_end: '2026-12-31', training_dates: [], daily: [], exercise_frequency: [] },
    share: { layout: 'rich', mode: 'data-atlas', title: '空数据年度报告', metrics: [{ label: '训练天数', value: '0' }] }
  };
  writeFileSync(input, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(JSON.stringify(payload))]));
  const result = spawnSync('python', ['scripts/render-share-card.py', '--input', input, '--output', output, '--ratio', '3:4', '--layout', 'rich'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual([...readFileSync(output).slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  rmSync(root, { recursive: true, force: true });
});
