'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CANVAS_PRESETS,
  createStyleToken,
  overrideStyleToken,
  renderShareCardSvg,
  renderCategoryChartSvg,
  renderTrendChartSvg,
  resolveCanvas
} = require('../references/visuals.js');
const { buildVisualReportAssets } = require('../references/visual-report.js');

test('resolveCanvas returns exact social export dimensions', () => {
  assert.deepEqual(resolveCanvas('1:1'), CANVAS_PRESETS['1:1']);
  assert.deepEqual(resolveCanvas('9:16'), CANVAS_PRESETS['9:16']);
  assert.deepEqual(resolveCanvas('3:4'), CANVAS_PRESETS['3:4']);
  assert.throws(() => resolveCanvas('4:5'), /ratio/i);
});

test('createStyleToken derives a distinct readable palette from visual signals', () => {
  const token = createStyleToken({
    palette: ['#F5E8D0', '#12233F', '#ED5A4A'],
    luminance: 'high',
    contrast: 'soft',
    texture: 'paper',
    composition: 'subject_left_text_right'
  });
  assert.equal(token.palette.bg, '#F5E8D0');
  assert.equal(token.palette.accent, '#ED5A4A');
  assert.equal(token.composition, 'subject_left_text_right');
  assert.equal(token.source, 'adaptive');
  assert.ok(token.palette.text);
});

test('style overrides change only requested fields and preserve safety defaults', () => {
  const base = createStyleToken({ palette: ['#101318', '#D7FF4B', '#7A8BFF'] });
  const next = overrideStyleToken(base, { texture: 'none', spacing: 'airy', palette: { accent: '#FF5C35' } });
  assert.equal(next.texture, 'none');
  assert.equal(next.spacing, 'airy');
  assert.equal(next.palette.accent, '#FF5C35');
  assert.equal(next.palette.text, base.palette.text);
  assert.equal(next.source, 'adaptive');
});

test('trend chart escapes labels and exposes accessible SVG metadata', () => {
  const svg = renderTrendChartSvg({
    points: [{ label: '07月', value: 10 }, { label: '<x>', value: 20 }],
    title: '训练趋势',
    color: '#D7FF4B'
  });
  assert.match(svg, /^<svg[^>]+viewBox=/);
  assert.match(svg, /训练趋势/);
  assert.match(svg, /&lt;x&gt;/);
  assert.match(svg, /role="img"/);
});

test('category chart renders comparable horizontal bars with labels', () => {
  const svg = renderCategoryChartSvg({
    title: '部位分布',
    items: [{ label: '肩', value: 4 }, { label: '<腿>', value: 1 }],
    color: '#7A8BFF'
  });
  assert.match(svg, /部位分布/);
  assert.match(svg, /&lt;腿&gt;/);
  assert.match(svg, /<rect/);
  assert.match(svg, /role="img"/);
});

test('share card renderer produces a self-contained exportable SVG', () => {
  const svg = renderShareCardSvg({
    ratio: '9:16',
    styleToken: createStyleToken({ palette: ['#17191D', '#D7FF4B', '#7A8BFF'], contrast: 'high' }),
    eyebrow: 'TRAINING LOG / 2026.07',
    title: '把训练变成证据',
    subtitle: '稳定出现，比偶尔爆发更重要。',
    metrics: [{ label: '训练日', value: '10' }, { label: '总时长', value: '10.4h' }]
  });
  assert.match(svg, /width="1440"/);
  assert.match(svg, /height="2560"/);
  assert.match(svg, /把训练变成证据/);
  assert.match(svg, /10\.4h/);
  assert.doesNotMatch(svg, /<script/i);
});

test('visual report builder returns reusable chart assets from trend data', () => {
  const assets = buildVisualReportAssets({
    trends: {
      weekly: [{ week_start: '2026-07-06', training_days: 2, estimated_volume: 1000 }],
      exercise_frequency: [{ name: '肩', count: 4, last_date: '2026-07-28' }]
    }
  });
  assert.deepEqual(assets.map((asset) => asset.name), ['weekly-frequency.svg', 'weekly-volume.svg', 'subject-distribution.svg']);
  assert.ok(assets.every((asset) => asset.svg.startsWith('<svg')));
});
