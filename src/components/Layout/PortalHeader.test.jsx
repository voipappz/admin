import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import PortalHeader from './PortalHeader';

vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ user: { name: 'Alex' }, acl: { dashboard: ['read'], call: ['read'] }, logout: vi.fn() }) }));
const mockSave = vi.fn();
vi.mock('../../context/PortalPreferencesContext', () => ({ usePortalPreferences: () => ({ preferences: { theme: 'light', calls_density: 'comfortable' }, ready: true, save: mockSave, reset: vi.fn() }) }));
vi.mock('../../context/SoftphoneContext', () => ({ useSoftphone: () => ({ connected: true }) }));
function CurrentRoute() { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; }

describe('Portal header', () => {
  it('keeps search visible and opens Calls with wildcard text intact', () => {
    render(<MemoryRouter><PortalHeader /><CurrentRoute /></MemoryRouter>);
    const search = screen.getByRole('textbox', { name: 'Search calls' });
    fireEvent.change(search, { target: { value: '050%123' } });
    fireEvent.submit(search.closest('form'));
    expect(screen.getByTestId('route')).toHaveTextContent('/my-calls?q=050%25123');
    expect(screen.getByRole('navigation', { name: 'Portal navigation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    expect(screen.getByTestId('route')).not.toHaveTextContent('q=');
  });

  it('keeps row density in the account menu, beside appearance, and no longer links to the assistant', () => {
    render(<MemoryRouter><PortalHeader /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Assistant' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Your account and preferences' }));
    expect(screen.getByText('Dark appearance')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('portal-density'));
    expect(mockSave).toHaveBeenCalledWith({ calls_density: 'compact' });
  });

  it('puts the phone toggle where the logo was, and reports the dock state', () => {
    const onTogglePhone = vi.fn();
    const { rerender } = render(<MemoryRouter><PortalHeader phoneOpen={false} onTogglePhone={onTogglePhone} /></MemoryRouter>);
    const toggle = screen.getByTestId('portal-phone-toggle');
    expect(toggle).toHaveAccessibleName('Phone');
    fireEvent.click(toggle);
    expect(onTogglePhone).toHaveBeenCalledTimes(1);
    rerender(<MemoryRouter><PortalHeader phoneOpen onTogglePhone={onTogglePhone} /></MemoryRouter>);
    expect(screen.getByTestId('portal-phone-toggle')).toHaveAccessibleName('Close phone');
  });
});
