import { useState, useEffect, useCallback } from 'react';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { apiService } from '../../services/apiService';

/**
 * Calls Log Hook
 * Extended version of useLogs specifically for calls logging
 * Pre-configured for call-related syslog entries
 */

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

export const useCallsLog = () => {
  const { selectedCustomer, selectedEnvironments } = useCustomerEnvironment();
  const selectedEnvironment = selectedEnvironments?.[0] || null;

  // State management
  const [logs, setLogs] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 50,
  });

  // Filters - pre-configured for calls
  const [filters, setFilters] = useState({
    logLevels: {
      fatal: true,
      error: true,
      warn: true,
      info: true,
      debug: false,
      trace: false,
    },
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState(''); // Default to all apps
  const [timePeriod, setTimePeriod] = useState('today');
  const [dateRange, setDateRange] = useState({
    from: new Date(),
    to: new Date(),
  });
  const [tagFilters, setTagFilters] = useState([]);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Calculate date range based on time period
  useEffect(() => {
    const now = new Date();
    let from, to;

    switch (timePeriod) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        to = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
      }
      case 'week': {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        from = startOfWeek;
        to = new Date(now);
        break;
      }
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now);
        break;
      case 'all':
        from = null;
        to = null;
        break;
      default:
        // Custom range - keep existing dates
        return;
    }

    if (from !== undefined && to !== undefined) {
      setDateRange({ from, to });
    }
  }, [timePeriod]);

  // Load available apps
  const loadApps = useCallback(async () => {
    if (!selectedCustomer || !selectedEnvironment) return;

    try {
      const response = await apiService.get('/api/logs/apps', {}, 'fetching syslog apps', false);
      setApps(response.data || response || []);
    } catch (error) {
      console.error('Failed to load apps:', error);
      setApps([]);
    }
  }, [selectedCustomer, selectedEnvironment]);

  // Load logs with current filters
  const loadLogs = useCallback(async () => {
    if (!selectedCustomer || !selectedEnvironment) return;

    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.append('page', pagination.page + 1);
      params.append('limit', pagination.limit);
      params.append('order_by', 'created_at');
      params.append('order_type', 'desc');

      // Add time range filter
      if (timePeriod !== 'all' && dateRange.from && dateRange.to) {
        const fromTimestamp = Math.floor(dateRange.from.getTime() / 1000);
        const toTimestamp = Math.floor(dateRange.to.getTime() / 1000);
        params.append('created_at', `${fromTimestamp}-${toTimestamp}`);
      }

      // Add app filter
      if (selectedApp) {
        params.append('app', selectedApp);
      }

      // Add log level filters
      const enabledLevels = Object.entries(filters.logLevels)
        .filter(([, enabled]) => enabled)
        .map(([level]) => level);
      if (enabledLevels.length > 0 && enabledLevels.length < LOG_LEVELS.length) {
        params.append('action', enabledLevels.join(','));
      }

      // Add search query
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      // Add tag filters
      tagFilters.forEach((tag, index) => {
        params.append(`tags[${index}][key]`, tag.key);
        params.append(`tags[${index}][value]`, tag.value);
      });

      const queryString = params.toString();
      const url = `/api/logs${queryString ? `?${queryString}` : ''}`;
      const response = await apiService.get(url, {}, 'fetching syslogs', false);

      // Handle different response formats
      if (Array.isArray(response)) {
        setLogs(response);
        setTotalCount(response.length);
      } else if (response.data) {
        setLogs(response.data.data || response.data || []);
        setTotalCount(response.data.total || response.total || 0);
      } else {
        setLogs(response || []);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    selectedCustomer,
    selectedEnvironment,
    pagination,
    filters,
    searchQuery,
    selectedApp,
    timePeriod,
    dateRange,
    tagFilters,
  ]);

  // Add tag filter
  const addTagFilter = useCallback((key, value) => {
    const existsIndex = tagFilters.findIndex(
      (filter) => filter.key === key && filter.value === value
    );

    if (existsIndex === -1) {
      setTagFilters(prev => [...prev, { key, value }]);
    }
  }, [tagFilters]);

  // Remove tag filter
  const removeTagFilter = useCallback((index) => {
    setTagFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Toggle log level filter
  const toggleLogLevel = useCallback((level) => {
    setFilters(prev => ({
      ...prev,
      logLevels: {
        ...prev.logLevels,
        [level]: !prev.logLevels[level]
      }
    }));
  }, []);

  // Set all log levels
  const setAllLogLevels = useCallback((enabled) => {
    setFilters(prev => ({
      ...prev,
      logLevels: LOG_LEVELS.reduce((acc, level) => {
        acc[level] = enabled;
        return acc;
      }, {})
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedApp('');
    setTimePeriod('today');
    setTagFilters([]);
    setFilters({
      logLevels: {
        fatal: true,
        error: true,
        warn: true,
        info: true,
        debug: false,
        trace: false,
      },
    });
    setPagination(prev => ({ ...prev, page: 0 }));
  }, []);

  // Apply filters (trigger refresh)
  const applyFilters = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 0 }));
  }, []);

  // Refresh logs
  const refreshLogs = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 0, _refresh: Date.now() }));
  }, []);

  // Load initial data
  useEffect(() => {
    loadApps();
  }, [loadApps]);

  // Load logs when filters change
  useEffect(() => {
    if (selectedCustomer && selectedEnvironment) {
      loadLogs();
    }
  }, [loadLogs]);

  return {
    // State
    logs,
    apps,
    loading,
    pagination,
    filters,
    searchQuery,
    selectedApp,
    timePeriod,
    dateRange,
    tagFilters,
    totalCount,
    sidebarOpen,

    // Actions
    setPagination,
    setFilters,
    setSearchQuery,
    setSelectedApp,
    setTimePeriod,
    setDateRange,
    addTagFilter,
    removeTagFilter,
    toggleLogLevel,
    setAllLogLevels,
    clearFilters,
    applyFilters,
    refreshLogs,
    setSidebarOpen,
  };
};

export default useCallsLog;
