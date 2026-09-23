import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import PortalSoftkeys, { softkeysFor } from './PortalSoftkeys.jsx';

let acl = { dashboard: ['read'], calls: ['read'] };
vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ acl }) }));
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}</output>; }

describe('softkeys', () => {
  it('are always the same keys in the same order', () => {
    expect(softkeysFor({ dashboard: ['read'], calls: ['read'] }).map((k) => k.label)).toEqual(['Calls', 'Live', 'Assistant', 'Phone']);
  });

  it('drop Live for a user without the dashboard permission — three keys, none greyed', () => {
    expect(softkeysFor({ calls: ['read'] }).map((k) => k.label)).toEqual(['Calls', 'Assistant', 'Phone']);
  });

  it('mark the current screen and move between screens', () => {
    render(<MemoryRouter initialEntries={['/']}><PortalSoftkeys /><Where /></MemoryRouter>);
    expect(screen.getByTestId('softkey-calls')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByTestId('softkey-phone'));
    expect(screen.getByTestId('where')).toHaveTextContent('/phone');
    expect(screen.getByTestId('softkey-phone')).toHaveAttribute('aria-current', 'page');
  });
});
