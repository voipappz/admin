import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from '@mui/material/styles';

const ThemeContext = createContext();
const THEME_STORAGE_KEY = 'theme-preference';

// First visit with nothing stored: follow the OS. The stored value is always a
// resolved 'light' | 'dark', so `data-theme` stays binary (tests assert it).
const initialTheme = () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(initialTheme);
  // MUI's colour-scheme state (src/theme/theme.js keys its CSS variables on
  // the same `data-theme` attribute). Kept in step here so both the app's
  // CSS and every MUI component flip together. `setMode` is absent when this
  // provider is rendered without the MUI provider (unit tests).
  const { setMode } = useColorScheme() || {};

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    setMode?.(theme);
  }, [theme, setMode]);

  // Another tab changed the theme (MUI already follows it through the same
  // storage key); keep this context — and its consumers — in step too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const isDarkMode = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return context;
};
