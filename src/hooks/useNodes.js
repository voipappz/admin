import { useState, useEffect, useCallback } from 'react';
import { nodesApi } from '../services/api/nodesApi';

// Normalise whatever shape the nodes endpoint returns (array, {data}, {items})
// into a flat array of nodes.
const asList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};

/**
 * useNodes — the list of nodes/sites in this deployment.
 *
 * Sources from the existing `nodesApi` (GET /api/customers/nodes, falling back
 * to /tasks/nodes), so it reuses the app's established nodes API rather than a
 * new endpoint. Each node carries at least { uuid, name, type }.
 *
 * @returns {{ nodes: Array, loading: boolean, error: string|null, refresh: Function }}
 */
export const useNodes = () => {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await nodesApi.getNodes();
      setNodes(asList(res));
    } catch (err) {
      console.error('Error fetching nodes:', err);
      setError(err?.message || 'Failed to load nodes');
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  return { nodes, loading, error, refresh: fetchNodes };
};

export default useNodes;
