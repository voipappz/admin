import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApiDocs from './ApiDocs.jsx';

vi.mock('swagger-ui-react', () => ({
  default: ({ spec, requestInterceptor }) => {
    const request = requestInterceptor({ headers: {} });

    return (
      <div
        data-testid="swagger-ui"
        data-server={spec.servers[0].url}
        data-authorization={request.headers.Authorization}
        data-header-names={Object.keys(request.headers).join(",")}
      />
    );
  },
}));

vi.mock('swagger-ui-react/swagger-ui.css', () => ({}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ access: 'admin-access-token' }),
}));

// Hoisted so the mock factory, which vi.mock lifts above this file's imports,
// can safely close over it.
const themeMode = vi.hoisted(() => ({ isDarkMode: false }));

vi.mock('../../context/ThemeContext', () => ({
  useThemeMode: () => themeMode,
}));

vi.mock('../../config.js', () => ({
  config: { apiBaseUrl: 'https://api.example.test' },
}));

vi.mock('../Tour', () => ({
  TourButton: () => <button type="button">Quick tour</button>,
}));

const contract = {
  openapi: '3.0.1',
  servers: [],
  paths: {
    '/auth/login': {
      post: { tags: ['auth'], operationId: 'auth_login_post', summary: 'Login' },
    },
    '/api/calls': {
      get: { tags: ['calls'], operationId: 'calls_get', summary: 'List calls' },
    },
    '/api/devices': {
      get: { operationId: 'devices_get', summary: 'List devices' },
    },
  },
};
const integrationStatus = {
  title: 'VoipAppz external integration readiness',
  topics: [
    {
      id: 'authentication',
      title: 'Authentication',
      question: 'Should the integration use Basic or token authentication?',
      status: 'partially-confirmed',
      status_label: 'Partially confirmed',
      guidance: 'Prefer the documented bearer-token flow.',
      paths: ['/auth', '/login'],
    },
  ],
};
function mockPublicResources() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url) => Promise.resolve({
    ok: true,
    json: async () => (url.includes('integration-status.json') ? integrationStatus : contract),
  }));
}

describe('ApiDocs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    themeMode.isDarkMode = false;
    document.documentElement.classList.remove('dark-mode');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue() },
    });
  });

  it('loads public API and Skill resources and authenticates only Try It Out requests', async () => {
    mockPublicResources();

    render(<ApiDocs />);

    await waitFor(() => expect(screen.getByTestId('swagger-ui')).toBeInTheDocument());
    expect(await screen.findByText('Authentication')).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/tasks/openapi.json',
      {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      },
    );
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/tasks/agent-skills/use-voipappz-api/references/integration-status.json',
      {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      },
    );
    // There is no public MCP server to discover; /api/mcp needs a token.
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/tasks/mcp'))).toBe(false);

    const swagger = screen.getByTestId('swagger-ui');
    expect(swagger).toHaveAttribute('data-server', 'https://api.example.test');
    expect(swagger).toHaveAttribute('data-authorization', 'Bearer admin-access-token');
    // The bearer token is the only header: the API reads the auth mode from it.
    expect(swagger).toHaveAttribute('data-header-names', 'Authorization');
  });

  it('keeps the MCP endpoint out of the pasted fallback prompt', async () => {
    mockPublicResources();

    render(<ApiDocs />);
    await waitFor(() => expect(screen.getByTestId('swagger-ui')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /No MCP client/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy fallback prompt' }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    const prompt = navigator.clipboard.writeText.mock.calls[0][0];
    expect(prompt).not.toContain('/mcp');
  });

  it('copies the public Skill and contract context before opening an AI assistant', async () => {
    mockPublicResources();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ApiDocs />);
    await waitFor(() => expect(screen.getByTestId('swagger-ui')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /No MCP client/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt + open Claude' }));

    expect(open).toHaveBeenCalledWith('https://claude.ai/new', '_blank', 'noopener,noreferrer');
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('https://api.example.test/tasks/agent-skills/use-voipappz-api/SKILL.md'),
    ));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('https://api.example.test/tasks/openapi.json'),
    );
    expect(await screen.findByText(/Agent context copied/)).toBeInTheDocument();
  });

  it('leads with the authenticated MCP endpoint and links to the API-owned provisioning catalog', async () => {
    mockPublicResources();

    render(<ApiDocs />);
    await waitFor(() => expect(screen.getByTestId('swagger-ui')).toBeInTheDocument());

    // The endpoint card is the section — it needs no heading above it.
    expect(screen.getByText('MCP endpoint')).toBeVisible();
    // Scoped to the card: the MCP console tab shows the same URL.
    const endpointCard = within(document.querySelector('[data-tour="devzone-mcp"]'));
    expect(endpointCard.getByText('https://api.example.test/api/mcp')).toBeVisible();
    expect(endpointCard.getByText('JSON-RPC 2.0 over POST · Authorization: Bearer <token> or Basic <email:password>')).toBeVisible();
    expect(screen.queryByText(/tasks\/mcp/)).not.toBeInTheDocument();
    expect(screen.getByText('Or read them directly')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Quick tour' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open in Settings' })).toHaveAttribute(
      'href',
      '/settings?section=provisioning-catalog',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'API Reference' }));
    expect(screen.getByRole('tab', { name: 'API Reference' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Quick tour' }));
    expect(screen.getByRole('tab', { name: 'For agents' })).toHaveAttribute('aria-selected', 'true');
  });

  it('mirrors the app dark theme onto the flag Swagger UI styles against', async () => {
    mockPublicResources();
    themeMode.isDarkMode = true;

    const { unmount } = render(<ApiDocs />);

    await waitFor(() => expect(screen.getByTestId('swagger-ui')).toBeInTheDocument());
    expect(document.documentElement.classList.contains('dark-mode')).toBe(true);

    unmount();
    expect(document.documentElement.classList.contains('dark-mode')).toBe(false);
  });

  it('leaves the dark-mode flag off in light theme', async () => {
    mockPublicResources();

    render(<ApiDocs />);

    await waitFor(() => expect(screen.getByTestId('swagger-ui')).toBeInTheDocument());
    expect(document.documentElement.classList.contains('dark-mode')).toBe(false);
  });

  it('puts the Skill guidance beside the endpoint it applies to', async () => {
    mockPublicResources();

    render(<ApiDocs />);
    await waitFor(() => expect(screen.getByTestId('swagger-ui')).toBeInTheDocument());

    // The rail lists the contract's own operations; opening one that a readiness
    // topic scopes to shows that topic's guidance next to it.
    fireEvent.click(screen.getByText('/auth/login'));
    expect(await screen.findByText('Worth knowing before you call this')).toBeInTheDocument();
    expect(screen.getAllByText('Prefer the documented bearer-token flow.').length).toBeGreaterThan(1);

    // An endpoint no topic scopes to gets no notes.
    fireEvent.click(screen.getByText('/api/calls'));
    await waitFor(() =>
      expect(screen.queryByText('Worth knowing before you call this')).not.toBeInTheDocument());
  });

  it('keeps endpoints in a grouped navigation rail on the left of the API reference', async () => {
    mockPublicResources();

    render(<ApiDocs />);
    await waitFor(() => expect(screen.getByTestId('swagger-ui')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'API Reference' }));
    const rail = screen.getByRole('navigation', { name: 'API operations' });

    expect(within(rail).getByText('Auth')).toBeVisible();
    expect(within(rail).getByText('Calls')).toBeVisible();
    // Untagged operations group by path segment, so /api/devices is under Devices.
    expect(within(rail).getByText('Devices')).toBeVisible();
    expect(within(rail).getByText('/api/devices')).toBeVisible();
  });

  it('shows an error when the backend contract cannot be loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 });

    render(<ApiDocs />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'OpenAPI document returned HTTP 503',
    );
  });
});
