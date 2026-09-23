import { useState, useCallback, useEffect } from 'react';
import { applyDagreLayout } from './dagreLayout';
import { createTopologyContext, buildDidTopology } from './topologyBuilder';

/**
 * Recursive hook that fetches a single DID and walks its full routing chain,
 * producing ReactFlow nodes + edges with dagre auto-layout.
 *
 * Also fetches billing context: SIP providers, active subscription, and tariffs.
 * Delegates the graph build to the shared {@link buildDidTopology} so the Studio
 * (environment-wide) canvas and this single-DID view stay in lockstep.
 *
 * @param {string} didUuid – The DID to visualize
 * @returns {{ nodes, edges, loading, error, selectedNode, setSelectedNode, refresh }}
 */
export const usePBXRoutingTopology = (didUuid) => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const build = useCallback(async () => {
    if (!didUuid) {
      setNodes([]);
      setEdges([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ctx = createTopologyContext();
      const did = await buildDidTopology(didUuid, ctx);
      if (!did) {
        setError('Route not found');
        setLoading(false);
        return;
      }
      const laidOut = applyDagreLayout(ctx.rawNodes, ctx.rawEdges);
      setNodes(laidOut);
      setEdges(ctx.rawEdges);
    } catch (err) {
      console.error('PBXRouting: build error', err);
      setError(err.message || 'Failed to build routing topology');
    } finally {
      setLoading(false);
    }
  }, [didUuid]);

  useEffect(() => {
    build();
  }, [build]);

  const refresh = useCallback(() => {
    setSelectedNode(null);
    build();
  }, [build]);

  return { nodes, edges, loading, error, selectedNode, setSelectedNode, refresh };
};

export default usePBXRoutingTopology;
