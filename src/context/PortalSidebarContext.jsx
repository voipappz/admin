import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * ONE sidebar, whatever is in it.
 *
 * The portal opens things on the left: the phone (with the assistant as one of
 * its tabs), and a call's details. They are the same drawer — a person learns
 * one place where things open, instead of a dock here, a panel there and a
 * detail column that fought the floating buttons for the same corner.
 *
 * `view` is 'phone' | 'call' | null, `params` whatever that view needs.
 */
const Context = createContext({ view: null, params: null, open: () => {}, toggle: () => {}, close: () => {} });

export function PortalSidebarProvider({ children }) {
  const [state, setState] = useState({ view: null, params: null });

  const open = useCallback((view, params = null) => setState({ view, params }), []);
  const close = useCallback(() => setState({ view: null, params: null }), []);
  // Same view again closes it; a different view replaces what is showing.
  const toggle = useCallback((view, params = null) => {
    setState((current) => (current.view === view && !params ? { view: null, params: null } : { view, params }));
  }, []);

  const value = useMemo(() => ({ ...state, open, toggle, close }), [state, open, toggle, close]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const usePortalSidebar = () => useContext(Context);
