'use strict';

function parseDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function weekStart(dateString) {
  const date = parseDate(dateString);
  if (!date) return undefined;
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function analyzeTrainingRange(input = {}) {
  const records = Array.isArray(input.records) ? input.records : [];
  const dates = Array.isArray(input.dates) ? input.dates : [];
  const trainingDates = new Set(records.map((record) => record.record_date).filter(Boolean));
  const weeklyMap = new Map();
  const exercises = new Map();
  let totalSets = 0;
  let totalReps = 0;
  let estimatedVolume = 0;
  let parseWarnings = 0;

  for (const record of records) {
    const recordDate = record.record_date;
    const week = weekStart(recordDate);
    if (week) {
      if (!weeklyMap.has(week)) weeklyMap.set(week, { week_start: week, dates: new Set(), record_count: 0, volume: 0 });
      const bucket = weeklyMap.get(week);
      bucket.dates.add(recordDate);
      bucket.record_count += 1;
      bucket.volume += numeric(record.volume);
    }
    totalSets += numeric(record.sets);
    totalReps += numeric(record.total_reps || (record.sets && record.reps ? record.sets * record.reps : 0));
    estimatedVolume += numeric(record.volume);
    if (record.parse_status && record.parse_status !== 'complete') parseWarnings += 1;
    if (Array.isArray(record.warnings) && record.warnings.length) parseWarnings += 1;
    const name = record.title || record.name;
    if (name) {
      const current = exercises.get(name) || { name, count: 0, last_date: '' };
      current.count += 1;
      if (recordDate && recordDate > current.last_date) current.last_date = recordDate;
      exercises.set(name, current);
    }
  }

  const weekly = [...weeklyMap.values()]
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((bucket) => ({
      week_start: bucket.week_start,
      training_days: bucket.dates.size,
      record_count: bucket.record_count,
      estimated_volume: bucket.volume
    }));
  const exercise_frequency = [...exercises.values()].sort((a, b) => b.count - a.count || b.last_date.localeCompare(a.last_date) || a.name.localeCompare(b.name));

  return {
    date_start: dates[0],
    date_end: dates[dates.length - 1],
    training_days: trainingDates.size,
    training_dates: [...trainingDates].sort(),
    record_count: records.length,
    total_sets: totalSets,
    total_reps: totalReps,
    estimated_volume: estimatedVolume,
    weekly,
    exercise_frequency,
    missing_dates: Array.isArray(input.missing_dates) ? input.missing_dates.slice() : [],
    parse_warnings: parseWarnings,
    data_freshness: input.data_freshness || 'unknown'
  };
}

module.exports = { analyzeTrainingRange, weekStart };
