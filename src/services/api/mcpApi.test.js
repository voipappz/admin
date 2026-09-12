import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../apiService', () => {
  const apiService = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), getText: vi.fn() };
  return { apiService, default: apiService, toFormData: vi.fn() };
});

import apiService from '../apiService';
import { mcpApi } from './mcpApi';

beforeEach(() => vi.clearAllMocks());

describe('mcpApi.rpc', () => {
  it('posts a JSON-RPC 2.0 envelope to the authenticated /api/mcp, quietly', async () => {
    apiService.post.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: {} });

    await mcpApi.rpc('initialize', { a: 1 });

    const [url, body, options, context, showMessages, skipCircuitBreaker] = apiService.post.mock.calls[0];
    expect(url).toBe('/api/mcp');
    expect(body).toMatchObject({ jsonrpc: '2.0', method: 'initialize', params: { a: 1 } });
    expect(typeof body.id).toBe('number');
    expect(options).toEqual({});
    expect(context).toBe('mcp request');
    expect(showMessages).toBe(false);
    expect(skipCircuitBreaker).toBe(true);
  });

  it('gives every request its own id', async () => {
    apiService.post.mockResolvedValue({});
    await mcpApi.rpc('ping');
    await mcpApi.rpc('ping');
    const ids = apiService.post.mock.calls.map(([, body]) => body.id);
    expect(ids[0]).not.toBe(ids[1]);
  });
});

describe('mcpApi.listTools / callTool', () => {
  it('unwraps the tool list', async () => {
    apiService.post.mockResolvedValue({ result: { tools: [{ name: 'nodes.connected' }] } });
    expect(await mcpApi.listTools()).toEqual([{ name: 'nodes.connected' }]);
  });

  it('answers the tool result as-is, including isError, and throws on a JSON-RPC error', async () => {
    apiService.post.mockResolvedValueOnce({ result: { content: [{ type: 'text', text: 'nope' }], isError: true } });
    const result = await mcpApi.callTool('calls.create', { from: '1001', to: '1002' });
    expect(result.isError).toBe(true);
    expect(apiService.post.mock.calls[0][1].params).toEqual({ name: 'calls.create', arguments: { from: '1001', to: '1002' } });

    apiService.post.mockResolvedValueOnce({ error: { code: -32601, message: 'Unknown tool: nodes.reboot' } });
    await expect(mcpApi.callTool('nodes.reboot')).rejects.toThrow('Unknown tool: nodes.reboot');
  });
});
