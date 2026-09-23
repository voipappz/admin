import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isRoot: true }) }));
vi.mock('./GatusHealthPanel.jsx', () => ({ default: () => null }));
vi.mock('../../services/api/nodesApi', () => ({
  nodesApi: {
    getNodes: vi.fn(),
    getConnectedNodes: vi.fn(),
    getNodeHealth: vi.fn(),
    deleteNode: vi.fn(),
  },
}));

import { nodesApi } from '../../services/api/nodesApi';
import MonitoringNodes from './MonitoringNodes.jsx';

// Deleting a node asks first, through the shared ConfirmDialog. The screen had
// no test for this: its only one covered the View Logs action, removed with
// the per-record log trail.
describe('MonitoringNodes delete', () => {
  const node = {
    uuid: 'n-20', name: 'node-192-168-137-20',
    ip_address_internal: '192.168.137.20', source: 'database', editable: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    nodesApi.getNodes.mockResolvedValue([node]);
    nodesApi.getConnectedNodes.mockResolvedValue([]);
    nodesApi.getNodeHealth.mockResolvedValue(null);
    nodesApi.deleteNode.mockResolvedValue({});
  });

  const openConfirm = async () => {
    render(<MonitoringNodes />);
    fireEvent.click(await screen.findByTestId(`node-delete-${node.uuid}`));
    return screen.findByRole('dialog', { name: 'Delete node' });
  };

  it('asks before deleting, naming the node and what a delete means', async () => {
    const dialog = await openConfirm();
    expect(dialog).toHaveTextContent(node.name);
    expect(dialog).toHaveAccessibleDescription(/soft deleted/);
    expect(nodesApi.deleteNode).not.toHaveBeenCalled();
  });

  it('deletes on confirm and reloads the list', async () => {
    await openConfirm();
    fireEvent.click(screen.getByTestId('node-delete-confirm'));
    await waitFor(() => expect(nodesApi.deleteNode).toHaveBeenCalledWith(node.uuid));
    await waitFor(() => expect(nodesApi.getNodes).toHaveBeenCalledTimes(2));
  });

  it('deletes nothing on cancel', async () => {
    await openConfirm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete node' })).toBeNull());
    expect(nodesApi.deleteNode).not.toHaveBeenCalled();
  });
});
