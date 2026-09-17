import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isRoot: false }) }));
vi.mock('./GatusHealthPanel.jsx', () => ({ default: () => null }));
vi.mock('../../services/api/nodesApi', () => ({
  nodesApi: {
    getNodes: vi.fn(),
    getConnectedNodes: vi.fn(),
    getNodeHealth: vi.fn(),
  },
}));

import { nodesApi } from '../../services/api/nodesApi';
import MonitoringNodes from './MonitoringNodes.jsx';

// A node ships its own log lines to the API (app "node", host = its name);
// the Nodes screen opens the Logs modal filtered to that node.
describe('MonitoringNodes logs action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nodesApi.getNodes.mockResolvedValue([
      { uuid: 'n-20', name: 'node-192-168-137-20', ip_address_internal: '192.168.137.20', source: 'database', editable: true },
    ]);
    nodesApi.getConnectedNodes.mockResolvedValue([]);
    nodesApi.getNodeHealth.mockResolvedValue(null);
  });

  it('opens the Logs modal filtered to the node', async () => {
    const opened = vi.fn();
    window.addEventListener('openLogsModal', opened);
    render(<MonitoringNodes />);
    fireEvent.click(await screen.findByTestId('node-logs-n-20'));
    await waitFor(() => expect(opened).toHaveBeenCalledTimes(1));
    const params = new URLSearchParams(opened.mock.calls[0][0].detail);
    expect(params.get('app')).toBe('node');
    expect(params.get('host')).toBe('node-192-168-137-20');
    window.removeEventListener('openLogsModal', opened);
  });
});
