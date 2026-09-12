import apiService from '../apiService';

// Enable mock data for service types (set to false to use real API)
const USE_MOCK_SERVICE_PROFILES = false;

/**
 * Mock profile parameters for each service type
 * These define the dynamic fields shown when a service type is selected
 */
const MOCK_SERVICE_PROFILES = {
  webhook: [
    { name: 'URL', key: 'url', value: '', input: 'string', notes: 'Webhook endpoint URL', empty: false, section: 'Configuration' },
    { name: 'Method', key: 'method', value: 'POST', input: 'select', notes: 'HTTP method', section: 'Configuration',
      select_options: [
        { name: 'POST', val: 'POST' },
        { name: 'GET', val: 'GET' },
        { name: 'PUT', val: 'PUT' },
        { name: 'PATCH', val: 'PATCH' }
      ]
    },
    { name: 'Content Type', key: 'content_type', value: 'application/json', input: 'select', section: 'Configuration',
      select_options: [
        { name: 'JSON', val: 'application/json' },
        { name: 'Form Data', val: 'application/x-www-form-urlencoded' },
        { name: 'XML', val: 'application/xml' }
      ]
    },
    { name: 'Authentication', key: 'auth_type', value: 'none', input: 'select', section: 'Authentication',
      select_options: [
        { name: 'None', val: 'none' },
        { name: 'Basic Auth', val: 'basic' },
        { name: 'Bearer Token', val: 'bearer' },
        { name: 'API Key', val: 'api_key' }
      ]
    },
    { name: 'Auth Username', key: 'auth_username', value: '', input: 'string', section: 'Authentication', notes: 'For Basic Auth' },
    { name: 'Auth Password', key: 'auth_password', value: '', input: 'string', section: 'Authentication', notes: 'For Basic Auth' },
    { name: 'Bearer Token', key: 'bearer_token', value: '', input: 'string', section: 'Authentication', notes: 'For Bearer Token auth' },
    { name: 'Timeout (ms)', key: 'timeout', value: 30000, input: 'numeric', section: 'Advanced', notes: 'Request timeout in milliseconds' },
    { name: 'Retry Count', key: 'retry_count', value: 3, input: 'numeric', section: 'Advanced', notes: 'Number of retries on failure' },
  ],

  report: [
    { name: 'Report Type', key: 'report_type', value: '', input: 'select', empty: false, section: 'Configuration',
      select_options: [
        { name: 'Call Summary', val: 'call_summary' },
        { name: 'Agent Performance', val: 'agent_performance' },
        { name: 'Queue Statistics', val: 'queue_stats' },
        { name: 'Custom Query', val: 'custom' }
      ]
    },
    { name: 'Schedule', key: 'schedule', value: 'daily', input: 'select', section: 'Schedule',
      select_options: [
        { name: 'Hourly', val: 'hourly' },
        { name: 'Daily', val: 'daily' },
        { name: 'Weekly', val: 'weekly' },
        { name: 'Monthly', val: 'monthly' }
      ]
    },
    { name: 'Time of Day', key: 'schedule_time', value: '08:00', input: 'string', section: 'Schedule', notes: 'HH:MM format' },
    { name: 'Email Recipients', key: 'recipients', value: '', input: 'textarea', section: 'Delivery', notes: 'Comma-separated email addresses' },
    { name: 'Include CSV', key: 'include_csv', value: true, input: 'boolean', section: 'Delivery' },
    { name: 'Include PDF', key: 'include_pdf', value: false, input: 'boolean', section: 'Delivery' },
  ],

  metric: [
    { name: 'Metric Name', key: 'metric_name', value: '', input: 'string', empty: false, section: 'Configuration' },
    { name: 'Metric Type', key: 'metric_type', value: 'counter', input: 'select', section: 'Configuration',
      select_options: [
        { name: 'Counter', val: 'counter' },
        { name: 'Gauge', val: 'gauge' },
        { name: 'Histogram', val: 'histogram' }
      ]
    },
    { name: 'Collection Interval', key: 'interval', value: 60, input: 'numeric', section: 'Configuration', notes: 'Seconds between collections' },
    { name: 'Aggregation', key: 'aggregation', value: 'sum', input: 'select', section: 'Processing',
      select_options: [
        { name: 'Sum', val: 'sum' },
        { name: 'Average', val: 'avg' },
        { name: 'Min', val: 'min' },
        { name: 'Max', val: 'max' }
      ]
    },
    { name: 'Alert Threshold', key: 'alert_threshold', value: '', input: 'numeric', section: 'Alerts', notes: 'Trigger alert when exceeded' },
    { name: 'Alert Email', key: 'alert_email', value: '', input: 'string', section: 'Alerts' },
  ],

  gateway: [
    { name: 'Gateway Type', key: 'gateway_type', value: '', input: 'select', empty: false, section: 'Configuration',
      select_options: [
        { name: 'SIP', val: 'sip' },
        { name: 'WebRTC', val: 'webrtc' },
        { name: 'PSTN', val: 'pstn' }
      ]
    },
    { name: 'Host', key: 'host', value: '', input: 'string', empty: false, section: 'Connection', notes: 'Gateway hostname or IP' },
    { name: 'Port', key: 'port', value: 5060, input: 'numeric', section: 'Connection' },
    { name: 'Transport', key: 'transport', value: 'udp', input: 'select', section: 'Connection',
      select_options: [
        { name: 'UDP', val: 'udp' },
        { name: 'TCP', val: 'tcp' },
        { name: 'TLS', val: 'tls' }
      ]
    },
    { name: 'Username', key: 'username', value: '', input: 'string', section: 'Authentication' },
    { name: 'Password', key: 'password', value: '', input: 'string', section: 'Authentication' },
    { name: 'Register', key: 'register', value: true, input: 'boolean', section: 'Registration' },
    { name: 'Register Interval', key: 'register_interval', value: 3600, input: 'numeric', section: 'Registration', notes: 'Seconds' },
  ],

  account_notification: [
    { name: 'Notification Type', key: 'notification_type', value: '', input: 'select', empty: false, section: 'Configuration',
      select_options: [
        { name: 'Email', val: 'email' },
        { name: 'SMS', val: 'sms' },
        { name: 'Push', val: 'push' },
        { name: 'Webhook', val: 'webhook' }
      ]
    },
    { name: 'Event Trigger', key: 'event', value: '', input: 'select', empty: false, section: 'Configuration',
      select_options: [
        { name: 'Account Created', val: 'account_created' },
        { name: 'Account Updated', val: 'account_updated' },
        { name: 'Balance Low', val: 'balance_low' },
        { name: 'Payment Received', val: 'payment_received' }
      ]
    },
    { name: 'Template', key: 'template', value: '', input: 'textarea', section: 'Content', notes: 'Use {{variable}} for placeholders' },
    { name: 'Subject', key: 'subject', value: '', input: 'string', section: 'Content', notes: 'For email notifications' },
  ],

  user_notification: [
    { name: 'Notification Type', key: 'notification_type', value: '', input: 'select', empty: false, section: 'Configuration',
      select_options: [
        { name: 'Email', val: 'email' },
        { name: 'SMS', val: 'sms' },
        { name: 'Push', val: 'push' },
        { name: 'In-App', val: 'in_app' }
      ]
    },
    { name: 'Event Trigger', key: 'event', value: '', input: 'select', empty: false, section: 'Configuration',
      select_options: [
        { name: 'Missed Call', val: 'missed_call' },
        { name: 'Voicemail', val: 'voicemail' },
        { name: 'Queue Alert', val: 'queue_alert' },
        { name: 'Status Change', val: 'status_change' }
      ]
    },
    { name: 'Template', key: 'template', value: '', input: 'textarea', section: 'Content', notes: 'Use {{variable}} for placeholders' },
    { name: 'Priority', key: 'priority', value: 'normal', input: 'select', section: 'Delivery',
      select_options: [
        { name: 'Low', val: 'low' },
        { name: 'Normal', val: 'normal' },
        { name: 'High', val: 'high' }
      ]
    },
  ],

  caller_id_number: [
    { name: 'Number', key: 'number', value: '', input: 'string', empty: false, section: 'Configuration', notes: 'Caller ID number in E.164 format' },
    { name: 'Name', key: 'caller_name', value: '', input: 'string', section: 'Configuration', notes: 'Caller ID name (CNAM)' },
    { name: 'Type', key: 'number_type', value: 'local', input: 'select', section: 'Configuration',
      select_options: [
        { name: 'Local', val: 'local' },
        { name: 'Toll-Free', val: 'toll_free' },
        { name: 'Mobile', val: 'mobile' }
      ]
    },
    { name: 'Verified', key: 'verified', value: false, input: 'boolean', section: 'Status' },
    { name: 'Default', key: 'is_default', value: false, input: 'boolean', section: 'Status', notes: 'Use as default caller ID' },
  ],

  provider: [
    { name: 'Provider Type', key: 'provider_type', value: '', input: 'select', empty: false, section: 'Configuration',
      select_options: [
        { name: 'SIP Trunk', val: 'sip_trunk' },
        { name: 'SMS Gateway', val: 'sms' },
        { name: 'TTS', val: 'tts' },
        { name: 'ASR', val: 'asr' }
      ]
    },
    { name: 'API Endpoint', key: 'api_endpoint', value: '', input: 'string', section: 'Connection' },
    { name: 'API Key', key: 'api_key', value: '', input: 'string', section: 'Authentication' },
    { name: 'API Secret', key: 'api_secret', value: '', input: 'string', section: 'Authentication' },
    { name: 'Max Concurrent', key: 'max_concurrent', value: 10, input: 'numeric', section: 'Limits', notes: 'Maximum concurrent connections' },
    { name: 'Rate Limit', key: 'rate_limit', value: 100, input: 'numeric', section: 'Limits', notes: 'Requests per minute' },
  ],

  tts: [
    // Service selector (controls conditional visibility)
    { name: 'TTS Service', key: 'service', value: 'google', input: 'select', empty: false,
      section: 'Service',
      select_options: [
        { name: 'Google Cloud TTS', val: 'google' },
        { name: 'Azure Cognitive Services', val: 'azure' }
      ]
    },
    // Common field
    { name: 'Voice Gender', key: 'voice_gender', value: 'FEMALE', input: 'select', empty: false,
      section: 'Service',
      select_options: [
        { name: 'Female', val: 'FEMALE' },
        { name: 'Male', val: 'MALE' }
      ]
    },
    // Google fields (depends_on service=google)
    { name: 'Project ID', key: 'project_id', value: '', input: 'string', empty: false,
      section: 'Google Cloud Credentials', depends_on: { key: 'service', value: 'google' } },
    { name: 'Private Key ID', key: 'private_key_id', value: '', input: 'string', empty: false,
      section: 'Google Cloud Credentials', depends_on: { key: 'service', value: 'google' } },
    { name: 'Private Key', key: 'private_key', value: '', input: 'textarea', empty: false,
      section: 'Google Cloud Credentials', depends_on: { key: 'service', value: 'google' },
      notes: 'The RSA private key (including BEGIN/END markers)' },
    { name: 'Client Email', key: 'client_email', value: '', input: 'string', empty: false,
      section: 'Google Cloud Credentials', depends_on: { key: 'service', value: 'google' },
      notes: 'Service account email address' },
    { name: 'Client ID', key: 'client_id', value: '', input: 'string', empty: false,
      section: 'Google Cloud Credentials', depends_on: { key: 'service', value: 'google' } },
    // Azure fields (depends_on service=azure)
    { name: 'Subscription Key', key: 'subscription_key', value: '', input: 'string', empty: false,
      section: 'Azure Configuration', depends_on: { key: 'service', value: 'azure' },
      notes: 'Azure Speech Services subscription key' },
    { name: 'Region', key: 'region', value: 'germanywestcentral', input: 'select', empty: false,
      section: 'Azure Configuration', depends_on: { key: 'service', value: 'azure' },
      select_options: [
        { name: 'Germany West Central', val: 'germanywestcentral' },
        { name: 'West Europe', val: 'westeurope' },
        { name: 'North Europe', val: 'northeurope' },
        { name: 'East US', val: 'eastus' },
        { name: 'West US', val: 'westus' },
        { name: 'Southeast Asia', val: 'southeastasia' },
        { name: 'UK South', val: 'uksouth' }
      ]
    },
    { name: 'Language', key: 'language', value: 'en-US', input: 'select',
      section: 'Azure Configuration', depends_on: { key: 'service', value: 'azure' },
      select_options: [
        { name: 'English (US)', val: 'en-US' },
        { name: 'English (UK)', val: 'en-GB' },
        { name: 'Hebrew', val: 'he-IL' },
        { name: 'Arabic', val: 'ar-SA' },
        { name: 'French', val: 'fr-FR' },
        { name: 'German', val: 'de-DE' },
        { name: 'Spanish', val: 'es-ES' },
        { name: 'Russian', val: 'ru-RU' }
      ]
    },
  ],
};

/**
 * Profile Parameters API Service
 * Fetches dynamic field definitions for profile forms
 *
 * Supported types: environment, user, did, service, campaign, tariff, etc.
 */
export const profileParamsApi = {
  /**
   * Get profile parameters for a specific type
   * @param {string} type - The profile type (e.g., 'environment', 'user', 'webhook')
   * @returns {Promise<Array>} Array of field definitions
   *
   * Field structure:
   * {
   *   name: string,           // Display label
   *   key: string,            // Field key for data binding
   *   value: any,             // Default value
   *   input: string,          // Input type: string, numeric, boolean, select, multi_select, textarea, date
   *   notes?: string,         // Help text
   *   label?: string,         // Placeholder
   *   select_options?: Array, // Options for select fields [{name, val}]
   *   empty?: boolean,        // true = optional, false = required
   *   section?: string        // Grouping section (default: "Other")
   * }
   */
  getProfileParams: async (type) => {
    // Check for mock service profiles first
    if (USE_MOCK_SERVICE_PROFILES && MOCK_SERVICE_PROFILES[type]) {
      console.log(`Using mock profile params for type: ${type}`);
      return MOCK_SERVICE_PROFILES[type];
    }

    try {
      const response = await apiService.get(`/api/assets/profile_params?type=${type}`);
      return Array.isArray(response) ? response : response.data || [];
    } catch (error) {
      console.error(`Error fetching profile params for type ${type}:`, error);
      return [];
    }
  }
};

export default profileParamsApi;
