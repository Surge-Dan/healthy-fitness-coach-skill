'use strict';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AEROBIC_RE = /(跑步|慢跑|快走|走路|骑行|单车|自行车|游泳|划船|椭圆机|登山|爬楼|有氧|hiit|间歇跑|cycling|running|walking|swim|rowing|elliptical|cardio)/i;
const BODY_PARTS = [['胸', 'chest'], ['背', 'back'], ['肩', 'shoulders'], ['腿', 'legs'], ['股四头', 'quadriceps'], ['臀', 'glutes'], ['髋', 'hips'], ['二头', 'biceps'], ['三头', 'triceps'], ['手臂', 'arms'], ['核心', 'core'], ['腹', 'core'], ['小腿', 'calves']];

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function validDate(value) {
  const date = String(value ?? '').trim();
  if (!DATE_RE.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? undefined : date;
}

function weekStart(value) {
  const date = validDate(value);
  if (!date) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return parsed.toISOString().slice(0, 10);
}

function weekCountBetween(start, end) {
  const from = validDate(start); const to = validDate(end);
  if (!from || !to || from > to) return 0;
  const weeks = new Set();
  for (let cursor = new Date(`${from}T00:00:00Z`), finish = new Date(`${to}T00:00:00Z`); cursor <= finish; cursor.setUTCDate(cursor.getUTCDate() + 1)) weeks.add(weekStart(cursor.toISOString().slice(0, 10)));
  return weeks.size;
}

function parseWeightKg(value) {
  const amount = finiteNumber(value);
  if (amount === undefined || amount < 0) return undefined;
  return /lb|磅/i.test(String(value)) ? Number((amount * 0.45359237).toFixed(3)) : amount;
}

function parseAerobicText(text) {
  const value = String(text ?? '');
  const duration = value.match(/(?:time|时长|分钟|min)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(s|秒|m|min|分钟)?/i) || value.match(/(\d+(?:\.\d+)?)\s*分钟/i);
  const distance = value.match(/(\d+(?:\.\d+)?)\s*(km|公里|mile|英里)/i);
  const heartRate = value.match(/(\d+(?:\.\d+)?)\s*(?:bpm|心率)/i);
  return {
    duration_min: duration ? (/s|秒/i.test(duration[2] || '') ? Number(duration[1]) / 60 : Number(duration[1])) : undefined,
    distance_km: distance ? (/(mile|英里)/i.test(distance[2]) ? Number(distance[1]) * 1.60934 : Number(distance[1])) : undefined,
    avg_hr: heartRate ? Number(heartRate[1]) : undefined
  };
}

function inferKind(record, name, aerobic) {
  if (record.kind === 'rest_day' || /^(休息日|rest(?: day)?|off)$/i.test(String(name).trim())) return 'rest_day';
  if (record.kind === 'aerobic' || record.kind === 'resistance') return record.kind;
  const text = `${name || ''} ${record.notes || ''} ${record.raw_text || ''}`;
  if (AEROBIC_RE.test(text) || aerobic.duration_min !== undefined || aerobic.distance_km !== undefined || aerobic.avg_hr !== undefined) return 'aerobic';
  if (record.sets !== undefined || record.reps !== undefined || record.weight !== undefined || record.volume !== undefined) return 'resistance';
  if (/(力量|无氧|阻力|杠铃|哑铃|深蹲|卧推|硬拉|推举|拉力器)/i.test(text)) return 'resistance';
  return 'unknown';
}

function inferBodyPart(name) {
  const text = String(name ?? '');
  const match = BODY_PARTS.find(([label]) => text.includes(label));
  return match ? match[1] : undefined;
}

function stableSignature(source, date, name) {
  return [date, name, source.kind, source.sets, source.reps, source.weight, source.volume, source.duration_min, source.distance_km, source.raw_text].map((value) => String(value ?? '')).join('|');
}

function normalizeTrainingRecords(records = [], { dateStart, dateEnd } = {}) {
  const warnings = []; const sessions = []; const seen = new Set();
  const list = Array.isArray(records) ? records : [];
  const rangeStart = validDate(dateStart); const rangeEnd = validDate(dateEnd);
  list.forEach((record, index) => {
    const source = record && typeof record === 'object' ? record : { raw_text: record };
    const rawText = String(source.raw_text || '');
    const rawDate = source.record_date || source.date;
    const date = validDate(rawDate);
    if (!date) { warnings.push({ code: rawDate ? 'invalid_date' : 'missing_date', index, source_record_id: source.id }); return; }
    if ((rangeStart && date < rangeStart) || (rangeEnd && date > rangeEnd)) { warnings.push({ code: 'out_of_range', index, date, source_record_id: source.id }); return; }
    const name = String(source.title || source.name || (rawText.split(',')[1] || '')).trim() || '未命名训练';
    const key = source.id !== undefined && String(source.id).trim() ? `id:${String(source.id).trim()}` : `sig:${stableSignature(source, date, name)}`;
    if (seen.has(key)) { warnings.push({ code: 'duplicate_record', index, source_record_id: source.id }); return; }
    seen.add(key);
    const aerobic = parseAerobicText(rawText);
    const kind = inferKind(source, name, aerobic);
    const sets = finiteNumber(source.sets); const reps = finiteNumber(source.reps);
    const totalReps = finiteNumber(source.total_reps) ?? (sets !== undefined && reps !== undefined ? sets * reps : undefined);
    const weightKg = parseWeightKg(source.weight);
    const rawVolume = finiteNumber(source.volume);
    const volumeKg = source.mixed_units
      ? undefined
      : rawVolume !== undefined && /lb|磅/i.test(String(source.volume_unit || source.weight || ''))
        ? Number((rawVolume * 0.45359237).toFixed(2))
        : rawVolume ?? (sets !== undefined && reps !== undefined && weightKg !== undefined ? sets * reps * weightKg : undefined);
    const duration = finiteNumber(source.duration_min) ?? aerobic.duration_min;
    const distance = finiteNumber(source.distance_km) ?? aerobic.distance_km;
    const heartRate = finiteNumber(source.avg_hr) ?? aerobic.avg_hr;
    const rpe = finiteNumber(source.rpe);
    const rir = finiteNumber(source.rir);
    const invalidMeasurement = [duration, distance, heartRate].some((value) => value !== undefined && value < 0)
      || (rpe !== undefined && (rpe < 0 || rpe > 10))
      || (rir !== undefined && (rir < 0 || rir > 10));
    if (invalidMeasurement) warnings.push({ code: 'invalid_measurement', index, source_record_id: source.id });
    sessions.push({ date, name, kind, body_part: inferBodyPart(name), sets: sets !== undefined && sets >= 0 ? sets : undefined, reps: reps !== undefined && reps >= 0 ? reps : undefined, total_reps: totalReps !== undefined && totalReps >= 0 ? totalReps : undefined, weight_kg: weightKg, volume_kg: volumeKg !== undefined && volumeKg >= 0 ? volumeKg : undefined, duration_min: duration !== undefined && duration >= 0 ? duration : undefined, distance_km: distance !== undefined && distance >= 0 ? distance : undefined, avg_hr: heartRate !== undefined && heartRate >= 0 ? heartRate : undefined, rpe: rpe !== undefined && rpe >= 0 && rpe <= 10 ? rpe : undefined, rir: rir !== undefined && rir >= 0 && rir <= 10 ? rir : undefined, completed: typeof source.completed === 'boolean' ? source.completed : undefined, notes: Array.isArray(source.notes) ? source.notes.slice() : (source.notes ? [String(source.notes)] : []), source_record_id: source.id !== undefined ? String(source.id) : undefined, source_date: rawDate });
    if (source.mixed_units) warnings.push({ code: 'mixed_units', index, source_record_id: source.id });
    if (kind === 'unknown') warnings.push({ code: 'unknown_training_kind', index, source_record_id: source.id });
  });
  const dates = [...new Set(sessions.filter((session) => session.kind !== 'rest_day').map((session) => session.date))].sort();
  const quality = { records_total: list.length, valid_records: sessions.length, invalid_records: list.length - sessions.length, warning_count: warnings.length, date_coverage: list.length ? Number((sessions.length / list.length).toFixed(3)) : 0, complete: warnings.length === 0 };
  return { sessions, warnings, dates, quality };
}

function statusFor(exposureCount, weekCount, measurementCount = 0, comparableCount = 0, variationCount = 0, incomplete = false) {
  if (!exposureCount) return { status: 'no_data', confidence: 'none' };
  if (exposureCount === 1) return { status: 'observed', confidence: 'low' };
  if (incomplete || exposureCount < 4 || weekCount < 3 || measurementCount < 2 || comparableCount < 2 || variationCount < 1) return { status: 'emerging', confidence: 'medium' };
  return { status: 'supported', confidence: 'high' };
}

function evidenceFor(sessions, formatter) { return sessions.slice(0, 12).map((session) => ({ date: session.date, source_record_id: session.source_record_id, summary: formatter(session) })); }

function dimension({ sessions, weekCount, hypothesis, nextValidation, emptyUnknown, measurement, incomplete = false }) {
  const measured = sessions.filter((session) => { const value = measurement(session); return value && Object.values(typeof value === 'object' ? value : { value }).some((item) => item !== undefined && item !== null); }); const series = new Map();
  measured.forEach((session) => { const key = session.name; const list = series.get(key) || []; list.push(session); series.set(key, list); });
  const comparableCount = [...series.values()].reduce((sum, list) => sum + Math.max(0, list.length - 1), 0);
  const variationCount = [...series.values()].filter((list) => new Set(list.map((session) => JSON.stringify(measurement(session)))).size > 1).length;
  const status = statusFor(sessions.length, weekCount, measured.length, comparableCount, variationCount, incomplete);
  if (!sessions.length) return { status: 'no_data', confidence: 'none', facts: [], hypotheses: [], evidence: [], next_validation: emptyUnknown, unknown: true };
  return { ...status, facts: [`数据中记录了${sessions.length}次相关训练`, ...(measured.length ? [`其中${measured.length}次包含可比较结果`] : ['没有可比较的结果字段'])], hypotheses: [hypothesis], evidence: evidenceFor(sessions, (session) => `${session.name}；${session.date}`), next_validation: nextValidation, unknown: false };
}

function extractTrainingDNA({ records = [], dateStart, dateEnd, generatedAt = new Date().toISOString(), plannedSessionsPerWeek, profile = null, missingDates = [], reviewWindows, windows, reviews, reviewFacts, review_facts, reviewDecisions, review_decisions, reviewDecision, review_decision, facts, decision, previousDNA, previous_dna, revoked_dimensions, reason } = {}) {
  if (reviewWindows || windows || reviews || reviewFacts || review_facts || facts || decision) {
    return consumeReviewEvidence({ windows: reviewWindows || windows || reviews, reviewFacts: reviewFacts || review_facts, reviewDecisions: reviewDecisions || review_decisions, reviewDecision: reviewDecision || review_decision, facts, decision, previousDNA: previousDNA || previous_dna, revoked_dimensions, reason, generatedAt });
  }
  const normalized = normalizeTrainingRecords(records, { dateStart, dateEnd });
  const warnings = normalized.warnings.slice();
  const plannedValue = finiteNumber(plannedSessionsPerWeek);
  const planned = plannedValue !== undefined && plannedValue >= 0 && plannedValue <= 14 ? plannedValue : undefined;
  if (plannedSessionsPerWeek !== undefined && planned === undefined) warnings.push({ code: 'invalid_planned_frequency', value: plannedSessionsPerWeek });
  const active = normalized.sessions.filter((session) => session.kind === 'resistance' || session.kind === 'aerobic');
  const resistance = active.filter((session) => session.kind === 'resistance'); const aerobic = active.filter((session) => session.kind === 'aerobic');
  const allDates = [...new Set(active.map((session) => session.date))].sort();
  const start = validDate(dateStart) || allDates[0]; const end = validDate(dateEnd) || allDates.at(-1) || start;
  const weeks = new Set(active.map((session) => weekStart(session.date)).filter(Boolean));
  const resistanceWeeks = new Set(resistance.map((session) => weekStart(session.date)).filter(Boolean)); const aerobicWeeks = new Set(aerobic.map((session) => weekStart(session.date)).filter(Boolean));
  const bodyDistribution = {}; resistance.forEach((session) => { if (session.body_part && session.sets !== undefined) bodyDistribution[session.body_part] = (bodyDistribution[session.body_part] || 0) + session.sets; });
  const totalResistanceVolume = resistance.reduce((sum, session) => sum + (session.volume_kg || 0), 0); const totalAerobicMinutes = aerobic.reduce((sum, session) => sum + (session.duration_min || 0), 0);
  const denominatorWeeks = weekCountBetween(start, end) || weeks.size; const completedActive = active.filter((session) => session.completed !== false).length; const completionRate = planned && denominatorWeeks ? Number((completedActive / (planned * denominatorWeeks)).toFixed(3)) : undefined;
  const resistanceNames = [...new Set(resistance.map((session) => session.name))]; const aerobicNames = [...new Set(aerobic.map((session) => session.name))];
  const profileObject = profile && typeof profile === 'object' ? profile : null; const profileFacts = profileObject ? Object.entries(profileObject).filter(([, value]) => value !== undefined && value !== '').slice(0, 8).map(([key, value]) => `${key}=${String(value)}`) : [];
  const profileDimension = (facts, nextValidation) => facts.length ? { status: 'observed', confidence: 'low', facts, hypotheses: [], evidence: [], next_validation: nextValidation, unknown: false } : { status: 'no_data', confidence: 'none', facts: [], hypotheses: [], evidence: [], next_validation: nextValidation, unknown: true };
  const dimensions = {
    goal_constraints: profileDimension(profileFacts.filter((fact) => /goal|目标|priority|优先/i.test(fact)), '补充目标、优先级和成功指标后更新'),
    constraints: profileDimension(profileFacts.filter((fact) => /time|时间|equipment|器械|frequency|频率|场地/i.test(fact)), '补充时间、频率、场地和器械后更新'),
    execution_preferences: profileDimension(profileFacts.filter((fact) => /preference|偏好|喜欢|不喜欢|adherence|依从/i.test(fact)), '记录偏好、不喜欢的动作、时长和训练环境后更新'),
    resistance_response: dimension({ sessions: resistance, weekCount: resistanceWeeks.size, incomplete: missingDates.length > 0, hypothesis: resistance.length > 1 ? `阻力训练中${resistanceNames.slice(0, 2).join('、')}出现重复暴露；当前仅在有可比较结果时支持反应假设` : '当前阻力训练样本不足，暂不能判断稳定反应', nextValidation: '再收集至少2～3个复盘窗口，并尽量保持动作、负重、RPE和训练间隔可比', emptyUnknown: '需要至少2次阻力训练记录', measurement: (session) => ({ weight_kg: session.weight_kg, volume_kg: session.volume_kg, rpe: session.rpe, rir: session.rir }) }),
    aerobic_response: dimension({ sessions: aerobic, weekCount: aerobicWeeks.size, incomplete: missingDates.length > 0, hypothesis: aerobic.length > 1 ? `有氧训练中${aerobicNames.slice(0, 2).join('、')}出现重复暴露；当前仅在有可比较结果时支持反应假设` : '当前有氧训练样本不足，暂不能判断稳定反应', nextValidation: '再收集至少2～3个复盘窗口，并记录时长、距离、强度、心率或配速', emptyUnknown: '需要至少2次有氧训练记录', measurement: (session) => ({ duration_min: session.duration_min, distance_km: session.distance_km, avg_hr: session.avg_hr }) }),
    recovery_response: { status: 'no_data', confidence: 'none', facts: [], hypotheses: [], evidence: [], next_validation: '记录睡眠、压力、第二天状态和训练后疲劳后更新', unknown: true },
    adherence: planned && denominatorWeeks ? { status: 'observed', confidence: 'low', facts: [`按${denominatorWeeks}个日历周计算，计划完成率约${Math.round((completionRate || 0) * 100)}%`], hypotheses: [], evidence: [], next_validation: '继续记录计划次数和实际完成次数，并补充缺失周', unknown: false } : { status: 'no_data', confidence: 'none', facts: [], hypotheses: [], evidence: [], next_validation: '提供计划训练频率或每周目标后更新', unknown: true },
    risk_boundaries: { status: 'no_data', confidence: 'none', facts: [], hypotheses: [], evidence: [], next_validation: '持续记录疼痛、不适和动作限制；出现红旗时转专业评估', unknown: true }
  };
  const unknowns = Object.entries(dimensions).filter(([, value]) => value.unknown).map(([key]) => key);
  const dataQuality = { ...normalized.quality, warning_count: warnings.length, missing_dates: missingDates.slice(), complete: warnings.length === 0 && missingDates.length === 0 };
  return { schema_version: '1.0', generated_at: generatedAt, data_range: { date_start: start, date_end: end, weeks_observed: weeks.size, records: normalized.quality.records_total }, data_quality: dataQuality, metrics: { training_days: allDates.length, sessions: active.length, rest_days: normalized.sessions.filter((session) => session.kind === 'rest_day').length, resistance: { sessions: resistance.length, sets: resistance.reduce((sum, session) => sum + (session.sets || 0), 0), total_reps: resistance.reduce((sum, session) => sum + (session.total_reps || 0), 0), volume_kg: Number(totalResistanceVolume.toFixed(2)), sessions_per_week: resistanceWeeks.size ? Number((resistance.length / resistanceWeeks.size).toFixed(2)) : 0, body_distribution: bodyDistribution }, aerobic: { sessions: aerobic.length, duration_min: Number(totalAerobicMinutes.toFixed(2)), distance_km: Number(aerobic.reduce((sum, session) => sum + (session.distance_km || 0), 0).toFixed(2)), sessions_per_week: aerobicWeeks.size ? Number((aerobic.length / aerobicWeeks.size).toFixed(2)) : 0 }, adherence: completionRate }, dimensions, unknowns, warnings, evidence_ledger: active.map((session) => ({ date: session.date, source_record_id: session.source_record_id, kind: session.kind, name: session.name })) };
}

function compareTrainingDNA(previous = {}, current = {}) {
  const before = previous.dimensions || {}; const after = current.dimensions || {}; const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes = keys.filter((key) => JSON.stringify(before[key] || null) !== JSON.stringify(after[key] || null)).map((key) => ({ dimension: key, from: before[key] || null, to: after[key] || null }));
  return { changed_dimensions: changes.map((change) => change.dimension), changes };
}

// The review consumer intentionally accepts only the standard facts and
// decisions emitted by review-decision-engine. Raw training rows belong to
// extractTrainingDNA; accepting them here would count the same evidence twice.
function reviewWindows(input = {}) {
  const supplied = input.windows || input.review_windows || input.reviews;
  if (Array.isArray(supplied)) return supplied;
  if (supplied && typeof supplied === 'object') return [supplied];
  const directFactsEnvelope = input.performance || input.quality || input.data_quality || input.data_range || input.dataRange;
  const suppliedFacts = input.reviewFacts || input.review_facts || (!directFactsEnvelope ? input.facts : undefined);
  if (Array.isArray(suppliedFacts)) {
    const suppliedDecisions = input.reviewDecisions || input.review_decisions || decisionAliasValues(input, suppliedFacts.length);
    return suppliedFacts.map((facts, index) => {
      const nestedFacts = facts?.facts || facts?.review_facts || facts?.reviewFacts;
      if (nestedFacts && typeof nestedFacts === 'object' && !Array.isArray(nestedFacts)) {
        const hasWindowDecision = facts.decision || facts.review_decision || facts.reviewDecision;
        return { ...facts, window_id: facts.window_id || `window-${index + 1}`, facts: nestedFacts, decision: hasWindowDecision ? reviewDecision(facts) : (suppliedDecisions[index] || {}) };
      }
      return { window_id: facts?.window_id || `window-${index + 1}`, facts, decision: suppliedDecisions[index] || {} };
    });
  }
  const decisionAlias = decisionAliasValue(input);
  if (suppliedFacts && typeof suppliedFacts === 'object') return [{ window_id: suppliedFacts.window_id || 'window-1', facts: suppliedFacts, decision: decisionAlias }];
  if (input.performance || input.quality || input.data_quality || input.data_range || input.dataRange) return [{ window_id: input.window_id || input.id || 'window-1', facts: input, decision: decisionAlias }];
  if (input.facts || input.review_facts || input.decision || input.review_decision) return [input];
  return [];
}

function reviewFacts(window) {
  return window?.facts || window?.review_facts || window?.reviewFacts || window?.review?.facts || {};
}

function reviewDecision(window) {
  const candidate = window?.decision || window?.review_decision || window?.reviewDecision || window?.review?.decision || {};
  if (candidate.decision && typeof candidate.decision === 'object') return { ...candidate, ...candidate.decision, nested_decision: candidate.decision };
  return candidate;
}

function decisionAliasValue(input = {}) {
  return input.decision || input.review_decision || input.reviewDecision || {};
}

function decisionAliasValues(input = {}, count = 0) {
  const explicit = input.reviewDecisions || input.review_decisions;
  if (Array.isArray(explicit)) return explicit;
  const shared = decisionAliasValue(input);
  if (Array.isArray(shared)) return shared;
  return shared && typeof shared === 'object' ? Array.from({ length: count }, () => shared) : [];
}

function sourceIds(values) {
  const result = [];
  const add = (value) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (value !== undefined && value !== null && String(value).trim()) result.push(String(value).trim());
  };
  add(values);
  return [...new Set(result)];
}

function factsSourceIds(facts, decision) {
  const ids = [];
  const addFact = (fact) => {
    if (!fact || typeof fact !== 'object') return;
    ids.push(...sourceIds(fact.source_record_ids));
  };
  (facts.facts || []).forEach(addFact);
  (facts.performance?.comparisons || []).forEach((comparison) => ids.push(...sourceIds(comparison.source_record_ids)));
  (facts.performance?.points || []).forEach((point) => ids.push(...sourceIds(point.source_record_id ?? point.source_record_ids)));
  (facts.recovery?.observations || []).forEach((observation) => ids.push(...sourceIds(observation.source_record_ids)));
  ids.push(...sourceIds(facts.evidence?.record_ids), ...sourceIds(facts.evidence?.comparison_record_ids));
  (decision.changes || []).forEach((change) => ids.push(...sourceIds(change.evidence_record_ids)));
  return [...new Set(ids)];
}

function dateRangeComplete(facts) {
  const range = facts.data_range || facts.dataRange || {};
  const quality = facts.quality || facts.data_quality || {};
  const start = validDate(range.start || range.date_start);
  const end = validDate(range.end || range.date_end);
  return Boolean(start && end && start <= end && !range.missing_dates?.length && !quality.missing_dates?.length && !facts.missing_dates?.length);
}

function pointMap(facts) {
  const result = new Map();
  (facts.performance?.points || []).forEach((point) => {
    sourceIds(point.source_record_id ?? point.source_record_ids).forEach((id) => result.set(id, point));
  });
  return result;
}

function numberPresent(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function completePerformanceComparison(comparison, facts) {
  const ids = sourceIds(comparison?.source_record_ids);
  const direction = comparison?.direction || (comparison?.after > comparison?.before ? 'up' : comparison?.after < comparison?.before ? 'down' : 'flat');
  if (!ids.length || !numberPresent(comparison?.before) || !numberPresent(comparison?.after)) return { complete: false, dimension: 'resistance_response', ids, direction };
  const metric = String(comparison.metric || '').toLowerCase();
  const aerobic = numberPresent(comparison.duration_min) || numberPresent(comparison.distance_km)
    || /duration|distance|pace|speed|heart|hr|有氧|时长|距离|配速|心率/i.test(`${metric} ${comparison.exercise || ''}`);
  const dimension = aerobic ? 'aerobic_response' : 'resistance_response';
  const points = pointMap(facts);
  const linked = ids.map((id) => points.get(id)).filter(Boolean);
  if (dimension === 'aerobic_response') {
    const complete = linked.length >= ids.length
      ? linked.every((point) => numberPresent(point.duration_min ?? point.duration) && numberPresent(point.distance_km ?? point.distance))
      : numberPresent(comparison.duration_min) && numberPresent(comparison.distance_km);
    return { complete, dimension, ids, direction };
  }
  const hasLoad = (point) => numberPresent(point.load_kg ?? point.weight_kg)
    || (numberPresent(point.value) && /load|weight|负重/i.test(String(point.metric || '')));
  const comparisonHasLoad = numberPresent(comparison.load_kg ?? comparison.weight_kg)
    || (numberPresent(comparison.value) && /load|weight|负重/i.test(String(comparison.metric || '')));
  const complete = linked.length >= ids.length
    ? linked.every((point) => hasLoad(point)
      && (numberPresent(point.rir) || numberPresent(point.rpe)))
    : (comparisonHasLoad
      && (numberPresent(comparison.rir) || numberPresent(comparison.rpe)));
  return { complete, dimension, ids, direction };
}

function reviewQuality(facts, decision) {
  const quality = facts.quality || facts.data_quality || {};
  const warnings = [...(quality.warnings || []), ...(facts.warnings || [])];
  const warningCodes = warnings.map((warning) => String(warning?.code ?? warning).toLowerCase());
  const duplicateRecordIds = sourceIds(warnings.filter((warning) => warningCodes[warnings.indexOf(warning)] === 'duplicate_record').flatMap((warning) => warning.source_record_id));
  const ids = factsSourceIds(facts, decision);
  const comparisons = (facts.performance?.comparisons || []).map((comparison) => completePerformanceComparison(comparison, facts));
  const completeComparisons = comparisons.filter((comparison) => comparison.complete);
  const dimensionComparisons = {
    resistance_response: completeComparisons.filter((comparison) => comparison.dimension === 'resistance_response'),
    aerobic_response: completeComparisons.filter((comparison) => comparison.dimension === 'aerobic_response')
  };
  const issueCodes = [...new Set([
    ...(quality.missing_dates || []), ...(facts.missing_dates || []),
    quality.mixed_units ? 'mixed_units' : '',
    ...warningCodes.filter((code) => code === 'duplicate_record' || code === 'mixed_units' || code === 'invalid_date')
  ].filter(Boolean))];
  return {
    complete: quality.status === 'complete' && issueCodes.length === 0 && dateRangeComplete(facts),
    partial: quality.status === 'partial' || issueCodes.length > 0 || !dateRangeComplete(facts),
    mixed_units: Boolean(quality.mixed_units || warningCodes.includes('mixed_units')),
    duplicate_record_ids: duplicateRecordIds.length ? duplicateRecordIds : (warningCodes.includes('duplicate_record') ? ids : []),
    comparisons,
    completeComparisons,
    dimensionComparisons,
    source_record_ids: ids
  };
}

function dimensionHypothesis(dimension, windows, decisions) {
  const relevant = dimension === 'resistance_response' ? '阻力训练' : '有氧训练';
  const inferred = decisions.flatMap((decision) => (decision.judgments || []).filter((judgment) => {
    if (!judgment || judgment.decision?.variable === 'complexity' || judgment.code === 'low_adherence') return false;
    const text = JSON.stringify(judgment).toLowerCase();
    return dimension === 'resistance_response'
      ? /load|weight|负重|阻力|rir|rpe|卧推|深蹲|硬拉/.test(text) && !/duration|distance|有氧|跑步/.test(text)
      : /duration|distance|pace|heart|时长|距离|配速|心率|有氧|跑步/.test(text);
  }).map((judgment) => judgment.inference).filter(Boolean));
  return inferred[0] || `${relevant}在复盘窗口中出现可比较结果；这只是候选规律，不能替代下一窗口验证。`;
}

function buildConsumedDimension(dimension, windows, decisions, quality, previousDimension) {
  const comparableWindows = windows.filter((window) => reviewQuality(reviewFacts(window), reviewDecision(window)).dimensionComparisons[dimension]?.length);
  const completeWindows = windows.filter((window) => reviewQuality(reviewFacts(window), reviewDecision(window)).complete);
  const allComparisons = quality.comparisons.filter((comparison) => comparison.dimension === dimension && comparison.complete);
  if (previousDimension && !allComparisons.length) return previousDimension;
  const hasDimensionComparisons = quality.comparisons.some((comparison) => comparison.dimension === dimension);
  const hasData = windows.length > 0 && (allComparisons.length > 0 || comparableWindows.length > 0 || hasDimensionComparisons);
  const hasEvidenceGap = windows.some((window) => {
    const facts = reviewFacts(window); const windowQuality = reviewQuality(facts, reviewDecision(window));
    return !windowQuality.complete || !windowQuality.dimensionComparisons[dimension]?.length;
  });
  let status = 'no_data'; let confidence = 'none'; let evidenceStage = 'unknown';
  if (hasData) {
    status = 'observed'; confidence = 'low'; evidenceStage = 'observation';
    if (comparableWindows.length >= 2 && completeWindows.length === windows.length && !quality.mixed_units && !quality.duplicate_record_ids.length) {
      status = 'candidate'; confidence = 'medium'; evidenceStage = 'candidate_rule';
    }
    if (comparableWindows.length >= 3 && completeWindows.length === windows.length && !quality.mixed_units && !quality.duplicate_record_ids.length) {
      status = 'validated'; confidence = 'high'; evidenceStage = 'validated_rule';
    }
  }
  const counterevidence = [];
  const declines = quality.comparisons.filter((comparison) => comparison.dimension === dimension && comparison.direction === 'down').length;
  if (declines) counterevidence.push(`复盘事实中出现${declines}次下降，不能只保留提升解释。`);
  else counterevidence.push('当前窗口没有足够反向结果；下一次下降仍可能推翻该规律。');
  const confounders = ['动作变式、技术、睡眠、压力和训练间隔可能混杂结果。'];
  if (quality.mixed_units) confounders.push('单位混合使不同窗口不可直接比较。');
  if (quality.duplicate_record_ids.length) confounders.push('重复记录已去重，剩余窗口数量不能等同于独立证据量。');
  const facts = hasData
    ? [`消费${comparableWindows.length}个包含${dimension === 'resistance_response' ? '阻力' : '有氧'}可比较结果的复盘窗口。`]
    : [];
  const unknown = !hasData || hasEvidenceGap || quality.mixed_units || quality.duplicate_record_ids.length > 0;
  const nextValidation = dimension === 'resistance_response'
    ? '再完成至少1～2个复盘窗口，并保持动作、负重、RPE/RIR、组数和日期范围可比。'
    : '再完成至少1～2个复盘窗口，并记录时长、距离、强度/心率和日期范围。';
  return {
    status, confidence, evidence_stage: evidenceStage, facts,
    hypotheses: hasData ? [dimensionHypothesis(dimension, windows, decisions)] : [],
    decision_summary: decisions.flatMap((decision) => [...(decision.keep || decision.kept || []), ...(decision.changes || []).map((change) => `${change.variable || 'unknown'}调整`)]).slice(0, 8),
    counterevidence, confounders, evidence: allComparisons.slice(0, 12).map((comparison) => ({ source_record_ids: comparison.ids, direction: comparison.direction || 'unknown' })),
    next_validation: nextValidation, unknown, source: 'review_facts_and_decisions', previous_status: previousDimension?.status || undefined
  };
}

function buildConsumedRecoveryDimension(windows, previousDimension, globalQuality = {}) {
  const completeWindows = windows.filter((window) => {
    const facts = reviewFacts(window); const recovery = facts.recovery || {}; const windowQuality = reviewQuality(facts, reviewDecision(window));
    const observations = recovery.observations || [];
    return windowQuality.complete && !windowQuality.mixed_units && !windowQuality.duplicate_record_ids.length
      && recovery.status !== 'unknown' && observations.some((observation) => validDate(observation.date)
        && [observation.sleep_hours, observation.fatigue, observation.stress, observation.second_day_status].some((value) => value !== undefined && value !== null && value !== '')
        || validDate(observation.date) && typeof observation.status === 'string' && !/unknown|not[_ -]?confirmed/i.test(observation.status));
  });
  const hasData = windows.some((window) => (reviewFacts(window).recovery?.observations || []).length > 0);
  if (previousDimension && !completeWindows.length) return previousDimension;
  let status = 'no_data'; let confidence = 'none'; let evidenceStage = 'unknown';
  if (hasData) {
    status = 'observed'; confidence = 'low'; evidenceStage = 'observation';
    if (completeWindows.length >= 2 && completeWindows.length === windows.length) { status = 'candidate'; confidence = 'medium'; evidenceStage = 'candidate_rule'; }
    if (completeWindows.length >= 3 && completeWindows.length === windows.length) { status = 'validated'; confidence = 'high'; evidenceStage = 'validated_rule'; }
  }
  const counterevidence = ['恢复结果可能与训练量、生活压力或记录时点不一致有关；下一次异常结果应重新评估。'];
  return {
    status, confidence, evidence_stage: evidenceStage,
    facts: hasData ? [`消费${completeWindows.length}个包含带日期恢复结果的复盘窗口。`] : [],
    hypotheses: hasData ? ['恢复结果与训练表现的关系仍需在相近训练条件下验证。'] : [],
    counterevidence, confounders: ['睡眠、压力、营养、疼痛和测量时点可能混杂恢复解释。'],
    evidence: completeWindows.flatMap((window) => (reviewFacts(window).recovery?.observations || []).filter((observation) => validDate(observation.date)).slice(0, 4).map((observation) => ({ date: observation.date, source_record_ids: sourceIds(observation.source_record_ids) }))),
    next_validation: '再完成至少1～2个带日期恢复结果的复盘窗口，并关联训练表现与训练间隔。',
    unknown: !hasData || completeWindows.length !== windows.length || globalQuality.mixed_units || globalQuality.duplicate_record_ids?.length > 0, source: 'review_facts_and_decisions', previous_status: previousDimension?.status || undefined
  };
}

function consumeReviewEvidence(input = {}) {
  const windows = reviewWindows(input);
  const previous = input.previousDNA || input.previous_dna || input.previous || {};
  const decisions = windows.map(reviewDecision);
  const qualities = windows.map((window) => reviewQuality(reviewFacts(window), reviewDecision(window)));
  const allIds = []; const duplicateRecordIds = [];
  const evidenceLedger = qualities.map((quality, index) => {
    const uniqueIds = quality.source_record_ids.filter((id) => {
      if (allIds.includes(id)) { duplicateRecordIds.push(id); return false; }
      allIds.push(id); return true;
    });
    duplicateRecordIds.push(...quality.duplicate_record_ids);
    return { window_id: windows[index]?.window_id || windows[index]?.id || `window-${index + 1}`, source_record_ids: uniqueIds, comparable_results: quality.completeComparisons.length, quality_status: quality.complete ? 'complete' : 'partial' };
  });
  const quality = {
    status: !windows.length ? 'unknown' : qualities.every((item) => item.complete) && !duplicateRecordIds.length ? 'complete' : qualities.some((item) => item.complete) ? 'partial' : 'unknown',
    windows_observed: windows.length, comparable_windows: { resistance_response: qualities.filter((item) => item.dimensionComparisons.resistance_response.length).length, aerobic_response: qualities.filter((item) => item.dimensionComparisons.aerobic_response.length).length },
    duplicate_record_ids: [...new Set(duplicateRecordIds)], mixed_units: qualities.some((item) => item.mixed_units), raw_records_consumed: 0,
    warnings: [...new Set(qualities.flatMap((item) => item.comparisons.filter((comparison) => !comparison.complete).map(() => 'incomplete_comparison')))]
  };
  const allComparisons = []; const comparisonKeys = new Set();
  qualities.flatMap((item) => item.comparisons).forEach((comparison) => {
    const key = `${comparison.dimension}|${comparison.ids.join('|')}`;
    if (!comparisonKeys.has(key)) { comparisonKeys.add(key); allComparisons.push(comparison); }
  });
  const unknownDimension = (previousDimension) => previousDimension || { status: 'no_data', confidence: 'none', evidence_stage: 'unknown', facts: [], hypotheses: [], counterevidence: [], confounders: [], evidence: [], next_validation: '补充对应复盘事实和决策后更新。', unknown: true, source: 'review_facts_and_decisions' };
  const dimensions = {
    goal_constraints: unknownDimension(previous.dimensions?.goal_constraints),
    constraints: unknownDimension(previous.dimensions?.constraints),
    execution_preferences: unknownDimension(previous.dimensions?.execution_preferences),
    adherence: unknownDimension(previous.dimensions?.adherence),
    risk_boundaries: unknownDimension(previous.dimensions?.risk_boundaries),
    ...(previous.dimensions || {}),
    resistance_response: buildConsumedDimension('resistance_response', windows, decisions, { ...quality, comparisons: allComparisons, duplicate_record_ids: quality.duplicate_record_ids }, previous.dimensions?.resistance_response),
    aerobic_response: buildConsumedDimension('aerobic_response', windows, decisions, { ...quality, comparisons: allComparisons, duplicate_record_ids: quality.duplicate_record_ids }, previous.dimensions?.aerobic_response),
    recovery_response: buildConsumedRecoveryDimension(windows, previous.dimensions?.recovery_response, quality)
  };
  const revocations = input.revoked_dimensions || input.revocations || {};
  Object.keys(revocations).forEach((dimension) => {
    if (!dimensions[dimension]) return;
    dimensions[dimension] = { ...dimensions[dimension], status: 'retired', confidence: 'none', evidence_stage: 'revoked', unknown: true, revocation_reason: typeof revocations[dimension] === 'string' ? revocations[dimension] : revocations[dimension]?.reason || '用户要求撤销该规律。', revocation_evidence_record_ids: typeof revocations[dimension] === 'object' ? sourceIds(revocations[dimension]?.evidence_record_ids) : [] };
  });
  const unknowns = Object.entries(dimensions).filter(([, dimension]) => dimension.unknown).map(([key]) => key);
  const ranges = windows.map((window) => reviewFacts(window).data_range || reviewFacts(window).dataRange || {})
    .map((range) => ({ start: validDate(range.start || range.date_start), end: validDate(range.end || range.date_end) }))
    .filter((range) => range.start && range.end);
  const changelogDimensions = Object.fromEntries(Object.keys(dimensions).map((dimension) => [dimension, {
    reason: dimensions[dimension].revocation_reason,
    evidence_record_ids: dimensions[dimension].revocation_evidence_record_ids || evidenceLedger.flatMap((entry) => entry.source_record_ids),
    window_ids: evidenceLedger.map((entry) => entry.window_id)
  }]));
  return {
    schema_version: '1.0', generated_at: input.generatedAt || new Date().toISOString(), dimensions, unknowns,
    data_range: { date_start: ranges.length ? ranges.map((range) => range.start).sort()[0] : undefined, date_end: ranges.length ? ranges.map((range) => range.end).sort().at(-1) : undefined, windows_observed: windows.length },
    data_quality: quality, evidence_ledger: evidenceLedger, decision_ledger: decisions.map((decision, index) => ({ window_id: evidenceLedger[index].window_id, keep: decision.keep || decision.kept || [], changes: decision.changes || [], review_date: decision.validation?.review_date || decision.review_date || undefined })),
    compatibility: { legacy_input_supported: true, raw_extraction_unchanged: true },
    changelog: buildDNAChangelog(previous, { dimensions }, { reason: input.reason || '消费复盘事实和决策后更新', generatedAt: input.generatedAt, dimensions: changelogDimensions })
  };
}

function buildDNAChangelog(previous = {}, current = {}, options = {}) {
  const before = previous.dimensions || {}; const after = current.dimensions || {}; const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const rank = { no_data: 0, observed: 1, emerging: 2, candidate: 2, supported: 3, validated: 3, retired: -1 };
  const fallbackEvidence = Array.isArray(current.evidence_ledger) ? current.evidence_ledger : [];
  const changes = keys.filter((key) => (before[key]?.status || 'no_data') !== (after[key]?.status || 'no_data')).map((dimension) => {
    const from = before[dimension]?.status || 'no_data'; const to = after[dimension]?.status || 'no_data';
    const action = to === 'retired' ? 'revoked' : (rank[to] < rank[from] ? 'demoted' : rank[to] > rank[from] ? 'promoted' : 'updated');
    const metadata = options.dimensions?.[dimension] || {};
    const evidenceRecordIds = metadata.evidence_record_ids ?? after[dimension]?.revocation_evidence_record_ids ?? fallbackEvidence.flatMap((entry) => entry.source_record_ids || []);
    const windowIds = metadata.window_ids ?? fallbackEvidence.map((entry) => entry.window_id);
    return { dimension, from, to, action, reason: metadata.reason || after[dimension]?.revocation_reason || options.reason || (action === 'demoted' ? '新复盘证据不足或质量下降。' : action === 'revoked' ? '规律已撤销。' : '复盘证据状态变化。'), evidence_record_ids: sourceIds(evidenceRecordIds), window_ids: sourceIds(windowIds), generated_at: options.generatedAt || new Date().toISOString() };
  });
  return { schema_version: '1.0', changes };
}

const consumeReviewWindows = consumeReviewEvidence;
const consumeReviewFacts = consumeReviewEvidence;
const buildTrainingDNAFromReviews = consumeReviewEvidence;
const buildDNAFromReview = consumeReviewEvidence;
const updateTrainingDNAFromReview = consumeReviewEvidence;

module.exports = { buildDNAChangelog, buildDNAFromReview, buildTrainingDNAFromReviews, compareTrainingDNA, consumeReviewEvidence, consumeReviewFacts, consumeReviewWindows, extractTrainingDNA, normalizeTrainingRecords, parseWeightKg, updateTrainingDNAFromReview, validDate, weekStart };
