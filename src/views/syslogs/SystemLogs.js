import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import syslogsApi from '../../services/api/syslogsApi';
import { computePeriodRange, deriveChartInterval } from '../../utils/logFormatting';

const useDebouncedValue = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

export const useSystemLogs = ({ customerUuid, initialParams } = {}) => {
  // Log data
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Dropdown data
  const [apps, setApps] = useState([]);
  const [nodes, setNodes] = useState([]);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 25,
  });

  // Filters — seeded from `initialParams` when a caller embeds the viewer, and
  // from the URL when it is the page itself (/logs?search=<uuid>&app=auth&period=24h
  // still works as a link). The login mediators put user_uuid= in the log
  // message for exactly that: the uuid is the search needle
  // against the InfluxDB `syslog` message field.
  const initial = useMemo(() => {
    // `!= null` on purpose: the general Syslog view passes '' to mean "no
    // filters at all". Treating '' as absent would fall through to the host
    // page's query string and silently inherit its ?search=, turning the
    // whole-stream view into a filtered one.
    const q = new URLSearchParams(initialParams != null ? initialParams : window.location.search);
    return {
      search: q.get('search') || q.get('inline') || '',
      app: q.get('app') || '',
      host: q.get('host') || '',
      severity: ({ error: 'err', warn: 'warning' })[q.get('severity')] || q.get('severity') || '',
      action: q.get('action') || '',
      period: q.get('period') || '1h',
    };
  }, [initialParams]);

  const [searchQuery, setSearchQuery] = useState(initial.search);
  const [selectedApp, setSelectedApp] = useState(initial.app);
  const [selectedHost, setSelectedHost] = useState(initial.host);
  const [selectedSeverity, setSelectedSeverity] = useState(initial.severity);
  // `action` is a tag on the syslog series (config/initializers/log.rb), so it
  // can be filtered on AND grouped by — a line that names an action is the same
  // line that becomes an event.
  const [selectedAction, setSelectedAction] = useState(initial.action);
  const debouncedAction = useDebouncedValue(selectedAction);
  const filterText = useMemo(() => ({
    action: debouncedAction,
    customerUuid: customerUuid || '',
  }), [debouncedAction, customerUuid]);
  const requestFilters = useMemo(() => Object.fromEntries(Object.entries({
    app: selectedApp,
    host: selectedHost,
    severity: selectedSeverity,
    action: filterText.action,
    customer_uuid: filterText.customerUuid,
    inline: searchQuery,
  }).filter(([, value]) => value)), [selectedApp, selectedHost, selectedSeverity, filterText, searchQuery]);
  const [groupBy, setGroupBy] = useState('severity');

  // Date range with period tracking (Events-style shape)
  const [dateRange, setDateRange] = useState(() => computePeriodRange(initial.period));

  // Chart aggregation data (from server)
  const [chartAggregation, setChartAggregation] = useState([]);
  const [severityAggregation, setSeverityAggregation] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Auto-refresh: 0 = off, 10/30/60 seconds
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);

  // Derive chart bucket size from active time range
  const chartInterval = useMemo(
    () => deriveChartInterval(dateRange?.start, dateRange?.end),
    [dateRange]
  );

  // Load apps (no loading flash on the main table)
  const loadApps = useCallback(async () => {
    try {
      const response = await syslogsApi.fetchApps();
      setApps(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error('Failed to load apps:', error);
      setApps([]);
    }
  }, []);

  // Load nodes for host filtering
  const loadNodes = useCallback(async () => {
    try {
      const response = await syslogsApi.fetchNodes();
      setNodes(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error('Failed to load nodes:', error);
      setNodes([]);
    }
  }, []);

  // Load syslogs from the InfluxDB-backed /api/logs endpoint.
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);

      const params = {
        page: pagination.page + 1,
        per_page: pagination.limit,
        ...requestFilters,
      };

      if (dateRange?.start && dateRange?.end) {
        params.from = Math.floor(dateRange.start.getTime() / 1000);
        params.to = Math.floor(dateRange.end.getTime() / 1000);
      }

      const response = await syslogsApi.fetchLogs(params);

      if (Array.isArray(response)) {
        setLogs(response);
        setTotalCount(response.length);
      } else if (response?.data && Array.isArray(response.data)) {
        setLogs(response.data);
        setTotalCount(response.total || response.total_records || response.data.length);
      } else {
        setLogs([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [pagination, dateRange, requestFilters]);

  // Load chart aggregation data from server (InfluxDB: count by severity over time)
  const loadChartData = useCallback(async () => {
    try {
      setChartLoading(true);

      const params = { interval: chartInterval, ...requestFilters };

      if (dateRange?.start && dateRange?.end) {
        params.from = Math.floor(dateRange.start.getTime() / 1000);
        params.to = Math.floor(dateRange.end.getTime() / 1000);
      }

      // group_by accepts 'action' too — `action` is a tag on the series, and
      // "logs by action" is the chart that makes the actioned lines legible.
      if (groupBy) params.group_by = groupBy;

      const [response, severityResponse] = await Promise.all([
        syslogsApi.fetchAggregate(params),
        groupBy === 'severity'
          ? Promise.resolve(null)
          : syslogsApi.fetchAggregate({ ...params, group_by: 'severity' }),
      ]);
      setChartAggregation(Array.isArray(response) ? response : response?.data || []);
      const severityData = severityResponse ?? response;
      setSeverityAggregation(Array.isArray(severityData) ? severityData : severityData?.data || []);
    } catch (error) {
      console.error('Failed to load chart data:', error);
      setChartAggregation([]);
      setSeverityAggregation([]);
    } finally {
      setChartLoading(false);
    }
  }, [chartInterval, dateRange, requestFilters, groupBy]);

  useEffect(() => {
    setPagination((current) => current.page === 0 ? current : { ...current, page: 0 });
  }, [dateRange, selectedApp, selectedHost, selectedSeverity, filterText, searchQuery]);

  // Period quick-select handler
  const handlePeriodSelect = useCallback((period) => {
    setDateRange(computePeriodRange(period));
  }, []);

  // Refresh — period-aware: slides the window if a quick-select is active
  const refreshLogs = useCallback(() => {
    if (dateRange?.period && dateRange.period !== 'custom') {
      setDateRange(computePeriodRange(dateRange.period));
    } else {
      loadLogs();
      loadChartData();
    }
  }, [dateRange?.period, loadLogs, loadChartData]);

  // Derived filter state
  const hasActiveFilters = useMemo(
    () =>
      (searchQuery && searchQuery.trim() !== '') ||
      selectedApp !== '' ||
      selectedHost !== '' ||
      selectedSeverity !== '' ||
      selectedAction !== '',
    [searchQuery, selectedApp, selectedHost, selectedSeverity, selectedAction]
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedApp('');
    setSelectedHost('');
    setSelectedSeverity('');
    setSelectedAction('');
  }, []);

  // Enable trace (for live syslog streaming)
  const enableTrace = useCallback(async () => {
    try {
      await syslogsApi.enableTrace();
      return true;
    } catch (error) {
      console.error('Failed to enable trace:', error);
      return false;
    }
  }, []);

  // Disable trace
  const disableTrace = useCallback(async () => {
    try {
      await syslogsApi.disableTrace();
      return true;
    } catch (error) {
      console.error('Failed to disable trace:', error);
      return false;
    }
  }, []);

  // Get trace status
  const getTraceStatus = useCallback(async () => {
    try {
      const response = await syslogsApi.getTraceStatus();
      return response?.enabled || response?.data?.enabled || false;
    } catch (error) {
      console.error('Failed to get trace status:', error);
      return false;
    }
  }, []);

  // Console mode (console! — live log output + error capture to syslog)
  const enableConsole = useCallback(async () => {
    try {
      await syslogsApi.enableConsole();
      return true;
    } catch (error) {
      console.error('Failed to enable console mode:', error);
      return false;
    }
  }, []);

  const disableConsole = useCallback(async () => {
    try {
      await syslogsApi.disableConsole();
      return true;
    } catch (error) {
      console.error('Failed to disable console mode:', error);
      return false;
    }
  }, []);

  const getConsoleStatus = useCallback(async () => {
    try {
      const response = await syslogsApi.getConsoleStatus();
      return response?.enabled || response?.data?.enabled || false;
    } catch (error) {
      console.error('Failed to get console mode status:', error);
      return false;
    }
  }, []);

  // Load dropdown data on mount
  useEffect(() => {
    loadApps();
    loadNodes();
  }, [loadApps, loadNodes]);

  // Load logs when filters change
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Load chart data when relevant params change
  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  // Auto-refresh interval (independent from Trace)
  const autoRefreshRef = useRef(null);
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    if (autoRefreshInterval > 0) {
      autoRefreshRef.current = setInterval(() => {
        refreshLogs();
      }, autoRefreshInterval * 1000);
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefreshInterval, refreshLogs]);

  return {
    // Log data
    logs,
    loading,
    totalCount,
    pagination,
    setPagination,

    // Dropdown data
    apps,
    nodes,

    // Filters
    searchQuery,
    setSearchQuery,
    selectedApp,
    setSelectedApp,
    selectedHost,
    setSelectedHost,
    selectedSeverity,
    selectedAction,
    setSelectedAction,
    setSelectedSeverity,
    groupBy,
    setGroupBy,

    // Date range
    dateRange,
    setDateRange,
    handlePeriodSelect,

    // Chart state
    chartAggregation,
    severityAggregation,
    chartLoading,
    chartInterval,

    // Auto-refresh
    autoRefreshInterval,
    setAutoRefreshInterval,

    // Actions
    refreshLogs,
    clearFilters,
    hasActiveFilters,

    // Trace (live streaming)
    enableTrace,
    disableTrace,
    getTraceStatus,

    // Console mode (console! — live output + error capture to syslog)
    enableConsole,
    disableConsole,
    getConsoleStatus,
  };
};
