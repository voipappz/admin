import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ApiDocs from './ApiDocs.jsx';

vi.mock('swagger-ui-react', () => ({
  default: ({ spec, requestInterceptor }) => {
    const request = requestInterceptor({ headers: {} });
    return <div data-testid="swagger-ui" data-server={spec.servers[0].url} data-authorization={request.headers.Authorization} />;
  },
}));
vi.mock('swagger-ui-react/swagger-ui.css', () => ({}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ access: 'admin-access-token' }) }));
const themeMode = vi.hoisted(() => ({ isDarkMode: false }));
vi.mock('../../context/ThemeContext', () => ({ useThemeMode: () => themeMode }));
vi.mock('../../config.js', () => ({ config: { apiBaseUrl: 'https://api.example.test' } }));
vi.mock('./McpConnect', () => ({ default: ({ endpointUrl }) => <div data-testid="mcp-connect">{endpointUrl}</div> }));

const contract = { openapi: '3.0.1', servers: [], paths: { '/api/calls': { get: {} } } };

describe('ApiDocs', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    themeMode.isDarkMode = false;
    document.documentElement.classList.remove('dark-mode');
  });

  it('renders one Swagger screen with MCP available only from a button', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => contract });
    render(<ApiDocs />);

    const swagger = await screen.findByTestId('swagger-ui');
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/tasks/openapi.json', {
      credentials: 'omit', headers: { Accept: 'application/json' },
    });
    expect(swagger).toHaveAttribute('data-server', 'https://api.example.test');
    expect(swagger).toHaveAttribute('data-authorization', 'Bearer admin-access-token');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mcp-connect')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'MCP' }));
    expect(screen.getByText('MCP endpoint')).toBeVisible();
    expect(screen.getByTestId('mcp-connect')).toHaveTextContent('https://api.example.test/api/mcp');
  });

  it('mirrors dark mode for Swagger and removes the flag on unmount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => contract });
    themeMode.isDarkMode = true;
    const { unmount } = render(<ApiDocs />);
    await screen.findByTestId('swagger-ui');
    expect(document.documentElement).toHaveClass('dark-mode');
    unmount();
    expect(document.documentElement).not.toHaveClass('dark-mode');
  });

  it('shows an error when the live contract cannot be loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 });
    render(<ApiDocs />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('OpenAPI document returned HTTP 503'));
  });
});
