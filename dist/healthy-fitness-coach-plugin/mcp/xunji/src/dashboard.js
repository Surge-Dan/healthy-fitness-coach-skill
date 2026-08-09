'use strict';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function number(value) {
  return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '0';
}

function renderBars(weekly = []) {
  const max = Math.max(1, ...weekly.map((item) => Number(item.estimated_volume) || 0));
  return weekly.map((item) => {
    const height = Math.max(8, Math.round(((Number(item.estimated_volume) || 0) / max) * 120));
    const x = 40 + weekly.indexOf(item) * 90;
    return `<g><rect x="${x}" y="${150 - height}" width="48" height="${height}" rx="8" fill="#16a085"/><text x="${x + 24}" y="174" text-anchor="middle">${escapeHtml(item.week_start)}</text><text x="${x + 24}" y="${140 - height}" text-anchor="middle">${number(item.estimated_volume)}</text></g>`;
  }).join('');
}

function renderTrainingDashboardHtml({ range = {}, trends = {} } = {}) {
  const exercises = Array.isArray(trends.exercise_frequency) ? trends.exercise_frequency : [];
  const weekly = Array.isArray(trends.weekly) ? trends.weekly : [];
  const missing = Array.isArray(trends.missing_dates) ? trends.missing_dates : [];
  const rows = exercises.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${number(item.count)}</td><td>${escapeHtml(item.last_date || '—')}</td></tr>`).join('');
  const warning = missing.length ? `<p class="warning">缺失日期：${escapeHtml(missing.join('、'))}</p>` : '<p class="ok">日期范围完整</p>';
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>训记训练趋势</title>
<style>body{font-family:system-ui,-apple-system,"Microsoft YaHei",sans-serif;max-width:1100px;margin:0 auto;padding:32px;color:#18312d;background:#f5faf8}h1{margin-bottom:8px}.muted{color:#60736f}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:24px 0}.card{background:#fff;border:1px solid #d7e8e2;border-radius:14px;padding:16px}.value{font-size:28px;font-weight:700;color:#0f7d69}.warning{color:#a34d1d}.ok{color:#217a61}svg{width:100%;height:210px;background:#fff;border:1px solid #d7e8e2;border-radius:14px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5efeb}th{background:#eaf6f1}</style></head>
<body><h1>训记训练趋势</h1><p class="muted">${escapeHtml(trends.date_start || range.dates?.[0] || '')} 至 ${escapeHtml(trends.date_end || range.dates?.at(-1) || '')} · 数据新鲜度：${escapeHtml(trends.data_freshness || range.data_freshness || 'unknown')}</p>
${warning}<section class="grid"><div class="card"><div>训练日数</div><div class="value">${number(trends.training_days)}</div></div><div class="card"><div>训练记录</div><div class="value">${number(trends.record_count)}</div></div><div class="card"><div>总组数</div><div class="value">${number(trends.total_sets)}</div></div><div class="card"><div>估算训练量</div><div class="value">${number(trends.estimated_volume)}</div></div></section>
<h2>每周训练量</h2><svg viewBox="0 0 ${Math.max(420, 40 + weekly.length * 90)} 210" role="img" aria-label="每周训练量柱状图"><line x1="24" y1="150" x2="100%" y2="150" stroke="#b8d6cc"/>${renderBars(weekly)}</svg>
<h2>动作/训练主题频次</h2><table><thead><tr><th>名称</th><th>次数</th><th>最近日期</th></tr></thead><tbody>${rows || '<tr><td colspan="3">暂无可结构化动作</td></tr>'}</tbody></table>
<p class="muted">本报告由本地训记缓存生成；无法结构化的原文不会被强行推断。解析警告数：${number(trends.parse_warnings)}</p></body></html>`;
}

module.exports = { escapeHtml, renderTrainingDashboardHtml };
