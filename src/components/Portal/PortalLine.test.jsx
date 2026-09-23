import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import PortalLine from './PortalLine.jsx';

const mockSave = vi.fn();
const mockDial = vi.fn();
const mockLogout = vi.fn();
vi.mock('../../context/UserAuthContext', () => ({ useUserAuth: () => ({ acl: { dashboard: ['read'], calls: ['read'] }, logout: mockLogout }) }));
vi.mock('../../context/PortalPreferencesContext', () => ({ usePortalPreferences: () => ({ preferences: { theme: 'light', calls_density: 'comfortable' }, ready: true, save: mockSave }) }));
vi.mock('../../context/SoftphoneContext', () => ({ useSoftphone: () => ({ dial: mockDial }) }));
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.search}</output>; }
const mount = () => render(<MemoryRouter initialEntries={['/my-calls']}><PortalLine /><Where /></MemoryRouter>);

describe('the line', () => {
  beforeEach(() => { mockSave.mockClear(); mockDial.mockClear(); });

  it('is a combobox whose rows appear on focus and close on Escape', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    expect(line).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(line);
    expect(line).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: /Calls/ })).toBeInTheDocument();
    fireEvent.keyDown(line, { key: 'Escape' });
    expect(line).toHaveAttribute('aria-expanded', 'false');
  });

  it('goes where Enter says, moving with the arrow keys', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.keyDown(line, { key: 'ArrowDown' }); // Calls -> Live
    fireEvent.keyDown(line, { key: 'Enter' });
    expect(screen.getByTestId('where')).toHaveTextContent('/live');
  });

  it('calls a typed number through the phone', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: '0501234567' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Call 0501234567/ }));
    expect(mockDial).toHaveBeenCalledWith('0501234567');
    expect(screen.getByTestId('where')).toHaveTextContent('/phone');
  });

  it('searches calls for typed text, keeping the text intact', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: '050%123' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Search calls for/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/my-calls?q=050%25123');
  });

  it('flips a setting from a row', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: 'compact' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Compact rows/ }));
    expect(mockSave).toHaveBeenCalledWith({ calls_density: 'compact' });
  });

  it('always has somewhere to go with text typed: the search row, even when nothing else matches', () => {
    mount();
    const line = screen.getByRole('combobox', { name: 'Search or go to' });
    fireEvent.focus(line);
    fireEvent.change(line, { target: { value: 'zzzz' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Search calls for “zzzz”']);
    fireEvent.keyDown(line, { key: 'ArrowDown' }); // past the end: stays on the one row
    fireEvent.keyDown(line, { key: 'Enter' });
    expect(screen.getByTestId('where')).toHaveTextContent('/my-calls?q=zzzz');
  });
});
