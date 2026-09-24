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
  it('holds the places, the line and the phone — no avatar, no account menu', () => {
    render(<MemoryRouter><PortalHeader /><Where /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: 'Search or go to' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Portal navigation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Your account and preferences' })).toBeNull();
    // Places at the left end, the phone at the right, and no account menu:
    // signing out and the settings are rows in the line.
    expect(screen.getByTestId('nav-calls')).toBeInTheDocument();
    expect(screen.getByTestId('phone-button')).toHaveAccessibleName(/^Phone —/);
    expect(screen.queryByTestId('portal-avatar')).toBeNull();
    expect(screen.queryByTestId('assistant-button')).toBeNull();
  });

});
