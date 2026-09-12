import { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import { apiService } from '../services/apiService';
import { isTokenValid, getTokenExpiry } from '../utils/jwt';

// Auth context for the end-user (customer-facing) portal — the `/` surface.
// This is deliberately separate from AuthContext (the account/admin surface
// mounted at `/admin`): the two JWTs carry unrelated shapes (a user token is
// just { user_uuid, exp } — no refresh, no accountUuid/isRoot/acl claims —
// with all profile/ACL/extension data living in the login response body
// instead of the token), so merging them would mean every admin screen's
// useAuth() call has to branch on which kind of session is active.
const UserAuthContext = createContext();

const STORAGE_KEY = 'user_auth';

const userAuthReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token,
        tokenExpiresAt: action.payload.tokenExpiresAt,
        acl: action.payload.user?.acl?.data || null,
        error: null,
        loading: false,
        initializing: false
      };
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_ERROR':
      return { ...state, loading: false, error: action.payload, isAuthenticated: false };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        tokenExpiresAt: null,
        acl: null,
        error: null,
        loading: false,
        initializing: false
      };
    case 'INIT_COMPLETE':
      return { ...state, initializing: false };
    default:
      return state;
  }
};

const initialState = {
  isAuthenticated: false,
  user: null,
  token: null,
  tokenExpiresAt: null,
  acl: null,
  loading: false,
  error: null,
  initializing: true // true until the stored session is checked, so guards don't flash /
};

export const UserAuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userAuthReducer, initialState);

  // Restore a stored session on mount. There is no refresh token for the user
  // surface (voipappz-api's /auth/refresh only understands account tokens), so
  // an expired token here just means "log in again" — no silent renewal to try.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        dispatch({ type: 'INIT_COMPLETE' });
        return;
      }
      const authData = JSON.parse(stored);
      if (authData?.token && isTokenValid(authData.token, 60000)) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: authData });
      } else {
        localStorage.removeItem(STORAGE_KEY);
        dispatch({ type: 'INIT_COMPLETE' });
      }
    } catch (error) {
      console.error('[UserAuthContext] Failed to restore stored session:', error);
      localStorage.removeItem(STORAGE_KEY);
      dispatch({ type: 'INIT_COMPLETE' });
    }
  }, []);

  // Mirror state into localStorage, same synchronous-write pattern AuthContext
  // uses — anything reading the token right after login must not see a stale
  // (or empty) value because the effect hadn't flushed yet.
  useEffect(() => {
    if (state.initializing) return;

    if (state.isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        user: state.user,
        token: state.token,
        tokenExpiresAt: state.tokenExpiresAt
      }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state.initializing, state.isAuthenticated, state.user, state.token, state.tokenExpiresAt]);

  const login = useCallback((authData) => {
    dispatch({ type: 'LOGIN_SUCCESS', payload: authData });
  }, []);

  const logout = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (stored.token) {
        // Fire-and-forget — mirrors AuthContext.logout(); don't block on it.
        apiService.post('/auth/logout', new URLSearchParams({ token: stored.token })).catch(() => {});
      }
    } catch { /* ignore */ }

    localStorage.removeItem(STORAGE_KEY);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const setLoading = useCallback(() => dispatch({ type: 'LOGIN_START' }), []);
  const setError = useCallback((error) => dispatch({ type: 'LOGIN_ERROR', payload: error }), []);

  // A user token expiring mid-session (no refresh path exists) should drop
  // back to the login screen rather than let every subsequent request 401.
  useEffect(() => {
    if (!state.isAuthenticated || !state.tokenExpiresAt) return;
    const expiry = new Date(state.tokenExpiresAt).getTime();
    const timeout = setTimeout(() => dispatch({ type: 'LOGOUT' }), Math.max(0, expiry - Date.now()));
    return () => clearTimeout(timeout);
  }, [state.isAuthenticated, state.tokenExpiresAt]);

  const contextValue = useMemo(() => ({
    ...state,
    login,
    logout,
    setLoading,
    setError,
    tokenExpiry: state.tokenExpiresAt ? getTokenExpiry(state.token) : null
  }), [state, login, logout, setLoading, setError]);

  return (
    <UserAuthContext.Provider value={contextValue}>
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return context;
};
