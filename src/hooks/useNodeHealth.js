import { useState, useEffect, useCallback } from 'react';
import { nodesApi } from '../services/api/nodesApi';
import { toHealth } from '../utils/gatus';

/**
 * useNodeHealth — fetch a single node's Gatus health, normalised with the SAME
 * util `useGatusHealth` uses (../utils/gatus), so the resulting endpoints feed
 * `GatusHealthPanel` unchanged.
 *
 * CONTRACT (backend TODO — may not exist yet): `GET /api/v1/nodes/:id/health`
 * returns a Gatus statuses array (SAME shape as `/api/v1/endpoints/statuses`);
 * the mothership API relays a NATS `crystal.request.gatus.status` to the node.
 *
 * LAZY: pass a falsy `nodeId` (e.g. until a node row is selected/expanded) and
 * it does nothing — no fetch — so callers can avoid hammering every node at once.
 *
 * @param {string|null} nodeId
 * @returns {{ endpoints: Array, summary: {total,up,down}, isHealthy: boolean|null, loading: boolean, error: string|null, refresh: Function }}
 */
export const useNodeHealth = (nodeId) => {
  const [endpoints, setEndpoints] = useState([]);
  const [summary, setSummary] = useState({ total: 0, up: 0, down: 0 });
  const [isHealthy, setIsHealthy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHealth = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await nodesApi.getNodeHealth(nodeId);
      const health = toHealth(data);
      setEndpoints(health.endpoints);
      setSummary(health.summary);
      setIsHealthy(health.isHealthy);
    } catch (err) {
      console.error(`Error fetching health for node ${nodeId}:`, err);
      setError(err?.message || 'Health check failed');
      setEndpoints([]);
      setSummary({ total: 0, up: 0, down: 0 });
      setIsHealthy(false);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  // Lazy: only fetch once a nodeId is provided (i.e. the node is selected/expanded).
  useEffect(() => {
    if (nodeId) fetchHealth();
  }, [nodeId, fetchHealth]);

  return { endpoints, summary, isHealthy, loading, error, refresh: fetchHealth };
};

export default useNodeHealth;
