import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import PortalHeader from './PortalHeader';

vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ user: { name: 'Alex' }, acl: { dashboard: ['read'], calls: ['read'] }, logout: vi.fn() }) }));
vi.mock('../../context/PortalPreferencesContext', () => ({ usePortalPreferences: () => ({ preferences: { theme: 'light', calls_density: 'comfortable' }, ready: true, save: vi.fn() }) }));
vi.mock('../../context/SoftphoneContext', () => ({ useSoftphone: () => ({ connected: true, status: 'registered', dial: vi.fn() }) }));
vi.mock('../../context/PortalSidebarContext', () => ({ usePortalSidebar: () => ({ view: null, params: null, open: vi.fn(), toggle: vi.fn(), close: vi.fn() }) }));
vi.mock('../../services/customerPortalService', () => ({ loadCustomerPortalData: () => Promise.resolve(null) }));
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output>; }

// The bar holds three things: the phone key, the line, you. No nav, no menu.
describe('Portal header', () => {
  it('holds the phone, the line and you, and nothing else to click', () => {
    render(<MemoryRouter><PortalHeader /><Where /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: 'Search or go to' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Portal navigation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Your account and preferences' })).toBeNull();
    // The phone is the one action in the bar; the assistant is a tab inside it.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual([expect.stringMatching(/^Phone —/), 'You']);
    expect(screen.queryByTestId('assistant-button')).toBeNull();
  });

  it('the avatar puts the cursor on the line', () => {
    render(<MemoryRouter><PortalHeader /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('portal-avatar'));
    expect(screen.getByRole('combobox', { name: 'Search or go to' })).toHaveFocus();
  });
});
