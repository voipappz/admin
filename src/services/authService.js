import { getTokenExpiry } from '../utils/jwt';

const getAuthUrl = (endpoint) => {
  return endpoint;
};

// React state updates after the render that schedules them, while login and
// refresh persist tokens synchronously. Read the persisted refresh token at the
// moment it is needed so a 401 in that small timing window can still recover.
export const getStoredRefreshToken = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('auth') || '{}');
    return stored.refresh || localStorage.getItem('refresh_token') || null;
  } catch {
    return localStorage.getItem('refresh_token') || null;
  }
};

export const refreshToken = async (refreshTokenValue) => {
  try {
    const response = await fetch(getAuthUrl('/auth/refresh'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Form-encoded per the API convention (Sinatra reads params natively).
      body: new URLSearchParams({ refresh_token: refreshTokenValue }).toString()
    });

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      // Only 401/403 mean "this refresh token is no longer valid". A 5xx, a
      // gateway error mid-deploy, or a dropped connection say nothing about the
      // token -- and must not cost the user a session that is still good for
      // seven days. See the catch in AuthContext.attemptTokenRefresh.
      error.status = response.status;
      error.rejected = response.status === 401 || response.status === 403;
      throw error;
    }

    const data = await response.json();
    const newAccess = data.access_token;
    const newRefresh = data.refresh_token || refreshTokenValue;

    // Prefer the tokens' real exp claims; fall back to expires_in / known server
    // TTLs (1h access, 7d refresh) only when a token carries no exp.
    const now = new Date();
    const accessExpiresAt = getTokenExpiry(newAccess)
      || new Date(now.getTime() + (data.expires_in ? data.expires_in * 1000 : 3600000));
    const refreshExpiresAt = getTokenExpiry(newRefresh)
      || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return {
      access: newAccess,
      refresh: newRefresh, // Use new refresh token if provided, otherwise keep current one
      accessExpiresAt: accessExpiresAt.toISOString(),
      refreshExpiresAt: refreshExpiresAt.toISOString()
    };
  } catch (error) {
    // A thrown TypeError here is fetch failing to reach the server at all.
    const wrapped = new Error(`Token refresh failed: ${error.message}`);
    wrapped.status = error.status || 0;
    wrapped.rejected = error.rejected === true;
    throw wrapped;
  }
};
