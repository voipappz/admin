import { useCallback } from 'react';
import { usePortalSidebar } from '../context/PortalSidebarContext';

// Only what a dialpad accepts: "+972 (3) 555-1234" -> "+97235551234".
const dialable = (number) => String(number ?? '').replace(/[^\d+*#]/g, '');

/**
 * Clicking a number anywhere opens the phone in the right-hand sidebar with
 * that number in the dialpad. It does not dial: a click in a table is not a
 * decision to call someone, and the green button is one press away.
 */
export function useCallNumber() {
  const { open } = usePortalSidebar();
  return useCallback((number) => {
    const n = dialable(number);
    if (n) open('phone', { tab: 'dialpad', number: n });
  }, [open]);
}

/**
 * Open the phone signed in as a device (a row of the Devices screen, a user's
 * extension). What the account console's "Open WebRTC" iframe used to do.
 */
export function useOpenPhoneAs() {
  const { open } = usePortalSidebar();
  return useCallback((device) => {
    if (device) open('phone', { tab: 'dialpad', device });
  }, [open]);
}
