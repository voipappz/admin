// Centralized configuration management
class ConfigService {
  constructor() {
    this.config = {
      // API Configuration
      api: {
        baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
        timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
        retryAttempts: parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS) || 3,
        retryDelay: parseInt(import.meta.env.VITE_API_RETRY_DELAY) || 1000,
        retryMultiplier: parseFloat(import.meta.env.VITE_API_RETRY_MULTIPLIER) || 2
      },

      // Authentication Configuration
      auth: {
        tokenKey: 'auth',
        refreshThreshold: 5 * 60 * 1000, // 5 minutes before expiry
        maxRefreshAttempts: 3
      },

      // Notification Configuration
      notifications: {
        successDuration: parseInt(import.meta.env.VITE_SUCCESS_DURATION) || 5000,
        errorDuration: parseInt(import.meta.env.VITE_ERROR_DURATION) || 8000,
        position: {
          vertical: 'top',
          horizontal: 'right'
        }
      },

      // Logging Configuration
      logging: {
        level: import.meta.env.VITE_LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
        enableConsole: import.meta.env.NODE_ENV === 'development',
        enableRemote: import.meta.env.NODE_ENV === 'production',
        remoteEndpoint: import.meta.env.VITE_LOG_ENDPOINT
      },

      // Feature Flags
      features: {
        enableRetry: import.meta.env.VITE_ENABLE_RETRY !== 'false',
        enableOfflineDetection: import.meta.env.VITE_ENABLE_OFFLINE !== 'false',
        enableErrorReporting: import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true',
        enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true'
      },

      // Application Configuration
      app: {
        name: import.meta.env.VITE_APP_NAME || 'VoipAppz Admin',
        version: import.meta.env.VITE_APP_VERSION || '1.0.0',
        environment: import.meta.env.NODE_ENV || 'development',
        debugMode: import.meta.env.NODE_ENV === 'development'
      },

      // Schema Configuration
      schema: {
        mockDataEnabled: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true',
        mockTypes: ['sms', 'ivr', 'extension', 'conference', 'queue', 'powerlink', 'freshdesk', 'esim', 'user']
      },

      // Performance Configuration
      performance: {
        requestDebounce: parseInt(import.meta.env.VITE_REQUEST_DEBOUNCE) || 300,
        searchDebounce: parseInt(import.meta.env.VITE_SEARCH_DEBOUNCE) || 500,
        maxConcurrentRequests: parseInt(import.meta.env.VITE_MAX_CONCURRENT) || 5
      }
    };

    // Validate configuration on initialization
    this.validateConfig();
  }

  // Get configuration value by path (e.g., 'api.baseUrl')
  get(path, defaultValue = undefined) {
    return this.getNestedValue(this.config, path, defaultValue);
  }

  // Set configuration value by path
  set(path, value) {
    this.setNestedValue(this.config, path, value);
  }

  // Get nested object value by string path
  getNestedValue(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }
    
    return result !== undefined ? result : defaultValue;
  }

  // Set nested object value by string path
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;
    
    for (const key of keys) {
      if (current[key] === undefined || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
  }

  // Validate configuration
  validateConfig() {
    const requiredPaths = [
      'api.baseUrl',
      'auth.tokenKey',
      'app.name'
    ];

    const missingConfigs = [];
    for (const path of requiredPaths) {
      if (this.get(path) === undefined) {
        missingConfigs.push(path);
      }
    }

    if (missingConfigs.length > 0) {
      console.warn('Missing configuration values:', missingConfigs);
    }

    // Validate URLs
    try {
      new URL(this.get('api.baseUrl'));
    } catch {
      console.error('Invalid API base URL:', this.get('api.baseUrl'));
    }
  }

  // Get all configuration (useful for debugging)
  getAll() {
    return { ...this.config };
  }

  // Check if feature is enabled
  isFeatureEnabled(featureName) {
    return this.get(`features.${featureName}`, false);
  }

  // Environment checks
  isDevelopment() {
    return this.get('app.environment') === 'development';
  }

  isProduction() {
    return this.get('app.environment') === 'production';
  }

  isDebugMode() {
    return this.get('app.debugMode', false);
  }

  // Log current configuration (for debugging)
  logConfig() {
    if (this.isDevelopment()) {
      console.group('🔧 Configuration');
      console.table(this.getAll());
      console.groupEnd();
    }
  }

  // Override configuration for testing
  override(overrides) {
    if (this.isDevelopment()) {
      this.config = { ...this.config, ...overrides };
      console.log('Configuration overridden:', overrides);
    }
  }
}

// Create and export singleton instance
export const configService = new ConfigService();

// Export default for easy imports
export default configService;