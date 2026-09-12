import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { toResult, toEndpoint } from '../utils/gatus';

// Health is sourced from Gatus (the status monitor) via its JSON API.
// Gatus is served same-origin through Kong at /api/v1/endpoints/statuses,
// so a relative fetch works in every environment with no extra config.
//
// The Gatus JSON normalisation (toResult/toEndpoint) lives in ../utils/gatus so
// the per-node health hook reuses the EXACT same shaping. Re-exported here for
// backward compatibility with any existing importers.
export { toResult, toEndpoint };
const GATUS_URL = '/api/v1/endpoints/statuses';

// Module-level singleton state so multiple consumers (TopBar dialog, Sidebar
// status pill) share one poll loop instead of each running their own timer.
const state = {
  isHealthy: null,
  status: 0,
  response: null, // { endpoints: [...], summary: { total, up, down } }
  loading: true,
};
const subscribers = new Set();
let intervalId = null;
let started = false;

const notify = () => subscribers.forEach((fn) => fn({ ...state }));

const setState = (patch) => {
  Object.assign(state, patch);
  notify();
};

export const checkGatusHealth = async () => {
  try {
    // This API route is deliberately protected because its payload contains
    // internal service names and ports. Use the authenticated client so a 401
    // refreshes and replays instead of destroying the whole admin session.
    // Health is polled, so discard the client's normal 30-second GET cache.
    apiService.clearCache(GATUS_URL);
    const data = await apiService.get(
      GATUS_URL,
      { headers: { Accept: 'application/json' } },
      'Gatus health',
      false,
      true,
    );
    const endpoints = (Array.isArray(data) ? data : []).map(toEndpoint);
    const up = endpoints.filter((e) => e.up).length;
    const down = endpoints.length - up;

    setState({
      // Healthy only when we have endpoints and every one is up.
      isHealthy: endpoints.length > 0 && down === 0,
      status: 200,
      response: {
        endpoints,
        summary: { total: endpoints.length, up, down },
      },
      loading: false,
    });
  } catch (error) {
    setState({
      isHealthy: false,
      status: error?.status || 0,
      response: {
        endpoints: [],
        summary: { total: 0, up: 0, down: 0 },
        error: error.message || 'Health check failed',
      },
      loading: false,
    });
  }
};

export const useGatusHealth = () => {
  const { isAuthenticated } = useAuth();
  const [snapshot, setSnapshot] = useState({ ...state });

  useEffect(() => {
    subscribers.add(setSnapshot);
    return () => subscribers.delete(setSnapshot);
  }, []);

  useEffect(() => {
    // The Gatus API is protected. Do not manufacture a guaranteed 401 while
    // AuthContext is still restoring a session or after the user logs out.
    if (!isAuthenticated) {
      setState({ isHealthy: null, status: 0, response: null, loading: false });
      return undefined;
    }
    if (started) return undefined;
    started = true;
    checkGatusHealth();
    const restart = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(checkGatusHealth, 30000);
    };
    restart();
    return () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
      started = false;
    };
  }, [isAuthenticated]);

  const refresh = useCallback(
    () => (isAuthenticated ? checkGatusHealth() : Promise.resolve()),
    [isAuthenticated],
  );

  return {
    isHealthy: snapshot.isHealthy,
    loading: snapshot.loading,
    status: snapshot.status,
    response: snapshot.response,
    // convenience accessors
    endpoints: snapshot.response?.endpoints || [],
    summary: snapshot.response?.summary || { total: 0, up: 0, down: 0 },
    refresh,
  };
};

export default useGatusHealth;
