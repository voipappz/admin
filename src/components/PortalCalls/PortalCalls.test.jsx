import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as renderReact, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import PortalCalls from './PortalCalls';
import { PORTAL_DEFAULTS } from '../../context/PortalPreferencesContext';

const mockSavePreferences = vi.fn();
vi.mock('../../context/PortalPreferencesContext', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, usePortalPreferences: () => ({ preferences: actual.PORTAL_DEFAULTS, ready: true, save: mockSavePreferences }) };
});
vi.mock('../../views/syslogs/TimeHistogram', () => ({ default: () => <div data-testid="calls-chart" /> }));
const render = (element, url = '/my-calls') => renderReact(<MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>);

/**
 * My Calls reads /api/calls — the same endpoint the admin Calls screen pages
 * through — rather than the InfluxDB `cdr` rows it used to. Pinned here: the
 * request shape (page, per_page, the admin's created_at range format) and that
 * a full page offers a next one.
 */

const mockGetCalls = vi.fn();
const mockGetAggregate = vi.fn();
const mockGetSegments = vi.fn();

vi.mock('../../services/api/callsApi', () => ({
  callsApi: {
    getCalls: (...a) => mockGetCalls(...a),
    getAggregate: (...a) => mockGetAggregate(...a),
    getSegments: (...a) => mockGetSegments(...a),
  },
}));

const mockDial = vi.fn(() => Promise.resolve());
let mockConnected = false;

vi.mock('../../context/SoftphoneContext', () => ({
  useSoftphone: () => ({ dial: mockDial, connected: mockConnected }),
}));

// The detail panel loads a transcript; keep it off the network.
vi.mock('../../services/conversationService', () => ({
  default: { getConversationByCallId: vi.fn(() => Promise.resolve(null)), getMessages: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ access: null }),
}));

const mockOpenSidebar = vi.fn();
vi.mock('../../context/PortalSidebarContext', () => ({
  usePortalSidebar: () => ({ view: 'call', params: null, open: mockOpenSidebar, toggle: vi.fn(), close: vi.fn() }),
}));

// The API's :portal_list shape (voipappz-api lib/serializers/call.rb): the
// call's facts live under `profile`, not at the top level. Reading them from
// the top level is what rendered every row as "–" / 00:00.
const row = (i) => ({
  uuid: `call-${i}`,
  created_at: '2026-09-15T10:00:00Z',
  recording: { url: null },
  meta: {},
  tags: [],
  profile: {
    direction: 'in',
    caller: `05000000${String(i).padStart(2, '0')}`,
    callee: '201',
    cause: 'answer',
    talk_duration: 42,
  },
});

describe('PortalCalls', () => {
  beforeEach(() => {
    mockGetCalls.mockReset();
    mockGetAggregate.mockReset();
    mockGetSegments.mockReset();
    mockGetAggregate.mockResolvedValue([]);
    mockGetSegments.mockResolvedValue([]);
    mockDial.mockClear();
    mockConnected = false;
    mockSavePreferences.mockClear();
  });

  it('fetches from /api/calls with page, per_page and a created_at range', async () => {
    mockGetCalls.mockResolvedValue([row(1)]);

    render(<PortalCalls />);

    expect(await screen.findByText('0500000001')).toBeInTheDocument();
    const params = mockGetCalls.mock.calls[0][0];
    expect(params.page).toBe(1);
    expect(params.per_page).toBe(25);
    expect(params['search[created_at]']).toMatch(/^\d+ - \d+$/);
  });

  it('accepts a { data } envelope as well as a bare array', async () => {
    mockGetCalls.mockResolvedValue({ data: [row(2)] });

    render(<PortalCalls />);

    expect(await screen.findByText('0500000002')).toBeInTheDocument();
  });

  it('uses the full filtered count to offer the next page', async () => {
    mockGetAggregate.mockResolvedValue([{ time: '2026-09-18T10:00:00', answer: 26 }]);
    mockGetCalls.mockResolvedValueOnce(Array.from({ length: 25 }, (_, i) => row(i)));
    mockGetCalls.mockResolvedValueOnce([row(99)]);

    render(<PortalCalls />);

    const next = await screen.findByTestId('portal-calls-next');
    await waitFor(() => expect(next).not.toBeDisabled());
    fireEvent.click(next);

    expect(await screen.findByText('0500000099')).toBeInTheDocument();
    expect(mockGetCalls.mock.calls[1][0].page).toBe(2);
    await waitFor(() => expect(screen.getByTestId('portal-calls-next')).toBeDisabled());
  });

  it('sends the picked date range in the admin created_at format, and keeps it in the URL', async () => {
    mockGetCalls.mockResolvedValue([]);

    render(<PortalCalls />, '/my-calls?from=2026-09-01&to=2026-09-03');
    await screen.findByText('No calls in this period.');

    const from = Math.floor(new Date('2026-09-01T00:00:00').getTime() / 1000);
    const to = Math.floor(new Date('2026-09-03T23:59:59.999').getTime() / 1000);
    expect(mockGetCalls.mock.calls[0][0]['search[created_at]']).toBe(`${from} - ${to}`);
    // The admin picker, not a preset dropdown: the trigger shows the range.
    expect(screen.getByTestId('portal-calls-range')).toHaveTextContent(/Sep 1/);
  });

  it('defaults to the preferred window when the URL carries no range', async () => {
    mockGetCalls.mockResolvedValue([]);

    render(<PortalCalls />);
    await screen.findByText('No calls in this period.');

    const [start, end] = mockGetCalls.mock.calls[0][0]['search[created_at]'].split(' - ').map(Number);
    // calls_days defaults to 7: six days back through the end of today.
    expect(Math.round((end - start) / 86400)).toBe(7);
    expect(screen.getByTestId('portal-calls-range')).toHaveTextContent('Last 7 days');
  });

  it('has no density control of its own — that moved to the account menu', async () => {
    mockGetCalls.mockResolvedValue([]);
    render(<PortalCalls />);
    await screen.findByText('No calls in this period.');
    expect(screen.queryByLabelText('Density')).toBeNull();
  });

  it('says it could not load, never that there were no calls', async () => {
    mockGetCalls.mockRejectedValue(new Error('HTTP 500'));

    render(<PortalCalls />);

    expect(await screen.findByText(/Could not load your calls/)).toBeInTheDocument();
    expect(screen.queryByText('No calls in this period.')).not.toBeInTheDocument();
  });

  it('reads caller, callee and cause from the nested profile', async () => {
    mockGetCalls.mockResolvedValue([row(3)]);

    render(<PortalCalls />);

    expect(await screen.findByText('0500000003')).toBeInTheDocument();
    expect(screen.getByText('201')).toBeInTheDocument();
    expect(screen.getByText('Answer')).toBeInTheDocument();
  });

  it('hands a clicked call to the portal sidebar, where the phone opens too', async () => {
    mockGetCalls.mockResolvedValue([row(4)]);

    render(<PortalCalls />);

    fireEvent.click(await screen.findByText('0500000004'));
    await waitFor(() => expect(mockOpenSidebar).toHaveBeenCalledWith('call', expect.objectContaining({ call: expect.objectContaining({ uuid: 'call-4' }) })));
    // The screen no longer draws a detail column of its own.
    expect(screen.queryByText('Transcription')).toBeNull();
  });

  it('calls an inbound caller back from the row', async () => {
    mockConnected = true;
    mockGetCalls.mockResolvedValue([row(5)]);

    render(<PortalCalls />);

    fireEvent.click(await screen.findByTestId('portal-calls-dial'));
    expect(mockDial).toHaveBeenCalledWith('0500000005');
  });

  it('sends the same wildcard search to the list and the chart', async () => {
    mockGetCalls.mockResolvedValue([row(1)]);
    render(<PortalCalls />, '/my-calls?q=050%2501&direction=incoming');
    await screen.findByText('0500000001');
    expect(mockGetCalls.mock.calls[0][0]).toEqual(expect.objectContaining({
      'search[inline]': '050%01', 'search[call.direction][IS]': 'incoming',
    }));
    expect(mockGetAggregate.mock.calls[0][0]).toEqual(expect.objectContaining({
      'search[inline]': '050%01', 'search[call.direction][IS]': 'incoming',
    }));
    expect(screen.queryByPlaceholderText('Search number or cause')).not.toBeInTheDocument();
  });

  it('saves chart visibility on the user', async () => {
    mockGetCalls.mockResolvedValue([]);
    render(<PortalCalls />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide chart' }));
    expect(mockSavePreferences).toHaveBeenCalledWith({ calls_chart: 'false' });
    expect(PORTAL_DEFAULTS.calls_page_size).toBe('25');
  });
});
