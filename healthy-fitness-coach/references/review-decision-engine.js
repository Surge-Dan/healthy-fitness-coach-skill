'use strict';

// This module deliberately consumes already standardised records. It does not
// infer a medical condition, a strength maximum, or a trend from one noisy row.
const LOW_ADHERENCE_THRESHOLD = 0.7;
const MIN_TREND_POINTS = 2;
const EVIDENCE_ORDER = ['事实', '推断', '不确定性', '决策', '验证'];

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function text(value, fallback = '') {
  return value === undefined || value === null ? fallback : String(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function recordId(record, index) {
  const source = record && typeof record === 'object' ? record : {};
  return text(source.source_record_id ?? source.id, `record-${index + 1}`);
}

function dateValue(value) {
  const date = text(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? undefined : date;
}

function addDays(value, days) {
  const date = dateValue(value);
  if (!date) return 'unknown';
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function weekOf(value) {
  const date = dateValue(value);
  if (!date) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return parsed.toISOString().slice(0, 10);
}

function numberFrom(record, keys) {
  const source = record && typeof record === 'object' ? record : {};
  for (const key of keys) {
    const value = finite(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function performancePoint(record, index) {
  const source = record && typeof record === 'object' ? record : {};
  const value = numberFrom(source, ['value', 'load_kg', 'weight_kg', 'volume_kg', 'total_reps', 'reps']);
  const missingFields = [];
  const rawExercise = source.exercise ?? source.name;
  const metric = text(source.metric, source.load_kg !== undefined || source.weight_kg !== undefined ? 'load' : 'performance');
  let unit = source.unit;
  if (!unit && (source.load_kg !== undefined || source.weight_kg !== undefined || source.volume_kg !== undefined)) unit = 'kg';
  if (!unit && (source.reps !== undefined || source.total_reps !== undefined)) unit = 'reps';
  if (!rawExercise || text(rawExercise).trim() === '') missingFields.push('exercise');
  if (value === undefined) missingFields.push('value');
  if (!source.metric && source.load_kg === undefined && source.weight_kg === undefined && source.volume_kg === undefined && source.reps === undefined && source.total_reps === undefined) missingFields.push('metric');
  if (!unit || text(unit).toLowerCase() === 'unknown') missingFields.push('unit');
  if (numberFrom(source, ['rir', 'rpe_or_rir']) === undefined && finite(source.rpe) === undefined) missingFields.push('rir_or_rpe');
  if (finite(source.sets) === undefined) missingFields.push('sets');
  const date = dateValue(source.date ?? source.record_date);
  if (!date) missingFields.push('date');
  return {
    date,
    exercise: text(rawExercise, 'unknown'),
    metric,
    value,
    unit: text(unit, 'unknown').toLowerCase(),
    rir: numberFrom(source, ['rir', 'rpe_or_rir']),
    rpe: finite(source.rpe),
    sets: finite(source.sets),
    missing_fields: missingFields,
    source_record_id: recordId(source, index)
  };
}

function comparable(a, b) {
  if (a.missing_fields?.length || b.missing_fields?.length) return false;
  if (a.exercise !== b.exercise || a.metric !== b.metric || a.unit === 'unknown' || a.unit !== b.unit) return false;
  if (a.rir !== undefined && b.rir !== undefined && Math.abs(a.rir - b.rir) > 1) return false;
  if (a.rpe !== undefined && b.rpe !== undefined && Math.abs(a.rpe - b.rpe) > 1) return false;
  if (a.sets !== undefined && b.sets !== undefined && a.sets !== b.sets) return false;
  return Boolean(a.date && b.date);
}

function extractRates(input, summary) {
  const source = input.completion_rate_series ?? input.completionRateSeries
    ?? input.completion_rates ?? input.completionRates;
  const values = Array.isArray(source) ? source : source === undefined ? [] : [source];
  const rates = values.map((entry, index) => {
    if (typeof entry === 'object' && entry !== null) {
      const rate = finite(entry.rate ?? entry.completion_rate ?? entry.value);
      return { period: text(entry.period, `window-${index + 1}`), rate: rate === undefined ? null : rate, known: rate !== undefined, source_record_ids: asArray(entry.source_record_ids) };
    }
    const rate = finite(entry);
    return { period: `window-${index + 1}`, rate: rate === undefined ? null : rate, known: rate !== undefined, source_record_ids: [] };
  });
  if (rates.length) return rates;
  const summaryRate = finite(summary.adherence?.rate ?? summary.adherence ?? summary.completion_rate ?? summary.metrics?.adherence);
  return summaryRate === undefined ? [] : [{ period: 'summary', rate: summaryRate, known: true, source_record_ids: [] }];
}

function recoveryObservations(input, records) {
  const supplied = asArray(input.recovery ?? input.recovery_results ?? input.recoveryResults);
  const fromRecords = records.map((record, index) => {
    const sleep = numberFrom(record, ['sleep_hours', 'sleep']);
    const fatigue = finite(record.fatigue);
    const stress = finite(record.stress);
    if (sleep === undefined && fatigue === undefined && stress === undefined && typeof record.recovery_status !== 'string') return null;
    return { date: dateValue(record.date), sleep_hours: sleep, fatigue, stress, status: record.recovery_status, source_record_ids: [recordId(record, index)] };
  }).filter(Boolean);
  return supplied.concat(fromRecords).map((item, index) => ({
    date: dateValue(item.date),
    sleep_hours: numberFrom(item, ['sleep_hours', 'sleep']),
    fatigue: finite(item.fatigue),
    stress: finite(item.stress),
    status: text(item.status ?? item.recovery_status).toLowerCase(),
    source_record_ids: asArray(item.source_record_ids).map(String).filter(Boolean).length
      ? asArray(item.source_record_ids).map(String).filter(Boolean)
      : [`recovery-${index + 1}`]
  }));
}

function poorRecovery(observation) {
  return observation.sleep_hours !== undefined && observation.sleep_hours < 6
    || observation.fatigue !== undefined && observation.fatigue >= 7
    || /(?:poor|bad|low|差|不足|疲劳|很累)/iu.test(observation.status);
}

function deriveReviewFacts(input = {}) {
  const summary = input.summary && typeof input.summary === 'object' ? input.summary : input;
  const sourceRecords = asArray(input.records ?? input.training_records ?? summary.records);
  const points = sourceRecords.map(performancePoint).filter(Boolean).sort((a, b) => text(a.date).localeCompare(text(b.date)));
  const warnings = asArray(summary.warnings ?? summary.data_quality?.warnings ?? input.warnings);
  const missingDates = asArray(summary.missing_dates ?? summary.data_quality?.missing_dates ?? input.missing_dates);
  const mixedUnits = Boolean(input.mixed_units || summary.mixed_units || summary.data_quality?.mixed_units
    || warnings.some((warning) => text(warning?.code ?? warning).toLowerCase() === 'mixed_units'))
    || new Set(points.map((point) => `${point.exercise}|${point.metric}|${point.unit}`)).size > new Set(points.map((point) => `${point.exercise}|${point.metric}`)).size;
  const validRecords = sourceRecords.filter((record) => dateValue(record?.date ?? record?.record_date));
  const incompletePoints = points.filter((point) => point.missing_fields?.length > 0);
  const actualMissingDates = sourceRecords.map((record, index) => dateValue(record?.date ?? record?.record_date) ? null : `record:${recordId(record, index)}`).filter(Boolean);
  const rates = extractRates(input, summary);
  const comparisons = [];
  const groups = new Map();
  points.forEach((point) => {
    const key = `${point.exercise}|${point.metric}`;
    const list = groups.get(key) || [];
    list.push(point);
    groups.set(key, list);
  });
  if (!mixedUnits) {
    for (const list of groups.values()) {
      for (let index = 1; index < list.length; index += 1) {
        const before = list[index - 1]; const after = list[index];
        if (!comparable(before, after)) continue;
        const delta = Number((after.value - before.value).toFixed(3));
        comparisons.push({
          exercise: after.exercise, metric: after.metric, unit: after.unit,
          before: before.value, after: after.value, delta,
          direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
          source_record_ids: [before.source_record_id, after.source_record_id]
        });
      }
    }
  }
  const improvementCount = comparisons.filter((item) => item.direction === 'up').length;
  const declineCount = comparisons.filter((item) => item.direction === 'down').length;
  const dates = sourceRecords.map((record) => dateValue(record?.date ?? record?.record_date)).filter(Boolean).sort();
  const start = dateValue(input.date_start ?? input.dateStart ?? summary.period?.start ?? summary.data_range?.date_start) || dates[0] || null;
  const end = dateValue(input.date_end ?? input.dateEnd ?? summary.period?.end ?? summary.data_range?.date_end) || dates.at(-1) || null;
  const recovery = recoveryObservations(input, sourceRecords).map((observation) => {
    const inRange = Boolean(observation.date && (!start || observation.date >= start) && (!end || observation.date <= end));
    const nearTraining = !dates.length || dates.some((date) => Math.abs(Date.parse(`${date}T00:00:00Z`) - Date.parse(`${observation.date}T00:00:00Z`)) <= 14 * 86400000);
    return { ...observation, associated: inRange && nearTraining };
  });
  const associatedRecovery = recovery.filter((observation) => observation.associated);
  const poorRecoveryCount = associatedRecovery.filter(poorRecovery).length;
  const weeks = new Set(dates.map(weekOf).filter(Boolean));
  const qualityStatus = !sourceRecords.length || incompletePoints.length || actualMissingDates.length ? 'unknown'
    : (mixedUnits || missingDates.length || warnings.length || summary.data_quality?.status === 'partial' ? 'partial' : 'complete');
  const uncertainties = [];
  if (!sourceRecords.length) uncertainties.push('训练记录缺失，无法判断趋势。');
  if (missingDates.length) uncertainties.push(`存在缺失日期：${missingDates.join('、')}。`);
  if (actualMissingDates.length) uncertainties.push(`训练记录中存在缺失日期：${actualMissingDates.join('、')}。`);
  if (incompletePoints.length) uncertainties.push(`关键比较字段缺失：${[...new Set(incompletePoints.flatMap((point) => point.missing_fields))].join('、')}。`);
  if (mixedUnits) uncertainties.push('测量单位混合或无法统一，未生成表现趋势。');
  if (points.length < MIN_TREND_POINTS) uncertainties.push('可比较表现点不足，暂不外推长期趋势。');
  if (recovery.length < 2) uncertainties.push('恢复记录不足，不能确认恢复模式。');
  const lastDirection = comparisons.at(-1)?.direction;
  const trendStatus = qualityStatus !== 'complete' || comparisons.length === 0 ? 'unknown'
    : lastDirection === 'up' ? 'improving'
      : lastDirection === 'down' && improvementCount === 0 ? 'declining' : 'mixed';
  const plateauStatus = qualityStatus === 'complete' && !mixedUnits && weeks.size >= 8
    && comparisons.length >= 3 && improvementCount === 0 ? 'candidate' : 'not_concluded';
  return {
    schema_version: '1.0',
    data_range: { start, end, weeks_observed: weeks.size },
    quality: { status: qualityStatus, records: sourceRecords.length, valid_records: validRecords.length, missing_dates: [...new Set([...missingDates, ...actualMissingDates])], warnings: warnings.slice(), mixed_units: mixedUnits },
    adherence: { rates, current_rate: rates.filter((item) => item.known).at(-1)?.rate, sustained_low: rates.length >= 2 && rates.slice(-2).every((item) => item.known && item.rate < LOW_ADHERENCE_THRESHOLD), status: !rates.length || rates.some((item) => !item.known) ? 'unknown' : rates.length >= 2 && rates.slice(-2).every((item) => item.known && item.rate < LOW_ADHERENCE_THRESHOLD) ? 'low_sustained' : 'observed', threshold: LOW_ADHERENCE_THRESHOLD },
    performance: { points, comparisons, improvement_count: improvementCount, decline_count: declineCount, trend_status: trendStatus, trend: trendStatus, plateau_status: plateauStatus },
    recovery: { observations: recovery, poor_count: poorRecoveryCount, status: !associatedRecovery.length ? 'unknown' : poorRecoveryCount >= 2 ? 'poor' : 'not_confirmed' },
    evidence: { record_ids: sourceRecords.map(recordId), comparison_record_ids: comparisons.flatMap((item) => item.source_record_ids) },
    review_date: input.review_date ?? input.reviewDate,
    facts: [
      { code: 'records_observed', value: sourceRecords.length, source_record_ids: sourceRecords.map(recordId) },
      { code: 'comparable_performance_comparisons', value: comparisons.length, source_record_ids: comparisons.flatMap((item) => item.source_record_ids) },
      { code: 'completion_rate_windows', value: rates.length, source_record_ids: rates.flatMap((item) => item.source_record_ids) },
      { code: 'poor_recovery_observations', value: poorRecoveryCount, source_record_ids: recovery.flatMap((item) => item.source_record_ids) }
    ],
    uncertainties
  };
}

function judgment(code, result, facts, inference, uncertainty, decision, validation) {
  return { code, result, facts, inference, uncertainty, decision, validation };
}

function buildReviewJudgments(facts = {}) {
  const judgments = [];
  const reviewDate = facts.review_date || facts.validation?.review_date || addDays(facts.data_range?.end, 14);
  const validation = (metric) => ({ metric, review_date: reviewDate });
  if (facts.quality?.status === 'unknown') {
    judgments.push(judgment('insufficient_data', 'unknown', facts.facts || [], '无法从空记录推断计划是否有效。', facts.uncertainties || ['数据缺失。'], { action: 'collect_data', variable: 'none', rewrite_plan: false }, validation('补齐计划、实际完成、表现和恢复字段')));
    return { schema_version: '1.0', judgments, overall: 'unknown', evidence_order: EVIDENCE_ORDER.slice() };
  }
  if (facts.quality?.mixed_units) {
    judgments.push(judgment('mixed_units', 'unknown', facts.facts || [], '单位混合，不能比较表现趋势。', facts.uncertainties || ['单位混合。'], { action: 'standardize_units', variable: 'none', rewrite_plan: false }, validation('统一同一动作的负重或次数单位')));
  }
  if (facts.adherence?.sustained_low) {
    judgments.push(judgment('low_adherence', 'adjust', [{ code: 'completion_rate', value: facts.adherence.rates.slice(-2).map((item) => item.rate), source_record_ids: facts.evidence?.record_ids || [] }], '连续窗口完成率偏低，先降低计划复杂度以改善可执行性。', ['完成率不能单独解释为意志力问题。'], { action: 'reduce_complexity', variable: 'complexity', rewrite_plan: false }, validation('完成率与实际完成训练次数')));
  }
  const performance = facts.performance || {};
  if (facts.quality?.status === 'complete' && !facts.quality?.mixed_units && performance.improvement_count > 0) {
    judgments.push(judgment('comparable_improvement', 'adjust', performance.comparisons.filter((item) => item.direction === 'up'), '同动作且相近条件下表现提升，允许执行下一小步进阶。', ['仍需在下一窗口确认提升可重复。'], { action: 'progress', variable: 'progression', rewrite_plan: false }, validation('同动作同单位下的负重/次数与RIR或RPE')));
  }
  if (facts.quality?.status === 'complete' && !facts.quality?.mixed_units && performance.decline_count >= 2 && facts.recovery?.status === 'poor') {
    judgments.push(judgment('poor_recovery_with_decline', 'adjust', performance.comparisons.filter((item) => item.direction === 'down'), '多次可比较表现下降同时伴随较差恢复，优先减少训练量并复核。', ['表现下降也可能受动作技术、生活压力或记录误差影响。'], { action: 'deload', variable: 'volume', rewrite_plan: false }, validation('表现趋势、睡眠、疲劳与24–48小时恢复反应')));
  } else if (facts.quality?.status === 'complete' && !facts.quality?.mixed_units && performance.decline_count === 1 && performance.improvement_count === 0) {
    judgments.push(judgment('single_decline', 'observe', performance.comparisons.filter((item) => item.direction === 'down'), '单次下降先视为正常波动，暂不重写计划。', ['需要下一次同条件记录确认方向。'], { action: 'observe', variable: 'none', rewrite_plan: false }, validation('下一次同动作、相近条件下的表现')));
  }
  if (!judgments.some((item) => item.result === 'adjust')) {
    judgments.push(judgment('effective_structure', 'keep', facts.facts || [], '当前没有足够证据要求重写有效结构，先保留并继续记录。', facts.uncertainties || [], { action: 'keep', variable: 'none', rewrite_plan: false }, validation('完成率、同动作表现和恢复结果')));
  }
  const overall = judgments.some((item) => item.code === 'low_adherence' || item.code === 'poor_recovery_with_decline') ? 'micro_adjust'
    : judgments.some((item) => item.code === 'comparable_improvement') ? 'progress'
      : judgments.some((item) => item.code === 'single_decline') ? 'observe' : 'continue';
  return { schema_version: '1.0', judgments, overall, evidence_order: EVIDENCE_ORDER.slice() };
}

function clone(value) {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {};
}

function setPath(target, path, value) {
  const keys = path.split('.'); let cursor = target;
  keys.slice(0, -1).forEach((key) => { if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}; cursor = cursor[key]; });
  cursor[keys.at(-1)] = value;
}

function getPath(target, path) {
  return path.split('.').reduce((cursor, key) => cursor === undefined || cursor === null ? undefined : cursor[key], target);
}

function applyChange(program, item) {
  const result = clone(program);
  let path; let from; let to;
  if (item.variable === 'complexity') {
    path = typeof getPath(result, 'session_budget.movement_slots') === 'number' ? 'session_budget.movement_slots' : 'session_budget.total_work_sets_max';
    from = getPath(result, path);
    to = typeof from === 'number' && from > 1 ? from - 1 : undefined;
  } else if (item.variable === 'volume') {
    path = typeof getPath(result, 'session_budget.total_work_sets_max') === 'number' ? 'session_budget.total_work_sets_max' : 'session_budget.sets_per_slot.max';
    from = getPath(result, path);
    to = typeof from === 'number' && from > 1 ? Math.max(1, Math.floor(from * 0.75)) : undefined;
  } else if (item.variable === 'progression') {
    path = 'progression_rule'; from = getPath(result, path);
    to = `${text(from, 'progress_repetitions_before_load')} | next_smallest_progression_step`;
  }
  if (to === undefined) { path = `review_adjustments.${item.variable}`; from = getPath(result, path); to = item.action; }
  setPath(result, path, to);
  return { result, path, from, to };
}

function diffObjects(before, after, prefix = '') {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort();
  const diffs = [];
  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const left = before?.[key]; const right = after?.[key];
    if (left && right && typeof left === 'object' && typeof right === 'object' && !Array.isArray(left) && !Array.isArray(right)) diffs.push(...diffObjects(left, right, path));
    else if (JSON.stringify(left) !== JSON.stringify(right)) diffs.push({ path, from: left === undefined ? 'unknown' : left, to: right === undefined ? 'unknown' : right });
  }
  return diffs;
}

function selectProgramChanges(judgmentsInput = {}, currentProgram = {}) {
  const priority = { low_adherence: 1, poor_recovery_with_decline: 2, comparable_improvement: 3 };
  const judgments = asArray(judgmentsInput.judgments ?? judgmentsInput).slice().sort((a, b) => (priority[a?.code] || 9) - (priority[b?.code] || 9));
  const proposed = clone(currentProgram);
  const changes = []; const kept = [];
  const seen = new Set();
  for (const item of judgments) {
    if (!item || item.result !== 'adjust' || !item.decision || seen.has(item.decision.variable) || changes.length >= 2) continue;
    const reviewDate = item.validation?.review_date || judgmentsInput.review_date || judgmentsInput.reviewDate
      || addDays(judgmentsInput.data_range?.end, 14);
    if (!dateValue(reviewDate)) continue;
    seen.add(item.decision.variable);
    const applied = applyChange(proposed, item.decision);
    const ids = (item.facts || []).flatMap((fact) => asArray(fact.source_record_ids));
    changes.push({
      variable: item.decision.variable,
      path: applied.path,
      from: applied.from === undefined ? 'unknown' : applied.from,
      to: applied.to,
      expected_effect: item.decision.variable === 'complexity' ? '提高完成率并降低执行摩擦。' : item.decision.variable === 'volume' ? '降低疲劳，改善下一窗口恢复。' : '在相近条件下获得可重复的小幅表现提升。',
      rollback_condition: item.decision.variable === 'complexity' ? '连续复核窗口完成率未改善或用户反馈仍不可执行时恢复上一版本并重新核对计划结构。' : item.decision.variable === 'volume' ? '恢复和动作质量未改善，或出现新的不可接受不适时回退并停止相关自动调整。' : '下一窗口表现未保持或RIR/RPE超出目标时回退进阶。',
      review_date: reviewDate,
      evidence_record_ids: [...new Set(ids.filter(Boolean).map(String))]
    });
    Object.assign(proposed, applied.result);
  }
  if (judgments.some((item) => item.code === 'effective_structure' || item.code === 'comparable_improvement')) kept.push('当前有效的动作选择与记录方式');
  if (!kept.length) kept.push('安全边界、同动作比较原则和未触发调整的计划字段');
  const fromVersion = text(currentProgram.version, 'unknown');
  const toVersion = changes.length ? (fromVersion === 'unknown' ? 'v2' : `${fromVersion}-reviewed`) : fromVersion;
  proposed.version = toVersion;
  const fieldDiffs = diffObjects(currentProgram, proposed);
  return { status: changes.length ? 'micro_adjust' : 'continue', kept, keep: kept, changes, current_program: clone(currentProgram), proposed_program: proposed, next_program: proposed, field_diffs: fieldDiffs, diff: fieldDiffs, program_version: { from: fromVersion, to: toVersion } };
}

function sanitizeDecision(decision = {}) {
  const changes = asArray(decision.changes);
  const invalidChanges = changes.filter((change) => !change || !dateValue(change.review_date)
    || !text(change.expected_effect).trim() || !text(change.rollback_condition).trim());
  return {
    decision: {
      ...decision,
      kept: asArray(decision.kept ?? decision.keep),
      changes: changes.filter((change) => change && dateValue(change.review_date)
        && text(change.expected_effect).trim() && text(change.rollback_condition).trim()),
      field_diffs: asArray(decision.field_diffs ?? decision.diff),
      program_version: decision.program_version || { from: 'unknown', to: 'unknown' }
    },
    rejected_changes: invalidChanges.map((change) => ({ variable: change?.variable || 'unknown', reason: 'missing_or_invalid_review_date_or_adjustment_fields' }))
  };
}

function buildDecisionLogEntry(input = {}) {
  const sourceFacts = input.facts || deriveReviewFacts(input);
  const facts = input.review_date || input.reviewDate
    ? { ...sourceFacts, review_date: input.review_date || input.reviewDate }
    : sourceFacts;
  const judgments = input.judgments || buildReviewJudgments(facts);
  const currentProgram = input.current_program || input.currentProgram || {};
  const generatedDecision = selectProgramChanges(judgments, currentProgram);
  const suppliedDecision = input.decision ? sanitizeDecision(input.decision) : null;
  const decision = suppliedDecision ? suppliedDecision.decision : generatedDecision;
  const rejectedChanges = suppliedDecision ? suppliedDecision.rejected_changes : [];
  const reviewDate = decision.changes[0]?.review_date || input.review_date || input.reviewDate || addDays(facts.data_range?.end, 14);
  return {
    schema_version: '1.0',
    date: input.date || facts.data_range?.end || 'unknown',
    data_range: facts.data_range,
    evidence_order: EVIDENCE_ORDER.slice(),
    facts: facts.facts,
    inference: judgments.judgments.map((item) => item.inference),
    uncertainty: [...new Set([
      ...judgments.judgments.flatMap((item) => item.uncertainty || []),
      ...rejectedChanges.map((item) => `外部决策调整已排除：${item.variable}缺少有效复核日期或必填回退信息。`)
    ])],
    decision: { keep: decision.kept, changes: decision.changes, do_not_change: decision.field_diffs.filter((diff) => !decision.changes.some((item) => item.path === diff.path)).map((diff) => diff.path) },
    validation: { metrics: [...new Set(judgments.judgments.map((item) => item.validation?.metric).filter(Boolean))], review_date: reviewDate },
    program_version: decision.program_version,
    current_program: decision.current_program || currentProgram,
    proposed_program: decision.proposed_program || currentProgram,
    field_diffs: decision.field_diffs,
    judgments: judgments.judgments
  };
}

module.exports = { deriveReviewFacts, buildReviewJudgments, selectProgramChanges, buildDecisionLogEntry };
