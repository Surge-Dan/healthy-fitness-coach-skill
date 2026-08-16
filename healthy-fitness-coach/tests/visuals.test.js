'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CANVAS_PRESETS,
  createStyleToken,
  getColorOptions,
  getDesignModeOptions,
  overrideStyleToken,
  renderShareCardSvg,
  heatmapCellsSvg,
  yearHeatmapSvg,
  renderCategoryChartSvg,
  renderPerformanceChartSvg,
  renderTrainingHeatmapSvg,
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

test('style overrides preserve an adaptive palette object', () => {
  const base = createStyleToken({ palette: ['#F5E8D0', '#12233F', '#ED5A4A'] });
  const next = overrideStyleToken(base, { texture: 'none' });
  assert.equal(next.palette.bg, '#F5E8D0');
  assert.equal(next.palette.accent, '#ED5A4A');
});

test('design mode options explain photo-first presets and recommend a mode', () => {
  const modes = getDesignModeOptions({ hasPhoto: true, signals: { composition: 'subject_center_text_top' } });
  assert.deepEqual(modes.map((mode) => mode.id), ['abstract-collage', 'training-editorial', 'material-poster']);
  assert.equal(modes.filter((mode) => mode.recommended).length, 1);
  assert.ok(modes.every((mode) => mode.operations.length >= 2));
  assert.equal(getDesignModeOptions({ hasPhoto: true, signals: { texture: 'fine_grain' } }).find((mode) => mode.recommended).id, 'material-poster');
  assert.equal(getColorOptions().length, 5);
  assert.notEqual(createStyleToken({ theme: 'ultraviolet' }).palette.accent, createStyleToken({ theme: 'paper-ink' }).palette.accent);
});

test('abstract collage mode renders a derived panel instead of a card grid', () => {
  const svg = renderShareCardSvg({
    mode: 'abstract-collage',
    ratio: '3:4',
    title: '这一年，持续在场',
    subtitle: '截至8月13日',
    metrics: [{ label: '训练天数', value: '74天' }]
  });
  assert.match(svg, /data-mode="abstract-collage"/);
  assert.match(svg, /abstract-panel/);
  assert.match(svg, /derived-mark/);
  assert.doesNotMatch(svg, /metric-card/);
});

test('training editorial mode renders a contact sheet and data annotation layer', () => {
  const svg = renderShareCardSvg({
    mode: 'training-editorial',
    ratio: '3:4',
    title: 'YEAR IN MOTION',
    subtitle: '2026 YTD',
    metrics: [{ label: '训练天数', value: '74天' }, { label: '周均频率', value: '2.3次' }],
    trendPoints: [{ label: '01', value: 2 }, { label: '05', value: 4 }, { label: '08', value: 3 }]
  });
  assert.match(svg, /data-mode="training-editorial"/);
  assert.match(svg, /contact-strip/);
  assert.match(svg, /data-line/);
});

test('material poster mode renders texture layers and keeps data text local', () => {
  const svg = renderShareCardSvg({
    mode: 'material-poster',
    ratio: '1:1',
    title: 'TRAINING ARCHIVE',
    subtitle: '2026',
    metrics: [{ label: '训练天数', value: '74' }]
  });
  assert.match(svg, /data-mode="material-poster"/);
  assert.match(svg, /material-texture/);
  assert.match(svg, /TRAINING ARCHIVE/);
});

test('data atlas mode is available when no photo is supplied', () => {
  const modes = getDesignModeOptions({ hasPhoto: false });
  assert.deepEqual(modes.map((mode) => mode.id), ['data-atlas']);
  const svg = renderShareCardSvg({ mode: 'data-atlas', ratio: '3:4', title: '2026训练图谱', metrics: [{ label: '训练天数', value: '74天' }] });
  assert.match(svg, /data-mode="data-atlas"/);
  assert.match(svg, /atlas-grid/);
  assert.doesNotMatch(svg, /<image/);
});

test('rich infographic layout adds Chinese-first radar and heatmap sections', () => {
  const svg = renderShareCardSvg({
    layout: 'rich',
    mode: 'data-atlas',
    ratio: '3:4',
    title: '年度训练图谱',
    subtitle: '持续出现',
    metrics: [{ label: '训练天数', value: '74天' }],
    trendPoints: [{ label: '1月', value: 3 }, { label: '2月', value: 5 }],
    trainingDates: ['2026-01-01'],
    bodyDistribution: [{ label: '肩', value: 28 }, { label: '胸', value: 24 }, { label: '背', value: 11 }]
  });
  assert.match(svg, /data-layout="rich"/);
  assert.match(svg, /部位\/动作分布/);
  assert.match(svg, /训练热力/);
  assert.doesNotMatch(svg, /<image /);
});

test('minimal data atlas uses a distinct poster composition and serif typography', () => {
  const svg = renderShareCardSvg({
    layout: 'minimal',
    mode: 'data-atlas',
    ratio: '3:4',
    title: '年度训练图谱',
    subtitle: '持续出现',
    metrics: [{ label: '训练天数', value: '74天' }],
    trendPoints: [{ label: '1月', value: 3 }, { label: '2月', value: 5 }],
    trainingDates: ['2026-01-01']
  });
  assert.match(svg, /data-layout="minimal"/);
  assert.match(svg, /Noto Serif CJK SC/);
  assert.match(svg, /M1044 0/);
  assert.doesNotMatch(svg, /部位\/动作分布/);
});

test('annual heatmap cells stay inside their requested width', () => {
  const svg = heatmapCellsSvg({
    trainingDates: ['2026-01-01', '2026-12-31'],
    dailyStats: [{ date: '2026-01-01', volume: 100 }, { date: '2026-12-31', volume: 200 }],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    x: 100,
    y: 40,
    maxWidth: 820,
    cell: 17,
    gap: 8,
    accent: '#D7FF4B',
    text: '#F6F7F2'
  });
  const rightEdges = [...svg.matchAll(/<rect x="([0-9.]+)"[^>]* width="([0-9.]+)"/g)].map((match) => Number(match[1]) + Number(match[2]));
  assert.ok(Math.max(...rightEdges) <= 920);
  assert.equal(Math.max(...rightEdges), 920);
});

test('mini-month heatmap stays inside its panel bounds', () => {
  const svg = yearHeatmapSvg({
    trainingDates: ['2026-01-01', '2026-12-31'],
    startDate: '2026-01-01',
    x: 100,
    y: 40,
    width: 400,
    height: 240,
    accent: '#D7FF4B',
    text: '#F6F7F2'
  });
  const rightEdges = [...svg.matchAll(/<rect x="([0-9.]+)"[^>]* width="([0-9.]+)"/g)].map((match) => Number(match[1]) + Number(match[2]));
  assert.ok(Math.max(...rightEdges) <= 500);
});

test('rich mini-month heatmap is centered inside the right panel', () => {
  const svg = renderShareCardSvg({
    layout: 'rich',
    mode: 'data-atlas',
    ratio: '3:4',
    title: '年度训练图谱',
    metrics: [{ label: '训练日', value: '74' }],
    trainingDates: ['2026-01-01', '2026-12-31']
  });
  const heatmapSection = svg.slice(svg.indexOf('>训练热力</text>'));
  const edges = [...heatmapSection.matchAll(/<rect x="([0-9.]+)"[^>]* width="([0-9.]+)"/g)].map((match) => [Number(match[1]), Number(match[1]) + Number(match[2])]);
  const minX = Math.min(...edges.map(([left]) => left));
  const maxX = Math.max(...edges.map(([, right]) => right));
  const panelX = Math.round(resolveCanvas('3:4').width * 0.53);
  const panelWidth = Math.round(resolveCanvas('3:4').width * 0.39);
  assert.ok(Math.abs((minX + maxX) / 2 - (panelX + panelWidth / 2)) <= 3);
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

test('training heatmap renders a compact calendar with training days highlighted', () => {
  const svg = renderTrainingHeatmapSvg({
    dates: ['2026-07-01', '2026-07-03'],
    startDate: '2026-07-01',
    endDate: '2026-07-07',
    title: '训练日历'
  });
  assert.match(svg, /训练日历/);
  assert.match(svg, /fill="#D7FF4B"/);
  assert.match(svg, /role="img"/);
});

test('training heatmap switches to a bounded year layout for annual ranges', () => {
  const svg = renderTrainingHeatmapSvg({
    dates: ['2026-01-01', '2026-12-31'],
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    title: '年度训练日历'
  });
  assert.match(svg, /data-heatmap="year"/);
  const rects = [...svg.matchAll(/<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g)];
  assert.ok(rects.length >= 365);
  assert.ok(Math.max(...rects.map((match) => Number(match[2]) + Number(match[4]))) <= 260);
});

test('empty heatmaps expose no-data state without inventing dates', () => {
  const svg = renderTrainingHeatmapSvg({ title: '训练日历' });
  assert.match(svg, /data-no-data="true"/);
  assert.doesNotMatch(svg, /2026-01-01/);
  const rich = renderShareCardSvg({ layout: 'rich', mode: 'data-atlas', ratio: '3:4', title: '空数据' });
  assert.match(rich, /data-no-data="true"/);
  assert.doesNotMatch(rich, /2026-01-01/);
});

test('cross-year heatmaps do not silently discard the second year', () => {
  const svg = renderTrainingHeatmapSvg({ startDate: '2025-07-01', endDate: '2026-06-30', dates: ['2025-07-01', '2026-06-30'] });
  assert.match(svg, /data-cross-year="true"/);
});

test('performance chart renders a no-data state without inventing progression', () => {
  const svg = renderPerformanceChartSvg({ title: '主动作表现', points: [] });
  assert.match(svg, /主动作表现/);
  assert.match(svg, /暂无足够的同动作数据/);
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
  assert.doesNotMatch(svg, /data:image/);
});

test('visual report builder returns reusable chart assets from trend data', () => {
  const assets = buildVisualReportAssets({
    trends: {
      weekly: [{ week_start: '2026-07-06', training_days: 2, estimated_volume: 1000 }],
      training_dates: ['2026-01-01', '2026-12-31'],
      daily: [{ date: '2026-01-01', volume: 100 }, { date: '2026-12-31', volume: 800 }],
      date_start: '2026-01-01',
      date_end: '2026-12-31',
      exercise_frequency: [{ name: '肩', count: 4, last_date: '2026-07-28' }]
    }
  });
  assert.deepEqual(assets.map((asset) => asset.name), ['weekly-frequency.svg', 'weekly-volume.svg', 'subject-distribution.svg', 'training-heatmap.svg', 'main-performance.svg']);
  assert.ok(assets.every((asset) => asset.svg.startsWith('<svg')));
  assert.match(assets.find((asset) => asset.name === 'training-heatmap.svg').svg, /data-heatmap="year"/);
});
