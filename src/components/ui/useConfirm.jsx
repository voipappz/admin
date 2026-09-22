import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

/**
 * useConfirm — a promise-returning replacement for window.confirm.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete template', entityName: t.name })) remove(t);
 *
 * Resolves true on confirm, false on cancel/Esc/backdrop. One dialog is
 * mounted by <ConfirmProvider> (App.jsx), so a screen needs no state of its
 * own. Screens that must show a spinner while the action runs keep using
 * <ConfirmDialog> directly with `loading`.
 */
const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    resolver.current = resolve;
    setOptions(opts);
  }), []);

  const settle = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        {...(options || {})}
        open={Boolean(options)}
        onClose={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm needs <ConfirmProvider> above it (App.jsx)');
  return confirm;
};

export default useConfirm;
