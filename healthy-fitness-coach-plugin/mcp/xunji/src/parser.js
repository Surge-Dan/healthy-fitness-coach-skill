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
    const parse_status = !known || (/train_time:/i.test(raw_text) && !train_time) ? 'raw_only' : (id && (train_time || name) ? 'complete' : 'partial');
    return {
      raw_text,
      ...(id ? { id } : {}),
      ...(train_time ? { train_time } : {}),
      ...(name ? { name } : {}),
      ...(data_source ? { data_source } : {}),
      ...(setRep ? { sets: Number(setRep[1]), reps: Number(setRep[2]) } : {}),
      ...(weight ? { weight: `${weight[1]}${weight[2]}` } : {}),
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
