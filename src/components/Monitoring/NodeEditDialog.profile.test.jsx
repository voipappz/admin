import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../../services/api/profileParamsApi', () => ({
  profileParamsApi: { getProfileParams: vi.fn() },
}));
vi.mock('../../services/api/nodesApi', () => ({
  nodesApi: { getNodeCatalog: vi.fn().mockResolvedValue({ types: ['voip'], roles: ['switch', 'app'] }) },
}));

import { profileParamsApi } from '../../services/api/profileParamsApi';
import NodeEditDialog from './NodeEditDialog.jsx';

// The node profile is rendered from the API's `node` field list
// (/api/assets/profile_params?type=node), the way the application dialog
// renders `environment`. PATCH /api/nodes replaces the profile whole, so a
// save must keep the keys the editor does not show. A field's `example` is its
// placeholder and its `pattern` blocks a malformed value.
describe('NodeEditDialog profile', () => {
  const fields = [
    { key: 'domain', name: 'Domain', input: 'string', value: '' },
    { key: 'wss_server', name: 'WSS server', input: 'string', value: '' },
    { key: 'ip_address_internal', name: 'Internal IP', input: 'string', value: '',
      example: '10.0.0.5', pattern: '^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$' },
  ];

  const node = {
    uuid: 'n-1',
    name: 'node-a',
    roles: ['switch'],
    profile: {
      domain: 'pbx.example.com',
      wss_server: 'pbx.example.com:8443',
      ip_address_internal: '10.0.0.5',
      sip_port: '5060', // not declared in the field list: must survive
    },
  };

  const renderDialog = (onSave = vi.fn().mockResolvedValue({})) => {
    render(<NodeEditDialog open onClose={() => {}} onSave={onSave} nodeData={node} loading={false} />);
    return onSave;
  };

  const inputFor = async (name) => within((await screen.findByText(name)).closest('tr')).getByRole('textbox');

  beforeEach(() => {
    vi.clearAllMocks();
    profileParamsApi.getProfileParams.mockResolvedValue(fields);
  });

  it('asks the API for the node field list and shows the stored values', async () => {
    renderDialog();
    const input = await inputFor('WSS server');
    // Values are filled in one render after the field list arrives.
    await waitFor(() => expect(input).toHaveValue('pbx.example.com:8443'));
    expect(profileParamsApi.getProfileParams).toHaveBeenCalledWith('node');
  });

  it('saves an edited wss_server and keeps the keys the editor does not show', async () => {
    const onSave = renderDialog();
    fireEvent.change(await inputFor('WSS server'), { target: { value: 'edge.example.com:7443' } });
    fireEvent.click(screen.getByTestId('node-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0];
    expect(payload.profile).toEqual({
      domain: 'pbx.example.com',
      wss_server: 'edge.example.com:7443',
      ip_address_internal: '10.0.0.5',
      sip_port: '5060',
    });
  });

  it('shows the example as placeholder and blocks a value that fails the pattern', async () => {
    const onSave = renderDialog();
    // By test id: "Internal IP" is also a column of the SIP interface table.
    const input = await screen.findByTestId('profile-field-ip_address_internal');
    expect(input).toHaveAttribute('placeholder', '10.0.0.5');

    fireEvent.change(input, { target: { value: '423432' } });
    expect(await screen.findByText('Expected like 10.0.0.5')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('node-save'));
    expect(await screen.findByTestId('node-invalid')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '10.0.0.9' } });
    fireEvent.click(screen.getByTestId('node-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].profile.ip_address_internal).toBe('10.0.0.9');
  });
});
