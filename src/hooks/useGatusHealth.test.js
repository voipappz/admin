import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../services/apiService', () => ({
  apiService: {
    clearCache: vi.fn(),
    get: vi.fn(),
  },
}));

import { apiService } from '../services/apiService';
import { checkGatusHealth } from './useGatusHealth';

describe('checkGatusHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the authenticated API client for the protected Gatus route', async () => {
    apiService.get.mockResolvedValue([]);

    await checkGatusHealth();

    expect(apiService.clearCache).toHaveBeenCalledWith('/api/v1/endpoints/statuses');
    expect(apiService.get).toHaveBeenCalledWith(
      '/api/v1/endpoints/statuses',
      { headers: { Accept: 'application/json' } },
      'Gatus health',
      false,
      true,
    );
  });

  it('contains a health failure instead of rejecting into the admin shell', async () => {
    const unavailable = Object.assign(new Error('Service unavailable'), { status: 503 });
    apiService.get.mockRejectedValue(unavailable);

    await expect(checkGatusHealth()).resolves.toBeUndefined();
  });
});
