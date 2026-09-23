import { useState, useEffect, useCallback, useRef } from 'react';
import { monitorsApi, getOverallStatus } from '../../services/api/monitorsApi';
import { useNotification } from '../../context/NotificationContext';
import { useConfirm } from '../ui';

/**
 * Custom hook for HealthMonitor component
 * Manages monitors data, timeseries, and auto-refresh
 */
export const useHealthMonitor = () => {
  const confirm = useConfirm();
  // Monitors state
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Timeseries data for each monitor
  const [timeseriesData, setTimeseriesData] = useState({});
  const [timeseriesLoading, setTimeseriesLoading] = useState({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval] = useState(30); // seconds
  const [countdown, setCountdown] = useState(30);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Refs for interval management
  const refreshTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  // Notification context
  const { showSuccess, showError } = useNotification();

  /**
   * Fetch all monitors
   */
  const fetchMonitors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await monitorsApi.getMonitors();
      const monitorsList = Array.isArray(response) ? response : (response?.data || []);

      setMonitors(monitorsList);
      setLastRefresh(new Date());

      // Fetch timeseries for each monitor
      monitorsList.forEach(monitor => {
        fetchTimeseries(monitor.uuid);
      });

    } catch (err) {
      console.error('Error fetching monitors:', err);
      setError(err.message || 'Failed to load monitors');
      setMonitors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch timeseries data for a specific monitor
   */
  const fetchTimeseries = useCallback(async (monitorId, range = '24h') => {
    if (!monitorId) return;

    setTimeseriesLoading(prev => ({ ...prev, [monitorId]: true }));

    try {
      const response = await monitorsApi.getTimeseries(monitorId, range);
      const data = Array.isArray(response) ? response : (response?.data || []);

      setTimeseriesData(prev => ({ ...prev, [monitorId]: data }));
    } catch (err) {
      console.error(`Error fetching timeseries for ${monitorId}:`, err);
      // Set empty array on error to avoid breaking UI
      setTimeseriesData(prev => ({ ...prev, [monitorId]: [] }));
    } finally {
      setTimeseriesLoading(prev => ({ ...prev, [monitorId]: false }));
    }
  }, []);

  /**
   * Refresh all data
   */
  const refresh = useCallback(() => {
    setCountdown(refreshInterval);
    fetchMonitors();
  }, [fetchMonitors, refreshInterval]);

  /**
   * Toggle auto-refresh
   */
  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh(prev => !prev);
  }, []);

  /**
   * Open dialog for creating new monitor
   */
  const handleOpenCreate = useCallback(() => {
    setSelectedMonitor(null);
    setDialogOpen(true);
  }, []);

  /**
   * Open dialog for editing a monitor
   */
  const handleOpenEdit = useCallback((monitor) => {
    setSelectedMonitor(monitor);
    setDialogOpen(true);
  }, []);

  /**
   * Close dialog
   */
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedMonitor(null);
  }, []);

  /**
   * Save monitor (create or update)
   */
  const handleSaveMonitor = useCallback(async (monitorData) => {
    setDialogLoading(true);

    try {
      if (selectedMonitor) {
        // Update
        await monitorsApi.updateMonitor(selectedMonitor.uuid, monitorData);
        showSuccess('Monitor updated successfully');
      } else {
        // Create
        await monitorsApi.createMonitor(monitorData);
        showSuccess('Monitor created successfully');
      }

      handleCloseDialog();
      await fetchMonitors();
    } catch (err) {
      console.error('Error saving monitor:', err);
      showError(err.message || 'Failed to save monitor');
      throw err;
    } finally {
      setDialogLoading(false);
    }
  }, [selectedMonitor, showSuccess, showError, handleCloseDialog, fetchMonitors]);

  /**
   * Delete monitor
   */
  const handleDeleteMonitor = useCallback(async (monitorId) => {
    if (!(await confirm({ title: 'Delete monitor', message: 'Are you sure you want to delete this monitor?' }))) {
      return;
    }

    try {
      await monitorsApi.deleteMonitor(monitorId);
      showSuccess('Monitor deleted successfully');
      await fetchMonitors();
    } catch (err) {
      console.error('Error deleting monitor:', err);
      showError(err.message || 'Failed to delete monitor');
    }
  }, [confirm, showSuccess, showError, fetchMonitors]);

  /**
   * Trigger immediate check
   */
  const handleTriggerCheck = useCallback(async (monitorId) => {
    try {
      await monitorsApi.triggerCheck(monitorId);
      showSuccess('Check triggered');
      // Refresh after a short delay
      setTimeout(() => {
        fetchTimeseries(monitorId);
      }, 2000);
    } catch (err) {
      console.error('Error triggering check:', err);
      showError(err.message || 'Failed to trigger check');
    }
  }, [showSuccess, showError, fetchTimeseries]);

  // Initial fetch
  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(() => {
        refresh();
      }, refreshInterval * 1000);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, refresh]);

  // Countdown timer
  useEffect(() => {
    if (autoRefresh) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown(prev => (prev > 0 ? prev - 1 : refreshInterval));
      }, 1000);
    } else {
      setCountdown(refreshInterval);
    }

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [autoRefresh, refreshInterval]);

  // Calculate overall status
  const overallStatus = getOverallStatus(monitors);

  return {
    // Data
    monitors,
    timeseriesData,
    timeseriesLoading,
    overallStatus,

    // Loading/Error
    loading,
    error,

    // Auto-refresh
    autoRefresh,
    toggleAutoRefresh,
    countdown,
    refreshInterval,
    lastRefresh,
    refresh,

    // Dialog
    dialogOpen,
    selectedMonitor,
    dialogLoading,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseDialog,
    handleSaveMonitor,

    // Actions
    handleDeleteMonitor,
    handleTriggerCheck,
    fetchTimeseries
  };
};

export default useHealthMonitor;
