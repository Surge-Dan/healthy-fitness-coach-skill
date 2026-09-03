'use strict';

const { normalizeAthleteProfile } = require('./athlete-state.js');

const DANGER_PATTERN = /(?:chest\s*pain|shortness\s+of\s+breath|faint(?:ing)?|severe\s+pain|acute\s+(?:injury|trauma)|胸痛|呼吸困难|晕厥|剧烈疼痛|急性(?:外伤|损伤))/iu;
const UNSAFE_METHOD_PATTERNS = [
  ['crash_diet', /(?:crash\s+diet|extreme\s+diet|starvation|极端节食|不吃|禁食)/iu]
];
const COUNT_WORDS = { one: 1, two: 2, 一: 1, 两: 2, 二: 2 };
const EXTREME_CHANGE_RATE_KG_PER_DAY = 0.25;

function numberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function normalizedExperience(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/(?:beginner|novice|新手|初学)/u.test(text)) return 'beginner';
  if (/(?:advanced|高级)/u.test(text)) return 'advanced';
  if (/(?:intermediate|中级|进阶)/u.test(text)) return 'intermediate';
  return 'unknown';
}

function sessionFocuses(kind) {
  const map = {
    full_body_single: ['full_body'],
    full_body_ab: ['full_body_a', 'full_body_b'],
    full_body_alternating: ['full_body_a', 'full_body_b', 'full_body_a'],
    upper_lower: ['upper', 'lower', 'upper', 'lower']
  };
  return map[kind] || [];
}

function selectProgramStructure(profile = {}) {
  const days = profile.training_days_per_week;
  let kind = 'needs_frequency';
  if (typeof days === 'number' && Number.isFinite(days) && (!Number.isInteger(days) || days < 1 || days > 7)) kind = 'invalid_frequency';
  if (Number.isInteger(days) && days >= 5 && days <= 7) kind = 'custom_structure_required';
  if (days === 1) kind = 'full_body_single';
  if (days === 2) kind = 'full_body_ab';
  if (days === 3) kind = 'full_body_alternating';
  if (days === 4) kind = 'upper_lower';

  const focuses = sessionFocuses(kind);
  return {
    kind,
    sessions_per_week: numberInRange(days, 1, 7) ? days : null,
    session_slots: focuses.map((focus, index) => ({
      id: `session_${index + 1}`,
      focus,
      reason_code: `${kind}_default`
    })),
    reason_code: kind === 'needs_frequency'
      ? 'training_frequency_unknown'
      : (kind === 'invalid_frequency' ? 'invalid_training_frequency' : (kind === 'custom_structure_required' ? 'frequency_requires_custom_structure' : `${kind}_default`))
  };
}

function buildSessionBudget({ durationMinutes, experience } = {}) {
  const novice = normalizedExperience(experience) === 'beginner';
  const knownDuration = typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0;
  const feasible = knownDuration && durationMinutes >= 15;
  const plannedMinutes = knownDuration ? Math.floor(durationMinutes) : null;
  const movementSlots = feasible
    ? Math.min(novice ? 3 : 4, durationMinutes <= 30 ? 2 : (durationMinutes <= 45 ? 3 : 4))
    : null;
  const warmUpMinutes = knownDuration ? Math.min(5, Math.floor(durationMinutes)) : null;
  const transitionMinutes = knownDuration ? Math.min(3, Math.max(0, Math.floor(durationMinutes) - warmUpMinutes)) : null;
  const workMinutes = knownDuration ? Math.max(0, Math.floor(durationMinutes) - warmUpMinutes - transitionMinutes) : null;
  const maxSetsPerSlot = !feasible
    ? 0
    : (durationMinutes <= 20 ? 1 : (durationMinutes <= 30 ? 2 : (novice ? 3 : 4)));
  return {
    declared_minutes: knownDuration ? Math.floor(durationMinutes) : null,
    planned_minutes: plannedMinutes,
    movement_slots: feasible ? movementSlots : 0,
    sets_per_slot: feasible ? { min: 1, max: maxSetsPerSlot } : { min: 0, max: 0 },
    total_work_sets_max: feasible ? movementSlots * maxSetsPerSlot : 0,
    allocation: knownDuration ? {
      warm_up_minutes: warmUpMinutes,
      work_minutes: workMinutes,
      transition_minutes: transitionMinutes
    } : null,
    feasible,
    unknown_duration: !knownDuration,
    reason_code: !knownDuration
      ? 'duration_unknown_no_exact_budget'
      : (feasible ? 'declared_duration_budget' : 'duration_too_short_for_minimum_session')
  };
}

function defaultIntensityRules({ experience, goal } = {}) {
  const novice = normalizedExperience(experience) === 'beginner';
  const cardioPriority = /(?:cardio|endurance|aerobic|心肺|耐力|健康|减脂|减重)/iu.test(String(goal || ''));
  return {
    resistance: {
      rir_target: novice ? { min: 2, max: 3 } : { min: 1, max: 3 },
      failure_policy: novice ? 'avoid_routine_failure' : 'use_failure_selectively',
      reason_code: novice ? 'novice_reserve_reps' : 'experience_matched_reserve_reps'
    },
    cardio: {
      effort_anchor: cardioPriority ? 'conversational_moderate_start' : 'health_maintenance_dose',
      progression_policy: 'increase_one_variable_at_a_time',
      reason_code: cardioPriority ? 'cardio_goal_priority' : 'cardio_health_maintenance'
    }
  };
}

function selectCycleMetrics({ goal, trackingPreference } = {}) {
  const preference = Array.isArray(trackingPreference) ? trackingPreference.map((item) => String(item).toLowerCase()) : [];
  const cardioFirst = /(?:cardio|endurance|aerobic|心肺|耐力)/iu.test(String(goal || ''));
  const metrics = cardioFirst
    ? [
      { id: 'cardio_minutes', domain: 'cardio', reason_code: 'cardio_goal_progress' },
      { id: 'cardio_effort', domain: 'cardio', reason_code: 'cardio_intensity_tolerance' },
      { id: 'resistance_completion', domain: 'resistance', reason_code: 'resistance_habit_maintenance' }
    ]
    : [
      { id: 'resistance_completion', domain: 'resistance', reason_code: 'resistance_adherence' },
      { id: 'resistance_reps_at_rir', domain: 'resistance', reason_code: 'resistance_progression' },
      { id: 'cardio_minutes', domain: 'cardio', reason_code: 'cardio_health_maintenance' }
    ];
  if (preference.includes('load') && !metrics.some((metric) => metric.id === 'resistance_load_or_reps')) {
    metrics[1] = { id: 'resistance_load_or_reps', domain: 'resistance', reason_code: 'tracking_preference_load' };
  }
  return metrics.slice(0, 3);
}

function movementModesForFocus(focus) {
  const fullBody = ['knee_dominant', 'hip_dominant', 'horizontal_push', 'horizontal_pull', 'core_or_carry'];
  if (focus === 'upper') return ['horizontal_push', 'horizontal_pull', 'vertical_push_or_pull', 'core_or_carry'];
  if (focus === 'lower') return ['knee_dominant', 'hip_dominant', 'single_leg', 'core_or_carry'];
  return fullBody;
}

function inputSafetyText(input) {
  return [
    input.goal,
    input.instruction,
    input.userInstruction,
    input.injury_or_medical_constraints
  ].filter(Boolean).join(' ');
}

function parseCount(value) {
  if (/^\d+$/u.test(value)) return Number(value);
  return COUNT_WORDS[value.toLowerCase()] || null;
}

function parseTargetChange(text) {
  const match = /(?:lose|drop|shed|减重|减脂|减肥|减|瘦)\s*(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|lb|lbs|pounds?|公斤|斤)/iu.exec(text);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const amountKg = /(?:lb|pound)/u.test(unit) ? amount * 0.453592 : (unit === '斤' ? amount * 0.5 : amount);
  return { amount_kg: Number(amountKg.toFixed(3)) };
}

function parseTimeWindow(text) {
  const match = /(\d+|one|two|一|两|二)\s*(days?|weeks?|months?|天|周|个月)/iu.exec(text);
  if (!match) return null;
  const count = parseCount(match[1]);
  if (!count) return null;
  if (/(?:week|周)/iu.test(match[2])) return { days: count * 7 };
  if (/(?:month|个月)/iu.test(match[2])) return { days: count * 30 };
  return { days: count };
}

function classifySafetyRisk(input = {}) {
  const redFlagValues = [
    input.red_flags,
    input.redFlags,
    input.safety && input.safety.red_flags,
    input.safety && input.safety.redFlags,
    input.currentState && input.currentState.red_flags,
    input.currentState && input.currentState.redFlags,
    input.current_state && input.current_state.red_flags,
    input.current_state && input.current_state.redFlags
  ].flatMap((value) => Array.isArray(value) ? value : [value]);
  const text = `${inputSafetyText(input)} ${redFlagValues.filter(Boolean).join(' ')}`;
  const target_change = parseTargetChange(text);
  const time_window = parseTimeWindow(text);
  const unsafe_methods = UNSAFE_METHOD_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([code]) => code);
  const reason_codes = [];
  if (redFlagValues.some((value) => value === true || (typeof value === 'string' && value.trim() !== '') || (value && typeof value === 'object')) || DANGER_PATTERN.test(text)) {
    reason_codes.push('danger_flag');
  }
  if (target_change && time_window && target_change.amount_kg / time_window.days >= EXTREME_CHANGE_RATE_KG_PER_DAY) reason_codes.push('extreme_change_rate');
  if (unsafe_methods.length > 0) reason_codes.push('unsafe_weight_loss_method');
  return {
    classification: reason_codes.length > 0 ? 'blocked' : 'clear',
    target_change,
    time_window,
    unsafe_methods,
    reason_codes
  };
}

function textOrUnknown(value) {
  return value === undefined || value === null || value === '' ? '未提供' : String(value);
}

function buildCurrentProgramView(plan, profile) {
  const firstSlot = plan.session_slots[0];
  const rows = plan.session_slots.map((slot, index) => {
    const content = slot.movement_slots.map((movement) => movement.movement_mode).join('、') || '待器械和限制确认';
    return `| Day ${index + 1} | ${slot.focus} | ${content} | ${textOrUnknown(plan.session_budget.declared_minutes)} min | ${slot.minimum_version} |`;
  });
  const metrics = plan.cycle_metrics.map((metric) => `[${metric.domain}] ${metric.id}`);
  return {
    cycle_name: '未提供',
    date_range: '未提供',
    primary_goal: textOrUnknown(profile.goal),
    secondary_goal: '未提供',
    version: 'rules-compiler-v1',
    program_status: plan.status,
    structure_reason_codes: plan.reason_codes.join('、'),
    missing_fields: plan.missing_fields.length > 0 ? plan.missing_fields.join('、') : '无',
    weekly_schedule_rows: rows.join('\n') || '| 未提供 | 未提供 | 待补充编排信息 | 未提供 | 未提供 |',
    movement_slots: plan.session_slots.map((slot) => `${slot.id}: ${slot.movement_slots.map((movement) => movement.movement_mode).join('、')}`).join('；') || '未提供',
    equipment_filter: firstSlot ? firstSlot.equipment_filter.join('、') || '未提供' : '未提供',
    constraint_filter: firstSlot ? firstSlot.constraint_filter : '未提供',
    substitution_boundary: firstSlot ? firstSlot.substitution_boundary : '未提供',
    progression_rules: plan.progression_rule,
    regression_rules: plan.regression_rule,
    metric_1: metrics[0] || '未提供',
    metric_2: metrics[1] || '未提供',
    metric_3: metrics[2] || '未提供',
    keep: '按周期指标与恢复反应确认',
    change: '按周期指标与恢复反应确认',
    pause: '出现安全红旗或不可接受不适时暂停',
    review_window: '周期结束时'
  };
}

function renderCurrentProgram(plan, template) {
  if (!plan || typeof plan !== 'object' || !plan.current_program) throw new TypeError('compiled plan with current_program is required');
  if (typeof template !== 'string') throw new TypeError('CURRENT_PROGRAM template text is required');
  return template.replace(/\{\{([a-z0-9_]+)\}\}/giu, (placeholder, key) => textOrUnknown(plan.current_program[key]));
}

function compileProgramRules(input = {}) {
  const safetyRisk = classifySafetyRisk(input);
  if (safetyRisk.classification === 'blocked') {
    return {
      status: 'blocked',
      reason_codes: ['safety_block', ...safetyRisk.reason_codes],
      safety_risk: safetyRisk,
      next_step: 'seek_appropriate_medical_or_qualified_professional_guidance_before_training_plan'
    };
  }

  const profile = normalizeAthleteProfile(input);
  const structure = selectProgramStructure(profile);
  const budget = buildSessionBudget({ durationMinutes: profile.available_time_min, experience: profile.experience_level });
  const missingFields = ['training_days_per_week', 'available_time_min', 'available_equipment', 'injury_or_medical_constraints']
    .filter((field) => !Object.hasOwn(profile, field));
  const requiresCustomStructure = ['invalid_frequency', 'custom_structure_required'].includes(structure.kind);
  const infeasibleDuration = !budget.feasible && budget.unknown_duration === false;
  const unresolvedDuration = budget.unknown_duration;
  if (structure.kind === 'needs_frequency') missingFields.push('training_days_per_week');
  const reasonCodes = [structure.reason_code, budget.reason_code];
  if (missingFields.length > 0 || requiresCustomStructure || infeasibleDuration) reasonCodes.push('structural_information_missing');

  const equipment = Array.isArray(profile.available_equipment)
    ? [...profile.available_equipment]
    : [];
  const slots = (requiresCustomStructure || infeasibleDuration || unresolvedDuration ? [] : structure.session_slots).map((session) => ({
    ...session,
    movement_slots: movementModesForFocus(session.focus).slice(0, budget.movement_slots || 0).map((movement_mode, index) => ({
      id: `${session.id}_slot_${index + 1}`,
      movement_mode,
      selection_boundary: 'select_from_knowledge_base_after_equipment_and_constraint_filter',
      reason_code: 'movement_pattern_slot'
    })),
    equipment_filter: equipment,
    constraint_filter: profile.injury_or_medical_constraints || 'constraint_status_unknown',
    minimum_version: `keep_first_two_movement_slots_with_one_to_${budget.sets_per_slot.max}_work_sets_each`,
    substitution_boundary: 'substitute_with_same_movement_mode_after_equipment_and_constraint_filter',
    adaptation_boundary: 'substitute_same_movement_mode_when_equipment_or_constraints_require',
    reason_code: session.reason_code
  }));

  const result = {
    status: missingFields.length > 0 || requiresCustomStructure || infeasibleDuration ? 'needs_input' : 'ready',
    profile_fields_used: Object.keys(profile).filter((key) => !['source', 'date', 'persisted', 'unknown_fields', 'field_provenance', 'storage_scope'].includes(key)),
    missing_fields: [...new Set(missingFields)],
    structure,
    session_budget: budget,
    session_slots: slots,
    intensity_rules: defaultIntensityRules({ experience: profile.experience_level, goal: profile.goal }),
    cycle_metrics: selectCycleMetrics({ goal: profile.goal, trackingPreference: profile.long_term_preferences }),
    progression_rule: 'progress_repetitions_within_target_effort_before_small_load_or_difficulty_change',
    regression_rule: 'reduce_sets_or_intensity_when_recovery_or_technique_worsens_and_keep_the_minimum_version',
    reason_codes: [...new Set(reasonCodes)],
    safety_risk: safetyRisk
  };
  return { ...result, current_program: buildCurrentProgramView(result, profile) };
}

module.exports = {
  selectProgramStructure,
  buildSessionBudget,
  defaultIntensityRules,
  selectCycleMetrics,
  classifySafetyRisk,
  compileProgramRules,
  renderCurrentProgram
};
