import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

/**
 * The dashboard serves both surfaces: the portal at `/` and the account
 * console at `/admin/dashboard`. What differs is where the scope comes from —
 * a portal user carries one environment on the session, an admin has none on
 * theirs and uses the console's customer/environment selection. Getting that
 * wrong shows the right-looking screen with another tenant's numbers.
 */

const mockSnapshotScope = vi.fn();
let mockAdmin;
let mockUser;
let mockSelection;

vi.mock('./useDashboardSnapshot.js', () => ({
  useDashboardSnapshot: (scope) => {
    mockSnapshotScope(scope);
    return {
      snapshot: { stats: { total: 0, inbound: 0, outbound: 0 }, calls_per_hour: [], recent_calls: [] },
      status: 'live',
    };
  },
}));

vi.mock('../../services/api/dashboardWidgetsApi.js', () => ({
  getWidgets: () => Promise.resolve([]),
  createWidget: vi.fn(),
  updateWidget: vi.fn(),
  deleteWidget: vi.fn(),
  setDashboardStorageScope: vi.fn(),
}));

vi.mock('../DashboardBuilder/useWidgetValue.js', () => ({
  useWidgetValue: () => ({ value: 0, series: [], error: null, loading: false }),
}));

vi.mock('../common/CallsPerHourChart.jsx', () => ({ default: () => null }));

vi.mock('../../context/AuthContext', () => ({ useAuth: () => mockAdmin }));
vi.mock('../../context/UserAuthContext.jsx', () => ({ useUserAuth: () => mockUser }));
vi.mock('../../context/CustomerEnvironmentContext', () => ({
  useCustomerEnvironment: () => mockSelection,
}));

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSnapshotScope.mockReset();
    mockAdmin = { isAuthenticated: false, acl: null };
    mockUser = { isAuthenticated: false, acl: null, user: null };
    mockSelection = { selectedCustomer: null, selectedEnvironments: [] };
  });

  it('scopes a portal session to the environment on the session', () => {
    mockUser = { isAuthenticated: true, acl: null, user: { environment: { uuid: 'env-portal' } } };
    mockSelection = { selectedCustomer: { uuid: 'cust-console' }, selectedEnvironments: [{ uuid: 'env-console' }] };

    render(<Dashboard />);

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(mockSnapshotScope).toHaveBeenLastCalledWith(
      expect.objectContaining({ environmentUuid: 'env-portal', customerUuid: null })
    );
  });

  it('scopes an admin session to the console selection', () => {
    mockAdmin = { isAuthenticated: true, acl: null };
    mockSelection = { selectedCustomer: { uuid: 'cust-console' }, selectedEnvironments: [{ uuid: 'env-console' }] };

    render(<Dashboard />);

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(mockSnapshotScope).toHaveBeenLastCalledWith(
      expect.objectContaining({ environmentUuid: 'env-console', customerUuid: 'cust-console' })
    );
  });

  it('falls back to the customer when an admin has no environment selected', () => {
    mockAdmin = { isAuthenticated: true, acl: null };
    mockSelection = { selectedCustomer: { uuid: 'cust-console' }, selectedEnvironments: [] };

    render(<Dashboard />);

    expect(mockSnapshotScope).toHaveBeenLastCalledWith(
      expect.objectContaining({ environmentUuid: null, customerUuid: 'cust-console' })
    );
  });
});
