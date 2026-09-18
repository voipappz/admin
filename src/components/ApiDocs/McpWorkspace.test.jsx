import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import McpWorkspace from './McpWorkspace.jsx';

vi.mock('../../config.js', () => ({ config: { apiBaseUrl: 'https://api.example.test' } }));
vi.mock('./McpConnect.jsx', () => ({
  default: ({ endpointUrl }) => <div data-testid="mcp-connect">connect:{endpointUrl}</div>,
}));
vi.mock('./McpConsole.jsx', () => ({
  default: ({ active, endpointUrl }) => <div data-testid="mcp-console">{String(active)}:{endpointUrl}</div>,
}));

describe('McpWorkspace', () => {
  it('shows connection instructions and the authenticated MCP browser together', () => {
    render(<McpWorkspace />);

    expect(screen.getByRole('heading', { name: 'MCP' })).toBeVisible();
    expect(screen.getByText('JSON-RPC 2.0 over POST')).toBeVisible();
    expect(screen.getByText(/Authorization: Bearer/)).toBeVisible();
    expect(screen.getByTestId('mcp-workspace-endpoint')).toHaveTextContent('https://api.example.test/api/mcp');
    expect(screen.getByTestId('mcp-connect')).toHaveTextContent('https://api.example.test/api/mcp');
    expect(screen.getByTestId('mcp-console')).toHaveTextContent('true:https://api.example.test/api/mcp');
  });
});
