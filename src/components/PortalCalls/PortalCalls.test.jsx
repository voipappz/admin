import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortalCalls from './PortalCalls';

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

  it('offers the next page only when the current one is full', async () => {
    mockGetCalls.mockResolvedValueOnce(Array.from({ length: 25 }, (_, i) => row(i)));
    mockGetCalls.mockResolvedValueOnce([row(99)]);

    render(<PortalCalls />);

    const next = await screen.findByTestId('portal-calls-next');
    expect(next).not.toBeDisabled();
    fireEvent.click(next);

    expect(await screen.findByText('0500000099')).toBeInTheDocument();
    expect(mockGetCalls.mock.calls[1][0].page).toBe(2);
    await waitFor(() => expect(screen.getByTestId('portal-calls-next')).toBeDisabled());
  });

  it('drops the date filter for "All time"', async () => {
    mockGetCalls.mockResolvedValue([]);

    render(<PortalCalls />);
    await screen.findByText('No calls in this period.');

    fireEvent.mouseDown(screen.getByTestId('portal-calls-range').querySelector('[role="combobox"]'));
    fireEvent.click(await screen.findByRole('option', { name: 'All time' }));

    await waitFor(() => expect(mockGetCalls).toHaveBeenCalledTimes(2));
    expect(mockGetCalls.mock.calls[1][0]).not.toHaveProperty('search[created_at]');
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

  it('opens the shared call detail panel when a row is clicked', async () => {
    mockGetCalls.mockResolvedValue([row(4)]);

    render(<PortalCalls />);

    fireEvent.click(await screen.findByText('0500000004'));
    expect(await screen.findByText('Transcription')).toBeInTheDocument();
  });

  it('calls an inbound caller back from the row', async () => {
    mockConnected = true;
    mockGetCalls.mockResolvedValue([row(5)]);

    render(<PortalCalls />);

    fireEvent.click(await screen.findByTestId('portal-calls-dial'));
    expect(mockDial).toHaveBeenCalledWith('0500000005');
  });
});
