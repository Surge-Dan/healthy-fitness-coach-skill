'use strict';

const { normalizeCurrentState } = require('./athlete-state.js');

const RED_FLAG_PATTERN = /(?:chest\s*(?:pain|pressure|tightness)|shortness\s+of\s+breath|abnormal\s+shortness\s+of\s+breath|faint(?:ing)?|dizz(?:y|iness)|palpitation|progressive\s+(?:numbness|weakness)|severe\s+pain|acute\s+(?:injury|trauma)|recent\s+surgery|pregnan|post[- ]?partum|rapid(?:ly)?\s+worsen|胸痛|胸部压迫感|呼吸困难|异常气短|晕厥|明显头晕|异常心悸|进行性麻木无力|剧烈疼痛|急性(?:外伤|损伤)|近期手术|妊娠|产后|快速恶化|情况紧急)/iu;
const PAIN_PATTERN = /(?:pain|discomfort|sore|ache|tight(?:ness)?|stiff(?:ness)?|疼|痛|不适|紧|僵|酸)/iu;
const POOR_SLEEP_PATTERN = /(?:poor|bad|insufficient|short|差|不足|不好)/iu;
const HIGH_FATIGUE_PATTERN = /(?:high|severe|very|heavy|高|严重|很累|疲劳)/iu;
const SAFE_MARKER_PATTERN = /^(?:none|no(?:\s+(?:pain|flags?))?|false|0|无(?:红旗)?|没有(?:红旗)?|未报告|未提供|unknown|未知)$/iu;

function values(value) {
  return Array.isArray(value) ? value : [value];
}

function redFlagValues(source, output = []) {
  if (!source || typeof source !== 'object') return output;
  for (const [key, value] of Object.entries(source)) {
    if (/^red[_-]?flags?$/iu.test(key)) {
      output.push(...values(value));
    } else if (value && typeof value === 'object') {
      redFlagValues(value, output);
    }
  }
  return output;
}

function isMeaningfulFlag(flag) {
  if (flag === true) return true;
  if (typeof flag === 'number') return Number.isFinite(flag) && flag !== 0;
  if (typeof flag === 'string') return flag.trim() !== '' && !SAFE_MARKER_PATTERN.test(flag.trim());
  return Boolean(flag && typeof flag === 'object' && Object.keys(flag).length > 0);
}

function hasRedFlag(input, currentState) {
  const flags = redFlagValues(input).concat(redFlagValues(currentState));
  const pain = [input.pain, input.symptoms, currentState.pain, currentState.symptoms]
    .filter((value) => value !== undefined)
    .join(' ');
  return flags.some(isMeaningfulFlag) || RED_FLAG_PATTERN.test(flags.join(' ')) || RED_FLAG_PATTERN.test(pain);
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!/^[+-]?\d+(?:\.\d+)?(?:\s*(?:min(?:ute)?s?|小时|h))?$/iu.test(text)) return undefined;
  return Number(text.replace(/(?:\s*(?:min(?:ute)?s?|小时|h))$/iu, ''));
}

function invalidNumericState(sourceState, currentState) {
  const value = Object.hasOwn(currentState, 'available_time_min')
    ? currentState.available_time_min
    : sourceState.available_time_min;
  if (value === undefined) return false;
  const parsed = finiteNumber(value);
  return parsed === undefined || parsed < 0;
}

function hasPain(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || SAFE_MARKER_PATTERN.test(text)) return false;
  const numeric = finiteNumber(text);
  if (numeric !== undefined) return numeric > 0;
  return PAIN_PATTERN.test(text);
}

function isPoorSleep(value) {
  const numeric = finiteNumber(value);
  if (numeric !== undefined) return numeric < 6;
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || SAFE_MARKER_PATTERN.test(text)) return false;
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|小时)/iu);
  return (hours && Number(hours[1]) < 6) || POOR_SLEEP_PATTERN.test(text);
}

function isHighFatigue(value) {
  const numeric = finiteNumber(value);
  if (numeric !== undefined) return numeric >= 7;
  return typeof value === 'string' && HIGH_FATIGUE_PATTERN.test(value);
}

function selectedSession(program, sessionId) {
  const sessions = Array.isArray(program && program.session_slots) ? program.session_slots : [];
  if (sessionId !== undefined && sessionId !== null && sessionId !== '') {
    return sessions.find((session) => session.id === sessionId) || null;
  }
  return sessions[0] || null;
}

function minimumTask(program, sessionId) {
  const session = selectedSession(program, sessionId);
  const instruction = session && session.minimum_version
    ? session.minimum_version
    : (program && program.minimum_version);
  if (!instruction) return null;
  return {
    source: 'program_minimum_version',
    session_id: session ? session.id : null,
    instruction
  };
}

function standardRecordFields() {
  return ['completed', 'rpe_or_rir', 'pain_or_aerobic_minutes'];
}

function commonResult({ status, facts, reasonCodes, adjustment, minimumTask: task, stopConditions }) {
  return {
    status,
    facts,
    reason_codes: reasonCodes,
    adjustment,
    minimum_task: task,
    stop_conditions: stopConditions,
    post_training_record_fields: standardRecordFields()
  };
}

function assessTodayReadiness(input = {}) {
  const sourceState = input.currentState || input.current_state || {};
  const currentState = normalizeCurrentState(sourceState);
  const program = input.program || input.currentProgram || {};
  const sessionId = input.session_id ?? input.sessionId;
  const facts = [];

  if (hasRedFlag(input, sourceState)) {
    facts.push({ code: 'red_flag_reported', value: true });
    return commonResult({
      status: 'stop',
      facts,
      reasonCodes: ['red_flag'],
      adjustment: { variable: 'none', primary_variables_changed: 0 },
      minimumTask: null,
      stopConditions: [{ code: 'seek_appropriate_assessment', text: '出现红旗或急性严重症状时，停止自动训练处方并及时获得合适评估。' }]
    });
  }

  const pain = currentState.pain !== undefined ? currentState.pain : sourceState.pain;
  const symptoms = currentState.symptoms !== undefined ? currentState.symptoms : sourceState.symptoms;
  const painFeedback = hasPain(pain) || hasPain(symptoms);
  const fatigue = currentState.fatigue !== undefined ? currentState.fatigue : sourceState.fatigue;
  const sleep = currentState.sleep !== undefined ? currentState.sleep : sourceState.sleep;
  const plannedMinutes = finiteNumber(program.session_budget && program.session_budget.declared_minutes);
  const availableMinutes = finiteNumber(currentState.available_time_min !== undefined
    ? currentState.available_time_min
    : sourceState.available_time_min);
  const timeConstrained = availableMinutes !== undefined
    && plannedMinutes !== undefined
    && availableMinutes < plannedMinutes;
  const sessionUnknown = sessionId !== undefined
    && sessionId !== null
    && sessionId !== ''
    && !selectedSession(program, sessionId);

  const task = minimumTask(program, sessionId);
  if (painFeedback) {
    facts.push({ code: 'pain_reported', value: pain !== undefined ? pain : symptoms });
    if (timeConstrained) facts.push({ code: 'available_time_reduced', value: availableMinutes, planned_value: plannedMinutes });
    return commonResult({
      status: 'regress',
      facts,
      reasonCodes: ['pain_feedback'],
      adjustment: { variable: 'movement_variant', primary_variables_changed: 1, direction: 'choose_more_tolerable_variant' },
      minimumTask: task,
      stopConditions: [
        { code: 'stop_related_movement_if_symptoms_worsen', text: '若不适加重、影响日常功能或反复出现，停止相关动作并寻求合适评估。' },
        { code: 'reassess_pain_in_24_to_48_hours', text: '记录当下与随后24–48小时反应，再决定是否恢复。' }
      ]
    });
  }

  if (sessionUnknown) {
    facts.push({ code: 'session_not_found', value: sessionId });
    return commonResult({
      status: 'regress',
      facts,
      reasonCodes: ['session_not_found'],
      adjustment: { variable: 'session_selection', primary_variables_changed: 1, direction: 'select_known_session' },
      minimumTask: null,
      stopConditions: [{ code: 'stop_if_session_cannot_be_confirmed', text: '无法确认当前训练日时，不执行未核实的训练安排。' }]
    });
  }

  if (invalidNumericState(sourceState, currentState)) {
    facts.push({ code: 'current_state_unknown', field: 'available_time_min' });
    return commonResult({
      status: 'regress',
      facts,
      reasonCodes: ['current_state_unknown'],
      adjustment: { variable: 'state_confirmation', primary_variables_changed: 0, direction: 'confirm_available_time' },
      minimumTask: null,
      stopConditions: [{ code: 'confirm_current_state_before_training', text: '可用时间不是可解析数值，先确认当日状态后再安排训练。' }]
    });
  }

  if (timeConstrained) {
    facts.push({ code: 'available_time_reduced', value: availableMinutes, planned_value: plannedMinutes });
    if (isHighFatigue(fatigue)) facts.push({ code: 'high_fatigue_reported', value: fatigue });
    if (isPoorSleep(sleep)) facts.push({ code: 'single_night_poor_sleep_reported', value: sleep });
    return commonResult({
      status: 'regress',
      facts,
      reasonCodes: ['time_constrained'],
      adjustment: { variable: 'session_scope', primary_variables_changed: 1, direction: 'use_minimum_version' },
      minimumTask: task,
      stopConditions: [{ code: 'stop_if_time_cannot_support_safe_completion', text: '若剩余时间不足以安全完成最低版本，停止并改日安排。' }]
    });
  }

  if (isHighFatigue(fatigue)) {
    facts.push({ code: 'high_fatigue_reported', value: fatigue });
    return commonResult({
      status: 'regress',
      facts,
      reasonCodes: ['high_fatigue'],
      adjustment: { variable: 'sets', primary_variables_changed: 1, direction: 'reduce' },
      minimumTask: task,
      stopConditions: [{ code: 'stop_if_technique_or_symptoms_worsen', text: '若动作质量或症状变差，停止当次相关训练。' }]
    });
  }

  if (isPoorSleep(sleep)) {
    facts.push({ code: 'single_night_poor_sleep_reported', value: sleep });
    return commonResult({
      status: 'regress',
      facts,
      reasonCodes: ['single_night_poor_sleep'],
      adjustment: { variable: 'intensity', primary_variables_changed: 1, direction: 'reduce' },
      minimumTask: task,
      stopConditions: [{ code: 'stop_if_warm_up_is_abnormally_difficult', text: '若热身表现明显异常或出现新症状，停止当次训练。' }]
    });
  }

  facts.push({ code: 'current_state_clear', value: true });
  return commonResult({
    status: 'proceed',
    facts,
    reasonCodes: ['current_state_clear'],
    adjustment: { variable: 'none', primary_variables_changed: 0 },
    minimumTask: null,
    stopConditions: [{ code: 'stop_if_red_flag_or_unacceptable_symptoms_appear', text: '若出现红旗或不可接受不适，停止当次训练。' }]
  });
}

module.exports = { assessTodayReadiness };
