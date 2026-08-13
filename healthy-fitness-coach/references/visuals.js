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
  confidence: 0.5,
  source: 'preset'
});

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
  const fallback = DEFAULT_TOKEN.palette;
  const raw = Array.isArray(signals.palette) ? signals.palette : (Array.isArray(signals.colors) ? signals.colors : []);
  const colors = raw.map((item) => hex(item, '')).filter(Boolean);
  const bg = hex(signals.background || colors[0], fallback.bg);
  const accent = hex(signals.accent || colors[2] || colors[1], fallback.accent);
  const secondary = hex(signals.secondary || colors[1] || colors[2], fallback.secondary);
  const text = hex(signals.text, readableText(bg));
  const muted = hex(signals.muted, luminance(bg) > 0.52 ? '#667078' : '#A9B0AA');
  return { bg, accent, secondary, text, muted };
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
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(signals.confidence)) ? Number(signals.confidence) : (Object.keys(signals).length ? 0.72 : 0.5))),
    source: Object.keys(signals).length ? 'adaptive' : DEFAULT_TOKEN.source
  };
  if (token.contrast === 'high') token.palette.text = readableText(token.palette.bg);
  return token;
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

function wrapText(text, limit = 18) {
  const value = String(text ?? '');
  if (value.length <= limit) return [value];
  const lines = [];
  for (let index = 0; index < value.length; index += limit) lines.push(value.slice(index, index + limit));
  return lines.slice(0, 3);
}

function textBlock({ text, x, y, size, fill, weight = 400, limit = 18, lineHeight = 1.2, anchor = 'start', family = 'Arial, Microsoft YaHei, sans-serif' }) {
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
    return `<line x1="${plotLeft}" y1="${y}" x2="${plotRight}" y2="${y}" stroke="#FFFFFF" stroke-opacity=".11"/><text x="${plotLeft - 10}" y="${y + 5}" font-family="Arial, sans-serif" font-size="14" text-anchor="end" fill="#A9B0AA">${number(max * ratio)}</text>`;
  }).join('');
  const line = clean.map((point, index) => {
    const x = plotLeft + step * index;
    const y = plotBottom - (plotBottom - plotTop) * (point.value / max);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const marks = clean.map((point, index) => {
    const x = plotLeft + step * index;
    const y = plotBottom - (plotBottom - plotTop) * (point.value / max);
    return `<circle cx="${x}" cy="${y}" r="6" fill="${hex(color, '#D7FF4B')}"/><text x="${x}" y="${height - 18}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="14" text-anchor="middle" fill="#A9B0AA">${escapeXml(point.label)}</text>`;
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
    return `<text x="${barLeft - 16}" y="${y + 20}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="16" text-anchor="end" fill="#F6F7F2">${escapeXml(item.label)}</text><rect x="${barLeft}" y="${y}" width="${barRight - barLeft}" height="18" rx="9" fill="#FFFFFF" fill-opacity=".1"/><rect x="${barLeft}" y="${y}" width="${barWidth}" height="18" rx="9" fill="${hex(color, '#7A8BFF')}"/><text x="${Math.min(barRight + 4, barLeft + barWidth + 12)}" y="${y + 15}" font-family="Arial, sans-serif" font-size="15" fill="#A9B0AA">${number(item.value)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title><rect width="100%" height="100%" rx="28" fill="#17191D"/>${textBlock({ text: title, x: 36, y: 36, size: 20, fill: '#F6F7F2', weight: 700, limit: 48 })}${bars}</svg>`;
}

function renderShareCardSvg({ ratio = '3:4', styleToken = createStyleToken(), eyebrow = '', title = '', subtitle = '', metrics = [], footer = 'HEALTHY FITNESS COACH', photoHref = '' } = {}) {
  const canvas = resolveCanvas(ratio);
  const token = overrideStyleToken(styleToken);
  const { bg, accent, secondary, text, muted } = token.palette;
  const pad = Math.round(canvas.width * (token.spacing === 'airy' ? 0.1 : 0.075));
  const cardWidth = canvas.width - pad * 2;
  const metricCols = canvas.ratio === '1:1' ? Math.min(3, Math.max(1, metrics.length)) : 2;
  const metricGap = Math.round(pad * 0.35);
  const metricWidth = Math.floor((cardWidth - metricGap * (metricCols - 1)) / metricCols);
  const metricStart = Math.round(canvas.height * (canvas.ratio === '1:1' ? 0.58 : 0.55));
  const safePhoto = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(String(photoHref)) ? photoHref : '';
  const background = `<rect width="100%" height="100%" fill="${bg}"/>`;
  const glow = `<circle cx="${canvas.width * 0.84}" cy="${canvas.height * 0.12}" r="${canvas.width * 0.28}" fill="${accent}" fill-opacity=".09"/><circle cx="${canvas.width * 0.18}" cy="${canvas.height * 0.87}" r="${canvas.width * 0.22}" fill="${secondary}" fill-opacity=".12"/>`;
  const image = safePhoto ? `<image href="${safePhoto}" x="${pad}" y="${pad * 1.8}" width="${cardWidth}" height="${Math.round(canvas.height * 0.34)}" preserveAspectRatio="xMidYMid slice" opacity=".82"/><rect x="${pad}" y="${pad * 1.8}" width="${cardWidth}" height="${Math.round(canvas.height * 0.34)}" fill="${bg}" fill-opacity=".32"/>` : `<rect x="${pad}" y="${pad * 1.8}" width="${cardWidth}" height="${Math.round(canvas.height * 0.34)}" rx="36" fill="${accent}" fill-opacity=".08" stroke="${accent}" stroke-opacity=".28"/><path d="M${pad * 1.7},${pad * 3.7} L${pad * 3.4},${pad * 2.7} L${pad * 5.2},${pad * 4.8} L${pad * 7.2},${pad * 2.3}" fill="none" stroke="${accent}" stroke-width="5" stroke-opacity=".65"/>`;
  const metricsSvg = metrics.map((metric, index) => {
    const row = Math.floor(index / metricCols);
    const col = index % metricCols;
    const x = pad + col * (metricWidth + metricGap);
    const y = metricStart + row * (Math.round(canvas.height * 0.115));
    return `<g><rect x="${x}" y="${y}" width="${metricWidth}" height="${Math.round(canvas.height * 0.095)}" rx="24" fill="${text}" fill-opacity=".06" stroke="${text}" stroke-opacity=".12"/><text x="${x + 26}" y="${y + 38}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="18" fill="${muted}">${escapeXml(metric.label)}</text><text x="${x + 26}" y="${y + 82}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="38" font-weight="800" fill="${text}">${escapeXml(metric.value)}</text></g>`;
  }).join('');
  const motif = `<path d="M${pad} ${canvas.height - pad * 1.8} H${canvas.width - pad}" stroke="${accent}" stroke-opacity=".65" stroke-width="3"/><circle cx="${canvas.width - pad}" cy="${canvas.height - pad * 1.8}" r="8" fill="${accent}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>${background}${glow}${image}<text x="${pad}" y="${pad}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="18" letter-spacing="3" fill="${accent}">${escapeXml(eyebrow)}</text>${textBlock({ text: title, x: pad, y: Math.round(canvas.height * 0.46), size: canvas.ratio === '1:1' ? 72 : 86, fill: text, weight: 800, limit: canvas.ratio === '9:16' ? 14 : 18, lineHeight: 1.08 })}${textBlock({ text: subtitle, x: pad, y: Math.round(canvas.height * 0.53), size: 26, fill: muted, weight: 400, limit: canvas.ratio === '1:1' ? 30 : 34, lineHeight: 1.35 })}${metricsSvg}${motif}<text x="${pad}" y="${canvas.height - pad * 0.95}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="16" letter-spacing="2" fill="${muted}">${escapeXml(footer)}</text></svg>`;
}

module.exports = {
  CANVAS_PRESETS,
  createStyleToken,
  escapeXml,
  overrideStyleToken,
  renderCategoryChartSvg,
  renderShareCardSvg,
  renderTrendChartSvg,
  resolveCanvas
};
