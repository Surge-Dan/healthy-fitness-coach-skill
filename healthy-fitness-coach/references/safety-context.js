'use strict';

const RED_FLAG_PATTERN = /(?:chest\s*(?:pain|pressure|tightness)|shortness\s+of\s+breath|abnormal\s+shortness\s+of\s+breath|faint(?:ing)?|near[- ]?(?:fainting|syncope)|presyncope|dizz(?:y|iness)|palpitation|progressive\s+(?:numbness|weakness)|severe\s+pain|acute\s+(?:injury|trauma)|recent\s+surgery|pregnan|post[- ]?partum|rapid(?:ly)?\s+worsen|unable\s+to\s+bear\s+weight|cannot\s+bear\s+weight|severe\s+swelling|obvious\s+deformity|bowel\s+or\s+bladder\s+(?:dysfunction|changes?)|胸痛|胸部压迫感|呼吸困难|异常气短|晕厥|接近晕厥|明显头晕|异常心悸|进行性麻木无力|大小便功能异常|剧烈疼痛|急性(?:外伤|损伤)|近期手术|妊娠|产后|快速恶化|情况紧急|无法负重|严重肿胀|明显畸形)/iu;
const SAFE_MARKER_PATTERN = /^(?:none|no(?:\s+(?:pain|flags?))?|false|0|无(?:红旗)?|没有(?:红旗)?|未报告|未提供|unknown|未知)$/iu;
const NEGATION_PREFIX_PATTERN = /(?:没有|无|未有|否认|否定|not|no|without|denies)\s*$/iu;

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
  if (typeof flag === 'string') {
    const text = flag.trim();
    return text !== '' && !SAFE_MARKER_PATTERN.test(text)
      && !(NEGATION_PREFIX_PATTERN.test(text) || (NEGATION_PREFIX_PATTERN.test(text.slice(0, Math.max(0, text.search(RED_FLAG_PATTERN)))) && !hasPositiveRedFlagText(text)));
  }
  return Boolean(flag && typeof flag === 'object' && Object.keys(flag).length > 0);
}

function hasPositiveRedFlagText(value) {
  const text = String(value || '');
  const matcher = new RegExp(RED_FLAG_PATTERN.source, 'giu');
  for (const match of text.matchAll(matcher)) {
    const before = text.slice(Math.max(0, match.index - 8), match.index);
    if (!NEGATION_PREFIX_PATTERN.test(before)) return true;
  }
  return false;
}

function hasRedFlag(input, currentState) {
  const flags = redFlagValues(input).concat(redFlagValues(currentState));
  const pain = [input.pain, input.symptoms, currentState.pain, currentState.symptoms]
    .filter((value) => value !== undefined)
    .join(' ');
  return flags.some(isMeaningfulFlag) || hasPositiveRedFlagText(flags.join(' ')) || hasPositiveRedFlagText(pain);
}


function inspectSafety(input = {}) {
  const state = input.currentState || input.current_state || {};
  const instruction = String(input.instruction || input.userInstruction || '');
  if (hasRedFlag(input, state)) return { status: 'stop', reason: 'reported_red_flag' };
  // Only a narrowly phrased educational question is exempt; personal/current symptoms are not.
  const educational = /^(?:请解释|解释一下|什么是|什么叫|what is)\s*(?:胸痛|晕厥|chest pain|fainting)[？?。.!！\s]*$/iu.test(instruction)
    || /^(?:胸痛|晕厥|chest pain|fainting)(?:是什么|是什么意思)[？?。.!！\s]*$/iu.test(instruction);
  if (educational) return { status: 'clear', reason: 'educational_question' };
  if (!hasPositiveRedFlagText(instruction)) return { status: 'clear', reason: 'no_positive_red_flag' };
  const historical = /以前|曾经|去年|历史|previously|last year|history of/iu.test(instruction);
  const current = /现在|正在|今天|刚刚|此刻|now|currently|today/iu.test(instruction);
  return { status: historical && !current ? 'clarify' : 'stop', reason: historical && !current ? 'confirm_current_symptoms' : 'current_red_flag' };
}
module.exports = { inspectSafety, hasPositiveRedFlagText };
