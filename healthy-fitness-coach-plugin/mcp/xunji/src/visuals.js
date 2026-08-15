'use strict';

const CANVAS_PRESETS = Object.freeze({
  '1:1': Object.freeze({ ratio: '1:1', width: 2048, height: 2048 }),
  '9:16': Object.freeze({ ratio: '9:16', width: 1440, height: 2560 }),
  '3:4': Object.freeze({ ratio: '3:4', width: 1800, height: 2400 })
});

const DEFAULT_TOKEN = Object.freeze({
  palette: Object.freeze({ bg: '#17191D', accent: '#D7FF4B', secondary: '#7A8BFF', text: '#F6F7F2', muted: '#A9B0AA' }),
  contrast: 'high',
  lighting: 'neutral_soft',
  texture: 'fine_grain',
  composition: 'subject_center_text_top',
  type_pairing: 'condensed_sans_plus_neutral_sans',
  spacing: 'tight_editorial',
  motif: 'thin_measurement_lines',
  edge_rhythm: 'mixed',
  negative_space: 'top',
  visual_facts: Object.freeze([]),
  confidence: 0.5,
  source: 'preset'
});

const COLOR_THEMES = Object.freeze({
  'acid-night': Object.freeze({ id: 'acid-night', label: '酸性夜场', palette: Object.freeze({ bg: '#17191D', accent: '#D7FF4B', secondary: '#7A8BFF', text: '#F6F7F2', muted: '#A9B0AA' }) }),
  'cobalt-coral': Object.freeze({ id: 'cobalt-coral', label: '钴蓝珊瑚', palette: Object.freeze({ bg: '#101A2E', accent: '#5BE7C4', secondary: '#FF8066', text: '#F4F7FF', muted: '#A6B2C8' }) }),
  ultraviolet: Object.freeze({ id: 'ultraviolet', label: '紫外荧光', palette: Object.freeze({ bg: '#1B1636', accent: '#FF6BD6', secondary: '#7EE7FF', text: '#FAF7FF', muted: '#BDB5D8' }) }),
  'paper-ink': Object.freeze({ id: 'paper-ink', label: '纸张黑墨', palette: Object.freeze({ bg: '#F4EFE6', accent: '#E85D4A', secondary: '#2E62D2', text: '#14171A', muted: '#667078' }) }),
  'ember-steel': Object.freeze({ id: 'ember-steel', label: '熔岩钢板', palette: Object.freeze({ bg: '#242424', accent: '#FF8A4C', secondary: '#D5D0C7', text: '#F7F4ED', muted: '#AAA49B' }) })
});

const DESIGN_MODES = Object.freeze([
  Object.freeze({ id: 'abstract-collage', label: '抽象拼贴档案', description: '保留主体照片，并从横线、圆形、留白和主色重构抽象档案面板。', operations: ['photo-crop', 'abstract-panel', 'derived-marks'], recommended: true }),
  Object.freeze({ id: 'training-editorial', label: '训练战报杂志', description: '用多裁切照片、趋势线和注释排版组成运动杂志式战报。', operations: ['contact-sheet', 'data-line', 'annotation-type'] }),
  Object.freeze({ id: 'material-poster', label: '材质化数据海报', description: '复刻照片中的纹理和反光关系，让数据成为主视觉。', operations: ['material-texture', 'photo-anchor', 'oversized-number'] }),
  Object.freeze({ id: 'data-atlas', label: '数据图谱', description: '没有照片时使用热力图、趋势线和部位分布生成完整信息图。', operations: ['atlas-grid', 'trend-line', 'metric-hierarchy'] })
]);

const LAYOUT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'rich', label: '信息图', description: '中文优先的丰富训练复盘：趋势、雷达、热力图、部位/动作分布和指标层级。' }),
  Object.freeze({ id: 'minimal', label: '极简分享图', description: '保留留白和强视觉，只突出一条结论与少量关键数字。' })
]);

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveCanvas(ratio = '3:4') {
  const value = String(ratio);
  if (!CANVAS_PRESETS[value]) throw new TypeError(`unsupported ratio: ${value}`);
  return { ...CANVAS_PRESETS[value] };
}

function hex(value, fallback) {
  const candidate = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(candidate) ? candidate : fallback;
}

function channel(value) {
  const n = parseInt(value, 16);
  return Number.isFinite(n) ? n / 255 : 0;
}

function luminance(value) {
  const color = hex(value, '#000000').slice(1);
  const channels = [0, 2, 4].map((index) => channel(color.slice(index, index + 2))).map((n) => (n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function readableText(background) {
  return luminance(background) > 0.52 ? '#14171A' : '#F6F7F2';
}

function paletteFromSignals(signals = {}) {
  const theme = COLOR_THEMES[signals.theme || signals.palette_name];
  if (theme) return { ...theme.palette };
  const fallback = DEFAULT_TOKEN.palette;
  if (signals.palette && !Array.isArray(signals.palette) && typeof signals.palette === 'object') {
    const source = signals.palette;
    const bg = hex(source.bg, fallback.bg);
    return {
      bg,
      accent: hex(source.accent, fallback.accent),
      secondary: hex(source.secondary, fallback.secondary),
      text: hex(source.text, readableText(bg)),
      muted: hex(source.muted, luminance(bg) > 0.52 ? '#667078' : '#A9B0AA')
    };
  }
  const raw = Array.isArray(signals.palette) ? signals.palette : (Array.isArray(signals.colors) ? signals.colors : []);
  const colors = raw.map((item) => hex(item, '')).filter(Boolean);
  const bg = hex(signals.background || colors[0], fallback.bg);
  const accent = hex(signals.accent || colors[2] || colors[1], fallback.accent);
  const secondary = hex(signals.secondary || colors[1] || colors[2], fallback.secondary);
  const text = hex(signals.text, readableText(bg));
  const muted = hex(signals.muted, luminance(bg) > 0.52 ? '#667078' : '#A9B0AA');
  return { bg, accent, secondary, text, muted };
}

function getColorOptions() {
  return Object.values(COLOR_THEMES).map((theme, index) => ({ ...theme, recommended: index === 0 }));
}

function getLayoutOptions() {
  return LAYOUT_OPTIONS.map((layout, index) => ({ ...layout, recommended: index === 0 }));
}

function createStyleToken(signals = {}) {
  const palette = paletteFromSignals(signals);
  const token = {
    palette,
    contrast: signals.contrast || (signals.luminance === 'high' ? 'soft' : DEFAULT_TOKEN.contrast),
    lighting: signals.lighting || DEFAULT_TOKEN.lighting,
    texture: signals.texture || DEFAULT_TOKEN.texture,
    composition: signals.composition || DEFAULT_TOKEN.composition,
    type_pairing: signals.type_pairing || DEFAULT_TOKEN.type_pairing,
    spacing: signals.spacing || DEFAULT_TOKEN.spacing,
    motif: signals.motif || DEFAULT_TOKEN.motif,
    edge_rhythm: signals.edge_rhythm || DEFAULT_TOKEN.edge_rhythm,
    negative_space: signals.negative_space || DEFAULT_TOKEN.negative_space,
    visual_facts: Array.isArray(signals.visual_facts) ? signals.visual_facts.slice(0, 8) : DEFAULT_TOKEN.visual_facts,
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(signals.confidence)) ? Number(signals.confidence) : (Object.keys(signals).length ? 0.72 : 0.5))),
    source: Object.keys(signals).length ? 'adaptive' : DEFAULT_TOKEN.source
  };
  if (token.contrast === 'high') token.palette.text = readableText(token.palette.bg);
  return token;
}

function getDesignModeOptions({ hasPhoto = false, signals = {} } = {}) {
  if (!hasPhoto) return DESIGN_MODES.filter((mode) => mode.id === 'data-atlas').map((mode) => ({ ...mode, recommended: true, color_options: getColorOptions(), layout_options: getLayoutOptions() }));
  const preferred = signals.composition === 'subject_left_text_right' ? 'training-editorial' : (['paper', 'grain', 'fine_grain'].includes(signals.texture) ? 'material-poster' : 'abstract-collage');
  return DESIGN_MODES.filter((mode) => mode.id !== 'data-atlas').map((mode) => ({ ...mode, recommended: mode.id === preferred }));
}

function overrideStyleToken(token = DEFAULT_TOKEN, overrides = {}) {
  const base = createStyleToken(token);
  const palette = { ...base.palette, ...(overrides.palette || {}) };
  const next = {
    ...base,
    ...overrides,
    palette: {
      bg: hex(palette.bg, base.palette.bg),
      accent: hex(palette.accent, base.palette.accent),
      secondary: hex(palette.secondary, base.palette.secondary),
      text: hex(palette.text, readableText(hex(palette.bg, base.palette.bg))),
      muted: hex(palette.muted, base.palette.muted)
    },
    source: base.source
  };
  return next;
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-CN') : '0';
}

function resolveHeatmapRange(trainingDates = [], startDate, endDate) {
  const sorted = trainingDates.map((date) => String(date).slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const first = String(startDate || sorted[0] || '').slice(0, 10);
  const last = String(endDate || sorted.at(-1) || first).slice(0, 10);
  if (!first) return [];
  const start = new Date(`${first}T00:00:00Z`);
  const end = new Date(`${last}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  if (sameYear) {
    start.setUTCMonth(0, 1);
    end.setUTCMonth(11, 31);
  }
  const days = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86400000)) days.push(cursor.toISOString().slice(0, 10));
  return days;
}

function heatmapCellsSvg({ trainingDates = [], dailyStats = [], startDate, endDate, x = 0, y = 0, cell = 18, gap = 7, columns = 53, accent = '#D7FF4B', text = '#F6F7F2' } = {}) {
  const active = new Set(trainingDates.map((date) => String(date).slice(0, 10)));
  const stats = new Map((Array.isArray(dailyStats) ? dailyStats : []).map((item) => [String(item.date || '').slice(0, 10), item]));
  const days = resolveHeatmapRange(trainingDates, startDate, endDate);
  const max = Math.max(1, ...[...stats.values()].map((item) => Number(item.volume) || Number(item.sets) || Number(item.record_count) || 0));
  return days.map((date, index) => {
    const item = stats.get(date);
    const value = Number(item?.volume) || Number(item?.sets) || (active.has(date) ? 1 : 0);
    const opacity = value > 0 ? (0.22 + 0.78 * Math.min(1, value / max)).toFixed(2) : '0.08';
    const px = x + Math.floor(index / 7) * (cell + gap);
    const py = y + (index % 7) * (cell + gap);
    return `<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="4" fill="${value > 0 ? accent : text}" fill-opacity="${opacity}"><title>${date}${value > 0 ? ` · 训练量 ${number(value)}` : ' · 无记录'}</title></rect>`;
  }).join('');
}

function yearHeatmapSvg({ trainingDates = [], dailyStats = [], startDate, x = 0, y = 0, width = 620, height = 250, accent = '#D7FF4B', text = '#F6F7F2' } = {}) {
  const active = new Set(trainingDates.map((date) => String(date).slice(0, 10)));
  const stats = new Map((Array.isArray(dailyStats) ? dailyStats : []).map((item) => [String(item.date || '').slice(0, 10), item]));
  const max = Math.max(1, ...[...stats.values()].map((item) => Number(item.volume) || Number(item.sets) || Number(item.record_count) || 0));
  const year = Number(String(startDate || [...active][0] || '2026').slice(0, 4)) || 2026;
  const monthW = width / 4;
  const monthH = height / 3;
  const cell = Math.max(6, Math.floor(Math.min((monthW - 22) / 7, (monthH - 25) / 6)));
  const gap = Math.max(2, Math.floor(cell * 0.22));
  const body = [];
  for (let month = 0; month < 12; month += 1) {
    const col = month % 4;
    const row = Math.floor(month / 4);
    const ox = x + col * monthW;
    const oy = y + row * monthH;
    body.push(`<text x="${ox}" y="${oy}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="${Math.max(11, cell)}" fill="${text}" fill-opacity=".68">${String(month + 1).padStart(2, '0')}</text>`);
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    for (let day = 0; day < days; day += 1) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}`;
      const item = stats.get(key);
      const value = Number(item?.volume) || Number(item?.sets) || (active.has(key) ? 1 : 0);
      const opacity = value > 0 ? (0.22 + 0.78 * Math.min(1, value / max)).toFixed(2) : '0.08';
      const position = offset + day;
      const px = ox + (position % 7) * (cell + gap);
      const py = oy + 9 + Math.floor(position / 7) * (cell + gap);
      body.push(`<rect x="${px}" y="${py}" width="${cell}" height="${cell}" rx="${Math.max(1, Math.floor(cell / 4))}" fill="${value > 0 ? accent : text}" fill-opacity="${opacity}"><title>${key}${value > 0 ? ` · 训练量 ${number(value)}` : ' · 无记录'}</title></rect>`);
    }
  }
  return body.join('');
}

function wrapText(text, limit = 18) {
  const value = String(text ?? '');
  if (value.length <= limit) return [value];
  const lines = [];
  for (let index = 0; index < value.length; index += limit) lines.push(value.slice(index, index + limit));
  return lines.slice(0, 3);
}

function textBlock({ text, x, y, size, fill, weight = 400, limit = 18, lineHeight = 1.2, anchor = 'start', family = 'Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif' }) {
  return wrapText(text, limit).map((line, index) => `<text x="${x}" y="${y + index * size * lineHeight}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(line)}</text>`).join('');
}

function renderTrendChartSvg({ points = [], title = '训练趋势', color = '#D7FF4B', width = 900, height = 300 } = {}) {
  const clean = points.map((point) => ({ label: String(point.label ?? ''), value: Math.max(0, Number(point.value) || 0) }));
  const max = Math.max(1, ...clean.map((point) => point.value));
  const plotLeft = 54;
  const plotRight = width - 30;
  const plotTop = 54;
  const plotBottom = height - 48;
  const step = clean.length > 1 ? (plotRight - plotLeft) / (clean.length - 1) : 0;
  const grid = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = plotBottom - (plotBottom - plotTop) * ratio;
    return `<line x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="#FFFFFF" stroke-opacity=".11"/><text x="${plotLeft - 10}" y="${y + 5}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="14" text-anchor="end" fill="#A9B0AA">${number(max * ratio)}</text>`;
  }).join('');
  const line = clean.map((point, index) => {
    const x = plotLeft + step * index;
    const y = plotBottom - (plotBottom - plotTop) * (point.value / max);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const marks = clean.map((point, index) => {
    const x = plotLeft + step * index;
    const y = plotBottom - (plotBottom - plotTop) * (point.value / max);
    return `<circle cx="${x}" cy="${y}" r="6" fill="${hex(color, '#D7FF4B')}"/><text x="${x}" y="${height - 18}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="14" text-anchor="middle" fill="#A9B0AA">${escapeXml(point.label)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" rx="28" fill="#17191D"/>${textBlock({ text: title, x: 36, y: 34, size: 20, fill: '#F6F7F2', weight: 700, limit: 48 })}${grid}<path d="${line}" fill="none" stroke="${hex(color, '#D7FF4B')}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${marks}</svg>`;
}

function renderCategoryChartSvg({ items = [], title = '分类分布', color = '#7A8BFF', width = 900, height = 360 } = {}) {
  const clean = items.map((item) => ({ label: String(item.label ?? item.name ?? ''), value: Math.max(0, Number(item.value ?? item.count) || 0) })).slice(0, 12);
  const max = Math.max(1, ...clean.map((item) => item.value));
  const barLeft = 220;
  const barRight = width - 46;
  const rowHeight = Math.max(28, Math.floor((height - 76) / Math.max(1, clean.length)));
  const bars = clean.map((item, index) => {
    const y = 66 + index * rowHeight;
    const barWidth = Math.max(4, ((barRight - barLeft) * item.value) / max);
    return `<text x="${barLeft - 16}" y="${y + 20}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="16" text-anchor="end" fill="#F6F7F2">${escapeXml(item.label)}</text><rect x="${barLeft}" y="${y}" width="${barRight - barLeft}" height="18" rx="9" fill="#FFFFFF" fill-opacity=".1"/><rect x="${barLeft}" y="${y}" width="${barWidth}" height="18" rx="9" fill="${hex(color, '#7A8BFF')}"/><text x="${Math.min(barRight + 4, barLeft + barWidth + 12)}" y="${y + 15}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="15" fill="#A9B0AA">${number(item.value)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" rx="28" fill="#17191D"/>${textBlock({ text: title, x: 36, y: 36, size: 20, fill: '#F6F7F2', weight: 700, limit: 48 })}${bars}</svg>`;
}

function renderTrainingHeatmapSvg({ dates = [], startDate, endDate, title = '训练日历', width = 420, height = 260 } = {}) {
  const active = new Set(dates.map((date) => String(date).slice(0, 10)));
  const sorted = [...active].sort();
  const start = new Date(`${(startDate || sorted[0] || '2026-01-01')}T00:00:00Z`);
  const end = new Date(`${(endDate || sorted.at(-1) || startDate || '2026-01-07')}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" rx="28" fill="#17191D"/>${textBlock({ text: title, x: 24, y: 32, size: 18, fill: '#F6F7F2', weight: 700 })}</svg>`;
  const day = (value) => value === 0 ? 6 : value - 1;
  const firstDay = day(start.getUTCDay());
  const totalDays = Math.floor((end - start) / 86400000) + 1;
  const rows = Math.ceil((firstDay + totalDays) / 7);
  const cell = 30;
  const left = 52;
  const top = 66;
  const labels = ['一', '二', '三', '四', '五', '六', '日'].map((label, index) => `<text x="${left + index * cell + 10}" y="${top - 16}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="13" text-anchor="middle" fill="#A9B0AA">${label}</text>`).join('');
  const cells = [];
  for (let index = 0; index < totalDays; index += 1) {
    const date = new Date(start.getTime() + index * 86400000);
    const position = firstDay + index;
    const x = left + (position % 7) * cell;
    const y = top + Math.floor(position / 7) * cell;
    const dateKey = date.toISOString().slice(0, 10);
    const isActive = active.has(dateKey);
    cells.push(`<rect x="${x}" y="${y}" width="20" height="20" rx="6" fill="${isActive ? '#D7FF4B' : '#FFFFFF'}" fill-opacity="${isActive ? '1' : '.10'}"><title>${dateKey}${isActive ? ' · 训练' : ' · 无记录'}</title></rect>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" rx="28" fill="#17191D"/>${textBlock({ text: title, x: 24, y: 34, size: 20, fill: '#F6F7F2', weight: 700, limit: 48 })}${labels}${cells.join('')}</svg>`;
}

function renderPerformanceChartSvg({ points = [], title = '主动作表现', color = '#FF8066', width = 900, height = 300 } = {}) {
  if (!Array.isArray(points) || points.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" rx="28" fill="#17191D"/>${textBlock({ text: title, x: 36, y: 54, size: 22, fill: '#F6F7F2', weight: 700, limit: 48 })}${textBlock({ text: '暂无足够的同动作数据', x: width / 2, y: height / 2 + 8, size: 20, fill: '#A9B0AA', anchor: 'middle', limit: 48 })}</svg>`;
  }
  return renderTrendChartSvg({ points, title, color, width, height });
}

function safePhotoHref(photoHref, embedPhoto) {
  return embedPhoto === true && /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(String(photoHref)) ? photoHref : '';
}

function renderAbstractCollageSvg({ canvas, token, eyebrow, title, subtitle, metrics, footer, photoHref, embedPhoto }) {
  const { bg, accent, secondary, text, muted } = token.palette;
  const pad = Math.round(canvas.width * 0.1);
  const photoWidth = canvas.width - pad * 2;
  const photoTop = Math.round(canvas.height * 0.11);
  const photoHeight = Math.round(canvas.height * 0.31);
  const panelTop = Math.round(canvas.height * 0.46);
  const safePhoto = safePhotoHref(photoHref, embedPhoto);
  const photo = safePhoto
    ? `<image href="${safePhoto}" x="${pad}" y="${photoTop}" width="${photoWidth}" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" opacity=".9"/><rect x="${pad}" y="${photoTop}" width="${photoWidth}" height="${photoHeight}" fill="${bg}" fill-opacity=".24"/>`
    : `<rect x="${pad}" y="${photoTop}" width="${photoWidth}" height="${photoHeight}" fill="${accent}" fill-opacity=".08" stroke="${accent}" stroke-opacity=".35"/><path d="M${pad + 32},${photoTop + photoHeight * 0.72} H${pad + photoWidth * 0.42} L${pad + photoWidth * 0.60},${photoTop + photoHeight * 0.28} L${pad + photoWidth * 0.86},${photoTop + photoHeight * 0.64}" fill="none" stroke="${accent}" stroke-width="6" stroke-opacity=".8"/>`;
  const abstract = `<g id="abstract-panel"><rect x="${pad}" y="${panelTop}" width="${photoWidth}" height="${Math.round(canvas.height * 0.27)}" fill="${text}" fill-opacity=".05"/><path class="derived-mark" d="M${pad} ${panelTop + 48} H${pad + photoWidth * 0.72}" stroke="${accent}" stroke-width="8"/><path class="derived-mark" d="M${pad + photoWidth * 0.12} ${panelTop + 112} H${pad + photoWidth * 0.92}" stroke="${secondary}" stroke-width="3" stroke-opacity=".8"/><circle class="derived-mark" cx="${pad + photoWidth * 0.84}" cy="${panelTop + 150}" r="${Math.round(photoWidth * 0.075)}" fill="${accent}" fill-opacity=".72"/><rect class="derived-mark" x="${pad + photoWidth * 0.22}" y="${panelTop + 180}" width="${Math.round(photoWidth * 0.44)}" height="18" fill="${secondary}" fill-opacity=".72"/></g>`;
  const metricLines = metrics.slice(0, 4).map((metric, index) => {
    const y = panelTop + 260 + index * 58;
    return `<line x1="${pad}" y1="${y}" x2="${pad + photoWidth}" y2="${y}" stroke="${text}" stroke-opacity=".18"/><text x="${pad}" y="${y + 34}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="18" fill="${muted}">${escapeXml(metric.label)}</text><text x="${pad + photoWidth}" y="${y + 34}" text-anchor="end" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="28" font-weight="800" fill="${text}">${escapeXml(metric.value)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" data-mode="abstract-collage" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" fill="${bg}"/><circle cx="${canvas.width * 0.92}" cy="${canvas.height * 0.1}" r="${canvas.width * 0.22}" fill="${accent}" fill-opacity=".09"/>${photo}<text x="${pad}" y="${Math.round(canvas.height * 0.065)}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="18" letter-spacing="3" fill="${accent}">${escapeXml(eyebrow)}</text>${abstract}${textBlock({ text: title, x: pad, y: Math.round(canvas.height * 0.43), size: canvas.ratio === '1:1' ? 68 : 82, fill: text, weight: 800, limit: canvas.ratio === '9:16' ? 15 : 18, lineHeight: 1.08 })}${textBlock({ text: subtitle, x: pad, y: Math.round(canvas.height * 0.475), size: 24, fill: muted, limit: 34 })}${metricLines}<line x1="${pad}" y1="${canvas.height - pad * 1.8}" x2="${canvas.width - pad}" y2="${canvas.height - pad * 1.8}" stroke="${accent}" stroke-opacity=".7" stroke-width="3"/><text x="${pad}" y="${canvas.height - pad * 0.95}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="16" letter-spacing="2" fill="${muted}">${escapeXml(footer)}</text></svg>`;
}

function renderTrainingEditorialSvg({ canvas, token, eyebrow, title, subtitle, metrics, footer, photoHref, embedPhoto, trendPoints = [] }) {
  const { bg, accent, secondary, text, muted } = token.palette;
  const pad = Math.round(canvas.width * 0.08);
  const photoWidth = Math.round(canvas.width * 0.25);
  const photoTop = Math.round(canvas.height * 0.1);
  const photoHeight = Math.round(canvas.height * 0.37);
  const safePhoto = safePhotoHref(photoHref, embedPhoto);
  const strips = [0, 1, 2].map((index) => {
    const x = pad + index * (photoWidth + Math.round(pad * 0.45));
    const y = photoTop + (index % 2) * Math.round(canvas.height * 0.025);
    const crop = safePhoto ? `<image href="${safePhoto}" x="${x}" y="${y}" width="${photoWidth}" height="${photoHeight - index * 70}" preserveAspectRatio="xMidYMid slice" opacity="${0.92 - index * 0.1}"/>` : `<rect x="${x}" y="${y}" width="${photoWidth}" height="${photoHeight - index * 70}" fill="${index === 1 ? secondary : accent}" fill-opacity=".16"/>`;
    return `<g class="contact-strip">${crop}<rect x="${x}" y="${y}" width="${photoWidth}" height="${photoHeight - index * 70}" fill="none" stroke="${text}" stroke-opacity=".22" stroke-width="2"/></g>`;
  }).join('');
  const values = trendPoints.map((point) => Number(point.value) || 0);
  const max = Math.max(1, ...values);
  const line = trendPoints.map((point, index) => {
    const x = pad + index * ((canvas.width - pad * 2) / Math.max(1, trendPoints.length - 1));
    const y = Math.round(canvas.height * 0.72 - (canvas.height * 0.14) * ((Number(point.value) || 0) / max));
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y}`;
  }).join(' ');
  const dataLine = trendPoints.length ? `<path class="data-line" d="${line}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  const notes = metrics.slice(0, 4).map((metric, index) => `<text x="${pad + (index % 2) * (canvas.width * 0.47)}" y="${Math.round(canvas.height * 0.79) + Math.floor(index / 2) * 60}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="18" fill="${muted}">${escapeXml(metric.label)} <tspan fill="${text}" font-weight="800">${escapeXml(metric.value)}</tspan></text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" data-mode="training-editorial" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" fill="${bg}"/>${strips}<text x="${pad}" y="${Math.round(canvas.height * 0.57)}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="18" letter-spacing="3" fill="${accent}">${escapeXml(eyebrow)}</text>${textBlock({ text: title, x: pad, y: Math.round(canvas.height * 0.63), size: canvas.ratio === '1:1' ? 66 : 78, fill: text, weight: 800, limit: 20 })}${textBlock({ text: subtitle, x: pad, y: Math.round(canvas.height * 0.68), size: 22, fill: muted, limit: 38 })}${dataLine}${notes}<line x1="${pad}" y1="${canvas.height - pad * 1.6}" x2="${canvas.width - pad}" y2="${canvas.height - pad * 1.6}" stroke="${secondary}" stroke-opacity=".7" stroke-width="3"/><text x="${pad}" y="${canvas.height - pad * 0.85}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="16" letter-spacing="2" fill="${muted}">${escapeXml(footer)}</text></svg>`;
}

function renderMaterialPosterSvg({ canvas, token, eyebrow, title, subtitle, metrics, footer, photoHref, embedPhoto }) {
  const { bg, accent, secondary, text, muted } = token.palette;
  const pad = Math.round(canvas.width * 0.1);
  const safePhoto = safePhotoHref(photoHref, embedPhoto);
  const anchor = safePhoto ? `<clipPath id="photo-anchor"><circle cx="${canvas.width * 0.76}" cy="${canvas.height * 0.23}" r="${canvas.width * 0.18}"/></clipPath><image href="${safePhoto}" x="${canvas.width * 0.58}" y="${canvas.height * 0.05}" width="${canvas.width * 0.36}" height="${canvas.width * 0.36}" clip-path="url(#photo-anchor)" preserveAspectRatio="xMidYMid slice" opacity=".86"/>` : `<circle cx="${canvas.width * 0.76}" cy="${canvas.height * 0.23}" r="${canvas.width * 0.18}" fill="${secondary}" fill-opacity=".26"/>`;
  const rows = metrics.slice(0, 5).map((metric, index) => { const y = Math.round(canvas.height * 0.59) + index * 66; return `<text x="${pad}" y="${y}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="18" fill="${muted}">${escapeXml(metric.label)}</text><text x="${canvas.width - pad}" y="${y}" text-anchor="end" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="30" font-weight="800" fill="${text}">${escapeXml(metric.value)}</text><line x1="${pad}" y1="${y + 20}" x2="${canvas.width - pad}" y2="${y + 20}" stroke="${text}" stroke-opacity=".16"/>`; }).join('');
  const patternBody = token.edge_rhythm === 'vertical'
    ? `<path d="M7 0 V28 M21 0 V28" stroke="${secondary}" stroke-opacity=".12" stroke-width="2"/>`
    : token.edge_rhythm === 'horizontal'
      ? `<path d="M0 7 H28 M0 21 H28" stroke="${secondary}" stroke-opacity=".12" stroke-width="2"/>`
      : `<circle cx="4" cy="6" r="1.2" fill="${text}" fill-opacity=".14"/><path d="M0 22 L28 4" stroke="${secondary}" stroke-opacity=".10" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" data-mode="material-poster" data-texture="${escapeXml(token.texture)}" data-edge-rhythm="${escapeXml(token.edge_rhythm)}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><defs><pattern id="material-texture" width="28" height="28" patternUnits="userSpaceOnUse">${patternBody}</pattern></defs><rect width="100%" height="100%" fill="${bg}"/><rect width="100%" height="100%" fill="url(#material-texture)"/><circle cx="${canvas.width * 0.14}" cy="${canvas.height * 0.82}" r="${canvas.width * 0.28}" fill="${accent}" fill-opacity=".1"/>${anchor}<text x="${pad}" y="${Math.round(canvas.height * 0.12)}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="18" letter-spacing="3" fill="${accent}">${escapeXml(eyebrow)}</text>${textBlock({ text: title, x: pad, y: Math.round(canvas.height * 0.35), size: canvas.ratio === '1:1' ? 70 : 84, fill: text, weight: 800, limit: 18 })}${textBlock({ text: subtitle, x: pad, y: Math.round(canvas.height * 0.43), size: 24, fill: muted, limit: 32 })}<text x="${pad}" y="${Math.round(canvas.height * 0.52)}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="68" font-weight="800" fill="${accent}">01</text>${rows}<text x="${pad}" y="${canvas.height - pad * 0.8}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif" font-size="16" letter-spacing="2" fill="${muted}">${escapeXml(footer)}</text></svg>`;
}

function renderDataAtlasSvg({ canvas, token, eyebrow, title, subtitle, metrics, footer, trendPoints = [], trainingDates = [], dailyStats = [], dateStart, dateEnd }) {
  const { accent, secondary, text, muted } = token.palette;
  const bg = '#0E1117';
  const paper = '#F4F1EA';
  const pad = Math.round(canvas.width * 0.09);
  const serif = 'Noto Serif CJK SC, Source Han Serif SC, SimSun, STSong, serif';
  const sans = 'Inter, Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif';
  const values = trendPoints.map((point) => Math.max(0, Number(point.value) || 0));
  const max = Math.max(1, ...values);
  const chartTop = Math.round(canvas.height * 0.53);
  const chartBottom = Math.round(canvas.height * 0.72);
  const chartLeft = pad;
  const chartRight = canvas.width - pad;
  const line = trendPoints.map((point, index) => `${index ? 'L' : 'M'}${chartLeft + index * ((chartRight - chartLeft) / Math.max(1, trendPoints.length - 1))},${chartBottom - (chartBottom - chartTop) * ((Number(point.value) || 0) / max)}`).join(' ');
  const cells = heatmapCellsSvg({ trainingDates, dailyStats, startDate: dateStart, endDate: dateEnd, x: pad * 1.35, y: Math.round(canvas.height * 0.77), cell: 17, gap: 8, accent, text });
  const value = metrics[0]?.value || '0';
  const label = metrics[0]?.label || '训练日';
  const otherMetrics = metrics.slice(1, 3).map((metric, index) => `<text x="${pad + index * Math.round(canvas.width * 0.29)}" y="${Math.round(canvas.height * 0.875)}" font-family="${sans}" font-size="16" fill="#8E98A8">${escapeXml(metric.label)}</text><text x="${pad + index * Math.round(canvas.width * 0.29)}" y="${Math.round(canvas.height * 0.915)}" font-family="${sans}" font-size="28" font-weight="700" fill="${paper}">${escapeXml(metric.value)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" data-mode="data-atlas" data-layout="minimal" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" fill="${bg}"/><path d="M${canvas.width * 0.58} 0 L${canvas.width} ${canvas.height * 0.26}" stroke="${accent}" stroke-opacity=".18" stroke-width="${canvas.width * 0.18}"/><path d="M0 ${canvas.height * 0.79} L${canvas.width * 0.42} ${canvas.height}" stroke="${secondary}" stroke-opacity=".16" stroke-width="${canvas.width * 0.12}"/><text x="${pad}" y="${Math.round(canvas.height * 0.09)}" font-family="${sans}" font-size="16" letter-spacing="4" fill="${accent}">${escapeXml(eyebrow)}</text><text x="${canvas.width - pad}" y="${Math.round(canvas.height * 0.09)}" text-anchor="end" font-family="${sans}" font-size="14" letter-spacing="2" fill="#8E98A8">01 / TRAINING LOG</text>${textBlock({ text: title, x: pad, y: Math.round(canvas.height * 0.22), size: canvas.ratio === '1:1' ? 72 : 92, fill: paper, weight: 500, limit: 12, family: serif, lineHeight: 1.08 })}${textBlock({ text: subtitle, x: pad, y: Math.round(canvas.height * 0.35), size: 20, fill: '#8E98A8', limit: 36, family: sans })}<line class="atlas-grid" x1="${pad}" y1="${Math.round(canvas.height * 0.43)}" x2="${canvas.width - pad}" y2="${Math.round(canvas.height * 0.43)}" stroke="#FFFFFF" stroke-opacity=".18"/><text x="${pad}" y="${Math.round(canvas.height * 0.49)}" font-family="${sans}" font-size="15" letter-spacing="2" fill="#8E98A8">${escapeXml(label).toUpperCase()}</text><text x="${pad}" y="${Math.round(canvas.height * 0.62)}" font-family="${serif}" font-size="${canvas.ratio === '1:1' ? 120 : 170}" fill="${accent}">${escapeXml(value)}</text><path class="data-line" d="${line}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>${trendPoints.map((point, index) => { const x = chartLeft + index * ((chartRight - chartLeft) / Math.max(1, trendPoints.length - 1)); const y = chartBottom - (chartBottom - chartTop) * ((Number(point.value) || 0) / max); return `<circle cx="${x}" cy="${y}" r="5" fill="${bg}" stroke="${accent}" stroke-width="3"/>`; }).join('')}${cells}<text x="${pad}" y="${Math.round(canvas.height * 0.76)}" font-family="${sans}" font-size="14" letter-spacing="2" fill="#8E98A8">CONSISTENCY MAP / ${trainingDates.length || 0} DAYS</text>${otherMetrics}<line x1="${pad}" y1="${Math.round(canvas.height * 0.94)}" x2="${canvas.width - pad}" y2="${Math.round(canvas.height * 0.94)}" stroke="${accent}" stroke-opacity=".6" stroke-width="2"/><text x="${pad}" y="${canvas.height - pad * 0.45}" font-family="${sans}" font-size="13" letter-spacing="3" fill="#8E98A8">${escapeXml(footer)}</text></svg>`;
}

function renderRichInfographicSvg({ canvas, token, eyebrow, title, subtitle, metrics, footer, trendPoints = [], trainingDates = [], dailyStats = [], dateStart, dateEnd, bodyDistribution = [] }) {
  const { bg, accent, secondary, text, muted } = token.palette;
  const serif = 'Noto Serif CJK SC, Source Han Serif SC, SimSun, STSong, serif';
  const sans = 'Inter, Microsoft YaHei, Noto Sans CJK SC, PingFang SC, Arial, sans-serif';
  const pad = Math.round(canvas.width * 0.08);
  const contentWidth = canvas.width - pad * 2;
  const values = trendPoints.map((point) => Math.max(0, Number(point.value) || 0));
  const max = Math.max(1, ...values);
  const trendLeft = pad + 30;
  const trendRight = canvas.width - pad - 30;
  const trendTop = Math.round(canvas.height * 0.32);
  const trendBottom = Math.round(canvas.height * 0.48);
  const trendLine = trendPoints.map((point, index) => {
    const x = trendLeft + index * ((trendRight - trendLeft) / Math.max(1, trendPoints.length - 1));
    const y = trendBottom - (trendBottom - trendTop) * ((Number(point.value) || 0) / max);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const trend = `<rect x="${pad}" y="${Math.round(canvas.height * 0.29)}" width="${contentWidth}" height="${Math.round(canvas.height * 0.24)}" rx="18" fill="${text}" fill-opacity=".035" stroke="${text}" stroke-opacity=".22" stroke-width="2"/><text x="${pad + 28}" y="${Math.round(canvas.height * 0.33)}" font-family="${serif}" font-size="24" fill="${text}">训练频率趋势</text>${[0.25, 0.5, 0.75, 1].map((ratio) => { const y = trendBottom - (trendBottom - trendTop) * ratio; return `<line x1="${trendLeft}" y1="${y}" x2="${trendRight}" y2="${y}" stroke="${text}" stroke-opacity=".12"/>`; }).join('')}<path d="${trendLine}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>${trendPoints.map((point, index) => { const x = trendLeft + index * ((trendRight - trendLeft) / Math.max(1, trendPoints.length - 1)); const y = trendBottom - (trendBottom - trendTop) * ((Number(point.value) || 0) / max); return `<circle cx="${x}" cy="${y}" r="7" fill="${accent}" stroke="${bg}" stroke-width="3"/>`; }).join('')}`;
  const radarItems = bodyDistribution.slice(0, 6);
  const radarLabels = radarItems.length ? radarItems : [{ label: '暂无数据', value: 0 }];
  const radarMax = Math.max(1, ...radarLabels.map((item) => Number(item.value) || 0));
  const cx = Math.round(canvas.width * 0.27);
  const cy = Math.round(canvas.height * 0.68);
  const radius = Math.round(canvas.width * 0.16);
  const n = radarLabels.length;
  const point = (index, scale) => { const angle = (-Math.PI / 2) + (Math.PI * 2 * index / n); return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale]; };
  const radarGrid = [0.33, 0.66, 1].map((scale) => `<polygon points="${radarLabels.map((_, index) => point(index, scale).join(',')).join(' ')}" fill="none" stroke="${text}" stroke-opacity=".16"/>`).join('');
  const radarAxes = radarLabels.map((_, index) => { const [x, y] = point(index, 1); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${text}" stroke-opacity=".14"/>`; }).join('');
  const radarShape = `<polygon points="${radarLabels.map((item, index) => point(index, Math.max(0.08, (Number(item.value) || 0) / radarMax)).join(',')).join(' ')}" fill="${accent}" fill-opacity=".26" stroke="${accent}" stroke-width="5"/>`;
  const radarText = radarLabels.map((item, index) => { const [x, y] = point(index, 1.18); return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, sans-serif" font-size="18" fill="${muted}">${escapeXml(item.label)}</text>`; }).join('');
  const radar = `<rect x="${pad}" y="${Math.round(canvas.height * 0.56)}" width="${Math.round(canvas.width * 0.42)}" height="${Math.round(canvas.height * 0.32)}" rx="18" fill="${text}" fill-opacity=".035" stroke="${text}" stroke-opacity=".22" stroke-width="2"/><text x="${pad + 28}" y="${Math.round(canvas.height * 0.60)}" font-family="${serif}" font-size="24" fill="${text}">部位/动作分布</text>${radarGrid}${radarAxes}${radarShape}${radarText}`;
  const cells = yearHeatmapSvg({ trainingDates, dailyStats, startDate: dateStart, x: Math.round(canvas.width * 0.57), y: Math.round(canvas.height * 0.63), width: Math.round(canvas.width * 0.34), height: Math.round(canvas.height * 0.23), accent, text });
  const heatmap = `<rect x="${Math.round(canvas.width * 0.53)}" y="${Math.round(canvas.height * 0.56)}" width="${Math.round(canvas.width * 0.39)}" height="${Math.round(canvas.height * 0.32)}" rx="18" fill="${text}" fill-opacity=".035" stroke="${text}" stroke-opacity=".22" stroke-width="2"/><text x="${Math.round(canvas.width * 0.57)}" y="${Math.round(canvas.height * 0.60)}" font-family="${serif}" font-size="24" fill="${text}">训练热力</text>${cells}`;
  const rows = metrics.slice(0, 4).map((metric, index) => { const x = pad + (index % 2) * Math.round(contentWidth * 0.51); const y = Math.round(canvas.height * 0.22) + Math.floor(index / 2) * 66; return `<text x="${x}" y="${y}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, sans-serif" font-size="17" fill="${muted}">${escapeXml(metric.label)}</text><text x="${x}" y="${y + 34}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, sans-serif" font-size="32" font-weight="800" fill="${text}">${escapeXml(metric.value)}</text>`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" data-layout="rich" data-mode="data-atlas" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" fill="${bg}"/><text x="${pad}" y="${Math.round(canvas.height * 0.08)}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, sans-serif" font-size="20" letter-spacing="3" fill="${accent}">${escapeXml(eyebrow)}</text>${textBlock({ text: title, x: pad, y: Math.round(canvas.height * 0.15), size: canvas.ratio === '1:1' ? 58 : 72, fill: text, weight: 800, limit: 20, family: 'Noto Serif CJK SC, Source Han Serif SC, SimSun, STSong, serif', lineHeight: 1.16 })}${textBlock({ text: subtitle, x: pad, y: Math.round(canvas.height * 0.19), size: 22, fill: muted, limit: 40, family: 'Noto Serif CJK SC, Source Han Serif SC, SimSun, STSong, serif' })}${rows}${trend}${radar}${heatmap}<line x1="${pad}" y1="${canvas.height - pad * 1.6}" x2="${canvas.width - pad}" y2="${canvas.height - pad * 1.6}" stroke="${accent}" stroke-opacity=".6" stroke-width="3"/><text x="${pad}" y="${canvas.height - pad * 0.8}" font-family="Microsoft YaHei, Noto Sans CJK SC, PingFang SC, sans-serif" font-size="16" letter-spacing="2" fill="${muted}">${escapeXml(footer)}</text></svg>`;
}

function renderShareCardSvg({ mode, layout = 'minimal', ratio = '3:4', styleToken = createStyleToken(), eyebrow = '', title = '', subtitle = '', metrics = [], footer = 'HEALTHY FITNESS COACH', photoHref = '', embedPhoto = false, trendPoints = [], trainingDates = [], dailyStats = [], dateStart, dateEnd, bodyDistribution = [] } = {}) {
  const canvas = resolveCanvas(ratio);
  const token = overrideStyleToken(styleToken);
  const selected = mode || (embedPhoto && photoHref ? 'abstract-collage' : 'data-atlas');
  const input = { canvas, token, eyebrow, title, subtitle, metrics, footer, photoHref, embedPhoto, trendPoints, trainingDates, dailyStats, dateStart, dateEnd, bodyDistribution };
  if (layout === 'rich' && selected === 'data-atlas') return renderRichInfographicSvg(input);
  if (selected === 'training-editorial') return renderTrainingEditorialSvg(input);
  if (selected === 'material-poster') return renderMaterialPosterSvg(input);
  if (selected === 'data-atlas') return renderDataAtlasSvg(input);
  return renderAbstractCollageSvg(input);
}

module.exports = {
  CANVAS_PRESETS,
  createStyleToken,
  escapeXml,
  getColorOptions,
  getDesignModeOptions,
  getLayoutOptions,
  heatmapCellsSvg,
  yearHeatmapSvg,
  overrideStyleToken,
  renderCategoryChartSvg,
  renderPerformanceChartSvg,
  renderTrainingHeatmapSvg,
  renderShareCardSvg,
  renderTrendChartSvg,
  resolveCanvas
};
