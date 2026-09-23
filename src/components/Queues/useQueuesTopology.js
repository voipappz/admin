import { useState, useEffect, useCallback, useMemo } from 'react';
import { didsApi } from '../../services/api/routesApi';
import { queuesApi } from '../../services/api/queuesApi';
import { getAllCallConditions } from '../../services/api/callConditionsApi';
import { bridgeApi } from '../../services/api/bridgeApi';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { useNotification } from '../../context/NotificationContext';

/**
 * Hook for building the full PBX routing topology.
 * Shows ALL DIDs and their complete routing chains:
 *   DID → Queue (direct)
 *   DID → Call Condition → Queue/IVR/Announcement/etc
 *   DID → IVR
 *   DID → Announcement
 *   DID → Bot
 *   DID → VML
 *   DID → Extension
 *   DID → Number (forward)
 *
 * Also resolves CC resource destinations and queue timeout destinations.
 */
export const useQueuesTopology = () => {
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState({ dids: [], queues: [], callConditions: [], ivrs: [], announcements: [] });
  const [selectedNode, setSelectedNode] = useState(null); // { type, data }

  const { selectedEnvironments } = useCustomerEnvironment();
  const { showError } = useNotification();
  const envUuid = selectedEnvironments?.[0]?.uuid;

  const fetchAll = useCallback(async () => {
    if (!envUuid) {
      setRawData({ dids: [], queues: [], callConditions: [], ivrs: [], announcements: [] });
      return;
    }

    setLoading(true);
    try {
      const [didsResp, queuesResp, ccResp, ivrsResp, announcementsResp] = await Promise.all([
        didsApi.getDIDs({ environment_uuid: envUuid, per_page: 9999 }),
        queuesApi.getQueues({ environment_uuid: envUuid, per_page: 9999 }),
        getAllCallConditions({ environment_uuid: envUuid, perPage: 9999 }),
        bridgeApi.getBridgeResources('ivr', envUuid).catch(() => []),
        bridgeApi.getBridgeResources('announcement', envUuid).catch(() => []),
      ]);

      setRawData({
        dids: normalize(didsResp),
        queues: normalize(queuesResp),
        callConditions: Array.isArray(ccResp) ? ccResp : [],
        ivrs: normalize(ivrsResp),
        announcements: normalize(announcementsResp),
      });
    } catch (err) {
      console.error('Topology fetch error:', err);
      showError('Failed to load topology data');
    } finally {
      setLoading(false);
    }
  }, [envUuid, showError]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /**
   * Build the full topology graph.
   * Nodes: DID, CC, Queue, IVR, Announcement, Bot, VML, Extension, Number
   * Edges: DID→bridge, CC resource→bridge, Queue timeout→bridge
   */
  const topology = useMemo(() => {
    const { dids, queues, callConditions, ivrs, announcements } = rawData;

    // Index resources by uuid for lookup
    const lookup = new Map();
    queues.forEach(q => lookup.set(q.uuid, { ...q, _type: 'queue' }));
    callConditions.forEach(cc => lookup.set(cc.uuid, { ...cc, _type: 'call_condition' }));
    ivrs.forEach(iv => lookup.set(iv.uuid, { ...iv, _type: 'ivr' }));
    announcements.forEach(a => lookup.set(a.uuid, { ...a, _type: 'announcement' }));

    const nodes = [];
    const edges = [];
    const seenNodeIds = new Set();

    const addNode = (id, type, data, extra = {}) => {
      if (seenNodeIds.has(id)) return;
      seenNodeIds.add(id);
      nodes.push({ id, type, data, ...extra });
    };

    const addEdge = (from, to, edgeType) => {
      edges.push({ from, to, type: edgeType });
    };

    // Helper: resolve a bridge_type + bridge_uuid into a node
    const resolveBridge = (bridgeType, bridgeUuid, bridgeObj) => {
      if (!bridgeType) return null;
      const bt = bridgeType === 'que' ? 'queue' : bridgeType;
      const id = `${bt}-${bridgeUuid || 'unknown'}`;
      const resolved = bridgeUuid ? lookup.get(bridgeUuid) : null;
      const name = resolved?.name || bridgeObj?.name || bridgeObj?.number || bridgeUuid?.slice(0, 8) || bt;
      addNode(id, bt, resolved || bridgeObj || { uuid: bridgeUuid, name }, {
        label: name,
        sublabel: formatBridgeType(bt),
      });
      return id;
    };

    // 1. Process every DID
    for (const did of dids) {
      const didId = `did-${did.uuid}`;
      addNode(didId, 'did', did, {
        label: did.name || did.number || 'Route',
        sublabel: did.number || '',
      });

      if (!did.bridge_type) continue;

      const destId = resolveBridge(did.bridge_type, did.bridge_uuid, did.bridge);
      if (destId) {
        addEdge(didId, destId, 'did-bridge');
      }
    }

    // 2. Expand Call Conditions: each resource routes somewhere
    for (const cc of callConditions) {
      const ccId = `call_condition-${cc.uuid}`;
      if (!seenNodeIds.has(ccId)) continue; // Only if referenced by a DID

      // Update CC node with richer info
      const ccNode = nodes.find(n => n.id === ccId);
      if (ccNode) {
        ccNode.sublabel = `${(cc.resources || []).length} rule${(cc.resources || []).length !== 1 ? 's' : ''}`;
      }

      // Resource destinations
      if (cc.resources && Array.isArray(cc.resources)) {
        for (const res of cc.resources) {
          const bt = res.bridge_type === 'que' ? 'queue' : res.bridge_type;
          if (bt && res.bridge_uuid) {
            const destId = resolveBridge(bt, res.bridge_uuid, res.bridge);
            if (destId) addEdge(ccId, destId, 'cc-resource');
          }
          // Fallback per resource
          const fbt = res.fallback_bridge_type === 'que' ? 'queue' : res.fallback_bridge_type;
          if (fbt && res.fallback_bridge_uuid) {
            const destId = resolveBridge(fbt, res.fallback_bridge_uuid, res.fallback_bridge);
            if (destId) addEdge(ccId, destId, 'cc-fallback');
          }
        }
      }

      // Global fallback
      const gfbt = cc.fallback_bridge_type === 'que' ? 'queue' : cc.fallback_bridge_type;
      if (gfbt && cc.fallback_bridge_uuid) {
        const destId = resolveBridge(gfbt, cc.fallback_bridge_uuid, cc.fallback_bridge);
        if (destId) addEdge(ccId, destId, 'cc-fallback');
      }
    }

    // 3. Expand Queue timeout destinations
    for (const q of queues) {
      const qId = `queue-${q.uuid}`;
      if (!seenNodeIds.has(qId)) continue;

      // Enrich queue node
      const qNode = nodes.find(n => n.id === qId);
      if (qNode) {
        qNode.sublabel = formatStrategy(q.strategy);
        qNode.agentCount = Array.isArray(q.tiers) ? q.tiers.length : null;
        qNode.enabled = q.enabled;
      }

      // Timeout bridge
      const tbt = q.max_wait_time_bridge_type === 'que' ? 'queue' : q.max_wait_time_bridge_type;
      if (tbt && q.max_wait_time_bridge_uuid) {
        const destId = resolveBridge(tbt, q.max_wait_time_bridge_uuid, null);
        if (destId) addEdge(qId, destId, 'timeout');
      }
    }

    return { nodes, edges };
  }, [rawData]);

  return {
    topology,
    loading,
    selectedNode,
    setSelectedNode,
    refreshTopology: fetchAll,
  };
};

function normalize(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp?.data && Array.isArray(resp.data)) return resp.data;
  return [];
}

function formatStrategy(strategy) {
  if (!strategy) return '';
  return String(strategy).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatBridgeType(type) {
  if (!type) return '';
  return String(type).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default useQueuesTopology;
