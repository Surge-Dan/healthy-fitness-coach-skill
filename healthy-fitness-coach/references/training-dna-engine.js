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
    const volumeKg = rawVolume !== undefined && /lb|磅/i.test(String(source.volume_unit || source.weight || '')) ? Number((rawVolume * 0.45359237).toFixed(2)) : rawVolume ?? (sets !== undefined && reps !== undefined && weightKg !== undefined ? sets * reps * weightKg : undefined);
    const duration = finiteNumber(source.duration_min) ?? aerobic.duration_min;
    const distance = finiteNumber(source.distance_km) ?? aerobic.distance_km;
    const heartRate = finiteNumber(source.avg_hr) ?? aerobic.avg_hr;
    if ([duration, distance, heartRate].some((value) => value !== undefined && value < 0)) warnings.push({ code: 'invalid_measurement', index, source_record_id: source.id });
    sessions.push({ date, name, kind, body_part: inferBodyPart(name), sets: sets !== undefined && sets >= 0 ? sets : undefined, reps: reps !== undefined && reps >= 0 ? reps : undefined, total_reps: totalReps !== undefined && totalReps >= 0 ? totalReps : undefined, weight_kg: weightKg, volume_kg: volumeKg !== undefined && volumeKg >= 0 ? volumeKg : undefined, duration_min: duration !== undefined && duration >= 0 ? duration : undefined, distance_km: distance !== undefined && distance >= 0 ? distance : undefined, avg_hr: heartRate !== undefined && heartRate >= 0 ? heartRate : undefined, rpe: finiteNumber(source.rpe), rir: finiteNumber(source.rir), completed: typeof source.completed === 'boolean' ? source.completed : undefined, notes: Array.isArray(source.notes) ? source.notes.slice() : (source.notes ? [String(source.notes)] : []), source_record_id: source.id !== undefined ? String(source.id) : undefined, source_date: rawDate });
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

function extractTrainingDNA({ records = [], dateStart, dateEnd, generatedAt = new Date().toISOString(), plannedSessionsPerWeek, profile = null, missingDates = [] } = {}) {
  const normalized = normalizeTrainingRecords(records, { dateStart, dateEnd });
  const active = normalized.sessions.filter((session) => session.kind !== 'rest_day');
  const resistance = active.filter((session) => session.kind === 'resistance'); const aerobic = active.filter((session) => session.kind === 'aerobic');
  const allDates = [...new Set(active.map((session) => session.date))].sort();
  const start = validDate(dateStart) || allDates[0]; const end = validDate(dateEnd) || allDates.at(-1) || start;
  const weeks = new Set(active.map((session) => weekStart(session.date)).filter(Boolean));
  const resistanceWeeks = new Set(resistance.map((session) => weekStart(session.date)).filter(Boolean)); const aerobicWeeks = new Set(aerobic.map((session) => weekStart(session.date)).filter(Boolean));
  const bodyDistribution = {}; resistance.forEach((session) => { if (session.body_part && session.sets !== undefined) bodyDistribution[session.body_part] = (bodyDistribution[session.body_part] || 0) + session.sets; });
  const totalResistanceVolume = resistance.reduce((sum, session) => sum + (session.volume_kg || 0), 0); const totalAerobicMinutes = aerobic.reduce((sum, session) => sum + (session.duration_min || 0), 0);
  const planned = finiteNumber(plannedSessionsPerWeek); const denominatorWeeks = weekCountBetween(start, end) || weeks.size; const completedActive = active.filter((session) => session.completed !== false).length; const completionRate = planned && denominatorWeeks ? Number((completedActive / (planned * denominatorWeeks)).toFixed(3)) : undefined;
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
  const dataQuality = { ...normalized.quality, missing_dates: missingDates.slice(), complete: normalized.quality.complete && missingDates.length === 0 };
  return { schema_version: '1.0', generated_at: generatedAt, data_range: { date_start: start, date_end: end, weeks_observed: weeks.size, records: normalized.quality.records_total }, data_quality: dataQuality, metrics: { training_days: allDates.length, sessions: active.length, rest_days: normalized.sessions.filter((session) => session.kind === 'rest_day').length, resistance: { sessions: resistance.length, sets: resistance.reduce((sum, session) => sum + (session.sets || 0), 0), total_reps: resistance.reduce((sum, session) => sum + (session.total_reps || 0), 0), volume_kg: Number(totalResistanceVolume.toFixed(2)), sessions_per_week: resistanceWeeks.size ? Number((resistance.length / resistanceWeeks.size).toFixed(2)) : 0, body_distribution: bodyDistribution }, aerobic: { sessions: aerobic.length, duration_min: Number(totalAerobicMinutes.toFixed(2)), distance_km: Number(aerobic.reduce((sum, session) => sum + (session.distance_km || 0), 0).toFixed(2)), sessions_per_week: aerobicWeeks.size ? Number((aerobic.length / aerobicWeeks.size).toFixed(2)) : 0 }, adherence: completionRate }, dimensions, unknowns, warnings: normalized.warnings, evidence_ledger: active.map((session) => ({ date: session.date, source_record_id: session.source_record_id, kind: session.kind, name: session.name })) };
}

function compareTrainingDNA(previous = {}, current = {}) {
  const before = previous.dimensions || {}; const after = current.dimensions || {}; const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes = keys.filter((key) => JSON.stringify(before[key] || null) !== JSON.stringify(after[key] || null)).map((key) => ({ dimension: key, from: before[key] || null, to: after[key] || null }));
  return { changed_dimensions: changes.map((change) => change.dimension), changes };
}

module.exports = { compareTrainingDNA, extractTrainingDNA, normalizeTrainingRecords, parseWeightKg, validDate, weekStart };
