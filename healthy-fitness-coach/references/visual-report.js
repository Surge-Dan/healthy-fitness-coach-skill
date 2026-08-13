'use strict';

const { renderCategoryChartSvg, renderTrendChartSvg } = require('./visuals.js');

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
    }
  ];
}

module.exports = { buildVisualReportAssets };
