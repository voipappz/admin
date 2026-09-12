/**
 * Centralized Tooltip Registry
 * All tooltip text in one place for easy maintenance and i18n preparation
 */

export const TOOLTIPS = {
  // Common Actions
  ACTIONS: {
    EDIT: 'Edit this item',
    DELETE: 'Delete this item permanently',
    REFRESH: 'Reload data from server',
    SAVE: 'Save changes',
    CANCEL: 'Cancel and close',
    CREATE: 'Create new item',
    IMPORT: 'Import from CSV file',
    EXPORT: 'Export to CSV file',
    FILTER: 'Apply filters',
    CLEAR_FILTERS: 'Clear all filters',
    VIEW_LOGS: 'View activity logs',
    COPY: 'Copy to clipboard',
    DOWNLOAD: 'Download file',
  },

  // User Fields
  USERS: {
    NAME: 'Full name of the user',
    EMAIL: 'Email address for login and notifications',
    PASSWORD: 'Minimum 6 characters, use a strong password',
    ACL: 'Access Control List - determines what the user can access',
    STATUS: 'Current user status (active, inactive, etc.)',
    EXTENSION: 'SIP device number for phone calls',
    ENVIRONMENT: 'Environment this user belongs to',
    ENABLED: 'Enable or disable user access',
    QR_CODE: 'Download QR code for mobile login',
    RESET_PASSWORD: 'Set a new password for this user',
  },

  // DID Fields
  DIDS: {
    NUMBER: 'Phone number in E.164 format (e.g., +1234567890)',
    NAME: 'Descriptive name for this DID',
    BRIDGE_TYPE: 'Where to route incoming calls (IVR, Queue, Device, etc.)',
    BRIDGE: 'Select the specific destination for calls',
    ENVIRONMENT: 'Environment this DID belongs to',
    ENABLED: 'Enable or disable this DID',
    TYPE: 'DID type (inbound, outbound, toll-free, etc.)',
    META: 'Additional metadata for this DID',
  },

  // Environment Fields
  ENVIRONMENTS: {
    NAME: 'Unique name for this environment',
    DESCRIPTION: 'Brief description of the environment purpose',
    ENABLED: 'Enable or disable this environment',
    TYPE: 'Environment type (production, development, testing)',
  },

  // Subscription Fields
  SUBSCRIPTIONS: {
    NAME: 'Subscription name',
    BALANCE: 'Current account balance',
    TARIFF: 'Associated tariff for billing',
    PLAN: 'Subscription plan',
    ENVIRONMENT: 'Environment this subscription belongs to',
    ENABLED: 'Enable or disable this subscription',
    BEGINS_AT: 'Subscription start date',
    ENDS_AT: 'Subscription end date',
    RECURRING: 'Auto-renew this subscription',
    STATUS: 'Current subscription status',
  },

  // Provider Fields
  PROVIDERS: {
    NAME: 'Provider name (e.g., Twilio, Telnyx)',
    TYPE: 'Provider type (SIP, API, etc.)',
    HOST: 'Provider hostname or IP address',
    PORT: 'Connection port',
    USERNAME: 'Authentication username',
    PASSWORD: 'Authentication password',
    ENABLED: 'Enable or disable this provider',
    TARIFF: 'Associated tariff for this provider',
  },

  // Service Fields
  SERVICES: {
    NAME: 'Service name',
    TYPE: 'Service type (webhook, report, metric, etc.)',
    DESCRIPTION: 'Brief description of what this service does',
    ENABLED: 'Enable or disable this service',
    AUTO_START: 'Start automatically on system boot',
    CONFIG: 'Service configuration (JSON)',
  },

  // Queue Fields
  QUEUES: {
    NAME: 'Queue name',
    STRATEGY: 'Call distribution strategy (round-robin, ring-all, etc.)',
    TIMEOUT: 'Maximum wait time before timeout (seconds)',
    MAX_LENGTH: 'Maximum number of callers in queue',
    MUSIC_ON_HOLD: 'Music to play while waiting',
    ANNOUNCEMENT: 'Announcement to play on entry',
  },

  // IVR Fields
  IVRS: {
    NAME: 'IVR menu name',
    ANNOUNCEMENT: 'Greeting announcement to play',
    TIMEOUT: 'Time to wait for input (seconds)',
    MAX_RETRIES: 'Maximum invalid input retries',
    ENTRIES: 'Menu options (DTMF digits)',
  },

  // Announcement Fields
  ANNOUNCEMENTS: {
    NAME: 'Announcement name',
    FILE: 'Audio file (MP3, WAV, OGG, max 10MB)',
    TTS_TEXT: 'Text to convert to speech',
    TTS_LANGUAGE: 'Language for text-to-speech',
    DURATION: 'Audio duration',
    REPLACE_AUDIO: 'Upload a new audio file to replace existing',
  },

  // Call Fields
  CALLS: {
    CALLER_ID: 'Caller ID / ANI number',
    DESTINATION: 'Called number / DNIS',
    DURATION: 'Call duration in seconds',
    STATUS: 'Call status (answered, no-answer, busy, failed)',
    DIRECTION: 'Call direction (inbound, outbound)',
    RECORDING: 'Call recording URL',
  },

  // Tariff Fields
  TARIFFS: {
    NAME: 'Tariff name',
    RATE: 'Rate per unit (e.g., per minute)',
    CURRENCY: 'Currency code (USD, EUR, etc.)',
    BILLING_INCREMENT: 'Billing increment in seconds',
    MINIMUM_DURATION: 'Minimum billable duration',
  },

  // Plan Fields
  PLANS: {
    NAME: 'Plan name',
    DESCRIPTION: 'Plan description',
    PRICE: 'Monthly/Annual price',
    FEATURES: 'Included features',
  },

  // Filter Fields
  FILTERS: {
    SEARCH: 'Search by name or other fields',
    ENVIRONMENT: 'Filter by environment',
    STATUS: 'Filter by status',
    TYPE: 'Filter by type',
    DATE_RANGE: 'Filter by date range',
    ENABLED: 'Show only enabled/disabled items',
  },
};

export default TOOLTIPS;
