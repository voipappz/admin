import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useVersionCheck — detects when a new build is deployed
 *
 * How it works:
 * 1. CI injects VITE_BUILD_ID at build time and creates /version.json
 * 2. This hook periodically fetches /version.json
 * 3. If the server's build ID differs from the embedded one → new version available
 *
 * The hook checks:
 * - Every `intervalMs` milliseconds (default: 5 minutes)
 * - On window focus (user switches back to the tab)
 * - On route navigation (via manual `check()` call)
 */
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useVersionCheck = ({ enabled = true, intervalMs = CHECK_INTERVAL } = {}) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);
  const dismissedRef = useRef(false);

  const currentBuild = import.meta.env.VITE_BUILD_ID || null;

  const checkVersion = useCallback(async () => {
    if (!enabled || dismissedRef.current) return;

    // In dev mode (no build ID), skip checking
    if (!currentBuild) return;

    try {
      const response = await fetch('/version.json', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!response.ok) return;

      const data = await response.json();

      if (data.build && data.build !== currentBuild) {
        setServerVersion(data);
        setUpdateAvailable(true);
      }
    } catch {
      // Network error or version.json not found — ignore silently
    }
  }, [currentBuild, enabled]);

  // Periodic polling
  useEffect(() => {
    if (!enabled || !currentBuild) return;

    // Initial check after a short delay (don't check on page load)
    const initialTimer = setTimeout(checkVersion, 30000);

    // Recurring checks
    const interval = setInterval(checkVersion, intervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkVersion, enabled, currentBuild, intervalMs]);

  // Check on window focus (user returns to tab)
  useEffect(() => {
    if (!enabled || !currentBuild) return;

    const handleFocus = () => checkVersion();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkVersion, enabled, currentBuild]);

  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setUpdateAvailable(false);
  }, []);

  return {
    updateAvailable,
    serverVersion,
    currentBuild,
    refresh,
    dismiss,
    check: checkVersion
  };
};

export default useVersionCheck;
