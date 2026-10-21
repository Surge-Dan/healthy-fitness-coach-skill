 'use strict';
// These are observed host capabilities, never inferred from a device name alone.
function connectionDecision(capabilities = {}) {
  if (capabilities.xunji_connector === true && capabilities.credentials_ready === true)
    return { mode: 'connector', next: 'read_one_requested_date', request_chat_key: false };
  if (capabilities.xunji_connector === true && capabilities.protected_credential_input === true)
    return { mode: 'configure', next: 'open_protected_credential_input', request_chat_key: false };
  return { mode: 'manual_import', next: 'offer_export_text_file_or_screenshot', request_chat_key: false,
    reason: 'compatible_connector_or_protected_credentials_unavailable', remote_service_provided: false };
}
module.exports = { connectionDecision };
