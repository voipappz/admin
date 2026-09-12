import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';
import { findNavItemByPath } from '../config/navConfig';
import { clearRecentObjects } from '../utils/recentObjects';

const RecentPagesContext = createContext(null);

const STORAGE_KEY = 'nimbus_recent_pages';
const MAX_ITEMS = 12;
const EXCLUDED_PATHS = ['/login', '/'];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or unavailable
  }
}

export const RecentPagesProvider = ({ children }) => {
  const location = useLocation();
  const [recentEntries, setRecentEntries] = useState(loadFromStorage);

  // Track navigation
  useEffect(() => {
    const path = location.pathname;
    if (EXCLUDED_PATHS.includes(path)) return;

    // Only track paths that map to a known nav item
    const navItem = findNavItemByPath(path);
    if (!navItem) return;

    setRecentEntries(prev => {
      // Remove existing entry for this path (dedup)
      const filtered = prev.filter(entry => entry.path !== path);
      // Add to front
      const updated = [{ path, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      saveToStorage(updated);
      return updated;
    });
  }, [location.pathname]);

  // Listen for customer switch → clear recent pages
  useEffect(() => {
    const handleCustomerSwitch = () => {
      setRecentEntries([]);
      localStorage.removeItem(STORAGE_KEY);
      clearRecentObjects(); // edited-object recents are customer-scoped too
    };
    window.addEventListener('nimbus:customerSwitched', handleCustomerSwitch);
    return () => window.removeEventListener('nimbus:customerSwitched', handleCustomerSwitch);
  }, []);

  // Hydrate entries with nav item data at read time
  const recentPages = recentEntries.map(entry => {
    const navItem = findNavItemByPath(entry.path);
    if (!navItem) return null;
    return {
      path: entry.path,
      timestamp: entry.timestamp,
      label: navItem.text,
      iconComponent: navItem.iconComponent,
    };
  }).filter(Boolean);

  const clearRecentPages = useCallback(() => {
    setRecentEntries([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <RecentPagesContext.Provider value={{ recentPages, clearRecentPages }}>
      {children}
    </RecentPagesContext.Provider>
  );
};

export const useRecentPages = () => {
  const context = useContext(RecentPagesContext);
  if (!context) {
    throw new Error('useRecentPages must be used within a RecentPagesProvider');
  }
  return context;
};

export default RecentPagesContext;
