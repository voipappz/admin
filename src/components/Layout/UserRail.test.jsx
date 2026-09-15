import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import UserRail from './UserRail';

/**
 * The portal rail's Assistant entry. The assistant used to open only on
 * Cmd/Ctrl+Shift+A, and only inside the admin shell, so a portal user had no
 * way to reach it at all.
 */

const mockOpenAIDrawer = vi.fn();
let mockChatContext;

vi.mock('../../context/UserAuthContext', () => ({
  useUserAuth: () => ({ user: { name: 'Portal User', email: 'user@example.test' }, logout: vi.fn() }),
}));

vi.mock('../../context/ThemeContext', () => ({
  useThemeMode: () => ({ isDarkMode: false, toggleTheme: vi.fn() }),
}));

vi.mock('../../context/AIChatSidebarContext', () => ({
  useAIChatSidebar: () => mockChatContext,
}));

const renderRail = () => render(
  <MemoryRouter initialEntries={['/']}>
    <UserRail />
  </MemoryRouter>
);

describe('UserRail assistant entry', () => {
  beforeEach(() => {
    mockOpenAIDrawer.mockReset();
    mockChatContext = { openAIDrawer: mockOpenAIDrawer };
  });

  it('opens the assistant over the current screen', () => {
    renderRail();

    fireEvent.click(screen.getByTestId('rail-assistant'));

    expect(mockOpenAIDrawer).toHaveBeenCalledTimes(1);
  });

  it('hides the entry when no assistant is mounted around the rail', () => {
    mockChatContext = undefined;

    renderRail();

    expect(screen.queryByTestId('rail-assistant')).not.toBeInTheDocument();
    expect(screen.getByTestId('rail-calls')).toBeInTheDocument();
  });
});
