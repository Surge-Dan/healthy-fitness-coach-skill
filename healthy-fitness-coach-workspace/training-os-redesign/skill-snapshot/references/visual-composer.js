'use strict';

const { validateRatio } = require('./visual-dna.js');

const CANVAS = Object.freeze({ '1:1': [2048, 2048], '3:4': [1800, 2400], '9:16': [1440, 2560] });

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
}

function safeImageHref(value) {
  const href = String(value || '').trim();
  if (!href) return '';
  if (/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(href)) return href;
  if (/^[A-Za-z]:[\\/]/.test(href) || /^(?:\.\.?[\\/]|[\\/])/.test(href) || !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)) return href;
  return '';
}

function frameImage(href, x, y, width, height, role, className = '') {
  const safeHref = safeImageHref(href);
  if (!safeHref) return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="#D9D1C4" fill-opacity=".16"/>`;
  return `<image class="${className}" data-role="${role}" href="${esc(safeHref)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`;
}

function base({ width, height, recipe, title, body, bg = '#111315', text = '#F6F1E8', accent = '#FF6A4D', layout = '' }) {
  const layoutAttr = layout ? ` data-layout="${esc(layout)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-recipe="${esc(recipe)}"${layoutAttr} role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><rect width="100%" height="100%" fill="${bg}"/>${body}<text x="${Math.round(width * .07)}" y="${Math.round(height * .94)}" fill="${text}" fill-opacity=".58" font-family="Inter,Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="${Math.round(width * .018)}" letter-spacing="3">HEALTHY FITNESS COACH</text><line x1="${Math.round(width * .07)}" y1="${Math.round(height * .91)}" x2="${Math.round(width * .93)}" y2="${Math.round(height * .91)}" stroke="${accent}" stroke-width="3"/></svg>`;
}

function titleSvg(title, x, y, size, text = '#F6F1E8', anchor = 'start') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${text}" font-family="Noto Serif CJK SC,Source Han Serif SC,SimSun,serif" font-size="${size}" font-weight="600">${esc(title)}</text>`;
}

function motifSvg(motifs, width, height, accent) {
  return (motifs || []).map((motif, index) => {
    if (motif.id === 'halo-cycle') return `<circle class="motif-halo-cycle" cx="${Math.round(width * .76)}" cy="${Math.round(height * .16)}" r="${Math.round(width * .12)}" fill="none" stroke="${accent}" stroke-width="12" stroke-opacity=".72"/>`;
    if (motif.id === 'concentric-load') return `<g class="motif-concentric-load" fill="none" stroke="${accent}" stroke-opacity=".5">${[1, 2, 3].map((n) => `<circle cx="${Math.round(width * .15)}" cy="${Math.round(height * .82)}" r="${n * Math.round(width * .035)}" stroke-width="4"/>`).join('')}</g>`;
    if (motif.id === 'strength-axis') return `<line class="motif-strength-axis" x1="${Math.round(width * .08)}" y1="${Math.round(height * .76)}" x2="${Math.round(width * .92)}" y2="${Math.round(height * .76)}" stroke="${accent}" stroke-width="5"/>`;
    return `<circle class="motif-${esc(motif.id)}" cx="${Math.round(width * (.12 + index * .07))}" cy="${Math.round(height * .84)}" r="10" fill="${accent}"/>`;
  }).join('');
}

function weeklyValues(trends) {
  return (trends?.weekly || []).map((item) => Math.max(0, Number(item.estimated_volume || item.training_days || 0))).filter(Number.isFinite);
}

function renderSketchDiptych(input, width, height) {
  const pad = Math.round(width * .07);
  const gap = Math.round(width * .025);
  const panelW = Math.round((width - pad * 2 - gap) / 2);
  const top = Math.round(height * .12);
  const panelH = Math.round(height * .66);
  const original = frameImage(input.photos?.[0], pad, top, panelW, panelH, 'original-photo', 'diptych-original');
  const derived = frameImage(input.derivedImage, pad + panelW + gap, top, panelW, panelH, 'derived-art', 'diptych-derived');
  const fallback = input.derivedImage ? '' : `<g class="local-sketch-fallback" fill="none" stroke="#F7EBDD" stroke-width="5" stroke-linecap="round" opacity=".72"><path d="M${pad + panelW + gap + panelW * .2} ${top + panelH * .72} Q${pad + panelW + gap + panelW * .48} ${top + panelH * .18} ${pad + panelW + gap + panelW * .78} ${top + panelH * .66}"/><path d="M${pad + panelW + gap + panelW * .3} ${top + panelH * .42} L${pad + panelW + gap + panelW * .7} ${top + panelH * .42}"/></g>`;
  const body = `${original}${derived}${fallback}<text x="${pad}" y="${Math.round(height * .075)}" fill="#FF6A4D" font-family="Inter,sans-serif" font-size="24" letter-spacing="5">ORIGINAL / DISTILLED</text>${titleSvg(input.title || '今日训练', pad, Math.round(height * .86), Math.round(width * .055))}${motifSvg(input.motifs, width, height, '#FF6A4D')}`;
  return base({ width, height, recipe: 'sketch-diptych', title: input.title, body });
}

function starPolygon(cx, cy, outer, inner, points = 8) {
  const vertices = [];
  for (let index = 0; index < points * 2; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * index) / points;
    const radius = index % 2 ? inner : outer;
    vertices.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
  }
  return vertices.join(' ');
}

function collageSignals(input = {}) {
  const image = input.visualDNA?.images?.[0] || input.visual_dna?.images?.[0] || input.imageAnalysis?.[0] || input.image_analysis?.[0] || {};
  return {
    orientation: String(image.orientation || '').toLowerCase(),
    focal: String(image.focal_region || image.focal || '').toLowerCase(),
    negative: String(image.negative_space || image.negative || '').toLowerCase(),
    luminance: String(image.luminance || '').toLowerCase(),
    contrast: String(image.contrast || '').toLowerCase()
  };
}

function chooseCollageLayout(input = {}) {
  if (['torn-vertical', 'burst-poster', 'contact-offset'].includes(input.collageLayout)) return input.collageLayout;
  const signals = collageSignals(input);
  if ((input.photos || []).length > 1) return 'contact-offset';
  if (signals.orientation === 'landscape' && (signals.negative.includes('top') || signals.focal.includes('left'))) return 'burst-poster';
  return 'torn-vertical';
}

function wrapType(text, maxChars) {
  const chars = [...String(text || '')];
  if (!chars.length) return [];
  const lines = [];
  for (let index = 0; index < chars.length; index += maxChars) lines.push(chars.slice(index, index + maxChars).join(''));
  return lines.slice(0, 3);
}

function renderTypeLockup({ title, subtitle, x, y, maxWidth, color = '#171717', muted = '#6D665D', size = 92 }) {
  const titleLines = wrapType(title || '今天也在变强', Math.max(5, Math.floor(maxWidth / (size * .9))));
  const lineGap = Math.round(size * 1.04);
  const titleSvg = titleLines.map((line, index) => `<text class="type-title${index === 0 ? ' hand-note' : ''}" x="${x}" y="${y + index * lineGap}" fill="${color}" font-family="Noto Serif CJK SC,Source Han Serif SC,SimSun,serif" font-size="${size}" font-weight="600">${esc(line)}</text>`).join('');
  const subtitleY = y + titleLines.length * lineGap + Math.round(size * .35);
  const subtitleLines = wrapType(subtitle || '把出现，变成自己的节奏', Math.max(10, Math.floor(maxWidth / 28)));
  const subtitleSvg = subtitleLines.map((line, index) => `<text class="type-subtitle" x="${x}" y="${subtitleY + index * 34}" fill="${muted}" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="24">${esc(line)}</text>`).join('');
  const boxHeight = subtitleY + Math.max(0, subtitleLines.length - 1) * 34 - y + 34;
  return `<g class="type-lockup" data-type-safe-zone="${x},${y},${maxWidth},${boxHeight}">${titleSvg}${subtitleSvg}</g>`;
}

function renderBurstPoster(input, width, height) {
  const pad = Math.round(width * .075);
  const heroX = Math.round(width * .12);
  const heroY = Math.round(height * .23);
  const heroW = Math.round(width * .76);
  const heroH = Math.round(height * .45);
  const cx = width * .52;
  const cy = height * .47;
  const rays = Array.from({ length: 14 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 14;
    const x1 = cx + Math.cos(angle) * width * .22;
    const y1 = cy + Math.sin(angle) * width * .22;
    const x2 = cx + Math.cos(angle) * width * .40;
    const y2 = cy + Math.sin(angle) * width * .40;
    return `<line class="burst-lines" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#FF5A44" stroke-width="${index % 2 ? 7 : 3}" stroke-linecap="round" stroke-opacity=".75"/>`;
  }).join('');
  const image = `<g class="burst-photo" transform="rotate(-3 ${heroX + heroW / 2} ${heroY + heroH / 2})"><rect x="${heroX - 18}" y="${heroY - 18}" width="${heroW + 36}" height="${heroH + 36}" fill="#F7F0E4"/><rect class="burst-torn-edge" x="${heroX - 5}" y="${heroY - 5}" width="${heroW + 10}" height="${heroH + 10}" fill="#171717" fill-opacity=".12"/>${frameImage(input.photos?.[0], heroX, heroY, heroW, heroH, 'original-photo', 'burst-photo-image')}</g>`;
  const lockup = renderTypeLockup({ title: input.title || '今天也在变强', subtitle: input.subtitle || '把出现，变成自己的节奏', x: pad, y: Math.round(height * .10), maxWidth: width * .7, size: Math.round(width * .055) });
  const sticker = `<polygon class="burst-sticker" points="${starPolygon(width * .83, height * .78, width * .055, width * .022, 10)}" fill="#F3C94F" stroke="#171717" stroke-width="4"/>`;
  const metrics = (input.metrics || []).slice(0, 3).map((metric, index) => `<g class="training-stamp"><text x="${pad + index * width * .28}" y="${height * .80}" fill="#6D665D" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="18">${esc(metric.label)}</text><text x="${pad + index * width * .28}" y="${height * .84}" fill="#171717" font-family="Noto Serif CJK SC,SimSun,serif" font-size="42">${esc(metric.value)}</text></g>`).join('');
  const body = `<g class="burst-poster"><text x="${pad}" y="${height * .055}" fill="#2553A7" font-family="Inter,Microsoft YaHei,sans-serif" font-size="22" letter-spacing="4">TRAINING / SIGNAL</text>${lockup}${rays}${image}${metrics}${sticker}<path class="burst-arrow" d="M${width * .10} ${height * .72} C${width * .22} ${height * .68},${width * .28} ${height * .68},${width * .38} ${height * .70}" fill="none" stroke="#171717" stroke-width="5" stroke-dasharray="10 12"/><text x="${width - pad}" y="${height * .89}" text-anchor="end" fill="#171717" font-family="Inter,sans-serif" font-size="18" letter-spacing="3">KEEP SHOWING UP</text></g>`;
  return base({ width, height, recipe: 'star-trail-collage', title: input.title, body, bg: '#F1E9D9', text: '#171717', accent: '#2553A7', layout: 'burst-poster' });
}

function renderContactOffset(input, width, height) {
  const pad = Math.round(width * .075);
  const photos = (input.photos || []).slice(0, 4);
  const cards = [
    { x: width * .10, y: height * .23, w: width * .50, h: height * .36, r: -6 },
    { x: width * .40, y: height * .37, w: width * .48, h: height * .35, r: 5 },
    { x: width * .16, y: height * .62, w: width * .47, h: height * .26, r: 3 },
    { x: width * .57, y: height * .66, w: width * .30, h: height * .19, r: -4 }
  ].slice(0, Math.max(2, photos.length));
  const cardsSvg = cards.map((card, index) => {
    const source = photos[index] || photos[0];
    const tape = `<rect class="washi-tape" x="${card.x + card.w * .38}" y="${card.y - 18}" width="${card.w * .24}" height="32" fill="${index % 2 ? '#2553A7' : '#FF5A44'}" fill-opacity=".78" transform="rotate(${card.r - 8} ${card.x + card.w * .5} ${card.y})"/>`;
    return `<g class="contact-card" transform="rotate(${card.r} ${card.x + card.w / 2} ${card.y + card.h / 2})"><rect x="${card.x - 16}" y="${card.y - 16}" width="${card.w + 32}" height="${card.h + 32}" fill="#F7F0E4"/>${frameImage(source, card.x, card.y, card.w, card.h, 'original-photo', 'contact-photo')}${tape}<text x="${card.x + 18}" y="${card.y + card.h - 18}" fill="#F7F0E4" font-family="Inter,sans-serif" font-size="16" letter-spacing="3">0${index + 1} / TRAINING</text></g>`;
  }).join('');
  const lockup = renderTypeLockup({ title: input.title || '本周训练片段', subtitle: input.subtitle || '把每一次出现，拼成自己的轨迹', x: pad, y: Math.round(height * .095), maxWidth: width * .70, size: Math.round(width * .052) });
  const body = `<g class="contact-offset"><text x="${width - pad}" y="${height * .055}" text-anchor="end" fill="#2553A7" font-family="Inter,sans-serif" font-size="20" letter-spacing="4">CONTACT / STUDY</text>${lockup}${cardsSvg}<path d="M${width * .10} ${height * .88} C${width * .32} ${height * .84},${width * .60} ${height * .91},${width * .90} ${height * .86}" fill="none" stroke="#171717" stroke-width="4" stroke-dasharray="10 12"/><polygon class="star-sticker" points="${starPolygon(width * .86, height * .22, 28, 12)}" fill="#F3C94F" stroke="#171717" stroke-width="3"/></g>`;
  return base({ width, height, recipe: 'star-trail-collage', title: input.title, body, bg: '#F1E9D9', text: '#171717', accent: '#FF5A44', layout: 'contact-offset' });
}

function renderStarTrailCollage(input, width, height) {
  const layout = chooseCollageLayout(input);
  if (layout === 'burst-poster') return renderBurstPoster(input, width, height);
  if (layout === 'contact-offset') return renderContactOffset(input, width, height);
  const photos = input.photos || [];
  const pad = Math.round(width * .075);
  const heroX = Math.round(width * .08);
  const heroY = Math.round(height * .17);
  const heroW = Math.round(width * .68);
  const heroH = Math.round(height * .55);
  const insetW = Math.round(width * .23);
  const insetH = Math.round(height * .19);
  const insetX = Math.round(width * .72);
  const title = input.title || '今天也在变强';
  const subtitle = input.subtitle || '把出现，变成自己的节奏';
  const hero = `<g class="star-trail-hero" transform="rotate(-2 ${heroX + heroW / 2} ${heroY + heroH / 2})"><rect x="${heroX - 18}" y="${heroY - 18}" width="${heroW + 36}" height="${heroH + 36}" fill="#F7F0E4"/><path class="torn-edge" d="M${heroX - 18} ${heroY + heroH * .1} L${heroX - 6} ${heroY - 20} L${heroX + heroW * .16} ${heroY - 8} L${heroX + heroW * .32} ${heroY - 21} L${heroX + heroW * .53} ${heroY - 6} L${heroX + heroW * .76} ${heroY - 19} L${heroX + heroW + 20} ${heroY - 4} L${heroX + heroW + 10} ${heroY + heroH * .22}" fill="#F7F0E4"/>${frameImage(photos[0], heroX, heroY, heroW, heroH, 'original-photo', 'star-trail-photo')}</g>`;
  const insets = [0, 1].map((index) => {
    const y = Math.round(height * (.18 + index * .23));
    const x = insetX + (index ? 12 : 0);
    const rotation = index ? 4 : -5;
    return `<g class="star-trail-inset" transform="rotate(${rotation} ${x + insetW / 2} ${y + insetH / 2})"><rect x="${x - 12}" y="${y - 12}" width="${insetW + 24}" height="${insetH + 24}" rx="8" fill="#F7F0E4"/><rect x="${x - 3}" y="${y - 3}" width="${insetW + 6}" height="${insetH + 6}" fill="#1C2433" fill-opacity=".12"/>${frameImage(photos[index] || photos[0], x, y, insetW, insetH, 'original-photo', 'star-trail-inset-photo')}</g>`;
  }).join('');
  const stars = [[.78, .09, 30, '#FF5A44'], [.91, .31, 20, '#F3C94F'], [.17, .76, 25, '#2553A7'], [.73, .78, 18, '#FF5A44']]
    .map(([x, y, size, fill], index) => `<polygon class="star-sticker star-sticker-${index + 1}" points="${starPolygon(width * x, height * y, size, size * .42)}" fill="${fill}" stroke="#171717" stroke-width="3"/>`).join('');
  const metrics = (input.metrics || []).slice(0, 3).map((metric, index) => `<g class="training-stamp"><text x="${pad + index * width * .27}" y="${height * .80}" fill="#6D665D" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="18">${esc(metric.label)}</text><text x="${pad + index * width * .27}" y="${height * .84}" fill="#171717" font-family="Noto Serif CJK SC,SimSun,serif" font-size="42">${esc(metric.value)}</text></g>`).join('');
  const lockup = renderTypeLockup({ title, subtitle, x: pad, y: Math.round(height * .735), maxWidth: width * .62, size: Math.round(width * .052) });
  const body = `<g class="star-trail-collage"><text x="${pad}" y="${height * .095}" fill="#FF5A44" font-family="Inter,Microsoft YaHei,sans-serif" font-size="22" letter-spacing="4">TRAINING SCRAPBOOK / ${esc(input.date || 'TODAY')}</text>${hero}${insets}<path class="hand-arrow" d="M${width * .63} ${height * .72} C${width * .72} ${height * .66},${width * .78} ${height * .62},${width * .88} ${height * .57}" fill="none" stroke="#171717" stroke-width="5" stroke-linecap="round" stroke-dasharray="12 14"/><path class="hand-arrow-head" d="M${width * .86} ${height * .55} l${width * .04} ${height * .02} -${width * .025} ${height * .035}" fill="none" stroke="#171717" stroke-width="5" stroke-linecap="round"/>${lockup}${metrics}${stars}<text x="${width - pad}" y="${height * .88}" text-anchor="end" fill="#171717" font-family="Inter,sans-serif" font-size="18" letter-spacing="3">KEEP SHOWING UP</text></g>`;
  return base({ width, height, recipe: 'star-trail-collage', title, body, bg: '#F1E9D9', text: '#171717', accent: '#FF5A44', layout: 'torn-vertical' });
}

function renderStoryboard(input, width, height) {
  const photos = (input.photos || []).slice(0, 6);
  const pad = Math.round(width * .06);
  const gap = Math.round(width * .018);
  const count = Math.max(1, photos.length);
  const cols = count <= 2 ? 1 : 2;
  const rows = Math.ceil(count / cols);
  const panelW = Math.round((width - pad * 2 - gap * (cols - 1)) / cols);
  const areaTop = Math.round(height * .18);
  const areaH = Math.round(height * .64);
  const panelH = Math.round((areaH - gap * (rows - 1)) / rows);
  const panels = Array.from({ length: count }, (_, index) => {
    const x = pad + (index % cols) * (panelW + gap);
    const y = areaTop + Math.floor(index / cols) * (panelH + gap);
    return `<g class="story-panel story-panel-${index + 1}">${frameImage(photos[index], x, y, panelW, panelH, 'original-photo')}<text x="${x + 20}" y="${y + 42}" fill="#FFDF59" font-family="Inter,sans-serif" font-size="24">0${index + 1}</text></g>`;
  }).join('');
  const note = cols === 2 && count % 2 ? `<g class="story-note"><rect x="${pad + panelW + gap}" y="${areaTop + (rows - 1) * (panelH + gap)}" width="${panelW}" height="${panelH}" fill="#F8F0E4" fill-opacity=".06" stroke="#F8F0E4" stroke-opacity=".5"/><text x="${pad + panelW + gap + 32}" y="${areaTop + (rows - 1) * (panelH + gap) + 70}" fill="#F8F0E4" font-family="Noto Serif CJK SC,serif" font-size="46">MOTION</text><text x="${pad + panelW + gap + 32}" y="${areaTop + (rows - 1) * (panelH + gap) + 126}" fill="#FFDF59" font-family="Noto Serif CJK SC,serif" font-size="46">STUDY</text></g>` : '';
  const body = `<path d="M0 ${height * .12} L${width} ${height * .04}" stroke="#FFDF59" stroke-width="18"/>${titleSvg(input.title || '训练分镜', pad, Math.round(height * .115), Math.round(width * .058))}${panels}${note}<path d="M${pad} ${height * .86} C${width * .28} ${height * .81},${width * .68} ${height * .91},${width - pad} ${height * .84}" fill="none" stroke="#FF6A4D" stroke-width="8" stroke-dasharray="18 16"/>`;
  return base({ width, height, recipe: 'multi-photo-storyboard', title: input.title, body, bg: '#181514', accent: '#FFDF59' });
}

function renderMotionComic(input, width, height) {
  const photos = input.photos || [];
  const pad = Math.round(width * .06);
  const top = Math.round(height * .16);
  const gap = Math.round(width * .018);
  const heroW = Math.round(width * .55);
  const sideW = width - pad * 2 - heroW - gap;
  const panelH = Math.round(height * .62);
  const smallH = Math.round((panelH - gap) / 2);
  const body = `${titleSvg(input.title || '训练漫画', pad, Math.round(height * .105), Math.round(width * .06), '#181818')}
    <g class="motion-comic"><g class="comic-hero">${frameImage(photos[0], pad, top, heroW, panelH, 'original-photo')}</g>
    <g class="comic-panel">${frameImage(photos[1] || photos[0], pad + heroW + gap, top, sideW, smallH, 'original-photo')}</g>
    <g class="comic-panel">${frameImage(photos[2] || photos[0], pad + heroW + gap, top + smallH + gap, sideW, smallH, 'original-photo')}</g>
    <path d="M${width * .12} ${height * .82} Q${width * .42} ${height * .72} ${width * .88} ${height * .84}" fill="none" stroke="#E94335" stroke-width="10" stroke-linecap="round"/>
    <path d="M${width * .78} ${height * .79} l${width * .10} ${height * .05} -${width * .11} ${height * .015}" fill="none" stroke="#E94335" stroke-width="10" stroke-linecap="round"/></g>`;
  return base({ width, height, recipe: 'motion-comic', title: input.title, body, bg: '#F3EBDD', text: '#181818', accent: '#E94335' });
}

function renderRisograph(input, width, height) {
  const pad = Math.round(width * .08);
  const photo = input.photos?.[0];
  const image = frameImage(photo, pad, Math.round(height * .12), width - pad * 2, Math.round(height * .57), 'original-photo', 'riso-source');
  const body = `<defs><pattern id="riso-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="#182B58" fill-opacity=".38"/></pattern></defs><g class="risograph-zine">${image}<rect x="${pad + 12}" y="${Math.round(height * .12) - 8}" width="${width - pad * 2}" height="${Math.round(height * .57)}" fill="#E84B3C" fill-opacity=".22"/><rect x="${pad}" y="${Math.round(height * .12)}" width="${width - pad * 2}" height="${Math.round(height * .57)}" fill="url(#riso-dots)"/><rect x="${pad}" y="${Math.round(height * .73)}" width="${width - pad * 2}" height="${Math.round(height * .13)}" fill="#E84B3C"/>${titleSvg(input.title || '训练小志', pad + 24, Math.round(height * .81), Math.round(width * .055), '#F3E8D2')}<text x="${width - pad}" y="${Math.round(height * .095)}" text-anchor="end" fill="#2453A6" font-family="Inter,sans-serif" font-size="24" letter-spacing="4">RISO / TRAINING</text></g>`;
  return base({ width, height, recipe: 'risograph-zine', title: input.title, body, bg: '#F3E8D2', text: '#171717', accent: '#2453A6' });
}

function renderSymbolLab(input, width, height) {
  const pad = Math.round(width * .07);
  const motifs = input.motifs || [];
  const photo = frameImage(input.photos?.[0], pad, Math.round(height * .11), Math.round(width * .54), Math.round(height * .70), 'original-photo', 'symbol-source');
  const symbols = (motifs.length ? motifs : [{ id: 'training-rhythm' }]).map((motif, index) => {
    const x = Math.round(width * .71);
    const y = Math.round(height * (.23 + index * .15));
    if (motif.id === 'halo-cycle' || motif.id === 'concentric-load') return `<g class="symbol-cell"><circle cx="${x}" cy="${y}" r="${width * .075}" fill="none" stroke="#D7FF4B" stroke-width="8"/><circle cx="${x}" cy="${y}" r="${width * .04}" fill="none" stroke="#7E8CFF" stroke-width="5"/></g>`;
    return `<g class="symbol-cell"><path d="M${x - width * .07} ${y} H${x + width * .07} M${x} ${y - width * .07} V${y + width * .07}" stroke="#D7FF4B" stroke-width="8"/><rect x="${x - width * .045}" y="${y - width * .045}" width="${width * .09}" height="${width * .09}" fill="none" stroke="#7E8CFF" stroke-width="5"/></g>`;
  }).join('');
  const body = `<g class="symbol-lab">${photo}${symbols}<text x="${width * .71}" y="${height * .12}" text-anchor="middle" fill="#8A97A8" font-family="Inter,sans-serif" font-size="22" letter-spacing="3">OBSERVED / ENCODED</text>${titleSvg(input.title || '健身符号实验室', pad, Math.round(height * .87), Math.round(width * .052))}</g>`;
  return base({ width, height, recipe: 'symbol-lab', title: input.title, body, bg: '#10141D', accent: '#D7FF4B' });
}

function renderMinimalTrajectory(input, width, height) {
  const pad = Math.round(width * .09);
  const image = frameImage(input.photos?.[0], 0, 0, width, height, 'original-photo', 'minimal-fullbleed');
  const body = `<g class="minimal-trajectory">${image}<rect width="100%" height="100%" fill="#0B0E12" fill-opacity=".38"/><rect x="${pad}" y="${height * .08}" width="${width - pad * 2}" height="${height * .76}" fill="none" stroke="#F4EFE6" stroke-opacity=".6" stroke-width="2"/><path d="M${pad} ${height * .72} C${width * .31} ${height * .44},${width * .56} ${height * .66},${width - pad} ${height * .31}" fill="none" stroke="#FF6A4D" stroke-width="10" stroke-linecap="round"/><circle cx="${width - pad}" cy="${height * .31}" r="14" fill="#FF6A4D"/>${titleSvg(input.title || '保持轨迹', pad, Math.round(height * .16), Math.round(width * .06))}</g>`;
  return base({ width, height, recipe: 'minimal-trajectory', title: input.title, body, bg: '#0B0E12', accent: '#FF6A4D' });
}

function renderTrainingRings(input, width, height) {
  const values = weeklyValues(input.trends);
  const max = Math.max(1, ...values);
  const cx = width * .5;
  const cy = height * .48;
  const rings = (values.length ? values : [0]).slice(0, 12).map((value, index) => {
    const r = width * (.09 + index * .026);
    const dash = Math.max(8, Math.round(100 * value / max));
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${index % 2 ? '#7E8CFF' : '#D7FF4B'}" stroke-width="${Math.max(3, width * .008)}" stroke-opacity="${.25 + .65 * value / max}" stroke-dasharray="${dash} ${Math.max(8, 110 - dash)}"/>`;
  }).join('');
  const body = `<g class="training-rings">${rings}</g>${titleSvg(input.title || '训练年轮', width * .5, height * .12, width * .06, '#F6F7F2', 'middle')}<text x="${width * .5}" y="${cy + 10}" text-anchor="middle" fill="#F6F7F2" font-family="Inter,sans-serif" font-size="${width * .035}">${values.length} WEEKS</text>`;
  return base({ width, height, recipe: 'training-rings', title: input.title, body, bg: '#10141D', accent: '#D7FF4B' });
}

function renderTerrain(input, width, height) {
  const values = weeklyValues(input.trends);
  const points = values.length ? values : [0, 0];
  const max = Math.max(1, ...points);
  const left = width * .08;
  const right = width * .92;
  const bottom = height * .78;
  const top = height * .25;
  const path = points.map((value, index) => `${index ? 'L' : 'M'}${left + index * (right - left) / Math.max(1, points.length - 1)},${bottom - (bottom - top) * value / max}`).join(' ');
  const contours = [0, 22, 44, 66].map((offset) => `<path d="${path}" transform="translate(0 ${offset})" fill="none" stroke="#FF714F" stroke-width="${8 - offset / 14}" stroke-opacity="${.9 - offset / 120}"/>`).join('');
  const body = `<g class="strength-terrain">${contours}<path d="${path} L${right} ${bottom + 80} L${left} ${bottom + 80} Z" fill="#FF714F" fill-opacity=".12"/></g>${titleSvg(input.title || '力量地形', width * .08, height * .14, width * .065)}`;
  return base({ width, height, recipe: 'strength-terrain', title: input.title, body, bg: '#1A1616', accent: '#FF714F' });
}

function renderFingerprint(input, width, height) {
  const values = weeklyValues(input.trends);
  const count = Math.max(18, values.length * 3);
  const paths = Array.from({ length: count }, (_, index) => {
    const value = values.length ? values[index % values.length] : index % 5;
    const rx = width * (.1 + index * .012);
    const ry = height * (.07 + index * .008 + Math.min(8, value) * .002);
    return `<ellipse cx="${width * .5}" cy="${height * .51}" rx="${rx}" ry="${ry}" fill="none" stroke="${index % 3 === 0 ? '#75E6DA' : '#E9E1D2'}" stroke-width="3" stroke-opacity="${.2 + index / count * .65}" stroke-dasharray="${12 + index} ${7 + index % 9}"/>`;
  }).join('');
  const body = `<g class="action-fingerprint">${paths}</g>${titleSvg(input.title || '动作指纹', width * .5, height * .12, width * .06, '#F4EEE3', 'middle')}`;
  return base({ width, height, recipe: 'action-fingerprint', title: input.title, body, bg: '#0E2022', accent: '#75E6DA' });
}

function renderMuscleConstellation(input, width, height) {
  const items = (input.trends?.exercise_frequency || []).slice(0, 9);
  const points = (items.length ? items : [{ name: '暂无数据', count: 0 }]).map((item, index, array) => {
    const angle = -Math.PI / 2 + Math.PI * 2 * index / array.length;
    const radius = width * (.18 + (Number(item.count) || 0) / Math.max(1, ...array.map((entry) => Number(entry.count) || 0)) * .18);
    return { x: width * .5 + Math.cos(angle) * radius, y: height * .52 + Math.sin(angle) * radius, label: item.name, value: Number(item.count) || 0 };
  });
  const links = points.map((point, index) => `<line x1="${point.x}" y1="${point.y}" x2="${points[(index + 1) % points.length].x}" y2="${points[(index + 1) % points.length].y}" stroke="#7E8CFF" stroke-opacity=".42" stroke-width="3"/>`).join('');
  const nodes = points.map((point) => `<g class="muscle-node"><circle cx="${point.x}" cy="${point.y}" r="${12 + point.value * 2}" fill="#D7FF4B" fill-opacity=".85"/><text x="${point.x}" y="${point.y + 38}" text-anchor="middle" fill="#F6F7F2" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="20">${esc(point.label)}</text></g>`).join('');
  const body = `<g class="muscle-constellation">${links}${nodes}</g>${titleSvg(input.title || '肌群星座', width * .5, height * .12, width * .06, '#F6F7F2', 'middle')}`;
  return base({ width, height, recipe: 'muscle-constellation', title: input.title, body, bg: '#12142A', accent: '#D7FF4B' });
}

function renderDataAtlas(input, width, height) {
  const values = weeklyValues(input.trends);
  const max = Math.max(1, ...values);
  const pad = width * .08;
  const chart = values.map((value, index) => {
    const x = pad + index * (width - pad * 2) / Math.max(1, values.length - 1);
    const y = height * .62 - value / max * height * .22;
    return `${index ? 'L' : 'M'}${x},${y}`;
  }).join(' ');
  const rows = (input.metrics || []).slice(0, 4).map((metric, index) => `<g class="atlas-metric"><text x="${pad + (index % 2) * width * .44}" y="${height * (.25 + Math.floor(index / 2) * .09)}" fill="#7C7469" font-family="Microsoft YaHei,Noto Sans CJK SC,sans-serif" font-size="20">${esc(metric.label)}</text><text x="${pad + (index % 2) * width * .44}" y="${height * (.29 + Math.floor(index / 2) * .09)}" fill="#181818" font-family="Noto Serif CJK SC,SimSun,serif" font-size="48">${esc(metric.value)}</text></g>`).join('');
  const body = `<g class="data-atlas"><text x="${pad}" y="${height * .09}" fill="#E85D4A" font-family="Inter,sans-serif" font-size="20" letter-spacing="4">TRAINING / RECORDED</text>${titleSvg(input.title || '训练数据图谱', pad, height * .17, width * .06, '#181818')}${rows}<rect x="${pad}" y="${height * .42}" width="${width - pad * 2}" height="${height * .27}" rx="20" fill="none" stroke="#181818" stroke-opacity=".22"/><path d="${chart}" fill="none" stroke="#E85D4A" stroke-width="8"/><text x="${pad}" y="${height * .76}" fill="#7C7469" font-family="Noto Serif CJK SC,SimSun,serif" font-size="28">事实优先，持续记录。</text></g>`;
  return base({ width, height, recipe: 'data-atlas', title: input.title, body, bg: '#F4EFE6', text: '#181818', accent: '#E85D4A' });
}

function renderCompiledVisualSvg(input = {}) {
  const ratio = validateRatio(input.ratio || '3:4');
  const [width, height] = CANVAS[ratio];
  const recipe = input.recipe || ((input.photos || []).length > 1 ? 'multi-photo-storyboard' : (input.photos || []).length ? 'sketch-diptych' : 'training-rings');
  if (recipe === 'sketch-diptych') return renderSketchDiptych(input, width, height);
  if (recipe === 'star-trail-collage') return renderStarTrailCollage(input, width, height);
  if (recipe === 'multi-photo-storyboard') return renderStoryboard(input, width, height);
  if (recipe === 'motion-comic') return renderMotionComic(input, width, height);
  if (recipe === 'risograph-zine') return renderRisograph(input, width, height);
  if (recipe === 'symbol-lab') return renderSymbolLab(input, width, height);
  if (recipe === 'minimal-trajectory') return renderMinimalTrajectory(input, width, height);
  if (recipe === 'strength-terrain') return renderTerrain(input, width, height);
  if (recipe === 'action-fingerprint') return renderFingerprint(input, width, height);
  if (recipe === 'muscle-constellation') return renderMuscleConstellation(input, width, height);
  if (recipe === 'data-atlas') return renderDataAtlas(input, width, height);
  if (recipe === 'training-rings') return renderTrainingRings(input, width, height);
  return renderSketchDiptych(input, width, height).replace('data-recipe="sketch-diptych"', `data-recipe="${esc(recipe)}"`);
}

module.exports = { CANVAS, renderCompiledVisualSvg };
