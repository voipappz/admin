import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../common/DynamicProfileEditor/DynamicProfileEditor', () => ({ default: () => null }));
vi.mock('../../services/api/nodesApi', () => ({ nodesApi: { getNodeCatalog: vi.fn() } }));

import { nodesApi } from '../../services/api/nodesApi';
import NodeEditDialog from './NodeEditDialog.jsx';

const node = {
  uuid: 'n-1', name: 'node-a', notes: '', type: 'voip', roles: ['switch'],
  profile: { wss_server: 'wss.example' },
  sip_interfaces: [{
    name: 'sofia', ip_address_internal: '10.0.0.1', ip_address_external: '1.2.3.4',
    port_internal: '5070', port_external: '5090', node_uuid: 'n-1', ip: '1.2.3.4', port: 5090,
  }],
};

const renderDialog = (onSave = vi.fn().mockResolvedValue({})) => {
  render(<NodeEditDialog open onClose={() => {}} onSave={onSave} nodeData={node} loading={false} />);
  return onSave;
};

beforeEach(() => {
  vi.clearAllMocks();
  nodesApi.getNodeCatalog.mockResolvedValue({ types: ['voip', 'app', 'db'], roles: ['switch', 'app', 'voip'] });
});

// Interfaces are the node's own column, written whole; GET's derived keys
// (node_uuid, ip, port) are never sent back.
describe('NodeEditDialog SIP interfaces', () => {
  it('edits, adds rows and saves the whole list without derived keys', async () => {
    const onSave = renderDialog();

    fireEvent.change(screen.getByTestId('sip-interface-0-port_external'), { target: { value: '5091' } });
    fireEvent.click(screen.getByTestId('sip-interface-add'));
    fireEvent.change(screen.getByTestId('sip-interface-1-name'), { target: { value: 'trunk' } });
    fireEvent.click(screen.getByTestId('node-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const payload = onSave.mock.calls[0][0];
    expect(payload.sip_interfaces).toEqual([
      { name: 'sofia', ip_address_internal: '10.0.0.1', ip_address_external: '1.2.3.4', port_internal: '5070', port_external: '5091' },
      { name: 'trunk' },
    ]);
    expect(payload.profile).toEqual({ wss_server: 'wss.example' });
  });

  it('shows examples and refuses a malformed IP or port', async () => {
    const onSave = renderDialog();
    fireEvent.click(screen.getByTestId('sip-interface-add'));
    expect(screen.getByTestId('sip-interface-1-ip_address_internal')).toHaveAttribute('placeholder', '10.0.0.5');
    expect(screen.getByTestId('sip-interface-1-port_external')).toHaveAttribute('placeholder', '5080');

    fireEvent.change(screen.getByTestId('sip-interface-0-ip_address_internal'), { target: { value: '423432' } });
    fireEvent.change(screen.getByTestId('sip-interface-0-port_internal'), { target: { value: '10.4.4.4' } });
    expect(screen.getByText('IPv4, e.g. 10.0.0.5')).toBeInTheDocument();
    expect(screen.getByText('1-65535')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('node-save'));
    expect(await screen.findByTestId('node-invalid')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument(); // the new row's empty name
    expect(onSave).not.toHaveBeenCalled();
  });

  it('removes a row', async () => {
    const onSave = renderDialog();
    fireEvent.click(screen.getByLabelText('Remove interface sofia'));
    fireEvent.click(screen.getByTestId('node-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].sip_interfaces).toEqual([]);
  });
});

// Type and roles offer only what GET /api/nodes?action=types lists.
describe('NodeEditDialog type and roles', () => {
  it('offers the server lists and saves the picks', async () => {
    const onSave = renderDialog();
    await waitFor(() => expect(nodesApi.getNodeCatalog).toHaveBeenCalled());

    fireEvent.mouseDown(screen.getByTestId('node-type'));
    const typeList = within(await screen.findByRole('listbox'));
    expect(typeList.getAllByRole('option').map((o) => o.textContent)).toEqual(['None', 'voip', 'app', 'db']);
    fireEvent.click(typeList.getByText('app'));

    fireEvent.mouseDown(screen.getByTestId('node-roles'));
    const roleList = within(await screen.findByRole('listbox'));
    expect(roleList.getAllByRole('option').map((o) => o.textContent)).toEqual(['switch', 'app', 'voip']);
    fireEvent.click(roleList.getByText('app'));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });

    fireEvent.click(screen.getByTestId('node-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: 'app', roles: ['switch', 'app'] });
  });
});
