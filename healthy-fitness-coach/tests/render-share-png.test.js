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

test('visual composition renderer exports star-trail collage as a distinct photo-first recipe', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-star-trail-'));
  const input = join(root, 'input.json');
  const output = join(root, 'star-trail.png');
  writeFileSync(input, JSON.stringify({
    recipe: 'star-trail-collage',
    title: '今天也在变强',
    subtitle: '把出现，变成自己的节奏',
    photos: ['fixtures/nonexistent-photo.png'],
    metrics: [{ label: '训练天数', value: '74' }]
  }));
  const result = spawnSync('python', ['scripts/render-visual-composition.py', '--input', input, '--output', output, '--ratio', '3:4'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(readFileSync(output).length > 10000);
});

test('visual composition PNG adapts collage geometry from visual DNA', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-adaptive-collage-'));
  const image = join(root, 'photo.ppm');
  const tornInput = join(root, 'torn.json');
  const burstInput = join(root, 'burst.json');
  const tornOutput = join(root, 'torn.png');
  const burstOutput = join(root, 'burst.png');
  writeFileSync(image, 'P3\n4 4\n255\n255 90 70 255 90 70 20 30 40 20 30 40\n255 90 70 255 90 70 20 30 40 20 30 40\n20 30 40 20 30 40 255 90 70 255 90 70\n20 30 40 20 30 40 255 90 70 255 90 70\n');
  const common = { recipe: 'star-trail-collage', title: '今日训练', photos: [image] };
  writeFileSync(tornInput, JSON.stringify({ ...common, visualDNA: { images: [{ orientation: 'portrait', focal_region: 'center', negative_space: 'right' }] } }));
  writeFileSync(burstInput, JSON.stringify({ ...common, visualDNA: { images: [{ orientation: 'landscape', focal_region: 'left', negative_space: 'top' }] } }));
  const torn = spawnSync('python', ['scripts/render-visual-composition.py', '--input', tornInput, '--output', tornOutput, '--ratio', '3:4'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  const burst = spawnSync('python', ['scripts/render-visual-composition.py', '--input', burstInput, '--output', burstOutput, '--ratio', '3:4'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(torn.status, 0, torn.stderr);
  assert.equal(burst.status, 0, burst.stderr);
  assert.notDeepEqual(readFileSync(tornOutput), readFileSync(burstOutput));
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

test('rich PNG heatmap marks cross-year ranges instead of silently truncating them', () => {
  const script = [
    "import importlib.util",
    "spec=importlib.util.spec_from_file_location('renderer','scripts/render-share-card.py')",
    "module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)",
    "class Draw:",
    "  def __init__(self): self.labels=[]",
    "  def rounded_rectangle(self,*args,**kwargs): pass",
    "  def text(self,*args,**kwargs): self.labels.append(str(args[1]))",
    "d=Draw(); module.draw_year_heatmap(d, ['2025-12-31','2026-01-01'], [], (0,0,100,100), '#FFFFFF', '#000000', '2025-12-01', '2026-01-01'); print('|'.join(d.labels))"
  ].join('\n');
  const result = spawnSync('python', ['-c', script], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CROSS-YEAR/);
});

test('visual composition renderer creates distinct photo art and data-art PNG outputs', () => {
  const root = mkdtempSync(join(tmpdir(), 'healthy-fitness-compiled-png-'));
  const firstPhoto = join(root, 'one.ppm');
  const secondPhoto = join(root, 'two.ppm');
  const photoInput = join(root, 'photo.json');
  const dataInput = join(root, 'data.json');
  const photoOutput = join(root, 'storyboard.png');
  const dataOutput = join(root, 'rings.png');
  writeFileSync(firstPhoto, 'P3\n2 2\n255\n255 90 70  255 90 70\n20 30 40  20 30 40\n');
  writeFileSync(secondPhoto, 'P3\n2 2\n255\n60 220 190  60 220 190\n240 230 210  240 230 210\n');
  writeFileSync(photoInput, JSON.stringify({ recipe: 'multi-photo-storyboard', title: '训练分镜', photos: [firstPhoto, secondPhoto] }));
  writeFileSync(dataInput, JSON.stringify({ recipe: 'training-rings', title: '训练年轮', trends: { weekly: [{ training_days: 2, estimated_volume: 1200 }, { training_days: 4, estimated_volume: 2400 }] } }));
  const photoResult = spawnSync('python', ['scripts/render-visual-composition.py', '--input', photoInput, '--output', photoOutput, '--ratio', '3:4'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  const dataResult = spawnSync('python', ['scripts/render-visual-composition.py', '--input', dataInput, '--output', dataOutput, '--ratio', '3:4'], { cwd: join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(photoResult.status, 0, photoResult.stderr);
  assert.equal(dataResult.status, 0, dataResult.stderr);
  assert.deepEqual([...readFileSync(photoOutput).slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.notDeepEqual(readFileSync(photoOutput), readFileSync(dataOutput));
  rmSync(root, { recursive: true, force: true });
});
