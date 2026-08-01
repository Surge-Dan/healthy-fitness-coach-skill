'use strict';

const { z } = require('zod');
const { connectorError } = require('./errors.js');

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const cacheEntrySchema = z.object({
  fetched_at: z.number().finite(),
  records: z.array(z.object({}).passthrough()),
  warnings: z.array(z.string()).default([])
});

function assertDate(date) {
  if (typeof date !== 'string' || !datePattern.test(date)) throw connectorError('invalid_date');
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  if (value.getUTCFullYear() !== year || value.getUTCMonth() !== month - 1 || value.getUTCDate() !== day) throw connectorError('invalid_date');
  return date;
}

function assertCacheEntry(value) {
  const parsed = cacheEntrySchema.safeParse(value);
  if (!parsed.success) throw connectorError('cache_error');
  return parsed.data;
}

module.exports = { assertCacheEntry, assertDate };
