import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// The whole point of these tests is the URL. /api/agent/* has never existed on
// the API — there is no /agent mount in lib/routes.rb, so every one of these
// calls 404'd with `x-cascade: pass` and the chat silently rendered nothing.
// The real routes are lib/endpoints/vmls.rb.

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ access: 'test-token' }),
}));

vi.mock('../../config', () => ({
  config: { apiBaseUrl: 'https://api.test' },
}));

vi.mock('../../services/api/providersApi', () => ({
  providersApi: {
    getProviders: vi.fn(async () => [
      { uuid: 'prov-1', name: 'GPT', profile: { model: 'gpt-4', service: 'openai' } },
    ]),
  },
}));

import useAIChat from './useAIChat';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

let fetchMock;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn(async () => jsonResponse([]));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const urlsCalled = () => fetchMock.mock.calls.map(([url]) => url);

describe('useAIChat session endpoints', () => {
  it('lists sessions from /api/vmls/sessions, never /api/agent/*', async () => {
    const { result } = renderHook(() => useAIChat());

    // An agent must be selected before fetchSessions does anything.
    await waitFor(() => expect(result.current.agents.length).toBeGreaterThan(0));
    await act(async () => { await result.current.fetchSessions(); });

    expect(urlsCalled()).toContain('https://api.test/api/vmls/sessions');
    expect(urlsCalled().some((u) => u.includes('/api/agent/'))).toBe(false);
  });

  it('loads one session from /api/vmls/sessions/:uuid', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messages: [] }));
    const { result } = renderHook(() => useAIChat());

    await act(async () => { await result.current.loadSession('sess-9'); });

    expect(urlsCalled()).toContain('https://api.test/api/vmls/sessions/sess-9');
  });

  it('deletes via DELETE /api/vmls/sessions/:uuid', async () => {
    const { result } = renderHook(() => useAIChat());

    await act(async () => { await result.current.deleteSession('sess-9'); });

    const [url, opts] = fetchMock.mock.calls.find(([u]) => u.includes('/sessions/sess-9'));
    expect(url).toBe('https://api.test/api/vmls/sessions/sess-9');
    expect(opts.method).toBe('DELETE');
  });

  it('streams the reply from POST /api/vmls/generate', async () => {
    const ndjson = [
      JSON.stringify({ event: 'RunStarted', session_id: 'sess-new' }),
      JSON.stringify({ event: 'RunContent', content: 'hi', session_id: 'sess-new' }),
      // Exactly what lib/endpoints/vmls.rb emits: an EMPTY content on
      // completion, because the text already arrived as RunContent.
      JSON.stringify({ event: 'RunCompleted', session_id: 'sess-new', content: '', tools: [] }),
    ].join('\n') + '\n';

    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/generate')) {
        const chunk = new TextEncoder().encode(ndjson);
        let sent = false;
        return {
          ok: true,
          status: 200,
          body: {
            getReader: () => ({
              read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: chunk })),
            }),
          },
        };
      }
      return jsonResponse([]);
    });

    const { result } = renderHook(() => useAIChat());
    await waitFor(() => expect(result.current.agents.length).toBeGreaterThan(0));

    await act(async () => { await result.current.sendMessage('hello'); });

    expect(urlsCalled()).toContain('https://api.test/api/vmls/generate');
    const agent = result.current.messages.filter((m) => m.role === 'agent').pop();
    expect(agent.content).toBe('hi');
  });

  it('sends every request with the bearer token', async () => {
    const { result } = renderHook(() => useAIChat());

    await act(async () => { await result.current.loadSession('sess-9'); });

    const [, opts] = fetchMock.mock.calls.find(([u]) => u.includes('/sessions/sess-9'));
    expect(opts.headers.Authorization).toBe('Bearer test-token');
  });
});
