import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DIDForm from './DIDForm.jsx';

let userSession = false;
vi.mock('../../../hooks/useIsUserSession', () => ({ useIsUserSession: () => userSession }));
vi.mock('../../../context/CustomerEnvironmentContext', () => ({
  useCustomerEnvironment: () => ({ selectedEnvironments: [{ uuid: 'env-1', name: 'Sales' }] }),
}));
vi.mock('../../Bridges/NumberBridge/NumberSelector.jsx', () => ({ NumberSelector: () => null }));
vi.mock('./RoutingChain.jsx', () => ({ default: () => null }));
vi.mock('../../../services/api/routesApi', () => ({ didsApi: {} }));
vi.mock('../../../services/api/providersApi', () => ({ providersApi: { getProviders: vi.fn(async () => []) } }));

const did = { uuid: 'd-1', name: 'Main', number: '0501234567', type: 'sip', bridge_type: 'number', environment_uuid: 'env-1', environment: { uuid: 'env-1', name: 'Sales' } };
const props = { did, environments: [{ uuid: 'env-1', name: 'Sales' }], bridgeTypes: ['number'], bridgeResources: {}, didTypes: [], onFetchBridgeResources: vi.fn(async () => {}) };

// A portal user sees only their own environment: the environment
// ("Application") is not a field for them. An account picks it.
describe('the number form', () => {
  it('asks an account which application the number belongs to', () => {
    userSession = false;
    render(<DIDForm {...props} />);
    expect(screen.getAllByText('Application').length).toBeGreaterThan(0);
  });

  it('does not show a portal user the application at all', () => {
    userSession = true;
    render(<DIDForm {...props} />);
    expect(screen.queryByText('Application')).toBeNull();
    expect(screen.queryByText('The application this Route belongs to')).toBeNull();
  });
});
