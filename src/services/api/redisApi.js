import { apiService } from '../apiService.js';

/**
 * Redis API Service
 * Provides methods to interact with Redis through the backend proxy endpoints
 */
export const redisApi = {
  /**
   * Get list of keys matching a pattern
   * @param {string} pattern - Redis key pattern (e.g., 'live:*', '*')
   * @param {number} limit - Maximum number of keys to return (default: 100)
   * @returns {Promise<{keys: string[], total: number}>}
   */
  getKeys: async (pattern = '*', limit = 100) => {
    const params = new URLSearchParams({ pattern, limit: limit.toString() });
    return apiService.get(`/api/dashboard/redis/keys?${params}`, {}, 'Fetching Redis keys', false, true);
  },

  /**
   * Get value for a specific key
   * @param {string} key - The Redis key to fetch
   * @returns {Promise<{type: string, value: any, ttl: number}>}
   */
  getValue: async (key) => {
    // Encode the key properly for URL path
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return apiService.get(`/api/dashboard/redis/get/${encodedKey}`, {}, `Fetching Redis key: ${key}`, false, true);
  },

  /**
   * Execute a Redis command (read-only commands only)
   * @param {string} command - The Redis command to execute (e.g., 'KEYS live:*', 'HGETALL mykey')
   * @returns {Promise<{command: string, result: any}>}
   */
  exec: async (command) => {
    return apiService.post('/api/dashboard/redis/exec', { command }, {}, `Executing Redis command`, false, true);
  },

  /**
   * Get Redis server information
   * @returns {Promise<{version: string, used_memory: string, connected_clients: string, total_keys: number, uptime_seconds: number}>}
   */
  getInfo: async () => {
    return apiService.get('/api/dashboard/redis/info', {}, 'Fetching Redis info', false, true);
  },

  /**
   * Scan keys with cursor-based pagination
   * @param {string} cursor - The cursor position (use '0' for first call)
   * @param {string} pattern - Redis key pattern
   * @param {number} count - Number of keys to return per scan
   * @returns {Promise<{cursor: string, keys: string[], finished: boolean}>}
   */
  scan: async (cursor = '0', pattern = '*', count = 100) => {
    const params = new URLSearchParams({ cursor, pattern, count: count.toString() });
    return apiService.get(`/api/dashboard/redis/scan?${params}`, {}, 'Scanning Redis keys', false, true);
  },

  /**
   * Bulk fetch multiple keys with type, value, and TTL
   * @param {string[]} keys - Array of Redis keys to fetch
   * @returns {Promise<Array<{key: string, type: string, value: any, ttl: number}>>}
   */
  mget: async (keys) => {
    const params = new URLSearchParams({ keys: keys.join(',') });
    return apiService.get(`/api/dashboard/redis/mget?${params}`, {}, 'Fetching Redis keys bulk', false, true);
  },

  /**
   * Get key tree grouped by prefix
   * @param {string} prefix - Key prefix to group by (e.g., 'user:')
   * @param {number} limit - Maximum keys to scan (default: 5000)
   * @returns {Promise<{prefixes: Object, total: number}>}
   */
  tree: async (prefix = '', limit = 5000) => {
    const params = new URLSearchParams({ prefix, limit: limit.toString() });
    return apiService.get(`/api/dashboard/redis/tree?${params}`, {}, 'Fetching Redis key tree', false, true);
  },

  /**
   * Parse a flat list of keys into a tree structure for the key browser
   * @param {string[]} keys - Array of Redis keys
   * @returns {Object} Tree structure suitable for RedisKeyBrowser
   */
  parseKeysToTree: (keys) => {
    const tree = {};

    keys.forEach(key => {
      const parts = key.split(':');
      let current = tree;

      parts.forEach((part, index) => {
        if (!current[part]) {
          if (index === parts.length - 1) {
            // Leaf node (actual key)
            current[part] = {
              type: 'string', // Will be updated when value is fetched
              fullKey: key,
              ttl: -1,
              size: 'unknown'
            };
          } else {
            // Folder node
            current[part] = {
              type: 'folder',
              children: {}
            };
          }
        }
        if (index < parts.length - 1) {
          if (!current[part].children) {
            current[part].children = {};
          }
          current = current[part].children;
        }
      });
    });

    return tree;
  },

  /**
   * Get the type icon name based on Redis data type
   * @param {string} type - Redis data type
   * @returns {string} Icon name
   */
  getTypeIcon: (type) => {
    const typeIcons = {
      string: 'TextFields',
      hash: 'DataObject',
      list: 'ListAlt',
      set: 'Category',
      zset: 'Sort',
      stream: 'Stream',
      none: 'HelpOutline'
    };
    return typeIcons[type] || 'Storage';
  },

  /**
   * Format Redis value for display
   * @param {any} value - The Redis value
   * @param {string} type - The Redis data type
   * @returns {string} Formatted value string
   */
  formatValue: (value, type) => {
    if (value === null || value === undefined) {
      return '(nil)';
    }

    switch (type) {
      case 'hash':
        return JSON.stringify(value, null, 2);
      case 'list':
      case 'set':
        return Array.isArray(value) ? value.join('\n') : String(value);
      case 'zset':
        if (Array.isArray(value)) {
          return value.map(([member, score]) => `${score}: ${member}`).join('\n');
        }
        return String(value);
      default:
        return String(value);
    }
  }
};

export default redisApi;
