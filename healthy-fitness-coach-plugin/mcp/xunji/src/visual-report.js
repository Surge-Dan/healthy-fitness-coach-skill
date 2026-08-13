'use strict';

const { renderCategoryChartSvg, renderPerformanceChartSvg, renderTrainingHeatmapSvg, renderTrendChartSvg } = require('./visuals.js');

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
    }
  ];
}

module.exports = { buildVisualReportAssets };
