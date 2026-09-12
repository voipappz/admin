import { useState, useEffect, useCallback } from 'react';
import { callConditionsApi } from '../../../services/api/callConditionsApi.js';

/**
 * Generate unique ID for resources
 * Used for drag-drop operations
 */
let resourceIdCounter = 0;
const generateResourceId = () => {
  resourceIdCounter += 1;
  return `resource-${Date.now()}-${resourceIdCounter}`;
};

/**
 * useCallCondition Hook
 * Custom hook for call condition creation and management
 *
 * Based on legacy AngularJS patterns from:
 * - /opt/src/va-voipbox-admin/src/scripts/controllers/call_conditions/edit.js
 * - /opt/src/va-voipbox-admin/src/scripts/controllers/call_conditions/new.js
 *
 * Features:
 * - Resources array management (add/remove/reorder)
 * - Bridge types and resources fetching
 * - Fallback routing configuration
 * - Segment-based conditions (one segment per resource)
 *
 * Wire format: per the API model, the resource column is `segment_uuids`
 * (PostgreSQL UUID array). The frontend constrains this to AT MOST ONE
 * uuid per resource — the user picks one rule type (days / hours / caller)
 * in the inline editor. We always send / receive `segment_uuids` as a
 * 1-element array (or empty array for "always matches").
 */
export const useCallCondition = () => {
  // Resources state
  const [resources, setResources] = useState([]);

  // Fallback routing state
  const [fallbackBridgeType, setFallbackBridgeType] = useState('');
  const [fallbackBridgeUuid, setFallbackBridgeUuid] = useState('');

  // Bridge types and resources
  const [bridgeTypes, setBridgeTypes] = useState([]);
  const [bridgeResources, setBridgeResources] = useState({});
  const [loadingBridgeTypes, setLoadingBridgeTypes] = useState(false);

  // General state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch bridge types on mount
  useEffect(() => {
    fetchBridgeTypes();
  }, []);

  /**
   * Fetch available bridge types from API
   */
  const fetchBridgeTypes = async () => {
    setLoadingBridgeTypes(true);
    try {
      const types = await callConditionsApi.getBridgeTypes();
      setBridgeTypes(types);
    } catch (err) {
      console.error('Error fetching bridge types:', err);
      setError('Failed to load bridge types');
    } finally {
      setLoadingBridgeTypes(false);
    }
  };

  /**
   * Fetch bridge resources for a specific type and environment
   */
  const fetchBridgeResources = useCallback(async (bridgeType, environmentUuid) => {
    if (!bridgeType || !environmentUuid || bridgeType === 'number') {
      return;
    }

    try {
      const resources = await callConditionsApi.getBridgeResources(bridgeType, environmentUuid);
      setBridgeResources(prev => ({ ...prev, [bridgeType]: resources }));
    } catch (err) {
      console.error(`Error fetching ${bridgeType} resources:`, err);
    }
  }, []);

  /**
   * Add new resource. `segment_uuids` is an array (max 1 element)
   * (empty array = "always matches").
   */
  const addResource = useCallback(() => {
    const newResource = {
      id: generateResourceId(),
      name: '',
      bridge_type: '',
      bridge_uuid: '',
      segment_uuids: []
    };
    setResources(prev => [...prev, newResource]);
  }, []);

  /**
   * Remove resource by index
   */
  const removeResource = useCallback((index) => {
    setResources(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Update resource by index
   */
  const updateResource = useCallback((index, updated) => {
    setResources(prev => prev.map((item, i) => (i === index ? { ...item, ...updated } : item)));
  }, []);

  /**
   * Reorder resources (for drag-drop)
   */
  const handleReorder = useCallback((reordered) => {
    setResources(reordered);
  }, []);

  /**
   * Validate resources
   */
  const validateResources = useCallback(() => {
    if (resources.length === 0) {
      return { valid: false, error: 'At least one routing resource is required' };
    }

    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];

      if (!resource.bridge_type) {
        return { valid: false, error: `Resource ${i + 1}: Bridge type is required` };
      }

      if (resource.bridge_type !== 'number' && !resource.bridge_uuid) {
        return { valid: false, error: `Resource ${i + 1}: Bridge destination is required` };
      }
    }

    return { valid: true, error: null };
  }, [resources]);

  /**
   * Prepare resources for API save.
   * `segment_uuids` is sent as an array. toFormData encodes it as
   * `resources[i][segment_uuids][]=uuid`. Frontend enforces max 1 element.
   */
  const prepareResourcesForSave = useCallback(async (localResources) => {
    return localResources.map((resource) => ({
      name: resource.name || 'Condition',
      bridge_type: resource.bridge_type,
      bridge_uuid: resource.bridge_uuid,
      segment_uuids: Array.isArray(resource.segment_uuids)
        ? resource.segment_uuids.filter(Boolean).slice(0, 1)
        : []
    }));
  }, []);

  /**
   * Save call condition
   */
  const saveCallCondition = useCallback(async (formData) => {
    setLoading(true);
    setError(null);

    try {
      // Validate resources
      const validation = validateResources();
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Prepare resources with segment UUIDs
      const preparedResources = await prepareResourcesForSave(resources);

      // Prepare call condition data
      const callConditionData = {
        ...formData,
        resources: preparedResources,
        fallback_bridge_type: fallbackBridgeType,
        fallback_bridge_uuid: fallbackBridgeUuid
      };

      // Create call condition
      const result = await callConditionsApi.createCallCondition(callConditionData);
      return result;
    } catch (err) {
      console.error('Error saving call condition:', err);
      setError(err.message || 'Failed to save call condition');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [resources, fallbackBridgeType, fallbackBridgeUuid, validateResources, prepareResourcesForSave]);

  /**
   * Load resources from API response format to frontend format.
   * The API returns `segment_uuids` (plural array) per the model. We
   * also accept legacy `segment_uuid` (singular) for safety. The
   * frontend enforces max 1 element so we slice it.
   */
  const loadFromApiFormat = useCallback((apiResources) => {
    if (!apiResources || !Array.isArray(apiResources)) {
      setResources([]);
      return;
    }

    const normalizeSegmentUuids = (apiResource) => {
      const raw = apiResource.segment_uuids ?? apiResource.segment_uuid;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean).slice(0, 1);
      return [String(raw)];
    };

    const loadedResources = apiResources.map((apiResource, idx) => ({
      id: generateResourceId(),
      name: apiResource.name || `Condition ${idx + 1}`,
      bridge_type: apiResource.bridge_type || '',
      bridge_uuid: apiResource.bridge_uuid || '',
      segment_uuids: normalizeSegmentUuids(apiResource)
    }));

    setResources(loadedResources);
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setResources([]);
    setFallbackBridgeType('');
    setFallbackBridgeUuid('');
    setBridgeResources({});
    setError(null);
    setLoading(false);
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Resources
    resources,
    addResource,
    removeResource,
    updateResource,
    handleReorder,
    validateResources,

    // Fallback routing
    fallbackBridgeType,
    setFallbackBridgeType,
    fallbackBridgeUuid,
    setFallbackBridgeUuid,

    // Bridge types and resources
    bridgeTypes,
    bridgeResources,
    loadingBridgeTypes,
    fetchBridgeResources,

    // General
    loading,
    error,
    clearError,
    saveCallCondition,
    reset,

    // API format conversion
    loadFromApiFormat,
    prepareResourcesForSave
  };
};

export default useCallCondition;
