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

const scope = vi.fn();
vi.mock('../../context/CustomerEnvironmentContext.jsx', () => ({ useCustomerEnvironment: () => scope() }));

import AdminDashboard from './AdminDashboard.jsx';

describe('AdminDashboard', () => {
  it('follows the selected customer and environment', async () => {
    scope.mockReturnValue({
      selectedCustomer: { name: 'acme' },
      selectedEnvironments: [{ uuid: 'env-1', name: 'main' }, { uuid: 'env-2', name: 'other' }],
    });
    render(<AdminDashboard />);
    expect(screen.getByTestId('admin-dashboard-page')).toHaveTextContent('Live activity for acme · main');
    expect(await screen.findByText('Live updates connected')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('asks for an application when none is selected', () => {
    scope.mockReturnValue({ selectedCustomer: null, selectedEnvironments: [] });
    render(<AdminDashboard />);
    expect(screen.getByText('Select an application to see live activity')).toBeInTheDocument();
    expect(screen.getByText('Reconnecting to live updates')).toBeInTheDocument();
  });
});
