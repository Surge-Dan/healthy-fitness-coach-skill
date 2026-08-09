'use strict';

function tokenValue(text, name) {
  if (name === 'train_time') {
    const timestamp = text.match(/(?:^|[\s,|])train_time:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/i);
    return timestamp ? timestamp[1] : undefined;
  }
  const match = text.match(new RegExp(`(?:^|[\\s,|])${name}:\\s*([^,|]+?)(?=\\s+(?:id|train_time|name|date):|[,|]|$)`, 'i'));
  return match ? match[1].trim() : undefined;
}

function sourceValue(text) {
  const match = String(text).match(/(?:^|[\s,|])(?:data_source|source)\s*[:=]\s*([^,|\s]+)/i);
  return match ? match[1] : undefined;
}

function normalizeCompactDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{6}$/.test(value)) return `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  return undefined;
}

function parseOfficialXunjiRow(text) {
  const match = String(text).match(/^\s*(\d{4}-\d{2}-\d{2}|\d{6}),(.+)$/);
  if (!match) return {};
  const tokens = [match[1], ...match[2].split(',').map((item) => item.trim())];
  const record_date = normalizeCompactDate(tokens.shift());
  let id;
  let title;
  let train_time;
  if (/^id:/i.test(tokens[0] || '')) id = tokens.shift().slice(3).trim();
  if (tokens[0] && !/^train_time:/i.test(tokens[0])) title = tokens.shift();
  if (/^train_time:/i.test(tokens[0] || '')) train_time = tokens.shift().slice('train_time:'.length).trim();
  const groups = [];
  for (let index = 0; index < tokens.length - 2; index += 1) {
    const set = tokens[index].match(/^(\d+)\s*组$/i);
    const weight = tokens[index + 1].match(/^(\d+(?:\.\d+)?)\s*(kg|lb|公斤|磅)$/i);
    const reps = tokens[index + 2].match(/^(\d+)\s*次$/i);
    if (!set || !weight || !reps) continue;
    groups.push({ sets: Number(set[1]), weight: Number(weight[1]), unit: weight[2], reps: Number(reps[1]) });
    index += 2;
  }
  const total_reps = groups.reduce((sum, group) => sum + group.sets * group.reps, 0);
  const volume = groups.reduce((sum, group) => sum + group.sets * group.reps * group.weight, 0);
  return {
    record_date,
    ...(id ? { id } : {}),
    ...(title ? { title, name: title } : {}),
    ...(train_time ? { train_time } : {}),
    ...(groups.length ? {
      sets: groups.reduce((sum, group) => sum + group.sets, 0),
      reps: groups[0].reps,
      total_reps,
      volume,
      weight: `${groups[0].weight}${groups[0].unit}`
    } : {})
  };
}

function extractNotes(text) {
  const notes = [];
  const explicitNote = String(text).match(/(?:^|[,|])\s*note\s*:\s*(.+)$/i);
  if (explicitNote) notes.push(explicitNote[1].trim());
  for (const [index, fragment] of String(text).split(/[,|]/).map((item) => item.trim()).entries()) {
    if (!fragment) continue;
    const note = fragment.match(/^note\s*:\s*(.+)$/i);
    if (note) continue;
    if (/(?:^|\s)(?:id|train_time|name|date)\s*:/i.test(fragment)) continue;
    if (/^(?:source|data_source)\s*[:=]/i.test(fragment)) continue;
    if (/(?:sets?|reps?|@|重量|组|次)/i.test(fragment)) continue;
    if (index > 0 || /[:=]/.test(fragment)) notes.push(fragment);
  }
  return notes;
}

function parseTrainingRecords(rawRecords) {
  if (!Array.isArray(rawRecords)) return [];
  return rawRecords.map((raw) => {
    const raw_text = String(raw);
    const official = parseOfficialXunjiRow(raw_text);
    const id = tokenValue(raw_text, 'id');
    const train_time = tokenValue(raw_text, 'train_time');
    const name = tokenValue(raw_text, 'name');
    const data_source = sourceValue(raw_text);
    const notes = extractNotes(raw_text);
    const warnings = [];
    const known = /(?:id|train_time|name|date):/i.test(raw_text);
    const setRep = raw_text.match(/(\d+)\s*(?:sets?|组)\s*(?:x|×)\s*(\d+)\s*(?:reps?|次)/i) || raw_text.match(/(\d+)\s*[x×]\s*(\d+)/i);
    const weight = raw_text.match(/(?:@|重量[:：]?)\s*(\d+(?:\.\d+)?)\s*(kg|公斤|lb|lbs)/i);
    if (weight && Number(weight[1]) >= 500) warnings.push('extreme_weight');
    const parse_status = official.record_date
      ? (official.id && official.title ? 'complete' : 'partial')
      : (!known || (/train_time:/i.test(raw_text) && !train_time) ? 'raw_only' : (id && (train_time || name) ? 'complete' : 'partial'));
    return {
      raw_text,
      ...(official.record_date ? { record_date: official.record_date } : {}),
      ...(official.id || id ? { id: official.id || id } : {}),
      ...(official.train_time || train_time ? { train_time: official.train_time || train_time } : {}),
      ...(official.title ? { title: official.title, name: official.name } : (name ? { name } : {})),
      ...(data_source ? { data_source } : {}),
      ...(official.sets ? { sets: official.sets, reps: official.reps, total_reps: official.total_reps, volume: official.volume, weight: official.weight } : (setRep ? { sets: Number(setRep[1]), reps: Number(setRep[2]) } : {})),
      ...(weight && !official.weight ? { weight: `${weight[1]}${weight[2]}` } : {}),
      parse_status,
      ...(notes.length ? { notes } : {}),
      ...(warnings.length ? { warnings } : {})
    };
  });
}

function filterModelFacingRecords(records) {
  const warnings = [];
  const filtered = (records || []).filter((record) => {
    const source = String(record.data_source || record.source || sourceValue(record.raw_text || '') || '').toLowerCase();
    if (source.includes('garmin')) return false;
    if (!source) warnings.push(`unknown_source:${record.id || 'record'}`);
    return true;
  });
  Object.defineProperty(filtered, 'warnings', { value: warnings, enumerable: false });
  return filtered;
}

module.exports = { filterModelFacingRecords, parseTrainingRecords, sourceValue };
