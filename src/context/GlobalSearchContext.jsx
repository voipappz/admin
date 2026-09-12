import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';

const GlobalSearchContext = createContext(null);

const FILTER_STORAGE_PREFIX = 'screen_filters_';

export const useGlobalSearch = () => {
  const context = useContext(GlobalSearchContext);
  if (!context) {
    throw new Error('useGlobalSearch must be used within a GlobalSearchProvider');
  }
  return context;
};

function clearAllPersistedFilters() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(FILTER_STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  keys.forEach(key => localStorage.removeItem(key));
}

export const GlobalSearchProvider = ({ children }) => {
  const [screenName, setScreenName] = useState('');
  const [screenSegments, setScreenSegments] = useState([]);
  const [currentSearchParams, setCurrentSearchParams] = useState({});
  const [quickSearchText, setQuickSearchText] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Callbacks registered by the active screen
  const callbacksRef = useRef({ onSearch: null, onClear: null });

  // Listen for customer switch → clear all persisted filters
  useEffect(() => {
    const handleCustomerSwitch = () => {
      clearAllPersistedFilters();
    };
    window.addEventListener('nimbus:customerSwitched', handleCustomerSwitch);
    return () => window.removeEventListener('nimbus:customerSwitched', handleCustomerSwitch);
  }, []);

  const registerScreen = useCallback((name, segments, callbacks = {}) => {
    setScreenName(name);
    setScreenSegments(segments || []);
    callbacksRef.current = {
      onSearch: callbacks.onSearch || null,
      onClear: callbacks.onClear || null,
    };

    // Check localStorage for persisted filters and restore them
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_PREFIX + name);
      if (stored) {
        const params = JSON.parse(stored);
        // Check if there are actual non-empty values
        const hasValues = Object.values(params).some(v => v !== '' && v !== null && v !== undefined);
        if (hasValues) {
          setCurrentSearchParams(params);
          // Defer the onSearch callback to next frame so the screen is fully mounted
          if (callbacks.onSearch) {
            requestAnimationFrame(() => {
              callbacks.onSearch(params);
            });
          }
          return;
        }
      }
    } catch {
      // Ignore parse errors
    }

    // No persisted filters — reset search state
    setCurrentSearchParams({});
    setQuickSearchText('');
    setShowFilterPanel(false);
  }, []);

  const unregisterScreen = useCallback(() => {
    setScreenName('');
    setScreenSegments([]);
    callbacksRef.current = { onSearch: null, onClear: null };
    setCurrentSearchParams({});
    setQuickSearchText('');
    setShowFilterPanel(false);
  }, []);

  const applyFilters = useCallback((params) => {
    setCurrentSearchParams(params);
    if (callbacksRef.current.onSearch) {
      callbacksRef.current.onSearch(params);
    }
    // Persist filters to localStorage
    if (screenName) {
      try {
        localStorage.setItem(FILTER_STORAGE_PREFIX + screenName, JSON.stringify(params));
      } catch {
        // localStorage full or unavailable
      }
    }
  }, [screenName]);

  const clearFilters = useCallback(() => {
    setCurrentSearchParams({});
    setQuickSearchText('');
    if (callbacksRef.current.onClear) {
      callbacksRef.current.onClear();
    }
    // Remove persisted filters
    if (screenName) {
      localStorage.removeItem(FILTER_STORAGE_PREFIX + screenName);
    }
  }, [screenName]);

  const updateSearchParams = useCallback((params) => {
    setCurrentSearchParams(params);
  }, []);

  const value = useMemo(() => ({
    screenName,
    screenSegments,
    currentSearchParams,
    quickSearchText,
    showFilterPanel,
    setQuickSearchText,
    setShowFilterPanel,
    registerScreen,
    unregisterScreen,
    applyFilters,
    clearFilters,
    updateSearchParams,
  }), [
    screenName,
    screenSegments,
    currentSearchParams,
    quickSearchText,
    showFilterPanel,
    registerScreen,
    unregisterScreen,
    applyFilters,
    clearFilters,
    updateSearchParams,
  ]);

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
    </GlobalSearchContext.Provider>
  );
};

export default GlobalSearchContext;
