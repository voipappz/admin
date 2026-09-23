import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Which corner panel is open: the phone, the assistant, or neither.
 *
 * It lives here rather than inside PortalCorner because two things open these
 * panels — the corner's own buttons, and the line's "Phone" / "Assistant"
 * rows. A row that merely scrolled you to a button would be a worse row.
 * One panel at a time: two 400px panels over the same corner would overlap.
 */
const Context = createContext({ panel: null, open: () => {}, toggle: () => {}, close: () => {} });

export function PortalPanelsProvider({ children }) {
  const [panel, setPanel] = useState(null);
  const open = useCallback((which) => setPanel(which), []);
  const toggle = useCallback((which) => setPanel((current) => (current === which ? null : which)), []);
  const close = useCallback(() => setPanel(null), []);
  const value = useMemo(() => ({ panel, open, toggle, close }), [panel, open, toggle, close]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const usePortalPanels = () => useContext(Context);
