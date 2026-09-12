import { useState, useEffect, useCallback, useRef } from 'react';
import { liveApi } from '../../services/api/liveApi';

/**
 * Custom hook for Live Agents management
 *
 * Backend returns (GET /api/users?action=agents&search[environment_uuid]=UUID):
 * [{
 *   extension_uuid, fullname, username, uuid,
 *   status_uuid, status_name, state
 * }]
 *
 * @param {boolean} enabled - Only fetch data when this tab is active
 * @param {string} environmentUuid - Required environment UUID for agent query
 */
export const useLiveAgents = (enabled = false, environmentUuid = null) => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [statistics, setStatistics] = useState({
    available: 0,
    onCall: 0,
    onBreak: 0,
    offline: 0,
    total: 0
  });

  const fetchTimeoutRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const THROTTLE_DELAY = 2000;

  const fetchLiveAgents = useCallback(async () => {
    if (!enabled) return;

    if (!environmentUuid) {
      setAgents([]);
      setTotalCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;

    if (timeSinceLastFetch < THROTTLE_DELAY) {
      fetchTimeoutRef.current = setTimeout(() => {
        fetchLiveAgents();
      }, THROTTLE_DELAY - timeSinceLastFetch);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      lastFetchTimeRef.current = now;

      const response = await liveApi.getLiveAgents(environmentUuid);

      let rawData = [];
      if (Array.isArray(response)) {
        rawData = response;
      } else if (response && typeof response === 'object') {
        rawData = response.data || response.agents || response.users || response.items || [];
      }

      // Transform to UI-friendly format matching backend response
      const transformedData = rawData.map((agent, index) => ({
        id: agent.uuid || `agent-${index}`,
        uuid: agent.uuid,
        fullname: agent.fullname || agent.user_name || '',
        username: agent.username || '',
        extension_uuid: agent.extension_uuid || '',
        status_name: agent.status_name || '',
        status_uuid: agent.status_uuid || '',
        state: agent.state || ''
      }));

      setAgents(transformedData);
      setTotalCount(transformedData.length);

      // Calculate statistics
      const stats = {
        available: transformedData.filter(a => a.state === 'Waiting' || a.status_name === 'Available' || a.status_name === 'available').length,
        onCall: transformedData.filter(a => a.state === 'In a queue call' || a.status_name === 'Busy' || a.status_name === 'busy').length,
        onBreak: transformedData.filter(a => a.state === 'On Break' || a.status_name === 'On Break').length,
        offline: transformedData.filter(a => !a.state || a.state === 'offline').length,
        total: transformedData.length
      };
      setStatistics(stats);
    } catch (err) {
      console.error('Error fetching live agents:', err);
      setError(err.message || 'Failed to load live agents');
      setAgents([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, environmentUuid]);

  useEffect(() => {
    if (enabled) {
      fetchLiveAgents();
    }
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [enabled, fetchLiveAgents]);

  const refresh = useCallback(() => {
    fetchLiveAgents();
  }, [fetchLiveAgents]);

  return {
    agents,
    loading,
    error,
    totalCount,
    statistics,
    refresh
  };
};

export default useLiveAgents;
