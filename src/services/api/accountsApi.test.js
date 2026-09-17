import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../apiService', () => ({
  apiService: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import { apiService } from '../apiService';
import { accountsApi } from './accountsApi';

/**
 * The create-account dialog's environment picker used to pull the whole tenant
 * (`per_page=9999`) just so it could filter client-side. It searches the
 * server instead now, so these pin the query it sends: a small page, the
 * name search the API actually supports, and the customer scope.
 */
describe('accountsApi.getEnvironments', () => {
  beforeEach(() => vi.clearAllMocks());

  const urlOf = () => apiService.get.mock.calls[0][0];

  it('asks for one small page, not the whole tenant', async () => {
    apiService.get.mockResolvedValue([]);

    await accountsApi.getEnvironments();

    expect(urlOf()).toContain('per_page=100');
    expect(urlOf()).not.toContain('9999');
  });

  it('searches by name on the server', async () => {
    apiService.get.mockResolvedValue([]);

    await accountsApi.getEnvironments({ search: 'acme corp' });

    expect(urlOf()).toContain(`search[name]=${encodeURIComponent('acme corp')}`);
  });

  it('scopes the search to a customer when one is given', async () => {
    apiService.get.mockResolvedValue([]);

    await accountsApi.getEnvironments({ customer_uuid: 'cust-1' });

    expect(urlOf()).toContain('customer_uuid=cust-1');
  });

  it('leaves the customer scope out when there is none', async () => {
    apiService.get.mockResolvedValue([]);

    await accountsApi.getEnvironments({ search: 'x' });

    expect(urlOf()).not.toContain('customer_uuid');
  });
});
