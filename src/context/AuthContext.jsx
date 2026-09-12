import { createContext, useContext, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { getStoredRefreshToken, refreshToken as refreshTokenService } from '../services/authService';
import { apiService } from '../services/apiService';
import { isTokenValid, getTokenExpiry, getAccountDataFromToken } from '../utils/jwt';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        csrf: action.payload.csrf,
        access: action.payload.access,
        refresh: action.payload.refresh,
        accessExpiresAt: action.payload.accessExpiresAt,
        refreshExpiresAt: action.payload.refreshExpiresAt,
        accountUuid: action.payload.accountUuid,
        customerUuid: action.payload.customerUuid,
        accountCustomer: action.payload.accountCustomer, // Customer from JWT token
        isRoot: action.payload.isRoot || false, // Root flag from meta
        acl: action.payload.acl || null, // ACL permissions for screen access
        error: null,
        loading: false,
        initializing: false // Auth restored successfully
      };
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'LOGIN_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false
      };
    case 'REFRESH_TOKEN_SUCCESS': {
      // Extract ACL from new JWT to keep permissions current after refresh
      const refreshedAcl = (() => {
        try {
          const data = getAccountDataFromToken(action.payload.access);
          return data?.acl || null;
        } catch { return null; }
      })();
      return {
        ...state,
        access: action.payload.access,
        refresh: action.payload.refresh,
        accessExpiresAt: action.payload.accessExpiresAt,
        refreshExpiresAt: action.payload.refreshExpiresAt,
        acl: refreshedAcl || state.acl, // Use new ACL if available, else keep existing
        error: null,
        loading: false
      };
    }
    case 'REFRESH_TOKEN_ERROR':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        csrf: null,
        access: null,
        refresh: null,
        accessExpiresAt: null,
        refreshExpiresAt: null,
        accountUuid: null,
        customerUuid: null,
        accountCustomer: null,
        isRoot: false,
        acl: null,
        error: action.payload,
        loading: false
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        csrf: null,
        access: null,
        refresh: null,
        accessExpiresAt: null,
        refreshExpiresAt: null,
        accountUuid: null,
        customerUuid: null,
        accountCustomer: null,
        isRoot: false,
        acl: null,
        error: null,
        loading: false,
        initializing: false // Auth check completed
      };
    case 'INIT_COMPLETE':
      return {
        ...state,
        initializing: false
      };
    default:
      return state;
  }
};

const initialState = {
  isAuthenticated: false,
  user: null,
  csrf: null,
  access: null,
  refresh: null,
  accessExpiresAt: null,
  refreshExpiresAt: null,
  accountUuid: null,
  customerUuid: null,
  accountCustomer: null, // Customer object from JWT token
  isRoot: false, // Whether user is root (can select multiple customers)
  acl: null, // ACL permissions for screen access control
  loading: false,
  error: null,
  initializing: true // True until auth is restored from storage (prevents premature API calls)
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const refreshTimeoutRef = useRef(null);

  // Load auth data from localStorage on mount
  useEffect(() => {
    const loadStoredAuth = async () => {
      let authData = null;

      // First check for the structured auth object
      const storedAuth = localStorage.getItem('auth');
      if (storedAuth) {
        try {
          authData = JSON.parse(storedAuth);
        } catch (error) {
          console.error('Failed to parse stored auth data:', error);
          localStorage.removeItem('auth');
        }
      }

      // If no structured auth, check for individual token keys (from tests/external auth)
      if (!authData) {
        const accessToken = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');
        const csrfToken = localStorage.getItem('csrf_token');
        const accessExpiresAt = localStorage.getItem('access_expires_at');
        const refreshExpiresAt = localStorage.getItem('refresh_expires_at');
        const userAuthenticated = localStorage.getItem('user_authenticated');

        if (accessToken && userAuthenticated === 'true') {
          authData = {
            access: accessToken,
            refresh: refreshToken,
            csrf: csrfToken,
            accessExpiresAt: accessExpiresAt,
            refreshExpiresAt: refreshExpiresAt,
            user: { authenticated: true }, // Minimal user object
            accountUuid: null,
            customerUuid: null
          };
        }
      }

      if (authData && authData.access) {
        try {
          // Use JWT exp claim for accurate token validation (60 second buffer)
          const tokenValid = isTokenValid(authData.access, 60000);

          const jwtExpiry = getTokenExpiry(authData.access);

          // Accept the token if JWT exp claim shows it's valid
          if (tokenValid) {

            // Update accessExpiresAt from JWT if not set
            if (!authData.accessExpiresAt && jwtExpiry) {
              authData.accessExpiresAt = jwtExpiry.toISOString();
            }

            // Ensure ACL is present — extract from JWT if missing from stored data
            // (handles raw API responses stored in localStorage, or legacy auth format)
            if (!authData.acl) {
              const accountData = getAccountDataFromToken(authData.access);
              if (accountData) {
                authData.acl = accountData.acl || null;
                authData.accountCustomer = authData.accountCustomer || accountData.customer || null;
                authData.isRoot = authData.isRoot || accountData.isRoot || false;
                authData.accountUuid = authData.accountUuid || accountData.accountUuid || null;
                authData.customerUuid = authData.customerUuid || accountData.customer?.uuid || null;
              }
            }

            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: authData
            });
          } else if (authData.refresh) {
            // Try to refresh the token if access token is expired but refresh token exists
            // Access token expired, attempt refresh
            const refreshedTokens = await refreshTokenService(authData.refresh).catch((error) => {
              console.error('[AuthContext] Token refresh failed:', error);
              return null;
            });

            if (refreshedTokens && refreshedTokens.access) {
              // Token refresh successful
              const combinedData = { ...authData, ...refreshedTokens };
              // Extract ACL from new JWT if missing
              if (!combinedData.acl) {
                const accountData = getAccountDataFromToken(combinedData.access);
                if (accountData) {
                  combinedData.acl = accountData.acl || null;
                  combinedData.accountCustomer = combinedData.accountCustomer || accountData.customer || null;
                  combinedData.isRoot = combinedData.isRoot || accountData.isRoot || false;
                  combinedData.accountUuid = combinedData.accountUuid || accountData.accountUuid || null;
                  combinedData.customerUuid = combinedData.customerUuid || accountData.customer?.uuid || null;
                }
              }
              dispatch({
                type: 'LOGIN_SUCCESS',
                payload: combinedData
              });
            } else {
              console.warn('[AuthContext] Token refresh failed, clearing auth data');
              // Clear all token storage
              localStorage.removeItem('auth');
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('csrf_token');
              localStorage.removeItem('user_authenticated');
              // Mark initialization as complete (user not authenticated)
              dispatch({ type: 'INIT_COMPLETE' });
            }
          } else {
            console.warn('[AuthContext] No valid tokens found, clearing auth data');
            // Clear all token storage
            localStorage.removeItem('auth');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('csrf_token');
            localStorage.removeItem('user_authenticated');
            // Mark initialization as complete (user not authenticated)
            dispatch({ type: 'INIT_COMPLETE' });
          }
        } catch (error) {
          console.error('[AuthContext] Error loading stored auth:', error);
          // Clear all token storage
          localStorage.removeItem('auth');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('csrf_token');
          localStorage.removeItem('user_authenticated');
          // Mark initialization as complete (user not authenticated)
          dispatch({ type: 'INIT_COMPLETE' });
        }
      } else {
        console.log('[AuthContext] No stored auth data found');
        // Mark initialization as complete (user not authenticated)
        dispatch({ type: 'INIT_COMPLETE' });
      }
    };

    loadStoredAuth();
  }, []);

  // Save auth data to localStorage whenever state changes
  // IMPORTANT: Don't clear localStorage during initialization - we're still restoring auth!
  useEffect(() => {
    // Skip during initialization to avoid clearing auth before loadStoredAuth runs
    if (state.initializing) {
      return;
    }

    if (state.isAuthenticated) {
      localStorage.setItem('auth', JSON.stringify({
        user: state.user,
        csrf: state.csrf,
        access: state.access,
        refresh: state.refresh,
        accessExpiresAt: state.accessExpiresAt,
        refreshExpiresAt: state.refreshExpiresAt,
        accountUuid: state.accountUuid,
        customerUuid: state.customerUuid,
        accountCustomer: state.accountCustomer,
        isRoot: state.isRoot,
        acl: state.acl
      }));
    } else {
      localStorage.removeItem('auth');
    }
  }, [state.initializing, state.isAuthenticated, state.user, state.csrf, state.access, state.refresh, state.accessExpiresAt, state.refreshExpiresAt, state.accountUuid, state.customerUuid, state.accountCustomer, state.isRoot, state.acl]);

  const login = useCallback((authData) => {
    dispatch({
      type: 'LOGIN_SUCCESS',
      payload: authData
    });
  }, []);

  const logout = useCallback(() => {
    // Invalidate server-side session (fire-and-forget)
    try {
      const authData = JSON.parse(localStorage.getItem('auth') || '{}');
      const token = authData.access || localStorage.getItem('access_token');
      if (token) {
        // Send the token as a form body — the API reads params['token'].
        // (fetch silently ignores an options.params key, which left the
        // server-side session flush never running on logout.)
        apiService.post('/auth/logout', new URLSearchParams({ token }))
          .catch(() => {}); // Don't block logout on API failure
      }
    } catch (_) { /* ignore */ }

    // Clear all possible token storage formats
    localStorage.removeItem('auth');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('csrf_token');
    localStorage.removeItem('access_expires_at');
    localStorage.removeItem('refresh_expires_at');
    localStorage.removeItem('user_authenticated');
    dispatch({ type: 'LOGOUT' });
  }, []);

  // The API service owns 401 recovery: refresh once, replay, and log out only
  // when recovery fails. A global fetch interceptor cannot distinguish an
  // expired session from a single request that simply omitted its auth header.
  useEffect(() => {
    apiService.setLogoutHandler(logout);
  }, [logout]);

  // Update apiService when initialization state changes
  useEffect(() => {
    apiService.setAuthInitializing(state.initializing);
  }, [state.initializing]);

  const setLoading = useCallback(() => {
    dispatch({ type: 'LOGIN_START' });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'LOGIN_ERROR', payload: error });
  }, []);

  const attemptTokenRefresh = useCallback(async () => {
    // localStorage is written synchronously at login/refresh; React state may
    // still be one render behind when the first protected request returns 401.
    const refreshTokenValue = getStoredRefreshToken() || state.refresh;
    if (!refreshTokenValue) {
      dispatch({ type: 'LOGOUT' });
      return false;
    }

    try {
      const refreshedTokens = await refreshTokenService(refreshTokenValue);
      dispatch({
        type: 'REFRESH_TOKEN_SUCCESS',
        payload: refreshedTokens
      });

      // Persist the new tokens SYNCHRONOUSLY. dispatch only schedules a render,
      // and the effect that mirrors state into localStorage runs after it --
      // but apiService.getToken() reads localStorage, so a request replayed the
      // moment this resolves would pick up the OLD access token and 401 again.
      // The effect writes the same object a tick later; this is idempotent.
      try {
        const stored = JSON.parse(localStorage.getItem('auth') || '{}');
        localStorage.setItem('auth', JSON.stringify({
          ...stored,
          access: refreshedTokens.access,
          refresh: refreshedTokens.refresh,
          accessExpiresAt: refreshedTokens.accessExpiresAt,
          refreshExpiresAt: refreshedTokens.refreshExpiresAt
        }));
      } catch {
        // A corrupt 'auth' blob must not turn a successful refresh into a logout.
      }

      return true;
    } catch (error) {
      // REFRESH_TOKEN_ERROR clears isAuthenticated, and the effect above then
      // deletes the whole 'auth' blob -- refresh token included. That is only
      // correct when the server actually rejected the token (401/403). A 5xx,
      // an API restart, or an offline blip would otherwise destroy a session
      // that had days left on it, which is what "the token disappeared" was.
      if (error.rejected) {
        dispatch({
          type: 'REFRESH_TOKEN_ERROR',
          payload: error.message
        });
      } else {
        console.warn('[AuthContext] Token refresh could not reach the server; keeping the session', error.message);
      }
      return false;
    }
  }, [state.refresh]);

  // Register the refresh handler with apiService. Declared here, below
  // attemptTokenRefresh: naming it in the earlier effect's dependency array
  // would reference the const before its initialiser runs (TDZ).
  useEffect(() => {
    apiService.setRefreshHandler(attemptTokenRefresh);
  }, [attemptTokenRefresh]);

  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    if (!state.accessExpiresAt || !state.isAuthenticated) {
      return;
    }

    const now = new Date().getTime();
    const expiry = new Date(state.accessExpiresAt).getTime();
    const refreshTime = expiry - 5 * 60 * 1000; // Refresh 5 minutes before expiry
    const timeUntilRefresh = Math.max(0, refreshTime - now);

    refreshTimeoutRef.current = setTimeout(async () => {
      await attemptTokenRefresh();
    }, timeUntilRefresh);
  }, [state.accessExpiresAt, state.isAuthenticated, attemptTokenRefresh]);

  // Schedule token refresh whenever auth state changes
  useEffect(() => {
    scheduleTokenRefresh();
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [state.accessExpiresAt, state.isAuthenticated, state.refresh, scheduleTokenRefresh]);

  const contextValue = useMemo(() => ({
    ...state,
    login,
    logout,
    setLoading,
    setError,
    attemptTokenRefresh
  }), [state, login, logout, setLoading, setError, attemptTokenRefresh]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
