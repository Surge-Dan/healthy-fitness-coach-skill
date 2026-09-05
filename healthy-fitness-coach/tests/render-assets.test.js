'use strict';

const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('output asset templates contain the required handoff sections', () => {
  const assets = join(__dirname, '..', 'assets');
  assert.match(readFileSync(join(assets, 'today-workout-template.md'), 'utf8'), /训练前检查/);
  assert.match(readFileSync(join(assets, 'today-workout-template.md'), 'utf8'), /完成记录/);
  assert.match(readFileSync(join(assets, 'training-system-index-template.md'), 'utf8'), /资产索引/);
  assert.match(readFileSync(join(assets, 'training-system-index-template.md'), 'utf8'), /更新条件/);
});

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
  assert.match(readFileSync(join(output, 'main-performance.svg'), 'utf8'), /暂无足够的同动作数据/);
  rmSync(root, { recursive: true, force: true });
});

test('render-visual-assets CLI accepts a design mode and exposes mode discovery', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-modes-'));
  const input = join(root, 'input.json');
  const output = join(root, 'assets');
  writeFileSync(input, JSON.stringify({
    trends: { date_start: '2026-01-01', date_end: '2026-12-31', weekly: [{ week_start: '2026-07-06', training_days: 2, estimated_volume: 1000 }], training_dates: ['2026-07-06'], daily: [{ date: '2026-07-06', volume: 1000, sets: 5, record_count: 1 }], exercise_frequency: [] },
    share: { mode: 'training-editorial', title: '战报', subtitle: '2026', metrics: [{ label: '训练天数', value: '2天' }], trendPoints: [{ label: '07', value: 2 }] }
  }));
  const result = spawnSync(process.execPath, ['scripts/render-visual-assets.js', '--input', input, '--output', output, '--ratio', '3:4', '--mode', 'training-editorial'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(output, 'share-card-3-4.svg'), 'utf8'), /data-mode="training-editorial"/);
  const modes = spawnSync(process.execPath, ['scripts/render-visual-assets.js', '--list-modes', '--has-photo'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(modes.status, 0, modes.stderr);
  assert.deepEqual(JSON.parse(modes.stdout).map((mode) => mode.id), ['abstract-collage', 'training-editorial', 'material-poster']);
  const palettes = spawnSync(process.execPath, ['scripts/render-visual-assets.js', '--list-palettes'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(palettes.status, 0, palettes.stderr);
  assert.equal(JSON.parse(palettes.stdout).length, 5);
  const rich = spawnSync(process.execPath, ['scripts/render-visual-assets.js', '--input', input, '--output', output, '--ratio', '3:4', '--mode', 'data-atlas', '--layout', 'rich'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(rich.status, 0, rich.stderr);
  const richSvg = readFileSync(join(output, 'share-card-3-4.svg'), 'utf8');
  assert.match(richSvg, /data-layout="rich"/);
  assert.match(richSvg, /训练量/);
  assert.ok((richSvg.match(/<rect /g) || []).length >= 360);
  rmSync(root, { recursive: true, force: true });
});

test('render-visual-assets CLI lets an explicit palette override an input style token', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-palette-'));
  const input = join(root, 'input.json');
  const output = join(root, 'assets');
  const payload = JSON.stringify({
    share: { styleToken: { palette: { bg: '#242629', accent: '#D7FF4B', secondary: '#7A8BFF', text: '#F6F7F2', muted: '#A9B0AA' } }, title: '配色覆盖' }
  });
  writeFileSync(input, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(payload)]));
  const result = spawnSync(process.execPath, ['scripts/render-visual-assets.js', '--input', input, '--output', output, '--palette', 'paper-ink'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(output, 'share-card-3-4.svg'), 'utf8'), /#F4EFE6/);
  rmSync(root, { recursive: true, force: true });
});

const pluginRoot = join(__dirname, '..', '..', 'healthy-fitness-coach-plugin');
test('plugin visual CLI is independently runnable and can explicitly embed a photo', {
  skip: !existsSync(pluginRoot) && 'Standalone Skill package: sibling plugin is not distributed'
}, () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-plugin-cli-'));
  const input = join(root, 'input.json');
  const photo = join(root, 'photo.png');
  const output = join(root, 'assets');
  writeFileSync(photo, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
  writeFileSync(input, JSON.stringify({ share: { mode: 'abstract-collage', title: '照片测试', photo } }));
  const result = spawnSync(process.execPath, ['scripts/render-visual-assets.js', '--input', input, '--output', output, '--photo', photo, '--embed-photo'], { cwd: join(__dirname, '..', '..', 'healthy-fitness-coach-plugin'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(output, 'share-card-3-4.svg'), 'utf8'), /data:image\/png;base64/);
  rmSync(root, { recursive: true, force: true });
});
