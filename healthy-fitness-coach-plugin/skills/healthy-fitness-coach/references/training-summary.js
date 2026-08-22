'use strict';

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }

function summarizeTrainingRange(trends = {}) {
  const dna = trends.training_dna?.metrics || {};
  const resistance = dna.resistance || {};
  const aerobic = dna.aerobic || {};
  const distribution = Object.entries(resistance.body_distribution || {}).filter(([, sets]) => finite(sets) > 0).map(([part, sets]) => ({ part, sets: finite(sets) })).sort((a, b) => b.sets - a.sets || a.part.localeCompare(b.part));
  const performance = Array.isArray(trends.exercise_performance) ? trends.exercise_performance : [];
  const trainingDays = finite(trends.training_days); const records = finite(trends.record_count);
  const missing = Array.isArray(trends.missing_dates) ? trends.missing_dates.filter(Boolean) : [];
  const empty = !trainingDays && !records; const partial = !empty && (missing.length > 0 || ['mixed', 'unknown'].includes(trends.data_freshness) || finite(trends.parse_warnings) > 0);
  return { period: { start: trends.date_start || null, end: trends.date_end || null }, headline_code: empty ? 'no_data' : partial ? 'partial_data' : trainingDays >= 3 ? 'consistent_training' : 'restart_gently', totals: { training_days: trainingDays, sessions: records, total_sets: finite(trends.total_sets), total_reps: finite(trends.total_reps), volume_kg: finite(trends.estimated_volume), aerobic_minutes: finite(aerobic.duration_min) }, body_distribution: distribution, main_exercise: performance.length && trends.exercise_performance_exercise ? { name: trends.exercise_performance_exercise, points: performance.slice(-12) } : null, data_quality: { status: empty ? 'empty' : partial ? 'partial' : 'complete', missing_dates: missing, freshness: trends.data_freshness || 'unknown', parse_warnings: finite(trends.parse_warnings) } };
}

module.exports = { summarizeTrainingRange };
