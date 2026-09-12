/**
 * Shared chip color/label utilities for consistent chip rendering across all screens.
 */

/**
 * Enabled chip props: green "Yes" / grey "No"
 */
export const getEnabledChipProps = (enabled) => ({
  label: enabled ? 'Yes' : 'No',
  color: enabled ? 'success' : 'default',
  size: 'small',
});

/**
 * Status lifecycle chips: active=success, suspended=warning, cancelled=error, pending=info
 */
export const getStatusChipProps = (status) => {
  const map = {
    active: { label: 'Active', color: 'success' },
    suspended: { label: 'Suspended', color: 'warning' },
    cancelled: { label: 'Cancelled', color: 'error' },
    pending: { label: 'Pending', color: 'info' },
    // Campaign-specific statuses
    create: { label: 'Created', color: 'default' },
    run: { label: 'Running', color: 'success' },
    pause: { label: 'Paused', color: 'warning' },
    stop: { label: 'Stopped', color: 'error' },
  };
  const found = map[status];
  if (found) return { ...found, size: 'small' };
  return { label: status || 'Unknown', color: 'default', size: 'small' };
};

/**
 * Unified type chip color map for all entity types (providers, DIDs, campaigns, templates, etc.)
 */
export const getTypeChipColor = (type) => {
  const colorMap = {
    // DID types
    sip: 'primary',
    pstn: 'secondary',
    toll_free: 'info',
    // Provider types
    did: 'primary',
    sms: 'info',
    carrier: 'success',
    trunk: 'warning',
    gateway: 'info',
    webhook: 'secondary',
    caller_id_number: 'default',
    tts: 'success',
    azure_tts: 'success',
    smtp: 'warning',
    // Campaign types
    call: 'primary',
    // Template types
    account: 'secondary',
    user: 'info',
    voicemail: 'warning',
    facsimile: 'default',
    conference: 'success',
    subscription: 'secondary',
    reminder: 'warning',
  };
  return colorMap[type] || 'default';
};
