import { useState, useEffect, useCallback, useRef } from 'react';
import { liveApi } from '../../services/api/liveApi';

/**
 * Custom hook for Live SIP Registrations management
 *
 * Backend returns:
 *   GET /api/extensions?action=live_fields → {reg_user: {method: "reg_user"}, realm: {method: "realm"}, ...}
 *   GET /api/extensions?action=live → array of registration objects from FreeSwitch
 *
 * @param {boolean} enabled - Only fetch data when this tab is active
 */
export const useLiveRegistrations = (enabled = false) => {
  const [registrations, setRegistrations] = useState([]);
  const [columns, setColumns] = useState(getDefaultColumns());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isNodeError, setIsNodeError] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTimeoutRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const THROTTLE_DELAY = 2000;

  /**
   * Build DataGrid columns from the live_fields response.
   * Backend returns: {reg_user: {method: "reg_user"}, realm: {method: "realm"}, ...}
   */
  const fetchColumns = useCallback(async () => {
    if (!enabled) return;

    try {
      const response = await liveApi.getLiveRegistrationsFields();

      if (response && typeof response === 'object' && !Array.isArray(response)) {
        // Backend returns: {reg_user: {method: "reg_user"}, realm: {method: "realm"}, ...}
        const fieldNames = Object.keys(response);
        if (fieldNames.length > 0) {
          // The async `show registrations as json` command carries the SIP
          // User-Agent per registration, but live_fields may omit it — always
          // surface a user_agent column so the device/softphone shows up.
          if (!fieldNames.includes('user_agent')) fieldNames.push('user_agent');
          const gridColumns = fieldNames.map(fieldName => ({
            field: fieldName,
            headerName: humanize(fieldName),
            width: getColumnWidth(fieldName),
            editable: false
          }));
          setColumns(gridColumns);
          return;
        }
      }

      setColumns(getDefaultColumns());
    } catch (err) {
      console.error('Error fetching live registrations columns:', err);
      setColumns(getDefaultColumns());
    }
  }, [enabled]);

  const fetchLiveRegistrations = useCallback(async () => {
    if (!enabled) return;

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;

    if (timeSinceLastFetch < THROTTLE_DELAY) {
      fetchTimeoutRef.current = setTimeout(() => {
        fetchLiveRegistrations();
      }, THROTTLE_DELAY - timeSinceLastFetch);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsNodeError(false);
      lastFetchTimeRef.current = now;

      const response = await liveApi.getLiveRegistrations({});

      let rawData = [];
      if (Array.isArray(response)) {
        rawData = response;
      } else if (response && typeof response === 'object') {
        rawData = response.data || response.registrations || response.extensions || response.items || [];
      }

      // Add unique id to each row for DataGrid, and normalize the SIP
      // User-Agent from whatever key the async command used (FreeSWITCH may
      // return agent / sip_user_agent depending on version).
      const withIds = rawData.map((reg, index) => ({
        ...reg,
        user_agent: reg.user_agent || reg.agent || reg.sip_user_agent || '',
        id: reg.reg_user ? `${reg.reg_user}@${reg.realm || ''}` : `reg-${index}`
      }));

      setRegistrations(withIds);
      setTotalCount(withIds.length);
    } catch (err) {
      console.error('Error fetching live registrations:', err);
      const status = err.status || err.statusCode || err.response?.status;
      const responseMsg = err.response?.data?.message || err.response?.data?.error || err.message || '';
      if (status === 500 && (responseMsg.toLowerCase().includes('node') || responseMsg.toLowerCase().includes('switch') || responseMsg === '')) {
        setIsNodeError(true);
        setError('No FreeSwitch node configured for this customer.');
      } else {
        setError(err.message || 'Failed to load live registrations');
      }
      setRegistrations([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      fetchColumns();
      fetchLiveRegistrations();
    }
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [enabled, fetchColumns, fetchLiveRegistrations]);

  const refresh = useCallback(() => {
    fetchLiveRegistrations();
  }, [fetchLiveRegistrations]);

  return {
    registrations,
    columns,
    loading,
    error,
    isNodeError,
    totalCount,
    refresh
  };
};

const humanize = (str) => {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

const getColumnWidth = (field) => {
  if (field === 'user_agent') return 220;
  if (field === 'url' || field === 'hostname') return 200;
  if (field === 'reg_user') return 120;
  if (field === 'realm') return 180;
  if (field === 'network_ip') return 140;
  if (field === 'expires') return 120;
  return 130;
};

const getDefaultColumns = () => [
  { field: 'reg_user', headerName: 'Device', width: 120 },
  { field: 'realm', headerName: 'Realm', width: 180 },
  { field: 'network_ip', headerName: 'IP Address', width: 140 },
  { field: 'network_port', headerName: 'Port', width: 90 },
  { field: 'network_proto', headerName: 'Protocol', width: 100 },
  { field: 'url', headerName: 'URL', width: 200 },
  { field: 'user_agent', headerName: 'User Agent', width: 220 },
  { field: 'expires', headerName: 'Expires', width: 120 },
  { field: 'hostname', headerName: 'Hostname', width: 160 }
];

export default useLiveRegistrations;
