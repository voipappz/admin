import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LiveDashboard from './LiveDashboard';

/**
 * Renders the screen for real, with the two contexts and the API mocked.
 *
 * The point is not the assertions so much as the render itself: this screen
 * pulls in two contexts, and a component that throws at import or on first
 * paint shows up in a browser as a blank page with the error only in the
 * console. A test that mounts it catches that in CI instead.
 *
 * It also pins the behaviour that matters most on this deployment — an
 * unreachable call source must NOT be reported as "no calls in progress". An
 * empty table and an unknown one look identical and mean opposite things.
 */

const mockAgents = vi.fn();
const mockCalls = vi.fn();

vi.mock('../../services/api/liveDashboardApi', async () => {
  const actual = await vi.importActual('../../services/api/liveDashboardApi');
  return {
    ...actual,
    fetchAgents: (...a) => mockAgents(...a),
    fetchLiveCalls: (...a) => mockCalls(...a),
  };
});

// A portal session: one environment, straight off the user object.
vi.mock('../../context/UserAuthContext', () => ({
  useUserAuth: () => ({
    user: {
      uuid: 'user-1',
      environment: { uuid: 'env-906', name: '4186 - MATEMATICA' },
    },
  }),
}));

vi.mock('../../context/CustomerEnvironmentContext', () => ({
  useCustomerEnvironment: () => ({ selectedEnvironments: [] }),
}));

const agent = (over = {}) => ({
  uuid: 'a1',
  user_name: '20 Noam',
  extension_username: '211',
  status: 'available',
  state: '',
  status_updated_at: '',
  call_outgoing_count: null,
  call_incoming_count: null,
  first_call_at: '',
  call_answer_at: '',
  talking_to_number: '',
  ...over,
});

describe('LiveDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAgents.mockReset();
    mockCalls.mockReset();
  });

  it('renders the environment from the session, not from a picker', async () => {
    mockAgents.mockResolvedValue([agent()]);
    mockCalls.mockResolvedValue([]);

    render(<LiveDashboard />);

    expect(await screen.findByText('4186 - MATEMATICA')).toBeInTheDocument();
    // `/api/environments` answers 401 for a user token, so the screen must
    // never depend on having fetched a list.
    expect(screen.queryByLabelText('Environment')).not.toBeInTheDocument();
  });

  it('scopes both fetches to the session environment', async () => {
    mockAgents.mockResolvedValue([]);
    mockCalls.mockResolvedValue([]);

    render(<LiveDashboard />);

    await waitFor(() => expect(mockAgents).toHaveBeenCalledWith('env-906'));
    expect(mockCalls).toHaveBeenCalledWith('env-906');
  });

  it('shows agent rows', async () => {
    mockAgents.mockResolvedValue([agent(), agent({ uuid: 'a2', user_name: 'Dana', extension_username: '212' })]);
    mockCalls.mockResolvedValue([]);

    render(<LiveDashboard />);

    expect(await screen.findByText('20 Noam')).toBeInTheDocument();
    expect(screen.getByText('Dana')).toBeInTheDocument();
    expect(screen.getByText('211')).toBeInTheDocument();
  });

  it('counts the pills from the rows rather than a second source', async () => {
    mockAgents.mockResolvedValue([
      agent(), agent({ uuid: 'a2' }), agent({ uuid: 'a3', status: 'on_break' }),
    ]);
    mockCalls.mockResolvedValue([]);

    render(<LiveDashboard />);

    expect(await screen.findByText('2 Available')).toBeInTheDocument();
    expect(screen.getByText('1 On Break')).toBeInTheDocument();
  });

  it('says "no calls in progress" only when it actually knows', async () => {
    mockAgents.mockResolvedValue([agent()]);
    mockCalls.mockResolvedValue([]);

    render(<LiveDashboard />);

    expect(await screen.findByText('No calls in progress')).toBeInTheDocument();
  });

  it('admits it cannot tell when the call source is unreachable', async () => {
    // Every call source refuses a portal token on this deployment: /api/calls
    // and ?action=live answer 500, the Influx path 404s. Reporting "no calls"
    // there would be a claim the screen cannot make.
    mockAgents.mockResolvedValue([agent()]);
    mockCalls.mockRejectedValue(new Error('500'));

    render(<LiveDashboard />);

    expect(await screen.findByText(/Live calls unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText('No calls in progress')).not.toBeInTheDocument();
  });

  it('keeps the agents table when only the call fetch fails', async () => {
    mockAgents.mockResolvedValue([agent()]);
    mockCalls.mockRejectedValue(new Error('500'));

    render(<LiveDashboard />);

    // Promise.allSettled, so one failure must not blank the other table.
    expect(await screen.findByText('20 Noam')).toBeInTheDocument();
  });

  it('renders live calls when they are available', async () => {
    mockAgents.mockResolvedValue([]);
    mockCalls.mockResolvedValue([{
      uuid: 'c1',
      created_at: new Date().toISOString(),
      direction: 'incoming',
      state: 'answer',
      caller: '00526014798',
      destination: '306',
      leg: 'did → que',
    }]);

    render(<LiveDashboard />);

    expect(await screen.findByText('00526014798')).toBeInTheDocument();
    expect(screen.getByText('306')).toBeInTheDocument();
  });
});

describe('LiveDashboard — health strip', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAgents.mockReset();
    mockCalls.mockReset();
  });

  it('reports data freshness once something has actually arrived', async () => {
    mockAgents.mockResolvedValue([agent()]);
    mockCalls.mockResolvedValue([]);

    render(<LiveDashboard />);

    expect(await screen.findByText(/Data fresh/i)).toBeInTheDocument();
  });

  it('says data was never received when the source never answered', async () => {
    // The failure this strip exists for: the screen keeps painting, and
    // without it nothing on screen admits the numbers are not current.
    mockAgents.mockRejectedValue(new Error('unreachable'));
    mockCalls.mockRejectedValue(new Error('unreachable'));

    render(<LiveDashboard />);

    expect(await screen.findByText(/Data never received/i)).toBeInTheDocument();
  });

  it('names the source it is actually using', async () => {
    mockAgents.mockResolvedValue([]);
    mockCalls.mockResolvedValue([]);

    render(<LiveDashboard />);

    // No cable in a test environment, so it must say polling rather than
    // implying a realtime feed it does not have.
    expect(await screen.findByText(/Source: polling/i)).toBeInTheDocument();
  });
});
