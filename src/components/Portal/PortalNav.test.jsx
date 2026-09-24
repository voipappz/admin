import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import PortalNav, { placesFor } from './PortalNav.jsx';

let acl = { dashboard: ['read'], calls: ['read'] };
vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ acl }) }));
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output>; }

describe('the bar\'s places', () => {
  it('are the places, and only the places — the phone is a button, the assistant a tab inside it', () => {
    expect(placesFor({ dashboard: ['read'], calls: ['read'] }).map((k) => k.label)).toEqual(['Calls', 'Live']);
  });

  it('drops Live for a user without the dashboard permission', () => {
    expect(placesFor({ calls: ['read'] }).map((k) => k.label)).toEqual(['Calls']);
  });

  it('mark the current screen and move between screens', () => {
    render(<MemoryRouter initialEntries={['/']}><PortalNav /><Where /></MemoryRouter>);
    expect(screen.getByTestId('nav-calls')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByTestId('nav-live'));
    expect(screen.getByTestId('where')).toHaveTextContent('/live');
    expect(screen.getByTestId('nav-live')).toHaveAttribute('aria-current', 'page');
  });
});
