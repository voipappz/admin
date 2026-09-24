import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveEnvironment } from './useLiveEnvironment';

let portalUser = null;
let env = {};
vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ user: portalUser }) }));
vi.mock('../../context/CustomerEnvironmentContext', () => ({ useCustomerEnvironment: () => env }));

const sales = { uuid: 'env-1', name: 'Sales' };
const support = { uuid: 'env-2', name: 'Support' };

beforeEach(() => {
  localStorage.clear();
  portalUser = null;
  env = {
    selectedCustomer: { uuid: 'cust-1' },
    selectedEnvironments: [support],
    fetchAllEnvironments: vi.fn(async () => [sales, support]),
  };
});

describe('the environment Live monitors', () => {
  it("is a portal user's own environment, with nothing to pick", () => {
    portalUser = { environment: { uuid: 'env-9', name: 'Mine' } };
    const { result } = renderHook(() => useLiveEnvironment());
    expect(result.current).toMatchObject({ uuid: 'env-9', name: 'Mine', pickable: false });
  });

  it("starts, for an account, on the first environment selected in the top bar", async () => {
    const { result } = renderHook(() => useLiveEnvironment());
    expect(result.current).toMatchObject({ uuid: 'env-2', name: 'Support', pickable: true });
    await waitFor(() => expect(result.current.options).toEqual([sales, support]));
    expect(env.fetchAllEnvironments).toHaveBeenCalledWith('cust-1');
  });

  it('follows what the account picks on the Live screen, and remembers it', async () => {
    const { result, unmount } = renderHook(() => useLiveEnvironment());
    await waitFor(() => expect(result.current.options).toHaveLength(2));
    act(() => result.current.pick('env-1'));
    expect(result.current).toMatchObject({ uuid: 'env-1', name: 'Sales' });
    unmount();

    const again = renderHook(() => useLiveEnvironment());
    await waitFor(() => expect(again.result.current.uuid).toBe('env-1'));
  });

  it('is empty when the account has nothing selected and nothing picked', () => {
    env.selectedEnvironments = [];
    env.fetchAllEnvironments = vi.fn(async () => []);
    const { result } = renderHook(() => useLiveEnvironment());
    expect(result.current.uuid).toBe('');
  });
});
