import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../common/DynamicProfileEditor/DynamicProfileEditor', () => ({ default: () => null }));

import NodeEditDialog from './NodeEditDialog.jsx';

const node = {
  uuid: 'n-1', name: 'node-a', notes: '', profile: { wss_server: 'wss.example' },
  sip_interfaces: [{
    name: 'sofia', ip_address_internal: '10.0.0.1', ip_address_external: '1.2.3.4',
    port_internal: '5070', port_external: '5090', node_uuid: 'n-1', ip: '1.2.3.4', port: 5090,
  }],
};

// Interfaces are the node's own column, written whole; GET's derived keys
// (node_uuid, ip, port) are never sent back.
describe('NodeEditDialog SIP interfaces', () => {
  it('edits, adds and saves the whole list without derived keys', async () => {
    const onSave = vi.fn().mockResolvedValue({});
    render(<NodeEditDialog open onClose={() => {}} onSave={onSave} nodeData={node} loading={false} />);

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
});
