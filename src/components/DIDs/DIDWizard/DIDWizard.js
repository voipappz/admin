import { useState, useCallback, useRef } from 'react';

/**
 * useWizard Hook
 * Manages a view stack for drill-down wizard navigation.
 *
 * Each view in the stack represents a form (DID, IVR, Queue, Announcement, etc.)
 * All views stay mounted (hidden) so form state is preserved during drill-down.
 * Results flow back via onResult callbacks when a view is saved and popped.
 */
let viewIdCounter = 0;
const generateViewId = () => `view-${++viewIdCounter}-${Date.now()}`;

export const useWizard = () => {
  const [viewStack, setViewStack] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Store onResult callbacks by view ID (not in state to avoid serialization issues)
  const onResultCallbacksRef = useRef({});

  /**
   * Open the wizard with an initial view
   * @param {Object} config - Initial view configuration
   * @param {string} config.type - Entity type: 'did'|'ivr'|'queue'|'announcement'|'vml'|'call_condition'|'bot'|'extension'
   * @param {string} config.mode - 'create' or 'edit'
   * @param {string} config.label - Breadcrumb label
   * @param {Object|null} config.data - Entity data (null for create)
   * @param {string} config.environmentUuid - Environment UUID
   */
  const open = useCallback((config) => {
    const id = generateViewId();
    setViewStack([{
      id,
      type: config.type,
      mode: config.mode,
      label: config.label || `${config.type.toUpperCase()}: (new)`,
      data: config.data,
      environmentUuid: config.environmentUuid,
    }]);
    setIsOpen(true);
  }, []);

  /**
   * Close the wizard entirely
   */
  const close = useCallback(() => {
    // Clean up all callbacks
    onResultCallbacksRef.current = {};
    setViewStack([]);
    setIsOpen(false);
  }, []);

  /**
   * Push a new view onto the stack (drill down)
   * @param {Object} config - View configuration
   * @param {Function} config.onResult - Callback invoked with saved entity data when this view is saved and popped
   */
  const pushView = useCallback((config) => {
    const id = generateViewId();

    // Store onResult callback in ref (not serializable in state)
    if (config.onResult) {
      onResultCallbacksRef.current[id] = config.onResult;
    }

    const typeName = config.type === 'call_condition' ? 'Call Condition'
      : config.type.toUpperCase();
    const entityName = config.data?.name || '(new)';

    setViewStack(prev => [...prev, {
      id,
      type: config.type,
      mode: config.mode,
      label: config.label || `${typeName}: ${entityName}`,
      data: config.data,
      environmentUuid: config.environmentUuid,
    }]);
  }, []);

  /**
   * Pop the current view (go back one level)
   * @param {Object|null} result - Saved entity data to pass to parent's onResult callback
   */
  const popView = useCallback((result = null) => {
    setViewStack(prev => {
      if (prev.length <= 1) {
        // Last view — close the wizard
        onResultCallbacksRef.current = {};
        setIsOpen(false);
        return [];
      }

      const popped = prev[prev.length - 1];

      // Invoke onResult callback for the popped view (async, after state update)
      const callback = onResultCallbacksRef.current[popped.id];
      if (callback && result) {
        // Use setTimeout to ensure state update completes first
        setTimeout(() => {
          callback(result);
          delete onResultCallbacksRef.current[popped.id];
        }, 0);
      } else {
        delete onResultCallbacksRef.current[popped.id];
      }

      return prev.slice(0, -1);
    });
  }, []);

  /**
   * Navigate to a specific breadcrumb level (truncate stack)
   * @param {number} index - Index in viewStack to navigate to
   */
  const navigateTo = useCallback((index) => {
    setViewStack(prev => {
      // Clean up callbacks for views being removed
      const removed = prev.slice(index + 1);
      removed.forEach(view => {
        delete onResultCallbacksRef.current[view.id];
      });
      return prev.slice(0, index + 1);
    });
  }, []);

  /**
   * Update the label of the current (top) view
   * Useful for updating breadcrumb as user types a name
   * @param {string} label - New label
   */
  const updateCurrentLabel = useCallback((label) => {
    setViewStack(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], label };
      return updated;
    });
  }, []);

  const currentView = viewStack.length > 0 ? viewStack[viewStack.length - 1] : null;
  const currentIndex = viewStack.length - 1;
  const canGoBack = viewStack.length > 1;

  return {
    viewStack,
    isOpen,
    currentView,
    currentIndex,
    canGoBack,
    open,
    close,
    pushView,
    popView,
    navigateTo,
    updateCurrentLabel,
  };
};
