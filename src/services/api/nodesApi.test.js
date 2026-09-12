import { beforeEach, describe, expect, it, vi } from 'vitest';

// nodesApi imports the DEFAULT export, so the mock has to provide it.
vi.mock('../apiService', () => {
  const apiService = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), getText: vi.fn() };
  return { apiService, default: apiService, toFormData: vi.fn() };
});

import apiService from '../apiService';
import { nodesApi } from './nodesApi';

beforeEach(() => vi.clearAllMocks());

describe('nodesApi.getNodes', () => {
  it('reads the CRUD endpoint — the only one carrying source/editable', async () => {
    apiService.get.mockResolvedValue([{ uuid: 'n1', source: 'database', editable: true }]);

    const nodes = await nodesApi.getNodes();

    expect(apiService.get).toHaveBeenCalledWith('/api/nodes', {}, 'fetching nodes', false, true);
    expect(nodes[0].editable).toBe(true);
  });

  const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

  it('falls back to the legacy read when /api/nodes is absent', async () => {
    apiService.get
      .mockRejectedValueOnce(httpError(404))
      .mockResolvedValueOnce([{ uuid: 'n1', name: 'APP' }]);

    const nodes = await nodesApi.getNodes();

    expect(apiService.get).toHaveBeenNthCalledWith(1, '/api/nodes', {}, 'fetching nodes', false, true);
    expect(apiService.get).toHaveBeenNthCalledWith(2, '/api/customers/nodes', {}, 'fetching fallback nodes', false, true);
    expect(nodes[0].name).toBe('APP');
  });

  it('falls back on 405 too — a route that exists but not for GET', async () => {
    apiService.get
      .mockRejectedValueOnce(httpError(405))
      .mockResolvedValueOnce([{ uuid: 'n1', name: 'APP' }]);

    await nodesApi.getNodes();

    expect(apiService.get).toHaveBeenCalledTimes(2);
  });

  // The bug: a bare `catch` read 401 as "endpoint missing" and retried. Since
  // apiService fires authContextLogout() on every 401, an expired token bounced
  // the user to the login screen twice — and the retry could not have worked,
  // the fallback needs the same token.
  it('does NOT retry on 401 — it propagates, so one bad token is one logout', async () => {
    apiService.get.mockRejectedValueOnce(httpError(401));

    await expect(nodesApi.getNodes()).rejects.toMatchObject({ status: 401 });

    expect(apiService.get).toHaveBeenCalledTimes(1);
    expect(apiService.get).toHaveBeenCalledWith('/api/nodes', {}, 'fetching nodes', false, true);
  });

  it('does NOT retry on 500 — a broken API is not a missing route', async () => {
    apiService.get.mockRejectedValueOnce(httpError(500));

    await expect(nodesApi.getNodes()).rejects.toMatchObject({ status: 500 });

    expect(apiService.get).toHaveBeenCalledTimes(1);
  });
});

describe('nodesApi writes', () => {
  it('creates a node', async () => {
    apiService.post.mockResolvedValue({ uuid: 'n2' });
    const payload = { name: 'egress-1', type: 'egress', roles: ['egress'], profile: { ip_address_internal: '10.0.0.9' } };

    await nodesApi.createNode(payload);

    expect(apiService.post).toHaveBeenCalledWith('/api/nodes', payload, {}, 'creating node');
  });

  it('updates a node by uuid', async () => {
    apiService.patch.mockResolvedValue({ uuid: 'n2' });

    await nodesApi.updateNode('n2', { name: 'renamed' });

    expect(apiService.patch).toHaveBeenCalledWith('/api/nodes/n2', { name: 'renamed' }, {}, 'updating node');
  });

  it('deletes a node by uuid', async () => {
    apiService.delete.mockResolvedValue({ uuid: 'n2' });

    await nodesApi.deleteNode('n2');

    expect(apiService.delete).toHaveBeenCalledWith('/api/nodes/n2', {}, 'deleting node');
  });

  it('imports the va.yaml nodes with no body', async () => {
    apiService.post.mockResolvedValue({ imported: 4, nodes: [] });

    const res = await nodesApi.importNodes();

    expect(apiService.post).toHaveBeenCalledWith('/api/nodes/import', null, {}, 'importing nodes from va.yaml');
    expect(res.imported).toBe(4);
  });
});

describe('nodesApi.getConnectedNodes', () => {
  // One request for the fleet; the API does the per-node NATS fan-out. Quiet
  // (no toast) and outside the circuit breaker, like the other health reads.
  it('asks the API which nodes answer on the bus, in one call', async () => {
    apiService.get.mockResolvedValue([
      { uuid: 'n1', name: 'switch1', connected: true, ok: false, health: { node_uuid: 'n1' } },
      { uuid: 'n2', name: 'switch2', connected: false, reason: 'no responder' },
    ]);

    const rows = await nodesApi.getConnectedNodes();

    expect(apiService.get).toHaveBeenCalledTimes(1);
    expect(apiService.get).toHaveBeenCalledWith('/api/nodes?action=connected', {}, 'fetching node bus status', false, true);
    // connected and ok are separate facts and both survive the call untouched
    expect(rows[0]).toMatchObject({ connected: true, ok: false });
    expect(rows[1]).toMatchObject({ connected: false, reason: 'no responder' });
  });
});
