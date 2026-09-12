import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Slide, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { apiService } from '../services/apiService';
import { configService } from '../services/configService';

const NotificationContext = createContext();

// Card background per level — same palette as the phone app's Toaster, so the
// two products share one toast idiom instead of each inventing its own.
const LEVEL_BG = {
  error: '#8f2a1e',
  warning: '#8a5a00',
  success: '#367823',
  info: '#2f3640',
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const recentRef = useRef(new Map());
  const sequenceRef = useRef(0);

  // One user action should produce one toast. Concurrent API reads can fail
  // with the same response, so suppress an identical message briefly and cap
  // the visible stack. Operational polling failures belong on Monitoring, not
  // in a wall of global notifications.
  const enqueue = useCallback((message, severity, duration) => {
    const level = ['success', 'error', 'warning', 'info'].includes(severity) ? severity : 'info';
    const text = String(message || '').trim();
    if (!text) return;

    const now = Date.now();
    const key = `${level}:${text}`;
    const previous = recentRef.current.get(key) || 0;
    if (now - previous < 5000) return;
    recentRef.current.set(key, now);

    // Prevent the dedupe map itself from growing forever.
    for (const [candidate, timestamp] of recentRef.current) {
      if (now - timestamp > 30000) recentRef.current.delete(candidate);
    }

    const id = `${now}-${sequenceRef.current += 1}`;
    setNotifications(prev => [...prev, {
      id, type: level, message: text, timestamp: now,
    }].slice(-3));
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    }, duration);
  }, []);

  const showSuccess = useCallback((message) => {
    enqueue(message, 'success', configService.get('notifications.successDuration', 5000));
  }, [enqueue]);

  const showError = useCallback((message) => {
    enqueue(message, 'error', configService.get('notifications.errorDuration', 8000));
  }, [enqueue]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  // Generic notifier: showNotification(message, 'success' | 'error' | 'info' | 'warning').
  // Maps to the typed helpers so callers can pass a severity in one call.
  const showNotification = useCallback((message, severity = 'success') => {
    const level = ['success', 'error', 'warning', 'info'].includes(severity) ? severity : 'info';
    const ms = level === 'error'
      ? configService.get('notifications.errorDuration', 8000)
      : configService.get('notifications.successDuration', 5000);
    enqueue(message, level, ms);
  }, [enqueue]);

  // Register message handlers with API service on mount
  useEffect(() => {
    apiService.setMessageHandlers(showSuccess, showError);
  }, [showSuccess, showError]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    showSuccess,
    showError,
    showNotification,
    removeNotification,
    notifications
  }), [showSuccess, showError, showNotification, removeNotification, notifications]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Toast surface — the phone app's idiom (flat coloured card, inline
          close, slide in) rather than MUI's default Snackbar+Alert, so both
          products look like one product.
          Offset below the topbar: anchored flush to the top it sat over the
          screen's toolbar buttons and hid the controls underneath it.
          The container ignores pointer events so the page stays clickable
          between cards; only the cards themselves are interactive.
          Identical messages are deduplicated and the stack is capped at three. */}
      {notifications.length > 0 && (
        <Box
          data-testid="toaster"
          sx={{
            // On a phone the card is nearly the full width, so a fixed right
            // inset pushed it off-centre and clipped the close button; pin
            // both edges there and let the card fill the gap.
            position: 'fixed', top: { xs: 60, sm: 72 }, left: '50%',
            transform: 'translateX(-50%)', right: 'auto',
            width: { xs: 'calc(100% - 16px)', sm: 320 }, zIndex: 1400,
            display: 'flex', flexDirection: 'column', gap: 1,
            pointerEvents: 'none',
          }}
        >
          {notifications.map((notif) => (
            <Slide key={notif.id} direction="left" in mountOnEnter unmountOnExit>
              <Box
                role={notif.type === 'error' ? 'alert' : 'status'}
                data-testid="notification-toast"
                data-level={notif.type}
                sx={{
                  width: '100%', maxWidth: '100%', position: 'relative',
                  bgcolor: LEVEL_BG[notif.type] || LEVEL_BG.info, color: '#fff',
                  borderRadius: '3px', p: 1.25,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.3)', pointerEvents: 'all',
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => removeNotification(notif.id)}
                  aria-label="Dismiss"
                  data-testid="notification-toast-close"
                  sx={{ position: 'absolute', top: 2, right: 2, color: '#fff', opacity: 0.85 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                <Typography sx={{ fontSize: '0.82rem', pr: '24px', wordBreak: 'break-word' }}>
                  {notif.message}
                </Typography>
              </Box>
            </Slide>
          ))}
        </Box>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
