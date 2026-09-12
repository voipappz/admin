import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../services/api/mcpApi', () => ({
  mcpApi: { rpc: vi.fn(), listTools: vi.fn(), callTool: vi.fn() },
}));

import { mcpApi } from '../../services/api/mcpApi';
import McpConsole from './McpConsole.jsx';

const TOOLS = [
  { name: 'nodes.connected', description: 'Which nodes are on the bus.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'calls.create',
    description: 'Place a call.',
    inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
  },
];

beforeEach(() => vi.clearAllMocks());

describe('McpConsole', () => {
  it('loads nothing until the tab is active, then lists the tools', async () => {
    mcpApi.listTools.mockResolvedValue(TOOLS);
    const { rerender } = render(<McpConsole active={false} endpointUrl="https://api.example.test/api/mcp" />);
    expect(mcpApi.listTools).not.toHaveBeenCalled();

    rerender(<McpConsole active endpointUrl="https://api.example.test/api/mcp" />);
    await waitFor(() => expect(mcpApi.listTools).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('mcp-console-description')).toHaveTextContent('Which nodes are on the bus.');
    expect(screen.getByTestId('mcp-console-endpoint')).toHaveTextContent('https://api.example.test/api/mcp');
  });

  it('sends tools/call with the edited arguments and shows structuredContent', async () => {
    mcpApi.listTools.mockResolvedValue(TOOLS);
    mcpApi.rpc.mockResolvedValue({
      jsonrpc: '2.0', id: 1,
      result: { content: [{ type: 'text', text: '{}' }], structuredContent: { call_uuid: 'c-1', to_type: 'extension' } },
    });
    render(<McpConsole active />);
    await screen.findByTestId('mcp-console-description');

    fireEvent.change(screen.getByTestId('mcp-console-tool'), { target: { value: 'calls.create' } });
    // The template pre-fills the required arguments from the schema.
    expect(screen.getByTestId('mcp-console-args')).toHaveValue('{\n  "from": "",\n  "to": ""\n}');
    fireEvent.change(screen.getByTestId('mcp-console-args'), { target: { value: '{"from":"1001","to":"1002"}' } });
    fireEvent.click(screen.getByTestId('mcp-console-send'));

    await waitFor(() => expect(mcpApi.rpc).toHaveBeenCalledWith('tools/call', { name: 'calls.create', arguments: { from: '1001', to: '1002' } }));
    expect(await screen.findByTestId('mcp-console-response')).toHaveTextContent('"call_uuid": "c-1"');
    expect(screen.getByTestId('mcp-console-log')).toHaveTextContent('calls.create');
  });

  it('shows a tool error as a warning, not a crash', async () => {
    mcpApi.listTools.mockResolvedValue(TOOLS);
    mcpApi.rpc.mockResolvedValue({ result: { content: [{ type: 'text', text: 'extension 1001 is not registered' }], isError: true } });
    render(<McpConsole active />);
    await screen.findByTestId('mcp-console-description');

    fireEvent.click(screen.getByTestId('mcp-console-send'));
    expect(await screen.findByTestId('mcp-console-tool-error')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-console-response')).toHaveTextContent('extension 1001 is not registered');
  });

  it('speaks raw JSON-RPC for methods the picker does not cover', async () => {
    mcpApi.listTools.mockResolvedValue(TOOLS);
    mcpApi.rpc.mockResolvedValue({ result: { protocolVersion: '2025-06-18' } });
    render(<McpConsole active />);
    await screen.findByTestId('mcp-console-description');

    fireEvent.change(screen.getByTestId('mcp-console-tool'), { target: { value: '__raw__' } });
    fireEvent.change(screen.getByTestId('mcp-console-method'), { target: { value: 'initialize' } });
    fireEvent.click(screen.getByTestId('mcp-console-send'));

    await waitFor(() => expect(mcpApi.rpc).toHaveBeenCalledWith('initialize', {}));
    expect(await screen.findByTestId('mcp-console-response')).toHaveTextContent('2025-06-18');
  });

  it('refuses to send arguments that are not JSON', async () => {
    mcpApi.listTools.mockResolvedValue(TOOLS);
    render(<McpConsole active />);
    await screen.findByTestId('mcp-console-description');

    fireEvent.change(screen.getByTestId('mcp-console-args'), { target: { value: '{oops' } });
    fireEvent.click(screen.getByTestId('mcp-console-send'));

    expect(await screen.findByTestId('mcp-console-response')).toHaveTextContent('not valid JSON');
    expect(mcpApi.rpc).not.toHaveBeenCalled();
  });
});
