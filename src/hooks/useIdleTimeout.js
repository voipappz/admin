import { useEffect, useRef, useState, useCallback } from 'react';

// Idle session timeout for the admin console.
// Default 30 minutes of no user activity → onTimeout() (logout); a warning state
// is exposed 1 minute beforehand so the UI can prompt the user. Configure with
// VITE_IDLE_TIMEOUT_MINUTES (0 disables).

const DEFAULT_MINUTES = 30;
export const WARNING_MS = 60 * 1000;          // warn 1 minute before logout
const CHECK_INTERVAL_MS = 15 * 1000;          // how often we evaluate idleness
const ACTIVITY_THROTTLE_MS = 5 * 1000;        // min gap between activity writes
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

// Pure: classify the current idle duration. Exported for unit tests.
export function idleState(idleMs, timeoutMs, warningMs = WARNING_MS) {
  if (timeoutMs <= 0) return 'disabled';
  if (idleMs >= timeoutMs) return 'timeout';
  if (idleMs >= timeoutMs - warningMs) return 'warning';
  return 'active';
}

export function getConfiguredTimeoutMs() {
  const raw = import.meta.env?.VITE_IDLE_TIMEOUT_MINUTES;
  const minutes = raw === undefined || raw === '' ? DEFAULT_MINUTES : Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0; // 0/invalid → disabled
  return minutes * 60 * 1000;
}

export default function useIdleTimeout({ enabled, onTimeout }) {
  const timeoutMs = getConfiguredTimeoutMs();
  const [warningOpen, setWarningOpen] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lastWriteRef = useRef(0);
  const firedRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
    lastWriteRef.current = now;
    lastActivityRef.current = now;
    setWarningOpen(false);
  }, []);

  // "Stay signed in" button — bypasses the throttle.
  const staySignedIn = useCallback(() => {
    lastWriteRef.current = 0;
    recordActivity();
  }, [recordActivity]);

  useEffect(() => {
    if (!enabled || timeoutMs <= 0) return undefined;

    firedRef.current = false;
    lastActivityRef.current = Date.now();
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, recordActivity, { passive: true }));

    const interval = setInterval(() => {
      const state = idleState(Date.now() - lastActivityRef.current, timeoutMs);
      if (state === 'timeout' && !firedRef.current) {
        firedRef.current = true;
        setWarningOpen(false);
        onTimeoutRef.current?.();
      } else if (state === 'warning') {
        setWarningOpen(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, recordActivity));
      clearInterval(interval);
      setWarningOpen(false);
    };
  }, [enabled, timeoutMs, recordActivity]);

  return { warningOpen, staySignedIn };
}
