import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import McpConnect, { basicHeader, connectRecipes } from './McpConnect';

const URL = 'https://api.example.test/api/mcp';
const TOKEN = basicHeader('dev@example.test', 'Secret-1');

afterEach(() => vi.unstubAllGlobals());

function fill() {
  fireEvent.change(screen.getByTestId('mcp-connect-email'), { target: { value: 'dev@example.test' } });
  fireEvent.change(screen.getByTestId('mcp-connect-password'), { target: { value: 'Secret-1' } });
}

describe('McpConnect', () => {
  it('encodes HTTP Basic and keeps a placeholder until both fields are filled', () => {
    expect(TOKEN).toBe(`Basic ${btoa('dev@example.test:Secret-1')}`);
    expect(basicHeader('dev@example.test', '')).toBe('Basic <email:password, base64>');
  });

  it('builds every recipe from the endpoint and the credential', () => {
    const recipes = connectRecipes(URL, TOKEN);
    expect(recipes.map((r) => r.key)).toEqual(['claude-code', 'desktop', 'codex', 'curl']);
    recipes.filter((r) => r.key !== 'codex').forEach((r) => {
      expect(r.code).toContain(URL);
      expect(r.code).toContain(TOKEN);
    });
    expect(recipes[0].code).toContain(`claude mcp add --transport http voipappz ${URL}`);
    expect(recipes[2].code).toContain('codex mcp add voipappz');
    expect(recipes[2].code).toContain('--bearer-token-env-var VOIPAPPZ_MCP_TOKEN');
    expect(recipes[3].code).toContain('"method":"tools/list"');
  });

  it('tests the typed credential against the endpoint with plain fetch and lists the tools', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'devices.list' }, { name: 'calls.live' }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<McpConnect endpointUrl={URL} copyText={vi.fn()} />);

    // Nothing to test until a credential is typed.
    expect(screen.getByTestId('mcp-connect-test')).toBeDisabled();
    fill();
    fireEvent.click(screen.getByTestId('mcp-connect-test'));

    await waitFor(() => expect(screen.getByTestId('mcp-connect-ok')).toBeInTheDocument());
    expect(screen.getByText('devices.list')).toBeVisible();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    // Exactly the header the copied config carries — never the admin session.
    expect(init.headers.Authorization).toBe(TOKEN);
    expect(JSON.parse(init.body).method).toBe('tools/list');
  });

  it('reads a 401 as the credential, not the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    render(<McpConnect endpointUrl={URL} copyText={vi.fn()} />);
    fill();
    fireEvent.click(screen.getByTestId('mcp-connect-test'));
    await waitFor(() => expect(screen.getByTestId('mcp-connect-fail')).toHaveTextContent('401'));
  });

  it('fills the credential into the shown recipe and copies it', () => {
    const copyText = vi.fn();
    render(<McpConnect endpointUrl={URL} copyText={copyText} />);
    expect(screen.getByTestId('mcp-connect-code').textContent).toContain('claude mcp add');
    expect(screen.getByTestId('mcp-connect-code').textContent).toContain('<email:password, base64>');

    fill();
    fireEvent.click(screen.getByTestId('mcp-connect-tab-curl'));
    expect(screen.getByTestId('mcp-connect-code').textContent).toContain(TOKEN);

    fireEvent.click(screen.getByRole('button', { name: 'copy curl config' }));
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining(TOKEN), 'curl config copied.');
  });
});
