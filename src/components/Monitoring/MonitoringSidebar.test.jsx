import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// /api/notifications as the API answers it: unread alerts, newest first, the
// level filter and the search applied by the API (mimicked here).
const ROWS = [
  { uuid: 'a3', level: 'info', subject: 'Security: weak SIP passwords', msg: '11040 extensions', created_at: '2026-09-24T12:00:00Z' },
  { uuid: 'a1', level: 'warning', subject: 'High CPU Usage on voipappz', msg: 'CPU at 86%', created_at: '2026-09-24T10:00:00Z' },
  { uuid: 'a2', level: 'critical', subject: 'High Disk Usage on memo-db', msg: 'Disk at 94%', created_at: '2026-09-23T10:00:00Z' },
];
let unread;
const matching = ({ level = '', search = '' } = {}) => unread
  .filter(r => !level || r.level === level)
  .filter(r => !search || `${r.subject} ${r.msg}`.toLowerCase().includes(search.toLowerCase()));

vi.mock('../../services/api/notificationsApi', () => ({
  notificationsApi: {
    getUnreadAlerts: vi.fn(async (opts) => { const rows = matching(opts); return { rows, total: rows.length }; }),
    countUnreadAlerts: vi.fn(async (level) => matching({ level }).length),
    markRead: vi.fn(async (id) => { unread = unread.filter(r => r.uuid !== id); return { status: 'success' }; }),
  },
}));
vi.mock('../../hooks/useNavBadges', () => ({ refreshNavBadges: vi.fn() }));

import MonitoringSidebar from './MonitoringSidebar.jsx';
import { notificationsApi } from '../../services/api/notificationsApi';
import { refreshNavBadges } from '../../hooks/useNavBadges';

const subjects = () => screen.getAllByTestId('alert-row').map(r => r.querySelector('p').textContent);
const search = async (value) => {
  fireEvent.change(screen.getByLabelText('Search alerts'), { target: { value } });
  await act(() => new Promise(r => setTimeout(r, 350)));   // past the 300ms pause
};

beforeEach(() => { vi.clearAllMocks(); unread = [...ROWS]; });

describe('MonitoringSidebar', () => {
  it('lists unread alerts from /api/notifications, newest first, with the counts', async () => {
    render(<MonitoringSidebar />);
    expect(await screen.findByText('Alerts (3)')).toBeInTheDocument();
    expect(subjects()).toEqual(['Security: weak SIP passwords', 'High CPU Usage on voipappz', 'High Disk Usage on memo-db']);
    expect(screen.getByTestId('alerts-level-critical')).toHaveTextContent('critical 1');
    expect(notificationsApi.getUnreadAlerts).toHaveBeenCalledWith({ level: '', search: '' });
  });

  it('filters by level in the API, and the chip toggles back', async () => {
    render(<MonitoringSidebar />);
    fireEvent.click(await screen.findByTestId('alerts-level-critical'));
    await waitFor(() => expect(subjects()).toEqual(['High Disk Usage on memo-db']));
    expect(notificationsApi.getUnreadAlerts).toHaveBeenLastCalledWith({ level: 'critical', search: '' });
    fireEvent.click(screen.getByTestId('alerts-level-critical'));
    await waitFor(() => expect(subjects()).toHaveLength(3));
  });

  it('searches in the API once typing pauses', async () => {
    render(<MonitoringSidebar />);
    await screen.findByText('Alerts (3)');
    await search('disk');
    await waitFor(() => expect(subjects()).toEqual(['High Disk Usage on memo-db']));
    expect(notificationsApi.getUnreadAlerts).toHaveBeenLastCalledWith({ level: '', search: 'disk' });
    await search('nothing-like-this');
    expect(await screen.findByText('No alerts match.')).toBeInTheDocument();
  });

  it('orders by severity or oldest first', async () => {
    render(<MonitoringSidebar />);
    await screen.findByText('Alerts (3)');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Order alerts' }));
    fireEvent.click(screen.getByRole('option', { name: 'Severity' }));
    expect(subjects()).toEqual(['High Disk Usage on memo-db', 'High CPU Usage on voipappz', 'Security: weak SIP passwords']);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Order alerts' }));
    fireEvent.click(screen.getByRole('option', { name: 'Oldest' }));
    expect(subjects()[0]).toBe('High Disk Usage on memo-db');
  });

  it('marks one alert read with PATCH, then reloads and refreshes the badge', async () => {
    render(<MonitoringSidebar />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark "High CPU Usage on voipappz" as read' }));
    await waitFor(() => expect(screen.getByText('Alerts (2)')).toBeInTheDocument());
    expect(notificationsApi.markRead).toHaveBeenCalledWith('a1');
    expect(subjects()).not.toContain('High CPU Usage on voipappz');
    expect(refreshNavBadges).toHaveBeenCalled();
  });

  it('offers no bulk mark without a filter', async () => {
    render(<MonitoringSidebar />);
    await screen.findByText('Alerts (3)');
    expect(screen.queryByTestId('alerts-mark-filtered')).not.toBeInTheDocument();
    expect(screen.queryByText(/Mark all/)).not.toBeInTheDocument();
  });

  it('bulk-marks only what a level filter shows', async () => {
    render(<MonitoringSidebar />);
    fireEvent.click(await screen.findByTestId('alerts-level-warning'));
    await waitFor(() => expect(screen.getByTestId('alerts-mark-filtered')).toHaveTextContent('Mark 1 read'));
    fireEvent.click(screen.getByTestId('alerts-mark-filtered'));
    await waitFor(() => expect(screen.getByText('Alerts (2)')).toBeInTheDocument());
    expect(notificationsApi.markRead.mock.calls.map(c => c[0])).toEqual(['a1']);
  });

  it('bulk-marks only what a search shows', async () => {
    render(<MonitoringSidebar />);
    await screen.findByText('Alerts (3)');
    await search('High');
    await waitFor(() => expect(screen.getByTestId('alerts-mark-filtered')).toHaveTextContent('Mark 2 read'));
    fireEvent.click(screen.getByTestId('alerts-mark-filtered'));
    await waitFor(() => expect(screen.getByText('Alerts (1)')).toBeInTheDocument());
    expect(notificationsApi.markRead.mock.calls.map(c => c[0]).sort()).toEqual(['a1', 'a2']);
  });
});
