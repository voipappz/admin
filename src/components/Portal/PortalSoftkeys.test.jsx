import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import PortalSoftkeys, { softkeysFor } from './PortalSoftkeys.jsx';

let acl = { dashboard: ['read'], calls: ['read'] };
vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ acl }) }));
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output>; }

describe('softkeys', () => {
  it('are the places, and only the places — the phone and the assistant are corner buttons', () => {
    expect(softkeysFor({ dashboard: ['read'], calls: ['read'] }).map((k) => k.label)).toEqual(['Calls', 'Live']);
  });

  it('drops Live for a user without the dashboard permission', () => {
    expect(softkeysFor({ calls: ['read'] }).map((k) => k.label)).toEqual(['Calls']);
  });

  it('mark the current screen and move between screens', () => {
    render(<MemoryRouter initialEntries={['/']}><PortalSoftkeys /><Where /></MemoryRouter>);
    expect(screen.getByTestId('softkey-calls')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByTestId('softkey-live'));
    expect(screen.getByTestId('where')).toHaveTextContent('/live');
    expect(screen.getByTestId('softkey-live')).toHaveAttribute('aria-current', 'page');
  });
});
