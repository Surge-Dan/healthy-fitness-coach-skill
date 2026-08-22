'use strict';

const { renderCategoryChartSvg, renderPerformanceChartSvg, renderTrainingHeatmapSvg, renderTrendChartSvg } = require('./visuals.js');

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));
}

function renderTrainingSummarySvg(summary = {}) {
  const totals = summary.totals || {};
  const metrics = [['训练天数', totals.training_days || 0], ['训练记录', totals.sessions || 0], ['总组数', totals.total_sets || 0], ['容量kg', totals.volume_kg || 0]];
  const cells = metrics.map(([label, value], index) => { const x = 24 + (index % 2) * 190; const y = 58 + Math.floor(index / 2) * 94; return `<g><rect x="${x}" y="${y}" width="166" height="70" rx="12" fill="#F3F0E8" stroke="#D8D1C4"/><text x="${x + 16}" y="${y + 23}" fill="#6E6A61" font-size="12">${escapeXml(label)}</text><text x="${x + 16}" y="${y + 53}" fill="#202321" font-size="24" font-weight="700">${escapeXml(value)}</text></g>`; }).join('');
  const status = summary.data_quality?.status || 'empty';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="404" height="270" viewBox="0 0 404 270" role="img" data-summary="training" data-status="${escapeXml(status)}"><rect width="404" height="270" rx="18" fill="#FBF9F4"/><text x="24" y="30" fill="#6E6A61" font-size="12" letter-spacing="1.5">TRAINING SUMMARY</text>${cells}<text x="24" y="246" fill="#8A857A" font-size="12">数据状态：${escapeXml(status)}</text></svg>`;
}

function buildVisualReportAssets({ trends = {} } = {}) {
  const weekly = Array.isArray(trends.weekly) ? trends.weekly : [];
  const subjects = Array.isArray(trends.exercise_frequency) ? trends.exercise_frequency : [];
  return [
    {
      name: 'weekly-frequency.svg',
      title: '每周训练频率',
      svg: renderTrendChartSvg({
        title: '每周训练频率',
        points: weekly.map((item) => ({ label: item.week_start, value: item.training_days })),
        color: '#D7FF4B'
      })
    },
    {
      name: 'weekly-volume.svg',
      title: '每周估算训练量',
      svg: renderTrendChartSvg({
        title: '每周估算训练量',
        points: weekly.map((item) => ({ label: item.week_start, value: item.estimated_volume })),
        color: '#7A8BFF'
      })
    },
    {
      name: 'subject-distribution.svg',
      title: '训练主题分布',
      svg: renderCategoryChartSvg({
        title: '训练主题分布',
        items: subjects.map((item) => ({ label: item.name, value: item.count })),
        color: '#FF8066'
      })
    },
    {
      name: 'training-heatmap.svg',
      title: '训练日历',
      svg: renderTrainingHeatmapSvg({
        title: '训练日历',
        dates: trends.training_dates || [],
        dailyStats: trends.daily || [],
        startDate: trends.date_start,
        endDate: trends.date_end
      })
    },
    {
      name: 'main-performance.svg',
      title: '主动作表现',
      svg: renderPerformanceChartSvg({
        title: '主动作表现',
        points: Array.isArray(trends.exercise_performance) ? trends.exercise_performance.map((item) => ({ label: item.label || item.date, value: item.value || item.weight || item.reps })) : [],
        color: '#D7FF4B'
      })
    },
    {
      name: 'training-summary.svg',
      title: '训练摘要',
      svg: renderTrainingSummarySvg(trends.summary || {})
    }
  ];
}

module.exports = { buildVisualReportAssets };
