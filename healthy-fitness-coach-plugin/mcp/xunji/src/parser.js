'use strict';

function tokenValue(text, name) {
  if (name === 'train_time') {
    const timestamp = text.match(/(?:^|[\s,|])train_time:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/i);
    return timestamp ? timestamp[1] : undefined;
  }
  const match = text.match(new RegExp(`(?:^|[\\s,|])${name}:\\s*([^,|]+?)(?=\\s+(?:id|train_time|name|date):|[,|]|$)`, 'i'));
  return match ? match[1].trim() : undefined;
}

function parseTrainingRecords(rawRecords) {
  if (!Array.isArray(rawRecords)) return [];
  return rawRecords.map((raw) => {
    const raw_text = String(raw);
    const id = tokenValue(raw_text, 'id');
    const train_time = tokenValue(raw_text, 'train_time');
    const name = tokenValue(raw_text, 'name');
    const notes = [];
    const warnings = [];
    const known = /(?:id|train_time|name|date):/i.test(raw_text);
    const setRep = raw_text.match(/(\d+)\s*(?:sets?|组)\s*(?:x|×)\s*(\d+)\s*(?:reps?|次)/i) || raw_text.match(/(\d+)\s*[x×]\s*(\d+)/i);
    const weight = raw_text.match(/(?:@|重量[:：]?)\s*(\d+(?:\.\d+)?)\s*(kg|公斤|lb|lbs)/i);
    if (weight && Number(weight[1]) >= 500) warnings.push('extreme_weight');
    for (const part of raw_text.split(/[|]/).map((item) => item.trim())) {
      if (part && !/(?:id|train_time|name|date):/i.test(part) && !/(?:sets?|组|reps?|次|@|重量)/i.test(part)) notes.push(part);
    }
    const parse_status = !known || (/train_time:/i.test(raw_text) && !train_time) ? 'raw_only' : (id && (train_time || name) ? 'complete' : 'partial');
    return {
      raw_text,
      ...(id ? { id } : {}),
      ...(train_time ? { train_time } : {}),
      ...(name ? { name } : {}),
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
    const source = String(record.data_source || record.source || '').toLowerCase();
    if (source.includes('garmin')) return false;
    if (!source) warnings.push(`unknown_source:${record.id || 'record'}`);
    return true;
  });
  Object.defineProperty(filtered, 'warnings', { value: warnings, enumerable: false });
  return filtered;
}

module.exports = { filterModelFacingRecords, parseTrainingRecords };
