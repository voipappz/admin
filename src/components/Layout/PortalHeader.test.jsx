import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import PortalHeader from './PortalHeader';

vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ user: { name: 'Alex' }, acl: { dashboard: ['read'], calls: ['read'] }, logout: vi.fn() }) }));
vi.mock('../../context/PortalPreferencesContext', () => ({ usePortalPreferences: () => ({ preferences: { theme: 'light', calls_density: 'comfortable' }, ready: true, save: vi.fn() }) }));
vi.mock('../../context/SoftphoneContext', () => ({ useSoftphone: () => ({ connected: true, dial: vi.fn() }) }));
vi.mock('../../services/customerPortalService', () => ({ loadCustomerPortalData: () => Promise.resolve(null) }));
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output>; }

// The bar holds three things: the phone key, the line, you. No nav, no menu.
describe('Portal header', () => {
  it('has the phone key, the line and the avatar, and nothing else to click', () => {
    render(<MemoryRouter><PortalHeader /><Where /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: 'Search or go to' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Portal navigation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Your account and preferences' })).toBeNull();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Phone', 'You']);
  });

  it('the phone key opens the phone screen', () => {
    render(<MemoryRouter><PortalHeader /><Where /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('portal-phone-toggle'));
    expect(screen.getByTestId('where')).toHaveTextContent('/phone');
  });

  it('the avatar puts the cursor on the line', () => {
    render(<MemoryRouter><PortalHeader /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('portal-avatar'));
    expect(screen.getByRole('combobox', { name: 'Search or go to' })).toHaveFocus();
  });
});
