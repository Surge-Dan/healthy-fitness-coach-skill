'use strict';

const { extractTrainingDNA, validDate } = require('./training-dna.js');

function parseDate(value) {
  const normalized = validDate(value);
  if (!normalized) return null;
  const date = new Date(`${normalized}T00:00:00Z`);
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

function numericWeight(value) {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function isRestDay(record) {
  return record?.kind === 'rest_day' || /^(休息日|rest(?: day)?|off)$/i.test(String(record?.title || record?.name || '').trim());
}

function numericVolume(record) {
  const value = numeric(record?.volume);
  return /lb|磅/i.test(String(record?.volume_unit || '')) ? value * 0.45359237 : value;
}

function analyzeTrainingRange(input = {}) {
  const records = (Array.isArray(input.records) ? input.records : []).filter((record) => !isRestDay(record) && validDate(record.record_date));
  const dates = (Array.isArray(input.dates) ? input.dates : []).filter((value) => validDate(value));
  const trainingDates = new Set(records.map((record) => record.record_date).filter(Boolean));
  const weeklyMap = new Map();
  const dailyMap = new Map();
  const exercises = new Map();
  const performance = new Map();
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
      bucket.volume += numericVolume(record);
    }
    if (recordDate) {
      if (!dailyMap.has(recordDate)) dailyMap.set(recordDate, { date: recordDate, volume: 0, sets: 0, record_count: 0 });
      const day = dailyMap.get(recordDate);
      day.volume += numericVolume(record);
      day.sets += numeric(record.sets);
      day.record_count += 1;
    }
    totalSets += numeric(record.sets);
    totalReps += numeric(record.total_reps || (record.sets && record.reps ? record.sets * record.reps : 0));
    estimatedVolume += numericVolume(record);
    if (record.parse_status && record.parse_status !== 'complete') parseWarnings += 1;
    if (Array.isArray(record.warnings) && record.warnings.length) parseWarnings += 1;
    const name = record.title || record.name;
    if (name) {
      const current = exercises.get(name) || { name, count: 0, last_date: '' };
      current.count += 1;
      if (recordDate && recordDate > current.last_date) current.last_date = recordDate;
      exercises.set(name, current);
      const weight = numericWeight(record.weight);
      const volume = numericVolume(record);
      const value = weight > 0 ? weight : volume > 0 ? volume : 0;
      if (recordDate && value > 0) {
        const series = performance.get(name) || { name, values: [] };
        series.values.push({ label: recordDate, value, exercise: name, value_type: weight > 0 ? 'weight' : 'volume' });
        performance.set(name, series);
      }
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
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const mainPerformance = [...performance.values()]
    .sort((a, b) => (exercises.get(b.name)?.count || 0) - (exercises.get(a.name)?.count || 0) || a.name.localeCompare(b.name))[0];
  const exercise_performance = mainPerformance
    ? mainPerformance.values.sort((a, b) => a.label.localeCompare(b.label))
    : [];

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
    daily,
    exercise_frequency,
    exercise_performance_exercise: mainPerformance?.name,
    exercise_performance,
    missing_dates: Array.isArray(input.missing_dates) ? input.missing_dates.slice() : [],
    parse_warnings: parseWarnings,
    data_freshness: input.data_freshness || 'unknown',
    training_dna: extractTrainingDNA({
      records,
      dateStart: dates[0],
      dateEnd: dates[dates.length - 1],
      plannedSessionsPerWeek: input.planned_sessions_per_week,
      profile: input.profile,
      missingDates: Array.isArray(input.missing_dates) ? input.missing_dates : []
    })
  };
}

module.exports = { analyzeTrainingRange, weekStart };
