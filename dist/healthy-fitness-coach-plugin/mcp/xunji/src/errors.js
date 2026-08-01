'use strict';

const MESSAGES = {
  missing_credentials: ['Training access has not been configured.', 'Run the local credential setup script, then retry.'],
  invalid_credentials: ['Training access was rejected.', 'Replace the local credential and retry.'],
  invalid_date: ['The requested date is invalid.', 'Use a calendar date in YYYY-MM-DD format.'],
  range_too_large: ['The requested date range is too large.', 'Request no more than 90 calendar days.'],
  rate_limited: ['This date was refreshed too recently.', 'Wait before refreshing this date again.'],
  network_error: ['The training service could not be reached.', 'Check the connection and retry later.'],
  invalid_response: ['The training service returned an unusable response.', 'Retry later; contact support if it continues.'],
  parse_partial: ['Some training records could only be partially read.', 'Review the raw records before relying on conclusions.'],
  cache_error: ['The local training cache could not be used.', 'Retry; if it persists, clear the local cache.']
};

function connectorError(code, extra = {}) {
  const [message, recovery] = MESSAGES[code] || MESSAGES.invalid_response;
  const error = new Error(message);
  error.code = MESSAGES[code] ? code : 'invalid_response';
  error.recovery = recovery;
  for (const [key, value] of Object.entries(extra)) {
    if (key === 'retry_after_seconds' && Number.isFinite(value)) error[key] = Math.max(0, Math.ceil(value));
  }
  return error;
}

function toPublicError(error) {
  const safe = connectorError(error && error.code ? error.code : 'invalid_response', error || {});
  return { code: safe.code, message: safe.message, recovery: safe.recovery, ...(safe.retry_after_seconds ? { retry_after_seconds: safe.retry_after_seconds } : {}) };
}

module.exports = { connectorError, toPublicError };
