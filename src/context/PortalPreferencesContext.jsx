import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useUserAuth } from './UserAuthContext';
import { useThemeMode } from './ThemeContext';

export const PORTAL_DEFAULTS = {
  theme: 'light', calls_days: '7', calls_page_size: '25', calls_sort: 'desc',
  calls_chart: 'true', calls_density: 'comfortable', phone_pinned: 'false',
  calls_columns: 'created_at,profile.direction,profile.caller,profile.callee,profile.talk_duration,profile.cause',
};
const Context = createContext(null);
const storageKey = (uuid) => `portal_preferences:${uuid}`;

export function PortalPreferencesProvider({ children }) {
  const { user, isAuthenticated } = useUserAuth();
  const { setTheme } = useThemeMode();
  const [preferences, setPreferences] = useState(PORTAL_DEFAULTS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreferences(PORTAL_DEFAULTS);
    setReady(false);
    setError('');
    if (!isAuthenticated) return undefined;
    let next = PORTAL_DEFAULTS;
    try {
      next = { ...PORTAL_DEFAULTS, ...JSON.parse(localStorage.getItem(storageKey(user.uuid)) || '{}') };
    } catch {
      setError('Saved preferences could not be read. Showing defaults.');
    }
    setPreferences(next);
    setTheme(next.theme);
    setReady(true);
    return undefined;
  }, [user?.uuid, isAuthenticated, setTheme]);

  const save = useCallback((patch) => {
    if (!ready) return Promise.resolve();
    const next = { ...preferences, ...patch };
    setPreferences(next);
    if (patch.theme) setTheme(patch.theme);
    try {
      localStorage.setItem(storageKey(user.uuid), JSON.stringify(next));
      setError('');
    } catch {
      setError('Preferences could not be saved in this browser.');
    }
    return Promise.resolve();
  }, [preferences, ready, setTheme, user?.uuid]);

  return <Context.Provider value={{ preferences, ready, error, save, reset: () => save(PORTAL_DEFAULTS) }}>{children}</Context.Provider>;
}

export const usePortalPreferences = () => useContext(Context);
