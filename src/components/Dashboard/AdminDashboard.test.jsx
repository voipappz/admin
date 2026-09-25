import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../hooks/useLiveEntities', () => ({
  default: (environmentUuid) => ({
    connected: Boolean(environmentUuid), error: null, rows: [],
    byScope: () => (environmentUuid ? [{ live_calls_current: 3, call_incoming_count: 2, call_outgoing_count: 1 }] : []),
  }),
}));
vi.mock('../../services/api/callsApi', () => ({ callsApi: { getCalls: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }));
const auth = vi.fn(() => ({ isRoot: false }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth() }));
vi.mock('../../services/api/monitoringApi', () => ({
  monitoringApi: { getCallsVolumeChart: vi.fn().mockResolvedValue([]) },
}));
import { monitoringApi } from '../../services/api/monitoringApi';

const scope = vi.fn();
vi.mock('../../context/CustomerEnvironmentContext.jsx', () => ({ useCustomerEnvironment: () => scope() }));

import AdminDashboard from './AdminDashboard.jsx';

describe('AdminDashboard', () => {
  it('follows the selected customer and environment', async () => {
    scope.mockReturnValue({
      selectedCustomer: { uuid: 'c-1', name: 'acme' },
      selectedEnvironments: [{ uuid: 'env-1', name: 'main' }, { uuid: 'env-2', name: 'other' }],
    });
    render(<AdminDashboard />);
    expect(screen.getByTestId('admin-dashboard-page')).toHaveTextContent('Live activity for acme · all applications');
    expect(await screen.findByText('Live updates connected')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('charts every application in the selected customer, grouped by customer', async () => {
    scope.mockReturnValue({ selectedCustomer: { uuid: 'c-1', name: 'acme' }, selectedEnvironments: [{ uuid: 'env-1', name: 'main' }] });
    render(<AdminDashboard />);
    await vi.waitFor(() => expect(monitoringApi.getCallsVolumeChart)
      .toHaveBeenCalledWith(null, 1440, '1h', 'c-1', 'customer_uuid'));
  });

  // The bird's-eye view: a root admin with nothing selected sees every
  // customer, one series each, rather than an empty chart.
  it('charts every customer for a root admin with no selection', async () => {
    auth.mockReturnValue({ isRoot: true });
    scope.mockReturnValue({ selectedCustomer: null, selectedEnvironments: [] });
    render(<AdminDashboard />);
    await vi.waitFor(() => expect(monitoringApi.getCallsVolumeChart)
      .toHaveBeenCalledWith(null, 1440, '1h', null, 'customer_uuid'));
    expect(await screen.findByRole('heading', { name: /every customer/i })).toBeInTheDocument();
  });

  it('asks for an application when none is selected', () => {
    auth.mockReturnValue({ isRoot: false });
    scope.mockReturnValue({ selectedCustomer: null, selectedEnvironments: [] });
    render(<AdminDashboard />);
    expect(screen.getByText('Select an application to see live activity')).toBeInTheDocument();
    expect(screen.getByText('Reconnecting to live updates')).toBeInTheDocument();
  });
});
