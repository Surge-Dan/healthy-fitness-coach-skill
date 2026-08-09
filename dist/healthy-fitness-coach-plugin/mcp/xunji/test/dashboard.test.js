'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { renderTrainingDashboardHtml } = require('../src/dashboard.js');

test('dashboard renderer produces a self-contained escaped HTML trend report', () => {
  const html = renderTrainingDashboardHtml({
    range: { dates: ['2026-08-01', '2026-08-02'], missing_dates: [], data_freshness: 'cached' },
    trends: {
      date_start: '2026-08-01', date_end: '2026-08-02', training_days: 2, record_count: 3,
      total_sets: 9, total_reps: 78, estimated_volume: 3760, parse_warnings: 0,
      weekly: [{ week_start: '2026-07-27', training_days: 2, record_count: 3, estimated_volume: 3760 }],
      exercise_frequency: [{ name: '<script>alert(1)</script>', count: 2, last_date: '2026-08-02' }]
    }
  });
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /训练趋势/);
  assert.match(html, /2026-08-01/);
  assert.match(html, /<svg/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /https?:\/\//i);
});
