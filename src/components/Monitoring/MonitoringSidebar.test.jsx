import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api/alertsApi', () => ({ alertsApi: { acknowledge: vi.fn(() => Promise.resolve({ success: true })) } }));
vi.mock('../../hooks/useNavBadges', () => ({ refreshNavBadges: vi.fn() }));

import MonitoringSidebar from './MonitoringSidebar.jsx';
import { alertsApi } from '../../services/api/alertsApi';
import { refreshNavBadges } from '../../hooks/useNavBadges';

const ALERTS = [
  { id: 'a1', level: 'warning', subject: 'High CPU Usage on voipappz', message: 'CPU at 86%', meta: { host: 'voipappz' }, timestamp: '2026-09-24T10:00:00Z' },
  { id: 'a2', level: 'critical', subject: 'High Disk Usage on memo-db', message: 'Disk at 94%', meta: { host: 'memo-db' }, timestamp: '2026-09-23T10:00:00Z' },
  { id: 'a3', level: 'info', subject: 'Security: weak SIP passwords', message: '11040 extensions', meta: {}, timestamp: '2026-09-24T12:00:00Z' },
];
const subjects = () => screen.getAllByTestId('alert-row').map(r => r.querySelector('p').textContent);

beforeEach(() => vi.clearAllMocks());

describe('MonitoringSidebar', () => {
  it('lists the alerts newest first, with the count', () => {
    render(<MonitoringSidebar alerts={ALERTS} />);
    expect(screen.getByText('Alerts (3)')).toBeInTheDocument();
    expect(subjects()).toEqual(['Security: weak SIP passwords', 'High CPU Usage on voipappz', 'High Disk Usage on memo-db']);
  });

  it('filters by level, and the chip toggles back to all', () => {
    render(<MonitoringSidebar alerts={ALERTS} />);
    fireEvent.click(screen.getByTestId('alerts-level-critical'));
    expect(subjects()).toEqual(['High Disk Usage on memo-db']);
    fireEvent.click(screen.getByTestId('alerts-level-critical'));
    expect(subjects()).toHaveLength(3);
  });

  it('searches subject, message and host', () => {
    render(<MonitoringSidebar alerts={ALERTS} />);
    fireEvent.change(screen.getByLabelText('Search alerts'), { target: { value: 'memo' } });
    expect(subjects()).toEqual(['High Disk Usage on memo-db']);
    fireEvent.change(screen.getByLabelText('Search alerts'), { target: { value: 'nothing-like-this' } });
    expect(screen.getByText('No alerts match.')).toBeInTheDocument();
  });

  it('orders by severity or oldest first', () => {
    render(<MonitoringSidebar alerts={ALERTS} />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Order alerts' }));
    fireEvent.click(screen.getByRole('option', { name: 'Severity' }));
    expect(subjects()).toEqual(['High Disk Usage on memo-db', 'High CPU Usage on voipappz', 'Security: weak SIP passwords']);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Order alerts' }));
    fireEvent.click(screen.getByRole('option', { name: 'Oldest' }));
    expect(subjects()[0]).toBe('High Disk Usage on memo-db');
  });

  it('marks one alert read: acknowledged, gone, badge and data refreshed', async () => {
    const onChanged = vi.fn();
    render(<MonitoringSidebar alerts={ALERTS} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark "High CPU Usage on voipappz" as read' }));
    await waitFor(() => expect(screen.getByText('Alerts (2)')).toBeInTheDocument());
    expect(alertsApi.acknowledge).toHaveBeenCalledWith('a1');
    expect(subjects()).not.toContain('High CPU Usage on voipappz');
    expect(refreshNavBadges).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it('"Mark all read" marks only what the filter shows', async () => {
    render(<MonitoringSidebar alerts={ALERTS} />);
    fireEvent.click(screen.getByTestId('alerts-level-warning'));
    const button = screen.getByTestId('alerts-mark-all');
    expect(button).toHaveTextContent('Mark 1 read');
    fireEvent.click(button);
    await waitFor(() => expect(alertsApi.acknowledge).toHaveBeenCalledTimes(1));
    expect(alertsApi.acknowledge).toHaveBeenCalledWith('a1');
    await waitFor(() => expect(screen.getByText('Alerts (2)')).toBeInTheDocument());
  });

  it('keeps an alert whose acknowledge failed', async () => {
    alertsApi.acknowledge.mockRejectedValueOnce(new Error('500'));
    render(<MonitoringSidebar alerts={ALERTS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark "Security: weak SIP passwords" as read' }));
    await waitFor(() => expect(alertsApi.acknowledge).toHaveBeenCalled());
    expect(screen.getByText('Alerts (3)')).toBeInTheDocument();
  });
});
