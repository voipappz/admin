import { useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasPermission, canAccessScreen } from '../utils/jwt';

/**
 * Encapsulated permission API for components.
 *
 * Components should NEVER read the raw `acl` object or call `hasPermission`
 * directly — they ask this hook instead. All ACL-structure knowledge lives in
 * `utils/jwt.js`; this hook is a thin, logic-free binding of `acl` from auth
 * state to those pure functions.
 *
 * Usage:
 *   const { can } = usePermissions();
 *   {can('accounts', 'write') && <EditButton/>}
 *   if (!canAccess('dids')) return <Redirect/>;
 *
 * @returns {{ can: (screen: string, action?: string) => boolean,
 *            canAccess: (screen: string) => boolean }}
 */
export function usePermissions() {
  const { acl } = useAuth();

  const can = useCallback(
    (screen, action = 'read') => hasPermission(acl, screen, action),
    [acl]
  );

  const canAccess = useCallback(
    (screen) => canAccessScreen(acl, screen),
    [acl]
  );

  return useMemo(() => ({ can, canAccess }), [can, canAccess]);
}
